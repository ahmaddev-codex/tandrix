# Tandrix documentation

Tandrix is an assistant that sees your screen and what's in front of your camera, points at the answer, and checks every step with you, on the Mac and the iPhone. The [repository README](../README.md) covers setup.

## Product

| Document | What it covers |
|---|---|
| [Product requirements](product/PRD.md) | The problem, who it's for, the core experiences, requirements with their status, principles, safety and privacy. |
| [User flows](product/User_Flows.md) | Asking on the Mac, a project on the iPhone, the step loop, handoff, Settings, and recovery from errors. |
| [Design brief](product/Design_Brief.md) | What the design must achieve on each surface. |
| [Launch film prompt](product/Launch_Film_Prompt.md) | The brief for the launch video. |

## Design

| Document | What it covers |
|---|---|
| [Design system](https://claude.ai/artifact/JXT7ErJARYzNkiv8EQjpvp) | Tokens, type, components and their states; mirrored in [design/system](design/system/README.md) and shipped as `@tandrix/ui`. |
| [Design decision](design/decision.md) | Why the design system takes the direction it does. |

## Engineering

| Document | What it covers |
|---|---|
| [Architecture](engineering/Architecture.md) | Stack, repository layout, domain model, API, model pipelines, clients, security. |
| [Local development](engineering/Local_Dev.md) | Environments, commands, running and testing each app. |
| [Execution plan](engineering/Execution_Plan.md) | Milestones and their status, spikes, cut order, release checklist. |
| [Spikes](engineering/spikes.md) | Results of the early model and SDK checks. |
| [Negative tests](engineering/negative-tests.md) | The failure cases the system is checked against. |
| [Fly sizing](engineering/fly-sizing.md) | The API's machine size and when to change it. |
| [Expert recording](engineering/expert-recording.md) | The reserved shape for record mode. |

## Planning

| Document | What it covers |
|---|---|
| [Task list](../tasks/todo.md) | Every task, done and open. |
| [Plan](../tasks/plan.md) | Each task's description, acceptance criteria and verification. |

## Key decisions

- **Surfaces:** Mac (Electron), iPhone (Expo), web (Next.js). Glasses come after everything else.
- **On the Mac, Tandrix shows by default** and acts only when asked: through a deterministic action guard, visibly, stoppable at once, confirming anything that sends, pays or deletes.
- **Only screen work waits.** Background agents act through fixed Mac tools and their own hidden browser, never the user's mouse or keyboard.
- **Models:** `muse-spark-1.3` (reasoning, vision, computer use), `sam-3.1` (part outlines), `muse-voice-transcribe-1.0` (speech); Kokoro for Tandrix's voice.
- **Backend:** Hono API and Supabase (Postgres, Storage, Auth, Realtime for handoff).
- **Design:** one design system for every surface; white, black and Tandrix blue.
