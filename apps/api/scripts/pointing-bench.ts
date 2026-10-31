/**
 * The Show me pointing bench (T4): asks the local API where to click on the synthetic app screens
 * in fixtures/screens (render them first with fixtures/screens/render.mjs) and scores the pointer
 * against each control's known box. Real models; about a cent per target, so a full run is about
 * $0.20. Start the API first with `pnpm --filter @tandrix/api dev`.
 *   pnpm --filter @tandrix/api pointing-bench [screen…]
 * Pass: at least 18 of 20 targets with the pointer inside the control.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { readLedger } from "../src/spend";

const env = (k: string) => {
  const v = process.env[k];
  if (!v) throw new Error(`${k} is not set`);
  return v;
};
const api = process.env.API_PUBLIC_URL ?? "http://localhost:8787";
const dir = join(import.meta.dirname, "../../../fixtures/screens");
const ledger = join(import.meta.dirname, "..", ".meta-spend.json");

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}
interface Screen {
  screen: string;
  file: string;
  width: number;
  height: number;
  targets: Array<{ id: string; ask: string; box: Box }>;
}

const only = process.argv.slice(2);
const screens = (JSON.parse(readFileSync(join(dir, "targets.json"), "utf8")) as Screen[]).filter(
  (s) => !only.length || only.includes(s.screen),
);

const auth = (await (
  await fetch(`${env("SUPABASE_URL")}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: env("SUPABASE_PUBLISHABLE_KEY"), "content-type": "application/json" },
    body: JSON.stringify({ email: env("DEV_USER_EMAIL"), password: env("DEV_USER_PASSWORD") }),
  })
).json()) as { access_token: string };

const inside = (p: { x: number; y: number }, b: Box) =>
  p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h;

const spentBefore = readLedger(ledger).totalUsd;
let hits = 0;
let total = 0;
const rows: string[] = [];
for (const s of screens) {
  const data = readFileSync(join(dir, s.file)).toString("base64");
  for (const t of s.targets) {
    total++;
    const started = Date.now();
    const res = await fetch(`${api}/screen/ask`, {
      method: "POST",
      headers: { authorization: `Bearer ${auth.access_token}`, "content-type": "application/json" },
      body: JSON.stringify({
        screenshot: { mimeType: "image/jpeg", data },
        transcript: t.ask,
        geometry: {
          displayId: "1",
          imageWidth: s.width,
          imageHeight: s.height,
          originX: 0,
          originY: 0,
          displayWidth: 1440,
          displayHeight: 900,
        },
        mode: "show",
        history: [],
      }),
    });
    const ms = Date.now() - started;
    const body = (await res.json()) as {
      status: string;
      reply?: string;
      target?: {
        geometry: { kind: "point"; point: { x: number; y: number } } | { kind: "box"; box: Box };
      } | null;
    };
    const g = body.target?.geometry;
    const at = !g
      ? null
      : g.kind === "point"
        ? g.point
        : { x: g.box.x + g.box.w / 2, y: g.box.y + g.box.h / 2 };
    const hit = !!at && inside(at, t.box);
    if (hit) hits++;
    const centre = { x: t.box.x + t.box.w / 2, y: t.box.y + t.box.h / 2 };
    const off = at ? `${Math.round(at.x - centre.x)},${Math.round(at.y - centre.y)}` : "none";
    rows.push(
      `${hit ? "HIT " : "MISS"} ${s.screen}/${t.id.padEnd(12)} off ${off.padEnd(9)} ${g?.kind ?? "-"} ${ms} ms  ${(body.reply ?? body.status).slice(0, 70)}`,
    );
    console.log(rows.at(-1));
  }
}
const spent = readLedger(ledger).totalUsd - spentBefore;
console.log(
  `\n${hits} of ${total} inside the control (pass: 18 of 20). Spent $${spent.toFixed(3)}.`,
);
