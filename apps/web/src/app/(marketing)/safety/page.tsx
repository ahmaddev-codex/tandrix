import { Icon } from "@tandrix/ui/web";
import type { Metadata } from "next";
import { CardTray, Closer, PageShell, heading } from "@/components/page/Page";

export const metadata: Metadata = {
  title: "Safety and privacy",
  description:
    "How Tandrix keeps you in control of your Mac and your work, and what it keeps, for how long, and where.",
};

/** What Tandrix sees, and what becomes of it. */
const data = [
  {
    what: "Your screen, when you ask",
    kept: "Sent to answer you, then not kept. Tandrix looks only when you ask something or give it a task.",
  },
  {
    what: "Your camera, when you point it",
    kept: "The frame you ask about is sent to answer you, then not kept.",
  },
  {
    what: "Photos and screen checks in a project",
    kept: "Saved with that project, so its report shows what was checked. Delete the project and they go with it.",
  },
  {
    what: "“Hey Tandrix”",
    kept: "Heard on your Mac. Nothing leaves it until you've said Tandrix's name.",
  },
  {
    what: "Your voiceprint",
    kept: "24 numbers that describe how your voice sounds, kept on your Mac only. No recording is kept.",
  },
  {
    what: "Reports you share",
    kept: "Private links that expire on their own, and that you can turn off sooner.",
  },
];

export default function SafetyPage() {
  return (
    <PageShell
      pill={{ state: "doing", label: "Esc to stop" }}
      title="Safety and privacy"
      lead="Tandrix can see your screen and use your Mac. Here's how you stay in charge of it, and what it keeps."
    >
      <CardTray
        id="control"
        title="You stay in control"
        lead="Doing things for you is only useful if you can trust it not to do the wrong thing."
        cards={[
          {
            icon: "stop",
            title: "Esc stops it",
            body: "Press Esc, or the Tandrix hotkey, and it stops at once and hands back control.",
          },
          {
            icon: "hand",
            title: "Asks before it acts",
            body: "Anything that sends, pays, deletes, signs in or changes security settings waits for your yes.",
          },
          {
            icon: "eyeOff",
            title: "Never types secrets",
            body: "It won't type into password fields or enter passwords, card numbers or codes for you.",
          },
          {
            icon: "pointer",
            title: "You see it working",
            body: "Its own pointer shows where it's acting, and the bar at the top says what it's doing.",
          },
        ]}
      />

      <CardTray
        id="work"
        title="Safe work, checked work"
        lead="On the job, the order things happen in matters."
        cards={[
          {
            icon: "power",
            title: "Safe steps first",
            body: "Steps with power, pressure, moving parts or heat wait until you confirm the equipment is safe.",
          },
          {
            icon: "alert",
            title: "No live electrical work",
            body: "Tandrix won't guide wiring or work on anything live. It says why, and who to call.",
          },
          {
            icon: "book",
            title: "Sources shown",
            body: "Steps cite the manual page they came from. Steps without one are labelled as general practice.",
          },
          {
            icon: "check",
            title: "Checked, not guessed",
            body: "Each step is checked from a photo or your screen before you move on.",
          },
        ]}
      />

      <section aria-labelledby="data-title">
        <div className="grid max-w-[640px] gap-3">
          <h2 id="data-title" className={heading}>
            What Tandrix keeps
          </h2>
          <p className="text-[17px] leading-[1.6] text-text-2">
            Your projects are yours: no one else can see them. Here&apos;s everything else.
          </p>
        </div>
        <dl className="mt-8 grid gap-3 rounded-[30px] bg-mist p-3 min-[761px]:grid-cols-2">
          {data.map((d) => (
            <div
              key={d.what}
              className="m-0 grid content-start gap-2 rounded-[20px] bg-paper p-[22px]"
            >
              <dt className="flex items-center gap-2.5 text-lg font-medium tracking-[-0.01em]">
                <Icon
                  name="sealCheck"
                  size={20}
                  weight="fill"
                  className="flex-none text-highlight"
                />
                {d.what}
              </dt>
              <dd className="m-0 text-[15px] leading-[1.55] text-text-2">{d.kept}</dd>
            </div>
          ))}
        </dl>
      </section>

      <Closer next={{ href: "/technical", label: "How Tandrix works" }} />
    </PageShell>
  );
}
