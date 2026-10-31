// A running total of what Meta model calls cost, kept in a local file so it survives restarts,
// with a cap: once reached, calls fail like any model error and the apps fall back gracefully.
// For local testing against a fixed credit; production uses the provider's own billing alerts.
import { existsSync, readFileSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { MetaApiError, type SpendEntry, type SpendMeter } from "@tandrix/ai";

export interface Ledger {
  totalUsd: number;
  calls: number;
  byModel: Record<string, { usd: number; calls: number }>;
  since: string;
}

export function readLedger(path: string): Ledger {
  if (!existsSync(path))
    return { totalUsd: 0, calls: 0, byModel: {}, since: new Date().toISOString() };
  return JSON.parse(readFileSync(path, "utf8")) as Ledger;
}

export function fileSpendMeter(
  path: string,
  limitUsd: number,
  log: (l: Record<string, unknown>) => void,
): SpendMeter & { flush(): Promise<void> } {
  const ledger = readLedger(path);
  // Writes run in order, off the event loop. A crash may lose the tail; for a local testing
  // ledger that beats blocking every model call on disk.
  let tail = Promise.resolve();
  return {
    allow(model) {
      if (ledger.totalUsd >= limitUsd) {
        log({
          level: "warn",
          event: "spend_cap_reached",
          model,
          totalUsd: ledger.totalUsd,
          limitUsd,
        });
        throw new MetaApiError(
          `Local spend cap of $${limitUsd} reached ($${ledger.totalUsd.toFixed(4)} spent). Raise META_SPEND_LIMIT_USD to continue.`,
          402,
          "spend_cap",
          "spend_cap",
          false,
        );
      }
    },
    record(e: SpendEntry) {
      ledger.totalUsd += e.usd;
      ledger.calls += 1;
      const m = (ledger.byModel[e.model] ??= { usd: 0, calls: 0 });
      m.usd += e.usd;
      m.calls += 1;
      const snapshot = JSON.stringify(ledger, null, 2);
      tail = tail
        .then(() => writeFile(path, snapshot))
        .catch((err: Error) =>
          log({ level: "warn", event: "spend_ledger_write_failed", error: err.message }),
        );
      log({
        event: "model_spend",
        model: e.model,
        usd: Number(e.usd.toFixed(6)),
        ...(e.inputTokens !== undefined
          ? { inputTokens: e.inputTokens, outputTokens: e.outputTokens }
          : {}),
        ...(e.seconds !== undefined ? { seconds: e.seconds } : {}),
        totalUsd: Number(ledger.totalUsd.toFixed(4)),
      });
    },
    flush: () => tail,
  };
}
