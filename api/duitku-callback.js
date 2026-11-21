// POST /api/duitku-callback — dipanggil Duitku saat status pembayaran berubah (form-urlencoded).
// URL ini dikirim otomatis di setiap tagihan (callbackUrl), dan sebaiknya juga diisi di
// Duitku Dashboard > Proyek > Callback URL.
import { config } from "../lib/config.js";
import { db } from "../lib/supabase.js";
import { callbackSignature, getTransactionStatus } from "../lib/duitku.js";
import { issueLinkAndEmail } from "../lib/delivery.js";
import { json, safeEqual } from "../lib/util.js";

export async function POST(request) {
  let p;
  try {
    p = Object.fromEntries(new URLSearchParams(await request.text()));
  } catch {
    return json({ error: "bad request" }, 400);
  }

  // 1) Pastikan request benar-benar dari Duitku
  if (p.merchantCode !== config.duitkuMerchantCode || !safeEqual(p.signature, callbackSignature(p))) {
    return json({ error: "invalid signature" }, 401);
  }
  if (!/^[0-9a-f-]{36}$/i.test(String(p.merchantOrderId || ""))) return json({ ok: true, ignored: true });

  try {
    const { data: order } = await db().from("orders").select().eq("id", p.merchantOrderId).maybeSingle();
    if (!order) return json({ ok: true, ignored: "order tidak dikenal" });

    // 2) Jangan percaya isi callback mentah-mentah: cek ulang langsung ke API Duitku
    const tx = await getTransactionStatus(order.id);
    if (String(tx.merchantOrderId) !== order.id || (order.xendit_invoice_id && tx.reference !== order.xendit_invoice_id)) {
      console.warn("callback mismatch", p.merchantOrderId, tx.reference);
      return json({ ok: true, ignored: "mismatch" });
    }

    if (tx.statusCode === "00") {
      // 3) Pastikan nominal sesuai harga order
      const paid = Number(tx.amount);
      if (!(paid >= order.amount)) {
        console.error("nominal tidak sesuai", order.code, paid, order.amount);
        return json({ ok: true, ignored: "amount mismatch" });
      }

      // 4) Idempotent: status hanya berubah ke PAID sekali
      await db()
        .from("orders")
        .update({ status: "PAID", paid_at: new Date().toISOString(), payment_method: p.paymentCode || null })
        .eq("id", order.id)
        .neq("status", "PAID");

      // 5) Kirim email kalau belum pernah terkirim. Kalau gagal -> 500 supaya Duitku mengulang callback.
      const { data: fresh, error } = await db().from("orders").select().eq("id", order.id).single();
      if (error) throw error;
      if (!fresh.email_sent_at) await issueLinkAndEmail(fresh);
    } else if (tx.statusCode === "02") {
      await db().from("orders").update({ status: "EXPIRED" }).eq("id", order.id).eq("status", "PENDING");
    }

    return json({ ok: true });
  } catch (err) {
    console.error("callback error:", err);
    return json({ error: "internal" }, 500);
  }
}
