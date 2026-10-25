// Coordinate mapping between screenshots, the global desktop and each display's overlay window.
// Electron reports display bounds in points (DIP) in one global space; a display left of or
// above the primary has negative origins. Screenshots are in pixels and may be downsized.

export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DisplayInfo {
  id: number;
  bounds: Rect;
  scaleFactor: number;
}

const contains = (r: Rect, p: Point) =>
  p.x >= r.x && p.x < r.x + r.width && p.y >= r.y && p.y < r.y + r.height;

const distanceTo = (r: Rect, p: Point) => {
  const dx = Math.max(r.x - p.x, 0, p.x - (r.x + r.width - 1));
  const dy = Math.max(r.y - p.y, 0, p.y - (r.y + r.height - 1));
  return Math.hypot(dx, dy);
};

export const centre = (r: Rect): Point => ({
  x: r.x + Math.floor(r.width / 2),
  y: r.y + Math.floor(r.height / 2),
});

/** The display showing a global point; off-screen points go to the nearest display. */
export function displayFor(p: Point, displays: readonly DisplayInfo[]): DisplayInfo | undefined {
  return (
    displays.find((d) => contains(d.bounds, p)) ??
    [...displays].sort((a, b) => distanceTo(a.bounds, p) - distanceTo(b.bounds, p))[0]
  );
}

/** A global point in that display's overlay window, clamped so the pointer stays on screen. */
export function toOverlay(
  p: Point,
  displays: readonly DisplayInfo[],
): { displayId: number; point: Point } | null {
  const d = displayFor(p, displays);
  if (!d) return null;
  const { x, y, width, height } = d.bounds;
  return {
    displayId: d.id,
    point: {
      x: Math.min(Math.max(p.x - x, 0), width - 1),
      y: Math.min(Math.max(p.y - y, 0), height - 1),
    },
  };
}

/** A screenshot of one display: what it covered and the size of the image the model saw. */
export interface Capture {
  bounds: Rect;
  imageWidth: number;
  imageHeight: number;
}

/** A point in screenshot pixels (as the model returns it) in global points. */
export function captureToGlobal(p: Point, c: Capture): Point {
  return {
    x: c.bounds.x + (p.x * c.bounds.width) / c.imageWidth,
    y: c.bounds.y + (p.y * c.bounds.height) / c.imageHeight,
  };
}

/** Pixel size to capture a display at: native resolution, downsized to at most `maxWidth`. */
export function captureSize(d: DisplayInfo, maxWidth: number): { width: number; height: number } {
  const width = Math.round(d.bounds.width * d.scaleFactor);
  const height = Math.round(d.bounds.height * d.scaleFactor);
  if (width <= maxWidth) return { width, height };
  return { width: maxWidth, height: Math.round((height * maxWidth) / width) };
}
