// /*
// Tujuan: Mendefinisikan tipe dan interface TypeScript global untuk data entitas aplikasi (Product, Content, Snapshot, dll).
// Caller: Seluruh file TypeScript di program
// Dependensi: None
// Main Functions: None (Type definitions only)
// Side Effects: None
// */

export interface Profile {
  id: string;
  email: string;
  display_name: string | null;
  gemini_api_key_encrypted: string | null;
  scoring_mode: 'benchmark' | 'topsis';
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: string;
  user_id: string;
  nama: string;
  brand: string | null;
  jenis: string | null;
  harga: number;
  komisi: number;
  kategori: string;
  label_prestasi: string;
  gmv_aktif: boolean;
  status: 'aktif' | 'jeda' | 'habis';
  desc_variants: string[];
  bench_score: number;
  topsis_score: number;
  klasifikasi: 'WINNING' | 'POTENTIAL' | 'MONITOR' | 'DROP';
  slot_rek: string;
  score_mode: 'benchmark' | 'topsis';
  created_at: string;
  updated_at: string;
}

export interface Content {
  id: string;
  user_id: string;
  product_id: string | null;
  desc_text: string | null;
  tanggal_upload: string;
  durasi: number; // dalam detik
  views: number;
  ctr: number;
  ctor: number;
  items_sold: number;
  gmv: number;
  est_komisi: number;
  created_at: string;
}

export interface PeriodSnapshot {
  id: string;
  content_id: string;
  user_id: string;
  period_start: string;
  period_end: string;
  views: number;
  ctr: number;
  ctor: number;
  items_sold: number;
  gmv: number;
}

export interface Template {
  id: string;
  user_id: string;
  type: 'hook' | 'proof' | 'cta';
  content: string;
  kategori: string;
  created_at: string;
}

export interface Schedule {
  id: string;
  user_id: string;
  created_at: string;
  schedule_data: ScheduleDaySlot[];
}

export interface ScheduleDaySlot {
  hari: string; // "Senin", "Selasa", dll
  slots: {
    jam: string;
    tipe: 'PRIME' | 'MID' | 'TEST';
    productId: string | null;
    productName: string | null;
    brand: string | null;
    kategori: string | null;
    hook: string | null;
    proof: string | null;
    cta: string | null;
  }[];
}
