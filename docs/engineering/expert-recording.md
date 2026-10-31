# Expert recordings (record mode)

Someone who knows a job does it once while Tandrix records, and the job's steps come from what
they showed and said. Built as T28.

## How a recording is made

On the phone, a project with no steps offers **Record it** (`apps/mobile/src/app/(app)/job/[id]/record.tsx`).
At each moment the expert takes a picture (or chooses one) and holds the mic to say what they're
doing, or types it. Each moment keeps its time since the first picture. With at least two moments,
**Write the steps** uploads the photos as the job's evidence and sends the moments.

A recording is a series of moments rather than a video: the photos and words carry what the steps
need, and nothing has to be transcoded (there's no ffmpeg on the API).

## What the API does

`POST /jobs/:id/procedure/recorded` (`RecordedProcedureRequest`: 2 to 30 moments of
`{ evidenceId, said, atSec }`):

1. Checks each moment's evidence is an uploaded photo on this job.
2. Spark (`stepsFromRecording`, prompt `procedureRecorded`) writes the procedure in the expert's
   words: one action per step, splitting or merging moments, hazards tagged as usual, each step
   cited `{ kind: "expert_recording", timestampSec }`.
3. `normalizeDraft` keeps a recording citation only inside the recording (`recordingSec`); anything
   else becomes generic.
4. The procedure is saved with `source_type = 'expert_recording'`. Each cited step's stored citation
   is `{ kind: "expert_recording", recordingEvidenceId, timestampSec }`, where the evidence is the
   photo of the moment nearest that time, and that photo becomes the step's reference picture.

Steps show their source as "Recorded at 0:48" (`citationSource` in `@tandrix/ui`).

## Not yet

- Playing the moment back from the step (the reference picture stands in for it).
- Video recordings: a producer would extract keyframes and the audio's words into the same moments.
