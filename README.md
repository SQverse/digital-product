# Landing Page E-Book + Pembayaran Otomatis (Duitku)

Landing page statis + serverless function di Vercel. Tidak ada server yang perlu dirawat.

## Alur

```
Pembeli isi form (nama, email) ──► /api/checkout ──► buat order (Supabase) + tagihan (Duitku)
        │
        ▼
Halaman bayar Duitku (QRIS / VA / e-wallet / retail)
        │
        ├──► redirect ke /sukses.html (menunggu konfirmasi)
        │
        └──► Duitku memanggil /api/duitku-callback
                 1. cek signature md5(merchantCode+amount+merchantOrderId+apiKey)
                 2. cek ulang status transaksi langsung ke API Duitku
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
| `api/checkout.js` | Membuat order + tagihan Duitku |
| `api/duitku-callback.js` | Menerima notifikasi pembayaran dari Duitku |
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

### 3. Duitku
1. Uji coba dulu di **sandbox**: daftar di https://sandbox.duitku.com, buat **Proyek** baru.
   Catat **Kode Merchant** (`DUITKU_MERCHANT_CODE`) dan **API Key** (`DUITKU_API_KEY`), set `DUITKU_ENV=sandbox`.
2. Di pengaturan proyek, isi **Callback URL**: `https://DOMAIN-ANDA/api/duitku-callback`
   dan **Return URL**: `https://DOMAIN-ANDA/sukses.html`
3. Untuk jualan sungguhan: daftar & verifikasi di https://passport.duitku.com (perorangan: KTP + rekening),
   buat proyek dengan URL yang sama, lalu ganti kode merchant, API key, dan `DUITKU_ENV=production`.

### 4. Deploy ke Vercel
1. Push folder ini ke GitHub (repo privat), lalu **Import** di https://vercel.com
2. Framework preset: **Other**. Build command & output dibiarkan kosong.
3. **Settings → Environment Variables** → isi semua variabel di `.env.example`
4. Deploy, lalu hubungkan domain.

> ⚠️ Paket **Hobby (gratis) Vercel hanya untuk penggunaan non-komersial.** Untuk jualan, gunakan paket **Pro**.

### 5. Uji coba (Test Mode)
1. Buka website → Beli → isi form pakai email Anda sendiri
2. Di halaman pembayaran Duitku sandbox, selesaikan simulasi pembayaran (lihat panduan sandbox Duitku untuk cara membayar VA/QRIS uji coba)
3. Pastikan: halaman sukses berubah jadi "Berhasil", email masuk, file bisa dibuka dengan password, dan watermark muncul
4. Setelah lancar, ganti `DUITKU_MERCHANT_CODE`, `DUITKU_API_KEY` ke akun production dan `DUITKU_ENV=production`

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
