// /*
// Tujuan: Menyediakan default parameter konstanta untuk algoritma scoring dan alokasi penjadwalan konten.
// Caller: lib/scoring/index.ts, app/actions/schedule.ts
// Dependensi: None
// Main Functions: SCORING_DEFAULTS
// Side Effects: None
// */

export const SCORING_DEFAULTS = {
  // Pool classification
  TEST_BUDGET: 10,          // Batas konten testing sebelum masuk Watchlist
  GRACE_DAYS: 5,           // Masa produk baru bebas (Pool D label)

  // Score_A weights (balanced: hot boost signifikan tapi tidak mendominasi)
  WEIGHT_RECENCY: 0.25,
  WEIGHT_MOMENTUM: 0.20,
  WEIGHT_EFFICIENCY: 0.15,
  WEIGHT_CONTENT_DEBT: 0.10,
  WEIGHT_UNTAPPED: 0.10,
  WEIGHT_HOT_BOOST: 0.20,       // Cukup memberi keunggulan, tapi tidak memonopoli ranking

  // Score_A sub-params
  FLOOR_RECENCY: 0.05,     // Skor minimum Recency (produk lama tetap > 0)

  // Hot Product Detection params
  HOT_THRESHOLD: 5,             // Minimum items sold 7d untuk dianggap "hot"
  HOT_MAX_SCALE: 30,            // Skala normalisasi velocity (items_sold_7d / HOT_MAX_SCALE)
  HOT_PRIORITY_SLOTS: 2,        // Maks slot Step 2 (prioritas) yang dialokasikan khusus hot product per hari

  // Score_B params
  BASE_TESTING: 0.6,       // Titik awal skor testing
  TESTING_CONTENT_PENALTY: 0.05,  // Penurunan skor per konten testing
  NEW_PRODUCT_BONUS: 0.3,  // Bonus untuk total_content == 0

  // Scheduler params
  TOTAL_DAILY_SLOTS: 7,
  MAX_SLOT_PER_PRODUK: 1,  // Maks slot per produk per hari (1 = lebih banyak variasi)
  FAIRNESS_WINDOW: 30,     // Hari maks tanpa konten sebelum fairness trigger
} as const;

export type ScoringParamKey = keyof typeof SCORING_DEFAULTS;
