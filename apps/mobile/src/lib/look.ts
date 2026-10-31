// Point the camera: a frame from the camera (or a photo), made small enough to send quickly. The
// model reads 1024 px as well as full size, and a frame this size uploads in a moment on site.
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";

const FRAME_EDGE = 1024;

export interface Frame {
  uri: string;
  width: number;
  height: number;
  base64: string;
}

export async function prepareFrame(
  uri: string,
  size: { width: number; height: number },
): Promise<Frame> {
  const ctx = ImageManipulator.manipulate(uri);
  if (Math.max(size.width, size.height) > FRAME_EDGE)
    ctx.resize(
      size.width >= size.height
        ? { width: FRAME_EDGE, height: null }
        : { width: null, height: FRAME_EDGE },
    );
  const saved = await (
    await ctx.renderAsync()
  ).saveAsync({
    format: SaveFormat.JPEG,
    compress: 0.75,
    base64: true,
  });
  if (!saved.base64) throw new Error("Couldn't read the photo. Try again.");
  return { uri: saved.uri, width: saved.width, height: saved.height, base64: saved.base64 };
}
