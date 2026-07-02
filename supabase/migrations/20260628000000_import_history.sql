-- /*
-- Tujuan: Menambahkan tabel import_logs dan foreign key pada orders untuk melacak riwayat impor Excel.
-- Caller: Supabase DB Migration / SQL Editor
-- Dependensi: auth.users, public.orders
-- Main Functions: None (DDL only)
-- Side Effects: Memodifikasi skema DB, menambah tabel public.import_logs, kolom pada public.orders.
-- */

-- 1. Tabel Riwayat Impor
CREATE TABLE IF NOT EXISTS public.import_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    filename TEXT NOT NULL,
    inserted_count INTEGER DEFAULT 0,
    updated_count INTEGER DEFAULT 0,
    skipped_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.import_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "User can perform CRUD on own import_logs" ON public.import_logs;

CREATE POLICY "User can perform CRUD on own import_logs"
    ON public.import_logs FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- 2. Tambah referensi import_log_id pada orders dengan CASCADE delete
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS import_log_id UUID REFERENCES public.import_logs(id) ON DELETE CASCADE;

-- Indeks performa
CREATE INDEX IF NOT EXISTS idx_orders_import_log_id ON public.orders(import_log_id);
CREATE INDEX IF NOT EXISTS idx_import_logs_userid ON public.import_logs(user_id);
