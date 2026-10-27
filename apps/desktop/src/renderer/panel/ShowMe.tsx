import {
  Button,
  ConfirmDialog,
  doItForMeConfirmation,
  Input,
  ModeToggle,
  Notice,
  VoiceTranscript,
} from "@tandrix/ui/web";
import { useState, type FormEvent } from "react";
import { TALK_KEYS } from "../../shared/bridge";
import { useShowMe } from "../lib/use-show-me";

const examples = [
  "Add a layer mask in Photoshop",
  "Change my Wi-Fi password",
  "Make a pivot table",
];
/** Do it for me takes tasks, not questions. */
const tasks = [
  "Turn on Calendar notifications",
  "Make this window full screen",
  "Sort this table by date",
];

/** Ask about whatever is on screen. Inside a job, the screenshot is kept as its evidence. */
export function ShowMe({ jobId }: { jobId?: string }) {
  const s = useShowMe(jobId);
  const [question, setQuestion] = useState("");
  // Turning on Do it for me asks first (design system: ModeToggle).
  const [confirming, setConfirming] = useState(false);
  const busy = s.phase !== "idle";
  const doing = s.mode === "do";

  const submit = (e: FormEvent) => {
    e.preventDefault();
    s.ask(question);
    setQuestion("");
  };

  return (
    <section className="panel-stack-4" aria-labelledby="show-me-title">
      <header className="panel-stack-1">
        <h2 className="heading-16" id="show-me-title">
          {doing ? "What should Tandrix do?" : "What do you need help with?"}
        </h2>
        <p className="copy-13 panel-muted">
          {doing
            ? "Describe one task. Tandrix shows each action and asks before anything that sends, pays or deletes. "
            : "Ask about the app in front of you. Tandrix points to the control and explains what to do. "}
          Type below, or hold <kbd className="panel-kbd">{TALK_KEYS}</kbd> anywhere to talk.
        </p>
      </header>
      <ModeToggle
        mode={s.mode}
        onChange={(next) => (next === "do" ? setConfirming(true) : void s.setMode("show"))}
      />
      {confirming ? (
        <ConfirmDialog
          {...doItForMeConfirmation}
          onConfirm={() => {
            setConfirming(false);
            void s.setMode("do");
          }}
          onCancel={() => setConfirming(false)}
        />
      ) : null}
      {s.problem ? <Notice tone="error">{s.problem}</Notice> : null}
      <VoiceTranscript
        state={s.phase}
        turns={s.turns}
        listeningLabel="Listening. Let go to ask, or press Esc to cancel."
      />
      <form className="panel-stack-2" onSubmit={submit} noValidate>
        <div className="panel-ask">
          <Input
            label={doing ? "Task" : "Question"}
            value={question}
            onChange={setQuestion}
            placeholder={doing ? "What would you like done?" : "What are you trying to do?"}
            disabled={busy}
          />
          <Button
            icon="mic"
            size="sm"
            aria-label="Hold to talk"
            aria-pressed={s.phase === "listening"}
            disabled={s.phase === "working"}
            onPointerDown={() => void s.press()}
            onPointerUp={s.release}
            onPointerLeave={s.release}
          >
            Hold to talk
          </Button>
        </div>
        {!s.turns.length && !question ? (
          <div className="ask-examples" aria-label="Examples">
            {(doing ? tasks : examples).map((e) => (
              <Button key={e} size="sm" onClick={() => setQuestion(e)}>
                {e}
              </Button>
            ))}
          </div>
        ) : null}
        <Button type="submit" variant="primary" block disabled={busy || !question.trim()}>
          {s.phase === "working" ? (doing ? "Working…" : "Looking…") : doing ? "Do it" : "Show me"}
        </Button>
      </form>
    </section>
  );
}
