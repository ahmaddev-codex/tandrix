import type { Metadata } from "next";
import { Closer, PageShell } from "@/components/page/Page";

export const metadata: Metadata = {
  title: "What's new",
  description: "What changed in Tandrix for Mac and iPhone, newest first.",
};

interface Release {
  date: string;
  /** Machine-readable, for <time>. */
  iso: string;
  items: Array<{ where: "Mac" | "iPhone" | "Mac and iPhone"; title: string; body: string }>;
}

const releases: Release[] = [
  {
    date: "31 October 2026",
    iso: "2026-10-31",
    items: [
      {
        where: "iPhone",
        title: "Point the camera",
        body: "Hold your phone up to something and ask what it is or where it goes. Tandrix outlines what it means and says the answer.",
      },
      {
        where: "Mac",
        title: "Learn it step by step",
        body: "Say what you want to learn or get done in an app. Tandrix writes the steps, shows you each one and checks your screen.",
      },
      {
        where: "Mac",
        title: "Show me, faster and on target",
        body: "Answers in two to six seconds, and the pointer lands inside the right control. A slow answer is asked again.",
      },
      {
        where: "Mac",
        title: "See what it's doing",
        body: "While it works on a task, the bar at the top says what it's doing now: “Opening your calendar”.",
      },
      {
        where: "Mac",
        title: "Only Esc stops a task",
        body: "Brushing the trackpad no longer throws the work away. Esc, or the hotkey, stops it at once.",
      },
    ],
  },
  {
    date: "30 October 2026",
    iso: "2026-10-30",
    items: [
      {
        where: "Mac",
        title: "Tasks across apps, in one go",
        body: "“Grab the interview lineup from WhatsApp and add it to my calendar” now goes straight through, without going back and forth.",
      },
      {
        where: "Mac",
        title: "Work in the background",
        body: "Tasks that don't need your screen run alongside you, with web tasks in Tandrix's own browser.",
      },
      {
        where: "Mac",
        title: "Only answer my voice",
        body: "Teach Tandrix your voice and “Hey Tandrix” wakes it only for you. The voiceprint stays on your Mac.",
      },
      {
        where: "Mac",
        title: "Settings",
        body: "One page for how Tandrix helps, how it listens and what to call you.",
      },
      {
        where: "iPhone",
        title: "Manuals offline",
        body: "Open a project once with signal and its manual and step pictures stay on your phone for the job site.",
      },
      {
        where: "iPhone",
        title: "A cleaner app",
        body: "A new look, with a floating tab bar and quicker switching between tabs.",
      },
    ],
  },
  {
    date: "29 October 2026",
    iso: "2026-10-29",
    items: [
      {
        where: "Mac",
        title: "“Hey Tandrix”",
        body: "A wake word, heard on your Mac only.",
      },
      {
        where: "iPhone",
        title: "Share a report",
        body: "Send a project's report as a private link that expires on its own.",
      },
    ],
  },
  {
    date: "27 October 2026",
    iso: "2026-10-27",
    items: [
      {
        where: "Mac",
        title: "Do it for me",
        body: "Hand Tandrix the task and it does it, asking before anything that sends, pays or deletes.",
      },
      {
        where: "Mac",
        title: "Hold ⌥⌘ to talk",
        body: "In any app. Let go to ask.",
      },
      {
        where: "Mac and iPhone",
        title: "A natural voice",
        body: "Tandrix answers out loud, in a voice that sounds like a person.",
      },
    ],
  },
];

export default function WhatsNewPage() {
  return (
    <PageShell
      pill={{ state: "answering", label: "Tandrix" }}
      title="What's new"
      lead="What changed in Tandrix for Mac and iPhone, newest first."
    >
      <ol className="m-0 grid list-none gap-[clamp(48px,7vw,88px)] p-0">
        {releases.map((r) => (
          <li
            key={r.iso}
            className="grid gap-6 min-[761px]:grid-cols-[200px_1fr] min-[761px]:gap-[clamp(32px,5vw,72px)]"
          >
            <h2 className="text-[clamp(22px,2.2vw,28px)] leading-tight font-medium tracking-[-0.03em] min-[761px]:sticky min-[761px]:top-6 min-[761px]:self-start">
              <time dateTime={r.iso}>{r.date}</time>
            </h2>
            <ul className="m-0 grid list-none gap-3 rounded-[30px] bg-mist p-3">
              {r.items.map((i) => (
                <li key={i.title} className="grid gap-2 rounded-[20px] bg-paper p-[22px]">
                  <span className="text-[13px] font-medium text-highlight">{i.where}</span>
                  <h3 className="text-xl font-medium tracking-[-0.02em]">{i.title}</h3>
                  <p className="text-[15px] leading-[1.55] text-text-2">{i.body}</p>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
      <Closer next={{ href: "/mac", label: "Tandrix for Mac" }} />
    </PageShell>
  );
}
