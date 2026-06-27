// /*
// Tujuan: Pemrosesan metrik analitik produk (agregasi, time-decay, dual-scoring TOPSIS/SAW, composite multipliers, dan klasifikasi).
// Caller: API routes, Server Actions, data importer
// Dependensi: types/index.ts
// Main Functions: recomputeProductStats, scoreBenchmark, scoreTOPSIS, computeCompositeScore, classifyP
// Side Effects: Mengembalikan objek data dengan kalkulasi metrik teragregasi.
// */

import { Product, Content, PeriodSnapshot } from "@/types";

const DECAY_HALF_LIFE = 28; // 4 minggu half-life
const DECAY_FLOOR = 0.05;   // Jejak minimal data lama

const W_BENCH = { nVideo: 0.50, spreadDays: 0.25, hasPrestasi: 0.15, maxViews: 0.10 };
const W_TOPSIS = {
  avgCTOR: 0.30,
  totalItemsSold: 0.35,
  avgCTR: 0.20,
  totalGMV: 0, // Dihapus, bobot 0
  nVideo: 0.10,
  conversionRate: 0.05,
};

function parseDate(ds: string | null): number {
  if (!ds) return 0;
  if (ds.includes("/")) {
    const p = ds.split("/");
    if (p.length === 3) {
      return new Date(`${p[2]}-${p[1]}-${p[0]}T00:00:00`).getTime();
    }
  }
  return new Date(ds).getTime() || 0;
}

export interface ComputedProductStats {
  nVideo: number;
  spreadDays: number;
  maxViews: number;
  avgViews: number;
  totalItemsSold: number;
  totalGMV: number;
  avgCTR: number;
  avgCTOR: number;
  uploadDates: string[];
  gmv_aktif: boolean;
  salesVideos: number;
  salesConsistency: number;
  conversionEfficiency: number;
  conversionRate: number;
  bestDays: string[];
  bestHours: string[];
  effectiveSold: number;
  recentSold: number;
  daysSinceLastSale: number;
  daysSinceLastContent: number;
  periodsWithSale: number;
  latestPeriodSold: number;
  prevPeriodSold: number;
  olderPeriodsSold: number;
}

export function recomputeProductStats(
  products: Product[],
  contents: (Content & { period_snapshots?: PeriodSnapshot[] })[]
): Record<string, ComputedProductStats> {
  const now = Date.now();
  const statsMap: Record<string, ComputedProductStats> = {};

  // Inisialisasi default stats untuk semua produk
  products.forEach((p) => {
    statsMap[p.id] = {
      nVideo: 0,
      spreadDays: 0,
      maxViews: 0,
      avgViews: 0,
      totalItemsSold: 0,
      totalGMV: 0,
      avgCTR: 0,
      avgCTOR: 0,
      uploadDates: [],
      gmv_aktif: false,
      salesVideos: 0,
      salesConsistency: 0,
      conversionEfficiency: 0,
      conversionRate: 0,
      bestDays: [],
      bestHours: [],
      effectiveSold: 0,
      recentSold: 0,
      daysSinceLastSale: 999,
      daysSinceLastContent: 999,
      periodsWithSale: 0,
      latestPeriodSold: 0,
      prevPeriodSold: 0,
      olderPeriodsSold: 0,
    };
  });

  // Kelompokkan konten berdasarkan product_id
  const byProd: Record<string, (Content & { period_snapshots?: PeriodSnapshot[] })[]> = {};
  contents.forEach((c) => {
    if (c.product_id) {
      if (!byProd[c.product_id]) byProd[c.product_id] = [];
      byProd[c.product_id].push(c);
    }
  });

  products.forEach((prod) => {
    const rows = byProd[prod.id] || [];
    if (!rows.length) return;

    // Urutkan konten dari terlama ke terbaru
    rows.sort((a, b) => {
      const da = parseDate(a.tanggal_upload) || a.created_at ? new Date(a.created_at).getTime() : 0;
      const db = parseDate(b.tanggal_upload) || b.created_at ? new Date(b.created_at).getTime() : 0;
      return da - db;
    });

    const stats = statsMap[prod.id];
    let totalWeightedViews = 0;
    let totalWeight = 0;
    let totalViewsRaw = 0;
    const dayAff: Record<string, { s: number; v: number }> = {};
    const hourAff: Record<string, { s: number; v: number }> = {};

    rows.forEach((c) => {
      const postDate = parseDate(c.tanggal_upload) || new Date(c.created_at).getTime();
      const ageContentDays = Math.max(0, (now - postDate) / 86400000);
      const decayContent = Math.max(0.2, 1 - ageContentDays / 60);

      stats.nVideo++;
      stats.maxViews = Math.max(stats.maxViews, c.views || 0);
      totalViewsRaw += c.views || 0;

      const dateOnly = c.tanggal_upload ? c.tanggal_upload.split("T")[0] : "";
      if (dateOnly && !stats.uploadDates.includes(dateOnly)) {
        stats.uploadDates.push(dateOnly);
      }

      totalWeightedViews += (c.views || 0) * decayContent;
      totalWeight += decayContent;

      stats.totalItemsSold += c.items_sold || 0;
      stats.totalGMV += c.gmv || 0;
      if ((c.gmv || 0) > 0) stats.gmv_aktif = true;

      if ((c.items_sold || 0) > 0) stats.salesVideos++;

      // Sales Decay
      const salesDecay = Math.max(DECAY_FLOOR, 1 - ageContentDays / DECAY_HALF_LIFE);
      stats.effectiveSold += (c.items_sold || 0) * salesDecay;

      // recentSold
      if (ageContentDays <= 14) {
        stats.recentSold += c.items_sold || 0;
      }

      // daysSinceLastSale
      if ((c.items_sold || 0) > 0) {
        stats.daysSinceLastSale = Math.min(stats.daysSinceLastSale, ageContentDays);
      }

      // daysSinceLastContent
      stats.daysSinceLastContent = Math.min(stats.daysSinceLastContent, ageContentDays);

      // Afinitas Hari
      const dateObj = new Date(postDate);
      const dName = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"][dateObj.getDay()];
      if (!dayAff[dName]) dayAff[dName] = { s: 0, v: 0 };
      dayAff[dName].s += c.items_sold || 0;
      dayAff[dName].v += c.views || 0;

      // Afinitas Jam
      const hours = dateObj.getHours().toString().padStart(2, "0") + ":00";
      if (!hourAff[hours]) hourAff[hours] = { s: 0, v: 0 };
      hourAff[hours].s += c.items_sold || 0;
      hourAff[hours].v += c.views || 0;

      // EMA (Exponential Moving Average)
      stats.avgCTR = stats.avgCTR ? stats.avgCTR * 0.3 + (c.ctr || 0) * 0.7 : c.ctr || 0;
      stats.avgCTOR = stats.avgCTOR ? stats.avgCTOR * 0.3 + (c.ctor || 0) * 0.7 : c.ctor || 0;
    });

    stats.spreadDays = stats.uploadDates.length;
    stats.avgViews = totalWeight > 0 ? totalWeightedViews / totalWeight : 0;
    stats.salesConsistency = stats.nVideo > 0 ? stats.salesVideos / stats.nVideo : 0;
    stats.conversionEfficiency = totalViewsRaw > 0 ? (stats.totalItemsSold / totalViewsRaw) * 10000 : 0;
    stats.conversionRate = totalViewsRaw > 0 ? (stats.totalItemsSold / totalViewsRaw) * 100 : 0;

    // Period-based metrics
    const periodSoldMap: Record<string, { sold: number; pEnd: number }> = {};
    rows.forEach((c) => {
      (c.period_snapshots || []).forEach((snap) => {
        const pStart = new Date(snap.period_start).getTime();
        const pEnd = new Date(snap.period_end).getTime();
        const key = `${pStart}-${pEnd}`;
        if (!periodSoldMap[key]) {
          periodSoldMap[key] = { sold: 0, pEnd };
        }
        periodSoldMap[key].sold += snap.items_sold || 0;
      });
    });

    const periodEntries = Object.values(periodSoldMap);
    stats.periodsWithSale = periodEntries.filter((pe) => pe.sold > 0).length;

    // Urutkan periode dari yang terbaru
    periodEntries.sort((a, b) => b.pEnd - a.pEnd);

    if (periodEntries.length >= 1) stats.latestPeriodSold = periodEntries[0].sold;
    if (periodEntries.length >= 2) stats.prevPeriodSold = periodEntries[1].sold;
    if (periodEntries.length >= 3) {
      stats.olderPeriodsSold = periodEntries.slice(2).reduce((s, pe) => s + pe.sold, 0);
    }

    // Afinitas Waktu (Hari & Jam Terbaik)
    stats.bestDays = Object.entries(dayAff)
      .sort((a, b) => b[1].s - a[1].s || b[1].v - a[1].v)
      .slice(0, 2)
      .map((e) => e[0]);

    stats.bestHours = Object.entries(hourAff)
      .sort((a, b) => b[1].s - a[1].s || b[1].v - a[1].v)
      .slice(0, 2)
      .map((e) => e[0]);
  });

  return statsMap;
}

export function scoreBenchmark(
  products: Product[],
  statsMap: Record<string, ComputedProductStats>
): void {
  if (!products.length) return;

  const maxN = Math.max(...products.map((p) => statsMap[p.id]?.nVideo || 0), 1);
  const maxSp = Math.max(...products.map((p) => statsMap[p.id]?.spreadDays || 0), 1);
  const maxV = Math.max(...products.map((p) => statsMap[p.id]?.maxViews || 0), 1);

  products.forEach((p) => {
    const stats = statsMap[p.id];
    if (!stats) return;

    const hasPrestasi = p.label_prestasi && p.label_prestasi !== "-" ? 1 : 0;
    const score =
      (stats.nVideo / maxN) * W_BENCH.nVideo * 100 +
      (stats.spreadDays / maxSp) * W_BENCH.spreadDays * 100 +
      hasPrestasi * W_BENCH.hasPrestasi * 100 +
      (stats.maxViews / maxV) * W_BENCH.maxViews * 100;

    p.bench_score = Math.round(score * 10) / 10;
    p.topsis_score = 0;
    p.score_mode = "benchmark";
  });
}

export function scoreTOPSIS(
  products: Product[],
  statsMap: Record<string, ComputedProductStats>
): void {
  if (!products.length) return;

  const keys = Object.keys(W_TOPSIS) as (keyof typeof W_TOPSIS)[];

  // Log-dampening untuk parameter berskala besar
  const raw = products.map((p) => {
    const stats = statsMap[p.id] || { avgCTOR: 0, avgCTR: 0, effectiveSold: 0, nVideo: 0, conversionRate: 0 };
    return {
      avgCTOR: stats.avgCTOR || 0,
      avgCTR: stats.avgCTR || 0,
      totalItemsSold: Math.log1p(stats.effectiveSold || 0),
      totalGMV: 0, // bobot 0
      nVideo: Math.log1p(stats.nVideo || 0),
      conversionRate: stats.conversionRate || 0,
    };
  });

  const colNorm: Record<string, number> = {};
  keys.forEach((k) => {
    const sumSq = raw.reduce((s, r) => s + (r[k as keyof typeof r] || 0) ** 2, 0);
    colNorm[k] = Math.sqrt(sumSq) || 1;
  });

  const wn = raw.map((r) => {
    const row: Record<string, number> = {};
    keys.forEach((k) => {
      row[k] = ((r[k as keyof typeof r] || 0) / colNorm[k]) * W_TOPSIS[k];
    });
    return row;
  });

  const Ap: Record<string, number> = {};
  const Am: Record<string, number> = {};
  keys.forEach((k) => {
    Ap[k] = Math.max(...wn.map((r) => r[k]));
    Am[k] = Math.min(...wn.map((r) => r[k]));
  });

  const dP = wn.map((r) =>
    Math.sqrt(keys.reduce((s, k) => s + (r[k] - Ap[k]) ** 2, 0))
  );
  const dM = wn.map((r) =>
    Math.sqrt(keys.reduce((s, k) => s + (r[k] - Am[k]) ** 2, 0))
  );

  products.forEach((p, i) => {
    const t = dP[i] + dM[i];
    p.topsis_score = t > 0 ? Math.round((dM[i] / t) * 1000) / 1000 : 0;
    p.bench_score = Math.round(p.topsis_score * 100);
    p.score_mode = "topsis";
  });
}

export function calcEfficiencyMult(effectiveSold: number, nVideo: number): number {
  if (nVideo <= 3) return 1.0; // Fase uji coba
  const yield_ = effectiveSold / nVideo;
  if (yield_ >= 0.8) return 1.15;
  if (yield_ >= 0.4) return 1.0;
  if (yield_ >= 0.15) return 0.85;
  if (yield_ > 0) return 0.7;
  return 0.5; // Saturasi
}

export function calcMomentumMult(
  latestPeriodSold: number,
  prevPeriodSold: number,
  olderPeriodsSold: number,
  hasEverSold: boolean
): number {
  if (latestPeriodSold > 0 && prevPeriodSold > 0) {
    const ratio = latestPeriodSold / prevPeriodSold;
    return Math.max(0.6, Math.min(1.3, ratio));
  }
  if (latestPeriodSold > 0 && prevPeriodSold === 0) return 1.2;
  if (latestPeriodSold === 0 && prevPeriodSold > 0) return 0.6;
  if (olderPeriodsSold > 0) return 0.5;
  if (!hasEverSold) return 0.85;
  return 0.5;
}

export function calcFreshnessMult(
  daysSinceLastSale: number,
  daysSinceLastContent: number,
  hasEverSold: boolean
): number {
  let saleFresh = 0.2;
  if (!hasEverSold) saleFresh = 0.7;
  else if (daysSinceLastSale <= 7) saleFresh = 1.0;
  else if (daysSinceLastSale <= 14) saleFresh = 0.85;
  else if (daysSinceLastSale <= 21) saleFresh = 0.65;
  else if (daysSinceLastSale <= 35) saleFresh = 0.4;

  let contentFresh = 0.7;
  if (daysSinceLastContent <= 7) contentFresh = 1.0;
  else if (daysSinceLastContent <= 14) contentFresh = 0.9;
  else if (daysSinceLastContent <= 21) contentFresh = 0.8;

  if (!hasEverSold) return contentFresh;
  return saleFresh * 0.7 + contentFresh * 0.3;
}

export function computeCompositeScore(
  p: Product,
  stats: ComputedProductStats
): number {
  const base = p.topsis_score * 100;
  const eff = calcEfficiencyMult(stats.effectiveSold, stats.nVideo);
  const mom = calcMomentumMult(
    stats.latestPeriodSold,
    stats.prevPeriodSold,
    stats.olderPeriodsSold,
    stats.totalItemsSold > 0
  );
  const fresh = calcFreshnessMult(
    stats.daysSinceLastSale,
    stats.daysSinceLastContent,
    stats.totalItemsSold > 0
  );

  const finalScore = Math.min(100, Math.round(base * eff * mom * fresh));
  p.bench_score = finalScore; // Update bench_score untuk UI sorting
  return finalScore;
}

export function classifyP(
  p: Product,
  stats: ComputedProductStats,
  mode: "benchmark" | "topsis"
): "WINNING" | "POTENTIAL" | "MONITOR" | "DROP" {
  if (stats.nVideo === 0) return "MONITOR"; // Fallback safe, setara UJI COBA

  if (mode === "topsis") {
    const cs = p.bench_score || 0; // compositeScore disimpan di bench_score
    const es = stats.effectiveSold || 0;
    const rs = stats.recentSold || 0;
    const rawSold = stats.totalItemsSold || 0;
    const dsls = stats.daysSinceLastSale;
    const n = stats.nVideo || 0;
    const mv = stats.maxViews || 0;
    const ctr = stats.avgCTR || 0;
    const ctor = stats.avgCTOR || 0;
    const pws = stats.periodsWithSale || 0;

    // OVERRIDES
    if (n >= 5 && rawSold === 0 && mv < 3000) return "DROP";
    if (rawSold > 0 && dsls > 35 && rs === 0) return "MONITOR";
    if (n >= 3 && mv < 2000 && ctr === 0 && ctor === 0 && rawSold === 0) return "DROP";

    // WINNING
    if (cs >= 50 && es >= 2) return "WINNING";
    if (cs >= 35 && es >= 3) return "WINNING";
    if (pws >= 3 && rs >= 1) return "WINNING";
    if (es >= 4 && dsls <= 14) return "WINNING";

    // POTENTIAL
    if (cs >= 25 && es >= 1) return "POTENTIAL";
    if (cs >= 35) return "POTENTIAL";
    if (pws >= 2) return "POTENTIAL";
    if (es >= 0.8 && n >= 2) return "POTENTIAL";
    if (ctr >= 2.0 && n >= 2 && mv >= 1000) return "POTENTIAL";

    return "MONITOR";
  }

  // Benchmark classification
  const n = stats.nVideo || 0;
  const rawSold = stats.totalItemsSold || 0;
  const mv = stats.maxViews || 0;
  const ctr = stats.avgCTR || 0;

  if (n >= 5 || (n >= 3 && rawSold > 0)) return "WINNING";
  if (n >= 3 && mv < 2000 && ctr === 0 && rawSold === 0) return "DROP";
  if (n >= 3 || (n >= 2 && ctr > 0)) return "POTENTIAL";
  return "MONITOR";
}

export function slotR(k: string): string {
  return k === "WINNING"
    ? "16:00/18:00"
    : k === "POTENTIAL"
    ? "10:00/14:00"
    : k === "DROP"
    ? "—"
    : "08:00/12:00";
}
