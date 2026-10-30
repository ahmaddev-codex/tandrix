import type { Job, JobDetailResponse } from "@tandrix/contracts";
import { beforeEach, describe, expect, it, vi } from "vitest";

const listAllJobs = vi.fn<() => Promise<Job[]>>();
const getJob = vi.fn<(id: string) => Promise<JobDetailResponse>>();
const writes = new Set<(jobId: string | undefined) => void>();
vi.mock("./api", () => ({ api: { listAllJobs, getJob }, writes }));
vi.mock("./supabase", () => ({ supabase: {} }));
vi.mock("expo-router", () => ({ useFocusEffect: () => {} }));

const { refreshJobs, resetJobs } = await import("./jobs-store");

const job = (id: string, updatedAt = "2026-10-30T09:00:00.000Z") =>
  ({ id, status: "active", activeSurface: "phone", updatedAt, currentStepId: null }) as Job;
const detail = (j: Job) =>
  ({
    job: j,
    asset: null,
    manual: null,
    procedure: null,
    steps: [],
  }) as unknown as JobDetailResponse;
const wrote = (jobId?: string) => writes.forEach((w) => w(jobId));

describe("jobs store", () => {
  let jobs: Job[];
  beforeEach(() => {
    resetJobs();
    listAllJobs.mockReset();
    getJob.mockReset();
    jobs = [job("a"), job("b"), job("c")];
    listAllJobs.mockImplementation(async () => jobs);
    getJob.mockImplementation(async (id) => detail(jobs.find((j) => j.id === id)!));
  });

  it("fetches once, then serves switching tabs from what it holds", async () => {
    await refreshJobs();
    await refreshJobs();
    await refreshJobs();
    expect(listAllJobs).toHaveBeenCalledTimes(1);
    expect(getJob).toHaveBeenCalledTimes(3);
  });

  it("after a change to one project, fetches the list and only that project again", async () => {
    await refreshJobs();
    wrote("b");
    await refreshJobs();
    expect(listAllJobs).toHaveBeenCalledTimes(2);
    expect(getJob).toHaveBeenCalledTimes(4);
    expect(getJob).toHaveBeenLastCalledWith("b");
  });

  it("pull to refresh fetches the list but not unchanged projects", async () => {
    await refreshJobs();
    jobs = [job("a"), job("b", "2026-10-30T10:00:00.000Z"), job("c")];
    await refreshJobs(true);
    expect(listAllJobs).toHaveBeenCalledTimes(2);
    expect(getJob).toHaveBeenCalledTimes(4);
    expect(getJob).toHaveBeenLastCalledWith("b");
  });

  it("shares one fetch between screens that open together", async () => {
    await Promise.all([refreshJobs(), refreshJobs(), refreshJobs()]);
    expect(listAllJobs).toHaveBeenCalledTimes(1);
  });

  it("tries again after a failed fetch", async () => {
    listAllJobs.mockRejectedValueOnce(new Error("Can't reach Tandrix."));
    await refreshJobs();
    await refreshJobs();
    expect(listAllJobs).toHaveBeenCalledTimes(2);
  });
});
