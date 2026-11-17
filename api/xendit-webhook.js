// POST /api/xendit-webhook — dipanggil Xendit saat status invoice berubah.
// Daftarkan URL ini di Xendit Dashboard > Settings > Webhooks > Invoices.
import { config } from "../lib/config.js";
import { db } from "../lib/supabase.js";
import { getInvoice } from "../lib/xendit.js";
import { issueLinkAndEmail } from "../lib/delivery.js";
import { json, safeEqual } from "../lib/util.js";

export async function POST(request) {
  // 1) Pastikan request benar-benar dari Xendit
  if (!safeEqual(request.headers.get("x-callback-token"), config.xenditWebhookToken)) {
    return json({ error: "unauthorized" }, 401);
  }

  let evt;
  try { evt = await request.json(); } catch { return json({ error: "bad json" }, 400); }
  if (!evt?.id || !/^[0-9a-f-]{36}$/i.test(String(evt?.external_id || ""))) return json({ ok: true, ignored: true });

  try {
    const { data: order } = await db().from("orders").select().eq("id", evt.external_id).maybeSingle();
    if (!order) return json({ ok: true, ignored: "order tidak dikenal" });

    // 2) Jangan percaya isi webhook mentah-mentah: cek ulang langsung ke API Xendit
    const inv = await getInvoice(evt.id);
    if (inv.external_id !== order.id || inv.id !== order.xendit_invoice_id) {
      console.warn("webhook mismatch", evt.id, order.id);
      return json({ ok: true, ignored: "mismatch" });
    }

    if (inv.status === "PAID" || inv.status === "SETTLED") {
      // 3) Pastikan nominal sesuai harga order
      const paid = Number(inv.paid_amount ?? inv.amount);
      if (!(paid >= order.amount)) {
        console.error("nominal tidak sesuai", order.code, paid, order.amount);
        return json({ ok: true, ignored: "amount mismatch" });
      }

      // 4) Idempotent: status hanya berubah ke PAID sekali
      await db()
        .from("orders")
        .update({ status: "PAID", paid_at: new Date().toISOString(), payment_method: inv.payment_method || null })
        .eq("id", order.id)
        .neq("status", "PAID");

      // 5) Kirim email kalau belum pernah terkirim. Kalau gagal -> 500 supaya Xendit mengulang.
      const { data: fresh, error } = await db().from("orders").select().eq("id", order.id).single();
      if (error) throw error;
      if (!fresh.email_sent_at) await issueLinkAndEmail(fresh);
    } else if (inv.status === "EXPIRED") {
      await db().from("orders").update({ status: "EXPIRED" }).eq("id", order.id).eq("status", "PENDING");
    }

    return json({ ok: true });
  } catch (err) {
    console.error("webhook error:", err);
    return json({ error: "internal" }, 500);
  }
}
