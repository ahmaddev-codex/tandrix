import { describe, expect, it } from "vitest";
import {
  LOOK_ACKS,
  isAppCommand,
  lookAck,
  whileBusy,
  acknowledge,
  helpKind,
  interjection,
  isBigAsk,
  isNo,
  isYes,
  offerToDo,
} from "../src/assistant";
import { wantsDesktopExecution } from "../src/voice";

describe("helpKind", () => {
  it("shows the way for questions about the screen", () => {
    expect(helpKind("Where's the export button?")).toBe("show");
    expect(helpKind("How do I make a pivot table")).toBe("show");
    expect(helpKind("Teach me pivot tables")).toBe("show");
  });
  it("offers to do plain requests", () => {
    expect(helpKind("Book my dentist for Thursday at ten")).toBe("offer");
    expect(helpKind("Add bread to my shopping note")).toBe("offer");
    expect(helpKind("Turn on dark mode")).toBe("offer");
  });
  it("does it straight away when asked to do it", () => {
    expect(helpKind("Turn on dark mode for me")).toBe("do");
    expect(helpKind("Do it")).toBe("do");
  });
  it("does it straight away however the handover is phrased", () => {
    expect(helpKind("Book my dentist for Thursday for me")).toBe("do");
    expect(helpKind("Add bread to my shopping note for me")).toBe("do");
    expect(helpKind("Can you turn on dark mode for me?")).toBe("do");
    expect(helpKind("Could you add bread to my shopping note for me?")).toBe("do");
    expect(helpKind("Please send the email for me")).toBe("do");
    expect(helpKind("Do the update for me")).toBe("do");
    expect(helpKind("I want you to turn on dark mode")).toBe("do");
    expect(wantsDesktopExecution("Book my dentist for me")).toBe(true);
  });
  it("treats going somewhere and getting something as a task, not a question", () => {
    const ask =
      "Go to my whatsapp and grab a chat with the interview lineups and add it to my calendar";
    expect(helpKind(ask)).toBe("offer");
    expect(helpKind(`${ask} for me`)).toBe("do");
    expect(helpKind("Grab the tracking number from my email")).toBe("offer");
    expect(helpKind("Check my calendar for Friday")).toBe("offer");
    expect(helpKind("Find out when the Apple store closes")).toBe("background");
  });
  it("offers, rather than shows, a politely wrapped request", () => {
    expect(helpKind("Can you turn on dark mode?")).toBe("offer");
    expect(helpKind("Can you research the best standing desks?")).toBe("background");
  });
  it("keeps no-screen work and real questions off the screen even with for me", () => {
    expect(helpKind("Research the best standing desks for me")).toBe("background");
    expect(helpKind("Draft a reply thanking Sam for me")).toBe("background");
    expect(helpKind("What should I buy for me?")).toBe("show");
  });
  it("works in the background when no screen is needed", () => {
    expect(helpKind("Research the best standing desks under $500")).toBe("background");
    expect(helpKind("Find out when the Apple store closes")).toBe("background");
    expect(helpKind("Draft a reply thanking Sam for the invite")).toBe("background");
    expect(helpKind("Book the flights in the background")).toBe("background");
  });
  it("keeps looking at the screen when the request is about it", () => {
    expect(helpKind("Summarize this page")).toBe("show");
  });
});

describe("yes and no", () => {
  it("hears a natural yes", () => {
    for (const y of ["Yes", "yeah go ahead", "Sure", "ok", "Do it", "please", "Go for it!"])
      expect(isYes(y)).toBe(true);
    expect(isYes("no thanks")).toBe(false);
  });
  it("hears a natural no", () => {
    for (const n of ["No", "nope", "not now", "just show me", "I'll do it"])
      expect(isNo(n)).toBe(true);
    expect(isNo("yes")).toBe(false);
  });
});

describe("interjection", () => {
  it("stops on stop", () => {
    expect(interjection("Stop")).toBe("stop");
    expect(interjection("never mind")).toBe("stop");
  });
  it("steers the current task on a correction", () => {
    expect(interjection("No, the other Thursday")).toBe("redirect");
    expect(interjection("Actually make it 11")).toBe("redirect");
    expect(interjection("use Safari instead")).toBe("redirect");
  });
  it("queues anything else", () => {
    expect(interjection("And book my dentist after this")).toBe("queue");
    expect(interjection("Then email Sam the notes")).toBe("queue");
  });
});

describe("acknowledge", () => {
  it("never says the same line twice in a row", () => {
    const lines = Array.from({ length: 20 }, (_, i) => acknowledge("Turn on dark mode", i / 20));
    for (let i = 1; i < lines.length; i++) expect(lines[i]).not.toBe(lines[i - 1]);
  });
  it("can joke on a big ask, and stays plain on a small one", () => {
    const big =
      "Find the manual, then set up the printer, and then add it to my shared calendar and email the team";
    expect(isBigAsk(big)).toBe(true);
    expect(acknowledge(big, 0.1)).toMatch(/plate|Ambitious|sleeves|few things|Challenge/);
    expect(isBigAsk("Turn on dark mode")).toBe(false);
  });
});

describe("offerToDo", () => {
  it("offers in the user's own words", () => {
    expect(offerToDo("Book my dentist for Thursday.", 0)).toBe(
      "I can book your dentist for Thursday for you. Want me to?",
    );
  });
});

describe("whileBusy", () => {
  it("starts work that needs no screen straight away", () => {
    expect(whileBusy("Research the best standing desks under $500")).toBe("background");
    expect(whileBusy("What's the capital of Australia?")).toBe("background");
    expect(whileBusy("Draft a thank-you note to Sam")).toBe("background");
  });
  it("takes anything else for the screen as an update to the running task", () => {
    expect(whileBusy("Also make the title bold")).toBe("add");
    expect(whileBusy("Mention the meeting on Friday too")).toBe("add");
    expect(whileBusy("Then email Sam the notes")).toBe("add");
    expect(whileBusy("Actually make it 11")).toBe("redirect");
    expect(whileBusy("Stop")).toBe("stop");
  });
  it("answers questions about the screen by looking, without the mouse", () => {
    expect(whileBusy("Where's the export button?")).toBe("look");
    expect(whileBusy("What is this app?")).toBe("look");
  });
  it("queues other screen jobs, and still stops or steers the running one", () => {
    expect(whileBusy("Book my dentist for Thursday")).toBe("add");
    expect(whileBusy("Stop")).toBe("stop");
    expect(whileBusy("Actually make it Friday")).toBe("redirect");
  });
});

describe("lookAck", () => {
  it("never says the same acknowledgement twice in a row", () => {
    let last: string | undefined;
    for (let i = 0; i < 50; i++) {
      const a = lookAck(last, LOOK_ACKS, (i * 0.37) % 1)!;
      expect(LOOK_ACKS).toContain(a);
      expect(a).not.toBe(last);
      last = a;
    }
  });

  it("chooses only from what's loaded, and says nothing rather than repeat", () => {
    expect(lookAck(undefined, ["Let me look."])).toBe("Let me look.");
    expect(lookAck("Let me look.", ["Let me look."])).toBeUndefined();
    expect(lookAck(undefined, [])).toBeUndefined();
  });
});

describe("app commands (SP6)", () => {
  it.each([
    "Add lunch with Sam tomorrow at 1",
    "Can you add the dentist on Friday at 9:30?",
    "Put the school play in my calendar",
    "Remind me to call mum at 6",
    "Make a note that the boiler code is 4417",
    "Play some jazz",
    "Pause",
    "Next track",
    "Open my Downloads folder",
    "Open apple.com",
    "Go to https://example.com/docs in Safari",
  ])("does %s outright", (s) => expect(helpKind(s)).toBe("app"));

  it.each([
    ["Book a table for two at 7", "offer"],
    ["Play this video", "show"],
    ["Add this to my cart", "offer"],
    ["Add milk to the list tomorrow", "offer"],
    ["How do I add an event?", "show"],
    ["Open Calendar and add lunch with Sam tomorrow at 1 for me", "do"],
  ])("leaves %s to the screen", (s, kind) => {
    expect(isAppCommand(s)).toBe(false);
    expect(helpKind(s)).toBe(kind);
  });
});

describe("app commands while a screen task runs", () => {
  it("runs out of sight alongside it, but waits to open a window", () => {
    expect(whileBusy("Remind me to call mum at 6")).toBe("background");
    expect(whileBusy("Pause")).toBe("background");
    expect(whileBusy("Open my Downloads folder")).toBe("add");
  });
});

describe("explanations and lessons are shown, even said as for me", () => {
  it("never acts on an ask to understand or learn", () => {
    expect(helpKind("Solve this equation for me")).toBe("show");
    expect(helpKind("I have this equation on my screen and I don't understand it")).toBe("show");
    expect(helpKind("Teach mw how to use Google Docs")).toBe("show");
  });
});
