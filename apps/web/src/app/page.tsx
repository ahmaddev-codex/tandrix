import {
  CheckResult,
  HandoffBanner,
  Icon,
  JobReport,
  StatusChip,
  StepRow,
  VoiceTranscript,
} from "@tandrix/ui/web";
import type { IconName } from "@tandrix/ui";
import { PhoneMock } from "../components/PhoneMock";
import { ScreenMock } from "../components/ScreenMock";
import styles from "./page.module.css";

const phoneSteps: Array<{ title: string; body: string }> = [
  {
    title: "Say what you're doing",
    body: "One sentence is enough: assemble a 12U home server rack, replace the seal on a pump. Scan a nameplate if there's equipment, and Tandrix finds its manual.",
  },
  {
    title: "Get steps you can check",
    body: "Every step cites the manual page it came from. Steps without a source are labelled Generic, so you always know what you're trusting.",
  },
  {
    title: "See it on the real thing",
    body: "Point the camera at the work. Tandrix marks the part the step is about, on your own photo.",
  },
  {
    title: "Prove it's done",
    body: "Take a photo when you finish a step. Tandrix says whether it looks right and why, and says so plainly when a photo can't show it.",
  },
];

const macPoints: Array<{ icon: IconName; title: string; body: string }> = [
  {
    icon: "pointer",
    title: "Points at the control",
    body: "Ask how to do something in the app you're in. Tandrix looks at your screen and moves a pointer to what you need, with what to do next.",
  },
  {
    icon: "mic",
    title: "Ask out loud",
    body: "Press ⌃⌥Space anywhere, ask, press it again. The answer is spoken and shown.",
  },
  {
    icon: "eyeOff",
    title: "Keeps nothing it doesn't need",
    body: "A question outside a project is answered and forgotten: the screenshot isn't stored.",
  },
];

const safety: Array<{ icon: IconName; title: string; body: string }> = [
  {
    icon: "power",
    title: "Make it safe first",
    body: "Steps with a hazard wait for you to confirm the power is isolated, the pressure released or the parts cool.",
  },
  {
    icon: "stop",
    title: "Knows where to stop",
    body: "Tandrix won't guide live electrical, gas or refrigerant work, and says who should do it instead.",
  },
  {
    icon: "check",
    title: "Honest about checks",
    body: "Verified means a photo or screen check passed. You confirmed means you said so. They never look the same.",
  },
];

export default function Home() {
  return (
    <>
      <header className={styles.nav}>
        <div className={styles.navInner}>
          <a href="#top" className={styles.wordmark}>
            Tandrix
          </a>
          <nav aria-label="Sections" className={styles.navLinks}>
            <a href="#phone">Phone</a>
            <a href="#mac">Mac</a>
            <a href="#evidence">Evidence</a>
            <a href="#safety">Safety</a>
          </nav>
        </div>
      </header>

      <main id="top">
        <section className={styles.hero}>
          <div className={styles.heroText}>
            <h1 className={styles.headline}>An AI engineer for the work in front of you.</h1>
            <p className={styles.lead}>
              On your phone, Tandrix guides physical work step by step and checks it with a photo.
              On your Mac, it points at what to click in any app.
            </p>
            <div className={styles.actions}>
              <a href="#phone" className="tx-btn tx-btn-primary tx-btn-lg">
                See how it works
              </a>
              <a href="#safety" className="tx-btn tx-btn-tertiary tx-btn-lg">
                How it keeps you safe
              </a>
            </div>
          </div>
          <div className={styles.heroArt}>
            <div className={styles.heroScreen}>
              <ScreenMock />
            </div>
            <div className={styles.heroPhone}>
              <PhoneMock />
            </div>
          </div>
        </section>

        <section id="phone" className={styles.section}>
          <div className={styles.sectionHead}>
            <p className={styles.kicker}>
              <Icon name="phone" size={20} /> On your phone
            </p>
            <h2 className={styles.title}>Physical work, one checked step at a time.</h2>
          </div>
          <div className={styles.split}>
            <ol className={styles.steps}>
              {phoneSteps.map((s, i) => (
                <li key={s.title}>
                  <span className={styles.stepNo}>{i + 1}</span>
                  <div>
                    <h3 className={styles.itemTitle}>{s.title}</h3>
                    <p className={styles.itemBody}>{s.body}</p>
                  </div>
                </li>
              ))}
            </ol>
            <div className={styles.stack}>
              <StepRow
                index={1}
                title="Check every part is there"
                status="verified"
                source="Manual p.4"
              />
              <StepRow
                index={2}
                title="Fit the cage nuts"
                status="confirmed"
                source="Manual p.6, fig. 2"
              />
              <StepRow
                index={3}
                title="Fit the rails for the server"
                status="progress"
                source="Manual p.7"
              />
              <CheckResult
                result="pass"
                title="Step 1 looks right"
                reason="All 14 parts are laid out: rails, screws and cage nuts match the parts list."
                evidence="Photo 10:46"
              />
            </div>
          </div>
        </section>

        <section id="mac" className={styles.section}>
          <div className={styles.sectionHead}>
            <p className={styles.kicker}>
              <Icon name="laptop" size={20} /> On your Mac
            </p>
            <h2 className={styles.title}>Learn any app by being shown, not told.</h2>
          </div>
          <div className={styles.splitReverse}>
            <div className={styles.stack}>
              <ScreenMock caption="Click Add layer mask, then paint with black to hide" />
              <VoiceTranscript
                turns={[
                  { speaker: "you", text: "How do I hide part of this layer without erasing it?" },
                  {
                    speaker: "tandrix",
                    text: "Click Add layer mask at the bottom of the Layers panel, then paint with black where you want it hidden.",
                  },
                ]}
              />
            </div>
            <ul className={styles.points}>
              {macPoints.map((p) => (
                <li key={p.title}>
                  <Icon name={p.icon} size={20} />
                  <div>
                    <h3 className={styles.itemTitle}>{p.title}</h3>
                    <p className={styles.itemBody}>{p.body}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h2 className={styles.title}>When a project needs both, it moves with you.</h2>
            <p className={styles.sectionLead}>
              The rack is built; the server needs setting up. Send the step to your Mac and pick it
              up there, with the same project and the same record.
            </p>
          </div>
          <div className={styles.handoff}>
            <figure>
              <figcaption>Phone</figcaption>
              <HandoffBanner
                state="offer"
                step={6}
                stepTitle="Install the operating system"
                size="md"
              />
            </figure>
            <figure>
              <figcaption>Mac</figcaption>
              <HandoffBanner
                state="incoming"
                step={6}
                job="Home server rack"
                stepTitle="Install the operating system"
              />
            </figure>
          </div>
        </section>

        <section id="evidence" className={styles.section}>
          <div className={styles.sectionHead}>
            <h2 className={styles.title}>A record you can hand to someone.</h2>
            <p className={styles.sectionLead}>
              Every step keeps its source, its status and the photo or screenshot behind it. Share a
              read-only report with a link.
            </p>
          </div>
          <div className={styles.split}>
            <ul className={styles.legend}>
              <li>
                <StatusChip status="verified" />
                <span>A photo or screen check passed.</span>
              </li>
              <li>
                <StatusChip status="confirmed" />
                <span>You marked it done; no check could show it.</span>
              </li>
              <li>
                <StatusChip status="attention" />
                <span>A check found something to fix.</span>
              </li>
              <li>
                <StatusChip status="blocked" />
                <span>Waiting on a missing part.</span>
              </li>
            </ul>
            <JobReport
              title="Home server rack"
              meta="25 Oct 2026, 6 steps"
              counts={{ verified: 3, confirmed: 2, attention: 1 }}
              steps={[
                {
                  index: 1,
                  title: "Check every part is there",
                  status: "verified",
                  source: "Manual p.4",
                  time: "10:46",
                },
                {
                  index: 2,
                  title: "Fit the cage nuts",
                  status: "confirmed",
                  source: "Manual p.6",
                  time: "10:58",
                },
                {
                  index: 3,
                  title: "Fit the rails for the server",
                  status: "attention",
                  source: "Manual p.7",
                  time: "11:12",
                },
              ]}
            />
          </div>
        </section>

        <section id="safety" className={styles.section}>
          <div className={styles.sectionHead}>
            <h2 className={styles.title}>Careful by design.</h2>
          </div>
          <ul className={styles.grid3}>
            {safety.map((s) => (
              <li key={s.title}>
                <Icon name={s.icon} size={24} />
                <h3 className={styles.itemTitle}>{s.title}</h3>
                <p className={styles.itemBody}>{s.body}</p>
              </li>
            ))}
          </ul>
        </section>
      </main>

      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <span className={styles.wordmark}>Tandrix</span>
          <p>
            Built for the Meta Global AI Developer Hackathon, 2026. Runs on Meta&apos;s Muse Spark,
            SAM and Voice models. Tandrix doesn&apos;t certify that work is safe or correctly
            installed.
          </p>
        </div>
      </footer>
    </>
  );
}
