-- /*
-- Tujuan: Inisialisasi skema database PostgreSQL Supabase dengan Row Level Security (RLS) dan Indeks performa.
-- Caller: Supabase Migrations / SQL Editor
-- Dependensi: auth.users
-- Main Tables: profiles, products, contents, period_snapshots, templates, schedules
-- Side Effects: Memodifikasi skema DB, mengaktifkan RLS, membuat triggers untuk profiles.
-- */

-- 1. Tabel Profil User (Ekstensi dari auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    display_name TEXT,
    gemini_api_key_encrypted TEXT,
    scoring_mode TEXT DEFAULT 'benchmark',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "User can view own profile" 
    ON public.profiles FOR SELECT 
    USING (auth.uid() = id);

CREATE POLICY "User can update own profile" 
    ON public.profiles FOR UPDATE 
    USING (auth.uid() = id);

-- Trigger untuk otomatis buat profil ketika user sign up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, display_name)
    VALUES (new.id, new.email, COALESCE(new.raw_user_meta_data->>'display_name', new.email));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2. Tabel Master Produk
CREATE TABLE IF NOT EXISTS public.products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    nama TEXT NOT NULL,
    brand TEXT,
    jenis TEXT,
    harga INTEGER DEFAULT 0,
    komisi INTEGER DEFAULT 0,
    kategori TEXT DEFAULT 'Umum',
    label_prestasi TEXT DEFAULT '-',
    gmv_aktif BOOLEAN DEFAULT false,
    status TEXT DEFAULT 'aktif', -- aktif | jeda | habis
    desc_variants TEXT[] DEFAULT '{}',
    bench_score NUMERIC DEFAULT 0,
    topsis_score NUMERIC DEFAULT 0,
    klasifikasi TEXT DEFAULT 'MONITOR',
    slot_rek TEXT DEFAULT '',
    score_mode TEXT DEFAULT 'benchmark',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "User can perform CRUD on own products"
    ON public.products FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- 3. Tabel Riwayat Konten (Analitik Video)
CREATE TABLE IF NOT EXISTS public.contents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
    desc_text TEXT,
    tanggal_upload TIMESTAMPTZ,
    durasi INTEGER, -- dalam detik
    views INTEGER DEFAULT 0,
    ctr NUMERIC DEFAULT 0,
    ctor NUMERIC DEFAULT 0,
    items_sold INTEGER DEFAULT 0,
    gmv INTEGER DEFAULT 0,
    est_komisi INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.contents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "User can perform CRUD on own contents"
    ON public.contents FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- 4. Tabel Period Snapshots (Rincian per periode import)
CREATE TABLE IF NOT EXISTS public.period_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content_id UUID NOT NULL REFERENCES public.contents(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    period_start TIMESTAMPTZ NOT NULL,
    period_end TIMESTAMPTZ NOT NULL,
    views INTEGER DEFAULT 0,
    ctr NUMERIC DEFAULT 0,
    ctor NUMERIC DEFAULT 0,
    items_sold INTEGER DEFAULT 0,
    gmv INTEGER DEFAULT 0
);

ALTER TABLE public.period_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "User can perform CRUD on own period_snapshots"
    ON public.period_snapshots FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- 5. Tabel Bank Template (Hooks, Proofs, CTAs)
CREATE TABLE IF NOT EXISTS public.templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('hook', 'proof', 'cta')),
    content TEXT NOT NULL,
    kategori TEXT DEFAULT 'Umum',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "User can perform CRUD on own templates"
    ON public.templates FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- 6. Tabel Riwayat Jadwal
CREATE TABLE IF NOT EXISTS public.schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    schedule_data JSONB NOT NULL
);

ALTER TABLE public.schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "User can perform CRUD on own schedules"
    ON public.schedules FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Indeks performa untuk query relasional dan filter user_id
CREATE INDEX IF NOT EXISTS idx_products_userid ON public.products(user_id);
CREATE INDEX IF NOT EXISTS idx_contents_userid_prodid ON public.contents(user_id, product_id);
CREATE INDEX IF NOT EXISTS idx_snapshots_contentid ON public.period_snapshots(content_id);
CREATE INDEX IF NOT EXISTS idx_snapshots_userid ON public.period_snapshots(user_id);
CREATE INDEX IF NOT EXISTS idx_templates_userid_type ON public.templates(user_id, type);
CREATE INDEX IF NOT EXISTS idx_schedules_userid ON public.schedules(user_id);
