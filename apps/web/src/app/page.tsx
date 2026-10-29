import { BrandWordmark, Icon } from "@tandrix/ui/web";
import type { ReactNode } from "react";
import { ScrollReveals } from "../components/motion/ScrollReveals";
import { NavMenu } from "../components/NavMenu";
import { CheckCard, GateCard, PointerArrow, VoiceCard } from "../components/scenes/Scenes";
import { ActivePill } from "../components/site/ActivePill";
import { CapabilityMap } from "../components/site/CapabilityMap";
import { Carousel3D } from "../components/site/Carousel3D";
import { SmoothScroll } from "../components/site/SmoothScroll";
import {
  DoingTile,
  GateTile,
  KeysTile,
  ListeningTile,
  MarkTile,
  PhotoTile,
  VerifiedTile,
  VideoTile,
} from "../components/site/Tiles";
import { Photo, type PhotoSpec } from "../components/scenes/Photo";
import {
  calendarPhoto,
  excelPhoto,
  manualPhoto,
  partsPhoto,
  wifiPhoto,
} from "../components/scenes/photos";
import { Clip } from "../components/site/Clip";
import { Cta } from "../components/site/Cta";
import { DayTimeline, type Moment } from "../components/site/DayTimeline";
import { Explorer, type Place } from "../components/site/Explorer";
import { Assemble } from "../components/site/Assemble";
import { BeforeAfter } from "../components/site/BeforeAfter";
import { EarlyAccess } from "../components/site/EarlyAccess";
import { HearIt } from "../components/site/HearIt";
import { StickyPresence } from "../components/site/StickyPresence";
import { TryIt } from "../components/site/TryIt";
import { ThemeToggle } from "../components/ThemeToggle";
import {
  IPHONE_DOWNLOAD_URL,
  MAC_DOWNLOAD_URL,
  EARLY_ACCESS,
  SOURCE_URL,
  isExternal,
} from "../lib/downloads";
import styles from "./page.module.css";

/** The hero carousel: real photos and footage between the moments Tandrix shows on screen. */
const ring: ReactNode[] = [
  <MarkTile key="mark" />,
  <PhotoTile
    key="excel"
    src="/photos/budget-laptop.jpeg"
    at="40% 45%"
    label="Learn a spreadsheet"
  />,
  <ListeningTile key="listen" />,
  <VideoTile key="v1" name="working-on-electornics" label="Hands-on" />,
  <VerifiedTile key="verified" />,
  <PhotoTile key="parts" src="/photos/robot-parts.jpeg" label="Parts check" />,
  <KeysTile key="keys" />,
  <VideoTile key="v2" name="typing-on-laptop" label="On your Mac" />,
  <PhotoTile key="manual" src="/photos/robot-manual.jpeg" at="45% 55%" label="Real manuals" />,
  <DoingTile key="doing" />,
  <VideoTile key="v3" name="working-on-a-cpu" label="Builds" />,
  <PhotoTile key="cal" src="/photos/calendar-laptop.jpeg" at="40% 40%" label="Book it" />,
  <GateTile key="gate" />,
  <VideoTile key="v4" name="working-on-machine" label="Workshop" />,
];

const moments: Moment[] = [
  {
    time: "8 AM",
    tag: "Learning",
    title: "Learn the new spreadsheet",
    body: "Ask where things are and Tandrix rings the control on your screen, then says the next step out loud. Say “teach me” and it goes one step at a time.",
    ask: "Teach me pivot tables",
    scene: <Photo spec={excelPhoto} className={styles.shot} />,
  },
  {
    time: "12 PM",
    tag: "At home",
    title: "Get back on the Wi‑Fi",
    body: "It looks at your screen, finds the setting, and points at it. You click; it checks it worked before moving on.",
    ask: "Why can't my Mac see the Wi‑Fi?",
    scene: <Photo spec={wifiPhoto} className={styles.shot} />,
  },
  {
    time: "4 PM",
    tag: "Hands-on",
    title: "Assemble the shelf",
    body: "Photograph the label and Tandrix finds the manual. Point your phone at the parts and it outlines what's there and what's missing.",
    ask: "Walk me through the shelf",
    scene: (
      <div className={styles.pair}>
        <Photo spec={manualPhoto} className={styles.shot} />
        <div className={styles.pairPhone}>
          <Photo spec={partsPhoto} className={styles.shot} />
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
    scene: <Photo spec={calendarPhoto} className={styles.shot} />,
  },
];

const places: Place[] = [
  {
    name: "At home",
    tasks: [
      { name: "Join the Wi‑Fi", scene: <Photo spec={wifiPhoto} className={styles.shot} /> },
      { name: "Book the dentist", scene: <Photo spec={calendarPhoto} className={styles.shot} /> },
      { name: "Make it safe first", scene: <GateCard /> },
    ],
  },
  {
    name: "At work",
    tasks: [
      { name: "Build a pivot table", scene: <Photo spec={excelPhoto} className={styles.shot} /> },
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
      { name: "Check the parts", scene: <Photo spec={partsPhoto} className={styles.shot} /> },
      { name: "Name a part", scene: <Photo spec={manualPhoto} className={styles.shot} /> },
      { name: "Check a step", scene: <CheckCard /> },
    ],
  },
  {
    name: "Learning",
    tasks: [
      { name: "Learn a spreadsheet", scene: <Photo spec={excelPhoto} className={styles.shot} /> },
      { name: "Learn your settings", scene: <Photo spec={wifiPhoto} className={styles.shot} /> },
    ],
  },
];

const uses = [
  {
    icon: "book",
    title: "Learning",
    body: "Say “teach me” and learn an app one step at a time, with Tandrix pointing at each control.",
  },
  {
    icon: "file",
    title: "Work",
    body: "Hand over a task across your apps. Tandrix opens what it needs and does the steps.",
  },
  {
    icon: "image",
    title: "Creativity",
    body: "Find your way around creative apps and learn how a look or an effect is done.",
  },
] as const;

/** Width over height of a photo as shown. */
const fit = (p: PhotoSpec) => (p.crop ? p.crop.w / p.crop.h : p.w / p.h);

const asks = [
  {
    photo: wifiPhoto,
    line: "router",
    when: "11 pm, a blinking router",
    ask: "Why can't my Mac see the Wi‑Fi?",
    reply: "It's waiting for Wi‑Fi. Open Settings, then Network, and pick yours.",
  },
  {
    photo: excelPhoto,
    line: "teach",
    when: "A new app at work",
    ask: "Teach me pivot tables",
    reply: "Click any cell, then Insert, then PivotTable. Say next when that's done.",
  },
  {
    photo: manualPhoto,
    line: "setup",
    when: "A new kit on the bench",
    ask: "Walk me through my first setup",
    reply: "Found the manual: six steps. Show me the parts laid out and we'll start.",
  },
  {
    photo: partsPhoto,
    line: "seated",
    when: "Mid-build, screwdriver in hand",
    ask: "Is this part seated right?",
    reply: "Not yet. The left clip is still up. Press it down until it clicks, then show me again.",
  },
  {
    photo: calendarPhoto,
    line: "dentist",
    when: "The task behind the task",
    ask: "And book my dentist after this",
    reply: "Queued. I'll do it next, and ask you before anything is sent.",
  },
] as const;

const platforms = [
  {
    icon: "laptop",
    name: "Mac",
    lead: "Points at the answer on your screen, and does the steps when you ask it to.",
    big: "macOS",
    items: [
      "Hold ⌥⌘ to talk in any app",
      "Show me, or Do it for me",
      "Asks before it sends, pays or deletes",
      "Optional wake word, heard on the Mac only",
    ],
    cta: {
      label: EARLY_ACCESS ? "Get early access" : "Download for Mac",
      href: MAC_DOWNLOAD_URL,
      external: isExternal(MAC_DOWNLOAD_URL),
    },
  },
  {
    icon: "phone",
    name: "iPhone",
    lead: "Sees what you're working on through the camera and checks each step with you.",
    big: "iOS",
    items: [
      "Reads labels and finds the manual",
      "Outlines the parts in your photo",
      "Checks each step from a photo",
      "Hands a step to your Mac in one tap",
    ],
    cta: {
      label: EARLY_ACCESS ? "Get early access" : "Get for iPhone",
      href: IPHONE_DOWNLOAD_URL,
      external: isExternal(IPHONE_DOWNLOAD_URL),
    },
  },
  {
    icon: "file",
    name: "Report",
    lead: "When the job is done, share what was done and how each step was checked.",
    big: "Any browser",
    items: [
      "Every step with its check",
      "Safety confirmations, timed",
      "A private link you can revoke",
      "Links expire on their own",
    ],
    cta: { label: "How sharing works", href: "#faq-share", external: false },
  },
] as const;

const faqs: Array<{ id?: string; q: string; a: string }> = [
  {
    q: "What can I ask Tandrix?",
    a: "Anything you're trying to get done on your Mac or in front of you: learning an app, finishing a task across apps, setting up a device, assembling something, or fixing what's wrong. On the Mac it looks at your screen; on the iPhone it looks through the camera.",
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
    q: "How does it check my work?",
    a: "Take a photo when a step is done. Tandrix compares it with what the step should look like and either moves you on or says what to fix. Steps that involve power or other hazards wait until you confirm you've made them safe.",
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
      <section className={styles.hero} aria-labelledby="hero-title" data-presence-off>
        <SmoothScroll />
        <StickyPresence />
        <header className={styles.header}>
          <BrandWordmark href="#top" size="lg" className={styles.brand} />
          <nav className={styles.nav} aria-label="Primary">
            <a href="#what">What it does</a>
            <a href="#day">A day with it</a>
            <a href="#explore">Uses</a>
            <a href="#faq">Questions</a>
          </nav>
          <div className={styles.headerEnd}>
            <ThemeToggle />
            <span className={styles.headerCta}>
              <Cta href="#get" tone="white" arrow={false}>
                Download
              </Cta>
            </span>
            <NavMenu />
          </div>
        </header>

        <div className={styles.heroCopy}>
          <ActivePill state="listening" label="Listening" keys="⌥⌘" hint="Let go to ask" />
          <h1 id="hero-title" className={styles.heroTitle}>
            Tell it what you want done.
            <span>It shows you the way.</span>
          </h1>
          <p className={styles.heroLead}>
            Tandrix sees your screen and what&apos;s in front of your camera, points at the answer,
            and checks every step with you.
          </p>
          <div className={styles.heroCtas}>
            <Cta href="#day" tone="glass" arrow={false}>
              See how it works
            </Cta>
            <Cta href={MAC_DOWNLOAD_URL} tone="white" external={isExternal(MAC_DOWNLOAD_URL)}>
              Download for Mac
            </Cta>
          </div>
        </div>

        <Carousel3D items={ring} />
      </section>

      <ScrollReveals>
        <main>
          <section
            id="what"
            data-presence-state="looking"
            data-presence-label="Looking at your screen"
            className={styles.section}
            aria-labelledby="what-title"
          >
            <div className={styles.head} data-reveal>
              <h2 id="what-title" className={styles.h2}>
                An assistant that{" "}
                <span className={styles.nowrap}>
                  sees
                  <span className={`${styles.chip} ${styles.chipBlue}`} aria-hidden="true">
                    <Icon name="camera" size={24} />
                  </span>
                </span>{" "}
                what you see and{" "}
                <span className={styles.nowrap}>
                  points
                  <span className={`${styles.chip} ${styles.chipInk}`} aria-hidden="true">
                    <PointerArrow size={24} />
                  </span>
                </span>{" "}
                <span className={styles.h2Soft}>at the way through.</span>
              </h2>
            </div>

            <div className={styles.bento} data-stagger>
              <article className={`${styles.tile} ${styles.tileVideo}`}>
                <Clip name="typing-on-laptop" className={styles.tileClip} />
                <span className={styles.tileIcon}>
                  <Icon name="mic" size={20} />
                </span>
                <div className={styles.tileInset}>
                  <p className={styles.keysBig}>
                    <kbd>⌥</kbd>
                    <kbd>⌘</kbd>
                  </p>
                  <p>Hold to talk from any app. Let go, and Tandrix answers out loud.</p>
                </div>
              </article>
              <article className={`${styles.tile} ${styles.tileMist}`}>
                <p className={styles.tileLabel}>Show me</p>
                <p className={styles.tileStat}>Points, then waits</p>
                <div className={styles.tileScene}>
                  <Photo spec={excelPhoto} className={styles.shot} />
                </div>
              </article>
              <div className={styles.tileStack}>
                <article className={`${styles.tile} ${styles.tileBlue}`}>
                  <p className={styles.tileLabel}>From the real manual</p>
                  <p className={styles.tileStat}>p. 12</p>
                  <p className={styles.tileBody}>Every step cites the page it came from.</p>
                </article>
                <article className={`${styles.tile} ${styles.tileInk}`}>
                  <p className={styles.tileLabel}>Asks first</p>
                  <p className={styles.tileBody}>Before anything that sends, pays or deletes.</p>
                </article>
              </div>
            </div>
          </section>

          <section
            id="try"
            className={styles.section}
            aria-labelledby="try-title"
            data-presence-state="looking"
            data-presence-label="Show me"
          >
            <div className={styles.head} data-reveal>
              <h2 id="try-title" className={styles.h2}>
                Point at anything. <span className={styles.h2Soft}>It tells you what it is.</span>
              </h2>
            </div>
            <TryIt />
          </section>

          <section
            id="day"
            data-presence-state="answering"
            data-presence-label="Answering"
            className={styles.band}
            aria-labelledby="day-title"
          >
            <div className={styles.head} data-reveal>
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

          <section
            id="uses"
            data-presence-state="doing"
            data-presence-label="Tandrix is in control"
            className={styles.section}
            aria-labelledby="uses-title"
          >
            <div className={styles.head} data-reveal>
              <h2 id="uses-title" className={styles.h2}>
                Help with whatever&apos;s in front of you
              </h2>
              <p className={styles.lead}>
                Everyday jobs, new apps and hands-on builds. Say the goal; Tandrix works out the
                steps and goes through them with you.
              </p>
              <Cta href="#get">Get Tandrix</Cta>
            </div>

            <div className={styles.tray} data-stagger>
              <article className={`${styles.card} ${styles.cardWide}`}>
                <div className={styles.cardText}>
                  <span className={styles.cardIcon}>
                    <Icon name="home" size={20} />
                  </span>
                  <h3>Everyday life</h3>
                  <p>
                    Set up the new appliance, find what the blinking light means, put the furniture
                    together.
                  </p>
                </div>
                <div className={styles.cardMedia}>
                  <Clip name="laptop-home" className={styles.cardClip} />
                </div>
              </article>
              <article className={`${styles.card} ${styles.cardWide}`}>
                <div className={styles.cardText}>
                  <span className={styles.cardIcon}>
                    <Icon name="hand" size={20} />
                  </span>
                  <h3>Hands-on</h3>
                  <p>
                    Assembly, setup and maintenance from the real manual, with risky steps confirmed
                    first.
                  </p>
                </div>
                <div className={styles.cardMedia}>
                  <Clip name="working-on-electornics" className={styles.cardClip} />
                </div>
              </article>
              {uses.map((u) => (
                <article key={u.title} className={styles.card}>
                  <span className={styles.cardIcon}>
                    <Icon name={u.icon} size={20} />
                  </span>
                  <h3>{u.title}</h3>
                  <p>{u.body}</p>
                </article>
              ))}
              <a href="/technical" className={`${styles.card} ${styles.cardDark}`}>
                <span className={styles.cardIcon}>
                  <Icon name="gear" size={20} />
                </span>
                <h3>How Tandrix works</h3>
                <p>The layers it adds over your work, and how you stay in control.</p>
                <span className={styles.cardMore}>
                  See inside <Icon name="arrowRight" size={16} />
                </span>
              </a>
            </div>
          </section>

          <section
            id="build"
            className={styles.buildSection}
            aria-labelledby="build-title"
            data-presence-state="doing"
            data-presence-label="Checking each part"
          >
            <div className={styles.head} data-reveal>
              <h2 id="build-title" className={styles.h2}>
                Build it with Tandrix
              </h2>
              <p className={styles.lead}>
                Scroll to put the kit together. Each part is checked as it lands, the way Tandrix
                checks your build from a photo.
              </p>
            </div>
            <Assemble />
          </section>

          <section
            id="explore"
            data-presence-state="thinking"
            data-presence-label="Thinking"
            className={styles.band}
            aria-labelledby="explore-title"
          >
            <div className={styles.head} data-reveal>
              <h2 id="explore-title" className={styles.h2}>
                See what it can do for you
              </h2>
            </div>
            <Explorer places={places} />
          </section>

          <section
            id="manual"
            className={styles.section}
            aria-labelledby="manual-title"
            data-presence-state="thinking"
            data-presence-label="Reading the manual"
          >
            <div className={styles.head} data-reveal>
              <h2 id="manual-title" className={styles.h2}>
                From the manual <span className={styles.h2Soft}>to your next step</span>
              </h2>
              <p className={styles.lead}>
                Tandrix reads the real manual and turns each page into one clear step, with the part
                ringed. Drag to compare.
              </p>
            </div>
            <BeforeAfter />
          </section>

          <section
            className={`${styles.section} ${styles.sectionWide}`}
            aria-labelledby="asks-title"
          >
            <div className={styles.headLeft} data-reveal>
              <h2 id="asks-title" className={styles.h2}>
                Ask it like you&apos;d ask a friend
              </h2>
              <p className={styles.lead}>Plain words in, the next step out, spoken aloud.</p>
            </div>
            <div className={styles.asks} tabIndex={0} aria-label="Examples">
              {asks.map((a) => (
                <article key={a.ask} className={styles.ask}>
                  <div className={styles.askShot}>
                    {/* Fitted whole inside the frame at its own shape, so the ring stays exact. */}
                    <div style={{ width: `min(100cqw, ${fit(a.photo) * 100}cqh)` }}>
                      <Photo spec={a.photo} />
                    </div>
                  </div>
                  <div className={styles.askText}>
                    <p className={styles.askWhen}>{a.when}</p>
                    <p className={styles.askQuote}>“{a.ask}”</p>
                    <p className={styles.askReply}>
                      <span className={styles.askBy}>Tandrix</span>
                      {a.reply}
                    </p>
                    <HearIt line={a.line} label="Hear the reply" tone="light" />
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section
            id="map"
            data-presence-state="answering"
            data-presence-label="Ready"
            className={styles.section}
            aria-labelledby="map-title"
          >
            <div className={styles.head} data-reveal>
              <h2 id="map-title" className={styles.h2}>
                Everything it does, <span className={styles.h2Soft}>in one assistant</span>
              </h2>
            </div>
            <CapabilityMap />
          </section>

          <section
            id="get"
            data-presence-state="listening"
            data-presence-label="Ready when you are"
            className={styles.section}
            aria-labelledby="get-title"
          >
            <div className={styles.head} data-reveal>
              <h2 id="get-title" className={styles.h2}>
                One assistant,
                <span className={styles.h2Soft}> on every screen you work on</span>
              </h2>
              <p className={styles.lead}>
                Start on one, finish on the other. Your Mac points and does; your iPhone sees the
                world with you.
              </p>
            </div>
            {EARLY_ACCESS ? <EarlyAccess /> : null}
            <div className={`${styles.tray} ${styles.trayThree}`} data-stagger>
              {platforms.map((p) => (
                <article key={p.name} className={styles.plan}>
                  <p className={styles.planName}>
                    <span className={styles.cardIcon}>
                      <Icon name={p.icon} size={20} />
                    </span>
                    {p.name}
                  </p>
                  <p className={styles.planLead}>{p.lead}</p>
                  <p className={styles.planBig}>{p.big}</p>
                  <ul className={styles.planList}>
                    {p.items.map((it) => (
                      <li key={it}>
                        <span className={styles.planTick}>
                          <Icon name="check" size={16} />
                        </span>
                        {it}
                      </li>
                    ))}
                  </ul>
                  <Cta href={p.cta.href} arrow={false} block external={p.cta.external}>
                    {p.cta.label}
                  </Cta>
                </article>
              ))}
            </div>
          </section>

          <section
            id="faq"
            data-presence-state="answering"
            data-presence-label="Answering"
            className={`${styles.section} ${styles.faq}`}
            aria-labelledby="faq-title"
          >
            <div className={styles.headLeft} data-reveal>
              <h2 id="faq-title" className={styles.h2}>
                Questions
              </h2>
              <p className={styles.lead}>
                What Tandrix does, how it keeps you in control, and what stays on your Mac.
              </p>
            </div>
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
        </main>
      </ScrollReveals>

      <section className={styles.closing} aria-labelledby="closing-title">
        <div className={styles.closingCopy}>
          <h2 id="closing-title" className={styles.closingTitle}>
            Say what you want done.
            <span>Tandrix takes it from there.</span>
          </h2>
          <p>
            Learn the app, finish the task, build the thing, with every step pointed out and
            checked.
          </p>
          <div className={styles.heroCtas}>
            <Cta href={MAC_DOWNLOAD_URL} tone="white" external={isExternal(MAC_DOWNLOAD_URL)}>
              Download for Mac
            </Cta>
            <Cta
              href={IPHONE_DOWNLOAD_URL}
              tone="glass"
              arrow={false}
              external={isExternal(IPHONE_DOWNLOAD_URL)}
            >
              Get for iPhone
            </Cta>
          </div>
        </div>
      </section>

      <footer className={styles.footer}>
        <div className={styles.footerTop}>
          <div className={styles.footerBrand}>
            <BrandWordmark href="#top" size="lg" className={styles.brand} />
            <p>One assistant for everything you want to get done, on your Mac and your iPhone.</p>
          </div>
          <nav className={styles.footerLinks} aria-label="Footer">
            <a href="#what">What it does</a>
            <a href="#day">A day with it</a>
            <a href="#explore">Uses</a>
            <a href="#faq">Questions</a>
            <a href="/technical">How Tandrix works</a>
            {SOURCE_URL ? (
              <a href={SOURCE_URL} target="_blank" rel="noreferrer">
                Source
              </a>
            ) : null}
          </nav>
        </div>
        <div className={styles.footerGet}>
          <p>Get Tandrix</p>
          <div className={styles.footerButtons}>
            <Cta href={MAC_DOWNLOAD_URL} tone="white" external={isExternal(MAC_DOWNLOAD_URL)}>
              Mac
            </Cta>
            <Cta
              href={IPHONE_DOWNLOAD_URL}
              tone="outline"
              external={isExternal(IPHONE_DOWNLOAD_URL)}
            >
              iPhone
            </Cta>
          </div>
        </div>
        <div className={styles.footerBottom}>
          <span>© 2026 Tandrix</span>
          <a href="/credits">Photo and video credits</a>
        </div>
      </footer>
    </div>
  );
}
