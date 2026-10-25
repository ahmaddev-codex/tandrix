import { describe, expect, it, vi } from "vitest";

vi.mock("../src/renderer/lib/supabase", () => ({ supabase: {} }));
const { handoffToMac } = await import("../src/renderer/lib/realtime");

const JOB = "00000000-0000-4000-8000-000000000001";
const STEP = "00000000-0000-4000-8000-0000000000e5";

describe("handoffToMac", () => {
  it("reads a job sent to the Mac, with its step and sender", () => {
    expect(
      handoffToMac({
        type: "handoff",
        job_id: JOB,
        surface: "phone",
        payload: { from: "phone", to: "desktop", job_step_id: STEP },
      }),
    ).toEqual({ jobId: JOB, jobStepId: STEP, from: "phone" });
  });

  it("ignores handoffs to other devices and other events", () => {
    expect(
      handoffToMac({ type: "handoff", job_id: JOB, surface: "desktop", payload: { to: "phone" } }),
    ).toBeNull();
    expect(
      handoffToMac({ type: "step_status_changed", job_id: JOB, payload: { to: "desktop" } }),
    ).toBeNull();
  });

  it("works without a step and treats an unknown sender as the phone", () => {
    expect(
      handoffToMac({
        type: "handoff",
        job_id: JOB,
        surface: "toaster",
        payload: { to: "desktop" },
      }),
    ).toEqual({ jobId: JOB, from: "phone" });
  });
});
