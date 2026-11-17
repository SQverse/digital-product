import { PDFDocument, StandardFonts, rgb, degrees } from "@cantoo/pdf-lib";

// Font standar PDF hanya mendukung karakter Latin dasar,
// jadi karakter lain (emoji, aksara non-Latin) diganti agar tidak error.
function safe(text) {
  return String(text ?? "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\x20-\x7E]/g, "?")
    .trim();
}

/**
 * Memberi watermark personal di setiap halaman dan (opsional) mengunci PDF dengan password.
 * @param {Uint8Array|ArrayBuffer} sourceBytes PDF asli
 * @param {{ name: string, email: string, orderCode: string, password?: string }} buyer
 * @returns {Promise<Uint8Array>}
 */
export async function personalizePdf(sourceBytes, { name, email, orderCode, password }) {
  const pdf = await PDFDocument.load(sourceBytes);
  const font = await pdf.embedFont(StandardFonts.HelveticaBold);
  const small = await pdf.embedFont(StandardFonts.Helvetica);

  const who = `${safe(name)} - ${safe(email)}`;
  const big = `${safe(name)}  #${safe(orderCode)}`;
  const footer = `Lisensi pribadi untuk ${who} | Order #${safe(orderCode)} | Dilarang menyebarluaskan / menjual ulang.`;

  for (const page of pdf.getPages()) {
    const { width, height } = page.getSize();

    // 1) Watermark diagonal besar, tipis di tengah halaman
    const size = Math.min(width, height) / 16;
    const textW = font.widthOfTextAtSize(big, size);
    const rad = Math.atan2(height, width);
    page.drawText(big, {
      x: width / 2 - (textW / 2) * Math.cos(rad),
      y: height / 2 - (textW / 2) * Math.sin(rad),
      size,
      font,
      color: rgb(0.55, 0.6, 0.7),
      opacity: 0.16,
      rotate: degrees((rad * 180) / Math.PI),
    });

    // 2) Footer identitas pembeli di bawah halaman
    let fSize = 7;
    while (small.widthOfTextAtSize(footer, fSize) > width - 24 && fSize > 4) fSize -= 0.5;
    page.drawText(footer, {
      x: 12,
      y: 8,
      size: fSize,
      font: small,
      color: rgb(0.35, 0.38, 0.45),
      opacity: 0.85,
    });

    // 3) Penanda tersembunyi (hampir tak terlihat) untuk pelacakan
    page.drawText(`QT-${safe(orderCode)}-${safe(email)}`, {
      x: width - 120,
      y: height - 6,
      size: 2,
      font: small,
      color: rgb(1, 1, 1),
      opacity: 0.02,
    });
  }

  // 4) Metadata dokumen
  pdf.setSubject(`Lisensi pribadi: ${who} (Order #${safe(orderCode)})`);
  pdf.setKeywords([`order:${safe(orderCode)}`, `buyer:${safe(email)}`]);
  pdf.setProducer("Quantum Telecommunication");
  pdf.setModificationDate(new Date());

  // 5) Password (key) unik per pembeli
  if (password) {
    pdf.encrypt({
      userPassword: password,
      // owner password acak: tidak ada yang bisa membuka izin penuh
      ownerPassword: crypto.randomUUID() + crypto.randomUUID(),
      permissions: {
        printing: "lowResolution",
        modifying: false,
        copying: false,
        annotating: false,
        fillingForms: false,
        contentAccessibility: true,
        documentAssembly: false,
      },
    });
  }

  return pdf.save({ useObjectStreams: true });
}
