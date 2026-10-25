// In-memory evidence repo and storage for unit tests.
import type {
  PartsCheck,
  CheckResult,
  JobStep,
  SafetyConfirmation,
  Asset,
  Detection,
  Evidence,
  IdentifyAssetResponse,
  Manual,
  ProcedureDetail,
} from "@tandrix/contracts";
import { HttpError } from "../src/errors";
import { noModelFinder } from "../src/manual-finder";
import { noModelGenerator } from "../src/procedure-generator";
import { noModelHighlighter } from "../src/highlighter";
import { noModelVoice } from "../src/voice";
import { noModelChecker } from "../src/step-checker";
import { noModelPartsChecker } from "../src/parts-checker";
import type { PartsChecksRepo } from "../src/repos/parts-checks";
import type { DetectionsRepo } from "../src/repos/detections";
import type { StepStateRepo, StepTransition } from "../src/repos/step-state";
import type { ProceduresRepo, SaveProcedure } from "../src/repos/procedures";
import type { NameplateReader } from "../src/nameplate";
import type { AssetsRepo, SaveAsset } from "../src/repos/assets";
import type { ManualsRepo, PendingUpload } from "../src/repos/manuals";
import type {
  EvidenceRepo,
  EvidenceStorage,
  NewEvidence,
  StoredObject,
} from "../src/repos/evidence";

export function memoryEvidence(
  owners: Map<string, string>,
  steps: Map<string, string> = new Map(),
) {
  const rows = new Map<string, Evidence>();
  const repo: EvidenceRepo & { rows: Map<string, Evidence> } = {
    rows,
    async ownsJob(ownerId, jobId) {
      return owners.get(jobId) === ownerId;
    },
    async stepInJob(jobId, stepId) {
      return steps.get(stepId) === jobId;
    },
    async createPending(e: NewEvidence) {
      const ev: Evidence = {
        id: e.id,
        jobId: e.jobId,
        jobStepId: e.jobStepId,
        kind: e.kind,
        surface: e.surface,
        storageKey: e.storageKey,
        mimeType: e.mimeType,
        byteSize: e.byteSize,
        ...(e.width ? { width: e.width } : {}),
        ...(e.height ? { height: e.height } : {}),
        capturedAt: e.capturedAt,
        uploadedAt: null,
        deletedAt: null,
      };
      rows.set(ev.id, ev);
      return ev;
    },
    async getForOwner(ownerId, jobId, id) {
      const ev = rows.get(id);
      return ev && ev.jobId === jobId && owners.get(jobId) === ownerId && !ev.deletedAt ? ev : null;
    },
    async markUploaded(id, byteSize) {
      const ev = { ...rows.get(id)!, uploadedAt: "2026-10-26T10:00:05.000Z", byteSize };
      rows.set(id, ev);
      return ev;
    },
    async listUploaded(jobId) {
      return [...rows.values()].filter((e) => e.jobId === jobId && e.uploadedAt && !e.deletedAt);
    },
  };
  return repo;
}

export function memoryStorage() {
  const objects = new Map<string, StoredObject>();
  const bytes = new Map<string, Uint8Array>();
  const storage: EvidenceStorage & { objects: Map<string, StoredObject>; removed: string[] } = {
    objects,
    removed: [],
    async createUploadUrl(path) {
      return { signedUrl: `http://storage.test/upload/${path}?token=t`, token: "t", path };
    },
    async stat(path) {
      return objects.get(path) ?? null;
    },
    async signedReadUrls(paths) {
      return new Map(
        paths.filter((p) => objects.has(p)).map((p) => [p, `http://storage.test/read/${p}?sig=s`]),
      );
    },
    async remove(path) {
      objects.delete(path);
      storage.removed.push(path);
    },
    async put(path, data, contentType) {
      objects.set(path, { size: data.length, contentType });
      bytes.set(path, data);
    },
    async download(path) {
      if (!objects.has(path)) throw new Error("not found");
      return bytes.get(path) ?? new Uint8Array([0xff, 0xd8, 0xff]);
    },
  };
  return storage;
}

export function memoryAssets() {
  const assets = new Map<string, Asset>();
  const jobAsset = new Map<string, string>();
  let n = 0;
  const repo: AssetsRepo & {
    assets: Map<string, Asset>;
    jobAsset: Map<string, string>;
    saves: SaveAsset[];
  } = {
    assets,
    jobAsset,
    saves: [],
    async getForOwner(ownerId, id) {
      const a = assets.get(id);
      return a && a.ownerId === ownerId ? a : null;
    },
    async saveForJob(input) {
      repo.saves.push(input);
      const a: Asset = {
        id: `00000000-0000-4000-8000-0000000a${String(++n).padStart(4, "0")}`,
        ownerId: input.ownerId,
        category: input.category,
        make: input.make,
        model: input.model,
        ...(input.serial ? { serial: input.serial } : {}),
        nameplateEvidenceId: input.nameplateEvidenceId ?? null,
        createdAt: "2026-10-26T10:00:00.000Z",
      };
      assets.set(a.id, a);
      jobAsset.set(input.jobId, a.id);
      return a;
    },
  };
  return repo;
}

/** Returns the queued answers in order; records what it was asked to read. */
export function scriptedReader(answers: IdentifyAssetResponse[] = []) {
  const reader: NameplateReader & { calls: Array<{ bytes: Uint8Array; mimeType: string }> } = {
    calls: [],
    async read(image) {
      reader.calls.push(image);
      const next = answers.shift();
      if (!next) throw new Error("no scripted answer");
      return next;
    },
  };
  return reader;
}

export function memoryManuals() {
  const manuals: Array<Manual & { ownerId: string | null }> = [];
  const uploads = new Map<string, PendingUpload>();
  let n = 0;
  const repo: ManualsRepo & {
    manuals: typeof manuals;
    uploads: typeof uploads;
    events: Array<{ jobId: string; manualId: string; how: string }>;
  } = {
    manuals,
    uploads,
    events: [],
    async findForModel(ownerId, key) {
      const newest = [...manuals].reverse();
      const own = newest.find((m) => m.assetModelKey === key && m.ownerId === ownerId);
      return strip(own ?? newest.find((m) => m.assetModelKey === key && m.ownerId === null));
    },
    async getForOwner(ownerId, id) {
      return strip(
        manuals.find((m) => m.id === id && (m.ownerId === null || m.ownerId === ownerId)),
      );
    },
    async insert(m) {
      const row = {
        id: `00000000-0000-4000-8000-0000000b${String(++n).padStart(4, "0")}`,
        assetModelKey: m.assetModelKey,
        title: m.title,
        sourceType: m.sourceType,
        sourceUrl: m.sourceUrl,
        storageKey: m.storageKey,
        pageCount: m.pageCount,
        createdAt: "2026-10-26T10:00:00.000Z",
        ownerId: m.ownerId,
      };
      manuals.push(row);
      return strip(row)!;
    },
    async createUpload(u) {
      const up = { ...u, completedAt: null };
      uploads.set(u.id, up);
      return up;
    },
    async getUpload(ownerId, jobId, id) {
      const up = uploads.get(id);
      return up && up.ownerId === ownerId && up.jobId === jobId ? up : null;
    },
    async completeUpload(id) {
      uploads.set(id, { ...uploads.get(id)!, completedAt: "2026-10-26T10:00:10.000Z" });
    },
    async recordAttached(jobId, manualId, how) {
      repo.events.push({ jobId, manualId, how });
    },
  };
  return repo;
}

const strip = (m: (Manual & { ownerId: string | null }) | undefined): Manual | null => {
  if (!m) return null;
  const { ownerId: _owner, ...manual } = m;
  return manual;
};

export const TEST_TOKEN_SECRET = "test-secret-test-secret-test-secret!";

/** Manual deps for tests that don't exercise manuals. */
export const noManuals = () => ({
  manuals: memoryManuals(),
  manualStorage: memoryStorage(),
  manualFinder: noModelFinder,
  tokenSecret: TEST_TOKEN_SECRET,
  procedures: memoryProcedures(),
  procedureGenerator: noModelGenerator,
  detections: memoryDetections(),
  highlighter: noModelHighlighter,
  stepState: memoryStepState(),
  transcriber: noModelVoice,
  answerer: noModelVoice,
  checker: noModelChecker,
  partsChecks: memoryPartsChecks(),
  partsChecker: noModelPartsChecker,
});

/** Stores saved procedures as details; `saves` records what the route asked to save. */
export function memoryProcedures() {
  const details = new Map<string, ProcedureDetail & { ownerId: string }>();
  const repo: ProceduresRepo & { saves: SaveProcedure[]; details: typeof details } = {
    saves: [],
    details,
    async save(input) {
      repo.saves.push(input);
      const { draft, partIds, stepIds, procedureId } = input;
      details.set(procedureId, {
        ownerId: input.ownerId,
        procedure: {
          id: procedureId,
          assetModelKey: input.assetModelKey,
          sourceType: input.manualId ? "manual" : "generic",
          authorId: input.ownerId,
          status: "draft",
          version: 1,
          title: draft.title,
          manualId: input.manualId,
          createdAt: "2026-10-26T10:00:00.000Z",
        },
        parts: draft.parts.map((p) => ({
          id: partIds.get(p.ref)!,
          procedureId,
          ...(p.partNumber ? { partNumber: p.partNumber } : {}),
          name: p.name,
          qty: p.qty,
        })),
        steps: draft.steps.map((s, i) => ({
          id: stepIds[i]!,
          procedureId,
          order: s.order,
          surface: s.surface,
          title: s.title,
          instruction: s.instruction,
          ...(s.reason ? { reason: s.reason } : {}),
          ...(s.caution ? { caution: s.caution } : {}),
          partSpecIds: s.partRefs.map((r) => partIds.get(r)!),
          hazardTags: s.hazardTags,
          verification: s.verification,
          expectedState: s.expectedState,
          ...(s.measurement ? { measurement: s.measurement } : {}),
          citation:
            s.citation.kind === "manual" && input.manualId
              ? { kind: "manual" as const, manualId: input.manualId, page: s.citation.page }
              : { kind: "generic" as const },
        })),
      });
    },
    async getDetail(ownerId, id) {
      const d = details.get(id);
      if (!d || d.ownerId !== ownerId) return null;
      const { ownerId: _o, ...detail } = d;
      return detail;
    },
  };
  return repo;
}

export function memoryDetections() {
  const rows = new Map<string, Detection>();
  let n = 0;
  const repo: DetectionsRepo & { rows: typeof rows } = {
    rows,
    async insertMany(input) {
      return input.map((r) => {
        const d: Detection = {
          id: `00000000-0000-4000-8000-0000000d${String(++n).padStart(4, "0")}`,
          evidenceId: r.evidenceId,
          label: r.label,
          partSpecId: r.partSpecId,
          box: r.box,
          mask: r.mask,
          confidence: r.confidence,
          confirmedByUser: null,
        };
        rows.set(d.id, d);
        return d;
      });
    },
    async get(id) {
      return rows.get(id) ?? null;
    },
    async setVerdict(id, v) {
      const d: Detection = {
        ...rows.get(id)!,
        confirmedByUser: v.confirmedByUser,
        ...(v.correctedLabel ? { correctedLabel: v.correctedLabel } : {}),
        ...(v.partSpecId ? { partSpecId: v.partSpecId } : {}),
      };
      rows.set(id, d);
      return d;
    },
  };
  return repo;
}

/** Confirmations, checks and transitions in memory; `steps` holds each step's current row. */
export function memoryStepState(jobOf: (jobStepId: string) => string = () => "") {
  const confirmations: SafetyConfirmation[] = [];
  const checks: Array<{ jobStepId: string; result: CheckResult; at: string }> = [];
  const steps = new Map<string, JobStep>();
  let n = 0;
  const repo: StepStateRepo & {
    confirmationsList: typeof confirmations;
    checks: typeof checks;
    steps: typeof steps;
    transitions: StepTransition[];
  } = {
    confirmationsList: confirmations,
    checks,
    steps,
    transitions: [],
    async confirmations(jobId) {
      return confirmations.filter((x) => jobOf(x.jobStepId) === jobId);
    },
    async lastCheckSince(jobStepId, since) {
      const hits = checks.filter((x) => x.jobStepId === jobStepId && x.at >= since);
      return hits.at(-1)?.result ?? null;
    },
    async confirmGate(ownerId, jobStepId, gate, surface) {
      const existing = confirmations.find((x) => x.jobStepId === jobStepId && x.gate === gate);
      if (existing) return existing;
      const c: SafetyConfirmation = {
        id: `00000000-0000-4000-8000-0000000c${String(++n).padStart(4, "0")}`,
        jobStepId,
        gate,
        confirmedBy: ownerId,
        surface,
        confirmedAt: "2026-10-26T10:00:00.000Z",
      };
      confirmations.push(c);
      return c;
    },
    async recordCheck({ transition, evidenceId, result, reason, whatToShowNext }) {
      const step = await repo.applyTransition(transition);
      const at = new Date(Date.UTC(2026, 9, 26, 10, 0, checks.length + 1)).toISOString();
      checks.push({ jobStepId: transition.jobStepId, result, at });
      return {
        step,
        check: {
          id: `00000000-0000-4000-8000-0000000e${String(checks.length).padStart(4, "0")}`,
          jobStepId: transition.jobStepId,
          evidenceId,
          result,
          reason,
          ...(whatToShowNext ? { whatToShowNext } : {}),
          createdAt: at,
        },
      };
    },
    async applyTransition(t) {
      repo.transitions.push(t);
      const prev = steps.get(t.jobStepId)!;
      if (prev.status !== t.fromStatus) {
        throw new HttpError(409, "conflict", "This step changed on another device. Try again.");
      }
      const next: JobStep = {
        ...prev,
        status: t.to.status,
        startedAt: t.to.startedAt,
        statusEvidenceId: t.to.statusEvidenceId,
        ...(t.to.note ? { note: t.to.note } : {}),
        updatedBySurface: t.surface,
      };
      steps.set(t.jobStepId, next);
      return next;
    },
  };
  return repo;
}

/** Parts checks in memory; blocking is applied to the shared step store when given one. */
export function memoryPartsChecks(steps?: Map<string, JobStep>) {
  const checks: PartsCheck[] = [];
  let n = 0;
  const apply = (c: { block: Array<{ jobStepId: string; note: string }>; unblock: string[] }) => {
    if (!steps) return;
    for (const b of c.block) {
      steps.set(b.jobStepId, {
        ...steps.get(b.jobStepId)!,
        status: "blocked",
        blockedBy: "parts",
        note: b.note,
      });
    }
    for (const id of c.unblock) {
      const { blockedBy: _b, note: _n, ...rest } = steps.get(id)!;
      steps.set(id, { ...rest, status: "todo", startedAt: null, statusEvidenceId: null });
    }
  };
  const repo: PartsChecksRepo & { checks: PartsCheck[] } = {
    checks,
    async latest(jobId) {
      return [...checks].reverse().find((c) => c.jobId === jobId) ?? null;
    },
    async getForJob(jobId, id) {
      return checks.find((c) => c.id === id && c.jobId === jobId) ?? null;
    },
    async save(c) {
      const pc: PartsCheck = {
        id: `00000000-0000-4000-8000-0000000f${String(++n).padStart(4, "0")}`,
        jobId: c.jobId,
        evidenceIds: [c.evidenceId],
        results: c.results,
        createdAt: "2026-10-26T10:00:00.000Z",
      };
      checks.push(pc);
      apply(c);
      return pc;
    },
    async correct(c) {
      const i = checks.findIndex((x) => x.id === c.partsCheckId);
      checks[i] = { ...checks[i]!, results: c.results };
      apply(c);
      return checks[i]!;
    },
  };
  return repo;
}
