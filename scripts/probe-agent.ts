/**
 * Probe: the background agent on real tasks, with the Mac's tools simulated (nothing touches the Mac).
 *   tsx --env-file=.env.local scripts/probe-agent.ts
 */
import { join } from "node:path";
import type { AgentStep } from "@tandrix/contracts";
import { fileSpendMeter } from "../apps/api/src/spend";
import { MetaClient, loadMetaConfig, runBackground, setSpendMeter } from "@tandrix/ai";

const cfg = loadMetaConfig();
setSpendMeter(
  fileSpendMeter(
    join(import.meta.dirname, "..", "apps/api/.meta-spend.json"),
    Number(process.env.META_SPEND_LIMIT_USD ?? 10),
    () => undefined,
  ),
);
const client = new MetaClient({
  apiKey: cfg.apiKey,
  baseUrl: cfg.baseUrl,
  timeoutMs: cfg.timeoutMs,
});
const fake: Record<string, string> = {
  calendar_list_events:
    "Team sync | Thursday, 5 November 2026 at 09:00:00\nLunch with Ana | Thursday, 5 November 2026 at 12:30:00",
  calendar_add_event: "Added to Home",
  reminders_add: "Added",
  notes_create: "Made",
  mail_draft: "Saved to Drafts",
  files_list: "Invoice-October.pdf\nTrip photos\nNotes.txt",
};
for (const task of [
  "Book the dentist on Thursday morning when I'm free, an hour",
  "Remind me to call Sam tomorrow at 9 and email him at sam@example.com that I'll call",
  "What's the newest invoice in my Downloads?",
]) {
  const steps: AgentStep[] = [];
  const t0 = Date.now();
  for (let i = 0; i < 6; i++) {
    const r = await runBackground(client, cfg.models.reasoning, task, undefined, {
      tools: true,
      steps,
      now: "2026-10-30T09:00+01:00",
    });
    if (r.status === "done") {
      console.log(
        `\n${task}\n  ${steps.map((s) => `${s.name} ${s.arguments}`).join("\n  ")}\n  -> ${r.spoken}  (${Date.now() - t0} ms, ${i + 1} calls)`,
      );
      break;
    }
    for (const c of r.calls) steps.push({ ...c, output: fake[c.name] ?? "ok" });
  }
}
