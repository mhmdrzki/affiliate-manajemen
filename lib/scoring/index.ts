// /*
// Tujuan: Orkestrator utama algoritma skoring dan generator jadwal konten harian/mingguan.
//         Mendukung fitur "Estafet Rencana Masa Depan" — saat generate jadwal tanggal
//         di masa depan, sistem membaca jadwal tersimpan (tabel schedules) sebagai
//         riwayat virtual agar jadwal tidak monoton/bertabrakan antar-minggu.
// Caller: app/actions/schedule.ts
// Dependensi: lib/scoring/aggregator.ts, lib/scoring/engine.ts, lib/scoring/scheduler.ts,
//             lib/scoring/constants.ts, lib/db/index.ts, lib/db/schema.ts (schedules)
// Main Functions: generateDailySchedule, generateWeeklySchedule, loadParams, loadSavedScheduleHistory
// Side Effects: Membaca database (DB read-only)
// */

import { db } from "../db";
import { scoring_params, schedules } from "../db/schema";
import { eq, and, sql } from "drizzle-orm";
import { SCORING_DEFAULTS } from "./constants";
import { aggregateProducts } from "./aggregator";
import {
  filterKeras,
  identifyCollaborationSlots,
  classifyPools,
  scorePoolA,
  scorePoolB,
  mergeAndRank,
  detectHotProducts,
} from "./engine";
import { allocateSlots } from "./scheduler";
import { ScheduleResult, WeeklyScheduleResult } from "./types";

/**
 * Load parameter scoring milik user, gabungkan dengan default global.
 */
export async function loadParams(userId: string): Promise<Record<string, number>> {
  const rows = await db
    .select()
    .from(scoring_params)
    .where(eq(scoring_params.user_id, userId));

  const params: Record<string, number> = { ...SCORING_DEFAULTS };
  rows.forEach((row) => {
    params[row.param_key] = row.param_value;
  });

  return params;
}

/**
 * Estafet Rencana Masa Depan:
 * Membaca jadwal tersimpan dari tabel `schedules` sebagai riwayat virtual.
 * Hanya aktif jika tanggal referensi di masa depan (> hari ini).
 *
 * @param userId - ID user
 * @param fromDateStr - Tanggal awal pembacaan (inklusif, biasanya hari ini) YYYY-MM-DD
 * @param toDateStr - Tanggal akhir pembacaan (eksklusif, biasanya startDate batch) YYYY-MM-DD
 * @returns Map<product_id, string[]> berisi tanggal-tanggal jadwal tersimpan per produk
 */
async function loadSavedScheduleHistory(
  userId: string,
  fromDateStr: string,
  toDateStr: string
): Promise<Map<string, string[]>> {
  const savedSlots = await db
    .select({
      product_id: schedules.product_id,
      schedule_date: schedules.schedule_date,
    })
    .from(schedules)
    .where(
      and(
        eq(schedules.user_id, userId),
        sql`${schedules.schedule_date} >= ${fromDateStr}`,
        sql`${schedules.schedule_date} < ${toDateStr}`
      )
    );

  const history = new Map<string, string[]>();
  savedSlots.forEach((slot) => {
    if (slot.product_id) {
      const list = history.get(slot.product_id) || [];
      list.push(slot.schedule_date);
      history.set(slot.product_id, list);
    }
  });

  return history;
}

/**
 * Memicu generate jadwal harian lengkap untuk satu tanggal referensi tertentu.
 * Jika dipanggil standalone (tanpa virtualHistory) dan referenceDate > today,
 * otomatis memuat jadwal tersimpan sebagai riwayat virtual (Estafet Rencana Masa Depan).
 */
export async function generateDailySchedule(
  userId: string,
  referenceDate: Date = new Date(),
  paramsOverride?: Record<string, number>,
  virtualHistory?: Map<string, string[]>
): Promise<ScheduleResult> {
  // 1. Ambil parameter (load dari DB atau gunakan override/default)
  const params = paramsOverride || (await loadParams(userId));

  // 2. Estafet Rencana Masa Depan (standalone call saja)
  //    Jika virtualHistory sudah disediakan (dari generateWeeklySchedule), skip — caller sudah handle.
  //    Jika tidak, dan tanggal di masa depan, load dari schedules.
  let effectiveHistory = virtualHistory;
  if (!virtualHistory) {
    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];
    const refStr = referenceDate.toISOString().split("T")[0];

    if (refStr > todayStr) {
      const loaded = await loadSavedScheduleHistory(userId, todayStr, refStr);
      if (loaded.size > 0) {
        effectiveHistory = loaded;
      }
    }
  }

  // 3. Agregasi data produk dari orders dan contents (termasuk riwayat virtual)
  const { aggregates, contentTrackingStart } = await aggregateProducts(userId, referenceDate, effectiveHistory);

  // 3.5 Deteksi produk Hot / Winning
  const enrichedAggregates = detectHotProducts(aggregates, params);

  // 4. Jalankan Filter Keras
  const { eligible, excluded } = filterKeras(enrichedAggregates);

  // 5. Identifikasi Slot Wajib Kolaborasi
  const collabSlots = identifyCollaborationSlots(eligible, referenceDate);

  // 6. Klasifikasikan pool produk
  const { poolA, poolB, poolC, poolD } = classifyPools(eligible, params);

  // 7. Hitung scoring untuk Pool A (Proven)
  const scoredA = scorePoolA(poolA, contentTrackingStart, params);

  // 8. Hitung scoring untuk Pool B (Testing)
  const scoredB = scorePoolB(poolB, params);

  // 9. Gabungkan dan ranking Pool A + B
  const ranking = mergeAndRank(scoredA, scoredB);

  // Identifikasi produk hot dari kandidat yang lolos filter keras
  const hotProducts = eligible.filter((p) => p.is_hot);

  // 10. Alokasikan slot konten (7 slot)
  const result = allocateSlots(
    collabSlots,
    ranking,
    eligible,
    poolA,
    poolB,
    poolC.length,
    poolD.length,
    contentTrackingStart,
    referenceDate,
    params,
    excluded,
    hotProducts
  );

  return result;
}

/**
 * Memicu generate jadwal langsung untuk seminggu (7 hari berurutan).
 * Mendukung Estafet Rencana Masa Depan: jika startDate > today,
 * jadwal tersimpan sebelum startDate di-seed ke virtualHistory sebelum loop dimulai.
 */
export async function generateWeeklySchedule(
  userId: string,
  startDateStr?: string, // YYYY-MM-DD
  paramsOverride?: Record<string, number>
): Promise<WeeklyScheduleResult> {
  const start = startDateStr ? new Date(startDateStr) : new Date();
  const daily_schedules: ScheduleResult[] = [];

  const params = paramsOverride || (await loadParams(userId));

  // Virtual history mapping: product_id -> array of simulated content dates (YYYY-MM-DD)
  const virtualHistory = new Map<string, string[]>();

  // === Estafet Rencana Masa Depan ===
  // Jika startDate > today, pre-load jadwal tersimpan antara today s/d startDate.
  // Ini dilakukan SEKALI sebelum loop untuk efisiensi (1 query, bukan 7).
  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];
  const startStr = start.toISOString().split("T")[0];

  if (startStr > todayStr) {
    const savedHistory = await loadSavedScheduleHistory(userId, todayStr, startStr);
    // Seed virtualHistory dengan data jadwal tersimpan
    savedHistory.forEach((dates, productId) => {
      virtualHistory.set(productId, [...dates]);
    });
  }

  // Loop 7 hari
  for (let i = 0; i < 7; i++) {
    const currentDate = new Date(start.getTime() + i * 24 * 60 * 60 * 1000);
    const dateStr = currentDate.toISOString().split("T")[0];
    
    // Generate jadwal hari ke-i dengan memperhitungkan virtualHistory
    // (berisi data estafet dari jadwal tersimpan + hasil hari-hari sebelumnya dalam loop)
    const daily = await generateDailySchedule(userId, currentDate, params, virtualHistory);
    daily_schedules.push(daily);

    // Catat produk terjadwal hari ini ke dalam virtualHistory untuk iterasi hari berikutnya
    daily.slots.forEach((slot) => {
      if (slot.product_id) {
        const list = virtualHistory.get(slot.product_id) || [];
        list.push(dateStr);
        virtualHistory.set(slot.product_id, list);
      }
    });
  }

  const end = new Date(start.getTime() + 6 * 24 * 60 * 60 * 1000);

  return {
    start_date: start.toISOString().split("T")[0],
    end_date: end.toISOString().split("T")[0],
    daily_schedules,
  };
}
export { SCORING_DEFAULTS } from "./constants";
export type { ScheduleResult, ScoredProduct, ScheduleSlot, Pool, WeeklyScheduleResult } from "./types";
export { aggregateProducts } from "./aggregator";
