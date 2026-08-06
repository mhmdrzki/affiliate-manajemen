// /*
// Tujuan: Panel ranking produk interaktif berdasarkan total items sold dalam rentang waktu custom. Desain premium dengan medal badges, stat cards, dan tabel ranking.
// Caller: components/import/ImportPageClient.tsx
// Dependensi: app/actions/product-ranking.ts, lib/utils/format.ts, lucide-react
// Main Functions: ProductRankingPanel
// Side Effects: Memanggil getProductRankingAction untuk fetch data ranking.
// */

"use client";

import React, { useState, useCallback } from "react";
import {
  Trophy,
  Calendar,
  Search as SearchIcon,
  Package,
  ShoppingCart,
  TrendingUp,
  DollarSign,
  Medal,
  Loader2,
  BarChart3,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { getProductRankingAction, RankedProduct } from "@/app/actions/product-ranking";
import { fmt, fmtIDR } from "@/lib/utils/format";

export default function ProductRankingPanel() {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [ranked, setRanked] = useState<RankedProduct[] | null>(null);
  const [summary, setSummary] = useState<{
    total_products: number;
    total_orders: number;
    total_items_sold: number;
    total_gmv: number;
    total_commission: number;
  } | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [isCollapsed, setIsCollapsed] = useState(false);

  const handleFetchRanking = useCallback(async () => {
    if (!startDate || !endDate) {
      setErrorMsg("Pilih tanggal mulai dan akhir terlebih dahulu.");
      return;
    }
    if (startDate > endDate) {
      setErrorMsg("Tanggal mulai tidak boleh setelah tanggal akhir.");
      return;
    }

    setErrorMsg("");
    setLoading(true);
    try {
      const res = await getProductRankingAction({ startDate, endDate });
      if (res.success && res.data) {
        setRanked(res.data);
        setSummary(res.summary || null);
      } else {
        setErrorMsg(res.message);
        setRanked(null);
        setSummary(null);
      }
    } catch {
      setErrorMsg("Terjadi kesalahan saat mengambil data ranking.");
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  // Quick period presets
  const setToday = () => {
    const today = new Date().toISOString().split("T")[0];
    setStartDate(today);
    setEndDate(today);
  };

  const setThisWeek = () => {
    const now = new Date();
    const day = now.getDay();
    const monday = new Date(now);
    monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    setStartDate(monday.toISOString().split("T")[0]);
    setEndDate(sunday.toISOString().split("T")[0]);
  };

  const setThisMonth = () => {
    const now = new Date();
    const first = new Date(now.getFullYear(), now.getMonth(), 1);
    const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    setStartDate(first.toISOString().split("T")[0]);
    setEndDate(last.toISOString().split("T")[0]);
  };

  const setLast7Days = () => {
    const now = new Date();
    const past = new Date(now);
    past.setDate(now.getDate() - 6);
    setStartDate(past.toISOString().split("T")[0]);
    setEndDate(now.toISOString().split("T")[0]);
  };

  const setLast30Days = () => {
    const now = new Date();
    const past = new Date(now);
    past.setDate(now.getDate() - 29);
    setStartDate(past.toISOString().split("T")[0]);
    setEndDate(now.toISOString().split("T")[0]);
  };

  // Medal badge for top 3
  const renderRankBadge = (rank: number) => {
    if (rank === 1) {
      return (
        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-amber-300 to-amber-500 flex items-center justify-center shadow-md shadow-amber-200/50">
          <span className="text-[11px] font-black text-white">1</span>
        </div>
      );
    }
    if (rank === 2) {
      return (
        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-slate-300 to-slate-400 flex items-center justify-center shadow-md shadow-slate-200/50">
          <span className="text-[11px] font-black text-white">2</span>
        </div>
      );
    }
    if (rank === 3) {
      return (
        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-orange-300 to-orange-500 flex items-center justify-center shadow-md shadow-orange-200/50">
          <span className="text-[11px] font-black text-white">3</span>
        </div>
      );
    }
    return (
      <div className="w-7 h-7 rounded-full bg-bg border border-border flex items-center justify-center">
        <span className="text-[11px] font-bold text-text-muted">{rank}</span>
      </div>
    );
  };

  return (
    <div className="bg-card border border-border rounded-xl shadow-md overflow-hidden">
      {/* Header */}
      <div
        className="p-5 border-b border-border flex items-center justify-between cursor-pointer select-none hover:bg-bg/30 transition-colors"
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-sm">
            <Trophy className="w-4 h-4 text-white" />
          </div>
          <div>
            <h3 className="font-extrabold text-sm text-text-main">Ranking Produk</h3>
            <p className="text-[10px] text-text-placeholder mt-0.5">Peringkat berdasarkan total items sold</p>
          </div>
        </div>
        <button className="p-1 text-text-placeholder hover:text-text-main transition-colors">
          {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
        </button>
      </div>

      {!isCollapsed && (
        <div className="p-5 space-y-5">
          {/* Filter Bar */}
          <div className="flex flex-wrap items-end gap-3">
            {/* Quick Presets */}
            <div className="flex flex-wrap gap-1.5">
              {[
                { label: "Hari Ini", fn: setToday },
                { label: "7 Hari", fn: setLast7Days },
                { label: "Minggu Ini", fn: setThisWeek },
                { label: "30 Hari", fn: setLast30Days },
                { label: "Bulan Ini", fn: setThisMonth },
              ].map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={preset.fn}
                  className="text-[10px] font-bold px-2.5 py-1.5 rounded-lg border border-border bg-bg hover:bg-accent hover:text-white hover:border-accent transition-all cursor-pointer text-text-muted"
                >
                  {preset.label}
                </button>
              ))}
            </div>

            {/* Date Range Inputs */}
            <div className="flex items-center gap-2 bg-bg border border-border rounded-lg px-2.5 py-1.5">
              <Calendar className="w-3.5 h-3.5 text-text-placeholder" />
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-transparent text-xs text-text-main outline-none border-none py-0 px-1 cursor-pointer focus:ring-0"
              />
              <span className="text-text-placeholder text-xs">—</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-transparent text-xs text-text-main outline-none border-none py-0 px-1 cursor-pointer focus:ring-0"
              />
            </div>

            {/* Search Button */}
            <button
              type="button"
              onClick={handleFetchRanking}
              disabled={loading}
              className="flex items-center gap-1.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white text-xs font-bold px-4 py-2 rounded-lg transition-all cursor-pointer shadow-sm shadow-amber-200/30 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <SearchIcon className="w-3.5 h-3.5" />
              )}
              {loading ? "Memproses..." : "Tampilkan Ranking"}
            </button>
          </div>

          {/* Error Message */}
          {errorMsg && (
            <div className="text-xs text-danger bg-danger-bg border border-danger-border rounded-lg px-3 py-2 font-medium">
              {errorMsg}
            </div>
          )}

          {/* Summary Stat Cards */}
          {summary && ranked && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                {
                  label: "Total Produk",
                  value: fmt(summary.total_products),
                  icon: Package,
                  color: "text-violet-500",
                  bg: "bg-violet-50",
                },
                {
                  label: "Total Pesanan",
                  value: fmt(summary.total_orders),
                  icon: ShoppingCart,
                  color: "text-sky-500",
                  bg: "bg-sky-50",
                },
                {
                  label: "Total Items Sold",
                  value: fmt(summary.total_items_sold),
                  icon: TrendingUp,
                  color: "text-emerald-500",
                  bg: "bg-emerald-50",
                },
                {
                  label: "Total GMV",
                  value: fmtIDR(summary.total_gmv),
                  icon: DollarSign,
                  color: "text-amber-500",
                  bg: "bg-amber-50",
                },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="bg-bg border border-border rounded-xl p-3.5 flex items-center gap-3"
                >
                  <div className={`w-9 h-9 rounded-lg ${stat.bg} flex items-center justify-center flex-shrink-0`}>
                    <stat.icon className={`w-4.5 h-4.5 ${stat.color}`} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[10px] font-bold text-text-placeholder uppercase tracking-wider truncate">
                      {stat.label}
                    </div>
                    <div className="text-sm font-extrabold text-text-main truncate mt-0.5">
                      {stat.value}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Ranking Table */}
          {ranked && (
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-bg border-b border-border text-[10px] font-bold text-text-muted uppercase tracking-wider">
                    <th className="py-3 px-4 w-14 text-center">#</th>
                    <th className="py-3 px-4 min-w-[220px]">Produk</th>
                    <th className="py-3 px-4 text-right">Items Sold</th>
                    <th className="py-3 px-4 text-right">Pesanan</th>
                    <th className="py-3 px-4 text-right">GMV</th>
                    <th className="py-3 px-4 text-right">Est. Komisi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border text-xs text-text-main">
                  {ranked.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-10 text-center text-text-placeholder font-medium">
                        <div className="flex flex-col items-center gap-2">
                          <BarChart3 className="w-8 h-8 text-text-placeholder/40" />
                          <span>Tidak ada data penjualan dalam rentang waktu yang dipilih.</span>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    ranked.map((r) => (
                      <tr
                        key={r.product_id}
                        className={`hover:bg-bg/50 transition-colors ${
                          r.rank <= 3 ? "bg-amber-50/30" : ""
                        }`}
                      >
                        <td className="py-3 px-4 text-center">
                          {renderRankBadge(r.rank)}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-semibold text-[11px] leading-snug break-words max-w-[320px]">
                            {r.product_name}
                          </div>
                          {r.shop_name && (
                            <div className="text-[10px] text-text-placeholder mt-0.5">
                              {r.shop_name}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <span className={`font-extrabold text-[12px] ${
                            r.rank === 1 ? "text-amber-600" : r.rank <= 3 ? "text-orange-500" : "text-text-main"
                          }`}>
                            {fmt(r.total_items_sold)}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-semibold whitespace-nowrap">
                          {fmt(r.total_orders)}
                        </td>
                        <td className="py-3 px-4 text-right font-semibold whitespace-nowrap text-emerald-600">
                          {fmtIDR(r.total_gmv)}
                        </td>
                        <td className="py-3 px-4 text-right font-semibold whitespace-nowrap text-sky-600">
                          {fmtIDR(r.total_est_commission)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Initial Empty State */}
          {!ranked && !loading && !errorMsg && (
            <div className="flex flex-col items-center gap-3 py-8 text-text-placeholder">
              <Medal className="w-10 h-10 text-text-placeholder/30" />
              <div className="text-center">
                <p className="text-xs font-bold">Pilih rentang waktu untuk melihat ranking produk</p>
                <p className="text-[10px] mt-0.5">Gunakan tombol preset atau pilih tanggal secara manual</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
