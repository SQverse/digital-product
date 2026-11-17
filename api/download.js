// GET /api/download?t=<token> — link dari email.
// Membuat PDF ber-watermark (sekali, lalu di-cache), kemudian redirect ke URL sementara (berlaku 60 detik).
import { config } from "../lib/config.js";
import { db } from "../lib/supabase.js";
import { ensurePersonalPdf } from "../lib/delivery.js";
import { escapeHtml, sha256 } from "../lib/util.js";

function page(title, msg, status) {
  const wa = config.whatsapp
    ? `<p><a href="https://wa.me/${escapeHtml(config.whatsapp)}" style="color:#0b3fa8;font-weight:700">Hubungi admin via WhatsApp</a></p>`
    : "";
  return new Response(
    `<!doctype html><html lang="id"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title>
<body style="font-family:Arial,sans-serif;background:#eaf1fc;color:#0d1b3a;display:grid;place-items:center;min-height:100vh;margin:0;padding:20px">
<div style="background:#fff;border-radius:14px;padding:28px;max-width:440px;text-align:center;box-shadow:0 14px 36px -22px rgba(10,40,110,.45)">
<h2 style="margin-top:0">${escapeHtml(title)}</h2><p>${escapeHtml(msg)}</p>${wa}</div></body></html>`,
    { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "x-robots-tag": "noindex" } },
  );
}

export async function GET(request) {
  const token = new URL(request.url).searchParams.get("t") || "";
  if (token.length < 30) return page("Link tidak valid", "Periksa kembali link di email Anda.", 400);
  const hash = sha256(token);

  try {
    const { data: order } = await db().from("orders").select().eq("download_token_hash", hash).maybeSingle();
    if (!order || order.status !== "PAID")
      return page("Link tidak valid", "Link ini sudah tidak berlaku. Gunakan link terbaru di email Anda.", 404);
    if (new Date(order.download_expires_at) < new Date())
      return page("Link kedaluwarsa", "Silakan minta link baru di halaman konfirmasi pesanan atau hubungi admin.", 410);
    if (order.download_count >= order.max_downloads)
      return page("Batas download tercapai", "Jatah download untuk pesanan ini sudah habis. Hubungi admin bila perlu bantuan.", 429);

    const path = await ensurePersonalPdf(order);

    // Klaim jatah download secara atomik (aman dari klik berulang bersamaan)
    const { data: claimed, error } = await db().rpc("claim_download", { p_token_hash: hash });
    if (error) throw error;
    if (!claimed?.length) return page("Batas download tercapai", "Jatah download untuk pesanan ini sudah habis.", 429);

    const { data: signed, error: e2 } = await db()
      .storage.from("ebook-delivery")
      .createSignedUrl(path, 60, { download: `Modul-F64-Ultra-${order.code}.pdf` });
    if (e2) throw e2;

    return new Response(null, { status: 302, headers: { location: signed.signedUrl, "cache-control": "no-store" } });
  } catch (err) {
    console.error("download error:", err);
    return page("Terjadi gangguan", "Mohon coba lagi beberapa saat lagi.", 500);
  }
}
