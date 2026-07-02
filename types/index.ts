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
  klasifikasi: 'COLLABORATION' | 'RESTOCK_CONFIRMED' | 'PROVEN_WINNER' | 'GMV_ACTIVE' | 'RESTOCK_RECOVERY' | 'GROWING' | 'EARLY_STAGE' | 'MONITOR' | 'SPIKE_ONLY' | 'STAGNANT' | 'DECLINING';
  slot_rek: string;
  score_mode: 'benchmark' | 'topsis';
  created_at: string;
  updated_at: string;
  // TikTok Orders Fields
  tiktok_product_id: string | null;
  shop_name: string | null;
  shop_code: string | null;
  avg_commission_rate: number;
  total_revenue: number;
  total_orders: number;
  net_items_sold: number;
  total_refunded: number;
  kuota_mingguan: number;
  aksi_rekomendasi: string;
  shop_ads_ratio: number;
  regularity_score: number;
  is_kerjasama: boolean;
  kerjasama_target: number;
  kerjasama_deadline: string | null;
  // OOS Fields
  last_oos_started_at: string | null;
  last_oos_ended_at: string | null;
  pre_oos_classification: 'COLLABORATION' | 'RESTOCK_CONFIRMED' | 'PROVEN_WINNER' | 'GMV_ACTIVE' | 'RESTOCK_RECOVERY' | 'GROWING' | 'EARLY_STAGE' | 'MONITOR' | 'SPIKE_ONLY' | 'STAGNANT' | 'DECLINING' | null;
  content_made?: number;
}

export interface StockHistory {
  id: string;
  product_id: string;
  status: 'out_of_stock' | 'available';
  changed_at: string;
  changed_by: 'user' | 'system';
  notes: string | null;
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
  // TikTok Orders Fields
  tiktok_content_id: string | null;
  content_type: string;
  total_orders: number;
  total_revenue: number;
  likes: number;
  comments: number;
  shares: number;
  link_video: string | null;
}

export interface Order {
  id: string;
  user_id: string;
  tiktok_order_id: string;
  product_id: string | null;
  content_id: string | null;
  sku_id: string | null;
  product_name: string | null;
  items_sold: number;
  items_refunded: number;
  price: number;
  gmv: number;
  order_type: 'shop_ads' | 'affiliate';
  settlement_status: 'Settled' | 'Pending' | 'AwaitingPayment';
  commission_rate: number;
  est_commission: number;
  actual_commission: number;
  total_final_earned: number;
  shop_name: string | null;
  shop_code: string | null;
  order_date: string;
  settlement_date: string | null;
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
