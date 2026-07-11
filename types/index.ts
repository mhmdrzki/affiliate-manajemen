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
  created_at: string;
  updated_at: string;
}

export interface Product {
  product_id: string;
  user_id: string;
  product_name: string;
  shop_name: string | null;
  shop_code: string | null;
  category: string;
  stock_status: 'available' | 'out_of_stock' | 'unknown';
  date_added: string;
  is_collaboration: boolean;
  collab_target_count: number | null;
  collab_deadline: string | null;
  collab_start_date: string | null;
  status: 'active' | 'paused' | 'stopped';
  reset_testing_at: string | null;
  created_at: string;
  updated_at: string;

  // Dynamically calculated in-memory metrics
  avg_price: number;
  commission_rate: number;
  total_revenue: number;
  total_orders: number;
  net_items_sold: number;
  shop_ads_ratio: number;
}

export interface Content {
  id: string;
  user_id: string;
  product_id: string | null;
  desc_text: string | null;
  tanggal_upload: string;
  views: number;
  ctr: number;
  ctor: number;
  items_sold: number;
  created_at: string;
  // TikTok Orders Fields
  tiktok_content_id: string | null;
  content_type: string;
  likes: number;
  comments: number;
  shares: number;
  link_video: string | null;
}

export interface Order {
  order_id: string;
  sku_id: string | null;
  product_id: string | null;
  product_name: string | null;
  contents_id: string | null;
  shop_code: string | null;
  order_type: 'shop_ads' | 'affiliate';
  price: number;
  items_sold: number;
  gmv: number;
  est_commission: number;
  actual_commission: number;
  settlement_status: 'settled' | 'pending' | 'awaiting_payment';
  ordered_at: string;
  user_id: string;
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
  schedule_date: string;
  slot_number: number;
  product_id: string | null;
  product_name: string;
  slot_type: 'collaboration' | 'fairness' | 'ranked';
  pool: 'A' | 'B' | null;
  score: number | null;
  created_at: string;
}

export interface ScoringParam {
  id: string;
  user_id: string;
  param_key: string;
  param_value: number;
  updated_at: string;
}



