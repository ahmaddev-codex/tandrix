import {
  Button,
  ConfirmDialog,
  doItForMeConfirmation,
  Input,
  Notice,
  Toggle,
} from "@tandrix/ui/web";
import { useState, type FormEvent } from "react";
import { TALK_KEYS } from "../../shared/bridge";
import type { AgentTask } from "../lib/agents";
import { useShowMe } from "../lib/use-show-me";
import { VoiceSetup } from "./VoiceSetup";

const examples = [
  "Where's the export button?",
  "Add bread to my shopping note",
  "Research the best standing desks under $500",
];

const statusLabel: Record<AgentTask["status"], string> = {
  queued: "Up next",
  running: "Working",
  done: "Done",
  stopped: "Stopped",
  stuck: "Needs you",
  failed: "Couldn't finish",
};

/**
 * Ask anything. Tandrix shows the way, offers to do it, or works on it in the background, and you
 * can keep handing it tasks while it works.
 */
export function ShowMe({ jobId }: { jobId?: string }) {
  const s = useShowMe(jobId);
  const [question, setQuestion] = useState("");
  // Doing things without asking first is opt-in, and asks once (design system: Do it for me).
  const [confirming, setConfirming] = useState(false);
  const working = s.agents.some((a) => a.status === "running" || a.status === "queued");
  const finished = s.agents.some((a) => a.status !== "running" && a.status !== "queued");

  const submit = (e: FormEvent) => {
    e.preventDefault();
    s.ask(question);
    setQuestion("");
  };

  return (
    <section className="panel-stack-4" aria-labelledby="show-me-title">
      <header className="panel-stack-1">
        <h2 className="heading-16" id="show-me-title">
          What can I help with?
        </h2>
        <p className="copy-13 panel-muted">
          Ask about anything on screen, or tell me what you want done. I&rsquo;ll show you, offer to
          do it, or work on it in the background. Hold <kbd className="panel-kbd">{TALK_KEYS}</kbd>{" "}
          to talk, or type below.
        </p>
      </header>

      {s.offer ? (
        <div className="panel-offer" role="group" aria-label="Tandrix offers to do this">
          <p className="copy-13">
            Want me to do it? <span className="panel-muted">&ldquo;{s.offer}&rdquo;</span>
          </p>
          <div className="panel-offer-actions">
            <Button size="sm" variant="primary" onClick={s.acceptOffer}>
              Yes, do it
            </Button>
            <Button size="sm" onClick={s.declineOffer}>
              Just show me
            </Button>
          </div>
        </div>
      ) : null}

      {s.agents.length ? (
        <div className="panel-stack-2" aria-label="Tasks">
          <ul className="panel-agents">
            {s.agents.map((a) => (
              <li key={a.id} data-status={a.status}>
                <span className="panel-agent-dot" aria-hidden="true" />
                <span className="panel-agent-main">
                  <span className="panel-agent-task">{a.task}</span>
                  <span className="panel-agent-meta">
                    {a.kind === "background" ? "In the background" : "On your screen"} ·{" "}
                    {statusLabel[a.status]}
                  </span>
                  {a.result && a.status !== "running" ? (
                    <span className="panel-agent-result">{a.result}</span>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
          {finished ? (
            <Button size="sm" variant="tertiary" onClick={s.clearFinished}>
              Clear finished
            </Button>
          ) : null}
        </div>
      ) : null}

      {s.problem ? <Notice tone="error">{s.problem}</Notice> : null}

      <form className="panel-stack-2" onSubmit={submit} noValidate>
        <div className="panel-ask">
          <Input
            label={working ? "Another task, or a correction" : "Ask or tell Tandrix"}
            value={question}
            onChange={setQuestion}
            placeholder={
              working ? "Add a task, or say what to change…" : "What do you want to get done?"
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
        {!s.turns.length && !question && !s.agents.length ? (
          <div className="ask-examples" aria-label="Examples">
            {examples.map((e) => (
              <Button key={e} size="sm" onClick={() => setQuestion(e)}>
                {e}
              </Button>
            ))}
          </div>
        ) : null}
        <Button
          type="submit"
          variant="primary"
          block
          disabled={s.phase === "listening" || !question.trim()}
        >
          {s.phase === "listening" ? "Listening…" : working ? "Add it" : "Go"}
        </Button>
      </form>

      <Toggle
        label="Always do things without asking first"
        checked={s.mode === "do"}
        onChange={(on) => (on ? setConfirming(true) : void s.setMode("show"))}
      />
      <Toggle label='Wake word ("Hey Tandrix")' checked={s.wakeWord} onChange={s.setWakeWord} />
      {s.wakeWord && s.wakeStatus.status === "unavailable" ? (
        <Notice tone="attention">
          {s.wakeStatus.message ?? "The wake word can't listen right now."}
        </Notice>
      ) : s.wakeWord ? (
        <>
          <p className="copy-12 panel-muted">
            Heard on this Mac only. Nothing leaves it until you say Tandrix&rsquo;s name.
          </p>
          <VoiceSetup listening={s.wakeStatus.status === "listening"} />
        </>
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
    </section>
  );
}
