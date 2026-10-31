// Screenshots for Show me: the display under the cursor at native resolution, downsized to a
// fixed width, with the geometry needed to map the model's pixels back onto that display.
import { desktopCapturer, screen } from "electron";
import type { ScreenCapture } from "../shared/bridge";
import { captureSize, type DisplayInfo } from "./displays";

/** Wide enough to read UI text; small enough to upload and send to the model quickly. */
export const CAPTURE_MAX_WIDTH = 1280;
const JPEG_QUALITY = 80;

export const captureDisplayUnderCursor = () => captureDisplayAt(screen.getCursorScreenPoint());

/** The display showing a global point (in points): during a task, wherever the user's mouse is. */
export async function captureDisplayAt(at: { x: number; y: number }): Promise<ScreenCapture> {
  const d = screen.getDisplayNearestPoint(at);
  const display: DisplayInfo = { id: d.id, bounds: d.bounds, scaleFactor: d.scaleFactor };
  const capturedAt = new Date().toISOString();
  const sources = await desktopCapturer.getSources({
    types: ["screen"],
    thumbnailSize: captureSize(display, CAPTURE_MAX_WIDTH),
  });
  const source = sources.find((s) => s.display_id === String(d.id)) ?? sources[0];
  if (!source || source.thumbnail.isEmpty())
    throw new Error("Tandrix couldn't capture the screen. Check Screen Recording access.");
  const size = source.thumbnail.getSize();
  return {
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
