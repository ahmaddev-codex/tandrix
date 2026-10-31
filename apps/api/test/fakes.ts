// In-memory evidence repo and storage for unit tests.
import type { ShareLink } from "@tandrix/contracts";
import type { ReportsRepo, StepCheck } from "../src/repos/reports";
import type { NewPairing, PairingRow, PairingsRepo } from "../src/repos/pairings";
import type { ProfilesRepo } from "../src/repos/profiles";
import type { EarlyAccessRepo } from "../src/repos/early-access";
import { noModelScreenGuide } from "../src/screen-guide";
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
import type { ManualPage, ManualPagesRepo } from "../src/repos/manual-pages";
import type { PageRenderer } from "../src/pdf-render";
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
    async keysForJob(jobId) {
      return [...rows.values()]
        .filter((e) => e.jobId === jobId && e.uploadedAt && !e.deletedAt)
        .map((e) => e.storageKey);
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
      const up = uploads.get(id);
      if (!up || up.completedAt) return false;
      uploads.set(id, { ...up, completedAt: "2026-10-26T10:00:10.000Z" });
      return true;
    },
    async reopenUpload(id) {
      const up = uploads.get(id);
      if (up) uploads.set(id, { ...up, completedAt: null });
    },
    async recordAttached(jobId, manualId, how) {
      repo.events.push({ jobId, manualId, how });
    },
    async forJob(ownerId, jobId) {
      const last = repo.events.filter((e) => e.jobId === jobId).at(-1);
      return last ? repo.getForOwner(ownerId, last.manualId) : null;
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
  screenGuide: noModelScreenGuide,
  pairings: memoryPairings(),
  profiles: memoryProfiles(),
  earlyAccess: memoryEarlyAccess(),
  reports: memoryReports(),
  sessionMinter: { mint: async () => null },
  manualPages: memoryManualPages(),
  pageRenderer: fakeRenderer(),
});

export function memoryManualPages() {
  const rows = new Map<string, ManualPage>();
  const repo: ManualPagesRepo & { rows: typeof rows } = {
    rows,
    async get(manualId, page) {
      return rows.get(`${manualId}/${page}`) ?? null;
    },
    async save(p) {
      if (!rows.has(`${p.manualId}/${p.page}`)) rows.set(`${p.manualId}/${p.page}`, p);
    },
  };
  return repo;
}

/** Renders any page of any PDF as a tiny JPEG, counting renders; pages past `pages` don't exist. */
export function fakeRenderer(pages = 100) {
  const renderer: PageRenderer & { renders: number[] } = {
    renders: [],
    async render(_pdf, page) {
      renderer.renders.push(page);
      return page <= pages
        ? { jpeg: new Uint8Array([0xff, 0xd8, 0xff]), width: 800, height: 1131 }
        : null;
    },
  };
  return renderer;
}

/** Report data: checks are recorded by tests; share links keep only token hashes, as in the database. */
export function memoryReports(owners = new Map<string, string>()) {
  const checks: StepCheck[] = [];
  const links: Array<ShareLink & { jobId: string; tokenHash: string }> = [];
  const repo: ReportsRepo & { checks: typeof checks; links: typeof links; owners: typeof owners } =
    {
      checks,
      links,
      owners,
      async latestChecks(jobId) {
        const latest = new Map<string, StepCheck>();
        for (const c of [...checks].sort((a, b) => b.createdAt.localeCompare(a.createdAt)))
          if (!latest.has(c.jobStepId) && owners.has(jobId)) latest.set(c.jobStepId, c);
        return [...latest.values()];
      },
      async createShare(jobId, tokenHash, expiresAt) {
        const link = {
          id: crypto.randomUUID(),
          createdAt: new Date().toISOString(),
          expiresAt,
          revokedAt: null,
          jobId,
          tokenHash,
        };
        links.push(link);
        const { jobId: _j, tokenHash: _t, ...pub } = link;
        return pub;
      },
      async listShares(jobId) {
        return links
          .filter((l) => l.jobId === jobId)
          .map(({ jobId: _j, tokenHash: _t, ...pub }) => pub);
      },
      async revokeShare(jobId, linkId, now) {
        const l = links.find((x) => x.id === linkId && x.jobId === jobId && !x.revokedAt);
        if (!l) return false;
        l.revokedAt = now;
        return true;
      },
      async findShare(tokenHash, now) {
        const l = links.find((x) => x.tokenHash === tokenHash && !x.revokedAt && x.expiresAt > now);
        const ownerId = l ? owners.get(l.jobId) : undefined;
        return l && ownerId ? { jobId: l.jobId, ownerId } : null;
      },
    };
  return repo;
}

/** Pairings with the same guarded updates as the database. */
export function memoryProfiles() {
  const rows = new Map<string, string | null>();
  const repo: ProfilesRepo & { rows: typeof rows } = {
    rows,
    async get(userId) {
      return { displayName: rows.get(userId) ?? null };
    },
    async set(userId, displayName) {
      rows.set(userId, displayName);
    },
  };
  return repo;
}

export function memoryPairings() {
  type P = NewPairing & {
    id: string;
    userId: string | null;
    approvedAt: string | null;
    consumedAt: string | null;
  };
  const rows = new Map<string, P>();
  const view = (p: P): PairingRow => ({
    id: p.id,
    deviceName: p.deviceName,
    expiresAt: p.expiresAt,
    approved: p.approvedAt !== null,
    consumed: p.consumedAt !== null,
  });
  const open = (codeHash: string, now: string) =>
    [...rows.values()].find(
      (p) => p.codeHash === codeHash && p.approvedAt === null && p.expiresAt > now,
    );
  const repo: PairingsRepo & { rows: typeof rows } = {
    rows,
    async create(p) {
      if ([...rows.values()].some((r) => r.codeHash === p.codeHash)) return null;
      const id = crypto.randomUUID();
      rows.set(id, { ...p, id, userId: null, approvedAt: null, consumedAt: null });
      return { id };
    },
    async findOpen(codeHash, now) {
      const p = open(codeHash, now);
      return p ? view(p) : null;
    },
    async approve(codeHash, userId, now) {
      const p = open(codeHash, now);
      if (!p) return null;
      p.userId = userId;
      p.approvedAt = now;
      return view(p);
    },
    async get(id, pollHash) {
      const p = rows.get(id);
      return p && p.pollHash === pollHash ? view(p) : null;
    },
    async consume(id, pollHash, now) {
      const p = rows.get(id);
      if (!p || p.pollHash !== pollHash || !p.approvedAt || p.consumedAt || p.expiresAt <= now)
        return null;
      p.consumedAt = now;
      return p.userId;
    },
  };
  return repo;
}

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
          sourceType: input.fromRecording
            ? "expert_recording"
            : input.manualId
              ? "manual"
              : "generic",
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
              ? {
                  kind: "manual" as const,
                  manualId: input.manualId,
                  page: s.citation.page,
                  ...(s.citation.figure ? { figure: s.citation.figure } : {}),
                }
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
    references: Map<string, string>;
  } = {
    confirmationsList: confirmations,
    checks,
    steps,
    transitions: [],
    references: new Map(),
    async reference(jobStepId) {
      return repo.references.get(jobStepId) ?? null;
    },
    async setReference(jobStepId, evidenceId) {
      if (evidenceId) repo.references.set(jobStepId, evidenceId);
      else repo.references.delete(jobStepId);
    },
    async confirmations(jobId) {
      return confirmations.filter((x) => jobOf(x.jobStepId) === jobId);
    },
    async confirmationsForStep(jobStepId) {
      return confirmations.filter((x) => x.jobStepId === jobStepId);
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

export function memoryEarlyAccess() {
  const rows = new Map<string, { platform: "mac" | "iphone" | null; at: string }>();
  const repo: EarlyAccessRepo & { rows: typeof rows } = {
    rows,
    async add(email, platform, now) {
      if (!rows.has(email)) rows.set(email, { platform, at: now });
    },
  };
  return repo;
}
