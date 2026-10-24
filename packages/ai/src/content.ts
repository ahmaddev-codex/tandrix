// Builders for Responses API input items.

export type InputPart =
  | { type: "input_text"; text: string }
  | { type: "input_image"; image_url: string }
  | { type: "input_image"; file_id: string }
  | { type: "input_file"; file_id: string };

export interface InputMessage {
  type: "message";
  role: "user" | "system" | "developer";
  content: InputPart[];
}

export const text = (t: string): InputPart => ({ type: "input_text", text: t });

/** Inline image as a base64 data URL. Downscale before calling: the server keeps nothing (store: false). */
export function imageData(
  bytes: Uint8Array,
  mime: "image/jpeg" | "image/png" | "image/webp",
): InputPart {
  return {
    type: "input_image",
    image_url: `data:${mime};base64,${Buffer.from(bytes).toString("base64")}`,
  };
}

export const imageUrl = (url: string): InputPart => ({ type: "input_image", image_url: url });
export const fileRef = (fileId: string): InputPart => ({ type: "input_file", file_id: fileId });

export const user = (...content: InputPart[]): InputMessage => ({
  type: "message",
  role: "user",
  content,
});
