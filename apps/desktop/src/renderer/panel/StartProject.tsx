// A project on this Mac: say what you want to learn or get done in software, and Tandrix writes
// the steps. Each step then has Show me and a screen check (DesktopStep), and progress is kept like
// any project, so it carries on later or on the phone.
import { nextPhrase } from "@tandrix/core";
import { Button, Input, Notice } from "@tandrix/ui/web";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { api } from "../lib/api";

/** What the steps are for: done on screen, and checked from a screenshot. */
const ON_THIS_MAC =
  "Done on this Mac, in apps and websites: each step is one thing to do on screen, checked from a screenshot.";

export function StartProject({ onCreated }: { onCreated: () => void }) {
  const [goal, setGoal] = useState("");
  const [busy, setBusy] = useState(false);
  const [phrase, setPhrase] = useState("Planning the steps");
  const [problem, setProblem] = useState<string>();
  const recent = useRef<string[]>([]);

  useEffect(() => {
    if (!busy) return;
    const timer = setInterval(() => {
      const p = nextPhrase(`${goal} steps procedure`, recent.current);
      recent.current = [...recent.current, p].slice(-8);
      setPhrase(p);
    }, 2200);
    return () => clearInterval(timer);
  }, [busy, goal]);

  const start = async (e: FormEvent) => {
    e.preventDefault();
    const task = goal.trim();
    if (task.length < 4) return setProblem("Say what you want to learn or get done.");
    setProblem(undefined);
    setBusy(true);
    try {
      const job = await api.createJob(task.slice(0, 160));
      const r = await api.generateProcedure(job.id, {
        task: task.slice(0, 300),
        allowGeneric: true,
        notes: ON_THIS_MAC,
      });
      if (r.status !== "created") return setProblem(r.message);
      setGoal("");
      onCreated();
    } catch (err) {
      setProblem((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="panel-stack-4" aria-labelledby="start-project-title">
      <header className="panel-stack-1">
        <h2 className="heading-16" id="start-project-title">
          Learn it step by step
        </h2>
        <p className="copy-13 panel-muted">
          For something bigger, Tandrix writes the steps and stays with you through each one: it
          shows you where, checks your screen and keeps your place.
        </p>
      </header>
      {busy ? (
        <ul className="panel-agents" aria-live="polite">
          <li data-status="running">
            <span className="panel-agent-dot" aria-hidden="true" />
            <span className="panel-agent-main">
              <span className="panel-agent-task">{goal}</span>
              <span className="panel-agent-meta">{phrase}</span>
            </span>
          </li>
        </ul>
      ) : (
        <form className="panel-stack-2" onSubmit={start} noValidate>
          <Input
            label="What do you want to learn or get done?"
            value={goal}
            onChange={setGoal}
            placeholder="Make a pivot table of my budget in Numbers"
          />
          <Button type="submit" variant="primary">
            Write the steps
          </Button>
        </form>
      )}
      {problem ? <Notice tone="error">{problem}</Notice> : null}
    </section>
  );
}
