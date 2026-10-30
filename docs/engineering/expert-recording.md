# Expert recordings: the reserved shape

The `expert_recording` citation kind and `source_type` are reserved in the schema and
contracts, but nothing produces them yet (see H6). This note reserves the shape so a future
producer (T28 Record mode) plugs in without a migration.

## Reserved today

- `procedures.source_type = 'expert_recording'` (check constraint in `20261024083431_init.sql`).
- Step citation `{ kind: "expert_recording", timestampSec }` (`contracts/model-outputs.ts`,
  `procedure_steps.citation` check).
- `citationLabel()` in `packages/ui` already renders it.

## What a producer must satisfy

1. A recording is evidence first: stored bytes in a private bucket with an `evidence` row,
   owned by the uploader, exactly like manual uploads.
2. Steps cite `{ kind: "expert_recording", timestampSec }` where `timestampSec` is the second
   in the recording the step comes from; the review screen must play that moment.
3. Publishing (`status: draft → published`) reuses the procedure flow; the recording stays
   attached as the procedure's source, never as inline step data.
4. Keyframes are derived artifacts (like rendered manual pages): cached, content-hashed,
   re-renderable from the recording.

No code changes in this note. Building the producer is T28.
