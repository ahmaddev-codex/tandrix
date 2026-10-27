import { Button, Input, Notice, VoiceTranscript } from "@tandrix/ui/web";
import { useState, type FormEvent } from "react";
import { TALK_KEYS } from "../../shared/bridge";
import { useShowMe } from "../lib/use-show-me";

const examples = [
  "How do I add a layer mask in Photoshop?",
  "Where do I change my Wi-Fi password?",
  "How do I make a pivot table here?",
];

/** Ask about whatever is on screen. Inside a job, the screenshot is kept as its evidence. */
export function ShowMe({ jobId }: { jobId?: string }) {
  const s = useShowMe(jobId);
  const [question, setQuestion] = useState("");
  const busy = s.phase !== "idle";

  const submit = (e: FormEvent) => {
    e.preventDefault();
    s.ask(question);
    setQuestion("");
  };

  return (
    <section className="panel-stack-4" aria-labelledby="show-me-title">
      <header className="panel-stack-1">
        <h2 className="heading-16" id="show-me-title">
          Ask about your screen
        </h2>
        <p className="copy-13 panel-muted">
          Tandrix points at the control and tells you what to do. In any app, hold{" "}
          <kbd className="panel-kbd">{TALK_KEYS}</kbd>, ask out loud, and let go.
        </p>
      </header>
      {s.problem ? <Notice tone="error">{s.problem}</Notice> : null}
      <VoiceTranscript
        state={s.phase}
        turns={s.turns}
        listeningLabel="Listening. Let go to ask, or press Esc to cancel."
      />
      <form className="panel-stack-2" onSubmit={submit} noValidate>
        <div className="panel-ask">
          <Input
            label="Your question"
            value={question}
            onChange={setQuestion}
            placeholder="How do I…?"
            disabled={busy}
          />
          <Button
            iconOnly
            icon="mic"
            aria-label="Hold to talk"
            aria-pressed={s.phase === "listening"}
            disabled={s.phase === "working"}
            onPointerDown={() => void s.press()}
            onPointerUp={s.release}
            onPointerLeave={s.release}
          />
        </div>
        {!s.turns.length && !question ? (
          <div className="ask-examples" aria-label="Examples">
            {examples.map((e) => (
              <Button key={e} size="sm" onClick={() => setQuestion(e)}>
                {e}
              </Button>
            ))}
          </div>
        ) : null}
        <Button type="submit" variant="primary" block disabled={busy || !question.trim()}>
          {s.phase === "working" ? "Looking…" : "Show me"}
        </Button>
      </form>
    </section>
  );
}
