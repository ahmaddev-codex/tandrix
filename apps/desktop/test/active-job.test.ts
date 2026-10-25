import type { Job } from "@tandrix/contracts";
import { describe, expect, it } from "vitest";
import { activeJob } from "../src/renderer/lib/active-job";

const job = (id: string, status: Job["status"], updatedAt: string): Job => ({
  id,
  ownerId: "00000000-0000-4000-8000-000000000001",
  assetId: null,
  procedureId: null,
  title: id,
  status,
  currentStepId: null,
  activeSurface: "phone",
  controlMode: "show",
  language: "en",
  createdAt: "2026-10-25T08:00:00.000Z",
  updatedAt,
});

describe("activeJob", () => {
  it("follows the most recently updated job in progress", () => {
    const jobs = [
      job("older", "active", "2026-10-25T09:00:00.000Z"),
      job("newer", "active", "2026-10-25T10:00:00.000Z"),
      job("finished later", "completed", "2026-10-25T11:00:00.000Z"),
    ];
    expect(activeJob(jobs)?.id).toBe("newer");
  });

  it("has nothing to follow when every job is finished or stopped", () => {
    expect(
      activeJob([
        job("a", "completed", "2026-10-25T09:00:00.000Z"),
        job("b", "stopped", "2026-10-25T10:00:00.000Z"),
      ]),
    ).toBeUndefined();
    expect(activeJob([])).toBeUndefined();
  });
});
