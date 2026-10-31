# Local development

Local development runs against a full Supabase stack in Docker on your Mac: Postgres, Auth, Storage, Realtime, Studio and a mail catcher. Nothing in it can reach production, and production never sees local data.

## Environments

| | Local | Production |
|---|---|---|
| Supabase | Docker on this Mac (`127.0.0.1:54321`) | Hosted project |
| Values live in | `.env.local` (generated, git-ignored) | Deploy platform secrets (Fly.io/Railway, EAS, notarisation) |
| Meta API key | A separate dev key | The production key |
| Auth email | Caught by Mailpit at `127.0.0.1:54324`; nothing is sent | Real email |
| Data | Disposable: `pnpm db:reset` wipes and re-seeds | Persistent |

Rules:
- Dev commands read `.env.local` only. They never read `.env`.
- `TANDRIX_ENV=local` marks the local environment. Scripts that write data (`db:seed`) refuse to run unless `TANDRIX_ENV` is `local` and Supabase is on localhost.
- Keep production values off developer machines. If you must hold them locally (for a one-off deploy), use `.env.production.local`; it is git-ignored and nothing in dev loads it.
- Use a separate Meta API key for development, so local runs never use production quota or show up on production billing.

## First-time setup

Needs Docker Desktop running and the Supabase CLI (`brew install supabase/tap/supabase`).

```bash
pnpm install
pnpm setup:local      # start Supabase, write .env.local, create the test user
```

Then add your dev Meta key to `META_API_KEY` in `.env.local` and check the models:

```bash
pnpm smoke:meta
```

## Everyday commands

| Command | What it does |
|---|---|
| `pnpm db:start` / `pnpm db:stop` | Start or stop the local stack (data is kept between stops) |
| `pnpm db:status` | URLs and local keys |
| `pnpm db:reset` | Recreate the database from `supabase/migrations`, then re-seed |
| `pnpm db:seed` | Create the test user (`DEV_USER_EMAIL` / `DEV_USER_PASSWORD` in `.env.local`) |
| `pnpm env:local` | Rewrite `.env.local` from the running stack; keeps your Meta key and secrets |
| `pnpm smoke:meta` | One live call per Meta model, using `.env.local` |
| `pnpm --filter @tandrix/api dev` | Run the API on http://localhost:8787 against the local stack (reloads on change) |
| `pnpm test:integration` | API and database security tests against the local stack (two throwaway users, deleted afterwards) |

Local tools:
- Studio (tables, auth users, storage): http://127.0.0.1:54323
- Mailpit (magic links and OTP codes sent to local users): http://127.0.0.1:54324

## Models and spend

The API always uses the real models (there is no canned-answer mode). Without `META_API_KEY` locally, every model feature says it's unavailable and the app falls back (type the details, upload the manual, confirm steps yourself); in production the API refuses to start without it. Every model call is metered against a local cap (`META_SPEND_LIMIT_USD`, $10 by default); see the total with `pnpm --filter @tandrix/api spend`. Unit and integration tests use fakes inside the test code and never call the models.

## Database changes

Schema lives in `supabase/migrations` and is applied in order. To add one:

```bash
supabase migration new <name>   # write SQL in the new file
pnpm db:reset                   # apply from scratch locally
```

In scripts or non-interactive shells, run `supabase migration new <name> < /dev/null`: without a terminal it waits for SQL on standard input and leaves the file empty.

Every new table needs, in its migration: `enable row level security`, a read policy for its owner, and explicit grants (`select` to `authenticated`, read/write to `service_role`, nothing to `anon`). Supabase no longer adds these by default. The integration tests check this for `jobs` and `job_steps`; add the same "client can't write" check for any new table that holds user data.

Production gets the same migrations through `supabase db push` against the linked project, run from CI or deliberately by hand, never from a dev script.

## Phone app (iOS simulator)

Needs Xcode with an iPhone simulator, CocoaPods and the API running.

```bash
pnpm --filter @tandrix/api dev        # API on :8787 (separate terminal)
pnpm --filter @tandrix/mobile ios     # builds the dev client and opens the simulator
```

The first native build downloads and compiles every native module and takes a while; later runs are fast. `pnpm env:local` also writes `apps/mobile/.env.local` with the public `EXPO_PUBLIC_*` values only.

Signing in locally:
- **Email code:** enter any email; the 6-digit code arrives in Mailpit (http://127.0.0.1:54324). The template that shows the code is `supabase/templates/sign-in-code.html`.
- **Local test sign-in:** only on the local stack, signs in `DEV_USER_EMAIL` / `DEV_USER_PASSWORD` from `.env.local`. It doesn't exist in production builds.

End-to-end tests drive the simulator with [Maestro](https://maestro.mobile.dev) (`brew tap mobile-dev-inc/tap && brew install mobile-dev-inc/tap/maestro`; the npm package called `maestro` is unrelated):

```bash
pnpm --filter @tandrix/mobile e2e     # runs apps/mobile/e2e/run.sh; needs the simulator app and API running
```

By default it runs the five crucial flows (sign in and start a project, the safety gate, highlighting, the photo check, pointing the camera); `sh apps/mobile/e2e/run.sh --all` runs all of them. They run on the real models (API started with `pnpm --filter @tandrix/api dev`); a run spends well under a dollar, under the API's spend cap. Each flow gets a fresh project from `pnpm --filter @tandrix/api e2e:seed <empty|asset|pi>` (test tooling: a project with known Raspberry Pi 5 steps, so no model call is spent writing them) and its photos staged newest-last in `apps/mobile/e2e/.media`, since the photo picker sorts by date. Run one with `sh apps/mobile/e2e/run.sh <flow.yaml>`. The flows: sign in, start a project from its goal alone (setup writes general steps, all labelled Generic), restart, still signed in and listed; the design-system gallery in every theme; add a photo through the picker (camera denied); identify the equipment from the Raspberry Pi 5 box; photograph a two-page kit sheet as the manual and write steps that cite its pages; highlight a step's parts on the bare board (the board found, the cooler reported not found) and confirm one; a power-off safety gate before the step can start, and a torque value refused out of range then accepted; hold to talk and get a spoken reply (the simulator's microphone can't take real speech, so the reply may be "didn't catch that"); check the cooler step by photo, needing attention on the bare board and verified on the fitted one; a step's reference photo added, opened full screen and removed; the parts check, where a missing cable holds its step until it's marked as here; and pointing the camera at the fitted board (a photo stands in for the camera) and asking what it is. The gallery flow also covers every native design-system component in light, dark and sunlight. Results and screenshots land in `.maestro/` (git-ignored). Don't start Metro with `CI=1`: CI mode turns off reloads, so the app keeps running the old bundle after an edit. The simulator has no camera or real microphone input, so the shutter and speech are physical-device checks.

If the simulator shows code you've already changed, Metro is serving a stale bundle: stop it and run `pnpm exec expo start --dev-client --clear` in `apps/mobile`. The first screens after a cache clear take a few seconds to build; the flows wait for each screen.

After `pnpm db:reset`, the simulator may still hold a session for the old test user. The API answers its writes with 401 and the app signs out; sign in again.

Run the API with `pnpm --filter @tandrix/api dev` (it reloads on change). An API started before new routes were added answers "No such route." until restarted.

Release builds come from EAS, never from this machine: Expo loads `.env.local` for production builds too, so a local build would point at the local stack.

Signing in a Mac from the phone is checked by `sh apps/mobile/e2e/pair-mac/run.sh`: the script plays the Mac (asks the API for a code), the flow opens the Mac's link on the phone, checks the Mac's name and approves it, and the script then checks the Mac's poll gets its sign-in.

Handoff is checked by `sh apps/mobile/e2e/handoff/run.sh`: it seeds the Raspberry Pi 5 project; the phone opens step 5 (writing the OS, done on a computer) and taps Continue on Mac; `handoff/mac.mjs` plays the Mac through the API, starts the step and checks a screenshot of the synthetic OS Writer showing a finished write (`fixtures/demo-pi5/screens/os-writer-done.html`) on the real model; the phone's open step turns Verified without a refresh.

Going offline mid-job is checked by `sh apps/mobile/e2e/offline/run.sh`: it opens a step, stops the local API, starts the step (kept, shown as Pending, the job says it's offline), restarts the API, and waits for the queued start to be sent.

## Mac app

Needs the API running. `pnpm env:local` writes the Mac app's public `VITE_*` values into `.env.local` and allows its origins (`http://localhost:5173` for the dev server, `app://tandrix` for built apps) in `CORS_ORIGINS`; re-run it once if your `.env.local` predates the Mac app.

```bash
pnpm --filter @tandrix/api dev        # API on :8787 (separate terminal)
pnpm --filter @tandrix/desktop dev    # Vite on :5173 + Electron; restarts Electron when main/preload change
pnpm --filter @tandrix/desktop build  # dist/: renderer (served from app://tandrix), main and preload
pnpm --filter @tandrix/desktop start  # runs the built app
```

- Tandrix lives in the menu bar (a "Tandrix" title, no Dock icon). Click it to open the panel; it closes when it loses focus. Right-click for Quit. The panel opens by itself on launch.
- Signed out, the panel shows a QR: scan it with the phone (the camera app opens Tandrix), or open Settings on the phone, choose Sign in a Mac, and type the code. "Sign in with email instead" gives the email code (from Mailpit) and, on the local stack, "Local test sign-in". The session is encrypted with `safeStorage` (Keychain) under the app's userData folder and survives restarts.
- **Show me:** in any app, hold ⌥⌘, ask out loud and let go (needs Tandrix, or in dev the app that launched Electron, allowed under Privacy & Security > Accessibility; only Option, Command and "another key" are looked at). ⌃⌥Space also works: press, ask, and a pause sends it. The panel doesn't open: a presence bar at the top of the display under the cursor shows Listening (with the mic level), Looking at your screen, then the reply, and is gone when Tandrix is idle. The panel, from the menu-bar icon, is for signing in, setup, typed questions and projects handed to the Mac. In dev, macOS asks about the microphone for the app that launched Electron.
- **Desktop steps:** a project whose steps include work on the computer offers them in the panel once handed to the Mac: start one, then "Check my screen".
- **Do it for me:** ask Tandrix to do something and it offers ("Want me to do it?"); say yes or click. Settings (the gear in the panel header) has "Always do things without asking first". It needs Tandrix allowed under Privacy & Security > Accessibility. Moving the mouse, typing or pressing Esc takes control back.
- **Background tasks:** look-ups, drafts and other tasks that need no screen run in parallel with whatever is on screen. They can add calendar events and reminders, make notes, save email drafts and list files through fixed AppleScripts; macOS asks once per app (Privacy & Security > Automation). They use websites in Tandrix's own hidden browser; sign in to sites from Settings → Tandrix's browser.
- **Wake word and voice:** switch on "Hey Tandrix" in Settings. "Teach Tandrix my voice" records three phrases into an on-device voiceprint (kept in the app's userData folder, deletable from Settings). The wake helper needs Speech Recognition and the microphone; `TANDRIX_WAKE_DEBUG=1` prints what it hears.
- "Test the pointer" (Settings → Development, local builds only) draws the pointer at the centre of every display for four seconds. Checking it on two displays is a manual check.
- Screen Recording: in dev, macOS asks about (and lists) the app that launched Electron, usually your terminal or editor, not Tandrix.
- Editors built on Electron export `ELECTRON_RUN_AS_NODE` to their terminals; the dev script removes it. Run the built app with `env -u ELECTRON_RUN_AS_NODE pnpm --filter @tandrix/desktop start` from such a terminal.
- Pass Electron flags after `--`, e.g. `pnpm --filter @tandrix/desktop dev -- --remote-debugging-port=9222` to inspect the panel and overlays from Chrome.
- The design-system gallery for the Mac and web components, in light, dark and sunlight, is at http://localhost:5173/gallery.html while the dev server runs (in any browser; it isn't in the built app).

## Website

```bash
pnpm --filter @tandrix/web dev        # Next.js on http://localhost:3000
pnpm --filter @tandrix/web build      # production build
```

- Next.js App Router, styled with Tailwind CSS v4. The theme in `src/app/globals.css` maps the design system's tokens (`@tandrix/ui`), so `bg-mist`, `text-ink` and `text-highlight` follow light and dark. The design system's own stylesheet and the vendored figure kit load into Tailwind's `components` layer, so utilities can adjust them.
- `src/app` holds routes only (the marketing pages in a `(marketing)` group, the shared report at `/r/[token]`); homepage sections are in `src/components/sections`, their words in `src/content/home.tsx`.
- The early-access form posts to the API's `/early-access`; set `NEXT_PUBLIC_API_URL` to point it elsewhere.

## Testing on a physical phone

A phone can't reach `127.0.0.1` on your Mac. In `apps/mobile/.env.local`, replace `127.0.0.1`/`localhost` with your Mac's LAN IP (System Settings > Wi-Fi > Details), and keep the phone on the same network. `pnpm env:local` resets these, so re-apply after running it. Not yet verified: that the local Supabase ports accept connections from other devices; if the phone can't connect, check `docker ps` shows them published on `0.0.0.0`.

## Automated tests

- `pnpm test` needs no services: model calls and the database are faked. This is what CI runs.
- `pnpm test:integration` needs the local stack. It checks the API end to end and the database rules directly: users see only their own data, clients can't write anything, and a step can't be stored as verified without evidence.
- `tsx --env-file=.env.local scripts/probe-agent.ts` runs the background agent on three real tasks with the Mac's tools simulated (nothing touches the Mac); it spends a few cents.

## Building the Mac app

`pnpm --filter @tandrix/desktop dist` writes a DMG to `apps/desktop/release/`. It needs Xcode's command line tools for the Swift helpers.

- **Where it points:** the renderer's `VITE_API_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` and `TANDRIX_ENV` are compiled in at build time, from `.env.local` unless they're set in the environment. Set them to production's before building one to hand out.
- **Signing:** with no credentials the build is ad-hoc signed and runs only on the Mac that built it. For a build others can open, set `CSC_LINK` and `CSC_KEY_PASSWORD` (or have a Developer ID in the keychain), plus `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD` and `APPLE_TEAM_ID` to notarize. Settings are in `apps/desktop/electron-builder.yml`.
- **Trying a build beside the dev app:** the single-instance lock makes it quit at once if a copy with the same profile is running, so pass `--user-data-dir=<a temp folder>`.

App icons, on every surface, come from the mark in `scripts/build-app-icons.ts` (`pnpm exec tsx scripts/build-app-icons.ts`). The phone picks them up at its next native build (`pnpm --filter @tandrix/mobile ios`).

## Deploying the website

The website runs on Cloudflare Workers through [OpenNext](https://opennext.js.org/cloudflare). It stays well inside a free Worker (about 1.2 MB gzipped), and pages are prerendered except shared reports (`/r/[token]`).

**Try it first in Cloudflare's runtime:**

```bash
pnpm --filter @tandrix/web build:worker
pnpm --filter @tandrix/web exec opennextjs-cloudflare preview --port 8788   # 8787 is the API
```

**Settings.** `NEXT_PUBLIC_*` values are compiled in at build time, so a change needs a new build. `API_PUBLIC_URL` is read when a report opens, so it's set on the Worker.

| Setting | When | Value |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | Build | The site's address, such as `https://tandrix.com`: social cards and the sitemap |
| `NEXT_PUBLIC_API_URL` | Build | The API, for the early-access form |
| `NEXT_PUBLIC_MAC_DOWNLOAD_URL`, `NEXT_PUBLIC_IPHONE_DOWNLOAD_URL` | Build | Optional. Until set, Get Tandrix leads to the early-access form |
| `NEXT_PUBLIC_SOURCE_URL` | Build | Optional. Adds Source to the footer |
| `API_PUBLIC_URL` | Runtime | The API, for shared reports |

On the API, add the site's address to `CORS_ORIGINS`, or the early-access form is refused.

**Deploy one of two ways:**

- **From this machine:** `pnpm --filter @tandrix/web exec wrangler login` once, then, with the build settings in the environment, `pnpm --filter @tandrix/web deploy`. Set `API_PUBLIC_URL` with `pnpm --filter @tandrix/web exec wrangler secret put API_PUBLIC_URL`, or as a variable in the dashboard; deploys keep it (`keep_vars`).
- **From GitHub (Workers Builds):** connect the repo in the Cloudflare dashboard with the root directory as `/`, which uses the root `wrangler.jsonc` and its build command, and `npx wrangler deploy` as the deploy command. Put the build settings under Build variables and `API_PUBLIC_URL` under the Worker's variables.

Add the custom domain under the Worker's Settings > Domains & Routes. Security headers are in `apps/web/next.config.ts`, and static file caching in `apps/web/public/_headers`. CI checks the Worker builds and fits on every push.
