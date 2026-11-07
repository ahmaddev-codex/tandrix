import { describe, expect, it, vi } from "vitest";

vi.mock("electron", () => ({ app: { getAppPath: () => "", getName: () => "Tandrix" } }));

import { cleanControls } from "../src/main/controls";
import { onShot, snapClicks, type ShotControl } from "../src/renderer/lib/controls";

const geometry = {
  displayId: "1",
  imageWidth: 1280,
  imageHeight: 800,
  originX: 0,
  originY: 0,
  displayWidth: 1440,
  displayHeight: 900,
};
const button = (name: string, x: number, y: number, w = 60, h = 24): ShotControl => ({
  role: "Button",
  name,
  enabled: true,
  box: { x, y, w, h },
});

describe("controls on the screenshot", () => {
  it("places them in screenshot pixels and leaves out what's off it", () => {
    const got = onShot(
      [
        { role: "Button", name: "Save", enabled: true, x: 144, y: 90, w: 72, h: 27 },
        { role: "Button", name: "Elsewhere", enabled: true, x: 2000, y: 90, w: 72, h: 27 },
      ],
      geometry,
    );
    expect(got).toEqual([
      { role: "Button", name: "Save", enabled: true, box: { x: 128, y: 80, w: 64, h: 24 } },
    ]);
  });
});

describe("snapClicks", () => {
  const save = button("Save", 100, 100);
  it("moves a click just off a control to its middle", () => {
    expect(snapClicks([{ type: "click", button: "left", x: 96, y: 110 }], [save])).toEqual([
      { type: "click", button: "left", x: 130, y: 112 },
    ]);
    expect(snapClicks([{ type: "double_click", x: 130, y: 128 }], [save])).toEqual([
      { type: "double_click", x: 130, y: 112 },
    ]);
  });

  it("never moves a click that's already on a control", () => {
    const onEdge = { type: "click" as const, button: "left" as const, x: 101, y: 122 };
    expect(snapClicks([onEdge], [save])).toEqual([onEdge]);
  });

  it("leaves clicks near two controls, far from any, by a big area or a dimmed one alone", () => {
    const a = button("A", 100, 100);
    const b = button("B", 166, 100);
    const between = { type: "click" as const, button: "left" as const, x: 163, y: 110 };
    const far = { type: "click" as const, button: "left" as const, x: 400, y: 400 };
    expect(snapClicks([between, far], [a, b])).toEqual([between, far]);
    const text = { ...button("", 0, 0, 600, 400), role: "TextArea" };
    const byText = { type: "click" as const, button: "left" as const, x: 604, y: 30 };
    expect(snapClicks([byText], [text])).toEqual([byText]);
    const off = { ...save, enabled: false };
    const byOff = { type: "click" as const, button: "left" as const, x: 96, y: 110 };
    expect(snapClicks([byOff], [off])).toEqual([byOff]);
    const typed = { type: "type" as const, text: "hi" };
    expect(snapClicks([typed], [save])).toEqual([typed]);
  });
});

describe("cleanControls", () => {
  it("keeps only well-formed controls, without password fields or invisible marks", () => {
    expect(
      cleanControls([
        { role: "Button", name: "‎Compose‏  message", enabled: true, x: 1.4, y: 2, w: 30, h: 20 },
        { role: "SecureTextField", name: "Password", enabled: true, x: 0, y: 0, w: 30, h: 20 },
        { role: "Button", name: "Tiny", enabled: true, x: 0, y: 0, w: 2, h: 20 },
        { role: "Button; rm", name: "x", enabled: true, x: 0, y: 0, w: 30, h: 20 },
        { role: "Button", name: 5, x: 0, y: 0, w: 30, h: 20 },
        "nope",
      ]),
    ).toEqual([
      { role: "Button", name: "Compose message", enabled: true, x: 1, y: 2, w: 30, h: 20 },
      { role: "Button", name: "", enabled: true, x: 0, y: 0, w: 30, h: 20 },
    ]);
    expect(cleanControls("x")).toEqual([]);
  });
});
