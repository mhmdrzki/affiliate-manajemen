// /*
// Tujuan: Menganalisa pola anomali performa produk berdasarkan kombinasi data master dan statistik order TikTok.
// Caller: Dashboard render, KPI alerts
// Dependensi: types/index.ts, lib/scoring/engine.ts
// Main Functions: detectAnomalies
// Side Effects: None (Pure analysis function)
// */

import { Product } from "@/types";
import { OrderBasedProductStats } from "./engine";

export interface Anomaly {
  type: string;
  msg: string;
}

export function detectAnomalies(
  products: Product[],
  statsMap: Record<string, OrderBasedProductStats>
): Anomaly[] {
  const anomalies: Anomaly[] = [];

  products.forEach((p) => {
    const stats = statsMap[p.id];
    if (!stats) return;

    const shortName = p.jenis || p.nama.substring(0, 22);

    // 1. REFUND_ALERT: refundRate > 10% dan minimal ada 3 order
    if (stats.refundRate > 0.10 && stats.totalOrders >= 3) {
      anomalies.push({
        type: "refund_alert",
        msg: `<strong>${shortName}</strong> — Tingkat refund sangat tinggi (${(stats.refundRate * 100).toFixed(0)}%). Segera review kualitas produk dengan seller/toko <strong>${p.shop_name || "seller"}</strong>.`,
      });
    }

    // 2. SHOP_ADS_CHAMPION: shopAdsRatio > 80% dan total orders >= 5
    if (stats.shopAdsRatio > 0.80 && stats.totalOrders >= 5) {
      anomalies.push({
        type: "shop_ads_champion",
        msg: `<strong>${shortName}</strong> — ${Math.round(stats.shopAdsRatio * 100)}% penjualan berasal dari Shop Ads (GMV Max). Seller sangat aktif beriklan, PUSH pembuatan konten agar mendapat limpahan traffic iklan!`,
      });
    }

    // 3. MOMENTUM_ROCKET: penjualan naik drastis minggu ini dibanding minggu lalu
    if (stats.soldDay8to14 > 0 && stats.soldLast7d >= stats.soldDay8to14 * 2) {
      const multiplier = (stats.soldLast7d / stats.soldDay8to14).toFixed(1);
      anomalies.push({
        type: "momentum_rocket",
        msg: `<strong>${shortName}</strong> — Kenaikan momentum penjualan ${multiplier}× terdeteksi minggu ini (${stats.soldLast7d} unit vs ${stats.soldDay8to14} unit). Tingkatkan prioritas slot jadwal.`,
      });
    }

    // 4. DYING_PRODUCT: tidak ada order dalam 14 hari terakhir padahal sebelumnya produktif
    if (stats.daysSinceLastOrder > 14 && stats.totalOrders >= 3 && p.klasifikasi !== 'STAGNANT') {
      anomalies.push({
        type: "dying_product",
        msg: `<strong>${shortName}</strong> — Sudah ${Math.round(stats.daysSinceLastOrder)} hari tanpa penjualan baru. Kurangi kuota jadwal posting dan alihkan fokus ke produk potensial lain.`,
      });
    }

    // 5. NEW_TRACTION: produk berstatus NEW/Early/Recovery tapi sudah menghasilkan penjualan
    if ((p.klasifikasi === 'EARLY_STAGE' || p.klasifikasi === 'RESTOCK_RECOVERY') && stats.totalOrders >= 1) {
      anomalies.push({
        type: "new_traction",
        msg: `<strong>${shortName}</strong> — Produk baru berhasil mencetak order pertama! Berikan slot testing tambahan untuk mengukur konsistensi penjualan.`,
      });
    }

    // 6. LOW_COMMISSION: Penjualan lumayan tapi tingkat komisi di bawah 5%
    if (stats.avgCommissionRate < 5 && stats.netItemsSold >= 5) {
      anomalies.push({
        type: "low_commission",
        msg: `<strong>${shortName}</strong> — Penjualan bagus (${stats.netItemsSold} unit) namun rata-rata komisi rendah (${stats.avgCommissionRate.toFixed(1)}%). Cari alternatif produk sejenis dengan komisi lebih tinggi.`,
      });
    }

    // 7. BURST_WARNING: Pola penjualan burst (ramai lalu mati mendadak)
    if (stats.salesPattern === 'BURST' && p.klasifikasi !== 'STAGNANT' && stats.soldLast7d === 0) {
      anomalies.push({
        type: "burst_warning",
        msg: `<strong>${shortName}</strong> — Pola penjualan bertipe BURST (penjualan melonjak satu hari lalu mati). Kurangi prioritas penjadwalan sebelum trend benar-benar hilang.`,
      });
    }
  });

  return anomalies;
}
