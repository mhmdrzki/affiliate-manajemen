// /*
// Tujuan: Menganalisa pola anomali performa produk berdasarkan kombinasi data master dan statistik terhitung.
// Caller: Dashboard render, KPI alerts
// Dependensi: types/index.ts, lib/scoring/engine.ts
// Main Functions: detectAnomalies
// Side Effects: None (Pure analysis function)
// */

import { Product } from "@/types";
import { ComputedProductStats } from "./engine";

export interface Anomaly {
  type: string;
  msg: string;
}

export function detectAnomalies(
  products: Product[],
  statsMap: Record<string, ComputedProductStats>
): Anomaly[] {
  const al: Anomaly[] = [];

  products.forEach((p) => {
    const stats = statsMap[p.id];
    if (!stats) return;

    const shortName = p.jenis || p.nama.substring(0, 22);

    // 1. GMV Max signal: view meledak tapi CTR/CTOR rendah & baru 1x upload
    if (stats.maxViews > 10000 && stats.avgCTOR < 0.3 && stats.nVideo === 1) {
      al.push({
        type: "gmvmax",
        msg: `<strong>${shortName}</strong> — views ${stats.maxViews.toLocaleString("id")} tapi CTOR rendah & baru 1× upload. Kemungkinan mendapatkan traffic iklan GMV Max. Disarankan cek apakah seller beriklan.`,
      });
    }

    // 2. Hidden winner: CTOR tinggi tapi jarang di-upload
    if (stats.avgCTOR >= 1.0 && stats.nVideo <= 2) {
      al.push({
        type: "hidden",
        msg: `<strong>${shortName}</strong> — CTOR ${stats.avgCTOR.toFixed(1)}% tapi baru ${stats.nVideo}× upload. Kandidat Winning tersembunyi — push posting konten lebih sering!`,
      });
    }

    // 3. Momentum Drop (Topsis Mode)
    // momentumMult dihitung di composite score. Karena di Next.js kita simpan computed multipliers secara live,
    // mari kita hitung momentumMult secara internal atau ambil dari DB (dalam schema kita, p.computed_scores bisa menyimpan ini,
    // atau kita re-calculate di sini menggunakan helper engine.ts)
    // Mari kita re-calculate momentum untuk anomali:
    const hasEverSold = stats.totalItemsSold > 0;
    const latestPeriodSold = stats.latestPeriodSold || 0;
    const prevPeriodSold = stats.prevPeriodSold || 0;
    
    if (p.score_mode === "topsis" && latestPeriodSold === 0 && prevPeriodSold > 0) {
      al.push({
        type: "momentumdrop",
        msg: `<strong>${shortName}</strong> — Penurunan momentum penjualan tajam terdeteksi (0 sales periode ini vs ${prevPeriodSold} sebelumnya). Kurangi kuota jadwal posting.`,
      });
    }

    // 4. Content Saturation (Saturasi)
    if (p.score_mode === "topsis" && stats.nVideo >= 4 && stats.totalItemsSold === 0) {
      al.push({
        type: "saturation",
        msg: `<strong>${shortName}</strong> — Saturasi konten terdeteksi (${stats.nVideo} video, 0 sales efektif). Disarankan ganti status produk ke DROP.`,
      });
    }

    // 5. Trending New Product
    if (p.score_mode === "topsis" && stats.effectiveSold >= 1.5 && stats.nVideo <= 2) {
      al.push({
        type: "trending",
        msg: `<strong>${shortName}</strong> — Produk baru trending dengan sales efektif ${stats.effectiveSold.toFixed(1)} dari hanya ${stats.nVideo} video. Disarankan tambah kuota jadwal posting!`,
      });
    }
  });

  // 6. Cluster GMV aktif
  const gmvPs = products.filter((p) => p.gmv_aktif);
  if (gmvPs.length >= 3) {
    al.push({
      type: "seller",
      msg: `<strong>${gmvPs.length} produk</strong> dari seller dengan GMV Max aktif terdeteksi. Prioritaskan penjadwalan produk ini untuk minggu depan.`,
    });
  }

  // 7. Winning product tanpa isi konten
  const noContent = products.filter(
    (p) => p.klasifikasi === "WINNING" && (!p.desc_variants || p.desc_variants.length === 0)
  );
  if (noContent.length > 0) {
    al.push({
      type: "content",
      msg: `<strong>${noContent.length} produk Winning</strong> belum memiliki deskripsi naskah konten AI. Silakan buka detail produk dan lakukan Generate Deskripsi AI.`,
    });
  }

  return al;
}
