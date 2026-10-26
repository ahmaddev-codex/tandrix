// Compiles the demo build-kit manual from the downloaded product briefs (see fixtures/demo-pi5/fetch.sh).
import { readFileSync, writeFileSync } from "node:fs";
import { PDFDocument } from "pdf-lib";

const dir = process.argv[2] ?? "manuals";
const parts = [
  "raspberry-pi-active-cooler-product-brief.pdf",
  "case-for-raspberry-pi-5-product-brief.pdf",
  "raspberry-pi-m2-hat-plus-product-brief.pdf",
];
const kit = await PDFDocument.create();
kit.setTitle("Raspberry Pi 5 home server build kit: official product briefs (compiled)");
for (const p of parts) {
  const src = await PDFDocument.load(readFileSync(`${dir}/${p}`));
  for (const page of await kit.copyPages(src, src.getPageIndices())) kit.addPage(page);
}
writeFileSync(`${dir}/pi5-build-kit.pdf`, await kit.save());
console.log(`Wrote ${dir}/pi5-build-kit.pdf (${kit.getPageCount()} pages).`);
