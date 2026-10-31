// "Know my voice": the user reads three short phrases once, and Tandrix answers "Hey Tandrix" only
// in their voice, ignoring the TV and other people. The voiceprint is made and kept on this Mac;
// no audio is kept or sent. It's a filter, not a lock.
import { Button, ConfirmDialog, Notice, Toggle } from "@tandrix/ui/web";
import { useCallback, useEffect, useRef, useState } from "react";

const PHRASES = [
  "Hey Tandrix, open my calendar for today",
  "Tandrix, what's on my screen right now?",
  "Hey Tandrix, help me finish this document",
];
/** A phrase stops recording by itself after this long. */
const LONGEST_MS = 5000;

type Step =
  | { kind: "loading" }
  | { kind: "none" }
  | { kind: "phrase"; index: number; recording: boolean; note?: string }
  | { kind: "known"; onlyMine: boolean };

export function VoiceSetup({ listening }: { listening: boolean }) {
  const voice = window.tandrix.voice;
  const [step, setStep] = useState<Step>({ kind: "loading" });
  const [deleting, setDeleting] = useState(false);
  const [ignored, setIgnored] = useState(false);
  const stopTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const refresh = useCallback(async () => {
    const s = await voice.voiceprint();
    setStep(s.enrolled ? { kind: "known", onlyMine: s.onlyMine } : { kind: "none" });
  }, [voice]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // A wake in someone else's voice: say so briefly, so a quiet Tandrix isn't a mystery.
  useEffect(
    () =>
      voice.onWakeIgnored(() => {
        setIgnored(true);
        setTimeout(() => setIgnored(false), 4000);
      }),
    [voice],
  );

  useEffect(() => () => clearTimeout(stopTimer.current), []);

  const stop = useCallback(
    async (index: number) => {
      clearTimeout(stopTimer.current);
      const r = await voice.voicePhrase(index, "stop");
      if (!r.ok) {
        setStep({
          kind: "phrase",
          index,
          recording: false,
          note: "I didn't catch enough of that. Say it again, a little closer to the Mac.",
        });
        return;
      }
      if (index < PHRASES.length - 1) {
        setStep({ kind: "phrase", index: index + 1, recording: false });
        return;
      }
      const done = await voice.voiceFinish();
      if (done.ok) setStep({ kind: "known", onlyMine: true });
      else
        setStep({
          kind: "phrase",
          index: done.redo,
          recording: false,
          note: "That one sounded different from the others. Say it once more.",
        });
    },
    [voice],
  );

  const record = async (index: number) => {
    const r = await voice.voicePhrase(index, "start");
    if (!r.ok) {
      setStep({ kind: "phrase", index, recording: false, note: "Switch the wake word on first." });
      return;
    }
    setStep({ kind: "phrase", index, recording: true });
    stopTimer.current = setTimeout(() => void stop(index), LONGEST_MS);
  };

  if (step.kind === "loading") return null;

  return (
    <div className="panel-voice">
      {step.kind === "none" ? (
        <>
          <p className="copy-13">
            Teach Tandrix your voice and it answers &ldquo;Hey Tandrix&rdquo; only from you, not the
            TV or other people. It takes three short phrases.
          </p>
          <Button
            variant="secondary"
            disabled={!listening}
            onClick={() => setStep({ kind: "phrase", index: 0, recording: false })}
          >
            Teach Tandrix my voice
          </Button>
        </>
      ) : null}

      {step.kind === "phrase" ? (
        <>
          <p className="copy-12 panel-muted">
            Phrase {step.index + 1} of {PHRASES.length}. Say it the way you normally would.
          </p>
          <p className="panel-voice-phrase">&ldquo;{PHRASES[step.index]}&rdquo;</p>
          {step.note ? <Notice tone="attention">{step.note}</Notice> : null}
          <div className="panel-offer-actions">
            {step.recording ? (
              <Button variant="primary" onClick={() => void stop(step.index)}>
                <span className="panel-voice-dot" aria-hidden="true" />
                Listening… tap when done
              </Button>
            ) : (
              <Button variant="primary" onClick={() => void record(step.index)}>
                Record
              </Button>
            )}
            <Button variant="secondary" disabled={step.recording} onClick={() => void refresh()}>
              Cancel
            </Button>
          </div>
        </>
      ) : null}

      {step.kind === "known" ? (
        <>
          <Toggle
            label="Only answer my voice"
            checked={step.onlyMine}
            onChange={(on) => {
              setStep({ kind: "known", onlyMine: on });
              void voice.setOnlyMyVoice(on);
            }}
          />
          {ignored ? (
            <p className="copy-12 panel-muted">
              Heard someone else say Tandrix, so I stayed quiet.
            </p>
          ) : null}
          <p className="copy-12 panel-muted">
            Your voiceprint stays on this Mac. If it misses you, say &ldquo;Hey Tandrix&rdquo; again
            or hold {"⌥⌘"}.{" "}
            <button type="button" className="panel-link" onClick={() => setDeleting(true)}>
              Delete my voice
            </button>
          </p>
        </>
      ) : null}

      {deleting ? (
        <ConfirmDialog
          title="Delete your voice?"
          lead="Tandrix will answer anyone who says its name again. You can teach it your voice later."
          tone="danger"
          confirmLabel="Delete"
          cancelLabel="Keep"
          onConfirm={() => {
            setDeleting(false);
            void voice.deleteVoice().then(refresh);
          }}
          onCancel={() => setDeleting(false)}
        />
      ) : null}
    </div>
  );
}
