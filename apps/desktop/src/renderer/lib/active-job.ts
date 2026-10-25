import type { Job } from "@tandrix/contracts";

/** The job the Mac follows: the most recently updated one still in progress. */
export function activeJob(jobs: readonly Job[]): Job | undefined {
  return jobs
    .filter((j) => j.status === "active")
    .reduce<Job | undefined>(
      (best, j) => (!best || j.updatedAt > best.updatedAt ? j : best),
      undefined,
    );
}
