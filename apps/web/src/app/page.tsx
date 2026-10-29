import { BrandWordmark, Icon } from "@tandrix/ui/web";
import { NavMenu } from "../components/NavMenu";
import {
  CalendarScene,
  CheckCard,
  ExcelScene,
  GateCard,
  ManualScene,
  PhoneScene,
  SettingsScene,
  VoiceCard,
} from "../components/scenes/Scenes";
import { ActivePill } from "../components/site/ActivePill";
import { CapabilityMap } from "../components/site/CapabilityMap";
import { Cta } from "../components/site/Cta";
import { DayTimeline, type Moment } from "../components/site/DayTimeline";
import { Explorer, type Place } from "../components/site/Explorer";
import { ThemeToggle } from "../components/ThemeToggle";
import { IPHONE_DOWNLOAD_URL, MAC_DOWNLOAD_URL, SOURCE_URL } from "../lib/downloads";
import styles from "./page.module.css";

/** Tiles floating around the hero: each a real piece of Tandrix at work, labelled. */
const tiles = [
  { label: "Build a pivot table", cls: "t1", node: <ExcelScene pointer={false} /> },
  { label: "Parts check", cls: "t2", node: <PhoneScene /> },
  { label: "Shelf, step 4", cls: "t3", node: <ManualScene ring={false} /> },
  { label: "Join the Wi‑Fi", cls: "t4", node: <SettingsScene ring={false} /> },
  { label: "Book the dentist", cls: "t5", node: <CalendarScene /> },
  { label: "Fit the drill bit", cls: "t6", node: <CheckCard /> },
  { label: "Unplug it first", cls: "t7", node: <GateCard /> },
] as const;

const moments: Moment[] = [
  {
    time: "8 AM",
    tag: "Learning",
    title: "Learn the new spreadsheet",
    body: "Ask where things are and Tandrix rings the control on your screen, then says the next step out loud. Say “teach me” and it goes one step at a time.",
    ask: "Teach me pivot tables",
    scene: <ExcelScene />,
  },
  {
    time: "12 PM",
    tag: "At home",
    title: "Get back on the Wi‑Fi",
    body: "It looks at your screen, finds the setting, and points at it. You click; it checks it worked before moving on.",
    ask: "Why can't my Mac see the Wi‑Fi?",
    scene: <SettingsScene />,
  },
  {
    time: "4 PM",
    tag: "Hands-on",
    title: "Assemble the shelf",
    body: "Photograph the label and Tandrix finds the manual. Point your phone at the parts and it outlines what's there and what's missing.",
    ask: "Walk me through the shelf",
    scene: (
      <div className={styles.pair}>
        <ManualScene />
        <div className={styles.pairPhone}>
          <PhoneScene />
        </div>
      </div>
    ),
  },
  {
    time: "7 PM",
    tag: "Do it for me",
    title: "Book the dentist",
    body: "Hand over the task. Tandrix opens Calendar, does the steps, and asks before it sends anything. Move the mouse and you're back in control.",
    ask: "Book my dentist for Thursday at ten",
    scene: <CalendarScene />,
  },
];

const places: Place[] = [
  {
    name: "At home",
    tasks: [
      { name: "Join the Wi‑Fi", scene: <SettingsScene /> },
      { name: "Assemble the shelf", scene: <ManualScene /> },
      { name: "Make it safe first", scene: <GateCard /> },
    ],
  },
  {
    name: "At work",
    tasks: [
      { name: "Build a pivot table", scene: <ExcelScene /> },
      { name: "Book a meeting", scene: <CalendarScene /> },
      {
        name: "Ask about your screen",
        scene: (
          <VoiceCard
            ask="Where's the export button?"
            reply="Click File, then Export, then choose PDF."
          />
        ),
      },
    ],
  },
  {
    name: "In the workshop",
    tasks: [
      {
        name: "Check the parts",
        scene: (
          <div className={styles.phoneOnly}>
            <PhoneScene />
          </div>
        ),
      },
      { name: "Follow the manual", scene: <ManualScene /> },
      { name: "Check a step", scene: <CheckCard /> },
    ],
  },
  {
    name: "Learning",
    tasks: [
      { name: "Learn a spreadsheet", scene: <ExcelScene /> },
      { name: "Learn your settings", scene: <SettingsScene /> },
    ],
  },
];

const principles = [
  {
    title: "Say it how you'd say it",
    body: "Hold ⌥⌘ on the Mac, or the mic on your phone, and ask in plain words. Tandrix looks at what you're looking at and answers out loud.",
  },
  {
    title: "You stay in control",
    body: "It asks before anything that sends, pays or deletes. Risky steps wait until you confirm they're safe. Move the mouse and it stops.",
  },
  {
    title: "Every step is checked",
    body: "A photo or a look at your screen confirms each step before the next. Steps cite the manual page they came from.",
  },
];

const faqs: Array<{ id?: string; q: string; a: string }> = [
  {
    q: "What is Tandrix?",
    a: "An assistant for getting things done on your Mac and in front of you. It looks at your screen or through your phone's camera, points at what to do next, and checks each step with you. It can also do the steps on your Mac when you ask.",
  },
  {
    q: "What's the difference between Show me and Do it for me?",
    a: "Show me points at the control to use and says what to do; your hands stay on the mouse. Do it for me takes the steps itself, across the apps it needs. It asks before anything that sends, pays, deletes or changes security settings, and moving your mouse or pressing Esc stops it at once.",
  },
  {
    q: "How do I talk to it?",
    a: "Hold ⌥⌘ (Option and Command), say what you want, and let go. You can also switch on the wake word and say “Hey Tandrix”. The wake word is heard on your Mac by Apple's on-device speech recognition; nothing leaves the Mac until you've said Tandrix's name.",
  },
  {
    q: "Does it follow the real instructions?",
    a: "Yes. Photograph the label and Tandrix finds the manual, or add the PDF or photos of the pages yourself. Each step points to the page it came from, and when you ask it to look something up online it does that too.",
  },
  {
    id: "faq-share",
    q: "How do I share a finished job?",
    a: "Open the job's report on your iPhone and create a link. Anyone with the link sees the steps, their checks and the safety confirmations. Links expire after a week, and you can revoke one at any time.",
  },
];

export default function Home() {
  return (
    <div id="top" className={styles.page}>
      <header className={styles.header}>
        <BrandWordmark href="#top" size="md" />
        <nav className={styles.nav} aria-label="Primary">
          <a href="#day">How it works</a>
          <a href="#explore">Uses</a>
          <a href="#map">Capabilities</a>
          <a href="#faq">Questions</a>
        </nav>
        <div className={styles.headerEnd}>
          <ThemeToggle />
          <span className={styles.headerCtas}>
            <Cta href={IPHONE_DOWNLOAD_URL} tone="light" arrow={false} external>
              Get for iPhone
            </Cta>
            <Cta href={MAC_DOWNLOAD_URL} arrow={false} external>
              Download for Mac
            </Cta>
          </span>
          <NavMenu />
        </div>
      </header>

      <main>
        <section className={styles.hero} aria-labelledby="hero-title">
          <div className={styles.tiles} aria-hidden="true">
            {tiles.map((t) => (
              <figure key={t.label} className={`${styles.tile} ${styles[t.cls]}`}>
                <div className={styles.tileArt}>{t.node}</div>
                <figcaption>{t.label}</figcaption>
              </figure>
            ))}
          </div>
          <div className={styles.heroCopy}>
            <ActivePill state="listening" label="Listening" keys="⌥⌘" hint="Let go to ask" />
            <h1 id="hero-title" className={styles.heroTitle}>
              Tell Tandrix what you want done
            </h1>
            <p className={styles.heroLead}>
              It sees your screen and what&apos;s in front of your camera, points the way, and
              checks every step with you.
            </p>
            <div className={styles.heroCtas}>
              <Cta href={MAC_DOWNLOAD_URL} arrow={false} external>
                <AppleMark /> Download for Mac
              </Cta>
              <Cta href={IPHONE_DOWNLOAD_URL} tone="light" arrow={false} external>
                Get for iPhone
              </Cta>
            </div>
          </div>
        </section>

        <section id="day" className={styles.band} aria-labelledby="day-title">
          <div className={styles.headCenter}>
            <h2 id="day-title" className={styles.h2}>
              A day with Tandrix
            </h2>
            <p className={styles.lead}>
              Learn the app, fix the setting, build the thing, hand off the errand. One assistant,
              on your Mac and your iPhone.
            </p>
          </div>
          <DayTimeline moments={moments} />
        </section>

        <section className={styles.section} aria-labelledby="principles-title">
          <h2 id="principles-title" className={`${styles.h2} ${styles.center}`}>
            Help that stays out of your way
          </h2>
          <div className={styles.principles}>
            {principles.map((p) => (
              <article key={p.title}>
                <h3>{p.title}</h3>
                <p>{p.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="explore" className={styles.band} aria-labelledby="explore-title">
          <div className={styles.headCenter}>
            <h2 id="explore-title" className={styles.h2}>
              See what it can do for you
            </h2>
          </div>
          <Explorer places={places} />
        </section>

        <section id="map" className={styles.section} aria-labelledby="map-title">
          <h2 id="map-title" className={styles.hidden}>
            Everything Tandrix does
          </h2>
          <CapabilityMap />
        </section>

        <section className={styles.band} aria-labelledby="get-title">
          <div className={styles.headCenter}>
            <h2 id="get-title" className={styles.h2}>
              On every screen you work on
            </h2>
            <p className={styles.lead}>
              Start on one, finish on the other. A step that needs the computer goes to your Mac in
              one tap.
            </p>
          </div>
          <div className={styles.platforms}>
            <article>
              <Icon name="laptop" size={24} />
              <h3>Mac</h3>
              <p>Points at the answer on your screen, and does the steps when you ask it to.</p>
              <Cta href={MAC_DOWNLOAD_URL} external>
                Download for Mac
              </Cta>
            </article>
            <article>
              <Icon name="phone" size={24} />
              <h3>iPhone</h3>
              <p>Sees your work through the camera, finds the manual and checks each step.</p>
              <Cta href={IPHONE_DOWNLOAD_URL} tone="light" external>
                Get for iPhone
              </Cta>
            </article>
            <article>
              <Icon name="file" size={24} />
              <h3>Report</h3>
              <p>Share what was done and how each step was checked, as a private link.</p>
              <Cta href="#faq-share" tone="light">
                How sharing works
              </Cta>
            </article>
          </div>
        </section>

        <section id="faq" className={styles.faq} aria-labelledby="faq-title">
          <h2 id="faq-title" className={`${styles.h2} ${styles.center}`}>
            Questions
          </h2>
          <div className={styles.faqList}>
            {faqs.map((f, i) => (
              <details key={f.q} id={f.id} className={styles.faqItem} open={i === 0}>
                <summary>
                  <span>{f.q}</span>
                  <span className={styles.faqSign} aria-hidden="true" />
                </summary>
                <p>{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className={styles.ask} aria-labelledby="ask-title">
          <h2 id="ask-title" className={styles.hidden}>
            Get Tandrix
          </h2>
          <a href={MAC_DOWNLOAD_URL} target="_blank" rel="noreferrer" className={styles.askBox}>
            <span className={styles.askMic}>
              <Icon name="mic" size={16} />
            </span>
            <span className={styles.askText}>What do you want to get done?</span>
            <span className={styles.askKeys}>
              Hold <kbd>⌥⌘</kbd>
            </span>
            <span className={styles.askGo}>Get Tandrix</span>
          </a>
        </section>
      </main>

      <footer className={styles.footer}>
        <div className={styles.footerTop}>
          <div className={styles.footerBrand}>
            <BrandWordmark href="#top" size="lg" className={styles.footerMark} />
            <p>One assistant for everything you want to get done, on your Mac and your iPhone.</p>
          </div>
          <div className={styles.footerCols}>
            <div>
              <h3>Product</h3>
              <a href="#day">How it works</a>
              <a href="#explore">Uses</a>
              <a href="#map">Capabilities</a>
              <a href="/technical">Technical work</a>
            </div>
            <div>
              <h3>Get Tandrix</h3>
              <a href={MAC_DOWNLOAD_URL} target="_blank" rel="noreferrer">
                Mac
              </a>
              <a href={IPHONE_DOWNLOAD_URL} target="_blank" rel="noreferrer">
                iPhone
              </a>
            </div>
            <div>
              <h3>More</h3>
              <a href="#faq">Questions</a>
              <a href={SOURCE_URL} target="_blank" rel="noreferrer">
                Source
              </a>
              <a href="/credits">Photo credits</a>
            </div>
          </div>
        </div>
        <div className={styles.footerBottom}>
          <span>© 2026 Tandrix</span>
        </div>
      </footer>
    </div>
  );
}

function AppleMark() {
  return (
    <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true" fill="currentColor">
      <path d="M11.2 8.4c0-1.6 1.3-2.4 1.4-2.4-.8-1.1-2-1.3-2.4-1.3-1-.1-2 .6-2.5.6s-1.3-.6-2.2-.6C4.3 4.7 3.2 5.4 2.6 6.5c-1.2 2.1-.3 5.2.9 6.9.6.8 1.2 1.7 2.1 1.7.8 0 1.2-.5 2.2-.5s1.3.5 2.2.5c.9 0 1.5-.8 2-1.7.6-.9.9-1.8.9-1.9 0 0-1.7-.7-1.7-3.1zM9.6 3.6c.5-.6.8-1.4.7-2.2-.7 0-1.5.5-2 1.1-.4.5-.8 1.3-.7 2.1.8.1 1.5-.4 2-1z" />
    </svg>
  );
}
