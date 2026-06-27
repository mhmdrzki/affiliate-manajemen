// /*
// Tujuan: Halaman Dashboard Utama server-side yang menyajikan metrik KPI performa produk, panel peringatan anomali, dan ringkasan produk winning/potential.
// Caller: Route / (root path)
// Dependensi: lib/supabase/server.ts, lib/scoring/engine.ts, lib/scoring/anomalies.ts, lib/utils/format.ts, components/layout/Topbar.tsx
// Main Functions: DashboardHome
// Side Effects: Mengambil data relasional produk & konten aktif dari Supabase.
// */

import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { recomputeProductStats } from "@/lib/scoring/engine";
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
  Upload
} from "lucide-react";
import { Product, Content, PeriodSnapshot } from "@/types";

export default async function DashboardHome() {
  const supabase = await createClient();

  // 1. Verifikasi User
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // 2. Fetch User Profile & Data (Products & Contents)
  const { data: profile } = await supabase
    .from("profiles")
    .select("scoring_mode")
    .eq("id", user.id)
    .single();

  const scoringMode = (profile?.scoring_mode as "benchmark" | "topsis") || "benchmark";

  const { data: products } = await supabase
    .from("products")
    .select("*")
    .eq("user_id", user.id);

  const { data: contents } = await supabase
    .from("contents")
    .select("*, period_snapshots(*)")
    .eq("user_id", user.id);

  // 3. Hitung Aggregasi Statistik Secara Live
  const typedProducts = (products || []) as unknown as Product[];
  const typedContents = (contents || []) as unknown as (Content & { period_snapshots?: PeriodSnapshot[] })[];
  const statsMap = recomputeProductStats(typedProducts, typedContents);

  // Hitung KPI Aggregates
  const totalProducts = typedProducts.length;
  const activeProducts = typedProducts.filter((p) => p.status === "aktif").length;
  const totalVideos = typedContents.length;
  
  let totalSold = 0;
  let totalGmv = 0;
  let sumCtor = 0;
  let ctorCount = 0;

  Object.values(statsMap).forEach((stat) => {
    totalSold += stat.totalItemsSold;
    totalGmv += stat.totalGMV;
    if (stat.avgCTOR > 0) {
      sumCtor += stat.avgCTOR;
      ctorCount++;
    }
  });

  const avgCtor = ctorCount > 0 ? sumCtor / ctorCount : 0;

  // Deteksi Anomali
  const anomalies = detectAnomalies(typedProducts, statsMap);

  // Filter Winning & Potential Products
  const winningProducts = typedProducts
    .filter((p) => p.klasifikasi === "WINNING" && p.status === "aktif")
    .sort((a, b) => b.bench_score - a.bench_score)
    .slice(0, 5);

  const potentialProducts = typedProducts
    .filter((p) => p.klasifikasi === "POTENTIAL" && p.status === "aktif")
    .sort((a, b) => b.bench_score - a.bench_score)
    .slice(0, 5);

  // Tampilkan Empty State jika tidak ada data
  const hasData = totalProducts > 0 || totalVideos > 0;

  return (
    <div className="flex-1 flex flex-col min-h-screen">
      <Topbar title="Dashboard Analytics" scoringMode={scoringMode} />

      <div className="p-6 flex-1 space-y-6">
        {!hasData ? (
          /* --- EMPTY STATE --- */
          <div className="max-w-2xl mx-auto mt-12 text-center py-12 px-6 bg-white border border-border-light rounded-2xl shadow-sm">
            <div className="w-16 h-16 bg-accent/10 border border-accent/25 rounded-2xl flex items-center justify-center text-accent mx-auto mb-4">
              <ShoppingBag className="w-8 h-8" />
            </div>
            <h3 className="font-extrabold text-base tracking-tight text-text-main">
              Belum Ada Data Terdeteksi
            </h3>
            <p className="text-xs text-text-placeholder mt-2 max-w-md mx-auto leading-relaxed">
              Platform Anda baru diinisialisasi. Silakan gunakan salah satu langkah di bawah untuk mengisi data master:
            </p>
            <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Link
                href="/migrate"
                className="flex items-center justify-between p-4 bg-bg border border-border-active hover:border-accent rounded-xl text-left group transition-all duration-150"
              >
                <div>
                  <div className="flex items-center gap-2 font-bold text-xs text-text-main">
                    <Database className="w-4 h-4 text-accent" />
                    <span>Migrasi dari v2.5</span>
                  </div>
                  <div className="text-[10px] text-text-placeholder mt-1">
                    Upload cadangan JSON dari localStorage versi lama.
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-text-placeholder group-hover:text-accent group-hover:translate-x-1 transition-all" />
              </Link>

              <Link
                href="/import"
                className="flex items-center justify-between p-4 bg-bg border border-border-active hover:border-accent rounded-xl text-left group transition-all duration-150"
              >
                <div>
                  <div className="flex items-center gap-2 font-bold text-xs text-text-main">
                    <Upload className="w-4 h-4 text-accent" />
                    <span>Impor Excel Baru</span>
                  </div>
                  <div className="text-[10px] text-text-placeholder mt-1">
                    Impor file XLSX kinerja video analitik TikTok Shop.
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
              {/* Card 1 */}
              <div className="bg-white border border-border-light rounded-xl p-5 shadow-sm hover:translate-y-[-2px] transition-all duration-200 relative overflow-hidden before:content-[''] before:absolute before:top-0 before:left-0 before:right-0 before:height-[3px] before:bg-accent">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-[10px] font-bold text-text-placeholder uppercase tracking-wider">
                    Total Produk
                  </span>
                  <ShoppingBag className="w-4 h-4 text-accent" />
                </div>
                <div className="text-xl font-extrabold text-text-main tracking-tight">
                  {totalProducts}
                </div>
                <div className="text-[10px] text-text-placeholder mt-1">
                  {activeProducts} produk status aktif
                </div>
              </div>

              {/* Card 2 */}
              <div className="bg-white border border-border-light rounded-xl p-5 shadow-sm hover:translate-y-[-2px] transition-all duration-200 relative overflow-hidden before:content-[''] before:absolute before:top-0 before:left-0 before:right-0 before:height-[3px] before:bg-success">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-[10px] font-bold text-text-placeholder uppercase tracking-wider">
                    Total Video
                  </span>
                  <Video className="w-4 h-4 text-success" />
                </div>
                <div className="text-xl font-extrabold text-text-main tracking-tight">
                  {totalVideos}
                </div>
                <div className="text-[10px] text-text-placeholder mt-1">
                  Terasosiasi di riwayat analitik
                </div>
              </div>

              {/* Card 3 */}
              <div className="bg-white border border-border-light rounded-xl p-5 shadow-sm hover:translate-y-[-2px] transition-all duration-200 relative overflow-hidden before:content-[''] before:absolute before:top-0 before:left-0 before:right-0 before:height-[3px] before:bg-warning">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-[10px] font-bold text-text-placeholder uppercase tracking-wider">
                    Total Terjual
                  </span>
                  <TrendingUp className="w-4 h-4 text-warning" />
                </div>
                <div className="text-xl font-extrabold text-text-main tracking-tight">
                  {fmt(totalSold)}
                </div>
                <div className="text-[10px] text-text-placeholder mt-1">
                  Unit terjual secara kumulatif
                </div>
              </div>

              {/* Card 4 */}
              <div className="bg-white border border-border-light rounded-xl p-5 shadow-sm hover:translate-y-[-2px] transition-all duration-200 relative overflow-hidden before:content-[''] before:absolute before:top-0 before:left-0 before:right-0 before:height-[3px] before:bg-special">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-[10px] font-bold text-text-placeholder uppercase tracking-wider">
                    Rata-rata CTOR
                  </span>
                  <DollarSign className="w-4 h-4 text-special" />
                </div>
                <div className="text-xl font-extrabold text-text-main tracking-tight">
                  {fmtPercent(avgCtor)}
                </div>
                <div className="text-[10px] text-text-placeholder mt-1">
                  Klik-ke-order berbobot EMA
                </div>
              </div>
            </div>

            {/* Anomaly Alerts Section */}
            {anomalies.length > 0 && (
              <div className="bg-white border border-border-light rounded-xl p-5 shadow-sm">
                <h3 className="text-xs font-bold text-text-main mb-3 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-warning" />
                  <span>Sinyal Peringatan Anomali & Rekomendasi ({anomalies.length})</span>
                </h3>
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {anomalies.map((an, i) => {
                    const styles = 
                      an.type === "gmvmax" ? "bg-info-bg border-info-border text-info" :
                      an.type === "trending" ? "bg-success-bg border-success-border text-success" :
                      an.type === "saturation" ? "bg-danger-bg border-danger-border text-danger" :
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
              {/* List 1: Winning Products */}
              <div className="bg-white border border-border-light rounded-xl p-5 shadow-sm">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-xs font-bold text-text-main">
                    Top Winning Products
                  </h3>
                  <Link href="/products" className="text-[10px] font-bold text-accent hover:underline">
                    Lihat Semua
                  </Link>
                </div>
                <div className="space-y-2">
                  {winningProducts.length > 0 ? (
                    winningProducts.map((p) => {
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
                              {p.jenis || "—"} · {pStats?.nVideo || 0} Video · Terjual {fmt(pStats?.totalItemsSold || 0)}
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="text-xs font-mono font-bold text-success bg-success-bg border border-success-border px-2 py-0.5 rounded-full">
                              Score: {p.bench_score}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-center py-6 text-text-placeholder text-xs">
                      Belum ada produk berstatus Winning.
                    </div>
                  )}
                </div>
              </div>

              {/* List 2: Potential Products */}
              <div className="bg-white border border-border-light rounded-xl p-5 shadow-sm">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-xs font-bold text-text-main">
                    Top Potential Products
                  </h3>
                  <Link href="/products" className="text-[10px] font-bold text-accent hover:underline">
                    Lihat Semua
                  </Link>
                </div>
                <div className="space-y-2">
                  {potentialProducts.length > 0 ? (
                    potentialProducts.map((p) => {
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
                              {p.jenis || "—"} · {pStats?.nVideo || 0} Video · Terjual {fmt(pStats?.totalItemsSold || 0)}
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="text-xs font-mono font-bold text-info bg-info-bg border border-info-border px-2 py-0.5 rounded-full">
                              Score: {p.bench_score}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-center py-6 text-text-placeholder text-xs">
                      Belum ada produk berstatus Potential.
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
