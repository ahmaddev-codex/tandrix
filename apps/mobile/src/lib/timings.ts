// Reply timings on the phone (@tandrix/core timing): from letting go of the mic to the first sound
// of the answer, written to the device log as numbers only, never the words, audio or picture.
import { replyClock, timingLine } from "@tandrix/core";

const clock = replyClock((t) => {
  const line = timingLine(t);
  if (line) console.log(JSON.stringify(line));
});

export const startReply = clock.start;
export const markReply = clock.mark;
export const endReply = clock.end;
export const takeReply = clock.take;
