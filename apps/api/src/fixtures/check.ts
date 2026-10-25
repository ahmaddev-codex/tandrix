// Local development only (TANDRIX_FIXTURE_MODELS=1, refused in production): a step's first check
// fails with a specific reason and the next one passes, so both outcomes can be seen and tested.
import type { StepChecker } from "../step-checker";

const seen = new Set<string>();

export const fixtureChecker: StepChecker = {
  async check({ jobStepId, medium, expectedState }) {
    if (!seen.has(jobStepId)) {
      seen.add(jobStepId);
      return medium === "screen"
        ? {
            status: "judged",
            result: "fail",
            reason:
              "The setting still shows the old value and hasn't been saved. Change it, save, and check again.",
          }
        : {
            status: "judged",
            result: "fail",
            reason:
              "The part isn't seated yet: there's a gap at the shoulder. Push it fully home and check again.",
            whatToShowNext: "Show the joint from the side, close up.",
          };
    }
    return { status: "judged", result: "pass", reason: `Matches the step. ${expectedState}` };
  },
};
