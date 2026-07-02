// /*
// Tujuan: Halaman Dashboard Utama server-side yang menyajikan metrik KPI performa produk berdasarkan rekap order TikTok, panel peringatan anomali, dan ringkasan produk.
// Caller: Route / (root path)
// Dependensi: lib/db/index.ts, lib/supabase/server.ts, lib/scoring/engine.ts, lib/scoring/anomalies.ts, lib/utils/format.ts, components/layout/Topbar.tsx
// Main Functions: DashboardHome
// Side Effects: Mengambil data relasional produk & order aktif dari SQLite lokal.
// */

import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { profiles, products as productsTable, orders as ordersTable } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { computeOrderBasedStats } from "@/lib/scoring/engine";
import { detectAnomalies } from "@/lib/scoring/anomalies";
import { fmt, fmtIDR, fmtPercent } from "@/lib/utils/format";
import Topbar from "@/components/layout/Topbar";
import { 
  ShoppingBag, 
  Video, 
  TrendingUp, 
  DollarSign, 
  AlertTriangle, 
  ArrowRight,
  Database,
  Upload,
  Layers,
  Percent,
  RefreshCw
} from "lucide-react";
import { Product, Order } from "@/types";

export default async function DashboardHome() {
  const supabase = await createClient();

  // 1. Verifikasi User
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // 2. Fetch User Profile & Data (Products & Orders)
  let profile = await db
    .select({ scoring_mode: profiles.scoring_mode })
    .from(profiles)
    .where(eq(profiles.id, user.id))
    .then(rows => rows[0]);

  if (!profile) {
    const defaultDisplayName = user.user_metadata?.display_name || user.email || 'Local User';
    await db.insert(profiles).values({
      id: user.id,
      email: user.email || 'local@domain.com',
      display_name: defaultDisplayName,
      scoring_mode: 'topsis',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    profile = { scoring_mode: 'topsis' };
  }

  const scoringMode = (profile?.scoring_mode as "benchmark" | "topsis") || "topsis"; // default to topsis

  const productsList = await db
    .select()
    .from(productsTable)
    .where(eq(productsTable.user_id, user.id));

  const ordersList = await db
    .select()
    .from(ordersTable)
    .where(eq(ordersTable.user_id, user.id));

  const typedProducts = (productsList || []) as unknown as Product[];
  const typedOrders = (ordersList || []) as unknown as Order[];

  // 3. Hitung Aggregasi Statistik Secara Live
  const statsMap: Record<string, any> = {};
  typedProducts.forEach(p => {
    const productOrders = typedOrders.filter(o => o.product_id === p.id);
    statsMap[p.id] = computeOrderBasedStats(productOrders);
  });

  // Hitung KPI Aggregates
  const totalProducts = typedProducts.length;
  const activeProducts = typedProducts.filter((p) => p.status === "aktif").length;
  const totalOrdersCount = typedOrders.length;
  
  let totalRevenue = 0;
  let totalNetSold = 0;
  let sumRegularity = 0;
  let activeWithRegularityCount = 0;

  typedProducts.forEach((p) => {
    const stats = statsMap[p.id];
    if (stats) {
      totalRevenue += stats.totalRevenue;
      totalNetSold += stats.netItemsSold;
      if (p.status === "aktif" && stats.totalOrders >= 2) {
        sumRegularity += stats.regularityScore;
        activeWithRegularityCount++;
      }
    }
  });

  const avgRegularity = activeWithRegularityCount > 0 ? sumRegularity / activeWithRegularityCount : 0;

  // Deteksi Anomali
  const anomalies = detectAnomalies(typedProducts, statsMap);

  // Filter lists berdasarkan klasifikasi baru: High Performers, Growing/Recovery, Monitoring, Action Needed
  const highProducts = typedProducts
    .filter((p) => ["COLLABORATION", "RESTOCK_CONFIRMED", "PROVEN_WINNER", "GMV_ACTIVE"].includes(p.klasifikasi) && p.status === "aktif")
    .sort((a, b) => b.bench_score - a.bench_score);

  const growingProducts = typedProducts
    .filter((p) => ["GROWING", "EARLY_STAGE", "RESTOCK_RECOVERY"].includes(p.klasifikasi) && p.status === "aktif")
    .sort((a, b) => b.bench_score - a.bench_score);

  const monitorProducts = typedProducts
    .filter((p) => ["MONITOR", "SPIKE_ONLY"].includes(p.klasifikasi) && p.status === "aktif")
    .sort((a, b) => b.bench_score - a.bench_score);

  const actionProducts = typedProducts
    .filter((p) => ["STAGNANT", "DECLINING"].includes(p.klasifikasi) && p.status === "aktif")
    .sort((a, b) => b.bench_score - a.bench_score);

  const hasData = totalProducts > 0 || totalOrdersCount > 0;

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-bg">
      <Topbar title="Dashboard Analytics" scoringMode={scoringMode} />

      <div className="p-6 flex-1 space-y-6">
        {!hasData ? (
          /* --- EMPTY STATE --- */
          <div className="max-w-2xl mx-auto mt-12 text-center py-12 px-6 bg-white border border-border-light rounded-2xl shadow-sm">
            <div className="w-16 h-16 bg-accent/10 border border-accent/25 rounded-2xl flex items-center justify-center text-accent mx-auto mb-4">
              <ShoppingBag className="w-8 h-8" />
            </div>
            <h3 className="font-extrabold text-base tracking-tight text-text-main">
              Belum Ada Data Orders Terdeteksi
            </h3>
            <p className="text-xs text-text-placeholder mt-2 max-w-md mx-auto leading-relaxed">
              Platform Anda baru diinisialisasi atau data lama dibersihkan. Silakan gunakan menu di bawah untuk mengimpor rekap pesanan TikTok terbaru:
            </p>
            <div className="mt-8 max-w-xs mx-auto">
              <Link
                href="/import"
                className="flex items-center justify-between p-4 bg-white border border-border-active hover:border-accent rounded-xl text-left group transition-all duration-150 shadow-sm"
              >
                <div>
                  <div className="flex items-center gap-2 font-bold text-xs text-text-main">
                    <Upload className="w-4 h-4 text-accent" />
                    <span>Impor Pesanan TikTok</span>
                  </div>
                  <div className="text-[10px] text-text-placeholder mt-1">
                    Impor file XLSX kinerja pesanan TikTok Shop.
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-text-placeholder group-hover:text-accent group-hover:translate-x-1 transition-all" />
              </Link>
            </div>
          </div>
        ) : (
          /* --- DASHBOARD CONTENT --- */
          <>
            {/* KPI Cards Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Card 1: Total Revenue */}
              <div className="bg-white border border-border-light rounded-xl p-5 shadow-sm hover:translate-y-[-2px] transition-all duration-200 relative overflow-hidden before:content-[''] before:absolute before:top-0 before:left-0 before:right-0 before:h-[3px] before:bg-accent">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-[10px] font-bold text-text-placeholder uppercase tracking-wider">
                    Total Pendapatan
                  </span>
                  <DollarSign className="w-4 h-4 text-accent" />
                </div>
                <div className="text-xl font-extrabold text-text-main tracking-tight">
                  {fmtIDR(totalRevenue)}
                </div>
                <div className="text-[10px] text-text-placeholder mt-1">
                  Estimasi komisi dari pesanan valid
                </div>
              </div>

              {/* Card 2: Total Orders */}
              <div className="bg-white border border-border-light rounded-xl p-5 shadow-sm hover:translate-y-[-2px] transition-all duration-200 relative overflow-hidden before:content-[''] before:absolute before:top-0 before:left-0 before:right-0 before:h-[3px] before:bg-success">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-[10px] font-bold text-text-placeholder uppercase tracking-wider">
                    Total Pesanan
                  </span>
                  <ShoppingBag className="w-4 h-4 text-success" />
                </div>
                <div className="text-xl font-extrabold text-text-main tracking-tight">
                  {fmt(totalOrdersCount)}
                </div>
                <div className="text-[10px] text-text-placeholder mt-1">
                  Pesanan masuk (Ineligible dilewati)
                </div>
              </div>

              {/* Card 3: Net Terjual */}
              <div className="bg-white border border-border-light rounded-xl p-5 shadow-sm hover:translate-y-[-2px] transition-all duration-200 relative overflow-hidden before:content-[''] before:absolute before:top-0 before:left-0 before:right-0 before:h-[3px] before:bg-warning">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-[10px] font-bold text-text-placeholder uppercase tracking-wider">
                    Net Terjual
                  </span>
                  <TrendingUp className="w-4 h-4 text-warning" />
                </div>
                <div className="text-xl font-extrabold text-text-main tracking-tight">
                  {fmt(totalNetSold)}
                </div>
                <div className="text-[10px] text-text-placeholder mt-1">
                  Unit terjual bersih setelah refund
                </div>
              </div>

              {/* Card 4: Rerata Regularity */}
              <div className="bg-white border border-border-light rounded-xl p-5 shadow-sm hover:translate-y-[-2px] transition-all duration-200 relative overflow-hidden before:content-[''] before:absolute before:top-0 before:left-0 before:right-0 before:h-[3px] before:bg-special">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-[10px] font-bold text-text-placeholder uppercase tracking-wider">
                    Rerata Regularity
                  </span>
                  <Layers className="w-4 h-4 text-special" />
                </div>
                <div className="text-xl font-extrabold text-text-main tracking-tight">
                  {avgRegularity.toFixed(1)} / 100
                </div>
                <div className="text-[10px] text-text-placeholder mt-1">
                  Konsistensi penjualan produk aktif
                </div>
              </div>
            </div>

            {/* Anomaly Alerts Section */}
            {anomalies.length > 0 && (
              <div className="bg-white border border-border-light rounded-xl p-5 shadow-sm">
                <h3 className="text-xs font-bold text-text-main mb-3 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-warning" />
                  <span>Sinyal Anomali & Rekomendasi TikTok Shop ({anomalies.length})</span>
                </h3>
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {anomalies.map((an, i) => {
                    const styles = 
                      an.type === "shop_ads_champion" ? "bg-success-bg border-success-border text-success" :
                      an.type === "momentum_rocket" ? "bg-info-bg border-info-border text-info" :
                      an.type === "dying_product" ? "bg-danger-bg border-danger-border text-danger" :
                      "bg-warning-bg border-warning-border text-warning";
                    return (
                      <div
                        key={i}
                        className={`text-xs p-3 rounded-lg border leading-relaxed ${styles}`}
                        dangerouslySetInnerHTML={{ __html: an.msg }}
                      />
                    );
                  })}
                </div>
              </div>
            )}

            {/* Products Lists Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* HIGH PERFORMERS */}
              <div className="bg-white border border-border-light rounded-xl p-5 shadow-sm">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-xs font-bold text-text-main flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 bg-success rounded-full"></span>
                    <span>⭐ HIGH PERFORMERS — Prioritas Utama ({highProducts.length})</span>
                  </h3>
                  <Link href="/products" className="text-[10px] font-bold text-accent hover:underline">
                    Lihat Semua
                  </Link>
                </div>
                <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1">
                  {highProducts.length > 0 ? (
                    highProducts.map((p) => {
                      const pStats = statsMap[p.id];
                      return (
                        <div
                          key={p.id}
                          className="flex items-center justify-between p-3 bg-bg border border-border-light rounded-lg hover:border-border-active transition-all"
                        >
                          <div className="min-w-0 flex-1 pr-3">
                            <div className="text-xs font-bold text-text-main truncate">
                              {p.nama}
                            </div>
                            <div className="text-[10px] text-text-placeholder mt-0.5 truncate">
                              Toko: {p.shop_name || "—"} · GMV Max: {Math.round(p.shop_ads_ratio * 100)}% · Kuota: {p.kuota_mingguan}x/mg · Orders 7d: {pStats?.ordersLast7d || 0}
                            </div>
                          </div>
                          <div className="text-right flex flex-col items-end gap-1">
                            <span className="text-[9px] font-mono font-bold text-success bg-success-bg border border-success-border px-2 py-0.5 rounded-full uppercase">
                              {p.klasifikasi.replace('_', ' ')}
                            </span>
                            <span className="text-[10px] font-bold text-text-main">
                              Score: {p.bench_score}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-center py-6 text-text-placeholder text-xs">
                      Belum ada produk berstatus High Performers.
                    </div>
                  )}
                </div>
              </div>

              {/* GROWING & RECOVERY */}
              <div className="bg-white border border-border-light rounded-xl p-5 shadow-sm">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-xs font-bold text-text-main flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 bg-info rounded-full"></span>
                    <span>📈 GROWING & RECOVERY — Dorong Konten ({growingProducts.length})</span>
                  </h3>
                  <Link href="/products" className="text-[10px] font-bold text-accent hover:underline">
                    Lihat Semua
                  </Link>
                </div>
                <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1">
                  {growingProducts.length > 0 ? (
                    growingProducts.map((p) => {
                      const pStats = statsMap[p.id];
                      return (
                        <div
                          key={p.id}
                          className="flex items-center justify-between p-3 bg-bg border border-border-light rounded-lg hover:border-border-active transition-all"
                        >
                          <div className="min-w-0 flex-1 pr-3">
                            <div className="text-xs font-bold text-text-main truncate">
                              {p.nama}
                            </div>
                            <div className="text-[10px] text-text-placeholder mt-0.5 truncate">
                              Toko: {p.shop_name || "—"} · Regularity: {p.regularity_score.toFixed(0)}% · Kuota: {p.kuota_mingguan}x/mg · Orders 7d: {pStats?.ordersLast7d || 0}
                            </div>
                          </div>
                          <div className="text-right flex flex-col items-end gap-1">
                            <span className="text-[9px] font-mono font-bold text-info bg-info-bg border border-info-border px-2 py-0.5 rounded-full uppercase">
                              {p.klasifikasi.replace('_', ' ')}
                            </span>
                            <span className="text-[10px] font-bold text-text-main">
                              Score: {p.bench_score}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-center py-6 text-text-placeholder text-xs">
                      Belum ada produk berstatus Growing & Recovery.
                    </div>
                  )}
                </div>
              </div>

              {/* MONITORING */}
              <div className="bg-white border border-border-light rounded-xl p-5 shadow-sm">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-xs font-bold text-text-main flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 bg-warning rounded-full"></span>
                    <span>👁️ MONITORING — Performa Sedang ({monitorProducts.length})</span>
                  </h3>
                  <Link href="/products" className="text-[10px] font-bold text-accent hover:underline">
                    Lihat Semua
                  </Link>
                </div>
                <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1">
                  {monitorProducts.length > 0 ? (
                    monitorProducts.map((p) => {
                      const pStats = statsMap[p.id];
                      return (
                        <div
                          key={p.id}
                          className="flex items-center justify-between p-3 bg-bg border border-border-light rounded-lg hover:border-border-active transition-all"
                        >
                          <div className="min-w-0 flex-1 pr-3">
                            <div className="text-xs font-bold text-text-main truncate">
                              {p.nama}
                            </div>
                            <div className="text-[10px] text-text-placeholder mt-0.5 truncate">
                              Toko: {p.shop_name || "—"} · GMV Max: {Math.round(p.shop_ads_ratio * 100)}% · Kuota: {p.kuota_mingguan}x/mg
                            </div>
                          </div>
                          <div className="text-right flex flex-col items-end gap-1">
                            <span className="text-[9px] font-mono font-bold text-warning bg-warning-bg border border-warning-border px-2 py-0.5 rounded-full uppercase">
                              {p.klasifikasi.replace('_', ' ')}
                            </span>
                            <span className="text-[10px] font-bold text-text-main">
                              Score: {p.bench_score}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-center py-6 text-text-placeholder text-xs">
                      Belum ada produk berstatus Monitoring.
                    </div>
                  )}
                </div>
              </div>

              {/* ACTION NEEDED */}
              <div className="bg-white border border-border-light rounded-xl p-5 shadow-sm">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-xs font-bold text-text-main flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 bg-danger rounded-full"></span>
                    <span>⚠️ ACTION NEEDED — Kurangi / Batasi ({actionProducts.length})</span>
                  </h3>
                  <Link href="/products" className="text-[10px] font-bold text-accent hover:underline">
                    Lihat Semua
                  </Link>
                </div>
                <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1">
                  {actionProducts.length > 0 ? (
                    actionProducts.map((p) => {
                      const pStats = statsMap[p.id];
                      return (
                        <div
                          key={p.id}
                          className="flex items-center justify-between p-3 bg-bg border border-border-light rounded-lg hover:border-border-active transition-all"
                        >
                          <div className="min-w-0 flex-1 pr-3">
                            <div className="text-xs font-bold text-text-main truncate">
                              {p.nama}
                            </div>
                            <div className="text-[10px] text-text-placeholder mt-0.5 truncate">
                              Toko: {p.shop_name || "—"} · Tanpa Order: {pStats?.daysSinceLastOrder !== 999 ? Math.round(pStats?.daysSinceLastOrder) + ' hari' : 'selamanya'} · Kuota: {p.kuota_mingguan}x/mg
                            </div>
                          </div>
                          <div className="text-right flex flex-col items-end gap-1">
                            <span className="text-[9px] font-mono font-bold text-danger bg-danger-bg border border-danger-border px-2 py-0.5 rounded-full uppercase">
                              {p.klasifikasi.replace('_', ' ')}
                            </span>
                            <span className="text-[10px] font-bold text-text-main">
                              Score: {p.bench_score}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-center py-6 text-text-placeholder text-xs">
                      Tidak ada produk berstatus Action Needed.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
