// The homepage's words and the scenes beside them. Sections render these; edit copy here.
import type { IconName } from "@tandrix/ui";
import type { ReactNode } from "react";
import { DeskFigure } from "@/components/figures/desk/figure";
import { SeatedFigure } from "@/components/figures/kit/figure";
import { CheckCard, GateCard, VoiceCard } from "@/components/scenes/Scenes";
import type { Moment } from "@/components/widgets/DayTimeline";
import type { Place } from "@/components/widgets/Explorer";
import {
  DoingTile,
  GateTile,
  KeysTile,
  ListeningTile,
  MarkTile,
  PhotoTile,
  VerifiedTile,
  VideoTile,
} from "@/components/widgets/Tiles";
import {
  EARLY_ACCESS,
  GET_MAC_LABEL,
  IPHONE_DOWNLOAD_URL,
  MAC_DOWNLOAD_URL,
  isExternal,
} from "@/lib/downloads";

/** The hero carousel: real photos and footage between the moments Tandrix shows on screen. */
export const ring: ReactNode[] = [
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

export const moments: Moment[] = [
  {
    time: "8 AM",
    tag: "Learning",
    title: "Learn the new spreadsheet",
    body: "Ask where things are and Tandrix rings the control on your screen, then says the next step out loud. Say “teach me” and it goes one step at a time.",
    ask: "Teach me pivot tables",
    scene: (
      <DeskFigure
        focus="sheet"
        label="The laptop on the desk, with PivotTable ringed on the spreadsheet"
      />
    ),
  },
  {
    time: "12 PM",
    tag: "At home",
    title: "Get back on the Wi‑Fi",
    body: "It looks at your screen, finds the setting, and points at it. You click; it checks it worked before moving on.",
    ask: "Why can't my Mac see the Wi‑Fi?",
    scene: (
      <DeskFigure
        focus="wifi"
        label="The laptop's Wi‑Fi settings with your network ringed, and the router beside it"
      />
    ),
  },
  {
    time: "4 PM",
    tag: "Hands-on",
    title: "Assemble the shelf",
    body: "Photograph the label and Tandrix finds the manual. Point your phone at the parts and it outlines what's there and what's missing.",
    ask: "Walk me through the shelf",
    scene: (
      <DeskFigure
        focus="kit"
        label="The parts tray and the manual, with the parts for this step ringed"
      />
    ),
  },
  {
    time: "7 PM",
    tag: "Do it for me",
    title: "Book the dentist",
    body: "Hand over the task. Tandrix opens Calendar, does the steps, and asks before it sends anything. Press Esc and you're back in control.",
    ask: "Book my dentist for Thursday at ten",
    scene: <DeskFigure focus="calendar" label="The laptop calendar, with Thursday at ten ringed" />,
  },
];

export const places: Place[] = [
  {
    name: "At home",
    tasks: [
      {
        name: "Join the Wi‑Fi",
        scene: (
          <DeskFigure
            focus="wifi"
            only={["laptop", "router"]}
            label="Wi‑Fi settings ringed on the laptop"
          />
        ),
      },
      {
        name: "Book the dentist",
        scene: (
          <DeskFigure
            focus="calendar"
            only={["laptop", "phone"]}
            label="Thursday at ten ringed in the calendar"
          />
        ),
      },
      { name: "Make it safe first", scene: <GateCard /> },
    ],
  },
  {
    name: "At work",
    tasks: [
      {
        name: "Build a pivot table",
        scene: (
          <DeskFigure
            focus="sheet"
            only={["laptop"]}
            label="PivotTable ringed on the spreadsheet"
          />
        ),
      },
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
          <DeskFigure
            focus="kit"
            only={["tray", "phone"]}
            label="The phone checking the parts tray"
          />
        ),
      },
      {
        name: "Name a part",
        scene: (
          <DeskFigure
            focus="kit"
            only={["manual", "tray"]}
            label="The manual beside the parts it names"
          />
        ),
      },
      { name: "Check a step", scene: <CheckCard /> },
    ],
  },
  {
    name: "Learning",
    tasks: [
      {
        name: "Learn a spreadsheet",
        scene: (
          <DeskFigure
            focus="sheet"
            only={["laptop"]}
            label="PivotTable ringed on the spreadsheet"
          />
        ),
      },
      {
        name: "Learn your settings",
        scene: (
          <DeskFigure
            focus="wifi"
            only={["laptop", "router"]}
            label="Wi‑Fi settings ringed on the laptop"
          />
        ),
      },
    ],
  },
];

export const uses: Array<{ icon: IconName; title: string; body: string }> = [
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
];

export const asks: Array<{
  figure: ReactNode;
  line: string;
  when: string;
  ask: string;
  reply: string;
}> = [
  {
    figure: (
      <DeskFigure
        focus="wifi"
        only={["laptop", "router"]}
        label="Wi‑Fi settings ringed on the laptop, the router beside it"
        width={400}
        height={300}
      />
    ),
    line: "router",
    when: "11 pm, a blinking router",
    ask: "Why can't my Mac see the Wi‑Fi?",
    reply: "It's waiting for Wi‑Fi. Open Settings, then Network, and pick yours.",
  },
  {
    figure: (
      <DeskFigure
        focus="sheet"
        only={["laptop"]}
        label="PivotTable ringed on the laptop screen"
        width={400}
        height={300}
      />
    ),
    line: "teach",
    when: "A new app at work",
    ask: "Teach me pivot tables",
    reply: "Click any cell, then Insert, then PivotTable. Say next when that's done.",
  },
  {
    figure: (
      <DeskFigure
        focus="kit"
        only={["manual"]}
        label="The manual open, with step one ringed"
        width={400}
        height={300}
      />
    ),
    line: "setup",
    when: "A new kit on the bench",
    ask: "Walk me through my first setup",
    reply: "Found the manual: six steps. Show me the parts laid out and we'll start.",
  },
  {
    figure: <SeatedFigure />,
    line: "seated",
    when: "Mid-build, screwdriver in hand",
    ask: "Is this part seated right?",
    reply: "Not yet. The left clip is still up. Press it down until it clicks, then show me again.",
  },
  {
    figure: (
      <DeskFigure
        focus="calendar"
        only={["laptop", "phone"]}
        label="Thursday at ten ringed in the laptop calendar"
        width={400}
        height={300}
      />
    ),
    line: "dentist",
    when: "The task behind the task",
    ask: "And book my dentist after this",
    reply: "Queued. I'll do it next, and ask you before anything is sent.",
  },
];

export const platforms: Array<{
  icon: IconName;
  name: string;
  lead: string;
  big: string;
  items: string[];
  cta: { label: string; href: string; external: boolean };
}> = [
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
      label: GET_MAC_LABEL,
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
];

export const faqs: Array<{ id?: string; q: string; a: string }> = [
  {
    q: "What can I ask Tandrix?",
    a: "Anything you're trying to get done on your Mac or in front of you: learning an app, finishing a task across apps, setting up a device, assembling something, or fixing what's wrong. On the Mac it looks at your screen; on the iPhone it looks through the camera.",
  },
  {
    q: "What's the difference between Show me and Do it for me?",
    a: "Show me points at the control to use and says what to do; your hands stay on the mouse. Do it for me takes the steps itself, across the apps it needs. It asks before anything that sends, pays, deletes or changes security settings, and pressing Esc stops it at once.",
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
