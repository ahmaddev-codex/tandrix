// Builders for Responses API input items.

export type InputPart =
  | { type: "input_text"; text: string }
  | { type: "input_image"; image_url: string }
  | { type: "input_image"; file_id: string }
  | { type: "input_file"; file_id: string }
  | { type: "input_file"; file_data: string; filename: string };

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

/** Largest PDF sent inline: the API caps inline files at 50 MB, and base64 adds a third. */
export const INLINE_FILE_MAX_BYTES = 36 * 1024 * 1024;

/** Inline PDF as a base64 data URL; larger files go through the Files API (MetaClient.uploadFile). */
export function pdfData(bytes: Uint8Array, filename: string): InputPart {
  return {
    type: "input_file",
    file_data: `data:application/pdf;base64,${Buffer.from(bytes).toString("base64")}`,
    filename,
  };
}

export const user = (...content: InputPart[]): InputMessage => ({
  type: "message",
  role: "user",
  content,
});
