// Keeps the SQL check constraints in step with the Zod enums in @tandrix/contracts.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  AssetCategory,
  CheckResult,
  ControlMode,
  EventType,
  EvidenceKind,
  HazardTag,
  JobStatus,
  JobStepStatus,
  SafetyGate,
  StepSurface,
  Surface,
  Verification,
} from "@tandrix/contracts";
import { describe, expect, it } from "vitest";

const dir = join(__dirname, "../../../supabase/migrations");
const sql = readdirSync(dir)
  .filter((f) => f.endsWith(".sql"))
  .sort()
  .map((f) => readFileSync(join(dir, f), "utf8"))
  .join("\n");

/** Values in `<column> in ('a', 'b')` or `<column> <@ array['a', 'b']` for a table's column. */
function sqlValues(table: string, column: string): string[] {
  const start = sql.indexOf(`create table public.${table} (`);
  if (start < 0) throw new Error(`table ${table} not found`);
  const body = sql.slice(start, sql.indexOf("\n);", start));
  const re = new RegExp(`\\b${column}\\b\\s+(?:in\\s*\\(|<@\\s*array\\[)([^\\])]*)`, "s");
  const m = re.exec(body);
  if (!m) throw new Error(`no value list for ${table}.${column}`);
  return [...m[1]!.matchAll(/'([^']+)'/g)].map((x) => x[1]!).sort();
}

const cases: Array<[string, string, readonly string[]]> = [
  ["assets", "category", AssetCategory.options],
  ["procedure_steps", "surface", StepSurface.options],
  ["procedure_steps", "hazard_tags", HazardTag.options],
  ["procedure_steps", "verification", Verification.options],
  ["jobs", "status", JobStatus.options],
  ["jobs", "active_surface", Surface.options],
  ["jobs", "control_mode", ControlMode.options],
  ["job_steps", "status", JobStepStatus.options],
  ["job_steps", "updated_by_surface", Surface.options],
  ["evidence", "kind", EvidenceKind.options],
  ["evidence", "surface", Surface.options],
  ["checks", "result", CheckResult.options],
  ["safety_confirmations", "gate", SafetyGate.options],
  ["safety_confirmations", "surface", Surface.options],
  ["events", "type", EventType.options],
  ["events", "surface", Surface.options],
];

describe("SQL constraints match contracts", () => {
  for (const [table, column, values] of cases) {
    it(`${table}.${column}`, () => {
      expect(sqlValues(table, column)).toEqual([...values].sort());
    });
  }
});
