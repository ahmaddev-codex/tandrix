import type { Metadata } from "next";
import { ExcelScene, PhoneScene } from "../../components/scenes/Scenes";
import { ActivePill } from "../../components/site/ActivePill";
import { Cta } from "../../components/site/Cta";
import { SOURCE_URL } from "../../lib/downloads";
import styles from "./technical.module.css";

export const metadata: Metadata = {
  title: "Tandrix for technical work",
  description:
    "Code questions, dev environments, and hardware setup with checked steps. Live server and GPU diagnostics are on the way.",
};

const today = [
  {
    title: "Understand code and configs",
    body: "Ask about the file, terminal output, or settings screen in front of you. Tandrix reads it and explains what matters.",
  },
  {
    title: "Set up environments and hardware",
    body: "Manuals become cited, checked procedures — from a dev environment to a full workstation build.",
  },
  {
    title: "Identify parts on sight",
    body: "Point the phone camera at a board or component. Tandrix names it and draws around exactly where to act.",
  },
];

const next = [
  {
    title: "Live server diagnostics",
    body: "Run checks against real command output and logs, with every finding verified — not guessed.",
  },
  {
    title: "GPU workstation troubleshooting",
    body: "Driver, thermal, and job failures traced to evidence, step by step.",
  },
];

export default function Technical() {
  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <a href="/" className={styles.back}>
          ← Tandrix
        </a>
        <ActivePill state="looking" label="Looking at your terminal" />
        <h1 className={styles.title}>Tandrix for technical work</h1>
        <p className={styles.lead}>
          The same assistant that sets up a coffee machine also reads your screen, explains your
          code, and walks hardware builds with checked steps.
        </p>
      </header>

      <main className={styles.body}>
        <section aria-labelledby="today-title">
          <h2 id="today-title" className={styles.h2}>
            Works today
          </h2>
          <div className={styles.tray}>
            {today.map((c) => (
              <article key={c.title} className={styles.card}>
                <h3>{c.title}</h3>
                <p>{c.body}</p>
              </article>
            ))}
          </div>
          <div className={styles.scenes}>
            <ExcelScene />
            <div className={styles.phone}>
              <PhoneScene />
            </div>
          </div>
          <p className={styles.caption}>
            The outlines on the tools are the ones Tandrix&apos;s part finder drew on this photo.
          </p>
        </section>

        <section aria-labelledby="next-title">
          <h2 id="next-title" className={styles.h2}>
            <span className={styles.soft}>Coming next</span>
          </h2>
          <div className={`${styles.tray} ${styles.trayTwo}`}>
            {next.map((c) => (
              <article key={c.title} className={styles.card}>
                <h3>{c.title}</h3>
                <p>{c.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section aria-labelledby="hood-title" className={styles.hood}>
          <h2 id="hood-title" className={styles.h2}>
            Under the hood
          </h2>
          <p className={styles.prose}>
            A phone app and a Mac app talk to one API. Vision reads your camera and screen, speech
            carries both directions, and every procedure cites the manual page it came from. Safety
            gates confirm risky steps before anything acts, on a workbench or in your apps.
          </p>
          <div className={styles.ctaRow}>
            <Cta href={SOURCE_URL} tone="ink" external>
              Read the source
            </Cta>
            <Cta href="/" tone="light" arrow={false}>
              Back to Tandrix
            </Cta>
          </div>
        </section>
      </main>
    </div>
  );
}
