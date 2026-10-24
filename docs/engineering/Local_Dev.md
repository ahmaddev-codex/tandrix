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

## Database changes

Schema lives in `supabase/migrations` and is applied in order. To add one:

```bash
supabase migration new <name>   # write SQL in the new file
pnpm db:reset                   # apply from scratch locally
```

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
pnpm --filter @tandrix/mobile e2e     # needs the simulator app and API running
```

It signs in, creates a uniquely named job, restarts the app and checks the session and job are still there, then screenshots the design-system gallery in every theme. Results and screenshots land in `.maestro/` (git-ignored).

Release builds come from EAS, never from this machine: Expo loads `.env.local` for production builds too, so a local build would point at the local stack.

## Testing on a physical phone

A phone can't reach `127.0.0.1` on your Mac. In `apps/mobile/.env.local`, replace `127.0.0.1`/`localhost` with your Mac's LAN IP (System Settings > Wi-Fi > Details), and keep the phone on the same network. `pnpm env:local` resets these, so re-apply after running it. Not yet verified: that the local Supabase ports accept connections from other devices; if the phone can't connect, check `docker ps` shows them published on `0.0.0.0`.

## Automated tests

- `pnpm test` needs no services: model calls and the database are faked. This is what CI runs.
- `pnpm test:integration` needs the local stack. It checks the API end to end and the database rules directly: users see only their own data, clients can't write anything, and a step can't be stored as verified without evidence.
