import type { JobDetailResponse, JobStep, ProcedureStep } from "@tandrix/contracts";
import { describe, expect, it } from "vitest";
import { desktopStep } from "../src/renderer/lib/desktop-step";

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

const step = (n: number, surface: ProcedureStep["surface"]) =>
  ({ id: id(100 + n), order: n, surface, title: `Step ${n}` }) as ProcedureStep;
const jobStep = (n: number, status: JobStep["status"]) =>
  ({ id: id(200 + n), procedureStepId: id(100 + n), status }) as JobStep;

function detail(
  surfaces: ProcedureStep["surface"][],
  statuses: JobStep["status"][],
  current?: number,
): JobDetailResponse {
  return {
    job: { currentStepId: current ? id(200 + current) : null },
    procedure: { steps: surfaces.map((s, i) => step(i + 1, s)) },
    steps: statuses.map((s, i) => jobStep(i + 1, s)),
  } as unknown as JobDetailResponse;
}

describe("desktopStep", () => {
  it("picks the first unfinished step done in software", () => {
    const d = detail(["physical", "desktop", "desktop"], ["in_progress", "verified", "todo"]);
    expect(desktopStep(d)?.step.order).toBe(3);
    expect(desktopStep(d)?.total).toBe(3);
  });

  it("prefers the job's current step when it's on the desktop", () => {
    const d = detail(["desktop", "desktop"], ["todo", "needs_attention"], 2);
    expect(desktopStep(d)?.step.order).toBe(2);
  });

  it("ignores a current step that's physical", () => {
    const d = detail(["physical", "desktop"], ["in_progress", "todo"], 1);
    expect(desktopStep(d)?.step.order).toBe(2);
  });

  it("has nothing when the desktop steps are done or there are none", () => {
    expect(desktopStep(detail(["desktop"], ["user_confirmed"]))).toBeUndefined();
    expect(desktopStep(detail(["physical"], ["todo"]))).toBeUndefined();
    expect(
      desktopStep({ ...detail([], []), procedure: null } as JobDetailResponse),
    ).toBeUndefined();
  });
});
