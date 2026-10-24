// In-memory evidence repo and storage for unit tests.
import type { Evidence } from "@tandrix/contracts";
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
  };
  return storage;
}
