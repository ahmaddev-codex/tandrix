// Reply and task timings on the Mac (@tandrix/core timing), logged by the main process as numbers
// only: never the words, the audio or the screen.
import { replyClock, type ReplyStage, type ReplyTiming, type TaskTiming } from "@tandrix/core";

export { stopwatch, taskMeter, type ReplyTiming, type Stopwatch } from "@tandrix/core";

const send = (t: ReplyTiming | TaskTiming) =>
  void window.tandrix.diagnostics.timing(t).catch(() => undefined);

const clock = replyClock(send);

export function startReply(kind: ReplyTiming["kind"], report?: (t: ReplyTiming) => void) {
  clock.start(kind, report);
}
export const markReply = (stage: ReplyStage) => clock.mark(stage);
export const endReply = () => clock.end();
export const takeReply = () => clock.take();
/** A finished Do it for me task's timing, to the log. */
export const reportTask = (t: TaskTiming) => send(t);
