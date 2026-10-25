import { describe, expect, it } from "vitest";
import {
  captureSize,
  captureToGlobal,
  centre,
  displayFor,
  toOverlay,
  type DisplayInfo,
} from "../src/main/displays";

// A 1512×982 Retina laptop as primary, with a 1920×1080 monitor to its left and slightly higher.
const laptop: DisplayInfo = {
  id: 1,
  bounds: { x: 0, y: 0, width: 1512, height: 982 },
  scaleFactor: 2,
};
const monitor: DisplayInfo = {
  id: 2,
  bounds: { x: -1920, y: -200, width: 1920, height: 1080 },
  scaleFactor: 1,
};
const displays = [laptop, monitor];

describe("displayFor", () => {
  it("finds the display that shows a point, including negative origins", () => {
    expect(displayFor({ x: 10, y: 10 }, displays)?.id).toBe(1);
    expect(displayFor({ x: -5, y: -150 }, displays)?.id).toBe(2);
  });

  it("treats the right and bottom edges as outside", () => {
    expect(displayFor({ x: 0, y: 500 }, displays)?.id).toBe(1);
    expect(displayFor({ x: -1, y: 500 }, displays)?.id).toBe(2);
  });

  it("sends off-screen points to the nearest display", () => {
    expect(displayFor({ x: 4000, y: 100 }, displays)?.id).toBe(1);
    expect(displayFor({ x: -3000, y: -500 }, displays)?.id).toBe(2);
  });

  it("has nothing to offer with no displays", () => {
    expect(displayFor({ x: 0, y: 0 }, [])).toBeUndefined();
  });
});

describe("toOverlay", () => {
  it("maps a global point into that display's overlay window", () => {
    expect(toOverlay({ x: -1900, y: -180 }, displays)).toEqual({
      displayId: 2,
      point: { x: 20, y: 20 },
    });
    expect(toOverlay({ x: 756, y: 491 }, displays)).toEqual({
      displayId: 1,
      point: { x: 756, y: 491 },
    });
  });

  it("clamps off-screen points onto the nearest display", () => {
    expect(toOverlay({ x: 5000, y: 5000 }, displays)).toEqual({
      displayId: 1,
      point: { x: 1511, y: 981 },
    });
  });

  it("returns null with no displays", () => {
    expect(toOverlay({ x: 0, y: 0 }, [])).toBeNull();
  });
});

describe("captureSize", () => {
  it("captures at native pixels when that fits", () => {
    expect(captureSize(monitor, 1920)).toEqual({ width: 1920, height: 1080 });
  });

  it("downsizes Retina captures, keeping the aspect ratio", () => {
    expect(captureSize(laptop, 1512)).toEqual({ width: 1512, height: 982 });
    expect(captureSize(laptop, 1280)).toEqual({ width: 1280, height: 831 });
  });
});

describe("captureToGlobal", () => {
  it("undoes the downsizing and the display origin", () => {
    const capture = { bounds: monitor.bounds, imageWidth: 1280, imageHeight: 720 };
    expect(captureToGlobal({ x: 640, y: 360 }, capture)).toEqual({ x: -960, y: 340 });
  });

  it("round-trips a Retina screenshot point to the overlay", () => {
    const size = captureSize(laptop, 1280);
    const capture = { bounds: laptop.bounds, imageWidth: size.width, imageHeight: size.height };
    const global = captureToGlobal({ x: 1280, y: 0 }, capture);
    expect(global).toEqual({ x: 1512, y: 0 });
    // The far edge belongs to the next pixel over, so the overlay clamps it back on screen.
    expect(toOverlay(global, displays)?.point).toEqual({ x: 1511, y: 0 });
  });
});

describe("centre", () => {
  it("is the middle of the display in global points", () => {
    expect(centre(monitor.bounds)).toEqual({ x: -960, y: 340 });
  });
});
