import type { JobDetailResponse } from "@tandrix/contracts";
import { citationLabel, stepChip } from "@tandrix/ui";
import { Button, Notice, StepRow } from "@tandrix/ui/web";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import type { ScreenAccess } from "../../shared/bridge";
import { activeJob } from "../lib/active-job";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { ShowMe } from "./ShowMe";

type JobState =
  | { kind: "loading" }
  | { kind: "none" }
  | { kind: "error"; message: string }
  | { kind: "ready"; detail: JobDetailResponse };

/** Reruns `fn` whenever the panel is opened again. */
function useOnPanelOpen(fn: () => void) {
  useEffect(() => {
    fn();
    window.addEventListener("focus", fn);
    return () => window.removeEventListener("focus", fn);
  }, [fn]);
}

function ScreenAccessNotice() {
  const [access, setAccess] = useState<ScreenAccess>();
  const refresh = useCallback(() => {
    void window.tandrix.screen.access().then(setAccess);
  }, []);
  useOnPanelOpen(refresh);

  if (!access || access === "granted") return null;
  const firstAsk = access === "not-determined";
  return (
    <Notice
      tone="attention"
      title="Tandrix can't see your screen yet"
      action={
        <Button
          variant="primary"
          onClick={() => void window.tandrix.screen.openSettings().then(refresh)}
        >
          {firstAsk ? "Allow screen access" : "Open System Settings"}
        </Button>
      }
    >
      {firstAsk
        ? "Allow screen recording so Tandrix can see the app you're in and point at the right control."
        : "Turn on Tandrix under Screen Recording in System Settings, then reopen Tandrix."}
    </Notice>
  );
}

function JobSteps({ detail, children }: { detail: JobDetailResponse; children?: ReactNode }) {
  const { job, asset, procedure, steps } = detail;
  return (
    <section className="panel-stack-6" aria-labelledby="job-title">
      <header className="panel-stack-1">
        <p className="label-13 panel-muted">Active job</p>
        <h2 className="heading-20" id="job-title">
          {job.title}
        </h2>
        {asset ? (
          <p className="copy-14 panel-muted">
            {asset.make} {asset.model}
          </p>
        ) : null}
      </header>
      {children}
      {procedure ? (
        <div className="panel-stack-2">
          <p className="label-14 panel-muted">
            {procedure.steps.length} {procedure.steps.length === 1 ? "step" : "steps"}
          </p>
          <ol className="panel-steps">
            {procedure.steps.map((step) => {
              const js = steps.find((s) => s.procedureStepId === step.id);
              const chip = stepChip[js?.status ?? "todo"];
              const cite = citationLabel(step.citation);
              const label = js?.status === "blocked" && js.note ? js.note : chip.label;
              return (
                <li key={step.id}>
                  <StepRow
                    index={step.order}
                    title={step.title}
                    status={chip.status}
                    {...(label ? { statusLabel: label } : {})}
                    {...(cite ? { source: cite } : {})}
                  />
                </li>
              );
            })}
          </ol>
        </div>
      ) : (
        <Notice>This job has no steps yet. Write them on your phone and they show up here.</Notice>
      )}
    </section>
  );
}

export function Home() {
  const auth = useAuth();
  const [state, setState] = useState<JobState>({ kind: "loading" });

  const load = useCallback(() => {
    void (async () => {
      try {
        const job = activeJob(await api.listJobs());
        setState(job ? { kind: "ready", detail: await api.getJob(job.id) } : { kind: "none" });
      } catch (e) {
        setState({ kind: "error", message: (e as Error).message });
      }
    })();
  }, []);
  useOnPanelOpen(load);

  return (
    <main className="panel-page">
      <header className="panel-bar">
        <h1 className="heading-16">Tandrix</h1>
        <Button variant="tertiary" size="sm" onClick={() => void auth.signOut()}>
          Sign out
        </Button>
      </header>
      <div className="panel-body panel-stack-6">
        <ScreenAccessNotice />
        {state.kind === "loading" ? (
          <p className="copy-14 panel-muted" role="status">
            Loading your job…
          </p>
        ) : state.kind === "error" ? (
          <Notice
            tone="error"
            action={
              <Button variant="secondary" onClick={load}>
                Try again
              </Button>
            }
          >
            {state.message}
          </Notice>
        ) : state.kind === "none" ? (
          <Notice>No job in progress. Start one on your phone and it shows up here.</Notice>
        ) : (
          <JobSteps detail={state.detail}>
            <ShowMe jobId={state.detail.job.id} />
          </JobSteps>
        )}
      </div>
      <footer className="panel-foot">
        <Button
          variant="secondary"
          icon="pointer"
          onClick={() => void window.tandrix.overlay.testPointer()}
        >
          Test the pointer
        </Button>
      </footer>
    </main>
  );
}
