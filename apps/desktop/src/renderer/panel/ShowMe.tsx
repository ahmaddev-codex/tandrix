import {
  Button,
  ConfirmDialog,
  doItForMeConfirmation,
  Input,
  ModeToggle,
  Notice,
  Toggle,
} from "@tandrix/ui/web";
import { useState, type FormEvent } from "react";
import { TALK_KEYS } from "../../shared/bridge";
import { useShowMe } from "../lib/use-show-me";

const examples = [
  "Find setup instructions for my espresso machine",
  "Teach me how to remove a background in Photoshop",
  "Look up info on this page and summarize it",
];
/** Do it for me takes tasks across one or multiple apps. */
const tasks = [
  "Open Safari, find the manual, and save notes in Notes",
  "Turn on Calendar notifications",
  "Sort this spreadsheet table by date",
];

/** Ask about whatever is on screen or give Tandrix a goal. You can queue tasks while it works. */
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
          {doing ? "What should Tandrix do for you?" : "What goal are you working on?"}
        </h2>
        <p className="copy-13 panel-muted">
          {doing
            ? "Give Tandrix any goal across your apps. It opens what it needs, shows each step, and lets you queue another task while it works. "
            : "Ask about any app, webpage, or product in front of you. Tandrix points to the exact spot and voices the answer aloud. "}
          Say <strong>&ldquo;Wake up Tandrix&rdquo;</strong>, hold{" "}
          <kbd className="panel-kbd">{TALK_KEYS}</kbd>, or type below.
        </p>
      </header>
      <ModeToggle
        mode={s.mode}
        onChange={(next) => (next === "do" ? setConfirming(true) : void s.setMode("show"))}
      />
      <Toggle label='Wake word ("Hey Tandrix")' checked={s.wakeWord} onChange={s.setWakeWord} />
      {s.wakeWord && s.wakeStatus.status === "unavailable" ? (
        <Notice tone="attention">
          {s.wakeStatus.message ?? "The wake word can't listen right now."}
        </Notice>
      ) : s.wakeWord ? (
        <p className="copy-12 panel-muted">
          Heard on this Mac only. Nothing leaves it until you say Tandrix&rsquo;s name.
        </p>
      ) : null}
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
      {s.queued.length > 0 ? (
        <Notice tone="info">
          {s.queued.length === 1
            ? `1 follow-up task queued: "${s.queued[0]}"`
            : `${s.queued.length} follow-up tasks queued next.`}
        </Notice>
      ) : null}
      <form className="panel-stack-2" onSubmit={submit} noValidate>
        <div className="panel-ask">
          <Input
            label={busy ? "Next task (queued while working)" : doing ? "Task" : "Goal or question"}
            value={question}
            onChange={setQuestion}
            placeholder={
              busy
                ? "Give Tandrix another task while it works…"
                : doing
                  ? "What would you like done?"
                  : "What are you trying to do?"
            }
            disabled={s.phase === "listening"}
          />
          <Button
            icon="mic"
            size="sm"
            variant={s.phase === "listening" ? "ring" : "secondary"}
            aria-label="Hold to talk"
            aria-pressed={s.phase === "listening"}
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
        <Button
          type="submit"
          variant={doing ? "ring" : "primary"}
          block
          disabled={s.phase === "listening" || !question.trim()}
        >
          {s.phase === "working"
            ? "Queue next task"
            : s.phase === "listening"
              ? "Listening…"
              : doing
                ? "Do it"
                : "Show me"}
        </Button>
      </form>
    </section>
  );
}
