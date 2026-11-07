/**
 * One Show me ask, streamed, printing when each event arrives (SP3): does the pointer's action
 * come before the words, and how soon is the first sentence there? About a cent.
 *   pnpm --filter @tandrix/api exec tsx --env-file=../../.env.local scripts/stream-probe.ts [screen] [n]
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { imageData, loadMetaConfig, MetaClient, prompts, REPLY_RULE } from "@tandrix/ai";
import { text, user } from "../../../packages/ai/src/content";

const root = join(import.meta.dirname, "../../..");
const screens = JSON.parse(
  readFileSync(join(root, "fixtures/screens/targets.json"), "utf8"),
) as Array<{
  screen: string;
  file: string;
  targets: Array<{ ask: string }>;
}>;
const s = screens.find((x) => x.screen === (process.argv[2] ?? "mail"))!;
const ask = s.targets[Number(process.argv[3] ?? 0)]!.ask;
const config = loadMetaConfig();
const client = new MetaClient({ apiKey: config.apiKey, baseUrl: config.baseUrl });
const started = performance.now();
const at = () => `${String(Math.round(performance.now() - started)).padStart(5)} ms`;
console.log(`"${ask}" on ${s.screen}`);
for await (const e of client.stream({
  model: config.models.computerUse,
  instructions: prompts.showMe,
  tools: [{ type: "computer" }],
  reasoning: { effort: "minimal" },
  input: [
    user(
      text(`The user asks: ${ask}\n\n${REPLY_RULE}`),
      imageData(readFileSync(join(root, "fixtures/screens", s.file)), "image/jpeg"),
    ),
  ],
})) {
  const item = e.item as { type?: string; action?: unknown; actions?: unknown } | undefined;
  const extra =
    e.type === "response.output_text.delta"
      ? JSON.stringify(e.delta)
      : item
        ? `${item.type} ${JSON.stringify(item.action ?? item.actions ?? "").slice(0, 120)}`
        : "";
  console.log(at(), e.type, extra);
}
