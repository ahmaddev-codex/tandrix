// Prints what local testing has spent on Meta models (the API's ledger).
//   pnpm --filter @tandrix/api spend
import { join } from "node:path";
import { readLedger } from "../src/spend";

const path = process.env.META_SPEND_LEDGER ?? join(import.meta.dirname, "..", ".meta-spend.json");
const l = readLedger(path);
const limit = Number(process.env.META_SPEND_LIMIT_USD ?? 10);
console.log(
  `Spent $${l.totalUsd.toFixed(4)} of the $${limit} local cap over ${l.calls} calls since ${l.since}.`,
);
for (const [model, m] of Object.entries(l.byModel))
  console.log(`  ${model}: $${m.usd.toFixed(4)} over ${m.calls} calls`);
