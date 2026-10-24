// Photo evidence: shrink on the device, then create → upload straight to storage → confirm.
import type { Evidence } from "@tandrix/contracts";
import { File } from "expo-file-system";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { api } from "./api";
import { supabase } from "./supabase";

/** Long edge in pixels. Enough detail for part identification; keeps uploads small on site. */
const MAX_EDGE = 2048;
const JPEG_QUALITY = 0.8;

export interface PreparedPhoto {
  uri: string;
  width: number;
  height: number;
  byteSize: number;
  capturedAt: string;
}

export async function preparePhoto(
  uri: string,
  size: { width: number; height: number },
  capturedAt: Date = new Date(),
): Promise<PreparedPhoto> {
  const ctx = ImageManipulator.manipulate(uri);
  if (Math.max(size.width, size.height) > MAX_EDGE) {
    ctx.resize(
      size.width >= size.height
        ? { width: MAX_EDGE, height: null }
        : { width: null, height: MAX_EDGE },
    );
  }
  const rendered = await ctx.renderAsync();
  const saved = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: JPEG_QUALITY });
  return {
    uri: saved.uri,
    width: saved.width,
    height: saved.height,
    byteSize: new File(saved.uri).size,
    capturedAt: capturedAt.toISOString(),
  };
}

export async function uploadPhoto(
  jobId: string,
  photo: PreparedPhoto,
  jobStepId?: string,
): Promise<Evidence> {
  const created = await api.createEvidence(jobId, {
    kind: "photo",
    mimeType: "image/jpeg",
    byteSize: photo.byteSize,
    surface: "phone",
    width: photo.width,
    height: photo.height,
    capturedAt: photo.capturedAt,
    ...(jobStepId ? { jobStepId } : {}),
  });
  const bytes = await new File(photo.uri).bytes();
  const { error } = await supabase.storage
    .from(created.upload.bucket)
    .uploadToSignedUrl(created.upload.path, created.upload.token, bytes, {
      contentType: "image/jpeg",
    });
  if (error) throw new Error("The photo didn't upload. Check your connection and try again.");
  return api.completeEvidence(jobId, created.evidence.id);
}
