import { Button, Input, Notice, VoiceTranscript } from "@tandrix/ui/web";
import { useState, type FormEvent } from "react";
import { ASK_KEYS } from "../../shared/bridge";
import { useShowMe } from "../lib/use-show-me";

export function ShowMe({ jobId }: { jobId: string }) {
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
        <h2 className="heading-14" id="show-me-title">
          Show me
        </h2>
        <p className="copy-13 panel-muted">
          Ask how to do something in the app you're in. Tandrix points at it and tells you. Press{" "}
          <kbd className="panel-kbd">{ASK_KEYS}</kbd> to ask out loud, and again to send.
        </p>
      </header>
      {s.problem ? <Notice tone="error">{s.problem}</Notice> : null}
      <VoiceTranscript
        state={s.phase}
        turns={s.turns}
        listeningLabel={`Listening. Press ${ASK_KEYS} to ask, or Esc to cancel.`}
      />
      <form className="panel-stack-2" onSubmit={submit} noValidate>
        <div className="panel-ask">
          <Input
            label="Your question"
            value={question}
            onChange={setQuestion}
            placeholder="How do I change the ramp time?"
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
        <Button type="submit" variant="primary" block disabled={busy || !question.trim()}>
          {s.phase === "working" ? "Looking…" : "Show me"}
        </Button>
      </form>
    </section>
  );
}
