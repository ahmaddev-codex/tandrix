// What a step shows besides its words: the user's reference photo, the manual page it cites (rendered
// once, then reused) and the latest photo taken for it. The same reference guides the photo check.
import type { Evidence, ProcedureStep, StepVisual, StepVisualsResponse } from "@tandrix/contracts";
import type { PageRenderer } from "./pdf-render";
import type { EvidenceRepo, EvidenceStorage } from "./repos/evidence";
import type { ManualPage, ManualPagesRepo } from "./repos/manual-pages";
import type { ManualsRepo } from "./repos/manuals";
import type { StepStateRepo } from "./repos/step-state";

export interface VisualDeps {
  evidence: EvidenceRepo;
  storage: EvidenceStorage;
  manuals: ManualsRepo;
  manualStorage: EvidenceStorage;
  manualPages: ManualPagesRepo;
  renderer: PageRenderer;
  stepState: StepStateRepo;
  log: (l: Record<string, unknown>) => void;
}

export interface StepRef {
  ownerId: string;
  jobId: string;
  jobStepId: string;
  step: Pick<ProcedureStep, "citation">;
}

/** Long enough to look at a step; the apps reload visuals when the step reloads. */
export const VISUAL_URL_TTL_SEC = 900;

const pictureKinds = new Set<Evidence["kind"]>(["photo", "screenshot"]);
const isPicture = (e: Evidence): e is Evidence & { kind: "photo" | "screenshot" } =>
  !!e.uploadedAt && pictureKinds.has(e.kind);

/** Evidence the user can pin as a step's reference: an uploaded photo or screenshot. */
export const canBeReference = isPicture;

const size = (e: Evidence) => ({
  ...(e.width ? { width: e.width } : {}),
  ...(e.height ? { height: e.height } : {}),
});

/** The page as an image, rendered and stored the first time it's needed. Null if it can't be. */
export async function manualPageImage(
  d: VisualDeps,
  ownerId: string,
  manualId: string,
  page: number,
): Promise<ManualPage | null> {
  const manual = await d.manuals.getForOwner(ownerId, manualId);
  if (!manual || page > manual.pageCount) return null;
  const cached = await d.manualPages.get(manual.id, page);
  if (cached) return cached;
  const rendered = await d.renderer.render(await d.manualStorage.download(manual.storageKey), page);
  if (!rendered) return null;
  const stored: ManualPage = {
    manualId: manual.id,
    page,
    storageKey: `pages/${manual.id}/${page}.jpg`,
    width: rendered.width,
    height: rendered.height,
  };
  try {
    await d.manualStorage.put(stored.storageKey, rendered.jpeg, "image/jpeg");
  } catch (e) {
    // Another request rendered the same page first; its image is the same.
    if (!(await d.manualStorage.stat(stored.storageKey))) throw e;
  }
  await d.manualPages.save(stored);
  return stored;
}

/** The cited page, or null; a page that fails to render is logged and left out, never fatal. */
async function citedPage(d: VisualDeps, ref: StepRef): Promise<ManualPage | null> {
  const c = ref.step.citation;
  if (c.kind !== "manual") return null;
  try {
    return await manualPageImage(d, ref.ownerId, c.manualId, c.page);
  } catch (e) {
    d.log({
      level: "warn",
      event: "manual_page_render_failed",
      manualId: c.manualId,
      page: c.page,
      error: (e as Error).message,
    });
    return null;
  }
}

async function referenceEvidence(d: VisualDeps, ref: StepRef) {
  const id = await d.stepState.reference(ref.jobStepId);
  const ev = id ? await d.evidence.getForOwner(ref.ownerId, ref.jobId, id) : null;
  return ev && isPicture(ev) ? ev : null;
}

export async function stepVisuals(
  d: VisualDeps,
  ref: StepRef,
  nowMs: number,
): Promise<StepVisualsResponse> {
  const [reference, page, uploaded] = await Promise.all([
    referenceEvidence(d, ref),
    citedPage(d, ref),
    d.evidence.listUploaded(ref.jobId),
  ]);
  const latest = uploaded
    .filter((e) => e.jobStepId === ref.jobStepId && isPicture(e) && e.id !== reference?.id)
    .sort((a, b) => b.capturedAt.localeCompare(a.capturedAt))[0] as
    (Evidence & { kind: "photo" | "screenshot" }) | undefined;

  const evidenceUrls = await d.storage.signedReadUrls(
    [reference, latest].filter((e) => !!e).map((e) => e.storageKey),
    VISUAL_URL_TTL_SEC,
  );
  const pageUrl = page
    ? (await d.manualStorage.signedReadUrls([page.storageKey], VISUAL_URL_TTL_SEC)).get(
        page.storageKey,
      )
    : undefined;

  const visuals: StepVisual[] = [];
  const refUrl = reference && evidenceUrls.get(reference.storageKey);
  if (reference && refUrl)
    visuals.push({
      kind: "reference",
      evidenceId: reference.id,
      evidenceKind: reference.kind,
      url: refUrl,
      ...size(reference),
      capturedAt: reference.capturedAt,
    });
  const c = ref.step.citation;
  if (page && pageUrl && c.kind === "manual")
    visuals.push({
      kind: "manual_page",
      manualId: page.manualId,
      page: page.page,
      ...(c.figure ? { figure: c.figure } : {}),
      url: pageUrl,
      width: page.width,
      height: page.height,
    });
  const latestUrl = latest && evidenceUrls.get(latest.storageKey);
  if (latest && latestUrl)
    visuals.push({
      kind: "latest",
      evidenceId: latest.id,
      evidenceKind: latest.kind,
      url: latestUrl,
      ...size(latest),
      capturedAt: latest.capturedAt,
    });
  return {
    visuals,
    urlExpiresAt: new Date(nowMs + VISUAL_URL_TTL_SEC * 1000).toISOString(),
  };
}

export interface CheckReference {
  bytes: Uint8Array;
  mimeType: string;
  /** What the image is, told to the model next to it. */
  kind: "reference" | "manual_page";
}

/** What the check compares against: the user's reference photo, else the cited manual page. */
export async function checkReference(d: VisualDeps, ref: StepRef): Promise<CheckReference | null> {
  const reference = await referenceEvidence(d, ref);
  if (reference)
    return {
      bytes: await d.storage.download(reference.storageKey),
      mimeType: reference.mimeType,
      kind: "reference",
    };
  const page = await citedPage(d, ref);
  if (!page) return null;
  return {
    bytes: await d.manualStorage.download(page.storageKey),
    mimeType: "image/jpeg",
    kind: "manual_page",
  };
}
