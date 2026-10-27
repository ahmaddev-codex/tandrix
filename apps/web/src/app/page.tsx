// The Tandrix site: what it does on the bench (phone) and on screen (Mac), shown with the real
// product: design-system components, a real part outline from a test run, and real photos.
import {
  CheckResult,
  HandoffBanner,
  Icon,
  ModeToggle,
  StepCard,
  StepVisual,
} from "@tandrix/ui/web";
import type { IconName } from "@tandrix/ui";
import Image from "next/image";
import { AppWindow } from "../components/AppWindow";
import { Viewfinder } from "../components/Viewfinder";
import styles from "./page.module.css";

const intake: Array<{ title: string; note: string }> = [
  { title: "Read the label", note: "Raspberry Pi 5" },
  { title: "Get the manual", note: "Build kit, 22 pages" },
  { title: "Write the steps", note: "10 steps, 9 from the manual" },
  { title: "Check the parts", note: "Ethernet cable missing" },
];

const careful: Array<{ icon: IconName; title: string; body: string }> = [
  {
    icon: "power",
    title: "Safe before it starts",
    body: "A step that needs the power off or the pressure released waits until you confirm it.",
  },
  {
    icon: "stop",
    title: "Knows where to stop",
    body: "It won't guide live electrical, gas or refrigerant work, and says who should do it instead.",
  },
  {
    icon: "hand",
    title: "Asks before it acts",
    body: "Doing it for you, Tandrix asks before anything that sends, pays or deletes. Move the mouse and you have control back.",
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
            <a href="#bench">Phone</a>
            <a href="#screen">Mac</a>
            <a href="#careful">Safety</a>
          </nav>
        </div>
      </header>

      <main id="top">
        <section className={styles.hero} aria-labelledby="hero-title">
          <div className={styles.heroCopy}>
            <h1 id="hero-title" className="display-48">
              A clear next step, right where you need it.
            </h1>
            <p className={styles.lead}>
              On your phone, Tandrix turns a goal and a manual into checked steps. On your Mac, ask
              about the app in front of you and it points to what to do.
            </p>
            <div className={styles.ctas}>
              <a className="tx-btn tx-btn-primary tx-btn-lg" href="#bench">
                See phone guidance
              </a>
              <a className="tx-btn tx-btn-secondary tx-btn-lg" href="#screen">
                See Mac guidance
              </a>
            </div>
            <p className={styles.small}>
              For iPhone and Mac. A manual helps, but you can start without one.
            </p>
          </div>
          <Viewfinder />
        </section>

        <section id="bench" className={styles.bench} aria-labelledby="bench-title">
          <div className={styles.benchPhoto}>
            <Image
              src="/photos/technician-rack.jpg"
              alt="A technician in a hi-vis vest working at an open server rack, tools on the floor"
              fill
              sizes="(max-width: 900px) 100vw, 42vw"
              className={styles.cover}
            />
          </div>
          <div className={styles.benchCopy}>
            <h2 id="bench-title" className="heading-32">
              Build, repair, install. One clear step at a time.
            </h2>
            <p className={styles.body}>
              Building a home server, fitting a pump seal, wiring a rack: say what you're doing and
              show Tandrix what you have. It does the reading, so you can keep your hands on the
              work.
            </p>
          </div>
        </section>

        <ol className={styles.sequence} aria-label="How a project goes">
          <li className={styles.stage}>
            <div className={styles.stageText}>
              <span className={styles.num}>1</span>
              <h3 className="heading-18">Show it what you have</h3>
              <p className={styles.body}>
                A photo of the label, the parts laid out, where you've got to. Tandrix reads the
                model, finds the manual and checks nothing's missing, before you pick up a tool.
              </p>
            </div>
            <div className={styles.stageVisual}>
              <div className={styles.intake}>
                <Image
                  src="/photos/fitting-ssd.jpg"
                  alt="Hands fitting an SSD into a computer case"
                  width={2000}
                  height={1333}
                  sizes="(max-width: 900px) 100vw, 520px"
                  className={styles.intakePhoto}
                />
                <ul className={styles.stages} aria-label="Setting up">
                  {intake.map((s, i) => (
                    <li key={s.title}>
                      <Icon name={i === 3 ? "alert" : "check"} size={20} />
                      <span>
                        <b>{s.title}</b>
                        <span className={i === 3 ? styles.warn : undefined}>{s.note}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </li>

          <li className={styles.stage}>
            <div className={styles.stageText}>
              <span className={styles.num}>2</span>
              <h3 className="heading-18">Every step from the manual</h3>
              <p className={styles.body}>
                One action per step, with the page it came from and the picture that goes with it.
                Steps the manual doesn't cover say so.
              </p>
            </div>
            <div className={styles.stageVisual}>
              <StepCard
                index={3}
                total={10}
                title="Press both pins down until they click"
                body="Hold the cooler over the board with the fan above the processor and the pins over the two holes."
                status="pending"
                statusLabel="To do"
                source="Manual p.1"
                visual={
                  <StepVisual
                    items={[
                      {
                        id: "manual",
                        label: "Manual p.1",
                        source: "Manual p.1",
                        sourceKind: "manual",
                        src: "/photos/kit-sheet-p1.jpg",
                        alt: "The kit sheet's page 1: what's in the box and how to fit the cooler",
                        aspectRatio: 1240 / 1754,
                      },
                    ]}
                  />
                }
              />
            </div>
          </li>

          <li className={styles.stage}>
            <div className={styles.stageText}>
              <span className={styles.num}>3</span>
              <h3 className="heading-18">It checks your work</h3>
              <p className={styles.body}>
                Take a photo when you're done. Tandrix says whether it looks right and why, and says
                plainly when a photo can't show it.
              </p>
            </div>
            <div className={`${styles.stageVisual} ${styles.checks}`}>
              <CheckResult
                result="fail"
                reason="The Active Cooler isn't on the board yet. Fit it over the processor, then check again."
                evidence="Photo 10:41"
                thumbnail={
                  <Image
                    src="/photos/pi5-board.jpg"
                    alt="The bare board"
                    width={176}
                    height={130}
                  />
                }
              />
              <CheckResult
                result="pass"
                reason="The cooler sits flat over the processor with both pins through the board."
                evidence="Photo 10:46"
                thumbnail={
                  <Image
                    src="/photos/pi5-board-cooler.jpg"
                    alt="The board with the cooler fitted"
                    width={176}
                    height={130}
                  />
                }
              />
            </div>
          </li>
        </ol>

        <section id="screen" className={styles.screen} aria-labelledby="screen-title">
          <div className={styles.screenCopy}>
            <h2 id="screen-title" className="heading-32">
              Ask about the app. Tandrix shows you where to click.
            </h2>
            <p className={styles.body}>
              Photoshop, a spreadsheet, your router's settings: ask out loud and let go. Tandrix
              looks at your screen, points at the control, and tells you what to do. Nothing else on
              your screen changes.
            </p>
          </div>
          <AppWindow
            presence={{
              state: "answering",
              label: "Tandrix",
              text: "Click Choose storage to pick your card.",
            }}
            pointer={{ x: "70.2%", y: "55.4%", caption: "Choose storage" }}
          />
          <div className={styles.screenPair}>
            <figure className={styles.photoCard}>
              <Image
                src="/photos/editing-app.jpg"
                alt="A photo editing app open on a laptop"
                width={2000}
                height={1333}
                sizes="(max-width: 900px) 100vw, 480px"
                className={styles.photoFill}
              />
              <figcaption>Learn the app you're in, from the screen you're on.</figcaption>
            </figure>
            <div className={styles.doIt}>
              <h3 className="heading-18">Let Tandrix take the action, one step at a time.</h3>
              <p className={styles.body}>
                Switch on Do it for me and say what you want done: turn on notifications, sort a
                table, add an appointment. Tandrix opens the app it needs and works one step at a
                time, showing each click a second before it happens.
              </p>
              <ModeToggle mode="do" />
            </div>
          </div>
        </section>

        <section className={styles.handoff} aria-labelledby="handoff-title">
          <div>
            <h2 id="handoff-title" className="heading-24">
              Starts on the phone, finishes on the Mac.
            </h2>
            <p className={styles.body}>
              When a job reaches a step done on a computer, like writing the operating system to the
              card, send it to your Mac. It opens there at that step, and your phone shows it ticked
              off when it's done.
            </p>
          </div>
          <HandoffBanner state="offer" step={5} stepTitle="Write Raspberry Pi OS to the card" />
        </section>

        <section id="careful" className={styles.careful} aria-labelledby="careful-title">
          <h2 id="careful-title" className="heading-24">
            Careful by default
          </h2>
          <ul className={styles.carefulList}>
            {careful.map((c) => (
              <li key={c.title}>
                <Icon name={c.icon} size={20} />
                <h3 className="heading-16">{c.title}</h3>
                <p className={styles.body}>{c.body}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className={styles.closing} aria-labelledby="closing-title">
          <Image src="/photos/desk-setup.jpg" alt="" fill sizes="100vw" className={styles.cover} />
          <div className={styles.closingInner}>
            <h2 id="closing-title" className="heading-32">
              Bring an engineer to your next job.
            </h2>
            <p>Tandrix is in early testing on iPhone and Mac.</p>
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        <span>Tandrix</span>
        <a href="/photos/CREDITS.md">Photo credits</a>
      </footer>
    </>
  );
}
