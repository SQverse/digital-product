// Uji lokal: node scripts/test-watermark.mjs [path-ke-pdf-asli]
// Hasil: test-output.pdf (password: TEST-1234)
import { readFile, writeFile } from "node:fs/promises";
import { PDFDocument, StandardFonts } from "@cantoo/pdf-lib";
import { personalizePdf } from "../lib/watermark.js";

let src;
if (process.argv[2]) {
  src = await readFile(process.argv[2]);
} else {
  const doc = await PDFDocument.create();
  const f = await doc.embedFont(StandardFonts.Helvetica);
  for (let i = 1; i <= 3; i++) {
    const p = doc.addPage([595, 842]);
    p.drawText(`Halaman contoh ${i}`, { x: 60, y: 760, size: 24, font: f });
  }
  src = await doc.save();
}

const t = Date.now();
const out = await personalizePdf(src, {
  name: "Budi Santoso",
  email: "budi@contoh.com",
  orderCode: "QT7F3K9A",
  password: "TEST-1234",
});
await writeFile(new URL("../test-output.pdf", import.meta.url), out);
console.log(`OK: test-output.pdf (${(out.length / 1024).toFixed(1)} KB) dalam ${Date.now() - t} ms. Password: TEST-1234`);
