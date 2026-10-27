// Setting up a project in one pass from what the user gave at the start: create it, upload the
// photos, read the label, get the manual, write the steps (fitted to where the work stands) and
// check the parts. Each stage keeps what it did in the state, so "Try again" carries on from the
// stage that stopped rather than starting over.
import {
  NAMEPLATE_CONFIDENT,
  type GenerateProcedureResponse,
  type IdentifyAssetResponse,
  type Manual,
  type ManualSearchResponse,
  type PartsCheckResponse,
} from "@tandrix/contracts";

export interface IntakePhoto {
  uri: string;
  width: number;
  height: number;
  byteSize: number;
  capturedAt: string;
}

export interface IntakePdf {
  uri: string;
  name: string;
  byteSize: number;
}

/** Everything the intake screen collected. Only the goal is required. */
export interface Intake {
  goal: string;
  /** The nameplate, label or box: says what the equipment is. */
  label?: IntakePhoto;
  /** The parts laid out: checked against the parts list once the steps are written. */
  parts?: IntakePhoto;
  /** Where the work stands now, up to four: the steps start from there. */
  now: IntakePhoto[];
  manualPdf?: IntakePdf;
  /** Photographed manual pages, in page order. */
  manualPages: IntakePhoto[];
  notes?: string;
}

export interface SetupDeps {
  createJob(goal: string): Promise<{ id: string }>;
  uploadPhoto(jobId: string, photo: IntakePhoto): Promise<{ id: string }>;
  identify(jobId: string, evidenceId: string): Promise<IdentifyAssetResponse>;
  saveAsset(
    jobId: string,
    asset: {
      make: string;
      model: string;
      serial?: string;
      nameplateEvidenceId: string;
      source: "model";
      confidence: number;
    },
  ): Promise<unknown>;
  uploadManual(jobId: string, pdf: IntakePdf): Promise<Manual>;
  manualFromPhotos(jobId: string, body: { evidenceIds: string[]; title: string }): Promise<Manual>;
  searchManual(jobId: string): Promise<ManualSearchResponse>;
  fetchManual(jobId: string, body: { url: string; title: string; token: string }): Promise<Manual>;
  generate(
    jobId: string,
    body: { allowGeneric: true; contextEvidenceIds: string[]; notes?: string },
  ): Promise<GenerateProcedureResponse>;
  partsCheck(jobId: string, evidenceId: string): Promise<PartsCheckResponse>;
}

export type StageId = "start" | "photos" | "label" | "manual" | "steps" | "parts";
export type StageStatus = "waiting" | "working" | "done" | "attention" | "failed";

export interface Stage {
  id: StageId;
  title: string;
  status: StageStatus;
  /** What came of it, or what to do about it. */
  note?: string;
}

/** What has been done so far; kept between attempts. */
export interface SetupState {
  jobId?: string;
  /** Uploaded evidence ids, by photo uri. */
  uploaded: Record<string, string>;
  labelRead?: boolean;
  manualDone?: boolean;
  stepsDone?: boolean;
  partsDone?: boolean;
  stages: Stage[];
}

/** A stage the project can't go on without stopped; the rest is kept for "Try again". */
export class SetupStopped extends Error {
  constructor(
    readonly stage: StageId,
    message: string,
  ) {
    super(message);
  }
}

const titles: Record<StageId, string> = {
  start: "Start the project",
  photos: "Upload your photos",
  label: "Read the label",
  manual: "Get the manual",
  steps: "Write the steps",
  parts: "Check the parts",
};

/** The stages this intake needs, in order, all waiting. */
export function plannedStages(intake: Intake): Stage[] {
  const photos = photosOf(intake).length > 0;
  const manual = !!intake.manualPdf || intake.manualPages.length > 0 || !!intake.label;
  const ids: StageId[] = [
    "start",
    ...(photos ? (["photos"] as const) : []),
    ...(intake.label ? (["label"] as const) : []),
    ...(manual ? (["manual"] as const) : []),
    "steps",
    ...(intake.parts ? (["parts"] as const) : []),
  ];
  return ids.map((id) => ({ id, title: titles[id], status: "waiting" }));
}

export function newSetupState(intake: Intake): SetupState {
  return { uploaded: {}, stages: plannedStages(intake) };
}

const photosOf = (i: Intake) =>
  [i.label, i.parts, ...i.now, ...i.manualPages].filter((p): p is IntakePhoto => !!p);

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/**
 * Runs (or resumes) the setup. `emit` gets a copy of the state after every change. Resolves with
 * the job id; throws SetupStopped when a stage the project needs fails.
 */
export async function runSetup(
  intake: Intake,
  state: SetupState,
  deps: SetupDeps,
  emit: (s: SetupState) => void,
): Promise<string> {
  const set = (id: StageId, status: StageStatus, note?: string) => {
    state.stages = state.stages.map((s) =>
      s.id === id ? { id, title: s.title, status, ...(note ? { note } : {}) } : s,
    );
    emit({ ...state, stages: state.stages });
  };
  const stop = (id: StageId, message: string): never => {
    set(id, "failed", message);
    throw new SetupStopped(id, message);
  };
  const has = (id: StageId) => state.stages.some((s) => s.id === id);
  const reason = (e: unknown) => (e instanceof Error ? e.message : String(e));

  // 1. The project itself.
  if (!state.jobId) {
    set("start", "working");
    try {
      state.jobId = (await deps.createJob(intake.goal.trim())).id;
    } catch (e) {
      stop("start", reason(e));
    }
  }
  set("start", "done");
  const jobId = state.jobId!;

  // 2. Every photo, once.
  if (has("photos")) {
    set("photos", "working");
    try {
      for (const p of photosOf(intake))
        if (!state.uploaded[p.uri]) state.uploaded[p.uri] = (await deps.uploadPhoto(jobId, p)).id;
    } catch (e) {
      stop("photos", reason(e));
    }
    set("photos", "done", plural(photosOf(intake).length, "photo"));
  }
  const idOf = (p: IntakePhoto) => state.uploaded[p.uri]!;

  // 3. The label: saved when the reading is confident; otherwise the user confirms it later.
  if (intake.label && !state.labelRead) {
    set("label", "working");
    let r: IdentifyAssetResponse;
    try {
      r = await deps.identify(jobId, idOf(intake.label));
    } catch (e) {
      r = { status: "unavailable", reason: "model_unavailable", message: reason(e) };
    }
    const reading = r.status === "read" ? r.reading : undefined;
    if (reading?.make && reading.model && reading.confidence >= NAMEPLATE_CONFIDENT) {
      try {
        await deps.saveAsset(jobId, {
          make: reading.make,
          model: reading.model,
          ...(reading.serial ? { serial: reading.serial } : {}),
          nameplateEvidenceId: idOf(intake.label),
          source: "model",
          confidence: reading.confidence,
        });
        set("label", "done", `${reading.make} ${reading.model}`);
      } catch (e) {
        set("label", "attention", reason(e));
      }
    } else {
      set(
        "label",
        "attention",
        reading
          ? "Not sure what it says. Confirm the equipment on the project."
          : "Couldn't read it. Confirm the equipment on the project.",
      );
    }
    state.labelRead = true;
  }

  // 4. The manual: what the user gave, else a search for the equipment.
  if (has("manual") && !state.manualDone) {
    set("manual", "working");
    const title = intake.manualPdf?.name
      .replace(/\.pdf$/i, "")
      .replace(/_+/g, " ")
      .trim();
    try {
      if (intake.manualPdf) {
        const m = await deps.uploadManual(jobId, intake.manualPdf);
        set("manual", "done", `${m.title}, ${plural(m.pageCount, "page")}`);
      } else if (intake.manualPages.length) {
        const m = await deps.manualFromPhotos(jobId, {
          evidenceIds: intake.manualPages.map(idOf),
          title: title || `${intake.goal.trim().slice(0, 180)} manual`,
        });
        set("manual", "done", `Your ${plural(m.pageCount, "page")}`);
      } else {
        set("manual", "working", "Searching the manufacturer's site");
        set("manual", ...(await findManual(deps, jobId)));
      }
    } catch (e) {
      set("manual", "attention", `${reason(e)} The steps will be general.`);
    }
    state.manualDone = true;
  }

  // 5. The steps, from the manual if there is one, fitted to the photos and notes.
  if (!state.stepsDone) {
    set("steps", "working", "Reading everything you added");
    let r: GenerateProcedureResponse;
    try {
      r = await deps.generate(jobId, {
        allowGeneric: true,
        contextEvidenceIds: intake.now.map(idOf),
        ...(intake.notes?.trim() ? { notes: intake.notes.trim() } : {}),
      });
    } catch (e) {
      return stop("steps", reason(e));
    }
    if (r.status !== "created") return stop("steps", r.message);
    const n = r.detail.steps.length;
    set(
      "steps",
      "done",
      r.citedSteps ? `${plural(n, "step")}, ${r.citedSteps} from the manual` : plural(n, "step"),
    );
    state.stepsDone = true;
  }

  // 6. The parts, against the list the steps need.
  if (intake.parts && !state.partsDone) {
    set("parts", "working");
    try {
      const r = await deps.partsCheck(jobId, idOf(intake.parts));
      if (r.status === "checked") {
        const missing = r.partsCheck.results.filter((i) => i.status === "missing").length;
        set(
          "parts",
          missing ? "attention" : "done",
          missing
            ? `${plural(missing, "part")} not found. Check the list on the project.`
            : `All ${r.partsCheck.results.length} found`,
        );
      } else if (r.status === "no_parts") {
        set("parts", "done", "These steps need no parts list");
      } else {
        set("parts", "attention", r.message);
      }
    } catch (e) {
      set("parts", "attention", reason(e));
    }
    state.partsDone = true;
  }
  return jobId;
}

/** Search for the equipment's manual and attach the first result that downloads as a PDF. */
async function findManual(deps: SetupDeps, jobId: string): Promise<[StageStatus, string]> {
  const general = "The steps will be general, not from the manufacturer.";
  const r = await deps.searchManual(jobId);
  if (r.status === "cached") return ["done", r.manual.title];
  if (r.status === "unavailable") return ["attention", `${r.message} ${general}`];
  for (const c of r.candidates) {
    try {
      const m = await deps.fetchManual(jobId, { url: c.url, title: c.title, token: c.token });
      return ["done", `${m.title}, ${plural(m.pageCount, "page")}`];
    } catch {
      // Not a PDF, or it wouldn't download: try the next one.
    }
  }
  return ["attention", `No manual could be downloaded. ${general}`];
}
