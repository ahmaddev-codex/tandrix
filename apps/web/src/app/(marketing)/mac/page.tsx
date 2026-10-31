import type { Metadata } from "next";
import { CardTray, Closer, Feature, PageShell, cardShadow } from "@/components/page/Page";
import { Photo } from "@/components/scenes/Photo";
import { analyticsPhoto, calendarPhoto, excelPhoto, wifiPhoto } from "@/components/scenes/photos";

export const metadata: Metadata = {
  title: "Tandrix for Mac",
  description:
    "Ask about anything on your screen and Tandrix points at it. Learn an app step by step, or hand it the whole task.",
};

export default function MacPage() {
  return (
    <PageShell
      pill={{ state: "looking", label: "Looking at your screen" }}
      title="Tandrix for Mac"
      lead="It sits over whatever you're working in. Ask, and it points at the answer on your screen. Ask it to teach you, and it goes a step at a time. Ask it to do it, and it does."
    >
      <Feature
        id="show-me"
        title="Show me"
        lead="Ask about anything on screen, by voice or by typing. Tandrix rings the control to use, points at it and says the next step."
        points={[
          {
            title: "It points at the right thing",
            body: "In our tests across Mail, Settings, Photos and a spreadsheet, the pointer landed inside the right control 20 times out of 20, small icons included.",
          },
          {
            title: "It answers in a few seconds",
            body: "Most answers come in two to six seconds. When one is slow, Tandrix asks again and takes whichever answer comes first.",
          },
          {
            title: "It says what to do, not what it's doing",
            body: "“Click Insert, then PivotTable.” The instruction, in the app's own words.",
          },
        ]}
        media={<Photo spec={excelPhoto} className={cardShadow} />}
      />

      <Feature
        id="learn"
        flip
        title="Learn it step by step"
        lead="For something bigger than one answer, say what you want to learn or get done. Tandrix writes the steps and stays with you through each one."
        points={[
          {
            title: "A plan you can see",
            body: "“Make a pivot table of my budget in Numbers” becomes a list of steps, each one thing to do on screen.",
          },
          {
            title: "Shown, then checked",
            body: "Each step has Show me for where to click, and a screen check that looks at your screen and tells you it's done or what to fix.",
          },
          {
            title: "It keeps your place",
            body: "Progress is saved like any project, so you can stop and pick it up tomorrow, or carry on from your phone.",
          },
        ]}
        media={<Photo spec={analyticsPhoto} className={cardShadow} />}
      />

      <Feature
        id="do-it"
        title="Do it for me"
        lead="Hand it the whole task. Tandrix opens the apps it needs, does the steps with its own pointer, and tells you when it's done."
        points={[
          {
            title: "Across apps, in one go",
            body: "“Grab the interview lineup from my WhatsApp and add it to my calendar.” It reads the chat, notes the times, opens Calendar and adds each one.",
          },
          {
            title: "You watch it work",
            body: "Its pointer moves to each control as it goes, and the bar at the top shows what it's working on.",
          },
          {
            title: "Esc stops it",
            body: "Press Esc at any point and it stops and hands back control. Anything that sends, pays, deletes or signs in waits for your yes.",
          },
        ]}
        media={<Photo spec={calendarPhoto} className={cardShadow} />}
        flip
      />

      <Feature
        id="talk"
        title="Talk to it"
        lead="No window to find. Hold two keys and say it."
        points={[
          {
            title: "Hold ⌥⌘",
            body: "Hold Option and Command in any app, say what you want, and let go.",
          },
          {
            title: "Or say “Hey Tandrix”",
            body: "Switch on the wake word and it listens for its name, on your Mac only. Nothing leaves until you've said it.",
          },
          {
            title: "Only your voice",
            body: "Teach it your voice and it answers you, not the TV or someone across the room.",
          },
        ]}
        media={<Photo spec={wifiPhoto} className={cardShadow} />}
      />

      <CardTray
        id="background"
        title="While you keep working"
        lead="Some jobs don't need your screen. Tandrix does those in the background, so your mouse and keyboard stay yours."
        cards={[
          {
            icon: "actions",
            title: "Several at once",
            body: "Ask for another task while one runs. Unrelated tasks run side by side instead of queueing.",
          },
          {
            icon: "monitor",
            title: "Its own browser",
            body: "Web tasks run in a Tandrix browser profile out of sight, never in the window you're using.",
          },
          {
            icon: "check",
            title: "Told when it's done",
            body: "A notification with what it did, and the answer in the panel when you look.",
          },
        ]}
      />

      <Closer next={{ href: "/iphone", label: "Tandrix for iPhone" }} />
    </PageShell>
  );
}
