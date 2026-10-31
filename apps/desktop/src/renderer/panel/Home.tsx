import type { JobDetailResponse } from "@tandrix/contracts";
import { citationLabel, stepChip } from "@tandrix/ui";
import { BrandMark, Button, HandoffBanner, Icon, Input, Notice, StepRow } from "@tandrix/ui/web";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { TALK_KEYS, type ScreenAccess } from "../../shared/bridge";
import { activeJob } from "../lib/active-job";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { desktopStep, finished, stepOf } from "../lib/desktop-step";
import { useHandoffsToMac, useJobChanges, type IncomingHandoff } from "../lib/realtime";
import { DesktopStep, type ScreenCheck } from "./DesktopStep";
import { Setup, useSetupStatus } from "./Setup";
import { Settings } from "./Settings";
import { StartProject } from "./StartProject";
import { ShowMe } from "./ShowMe";
import { useShowMe } from "../lib/use-show-me";

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
        <p className="label-12 panel-muted">From your phone</p>
        <h2 className="heading-16" id="job-title">
          {job.title}
        </h2>
        {asset ? (
          <p className="copy-13 panel-muted">
            {asset.make} {asset.model}
          </p>
        ) : null}
      </header>
      {children}
      {procedure ? (
        <div className="panel-stack-2">
          <p className="label-13 panel-muted">
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

/** What Tandrix calls the user, editable any time. Shared with the phone. */
function NameRow() {
  const [name, setName] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    api
      .getProfile()
      .then((p) => {
        setName(p.displayName);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);
  if (!loaded) return null;
  if (!editing) {
    return (
      <div className="name-row">
        <p className="copy-13 panel-muted">
          {name ? `Tandrix calls you ${name}.` : "Tandrix doesn't have a name for you yet."}
        </p>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            setDraft(name ?? "");
            setEditing(true);
          }}
        >
          {name ? "Change" : "Tell it"}
        </Button>
      </div>
    );
  }
  const save = () => {
    const displayName = draft.trim();
    if (!displayName) return;
    api
      .updateProfile({ displayName })
      .then((p) => {
        setName(p.displayName);
        setEditing(false);
      })
      .catch(() => undefined);
  };
  return (
    <div className="name-row">
      <Input label="What Tandrix calls you" value={draft} onChange={setDraft} />
      <Button variant="primary" size="sm" onClick={save} disabled={!draft.trim()}>
        Save
      </Button>
      <Button variant="tertiary" size="sm" onClick={() => setEditing(false)}>
        Cancel
      </Button>
    </div>
  );
}

function CurrentDesktopStep({
  detail,
  onChanged,
}: {
  detail: JobDetailResponse;
  onChanged: () => void;
}) {
  const [lastCheck, setLastCheck] = useState<ScreenCheck>();
  return (
    <DesktopStep
      jobId={detail.job.id}
      current={desktopStep(detail)}
      lastCheck={lastCheck}
      onChecked={setLastCheck}
      onChanged={onChanged}
    />
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

  // Changes made on the phone show up here as they happen.
  useJobChanges(state.kind === "ready" ? state.detail.job.id : undefined, load);

  // The phone sent a job here: open it, tell the user, and offer its step.
  const [incoming, setIncoming] = useState<IncomingHandoff>();
  useHandoffsToMac(auth.session!.user.id, (h) => {
    void (async () => {
      try {
        const detail = await api.getJob(h.jobId);
        setState({ kind: "ready", detail });
        setIncoming(h);
        const step = stepOf(detail, h.jobStepId);
        void window.tandrix.panel.notify(
          step
            ? `${detail.job.title}: step ${step.order} is ready`
            : `${detail.job.title} is ready`,
          `Sent from your ${h.from}${step ? `. ${step.title}` : "."}`,
        );
      } catch {
        // The next change or panel open loads it anyway.
      }
    })();
  });
  // Shown until opened, or until the step is finished (on whichever device).
  const handedStep =
    incoming && state.kind === "ready" && state.detail.job.id === incoming.jobId
      ? state.detail.steps.find((s) => s.id === incoming.jobStepId)
      : undefined;
  const banner =
    incoming && state.kind === "ready" && handedStep && !finished.has(handedStep.status)
      ? { h: incoming, step: stepOf(state.detail, incoming.jobStepId), job: state.detail.job }
      : undefined;

  const setup = useSetupStatus();
  // The Mac shows a job only when the phone has sent it here; otherwise it's for asking.
  const onMac =
    state.kind === "ready" && state.detail.job.activeSurface === "desktop"
      ? state.detail
      : undefined;
  // One assistant for the panel: Settings reads and changes it, and opening Settings never stops
  // a task that's running.
  const showMe = useShowMe(onMac?.job.id);
  const [view, setView] = useState<"home" | "settings">("home");

  return (
    <>
      {view === "settings" ? (
        <Settings
          s={showMe}
          name={<NameRow />}
          onBack={() => {
            setView("home");
            window.scrollTo(0, 0);
          }}
        />
      ) : null}
      {/* The main page stays mounted (just hidden) while Settings is open, so nothing in progress
          is lost. */}
      <main className="panel-page" hidden={view === "settings"}>
        {/* The sky header, as on the website: the mark, and that Tandrix is ready. */}
        <header className="panel-sky">
          <div className="panel-sky-row">
            <h1 className="panel-brand">
              <BrandMark size={26} />
              Tandrix
            </h1>
            <button
              type="button"
              className="panel-glass panel-glass-icon"
              aria-label="Settings"
              onClick={() => {
                setView("settings");
                window.scrollTo(0, 0);
              }}
            >
              <Icon name="gear" size={16} />
            </button>
          </div>
          <p className="panel-ready">
            <span className="panel-ready-dot" aria-hidden="true" />
            Ready. Hold <kbd>{TALK_KEYS}</kbd> to talk.
          </p>
        </header>
        {/* Kept mounted (just hidden) while Settings is open, so nothing in progress is lost. */}
        <div className="panel-body panel-stack-6">
          {banner?.step ? (
            <HandoffBanner
              state="incoming"
              step={banner.step.order}
              stepTitle={banner.step.title}
              job={banner.job.title}
              device={`your ${banner.h.from}`}
              onAction={() => {
                setIncoming(undefined);
                document.getElementById("desktop-step")?.scrollIntoView({ behavior: "smooth" });
              }}
            />
          ) : null}
          {setup.show ? <Setup status={setup} /> : <ScreenAccessNotice />}
          {state.kind === "error" ? (
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
          ) : null}
          {onMac ? (
            // A project from the phone, continued here: its step, then asking, then its steps.
            <JobSteps detail={onMac}>
              <CurrentDesktopStep key={onMac.job.id} detail={onMac} onChanged={load} />
              <ShowMe s={showMe} />
            </JobSteps>
          ) : (
            <>
              <ShowMe s={showMe} />
              {state.kind === "ready" || state.kind === "none" ? (
                <StartProject onCreated={load} />
              ) : null}
            </>
          )}
        </div>
      </main>
    </>
  );
}
