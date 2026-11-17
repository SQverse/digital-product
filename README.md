# Landing Page E-Book + Pembayaran Otomatis (Xendit)

Landing page statis + serverless function di Vercel. Tidak ada server yang perlu dirawat.

## Alur

```
Pembeli isi form (nama, email) ──► /api/checkout ──► buat order (Supabase) + invoice (Xendit)
        │
        ▼
Halaman bayar Xendit (QRIS / VA / e-wallet / retail)
        │
        ├──► redirect ke /sukses.html (menunggu konfirmasi)
        │
        └──► Xendit memanggil /api/xendit-webhook
                 1. cek x-callback-token
                 2. cek ulang status invoice langsung ke API Xendit
                 3. cek nominal, ubah order -> PAID (sekali saja)
                 4. kirim email: link download + password PDF
                         │
                         ▼
             /api/download?t=TOKEN
                 - PDF master diberi watermark nama/email/order di SETIAP halaman
                 - dikunci password unik per pembeli (AES-256)
                 - redirect ke link sementara (60 detik)
                 - jatah download dibatasi (default 5x), link berlaku 7 hari
                 - pembeli bisa minta link baru dari halaman sukses
```

## Struktur

| File | Fungsi |
|---|---|
| `index.html` | Landing page + form checkout (`CONFIG.checkoutOtomatis`) |
| `sukses.html` | Status pesanan, tombol kirim ulang link |
| `api/checkout.js` | Membuat order + invoice Xendit |
| `api/xendit-webhook.js` | Menerima notifikasi pembayaran |
| `api/download.js` | Membuat PDF ber-watermark & mengirim file |
| `api/order-status.js` | Status order untuk halaman sukses |
| `api/resend-link.js` | Kirim ulang link ke email pembeli |
| `lib/watermark.js` | Watermark + password PDF |
| `supabase/schema.sql` | Tabel database & bucket storage |

## Setup (sekali saja)

### 1. Supabase (database + penyimpanan file)
1. Buat project di https://supabase.com
2. **SQL Editor** → paste isi `supabase/schema.sql` → **Run**
3. **Storage** → bucket `ebook-source` → upload file ebook asli dengan nama `ebook.pdf`
   (bucket ini **privat**, file tidak bisa diakses publik)
4. **Project Settings → API**: catat `Project URL` dan `service_role` key
   ⚠️ `service_role` key = kunci master. Jangan pernah ditaruh di HTML/frontend.

### 2. Resend (pengiriman email)
1. Daftar di https://resend.com
2. **Domains** → tambahkan domain toko & pasang DNS record yang diminta (agar email tidak masuk spam)
3. **API Keys** → buat key

### 3. Xendit
1. Daftar & lengkapi verifikasi di https://dashboard.xendit.co
2. Mulai di **Test Mode**: **Settings → API Keys** → buat Secret Key (izin *Money-in: Write*)
3. **Settings → Webhooks** → bagian *Invoices* → isi `https://DOMAIN-ANDA/api/xendit-webhook`
   Catat **Verification Token** di halaman yang sama.

### 4. Deploy ke Vercel
1. Push folder ini ke GitHub (repo privat), lalu **Import** di https://vercel.com
2. Framework preset: **Other**. Build command & output dibiarkan kosong.
3. **Settings → Environment Variables** → isi semua variabel di `.env.example`
4. Deploy, lalu hubungkan domain.

> ⚠️ Paket **Hobby (gratis) Vercel hanya untuk penggunaan non-komersial.** Untuk jualan, gunakan paket **Pro**.

### 5. Uji coba (Test Mode)
1. Buka website → Beli → isi form pakai email Anda sendiri
2. Di halaman invoice Xendit test mode, selesaikan simulasi pembayaran
3. Pastikan: halaman sukses berubah jadi "Berhasil", email masuk, file bisa dibuka dengan password, dan watermark muncul
4. Setelah lancar, ganti `XENDIT_SECRET_KEY` & webhook ke **Live Mode**

## Pekerjaan admin sehari-hari (lewat Supabase → Table Editor → `orders`)

- **Pembeli kehabisan jatah download** → naikkan `max_downloads` pada order tersebut.
- **Pembeli salah ketik email** → perbaiki kolom `email`, lalu pembeli menekan "Kirim Ulang Link" di halaman sukses (atau kosongkan `email_sent_at` & `email_send_count`).
- **Menemukan file bocor** → baca nama / email / kode order di footer atau watermark diagonal file, lalu cari `code` di tabel.
- **Revisi ebook** → upload ulang `ebook.pdf` di bucket `ebook-source`, lalu kosongkan kolom `file_path` order yang ingin mendapat versi baru (PDF akan dibuat ulang saat download berikutnya).

## Uji watermark lokal

```bash
npm install
node scripts/test-watermark.mjs path/ke/ebook.pdf
# hasil: test-output.pdf, password: TEST-1234
```
