// Local development only (TANDRIX_FIXTURE_MODELS=1, refused in production): every recording is
// heard as the same question and answered from the step, so push-to-talk can be tested on the
// simulator, whose microphone hears nothing useful.
import type { StepAnswerer, Transcriber } from "../voice";

export const FIXTURE_HEARD = "Which way round does this go?";

export const fixtureVoice: Transcriber & StepAnswerer = {
  async transcribe(wav) {
    return { status: "heard", transcript: FIXTURE_HEARD, durationMs: Math.round(wav.length / 32) };
  },
  async answer(q) {
    return {
      status: "answer",
      answer: `${q.step.instruction} ${q.step.reason ?? "Check it against the step before you move on."}`,
      fromStep: true,
    };
  },
};
