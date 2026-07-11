// /*
// Tujuan: Menyediakan fungsi logika filter keras, klasifikasi pool produk, perhitungan formula Score_A & Score_B, dan sorting peringkat.
// Caller: lib/scoring/index.ts
// Dependensi: lib/scoring/types.ts, lib/scoring/constants.ts
// Main Functions: filterKeras, identifyCollaborationSlots, classifyPools, scorePoolA, scorePoolB, mergeAndRank
// Side Effects: None (Stateless pure functions)
// */

import { ProductAggregate, ScoredProduct, Pool } from "./types";

/**
 * Filter Keras: Mengeliminasi produk yang berstatus tidak aktif atau stok habis.
 * Catatan: Status stok 'unknown' tetap lolos filter (ikut scoring).
 */
export function filterKeras(aggregates: ProductAggregate[]): {
  eligible: ProductAggregate[];
  excluded: { product_id: string; product_name: string; reason: 'stok_habis' | 'tidak_aktif' }[];
} {
  const eligible: ProductAggregate[] = [];
  const excluded: { product_id: string; product_name: string; reason: 'stok_habis' | 'tidak_aktif' }[] = [];

  aggregates.forEach((p) => {
    if (p.status !== "active") {
      excluded.push({
        product_id: p.product_id,
        product_name: p.product_name,
        reason: "tidak_aktif",
      });
    } else if (p.stock_status === "out_of_stock") {
      excluded.push({
        product_id: p.product_id,
        product_name: p.product_name,
        reason: "stok_habis",
      });
    } else {
      eligible.push(p);
    }
  });

  return { eligible, excluded };
}

export interface CollabSlotCandidate {
  product: ProductAggregate;
  pace_harian: number;
  sisa_wajib: number;
  hari_tersisa: number;
}

/**
 * Mengidentifikasi produk kolaborasi yang sedang berjalan dan menghitung pace harian.
 */
export function identifyCollaborationSlots(
  eligible: ProductAggregate[],
  referenceDate: Date
): CollabSlotCandidate[] {
  const result: CollabSlotCandidate[] = [];
  const refTime = referenceDate.getTime();

  eligible.forEach((p) => {
    if (p.is_collaboration && p.collab_start_date && p.collab_deadline) {
      const start = new Date(p.collab_start_date).getTime();
      const end = new Date(p.collab_deadline + "T23:59:59").getTime(); // Akhir hari deadline

      if (refTime >= start && refTime <= end) {
        const target = p.collab_target_count || 0;
        const posted = p.collab_content_posted || 0;
        const sisa_wajib = target - posted;

        if (sisa_wajib > 0) {
          // Hitung selisih hari tersisa
          const diffMs = end - refTime;
          const hari_tersisa = Math.max(1, Math.ceil(diffMs / (24 * 60 * 60 * 1000)));
          const pace_harian = Math.ceil(sisa_wajib / hari_tersisa);

          result.push({
            product: p,
            pace_harian,
            sisa_wajib,
            hari_tersisa,
          });
        }
      }
    }
  });

  return result;
}

/**
 * Mengklasifikasikan produk ke dalam pool A, B, C, D sesuai kriteria spesifikasi.
 */
export function classifyPools(
  eligible: ProductAggregate[],
  params: Record<string, number>
): {
  poolA: ProductAggregate[];
  poolB: ProductAggregate[]; // Termasuk Pool D
  poolC: ProductAggregate[];
  poolD: ProductAggregate[]; // Subset Pool B (New Products)
} {
  const poolA: ProductAggregate[] = [];
  const poolB: ProductAggregate[] = [];
  const poolC: ProductAggregate[] = [];
  const poolD: ProductAggregate[] = [];

  const testBudget = params.TEST_BUDGET ?? 6;
  const graceDays = params.GRACE_DAYS ?? 5;

  eligible.forEach((p) => {
    if (p.has_ever_sold) {
      poolA.push(p);
    } else {
      // Belum pernah closing
      if (p.total_content === 0 && p.product_age_days <= graceDays) {
        // Pool D: Produk Baru
        poolD.push(p);
        poolB.push(p); // Produk baru juga masuk Pool B untuk di-score
      } else if (p.total_content < testBudget) {
        // Pool B: Testing
        poolB.push(p);
      } else {
        // Pool C: Watchlist
        poolC.push(p);
      }
    }
  });

  return { poolA, poolB, poolC, poolD };
}

/**
 * Menghitung Score_A untuk produk Proven.
 */
export function scorePoolA(
  products: ProductAggregate[],
  contentTrackingStart: string | null,
  params: Record<string, number>
): ScoredProduct[] {
  const wRecency = params.WEIGHT_RECENCY ?? 0.35;
  const wMomentum = params.WEIGHT_MOMENTUM ?? 0.20;
  const wEfficiency = params.WEIGHT_EFFICIENCY ?? 0.20;
  const wDebt = params.WEIGHT_CONTENT_DEBT ?? 0.15;
  const wUntapped = params.WEIGHT_UNTAPPED ?? 0.10;
  const floorRecency = params.FLOOR_RECENCY ?? 0.05;

  const count = products.length;
  if (count === 0) return [];

  // --- 1. Persiapan Perhitungan Momentum & Efficiency ---
  // Hitung momentum mentah per produk dan cari max absolute momentum untuk normalisasi
  const rawMomentums = products.map((p) => p.orders_14d - p.orders_14d_prev);
  const maxAbsMomentum = Math.max(...rawMomentums.map((m) => Math.abs(m)), 1);

  // Hitung efficiency mentah (orders / max(content, 1)) per produk
  // efficiency = total_orders / max(total_content, 1) -> tidak pakai GMV/harga/komisi
  const rawEfficiencies = products.map((p) => {
    const denom = Math.max(p.total_content, 1);
    return {
      product_id: p.product_id,
      val: p.total_orders / denom,
    };
  });

  // Urutkan untuk rank-percentile
  rawEfficiencies.sort((a, b) => a.val - b.val);
  const efficiencyRankMap = new Map<string, number>();
  rawEfficiencies.forEach((item, index) => {
    // rank percentile: index / max(count - 1, 1)
    const rankVal = count > 1 ? index / (count - 1) : 1.0;
    efficiencyRankMap.set(item.product_id, rankVal);
  });

  // Hitung rata-rata jumlah konten Pool A untuk UntappedBonus
  const totalContents = products.reduce((acc, p) => acc + p.total_content, 0);
  const avgContent = count > 0 ? totalContents / count : 0;

  // --- 2. Perhitungan Skor per Produk ---
  return products.map((p) => {
    // a. Recency = max(FLOOR_RECENCY, 1 - dslo/30)
    const recency = Math.max(floorRecency, 1 - p.dslo / 30);

    // b. Momentum = clamp(raw_momentum / max_abs_momentum, -1, 1)
    const rawMom = p.orders_14d - p.orders_14d_prev;
    const momentum = Math.min(1, Math.max(-1, rawMom / maxAbsMomentum));

    // c. Efficiency = rank percentile dari orders per content
    const efficiency = efficiencyRankMap.get(p.product_id) ?? 0;

    // d. ContentDebt = min(1, dslc / 21)
    const contentDebt = Math.min(1, p.dslc / 21);

    // e. UntappedBonus
    let untappedBonus = 0;
    if (p.total_content < avgContent && contentTrackingStart) {
      const addedTime = new Date(p.date_added).getTime();
      const trackingStartTime = new Date(contentTrackingStart).getTime();
      
      if (addedTime >= trackingStartTime) {
        untappedBonus = 1.0; // Histori lengkap dapat bonus penuh
      } else {
        untappedBonus = 0.3; // Histori tidak pasti dapat bonus kecil
      }
    }

    // Final Composite Score
    const score =
      wRecency * recency +
      wMomentum * momentum +
      wEfficiency * efficiency +
      wDebt * contentDebt +
      wUntapped * untappedBonus;

    return {
      product_id: p.product_id,
      product_name: p.product_name,
      pool: "A" as Pool,
      score: Math.max(0, score),
      score_breakdown: {
        recency,
        momentum,
        efficiency,
        content_debt: contentDebt,
        untapped_bonus: untappedBonus,
      },
      aggregate: p,
    };
  });
}

/**
 * Menghitung Score_B untuk produk Testing.
 */
export function scorePoolB(
  products: ProductAggregate[],
  params: Record<string, number>
): ScoredProduct[] {
  const baseTesting = params.BASE_TESTING ?? 0.6;
  const penalty = params.TESTING_CONTENT_PENALTY ?? 0.12;
  const newProductBonus = params.NEW_PRODUCT_BONUS ?? 0.3;

  return products.map((p) => {
    const isNew = p.total_content === 0;
    const bonus = isNew ? newProductBonus : 0;
    const contentPenalty = p.total_content * penalty;

    const score = baseTesting - contentPenalty + bonus;

    return {
      product_id: p.product_id,
      product_name: p.product_name,
      pool: "B" as Pool,
      score: Math.max(0, score),
      score_breakdown: {
        base_testing: baseTesting,
        content_penalty: contentPenalty,
        new_product_bonus: bonus,
      },
      aggregate: p,
    };
  });
}

/**
 * Menggabungkan dan mengurutkan produk terskor menurun.
 */
export function mergeAndRank(
  scoredA: ScoredProduct[],
  scoredB: ScoredProduct[]
): ScoredProduct[] {
  const merged = [...scoredA, ...scoredB];
  return merged.sort((a, b) => b.score - a.score);
}
