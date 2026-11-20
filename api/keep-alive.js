// GET /api/keep-alive — dipanggil Vercel Cron sekali sehari agar project Supabase (paket gratis) tidak di-pause.
import { db } from "../lib/supabase.js";
import { json, safeEqual } from "../lib/util.js";

export async function GET(request) {
  // Vercel Cron otomatis mengirim header "Authorization: Bearer <CRON_SECRET>"
  const secret = process.env.CRON_SECRET;
  if (!secret || !safeEqual(request.headers.get("authorization"), `Bearer ${secret}`)) {
    return json({ error: "unauthorized" }, 401);
  }
  const { count, error } = await db().from("orders").select("id", { count: "exact", head: true });
  if (error) return json({ ok: false, error: error.message }, 500);
  return json({ ok: true, orders: count });
}
