// A Show me screenshot becomes job evidence: create → upload straight to storage → confirm.
import type { Evidence } from "@tandrix/contracts";
import type { ScreenCapture } from "../../shared/bridge";
import { api } from "./api";
import { supabase } from "./supabase";

export async function uploadScreenshot(
  jobId: string,
  capture: ScreenCapture,
  jobStepId?: string,
): Promise<Evidence> {
  const created = await api.createEvidence(jobId, {
    kind: "screenshot",
    mimeType: capture.mimeType,
    byteSize: capture.image.byteLength,
    surface: "desktop",
    width: capture.geometry.imageWidth,
    height: capture.geometry.imageHeight,
    capturedAt: capture.capturedAt,
    ...(jobStepId ? { jobStepId } : {}),
  });
  const { error } = await supabase.storage
    .from(created.upload.bucket)
    .uploadToSignedUrl(created.upload.path, created.upload.token, capture.image, {
      contentType: capture.mimeType,
    });
  if (error) throw new Error("The screenshot didn't upload. Check your connection and try again.");
  return api.completeEvidence(jobId, created.evidence.id);
}
