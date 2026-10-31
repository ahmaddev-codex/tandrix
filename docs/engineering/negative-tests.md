# Negative tests

Each failure case, where it is covered, and what the user sees. Anything marked
manual needs a human run; everything else runs in `pnpm test`.

| Case | Expected behaviour | Coverage |
|---|---|---|
| Camera permission denied (phone) | Fallback message + photo picker; upload still works | Maestro `photo-evidence.yaml` (revoked-camera flow); manual on device |
| Mic permission denied (Mac) | Spoken + panel notice with the Settings path; typing still works | Code: `NO_MIC` in `use-show-me.ts`; manual: deny mic, press mic |
| Screen Recording denied (Mac) | Notice with system prompt / Settings; asking still works blind | Code: `ScreenAccessNotice`; manual on device |
| Blurry / unclear photo | `not_verifiable` with what to show instead; never a guessed pass | `ai/test/check.test.ts` (not_verifiable fixture); `prompts.check` wording |
| Part not found | Part `missing`; dependent steps blocked; correction updates | `api/test/parts.test.ts` (O-ring missing + blocking); `core` parts tests |
| No signal mid-job | Actions queue as Pending; captures kept; sync on reconnect | `mobile/src/offline/queue.test.ts`; Maestro offline flow; manual airplane run |
| Model timeout | Plain "can't … right now" fallback; nothing half-applied | `ai/test/{procedure,nameplate}.test.ts` (timeout); `safe-fetch.test.ts`; every pipeline's `unavailable` branch |
| Malformed model output | Repaired once, then rejected with a plain fallback | `ai/test/{procedure,screen,doing}.test.ts` (malformed fixtures; invalid actions dropped) |
| Pointer target off-screen | No pointer drawn; honest fallback reply | `api/test/screen.test.ts` ("doesn't point outside", "rejects coordinates outside") |
| Prompt injection on a label | Label text is data, never instructions | `prompts.test.ts` pins the shared rule on every skill; adversarial labels are a manual red-team item |
| Prompt injection on screen | Same: screen text never changes the rules | Same as above; manual red-team item |
| Live-mains wiring request | Refused with the qualified-electrician message, before any model call | `core/test/safety-parts.test.ts`; `api` refusal tests; low-voltage stays guided |
| Sensitive desktop action | Guard asks first (6 categories, EN+DE/FR/ES/IT/PT); secrets/secure fields denied | `core/test/action-guard.test.ts` (37 cases) |
| Delete job | Job rows cascade; evidence objects removed; manual bytes stay (shared by model key) | `api/test/jobs-delete.test.ts` (objects + rows; other-user 404) |

## Notes

- A dropped connection while steps are written loses nothing: the run carries on in the API,
  and the app finds it again (H10, `test/procedure-run.test.ts`). A restart mid-run marks it lost
  after 8 minutes and it can be started again; nothing is half-saved (single-transaction save).
- Prompt-injection cases are rule-pinned, not behaviourally tested: the model side needs
  recorded adversarial responses, which don't exist yet. Red-team manually before release.
- Manual-device rows (permissions, airplane mode, second-language run) are the product
  owner's checks in H15.
