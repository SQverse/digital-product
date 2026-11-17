import { config } from "./config.js";

const BASE = "https://api.xendit.co";

async function call(path, init = {}) {
  const res = await fetch(BASE + path, {
    ...init,
    headers: {
      authorization: "Basic " + Buffer.from(config.xenditSecretKey + ":").toString("base64"),
      "content-type": "application/json",
      ...(init.headers || {}),
    },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Xendit ${res.status}: ${body.error_code || ""} ${body.message || ""}`);
  return body;
}

export function createInvoice({ order }) {
  return call("/v2/invoices", {
    method: "POST",
    body: JSON.stringify({
      external_id: order.id,
      amount: order.amount,
      currency: "IDR",
      description: `${config.productName} (Order #${order.code})`,
      payer_email: order.email,
      customer: { given_names: order.name, email: order.email },
      invoice_duration: 60 * 60 * 24, // 24 jam
      success_redirect_url: `${config.siteUrl}/sukses.html?order=${order.id}`,
      failure_redirect_url: `${config.siteUrl}/#beli`,
      items: [{ name: config.productName, quantity: 1, price: order.amount }],
    }),
  });
}

export const getInvoice = (id) => call(`/v2/invoices/${encodeURIComponent(id)}`);
