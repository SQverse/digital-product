import { config } from "./config.js";
import { escapeHtml } from "./util.js";

export async function sendDownloadEmail({ order, downloadUrl, expiresAt }) {
  const exp = new Date(expiresAt).toLocaleString("id-ID", { dateStyle: "long", timeStyle: "short", timeZone: "Asia/Jakarta" });
  const sisa = Math.max(order.max_downloads - order.download_count, 0);
  const wa = config.whatsapp ? `https://wa.me/${config.whatsapp}` : "";
  const name = escapeHtml(order.name);

  const passwordHtml = order.pdf_password
    ? `<p style="margin:18px 0 6px">Password untuk membuka file PDF:</p>
       <p style="font:700 22px/1.2 monospace;letter-spacing:2px;background:#f4f8fe;border:1px dashed #0b3fa8;border-radius:8px;padding:12px 16px;display:inline-block;margin:0">${escapeHtml(order.pdf_password)}</p>`
    : "";

  const html = `<!doctype html><html><body style="margin:0;background:#eaf1fc;font-family:Arial,Helvetica,sans-serif;color:#0d1b3a">
  <div style="max-width:560px;margin:0 auto;padding:24px">
    <div style="background:#061a44;color:#fff;border-radius:14px 14px 0 0;padding:20px 24px;font-weight:800;font-size:18px">Quantum Telecommunication</div>
    <div style="background:#fff;border-radius:0 0 14px 14px;padding:24px;line-height:1.6">
      <p style="margin-top:0">Halo <b>${name}</b>,</p>
      <p>Terima kasih, pembayaran untuk <b>${escapeHtml(config.productName)}</b> (Order <b>#${escapeHtml(order.code)}</b>) sudah kami terima.</p>
      <p style="text-align:center;margin:26px 0">
        <a href="${downloadUrl}" style="background:#ffb81c;color:#1c1300;font-weight:800;text-decoration:none;padding:14px 26px;border-radius:9px;display:inline-block">Download E-Book (PDF)</a>
      </p>
      ${passwordHtml}
      <p style="font-size:13px;color:#51607f;margin-top:22px">
        &bull; Link berlaku sampai <b>${exp} WIB</b>. Sisa jatah download: <b>${sisa}x</b>.<br>
        &bull; Jika link kedaluwarsa, minta link baru di halaman konfirmasi pesanan atau hubungi admin.<br>
        &bull; File ini berisi identitas Anda di setiap halaman. Mohon <b>tidak dibagikan atau dijual ulang</b>, karena setiap salinan dapat dilacak ke pemiliknya.
      </p>
      ${wa ? `<p style="font-size:13px">Butuh bantuan? <a href="${wa}">Hubungi admin via WhatsApp</a>.</p>` : ""}
    </div>
  </div></body></html>`;

  const text = [
    `Halo ${order.name},`,
    `Pembayaran Order #${order.code} sudah diterima.`,
    `Download: ${downloadUrl}`,
    order.pdf_password ? `Password PDF: ${order.pdf_password}` : "",
    `Link berlaku sampai ${exp} WIB, sisa download ${sisa}x.`,
    `File berisi identitas Anda. Dilarang dibagikan/dijual ulang.`,
  ].filter(Boolean).join("\n");

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${config.resendApiKey}`, "content-type": "application/json" },
    body: JSON.stringify({
      from: config.emailFrom,
      to: [order.email],
      subject: `Link Download E-Book - Order #${order.code}`,
      html,
      text,
    }),
  });
  if (!res.ok) throw new Error(`Gagal kirim email (${res.status}): ${await res.text()}`);
}
