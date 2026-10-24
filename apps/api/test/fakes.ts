// In-memory evidence repo and storage for unit tests.
import type { Asset, Evidence, IdentifyAssetResponse, Manual } from "@tandrix/contracts";
import { noModelFinder } from "../src/manual-finder";
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
});
