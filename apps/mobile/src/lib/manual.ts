// Manual PDFs: pick one from Files, upload it straight to storage, then let the API check it.
import type { Manual } from "@tandrix/contracts";
import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";
import { api } from "./api";
import { supabase } from "./supabase";

/** Matches the API and the storage bucket limit. */
export const MAX_MANUAL_BYTES = 60 * 1024 * 1024;

export interface PickedPdf {
  uri: string;
  name: string;
  byteSize: number;
}

/** Opens Files for a PDF; null if the user cancels. */
export async function pickPdf(): Promise<PickedPdf | null> {
  const r = await DocumentPicker.getDocumentAsync({
    type: "application/pdf",
    copyToCacheDirectory: true,
    multiple: false,
  });
  const a = r.canceled ? undefined : r.assets[0];
  if (!a) return null;
  return { uri: a.uri, name: a.name, byteSize: a.size ?? new File(a.uri).size };
}

/** "CR3-10_install.pdf" → "CR3-10 install": a readable default title. */
export const titleFromFileName = (name: string) =>
  name
    .replace(/\.pdf$/i, "")
    .replace(/[_]+/g, " ")
    .trim()
    .slice(0, 200) || "Manual";

export async function uploadManualPdf(
  jobId: string,
  pdf: PickedPdf,
  title: string,
): Promise<Manual> {
  if (pdf.byteSize > MAX_MANUAL_BYTES) throw new Error("That PDF is larger than 60 MB.");
  const created = await api.createManualUpload(jobId, { byteSize: pdf.byteSize, title });
  const bytes = await new File(pdf.uri).bytes();
  const { error } = await supabase.storage
    .from(created.upload.bucket)
    .uploadToSignedUrl(created.upload.path, created.upload.token, bytes, {
      contentType: "application/pdf",
    });
  if (error) throw new Error("The manual didn't upload. Check your connection and try again.");
  return api.completeManualUpload(jobId, created.uploadId);
}
