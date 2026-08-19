// /*
// Tujuan: Menyediakan definisi interface dan tipe data internal untuk scoring engine.
// Caller: Seluruh file dalam lib/scoring/*
// Dependensi: None
// Main Functions: Pool, ProductAggregate, ScoredProduct, ScheduleSlot, ScheduleResult, WeeklyScheduleResult
// Side Effects: None
// */

export type Pool = 'A' | 'B' | 'C' | 'D';

/** Hasil agregasi data per produk — output dari aggregator.ts */
export interface ProductAggregate {
  product_id: string;
  product_name: string;
  date_added: string;         // YYYY-MM-DD
  stock_status: string;       // 'available' | 'out_of_stock' | 'unknown'
  status: string;             // 'active' | 'paused' | 'stopped'
  is_collaboration: boolean;
  collab_target_count: number | null;
  collab_deadline: string | null;    // YYYY-MM-DD
  collab_start_date: string | null;  // YYYY-MM-DD

  // === Order aggregates (dari sales_data) ===
  total_orders: number;       // COUNT(*) orders
  total_items_sold: number;   // SUM(items_sold)
  items_sold_7d: number;      // items sold dalam 7 hari terakhir
  items_sold_3d: number;      // items sold dalam 3 hari terakhir
  orders_7d: number;          // orders 7 hari terakhir
  last_order_date: string | null;  // MAX(ordered_at)
  dslo: number;               // days since last order (dari reference_date)
  orders_14d: number;         // orders dalam 14 hari terakhir
  orders_14d_prev: number;    // orders 14 hari sebelumnya (hari ke-15 s/d 28)

  // === Content aggregates (dari contents) ===
  total_content: number;      // COUNT(*) konten
  last_content_date: string | null;  // MAX(tanggal_upload)
  dslc: number;               // days since last content
  content_14d: number;        // konten dalam 14 hari terakhir
  content_14d_prev: number;   // konten 14 hari sebelumnya

  // === Derived & Hot Product Detection ===
  has_ever_sold: boolean;     // total_orders > 0
  product_age_days: number;   // reference_date - date_added
  is_hot: boolean;            // apakah terdeteksi sebagai hot product
  hot_score: number;          // 0.0 - 1.0 intensitas hot product

  // === Collab-specific ===
  collab_content_posted: number;  // konten antara collab_start s/d collab_deadline
}

/** Produk setelah di-score — output dari scorer.ts */
export interface ScoredProduct {
  product_id: string;
  product_name: string;
  pool: Pool;
  score: number;
  score_breakdown: {
    // Pool A components
    recency?: number;          // max(0.05, 1 - dslo/30)
    momentum?: number;         // normalized (orders_14d - orders_14d_prev), [-1,1]
    efficiency?: number;       // rank-percentile total_orders/max(total_content,1)
    content_debt?: number;     // min(1, dslc/21)
    untapped_bonus?: number;   // 0 | 0.3 | 1.0 tergantung content_tracking_start
    hot_product_boost?: number; // 0.0 - 1.0 berdasarkan velocity penjualan
    // Pool B components
    base_testing?: number;
    content_penalty?: number;
    new_product_bonus?: number;
  };
  aggregate: ProductAggregate;
}

/** Satu slot dalam jadwal harian */
export interface ScheduleSlot {
  slot_number: number;        // 1-7
  product_id: string;
  product_name: string;
  slot_type: 'collaboration' | 'hot_product' | 'fairness' | 'ranked';
  pool: Pool | null;
  score: number | null;
  pace_info?: {               // hanya untuk slot collaboration
    sisa_wajib: number;
    hari_tersisa: number;
    pace_harian: number;
  };
}

/** Hasil lengkap generate jadwal satu hari */
export interface ScheduleResult {
  date: string;               // YYYY-MM-DD
  slots: ScheduleSlot[];
  excluded: {
    product_id: string;
    product_name: string;
    reason: 'stok_habis' | 'tidak_aktif' | 'watchlist' | 'no_slot';
    pool?: Pool;
  }[];
  metadata: {
    total_candidates: number;
    pool_a_count: number;
    pool_b_count: number;
    pool_c_count: number;
    pool_d_count: number;
    hot_product_count: number;
    hot_products: {
      product_id: string;
      product_name: string;
      items_sold_7d: number;
      hot_score: number;
    }[];
    content_tracking_start: string | null;
    data_maturity_days: number;
    fairness_active: boolean;
    params_used: Record<string, number>;
  };
}

/** Hasil generate jadwal multi-hari (seminggu) */
export interface WeeklyScheduleResult {
  start_date: string;
  end_date: string;
  daily_schedules: ScheduleResult[];
}
