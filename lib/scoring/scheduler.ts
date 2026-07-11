// /*
// Tujuan: Menangani alokasi 7 slot harian konten berdasarkan slot wajib kolaborasi, fairness queue, dan ranking skor produk.
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
 * 2. Fairness Queue (Produk Proven yang lama tidak dapat konten, jika kematangan data tercapai)
 * 3. Ranking Skor Produk (Pool A + Pool B)
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
  excludedCandidates: ScheduleResult["excluded"]
): ScheduleResult {
  const totalSlots = params.TOTAL_DAILY_SLOTS ?? 7;
  const maxSlotsPerProd = params.MAX_SLOT_PER_PRODUK ?? 2;
  const fairnessWindow = params.FAIRNESS_WINDOW ?? 30;

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
    // Tambahkan slot sebanyak pace harian yang dibutuhkan, dibatasi oleh total slot tersisa
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

  // ──── STEP 2: Fairness Queue ────
  // Cek apakah data maturity mencukupi untuk mengaktifkan fairness queue
  let fairness_active = false;
  let data_maturity_days = 0;

  if (contentTrackingStart) {
    const trackingTime = new Date(contentTrackingStart).getTime();
    const refTime = referenceDate.getTime();
    data_maturity_days = Math.max(0, Math.floor((refTime - trackingTime) / (24 * 60 * 60 * 1000)));
    
    // Fairness aktif jika rentang data di sistem sudah melewati FAIRNESS_WINDOW
    if (data_maturity_days >= fairnessWindow) {
      fairness_active = true;
    }
  }

  if (fairness_active) {
    // Cari produk Pool A (Proven) yang DSLC >= FAIRNESS_WINDOW
    const fairnessCandidates = poolA.filter((p) => p.dslc >= fairnessWindow);
    
    // Urutkan berdasarkan dslc terlama ke terbaru (descending)
    fairnessCandidates.sort((a, b) => b.dslc - a.dslc);

    fairnessCandidates.forEach((candidate) => {
      if (slots.length >= totalSlots) return;
      
      // Cek apakah produk ini sudah mendapat slot dari kolaborasi
      const currentCount = productSlotCount.get(candidate.product_id) ?? 0;
      if (currentCount < maxSlotsPerProd) {
        tryAddSlot(
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
    });
  }

  // ──── STEP 3: Ranking Fill (Pool A + Pool B) ────
  ranking.forEach((sp) => {
    if (slots.length >= totalSlots) return;
    
    // Lolos jika slot count produk masih di bawah batas maksimal per produk
    tryAddSlot(
      sp.product_id,
      sp.product_name,
      "ranked",
      sp.pool,
      sp.score,
      undefined,
      sp.score_breakdown,
      sp.aggregate
    );
  });

  // ──── STEP 4: Kumpulkan Hasil Excluded yang tidak dapat slot ────
  // Temukan produk yang memenuhi filter keras tapi tidak dapat slot karena kuota slot penuh
  const scheduledProductIds = new Set(slots.map((s) => s.product_id));
  const excludedResult: any[] = [...excludedCandidates];

  // Map untuk mencari scored product dengan cepat
  const scoredProductMap = new Map<string, ScoredProduct>();
  ranking.forEach((r) => scoredProductMap.set(r.product_id, r));

  allEligible.forEach((p) => {
    if (!scheduledProductIds.has(p.product_id)) {
      // Tentukan pool aslinya
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


  // Format ke YYYY-MM-DD
  const dateStr = referenceDate.toISOString().split("T")[0];

  return {
    date: dateStr,
    slots,
    excluded: excludedResult,
    metadata: {
      total_candidates: allEligible.length,
      pool_a_count: poolA.length,
      pool_b_count: poolB.length, // Termasuk D
      pool_c_count: poolCCount,
      pool_d_count: poolDCount,
      content_tracking_start: contentTrackingStart,
      data_maturity_days,
      fairness_active,
      params_used: params,
    },
  };
}
