import { z } from "zod";

/** Server-generated identifiers. Model output never supplies these. */
export const Id = z.uuid();
export const Timestamp = z.iso.datetime({ offset: true });

/** Bounded text. Every free-text field has a cap so model output and uploads can't balloon. */
export const text = (max: number) => z.string().trim().min(1).max(max);
export const optionalText = (max: number) => z.string().trim().max(max).optional();

export const Surface = z.enum(["phone", "glasses", "desktop"]);
export type Surface = z.infer<typeof Surface>;

/** Where a procedure step happens. */
export const StepSurface = z.enum(["physical", "desktop"]);
export type StepSurface = z.infer<typeof StepSurface>;

export const ControlMode = z.enum(["show", "do"]);
export type ControlMode = z.infer<typeof ControlMode>;

/** BCP 47 language tag, e.g. "en", "pt-BR". */
export const Language = z.string().regex(/^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/);

/** Pixel coordinates in the source image (camera frame or screenshot). */
export const Pixel = z.number().int().min(0).max(20_000);
export const Point = z.strictObject({ x: Pixel, y: Pixel });
export const Box = z.strictObject({
  x: Pixel,
  y: Pixel,
  w: z.number().int().min(1).max(20_000),
  h: z.number().int().min(1).max(20_000),
});
export type Box = z.infer<typeof Box>;

export const Confidence = z.number().min(0).max(1);
