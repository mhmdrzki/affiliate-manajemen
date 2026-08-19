// /*
// Tujuan: Menangani alokasi 7 slot harian konten berdasarkan slot wajib kolaborasi,
//         slot prioritas produk hot (di-cap oleh HOT_PRIORITY_SLOTS), ranking skor produk, dan fairness queue.
// Caller: lib/scoring/index.ts
// Dependensi: lib/scoring/types.ts
// Main Functions: allocateSlots
// Side Effects: None (pure function)
// */

import { ScoredProduct, ProductAggregate, ScheduleSlot, ScheduleResult, Pool } from "./types";
import { CollabSlotCandidate } from "./engine";

/**
 * Mengalokasikan 7 slot harian konten dengan prioritas:
 * 1. Slot Wajib Kolaborasi
 * 2. Slot Prioritas Produk Hot / Winning (di-cap oleh HOT_PRIORITY_SLOTS, default 2)
 * 3. Ranking Skor Produk (Pool A + Pool B) dengan Alokasi Proporsional
 * 4. Fairness Queue (Produk Proven lama tidak dapat konten, sebagai cadangan/overflow)
 */
export function allocateSlots(
  collabSlots: CollabSlotCandidate[],
  ranking: ScoredProduct[],
  allEligible: ProductAggregate[],
  poolA: ProductAggregate[],
  poolB: ProductAggregate[],
  poolCCount: number,
  poolDCount: number,
  contentTrackingStart: string | null,
  referenceDate: Date,
  params: Record<string, number>,
  excludedCandidates: ScheduleResult["excluded"],
  hotProducts: ProductAggregate[] = []
): ScheduleResult {
  const totalSlots = params.TOTAL_DAILY_SLOTS ?? 7;
  const maxSlotsPerProd = params.MAX_SLOT_PER_PRODUK ?? 2;
  const fairnessWindow = params.FAIRNESS_WINDOW ?? 30;

  const hotProductIds = new Set(hotProducts.map((p) => p.product_id));

  const slots: ScheduleSlot[] = [];
  const productSlotCount = new Map<string, number>();

  // Helper untuk menambahkan slot
  const tryAddSlot = (
    productId: string,
    productName: string,
    slotType: ScheduleSlot["slot_type"],
    pool: Pool | null,
    score: number | null,
    paceInfo?: ScheduleSlot["pace_info"],
    scoreBreakdown?: any,
    aggregate?: any
  ): boolean => {
    if (slots.length >= totalSlots) return false;

    const currentCount = productSlotCount.get(productId) ?? 0;
    if (currentCount >= maxSlotsPerProd) return false;

    slots.push({
      slot_number: slots.length + 1,
      product_id: productId,
      product_name: productName,
      slot_type: slotType,
      pool,
      score,
      pace_info: paceInfo,
      // @ts-ignore (tambahkan properti untuk UI preview)
      score_breakdown: scoreBreakdown,
      aggregate: aggregate,
    });

    productSlotCount.set(productId, currentCount + 1);
    return true;
  };

  // ──── STEP 1: Slot Wajib Kolaborasi ────
  collabSlots.forEach((collab) => {
    const pace = collab.pace_harian;
    for (let i = 0; i < pace; i++) {
      if (slots.length >= totalSlots) break;
      tryAddSlot(
        collab.product.product_id,
        collab.product.product_name,
        "collaboration",
        null,
        null,
        {
          sisa_wajib: collab.sisa_wajib,
          hari_tersisa: collab.hari_tersisa,
          pace_harian: collab.pace_harian,
        },
        null,
        collab.product
      );
    }
  });

  // ──── STEP 2: Hot Product Priority Slots (CAPPED) ────
  // Alokasi slot prioritas untuk top-N produk hot berdasarkan ranking tertinggi.
  // Cap oleh HOT_PRIORITY_SLOTS agar tidak memonopoli seluruh jadwal harian.
  // Hot product yang tidak mendapat slot prioritas tetap bersaing di Step 4 (ranked)
  // dengan keuntungan skor hot_boost — mereka masih berpeluang besar masuk jadwal.
  const hotPrioritySlots = params.HOT_PRIORITY_SLOTS ?? 2;
  const hotRanked = ranking.filter((sp) => hotProductIds.has(sp.product_id));
  let hotPriorityFilled = 0;
  for (const hotProd of hotRanked) {
    if (slots.length >= totalSlots) break;
    if (hotPriorityFilled >= hotPrioritySlots) break;
    const added = tryAddSlot(
      hotProd.product_id,
      hotProd.product_name,
      "hot_product",
      hotProd.pool,
      hotProd.score,
      undefined,
      hotProd.score_breakdown,
      hotProd.aggregate
    );
    if (added) hotPriorityFilled++;
  }

  // ──── STEP 3: Fairness Queue Candidates Prep ────
  let fairness_active = false;
  let data_maturity_days = 0;

  if (contentTrackingStart) {
    const trackingTime = new Date(contentTrackingStart).getTime();
    const refTime = referenceDate.getTime();
    data_maturity_days = Math.max(0, Math.floor((refTime - trackingTime) / (24 * 60 * 60 * 1000)));
    
    if (data_maturity_days >= fairnessWindow) {
      fairness_active = true;
    }
  }

  const fairnessCandidates: ProductAggregate[] = [];
  if (fairness_active) {
    const rawCandidates = poolA.filter((p) => p.dslc >= fairnessWindow);
    rawCandidates.sort((a, b) => b.dslc - a.dslc);
    fairnessCandidates.push(...rawCandidates);
  }

  let idxFair = 0;

  // ──── STEP 4: Proportional Interleaved Fill (Pool A + Pool B) ────
  const rankingA = ranking.filter((sp) => sp.pool === "A");
  const rankingB = ranking.filter((sp) => sp.pool === "B");

  const remaining = totalSlots - slots.length;
  const poolACount = poolA.length;
  const poolBCount = poolB.length;
  const totalPool = poolACount + poolBCount;

  let quotaA = remaining;
  let quotaB = 0;

  if (totalPool > 0 && poolBCount > 0 && poolACount > 0 && remaining >= 2) {
    const rawQuotaB = Math.round((remaining * poolBCount) / totalPool);
    quotaB = Math.max(1, Math.min(rawQuotaB, remaining - 1, rankingB.length));
    quotaA = remaining - quotaB;
  } else if (poolACount === 0 && poolBCount > 0) {
    quotaB = remaining;
    quotaA = 0;
  }

  const fillOrder: ("A" | "B")[] = [];
  let bPlaced = 0;
  for (let i = 0; i < remaining; i++) {
    const expectedB = Math.round(((i + 1) * quotaB) / remaining);
    if (expectedB > bPlaced && bPlaced < quotaB) {
      fillOrder.push("B");
      bPlaced++;
    } else {
      fillOrder.push("A");
    }
  }

  let idxA = 0;
  let idxB = 0;

  // Helper mengalokasikan slot Pool A: Prioritas 1 = Skor Teratas, Prioritas 2 = Fairness Queue
  const tryAllocateA = (): boolean => {
    let filled = false;

    // Prioritas 1: Ambil dari Ranking Pool A biasa
    while (idxA < rankingA.length && !filled) {
      filled = tryAddSlot(
        rankingA[idxA].product_id,
        rankingA[idxA].product_name,
        "ranked",
        rankingA[idxA].pool,
        rankingA[idxA].score,
        undefined,
        rankingA[idxA].score_breakdown,
        rankingA[idxA].aggregate
      );
      idxA++;
    }

    // Prioritas 2: Jika ranking teratas sudah diambil/lewat, ambil dari Fairness Queue
    while (idxFair < fairnessCandidates.length && !filled) {
      const candidate = fairnessCandidates[idxFair];
      idxFair++;

      const currentCount = productSlotCount.get(candidate.product_id) ?? 0;
      if (currentCount < maxSlotsPerProd) {
        filled = tryAddSlot(
          candidate.product_id,
          candidate.product_name,
          "fairness",
          "A",
          null,
          undefined,
          null,
          candidate
        );
      }
    }

    return filled;
  };

  for (const poolTarget of fillOrder) {
    if (slots.length >= totalSlots) break;

    let filled = false;

    if (poolTarget === "B") {
      while (idxB < rankingB.length && !filled) {
        filled = tryAddSlot(
          rankingB[idxB].product_id,
          rankingB[idxB].product_name,
          "ranked",
          rankingB[idxB].pool,
          rankingB[idxB].score,
          undefined,
          rankingB[idxB].score_breakdown,
          rankingB[idxB].aggregate
        );
        idxB++;
      }
      if (!filled) {
        filled = tryAllocateA();
      }
    } else {
      filled = tryAllocateA();
      if (!filled) {
        while (idxB < rankingB.length && !filled) {
          filled = tryAddSlot(
            rankingB[idxB].product_id,
            rankingB[idxB].product_name,
            "ranked",
            rankingB[idxB].pool,
            rankingB[idxB].score,
            undefined,
            rankingB[idxB].score_breakdown,
            rankingB[idxB].aggregate
          );
          idxB++;
        }
      }
    }
  }

  // ──── STEP 5: Kumpulkan Hasil Excluded yang tidak dapat slot ────
  const scheduledProductIds = new Set(slots.map((s) => s.product_id));
  const excludedResult: any[] = [...excludedCandidates];

  const scoredProductMap = new Map<string, ScoredProduct>();
  ranking.forEach((r) => scoredProductMap.set(r.product_id, r));

  allEligible.forEach((p) => {
    if (!scheduledProductIds.has(p.product_id)) {
      let poolVal: Pool = "B";
      if (p.has_ever_sold) {
        poolVal = "A";
      } else if (p.total_content >= (params.TEST_BUDGET ?? 6)) {
        poolVal = "C";
      } else if (p.total_content === 0 && p.product_age_days <= (params.GRACE_DAYS ?? 5)) {
        poolVal = "D";
      }

      const sp = scoredProductMap.get(p.product_id);

      excludedResult.push({
        product_id: p.product_id,
        product_name: p.product_name,
        reason: poolVal === "C" ? "watchlist" : "no_slot",
        pool: poolVal,
        score: sp?.score || 0,
        score_breakdown: sp?.score_breakdown || {},
        aggregate: p,
      });
    }
  });

  const dateStr = referenceDate.toISOString().split("T")[0];

  return {
    date: dateStr,
    slots,
    excluded: excludedResult,
    metadata: {
      total_candidates: allEligible.length,
      pool_a_count: poolA.length,
      pool_b_count: poolB.length,
      pool_c_count: poolCCount,
      pool_d_count: poolDCount,
      hot_product_count: hotProducts.length,
      hot_products: hotProducts.map((p) => ({
        product_id: p.product_id,
        product_name: p.product_name,
        items_sold_7d: p.items_sold_7d,
        hot_score: p.hot_score,
      })),
      content_tracking_start: contentTrackingStart,
      data_maturity_days,
      fairness_active,
      params_used: params,
    },
  };
}
