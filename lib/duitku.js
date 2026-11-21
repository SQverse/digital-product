// Integrasi Duitku POP (halaman pembayaran Duitku: QRIS, Virtual Account, e-wallet, retail).
// Format API & rumus signature mengikuti library resmi: github.com/duitkupg/duitku-php
import { createHash } from "node:crypto";
import { config } from "./config.js";

const md5 = (s) => createHash("md5").update(s).digest("hex");
const sha256 = (s) => createHash("sha256").update(s).digest("hex");

const base = () => (config.duitkuSandbox ? "https://api-sandbox.duitku.com" : "https://api-prod.duitku.com");

async function post(path, payload, headers = {}) {
  const res = await fetch(base() + path, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json", ...headers },
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  let body;
  try { body = JSON.parse(text); } catch { body = {}; }
  if (!res.ok) throw new Error(`Duitku ${res.status}: ${body.Message || body.statusMessage || text.slice(0, 200)}`);
  return body;
}

/** Buat tagihan. Mengembalikan { reference, paymentUrl }. */
export async function createInvoice({ order }) {
  const merchantCode = config.duitkuMerchantCode;
  const timestamp = Date.now();
  const [firstName, ...rest] = order.name.split(" ");

  const body = await post(
    "/api/merchant/createInvoice",
    {
      paymentAmount: order.amount,
      merchantOrderId: order.id, // UUID order kita (36 karakter)
      productDetails: `${config.productName} (Order #${order.code})`.slice(0, 255),
      email: order.email,
      phoneNumber: order.phone || "",
      customerVaName: order.name.slice(0, 20), // nama yang tampil di layar konfirmasi bank
      customerDetail: { firstName, lastName: rest.join(" "), email: order.email, phoneNumber: order.phone || "" },
      itemDetails: [{ name: config.productName, price: order.amount, quantity: 1 }],
      callbackUrl: `${config.siteUrl}/api/duitku-callback`,
      // Duitku menambahkan ?merchantOrderId=...&resultCode=...&reference=... saat redirect balik
      returnUrl: `${config.siteUrl}/sukses.html`,
      expiryPeriod: 60 * 24, // menit (24 jam)
    },
    {
      "x-duitku-signature": sha256(merchantCode + timestamp + config.duitkuApiKey),
      "x-duitku-timestamp": String(timestamp),
      "x-duitku-merchantcode": merchantCode,
    },
  );

  if (!body.paymentUrl || !body.reference) {
    throw new Error(`Duitku createInvoice gagal: ${body.statusCode || ""} ${body.statusMessage || JSON.stringify(body).slice(0, 200)}`);
  }
  return { reference: body.reference, paymentUrl: body.paymentUrl };
}

/**
 * Cek status transaksi langsung ke Duitku.
 * statusCode: "00" = berhasil, "01" = menunggu pembayaran, "02" = gagal/dibatalkan/kedaluwarsa.
 */
export function getTransactionStatus(merchantOrderId) {
  const merchantCode = config.duitkuMerchantCode;
  return post("/api/merchant/transactionStatus", {
    merchantCode,
    merchantOrderId,
    signature: md5(merchantCode + merchantOrderId + config.duitkuApiKey),
  });
}

/** Validasi signature callback: md5(merchantCode + amount + merchantOrderId + apiKey). */
export function callbackSignature({ merchantCode, amount, merchantOrderId }) {
  return md5(String(merchantCode) + String(amount) + String(merchantOrderId) + config.duitkuApiKey);
}
