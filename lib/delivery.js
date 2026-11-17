import { config } from "./config.js";
import { db } from "./supabase.js";
import { newDownloadToken, sha256 } from "./util.js";
import { sendDownloadEmail } from "./email.js";
import { personalizePdf } from "./watermark.js";

/** Buat link download baru (link lama otomatis tidak berlaku) lalu kirim ke email pembeli. */
export async function issueLinkAndEmail(order) {
  const token = newDownloadToken();
  const expiresAt = new Date(Date.now() + config.linkValidDays * 864e5).toISOString();

  const { data, error } = await db()
    .from("orders")
    .update({ download_token_hash: sha256(token), download_expires_at: expiresAt })
    .eq("id", order.id)
    .eq("status", "PAID")
    .select()
    .single();
  if (error) throw error;

  await sendDownloadEmail({
    order: data,
    downloadUrl: `${config.siteUrl}/api/download?t=${token}`,
    expiresAt,
  });

  await db()
    .from("orders")
    .update({ email_sent_at: new Date().toISOString(), email_send_count: (data.email_send_count || 0) + 1 })
    .eq("id", order.id);
}

/** Pastikan PDF ber-watermark untuk order ini sudah ada di storage, kembalikan path-nya. */
export async function ensurePersonalPdf(order) {
  if (order.file_path) return order.file_path;

  const storage = db().storage;
  const { data: src, error: e1 } = await storage.from("ebook-source").download(config.sourcePdfPath);
  if (e1) throw new Error("File master ebook tidak ditemukan di bucket ebook-source: " + e1.message);

  const bytes = await personalizePdf(new Uint8Array(await src.arrayBuffer()), {
    name: order.name,
    email: order.email,
    orderCode: order.code,
    password: order.pdf_password || undefined,
  });

  const path = `${order.code}-${crypto.randomUUID()}.pdf`;
  const { error: e2 } = await storage
    .from("ebook-delivery")
    .upload(path, bytes, { contentType: "application/pdf", upsert: true });
  if (e2) throw e2;

  await db().from("orders").update({ file_path: path }).eq("id", order.id);
  return path;
}
