import { PDFDocument } from "pdf-lib";

export const MAX_MANUAL_PAGES = 5000;

/** Page count of a PDF, or null if it isn't a readable PDF. */
export async function pdfPageCount(bytes: Uint8Array): Promise<number | null> {
  if (Buffer.from(bytes.subarray(0, 5)).toString("latin1") !== "%PDF-") return null;
  try {
    const doc = await PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false });
    const n = doc.getPageCount();
    return n >= 1 && n <= MAX_MANUAL_PAGES ? n : null;
  } catch {
    return null;
  }
}

/** One page per photo, sized to the photo, in the order given. JPEG and PNG only. */
export async function imagesToPdf(
  images: Array<{ bytes: Uint8Array; mimeType: string }>,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setProducer("Tandrix");
  for (const img of images) {
    const embedded =
      img.mimeType === "image/png" ? await doc.embedPng(img.bytes) : await doc.embedJpg(img.bytes);
    const page = doc.addPage([embedded.width, embedded.height]);
    page.drawImage(embedded, { x: 0, y: 0, width: embedded.width, height: embedded.height });
  }
  return doc.save();
}
