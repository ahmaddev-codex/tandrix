import { describe, expect, it } from "vitest";
import { imagesToPdf, pdfPageCount } from "../src/pdf";
import { PNG, samplePdf } from "./fixtures";

describe("pdfPageCount", () => {
  it("counts pages", async () => {
    expect(await pdfPageCount(await samplePdf(3))).toBe(3);
  });

  it("rejects non-PDFs and broken PDFs", async () => {
    expect(await pdfPageCount(new TextEncoder().encode("<html></html>"))).toBeNull();
    expect(await pdfPageCount(new TextEncoder().encode("%PDF-1.7 garbage"))).toBeNull();
  });
});

describe("imagesToPdf", () => {
  it("makes one page per photo, in order", async () => {
    const pdf = await imagesToPdf([
      { bytes: PNG, mimeType: "image/png" },
      { bytes: PNG, mimeType: "image/png" },
    ]);
    expect(await pdfPageCount(pdf)).toBe(2);
  });
});
