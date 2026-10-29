import { BrandMark, Icon } from "@tandrix/ui/web";
import type { Metadata } from "next";
import { Photo } from "../../components/scenes/Photo";
import { excelPhoto, manualPhoto, partsPhoto } from "../../components/scenes/photos";
import { ActivePill } from "../../components/site/ActivePill";
import { Anatomy } from "../../components/site/Anatomy";
import { Cta } from "../../components/site/Cta";
import { MAC_DOWNLOAD_URL, isExternal } from "../../lib/downloads";
import styles from "./technical.module.css";

export const metadata: Metadata = {
  title: "How Tandrix works",
  description:
    "What Tandrix does on your Mac and your iPhone, how it keeps you in control, and what stays private.",
};

const mac = [
  {
    title: "Show me",
    body: "Ask about anything on your screen. Tandrix rings the control to use, points at it, and says the next step.",
  },
  {
    title: "Teach me",
    body: "Say “teach me” and it goes one step at a time, waiting for you before it moves on.",
  },
  {
    title: "Do it for me",
    body: "Hand it a goal. It opens the apps it needs and does the steps, and tells you when it's done.",
  },
  {
    title: "Talk",
    body: "Hold ⌥⌘, say what you want, let go. Or switch on the wake word and say “Hey Tandrix”.",
  },
];

const phone = [
  {
    title: "Identify",
    body: "Photograph the label or the box. Tandrix reads the make and model for you to confirm.",
  },
  {
    title: "The real manual",
    body: "It finds the manufacturer's manual, or you add the PDF or photograph the pages. Every step shows the page it came from.",
  },
  {
    title: "Parts check",
    body: "Lay the parts out and take one photo. Tandrix outlines what's there and tells you what's missing.",
  },
  {
    title: "Step checks",
    body: "Take a photo when a step is done. Tandrix moves you on, or tells you what to fix.",
  },
];

const safe = [
  {
    icon: "hand",
    title: "Asks before it acts",
    body: "Anything that sends, pays, deletes, signs in or changes security settings waits for your yes.",
  },
  {
    icon: "stop",
    title: "You can always take over",
    body: "Move the mouse, type, or press Esc, and Tandrix stops at once and hands control back.",
  },
  {
    icon: "alert",
    title: "Safe steps first",
    body: "Steps involving power, pressure, moving parts or heat wait until you confirm they're safe.",
  },
  {
    icon: "check",
    title: "Checked, not guessed",
    body: "Each step is checked from a photo or your screen before the next, and cites where it came from.",
  },
] as const;

const privacy = [
  "Your projects are yours. No one else can see them.",
  "The wake word is heard on your Mac only. Nothing leaves it until you say Tandrix's name.",
  "Reports you share are private links that expire on their own and can be turned off.",
  "Tandrix looks at your screen only when you ask it something or give it a task.",
];

export default function Technical() {
  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <a href="/" className={styles.back}>
          <BrandMark size={22} /> Tandrix
        </a>
        <ActivePill state="looking" label="Looking at your screen" />
        <h1 className={styles.title}>How Tandrix works</h1>
        <p className={styles.lead}>
          What it adds on top of what you&apos;re doing, what it does on your Mac and your iPhone,
          and how it keeps you in control.
        </p>
      </header>

      <main className={styles.body}>
        <section aria-labelledby="anatomy-title">
          <div className={styles.head}>
            <h2 id="anatomy-title" className={styles.h2}>
              Inside Tandrix
            </h2>
            <p className={styles.sub}>
              Six layers over the thing you&apos;re working on. Together, they show you the way.
            </p>
          </div>
          <Anatomy />
        </section>

        <section aria-labelledby="mac-title" className={styles.split}>
          <div>
            <h2 id="mac-title" className={styles.h2}>
              On your Mac
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
              On your iPhone
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
          </div>
        </section>

        <section aria-labelledby="safe-title">
          <h2 id="safe-title" className={styles.h2}>
            You stay in control
          </h2>
          <div className={styles.tray}>
            {safe.map((g) => (
              <article key={g.title} className={styles.card}>
                <span className={styles.icon}>
                  <Icon name={g.icon} size={20} />
                </span>
                <h3>{g.title}</h3>
                <p>{g.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section aria-labelledby="privacy-title" className={styles.privacy}>
          <h2 id="privacy-title" className={styles.h2}>
            Your privacy
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
        </section>

        <section className={styles.end}>
          <Cta href={MAC_DOWNLOAD_URL} tone="ink" external={isExternal(MAC_DOWNLOAD_URL)}>
            Get Tandrix
          </Cta>
          <Cta href="/" tone="light" arrow={false}>
            Back to Tandrix
          </Cta>
        </section>
      </main>
    </div>
  );
}
