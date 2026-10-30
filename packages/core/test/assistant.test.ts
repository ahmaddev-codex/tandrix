import { describe, expect, it } from "vitest";
import {
  acknowledge,
  helpKind,
  interjection,
  isBigAsk,
  isNo,
  isYes,
  offerToDo,
} from "../src/assistant";

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
