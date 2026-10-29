import { BrandMark, Icon, type IconProps } from "@tandrix/ui/web";
import type { Metadata } from "next";
import { Photo } from "../../components/scenes/Photo";
import { excelPhoto, manualPhoto, partsPhoto } from "../../components/scenes/photos";
import { ActivePill } from "../../components/site/ActivePill";
import { Cta } from "../../components/site/Cta";
import { SOURCE_URL } from "../../lib/downloads";
import styles from "./technical.module.css";

export const metadata: Metadata = {
  title: "Tandrix for technical work",
  description:
    "How Tandrix works: the Mac and iPhone apps, the API and models behind them, how Do it for me stays safe, what stays private, and how it's tested.",
};

/** The system, left to right: where you are, what Tandrix runs on, what it thinks with. */
const stack: Array<{ title: string; icon: IconProps["name"]; items: string[] }> = [
  {
    title: "Mac app",
    icon: "laptop",
    items: [
      "Menu-bar panel and a pointer overlay on every display",
      "Hold ⌥⌘ to talk; optional on-device wake word",
      "Native input helper for Do it for me",
    ],
  },
  {
    title: "iPhone app",
    icon: "phone",
    items: [
      "Camera, photos and the photo picker",
      "Step-by-step jobs that keep working offline",
      "Hands a step to the Mac in one tap",
    ],
  },
  {
    title: "Tandrix API",
    icon: "gear",
    items: [
      "Jobs, steps, checks and reports",
      "Rate limits and a spend cap on every model call",
      "Tandrix's own voice, generated on the server",
    ],
  },
  {
    title: "Data",
    icon: "file",
    items: [
      "Postgres with row-level security on every table",
      "Private storage for photos and manuals",
      "Sign-in shared by your phone and your Mac",
    ],
  },
  {
    title: "Models",
    icon: "eyeOff",
    items: [
      "A vision and computer-use model reads screens and photos",
      "A segmentation model outlines parts",
      "Speech-to-text for what you say",
    ],
  },
];

const mac = [
  {
    title: "Show me",
    body: "Tandrix captures the display you're on, asks the model where the answer is, and draws the ring and pointer on the exact control, with the next step spoken aloud. Its own overlays are kept out of the screenshot.",
  },
  {
    title: "Teach me",
    body: "Say “teach me” and Tandrix goes one step at a time, waiting for you to say next before it moves on.",
  },
  {
    title: "Do it for me",
    body: "The model proposes actions in batches; the Mac app checks every one before anything runs, then clicks and types through a native helper. It can open the installed app a task needs, and it hands control back if a task runs past 30 rounds.",
  },
  {
    title: "Talk",
    body: "Hold ⌥⌘, speak, let go. Or switch on the wake word: it runs on Apple's on-device speech recognition, and nothing leaves the Mac until you say Tandrix's name.",
  },
];

const phone = [
  {
    title: "Identify",
    body: "Photograph the nameplate or the box; Tandrix reads the make and model for you to confirm.",
  },
  {
    title: "The real manual",
    body: "It searches for the manufacturer's manual, or you add the PDF or photograph the pages. Steps are written from it, each citing the page it came from.",
  },
  {
    title: "Parts check",
    body: "Lay the parts out and take one photo. The segmentation model outlines each one and Tandrix says what's there, what to confirm and what's missing.",
  },
  {
    title: "Step checks",
    body: "Take a photo when a step is done. Tandrix compares it with what the step should look like and either moves you on or says what to fix.",
  },
];

const guard = [
  {
    icon: "hand",
    title: "Checked before it runs",
    body: "Actions that pay, send, delete, enter credentials, install software or change security settings stop for your confirmation, in English, German, French, Spanish, Italian and Portuguese.",
  },
  {
    icon: "stop",
    title: "You can always take over",
    body: "Moving the mouse, typing, or pressing Esc stops the task at once, and Tandrix tells you it's handed back control.",
  },
  {
    icon: "laptop",
    title: "Only the apps you have",
    body: "It opens an app only by name from the apps installed on your Mac, never a path, and only if the app really comes to the front.",
  },
  {
    icon: "alert",
    title: "Safety gates on physical work",
    body: "Steps that involve power, pressure, moving parts or heat wait until you confirm you've made them safe. Questions about touching live wiring are refused.",
  },
] as const;

const privacy = [
  "Model and service keys stay on the server; the apps never hold them.",
  "Every table has row-level security; you only ever see your own jobs.",
  "Report links are stored as hashes, expire on their own (a week by default), and can be revoked.",
  "Shared reports are never cached by browsers or proxies.",
  "The wake word is heard on your Mac only.",
  "Notes found on the web are treated as information, never as instructions.",
];

const tested = [
  { n: "606", what: "unit tests across the apps, API and shared packages" },
  { n: "50", what: "integration tests against a real database" },
  { n: "10", what: "end-to-end flows on the iPhone, run on the real models" },
];

const next = [
  {
    title: "Live server diagnostics",
    body: "Run checks against real command output and logs, with every finding verified, not guessed.",
  },
  {
    title: "GPU workstation troubleshooting",
    body: "Driver, thermal and job failures traced to evidence, step by step.",
  },
];

export default function Technical() {
  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <a href="/" className={styles.back}>
          <BrandMark size={22} /> Tandrix
        </a>
        <ActivePill state="looking" label="Looking at your terminal" />
        <h1 className={styles.title}>How Tandrix works</h1>
        <p className={styles.lead}>
          The apps, the API and the models behind them, how Do it for me stays safe, what stays
          private, and how it&apos;s tested. For anyone who wants to know what&apos;s under the hood
          before they hand it a task.
        </p>
      </header>

      <main className={styles.body}>
        <section aria-labelledby="stack-title">
          <h2 id="stack-title" className={styles.h2}>
            The system
          </h2>
          <p className={styles.sub}>Two apps, one API, and the models it calls.</p>
          <ol className={styles.stack}>
            {stack.map((s) => (
              <li key={s.title} className={styles.node}>
                <span className={styles.nodeIcon}>
                  <Icon name={s.icon} size={20} />
                </span>
                <h3>{s.title}</h3>
                <ul>
                  {s.items.map((it) => (
                    <li key={it}>{it}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="mac-title" className={styles.split}>
          <div>
            <h2 id="mac-title" className={styles.h2}>
              On the Mac
            </h2>
            <dl className={styles.list}>
              {mac.map((m) => (
                <div key={m.title}>
                  <dt>{m.title}</dt>
                  <dd>{m.body}</dd>
                </div>
              ))}
            </dl>
          </div>
          <Photo spec={excelPhoto} className={styles.shot} />
        </section>

        <section aria-labelledby="phone-title" className={`${styles.split} ${styles.flip}`}>
          <div>
            <h2 id="phone-title" className={styles.h2}>
              On the iPhone
            </h2>
            <dl className={styles.list}>
              {phone.map((m) => (
                <div key={m.title}>
                  <dt>{m.title}</dt>
                  <dd>{m.body}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div className={styles.shots}>
            <Photo spec={manualPhoto} className={styles.shot} />
            <Photo spec={partsPhoto} className={styles.shot} />
            <p className={styles.caption}>
              The outlines are what the segmentation model found on this photo.
            </p>
          </div>
        </section>

        <section aria-labelledby="guard-title">
          <h2 id="guard-title" className={styles.h2}>
            How Do it for me stays safe
          </h2>
          <div className={styles.tray}>
            {guard.map((g) => (
              <article key={g.title} className={styles.card}>
                <span className={styles.nodeIcon}>
                  <Icon name={g.icon} size={20} />
                </span>
                <h3>{g.title}</h3>
                <p>{g.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section aria-labelledby="privacy-title" className={styles.split}>
          <div>
            <h2 id="privacy-title" className={styles.h2}>
              Privacy and security
            </h2>
            <ul className={styles.checks}>
              {privacy.map((p) => (
                <li key={p}>
                  <span className={styles.tick}>
                    <Icon name="check" size={16} />
                  </span>
                  {p}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className={styles.h2}>How it&apos;s tested</h2>
            <ul className={styles.stats}>
              {tested.map((t) => (
                <li key={t.what}>
                  <b>{t.n}</b>
                  <span>{t.what}</span>
                </li>
              ))}
            </ul>
          </div>
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

        <section className={styles.end}>
          {SOURCE_URL ? (
            <Cta href={SOURCE_URL} tone="ink" external>
              Read the source
            </Cta>
          ) : (
            <Cta href="/#early" tone="ink">
              Get early access
            </Cta>
          )}
          <Cta href="/" tone="light" arrow={false}>
            Back to Tandrix
          </Cta>
        </section>
      </main>
    </div>
  );
}
