function req(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Environment variable ${name} belum diisi`);
  return v;
}

export const config = {
  get siteUrl() { return req("SITE_URL").replace(/\/+$/, ""); },
  get price() {
    const n = Number(req("PRODUCT_PRICE"));
    if (!Number.isInteger(n) || n < 1000) throw new Error("PRODUCT_PRICE tidak valid");
    return n;
  },
  get productName() { return process.env.PRODUCT_NAME || "E-Book Modul Pelatihan F64 Ultra"; },
  get xenditSecretKey() { return req("XENDIT_SECRET_KEY"); },
  get xenditWebhookToken() { return req("XENDIT_WEBHOOK_TOKEN"); },
  get supabaseUrl() { return req("SUPABASE_URL"); },
  get supabaseServiceKey() { return req("SUPABASE_SERVICE_ROLE_KEY"); },
  get sourcePdfPath() { return process.env.SOURCE_PDF_PATH || "ebook.pdf"; },
  get resendApiKey() { return req("RESEND_API_KEY"); },
  get emailFrom() { return req("EMAIL_FROM"); },
  get whatsapp() { return process.env.SUPPORT_WHATSAPP || ""; },
  get pdfPassword() { return (process.env.PDF_PASSWORD || "on").toLowerCase() !== "off"; },
  get linkValidDays() { return Number(process.env.LINK_VALID_DAYS || 7); },
};
