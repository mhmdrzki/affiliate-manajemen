-- /*
-- Tujuan: Menambahkan tabel orders dan kolom-kolom baru pada products dan contents untuk integrasi data TikTok Affiliate Orders.
-- Caller: Supabase DB Migration / SQL Editor
-- Dependensi: public.products, public.contents
-- Main Functions: None (DDL only)
-- Side Effects: Memodifikasi skema DB, menambah tabel public.orders, kolom pada public.products dan public.contents.
-- */

-- Tabel baru: orders (sumber data utama)
CREATE TABLE IF NOT EXISTS public.orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    tiktok_order_id TEXT NOT NULL,
    product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
    content_id UUID REFERENCES public.contents(id) ON DELETE SET NULL,
    sku_id TEXT,
    product_name TEXT,
    items_sold INTEGER DEFAULT 0,
    items_refunded INTEGER DEFAULT 0,
    price NUMERIC DEFAULT 0,
    gmv NUMERIC DEFAULT 0,
    order_type TEXT DEFAULT 'affiliate',
    settlement_status TEXT DEFAULT 'Pending',
    commission_rate NUMERIC DEFAULT 0,
    est_commission NUMERIC DEFAULT 0,
    actual_commission NUMERIC DEFAULT 0,
    total_final_earned NUMERIC DEFAULT 0,
    shop_name TEXT,
    shop_code TEXT,
    order_date TIMESTAMPTZ,
    settlement_date TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, tiktok_order_id, sku_id)
);

-- Jaminan kolom baru jika tabel orders sudah pernah dibuat sebelumnya (CREATE TABLE IF NOT EXISTS dilewati)
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS product_name TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS sku_id TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS price NUMERIC DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS gmv NUMERIC DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS est_commission NUMERIC DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS actual_commission NUMERIC DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS total_final_earned NUMERIC DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS shop_name TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS shop_code TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS order_date TIMESTAMPTZ;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS settlement_date TIMESTAMPTZ;

-- Drop unique constraint lama jika ada dan buat baru dengan sku_id
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_user_id_tiktok_order_id_key;
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_user_id_tiktok_order_id_sku_id_key;
ALTER TABLE public.orders ADD CONSTRAINT orders_user_id_tiktok_order_id_sku_id_key UNIQUE (user_id, tiktok_order_id, sku_id);

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "User can perform CRUD on own orders" ON public.orders;

CREATE POLICY "User can perform CRUD on own orders"
    ON public.orders FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Kolom baru pada products
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS tiktok_product_id TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS shop_name TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS shop_code TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS avg_commission_rate NUMERIC DEFAULT 0;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS total_revenue NUMERIC DEFAULT 0;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS total_orders INTEGER DEFAULT 0;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS net_items_sold INTEGER DEFAULT 0;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS total_refunded INTEGER DEFAULT 0;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS kuota_mingguan INTEGER DEFAULT 0;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS aksi_rekomendasi TEXT DEFAULT '';
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS shop_ads_ratio NUMERIC DEFAULT 0;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS regularity_score NUMERIC DEFAULT 0;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS is_kerjasama BOOLEAN DEFAULT false;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS kerjasama_target INTEGER DEFAULT 0;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS kerjasama_deadline TIMESTAMPTZ;

-- Kolom baru pada contents
ALTER TABLE public.contents ADD COLUMN IF NOT EXISTS tiktok_content_id TEXT;
ALTER TABLE public.contents ADD COLUMN IF NOT EXISTS content_type TEXT DEFAULT 'Video';
ALTER TABLE public.contents ADD COLUMN IF NOT EXISTS total_orders INTEGER DEFAULT 0;
ALTER TABLE public.contents ADD COLUMN IF NOT EXISTS total_revenue NUMERIC DEFAULT 0;
ALTER TABLE public.contents ADD COLUMN IF NOT EXISTS likes INTEGER DEFAULT 0;
ALTER TABLE public.contents ADD COLUMN IF NOT EXISTS comments INTEGER DEFAULT 0;
ALTER TABLE public.contents ADD COLUMN IF NOT EXISTS shares INTEGER DEFAULT 0;
ALTER TABLE public.contents ADD COLUMN IF NOT EXISTS link_video TEXT;

-- Indexes
DROP INDEX IF EXISTS idx_orders_dedup;
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_dedup ON public.orders(user_id, tiktok_order_id, sku_id);
CREATE INDEX IF NOT EXISTS idx_orders_product ON public.orders(product_id);
CREATE INDEX IF NOT EXISTS idx_orders_content ON public.orders(content_id);
CREATE INDEX IF NOT EXISTS idx_orders_date ON public.orders(order_date DESC);
CREATE INDEX IF NOT EXISTS idx_orders_userid ON public.orders(user_id);
CREATE INDEX IF NOT EXISTS idx_products_tiktok_id ON public.products(user_id, tiktok_product_id);
CREATE INDEX IF NOT EXISTS idx_contents_tiktok_id ON public.contents(user_id, tiktok_content_id);
