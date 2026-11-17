// POST /api/resend-link { id } — kirim ulang link download.
// Selalu dikirim ke email PEMBELI yang tercatat, tidak bisa ke email lain.
import { db } from "../lib/supabase.js";
import { issueLinkAndEmail } from "../lib/delivery.js";
import { json } from "../lib/util.js";

const COOLDOWN_MS = 2 * 60 * 1000;
const MAX_SENDS = 10;

export async function POST(request) {
  let id = "";
  try { id = String((await request.json()).id || ""); } catch {}
  if (!/^[0-9a-f-]{36}$/i.test(id)) return json({ error: "Order tidak ditemukan" }, 404);

  const { data: o } = await db().from("orders").select().eq("id", id).maybeSingle();
  if (!o || o.status !== "PAID") return json({ error: "Order belum dibayar" }, 400);
  if (o.email_send_count >= MAX_SENDS) return json({ error: "Batas kirim ulang tercapai, silakan hubungi admin." }, 429);
  if (o.email_sent_at && Date.now() - new Date(o.email_sent_at).getTime() < COOLDOWN_MS)
    return json({ error: "Tunggu 2 menit sebelum meminta kirim ulang." }, 429);

  try {
    await issueLinkAndEmail(o);
    return json({ ok: true });
  } catch (err) {
    console.error("resend error:", err);
    return json({ error: "Gagal mengirim email, coba lagi nanti." }, 500);
  }
}
