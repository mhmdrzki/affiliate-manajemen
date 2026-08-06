// /*
// Tujuan: Menangani alokasi 7 slot harian konten berdasarkan slot wajib kolaborasi,
//         fairness queue, dan ranking skor produk dengan distribusi proporsional per pool.
//         Menggunakan algoritma Bresenham spacing untuk menyebar produk Pool B (testing)
//         secara merata di antara produk Pool A (proven), menghindari segregasi pool per hari.
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

  // ──── STEP 2: Fairness Queue (Status Check & Candidates Selection) ────
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

  // Siapkan kandidat fairness queue (Pool A yang dslc >= fairnessWindow)
  const fairnessCandidates: ProductAggregate[] = [];
  if (fairness_active) {
    const rawCandidates = poolA.filter((p) => p.dslc >= fairnessWindow);
    // Urutkan berdasarkan dslc terlama ke terbaru (descending)
    rawCandidates.sort((a, b) => b.dslc - a.dslc);
    fairnessCandidates.push(...rawCandidates);
  }

  let idxFair = 0;

  // ──── STEP 3: Proportional Interleaved Fill (Pool A + Pool B) ────
  // Pisahkan ranking menjadi per-pool (keduanya sudah sorted descending by score)
  const rankingA = ranking.filter((sp) => sp.pool === "A");
  const rankingB = ranking.filter((sp) => sp.pool === "B");

  const remaining = totalSlots - slots.length;
  const poolACount = poolA.length;
  const poolBCount = poolB.length;
  const totalPool = poolACount + poolBCount;

  // Hitung kuota proporsional berdasarkan komposisi portofolio
  let quotaA = remaining;
  let quotaB = 0;

  if (totalPool > 0 && poolBCount > 0 && poolACount > 0 && remaining >= 2) {
    // Kuota proporsional: min 1 slot per pool, proporsional ke jumlah produk
    const rawQuotaB = Math.round(remaining * poolBCount / totalPool);
    quotaB = Math.max(1, Math.min(rawQuotaB, remaining - 1, rankingB.length));
    quotaA = remaining - quotaB;
  } else if (poolACount === 0 && poolBCount > 0) {
    quotaB = remaining;
    quotaA = 0;
  }
  // Jika poolBCount === 0: quotaA = remaining, quotaB = 0 (default)

  // Bangun urutan interleaving dengan Bresenham spacing
  // Menyebar slot Pool B secara merata di antara slot Pool A
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

  // Isi slot sesuai urutan interleaving, dengan overflow jika pool habis
  let idxA = 0;
  let idxB = 0;

  // Helper untuk mencoba mengalokasikan slot Pool A (Prioritas 1: Fairness, Prioritas 2: Ranked)
  const tryAllocateA = (): boolean => {
    let filled = false;

    // Prioritas 1: Ambil dari Fairness Queue
    while (idxFair < fairnessCandidates.length && !filled) {
      const candidate = fairnessCandidates[idxFair];
      idxFair++;

      // Pastikan produk belum melebihi limit slot harian (misal jika sudah dapat dari Collab)
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

    // Prioritas 2: Ambil dari Ranking Pool A biasa
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

    return filled;
  };

  for (const poolTarget of fillOrder) {
    if (slots.length >= totalSlots) break;

    let filled = false;

    if (poolTarget === "B") {
      // Coba isi dari Pool B
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
      // Overflow: Pool B habis → coba Pool A (Fairness + Ranked)
      if (!filled) {
        filled = tryAllocateA();
      }
    } else {
      // Coba isi dari Pool A (Fairness + Ranked)
      filled = tryAllocateA();
      // Overflow: Pool A habis → coba Pool B
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
