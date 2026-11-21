-- Jalankan sekali di Supabase: Dashboard > SQL Editor > New query > paste > Run

create table if not exists public.orders (
  id                   uuid primary key default gen_random_uuid(),
  code                 text not null unique,            -- kode order singkat, mis. QT7F3K9A
  name                 text not null,
  email                text not null,
  phone                text,
  amount               integer not null,
  status               text not null default 'PENDING' check (status in ('PENDING','PAID','EXPIRED')),
  xendit_invoice_id    text unique,                     -- berisi "reference" Duitku (nama kolom warisan dari Xendit)
  invoice_url          text,
  payment_method       text,
  paid_at              timestamptz,
  pdf_password         text,                            -- key PDF unik per pembeli
  file_path            text,                            -- cache PDF ber-watermark di storage
  download_token_hash  text unique,                     -- hanya hash yang disimpan, token asli cuma ada di email
  download_expires_at  timestamptz,
  download_count       integer not null default 0,
  max_downloads        integer not null default 5,      -- admin bisa menaikkan manual per order
  email_sent_at        timestamptz,
  email_send_count     integer not null default 0,
  created_at           timestamptz not null default now()
);

create index if not exists orders_email_idx on public.orders (email);

-- RLS aktif tanpa policy = tabel TIDAK bisa diakses dari browser (anon key).
-- Hanya server (service role key) yang bisa membaca/menulis.
alter table public.orders enable row level security;

-- Klaim jatah download secara atomik (aman dari klik berulang bersamaan)
create or replace function public.claim_download(p_token_hash text)
returns setof public.orders
language sql
security definer
set search_path = public
as $$
  update public.orders
     set download_count = download_count + 1
   where download_token_hash = p_token_hash
     and status = 'PAID'
     and download_expires_at > now()
     and download_count < max_downloads
  returning *;
$$;
revoke all on function public.claim_download(text) from public, anon, authenticated;

-- Bucket privat:
--   ebook-source   : upload file master ebook.pdf ke sini (manual, lewat dashboard)
--   ebook-delivery : salinan ber-watermark per pembeli (dibuat otomatis)
insert into storage.buckets (id, name, public)
values ('ebook-source', 'ebook-source', false),
       ('ebook-delivery', 'ebook-delivery', false)
on conflict (id) do nothing;
