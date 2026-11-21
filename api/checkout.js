// POST /api/checkout  { name, email, phone? }  ->  { invoiceUrl, orderId }
import { config } from "../lib/config.js";
import { db } from "../lib/supabase.js";
import { createInvoice } from "../lib/duitku.js";
import { json, newOrderCode, newPdfPassword } from "../lib/util.js";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export async function POST(request) {
  let body;
  try { body = await request.json(); } catch { return json({ error: "Data tidak valid" }, 400); }

  const name = String(body.name || "").trim().replace(/\s+/g, " ");
  const email = String(body.email || "").trim().toLowerCase();
  const phone = String(body.phone || "").replace(/[^\d+]/g, "");

  if (name.length < 2 || name.length > 80) return json({ error: "Nama wajib diisi (2–80 karakter)" }, 400);
  if (!EMAIL_RE.test(email) || email.length > 120) return json({ error: "Alamat email tidak valid" }, 400);
  if (phone && (phone.length < 9 || phone.length > 16)) return json({ error: "Nomor WhatsApp tidak valid" }, 400);

  try {
    // Harga SELALU diambil dari server, bukan dari browser
    const { data: order, error } = await db()
      .from("orders")
      .insert({
        code: newOrderCode(),
        name,
        email,
        phone: phone || null,
        amount: config.price,
        pdf_password: config.pdfPassword ? newPdfPassword() : null,
      })
      .select()
      .single();
    if (error) throw error;

    const invoice = await createInvoice({ order });

    await db()
      .from("orders")
      // kolom xendit_invoice_id dipakai ulang untuk menyimpan "reference" dari Duitku
      .update({ xendit_invoice_id: invoice.reference, invoice_url: invoice.paymentUrl })
      .eq("id", order.id);

    return json({ invoiceUrl: invoice.paymentUrl, orderId: order.id });
  } catch (err) {
    console.error("checkout error:", err);
    return json({ error: "Gagal membuat pembayaran. Silakan coba lagi sebentar lagi." }, 500);
  }
}
