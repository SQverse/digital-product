// GET /api/order-status?id=<uuid> — dipakai halaman sukses.html
import { db } from "../lib/supabase.js";
import { json } from "../lib/util.js";

function maskEmail(e) {
  const [u, d] = e.split("@");
  const head = u.length <= 2 ? u[0] : u.slice(0, 2);
  return head + "*".repeat(Math.max(1, Math.min(u.length - head.length, 6))) + "@" + d;
}

export async function GET(request) {
  const id = new URL(request.url).searchParams.get("id") || "";
  if (!/^[0-9a-f-]{36}$/i.test(id)) return json({ error: "not found" }, 404);

  const { data: o, error } = await db()
    .from("orders")
    .select("code,status,email,email_sent_at,invoice_url")
    .eq("id", id)
    .maybeSingle();
  if (error) return json({ error: "internal" }, 500);
  if (!o) return json({ error: "not found" }, 404);

  return json({
    code: o.code,
    status: o.status,
    email: maskEmail(o.email),
    emailSent: Boolean(o.email_sent_at),
    invoiceUrl: o.status === "PENDING" ? o.invoice_url : null,
  });
}
