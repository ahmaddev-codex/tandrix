// A question's screenshot, smaller, for asking where to click: the 1920 px capture that finds the
// small parts of a diagram costs a plain Show me answer 2–3 s more than 1280 px did (5.6–7.7 s
// against 4–4.6 s), with no gain in where it points. Made once per screenshot.
import type { ScreenCapture } from "../../shared/bridge";

const made = new WeakMap<Uint8Array, Promise<ScreenCapture>>();

/** The capture at most `maxWidth` wide (its geometry to match), or itself when it's that small. */
export function smaller(capture: ScreenCapture, maxWidth = 1280): Promise<ScreenCapture> {
  if (capture.geometry.imageWidth <= maxWidth) return Promise.resolve(capture);
  let p = made.get(capture.image);
  if (!p) {
    p = shrink(capture, maxWidth).catch(() => capture);
    made.set(capture.image, p);
  }
  return p;
}

async function shrink(capture: ScreenCapture, maxWidth: number): Promise<ScreenCapture> {
  const bitmap = await createImageBitmap(
    new Blob([capture.image as BlobPart], { type: capture.mimeType }),
  );
  const width = maxWidth;
  const height = Math.round((bitmap.height * maxWidth) / bitmap.width);
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext("2d");
  if (!ctx) return capture;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, 0, 0, width, height);
  const blob = await canvas.convertToBlob({ type: "image/jpeg", quality: 0.8 });
  return {
    ...capture,
    image: new Uint8Array(await blob.arrayBuffer()),
    mimeType: "image/jpeg",
    geometry: { ...capture.geometry, imageWidth: width, imageHeight: height },
  };
}
