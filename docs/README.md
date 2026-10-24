# Tandrix docs

Tandrix is one AI engineer for the physical and digital worlds: phone and Ray-Ban Meta glasses guide on-site assembly by highlighting real parts; the desktop app teaches any screen by pointing at what to click. One job session spans all of them.

## Product
- [PRD](product/PRD.md) — problem, users, scope, requirements, success metrics.
- [User flows](product/User_Flows.md) — job spine, step loop, desktop, handoff, record mode, demo script.
- [Design brief](product/Design_Brief.md) — brand, visual direction per surface, components, copy.

## Design
- [Design system](https://claude.ai/artifact/JXT7ErJARYzNkiv8EQjpvp) — tokens, type, components, field extensions; mirrored in [design/system](design/system/README.md).
- [Decision](design/decision.md) — why a Geist-style system.

## Engineering
- [Architecture](engineering/Architecture.md) — stack, repo layout, domain model, API, AI pipelines, security.
- [Hackathon plan](engineering/Hackathon_Plan.md) — 26 Oct – 4 Nov schedule, day-1 spikes, cut order, submission checklist.

## Key decisions
- Phone app: Expo (React Native), needed for the glasses SDK and good camera/voice.
- Desktop app: Electron overlay; **Show me** (point only, default) or opt-in **Do it for me** (Tandrix clicks/types, guarded, stoppable).
- Backend: Hono API + Supabase (Realtime powers device handoff).
- Models: `muse-spark-1.3`, `sam-3.1`, `muse-voice-transcribe-1.0`; on-device text-to-speech.
- Demo hero: a real pump assembly; the product is general for mechanical assembly and software setup.
