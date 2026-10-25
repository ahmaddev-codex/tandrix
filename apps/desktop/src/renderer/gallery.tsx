// Local-only gallery of the web components the Mac app uses, in every theme. Served by the dev
// server at /gallery.html (open it in a browser); not part of the built app.
import "@tandrix/ui/tokens.css";
import "@tandrix/ui/web/styles.css";
import "./fonts.css";
import "./gallery.css";
import type { ReactNode } from "react";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import type { StepStatus } from "@tandrix/ui";
import {
  Button,
  CheckResult,
  ConfirmDialog,
  ControlIndicator,
  doItForMeConfirmation,
  HandoffBanner,
  Input,
  JobReport,
  ModeToggle,
  Notice,
  PointerBuddy,
  SourceChip,
  StatusChip,
  StepRow,
  Tabs,
  Toggle,
} from "@tandrix/ui/web";

const themes = ["light", "dark", "sunlight"] as const;
const statuses: StepStatus[] = [
  "verified",
  "confirmed",
  "attention",
  "unverifiable",
  "blocked",
  "pending",
  "progress",
];

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="gallery-section">
      <h2 className="label-13 gallery-muted">{title}</h2>
      {children}
    </section>
  );
}

function Components() {
  return (
    <>
      <Section title="Button">
        <div className="gallery-row">
          <Button variant="primary">Check my work</Button>
          <Button>Test the pointer</Button>
          <Button variant="tertiary">Sign out</Button>
          <Button variant="danger">Stop</Button>
          <Button variant="mandatory">Confirm isolated</Button>
          <Button variant="primary" disabled>
            Sending…
          </Button>
        </div>
      </Section>
      <Section title="StatusChip">
        <div className="gallery-row">
          {statuses.map((s) => (
            <StatusChip key={s} status={s} />
          ))}
        </div>
      </Section>
      <Section title="SourceChip">
        <div className="gallery-row">
          <SourceChip>Manual p.14, fig. 3</SourceChip>
          <SourceChip kind="expert">Expert 02:14</SourceChip>
          <SourceChip kind="screen">Screen 10:52</SourceChip>
          <SourceChip kind="photo">Photo 10:46</SourceChip>
          <SourceChip kind="generic" />
        </div>
      </Section>
      <Section title="Notice">
        <Notice>No job in progress. Start one on your phone and it shows up here.</Notice>
        <Notice tone="info">Read from the nameplate. Check the details, then save.</Notice>
        <Notice
          tone="attention"
          title="Tandrix can't see your screen yet"
          action={<Button variant="primary">Allow screen access</Button>}
        >
          Allow screen recording so Tandrix can see the app you're in and point at the right
          control.
        </Notice>
        <Notice tone="error">Can't reach Tandrix. Check your connection and try again.</Notice>
      </Section>
      <Section title="StepRow">
        <StepRow
          index={1}
          title="Isolate and drain the pump"
          status="confirmed"
          source="Manual p.3"
        />
        <StepRow index={2} title="Fit the mechanical seal" statusLabel="To do" />
        <StepRow
          index={5}
          title="Set the VFD ramp time"
          status="progress"
          sourceKind="screen"
          source="Manual p.22"
        />
      </Section>
      <Section title="Input, Toggle, Tabs">
        <Input label="Email" type="email" placeholder="name@company.com" />
        <Input
          label="Code"
          mono
          placeholder="123456"
          error="That code didn't work. Check it, or ask for a new one."
        />
        <Toggle
          label="Speak answers"
          description="Read replies aloud as well as showing them."
          defaultChecked
        />
        <Tabs
          label="Step"
          items={[
            { id: "task", label: "Task" },
            { id: "evidence", label: "Evidence" },
            { id: "assistant", label: "Assistant" },
          ]}
          defaultValue="task"
        />
      </Section>
      <Section title="ModeToggle, ControlIndicator, ConfirmDialog">
        <ModeToggle mode="show" />
        <ModeToggle mode="do" />
        <div className="gallery-row">
          <ControlIndicator />
        </div>
        <ConfirmDialog {...doItForMeConfirmation} />
      </Section>
      <Section title="HandoffBanner, CheckResult">
        <HandoffBanner
          state="incoming"
          step={5}
          job="Pump P-101"
          stepTitle="Set the VFD ramp time"
          device="iPhone"
        />
        <CheckResult
          result="pass"
          reason="The ramp time reads 10 s, as the manual asks."
          evidence="Screen 10:52"
        />
        <CheckResult
          result="not_verifiable"
          reason="A screenshot can't show the motor's actual speed."
        />
      </Section>
      <Section title="PointerBuddy">
        <div className="gallery-pointer">
          <PointerBuddy x={24} y={16} caption="Click Ramp time" />
        </div>
      </Section>
      <Section title="JobReport">
        <JobReport
          title="Pump P-101 seal replacement"
          meta="25 Oct 2026, 4 steps"
          counts={{ verified: 2, confirmed: 1, attention: 1 }}
          steps={[
            {
              index: 1,
              title: "Isolate and drain the pump",
              status: "confirmed",
              source: "Manual p.3",
              time: "09:12",
            },
            {
              index: 2,
              title: "Fit the mechanical seal",
              status: "verified",
              source: "Manual p.8",
              time: "09:40",
            },
            {
              index: 3,
              title: "Torque the casing bolts",
              status: "attention",
              sourceKind: "generic",
              time: "10:02",
            },
          ]}
        />
      </Section>
    </>
  );
}

function Gallery() {
  return (
    <main className="gallery">
      {themes.map((theme) => (
        <div key={theme} data-theme={theme} className="gallery-theme">
          <h1 className="heading-16">{theme}</h1>
          <Components />
        </div>
      ))}
    </main>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Gallery />
  </StrictMode>,
);
