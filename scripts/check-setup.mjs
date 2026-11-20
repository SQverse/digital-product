// Cek setup Supabase: node --env-file=.env scripts/check-setup.mjs
// Butuh minimal SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY di file .env
import { db } from "../lib/supabase.js";
import { config } from "../lib/config.js";
import { personalizePdf } from "../lib/watermark.js";

let fail = 0;
const ok = (m) => console.log("  OK   " + m);
const bad = (m, hint) => { fail++; console.log("  GAGAL " + m + (hint ? "\n        -> " + hint : "")); };

console.log("Cek setup Supabase:", process.env.SUPABASE_URL || "(SUPABASE_URL kosong)");

// 1. Tabel orders
{
  const { error } = await db().from("orders").select("id", { count: "exact", head: true });
  error ? bad("Tabel orders: " + error.message, "Jalankan supabase/schema.sql di SQL Editor") : ok("Tabel orders ada");
}

// 2. Fungsi claim_download
{
  const { data, error } = await db().rpc("claim_download", { p_token_hash: "cek-setup-dummy" });
  error ? bad("Fungsi claim_download: " + error.message, "Jalankan supabase/schema.sql di SQL Editor") : ok(`Fungsi claim_download ada (${data.length} baris)`);
}

// 3. Bucket storage harus privat
{
  const { data, error } = await db().storage.listBuckets();
  if (error) bad("Daftar bucket: " + error.message);
  else for (const name of ["ebook-source", "ebook-delivery"]) {
    const b = data.find((x) => x.id === name);
    if (!b) bad(`Bucket ${name} belum ada`, "Jalankan supabase/schema.sql");
    else if (b.public) bad(`Bucket ${name} PUBLIK!`, "Storage > bucket > Edit > matikan 'Public bucket'");
    else ok(`Bucket ${name} ada & privat`);
  }
}

// 4. File master ebook + uji watermark
{
  const { data, error } = await db().storage.from("ebook-source").download(config.sourcePdfPath);
  if (error) bad(`File ${config.sourcePdfPath} di bucket ebook-source belum ada`, "Upload ebook asli via Storage > ebook-source");
  else {
    const src = new Uint8Array(await data.arrayBuffer());
    ok(`File ${config.sourcePdfPath} ditemukan (${(src.length / 1048576).toFixed(1)} MB)`);
    const t = Date.now();
    try {
      const out = await personalizePdf(src, { name: "Cek Setup", email: "cek@contoh.com", orderCode: "QTCEK000", password: "CEK-1234" });
      ok(`Uji watermark + password berhasil: ${(out.length / 1048576).toFixed(1)} MB dalam ${((Date.now() - t) / 1000).toFixed(1)} detik`);
    } catch (e) {
      bad("Uji watermark gagal: " + e.message, "PDF mungkin sudah terkunci password/rusak. Upload versi tanpa password.");
    }
  }
}

console.log(fail ? `\n${fail} masalah ditemukan.` : "\nSemua beres!");
process.exit(fail ? 1 : 0);
