import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { fileSpendMeter, readLedger } from "../src/spend";

const entry = (usd: number) => ({
  model: "muse-spark-1.3",
  usd,
  inputTokens: 100,
  outputTokens: 10,
});

describe("fileSpendMeter", () => {
  it("adds up spend in a file that survives a restart, and stops at the cap", () => {
    const path = join(mkdtempSync(join(tmpdir(), "spend-")), "ledger.json");
    const logs: Array<Record<string, unknown>> = [];
    const meter = fileSpendMeter(path, 0.05, (l) => logs.push(l));
    meter.allow("muse-spark-1.3");
    meter.record(entry(0.03));
    // A new process picks up where the last left off.
    const again = fileSpendMeter(path, 0.05, (l) => logs.push(l));
    again.allow("muse-spark-1.3");
    again.record(entry(0.03));
    expect(readLedger(path)).toMatchObject({
      calls: 2,
      byModel: { "muse-spark-1.3": { calls: 2 } },
    });
    expect(readLedger(path).totalUsd).toBeCloseTo(0.06);
    expect(() => again.allow("muse-spark-1.3")).toThrow(/spend cap of \$0.05 reached/);
    expect(logs.some((l) => l.event === "spend_cap_reached")).toBe(true);
  });
});
