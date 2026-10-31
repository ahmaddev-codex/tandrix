# Tandrix

Tandrix is an assistant that sees your screen and what's in front of your camera, points at the answer, and checks every step with you.

- **On the Mac**, it rings the exact control and says the next step (**Show me**), does the task itself when you ask (**Do it for me**), and runs work that needs no screen in the background, several tasks at once.
- **On the iPhone**, it turns a goal into steps from the real manual, outlines the parts in a photo, and checks each step from a photo before moving on.
- **On the web**, a finished project becomes a private, shareable report of what was done and how each step was checked.

Built on Meta's models: Muse Spark for reasoning, vision and computer use; SAM 3.1 for outlining parts; Muse Voice Transcribe for speech. Tandrix's voice is Kokoro, an open text-to-speech model, run on our own server.

## Repository

| Path                 | What it is                                                                |
| -------------------- | ------------------------------------------------------------------------- |
| `apps/mobile`        | iPhone app (Expo, React Native)                                           |
| `apps/desktop`       | Mac app (Electron), with native Swift helpers for input and the wake word |
| `apps/api`           | API (Hono on Node): auth, projects, model pipelines, voice                |
| `apps/web`           | Website and shared reports (Next.js, Tailwind CSS)                        |
| `packages/contracts` | Zod schemas and types shared by every app                                 |
| `packages/core`      | Step status, safety gates, the action guard, assistant rules              |
| `packages/ai`        | Meta API client, prompts and pipelines, background agents                 |
| `packages/ui`        | `@tandrix/ui`: design tokens and components for web and native            |
| `supabase/`          | Database migrations and row-level security                                |
| `docs/`              | Product, design and engineering documentation                             |

## Getting started

Requirements: Node 22 or later, pnpm 10, Docker Desktop and the Supabase CLI. The iPhone app also needs Xcode; the Mac app needs macOS.

```bash
pnpm install
pnpm setup:local                       # local Supabase, .env.local, a test user
# add your development Meta API key to META_API_KEY in .env.local
pnpm smoke:meta                        # one live call per model
pnpm --filter @tandrix/api dev         # API on http://localhost:8787
```

Then, in separate terminals:

```bash
pnpm --filter @tandrix/web dev         # website on http://localhost:3000
pnpm --filter @tandrix/desktop dev     # Mac app
pnpm --filter @tandrix/mobile ios      # iPhone app in the simulator
```

[Local development](docs/engineering/Local_Dev.md) covers environments, signing in, the end-to-end tests and each app in detail.

## Checks

```bash
pnpm typecheck
pnpm lint
pnpm test                              # unit tests; no services needed
pnpm test:integration                  # API and database rules against the local stack
pnpm --filter @tandrix/mobile e2e      # iPhone flows on the simulator, real models
```

Every model call is metered against a local spend cap (`META_SPEND_LIMIT_USD`). There is no canned-answer mode: without a Meta key, model features say they're unavailable and the apps fall back.

## Documentation

Start with the [documentation index](docs/README.md): the product requirements, user flows, design system, architecture and the current task list.

## Status

The Mac, iPhone, API and website are built and verified locally. Deploying (hosted Supabase, Fly.io, Vercel, EAS and a signed Mac build), the glasses, record mode and multilingual support are still to do. The live list is [tasks/todo.md](tasks/todo.md).
