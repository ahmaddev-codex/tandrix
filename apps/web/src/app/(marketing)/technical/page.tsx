import { BrandMark, Icon } from "@tandrix/ui/web";
import type { Metadata } from "next";
import { Photo } from "@/components/scenes/Photo";
import { excelPhoto, manualPhoto, partsPhoto } from "@/components/scenes/photos";
import { ActivePill } from "@/components/ui/ActivePill";
import { Anatomy } from "@/components/widgets/Anatomy";
import { Cta } from "@/components/ui/Cta";
import { MAC_DOWNLOAD_URL, isExternal } from "@/lib/downloads";

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
    <div className="min-h-screen bg-page p-3 text-ink [--gap:clamp(72px,9vw,128px)]">
      <header className="grid justify-items-start gap-[22px] rounded-[28px] bg-technical-sky px-[clamp(20px,5vw,64px)] pt-10 pb-[clamp(56px,8vw,96px)] text-white">
        <a
          href="/"
          className="inline-flex items-center gap-2.5 text-base font-semibold text-white no-underline hover:underline hover:underline-offset-[5px]"
        >
          <BrandMark size={22} /> Tandrix
        </a>
        <ActivePill state="looking" label="Looking at your screen" />
        <h1 className="mt-5 text-[clamp(40px,5.6vw,72px)] leading-[1.02] font-medium tracking-[-0.05em]">
          How Tandrix works
        </h1>
        <p className="max-w-[600px] text-lg leading-[1.55] text-white/[0.94]">
          What it adds on top of what you&apos;re doing, what it does on your Mac and your iPhone,
          and how it keeps you in control.
        </p>
      </header>

      <main className="mx-auto grid max-w-[1240px] gap-(--gap) px-[clamp(8px,3vw,40px)] py-(--gap)">
        <section aria-labelledby="anatomy-title">
          <div className="mb-[clamp(32px,5vw,56px)] grid max-w-[640px] gap-3">
            <h2
              id="anatomy-title"
              className="text-[clamp(30px,3.6vw,48px)] leading-[1.05] font-medium tracking-[-0.045em]"
            >
              Inside Tandrix
            </h2>
            <p className="text-[17px] text-text-2">
              Six layers over the thing you&apos;re working on. Together, they show you the way.
            </p>
          </div>
          <Anatomy />
        </section>

        <section
          aria-labelledby="mac-title"
          className="grid grid-cols-1 items-center gap-[clamp(32px,6vw,80px)] min-[761px]:grid-cols-2"
        >
          <div>
            <h2
              id="mac-title"
              className="text-[clamp(30px,3.6vw,48px)] leading-[1.05] font-medium tracking-[-0.045em]"
            >
              On your Mac
            </h2>
            <dl className="mt-7 grid gap-[22px] [&_dd]:mt-1.5 [&_dd]:text-base [&_dd]:leading-[1.6] [&_dd]:text-text-2 [&_dt]:text-lg [&_dt]:font-medium">
              {mac.map((m) => (
                <div key={m.title}>
                  <dt>{m.title}</dt>
                  <dd>{m.body}</dd>
                </div>
              ))}
            </dl>
          </div>
          <Photo
            spec={excelPhoto}
            className="rounded-2xl shadow-[0_0_0_1px_rgba(0,0,0,0.06),0_1px_2px_rgba(9,40,90,0.06),0_10px_24px_-18px_rgba(9,40,90,0.22)]"
          />
        </section>

        <section
          aria-labelledby="phone-title"
          className="grid grid-cols-1 items-center gap-[clamp(32px,6vw,80px)] min-[761px]:grid-cols-2 min-[761px]:[&>:first-child]:order-2"
        >
          <div>
            <h2
              id="phone-title"
              className="text-[clamp(30px,3.6vw,48px)] leading-[1.05] font-medium tracking-[-0.045em]"
            >
              On your iPhone
            </h2>
            <dl className="mt-7 grid gap-[22px] [&_dd]:mt-1.5 [&_dd]:text-base [&_dd]:leading-[1.6] [&_dd]:text-text-2 [&_dt]:text-lg [&_dt]:font-medium">
              {phone.map((m) => (
                <div key={m.title}>
                  <dt>{m.title}</dt>
                  <dd>{m.body}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div className="grid gap-4">
            <Photo
              spec={manualPhoto}
              className="rounded-2xl shadow-[0_0_0_1px_rgba(0,0,0,0.06),0_1px_2px_rgba(9,40,90,0.06),0_10px_24px_-18px_rgba(9,40,90,0.22)]"
            />
            <Photo
              spec={partsPhoto}
              className="rounded-2xl shadow-[0_0_0_1px_rgba(0,0,0,0.06),0_1px_2px_rgba(9,40,90,0.06),0_10px_24px_-18px_rgba(9,40,90,0.22)]"
            />
          </div>
        </section>

        <section aria-labelledby="safe-title">
          <h2
            id="safe-title"
            className="text-[clamp(30px,3.6vw,48px)] leading-[1.05] font-medium tracking-[-0.045em]"
          >
            You stay in control
          </h2>
          <div className="mt-8 grid grid-cols-1 gap-3 rounded-[30px] bg-mist p-3 min-[761px]:grid-cols-2 lg:grid-cols-4">
            {safe.map((g) => (
              <article
                key={g.title}
                className="grid content-start gap-3 rounded-[20px] bg-paper p-[22px] [&_h3]:text-xl [&_h3]:font-medium [&_h3]:tracking-[-0.02em] [&_p]:text-[15px] [&_p]:leading-[1.55] [&_p]:text-text-2"
              >
                <span className="grid size-10 place-items-center rounded-xl bg-highlight text-white">
                  <Icon name={g.icon} size={20} />
                </span>
                <h3>{g.title}</h3>
                <p>{g.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section aria-labelledby="privacy-title" className="max-w-[760px]">
          <h2
            id="privacy-title"
            className="text-[clamp(30px,3.6vw,48px)] leading-[1.05] font-medium tracking-[-0.045em]"
          >
            Your privacy
          </h2>
          <ul className="mt-7 grid list-none gap-4 p-0 text-base leading-normal">
            {privacy.map((p) => (
              <li key={p} className="flex gap-3">
                <span className="inline-grid size-6 flex-none place-items-center rounded-full bg-highlight text-white">
                  <Icon name="check" size={16} />
                </span>
                {p}
              </li>
            ))}
          </ul>
        </section>

        <section className="flex flex-wrap justify-center gap-3">
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
