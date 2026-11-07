// Screenshots for Show me: the display under the cursor at native resolution, downsized to a
// fixed width, with the geometry needed to map the model's pixels back onto that display.
import { desktopCapturer, screen, type NativeImage } from "electron";
import type { ScreenCapture } from "../shared/bridge";
import { captureSize, type DisplayInfo } from "./displays";

/** Wide enough to read UI text; small enough to upload and send to the model quickly. */
export const CAPTURE_MAX_WIDTH = 1280;
/**
 * A question's screenshot is sharper: on the marking bench (apps/api/scripts/marking-bench.ts)
 * small parts of a diagram (a single vertebra) were found at 1920 and missed at 1280. A task's
 * many screenshots stay at 1280.
 */
export const QUESTION_MAX_WIDTH = 1920;
const JPEG_QUALITY = 80;

export const SKETCH = { width: 48, height: 30 } as const;

/** The image shrunk to 48×30 brightness values: small enough to compare every turn. */
export function sketchOf(image: NativeImage): number[] {
  const bgra = image.resize({ ...SKETCH, quality: "good" }).toBitmap();
  const out: number[] = [];
  for (let i = 0; i + 3 < bgra.length; i += 4)
    out.push(Math.round(0.114 * bgra[i]! + 0.587 * bgra[i + 1]! + 0.299 * bgra[i + 2]!));
  return out;
}

/**
 * A display as it is now, as a sketch only (48×30 brightness, never an image): to tell whether
 * the page has moved since a question's screenshot. Tandrix's own overlay isn't in it.
 */
export async function sketchNow(displayId: string): Promise<number[] | null> {
  const sources = await desktopCapturer.getSources({
    types: ["screen"],
    thumbnailSize: { width: SKETCH.width * 4, height: SKETCH.height * 4 },
  });
  const source = sources.find((s) => s.display_id === displayId) ?? sources[0];
  if (!source || source.thumbnail.isEmpty()) return null;
  return sketchOf(source.thumbnail);
}

export const captureDisplayUnderCursor = (maxWidth = CAPTURE_MAX_WIDTH) =>
  captureDisplayAt(screen.getCursorScreenPoint(), maxWidth);

/** The display showing a global point (in points): during a task, wherever the user's mouse is. */
export async function captureDisplayAt(
  at: { x: number; y: number },
  maxWidth = CAPTURE_MAX_WIDTH,
): Promise<ScreenCapture> {
  const d = screen.getDisplayNearestPoint(at);
  const display: DisplayInfo = { id: d.id, bounds: d.bounds, scaleFactor: d.scaleFactor };
  const capturedAt = new Date().toISOString();
  const sources = await desktopCapturer.getSources({
    types: ["screen"],
    thumbnailSize: captureSize(display, maxWidth),
  });
  const source = sources.find((s) => s.display_id === String(d.id)) ?? sources[0];
  if (!source || source.thumbnail.isEmpty())
    throw new Error("Tandrix couldn't capture the screen. Check Screen Recording access.");
  const size = source.thumbnail.getSize();
  return {
    sketch: sketchOf(source.thumbnail),
    image: new Uint8Array(source.thumbnail.toJPEG(JPEG_QUALITY)),
    mimeType: "image/jpeg",
    capturedAt,
    geometry: {
      displayId: String(d.id),
      imageWidth: size.width,
      imageHeight: size.height,
      originX: d.bounds.x,
      originY: d.bounds.y,
      displayWidth: d.bounds.width,
      displayHeight: d.bounds.height,
    },
  };
}
