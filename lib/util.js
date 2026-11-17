import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // tanpa 0/O/1/I agar tidak tertukar

export function randomCode(len) {
  const bytes = randomBytes(len);
  let s = "";
  for (const b of bytes) s += ALPHABET[b % ALPHABET.length];
  return s;
}

export const newOrderCode = () => "QT" + randomCode(6);
export const newPdfPassword = () => `${randomCode(4)}-${randomCode(4)}`;
export const newDownloadToken = () => randomBytes(32).toString("base64url");
export const sha256 = (s) => createHash("sha256").update(s).digest("hex");

export function safeEqual(a, b) {
  const x = Buffer.from(String(a ?? ""));
  const y = Buffer.from(String(b ?? ""));
  return x.length === y.length && timingSafeEqual(x, y);
}

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

export function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

export function rupiah(n) {
  return "Rp " + Number(n).toLocaleString("id-ID");
}
