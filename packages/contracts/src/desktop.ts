// Desktop actions, matching the Meta computer-use protocol. Coordinates are pixels in the
// screenshot the model saw. Show me mode renders these as pointer targets; Do it for me mode
// executes them only after the deterministic action guard in @tandrix/core.
import { z } from "zod";
import { Pixel, Point } from "./primitives";

const Key = z.string().min(1).max(32);

export const DesktopAction = z.discriminatedUnion("type", [
  z.strictObject({
    type: z.literal("click"),
    x: Pixel,
    y: Pixel,
    button: z.enum(["left", "right", "wheel", "back", "forward"]).default("left"),
  }),
  z.strictObject({ type: z.literal("double_click"), x: Pixel, y: Pixel }),
  z.strictObject({ type: z.literal("drag"), path: z.array(Point).min(2).max(64) }),
  z.strictObject({ type: z.literal("keypress"), keys: z.array(Key).min(1).max(6) }),
  z.strictObject({ type: z.literal("move"), x: Pixel, y: Pixel }),
  z.strictObject({
    type: z.literal("scroll"),
    x: Pixel,
    y: Pixel,
    scroll_x: z.number().int().min(-10_000).max(10_000),
    scroll_y: z.number().int().min(-10_000).max(10_000),
  }),
  z.strictObject({ type: z.literal("type"), text: z.string().min(1).max(2000) }),
  z.strictObject({ type: z.literal("screenshot") }),
  z.strictObject({ type: z.literal("wait"), ms: z.number().int().min(0).max(10_000).optional() }),
]);
export type DesktopAction = z.infer<typeof DesktopAction>;

/** Screenshot geometry needed to map model pixels back to the display. */
export const ScreenGeometry = z.strictObject({
  displayId: z.string().min(1).max(64),
  /** Size of the image sent to the model. */
  imageWidth: z.number().int().min(1).max(20_000),
  imageHeight: z.number().int().min(1).max(20_000),
  /** Display origin and size in macOS points. */
  originX: z.number(),
  originY: z.number(),
  displayWidth: z.number().positive(),
  displayHeight: z.number().positive(),
});
export type ScreenGeometry = z.infer<typeof ScreenGeometry>;
