// Reply and task timings from the panel, written to the log through @tandrix/core timingLine, which
// lets only kinds and whole milliseconds through: nothing the user said or saw.
import { timingLine } from "@tandrix/core";

export { timingLine };

export function logTiming(raw: unknown) {
  const line = timingLine(raw);
  if (line) console.log(JSON.stringify(line));
}
