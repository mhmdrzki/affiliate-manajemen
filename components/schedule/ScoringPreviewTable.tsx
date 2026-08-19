// /*
// Tujuan: Menampilkan tabel hasil kalkulasi scoring produk beserta breakdown komponen nilai dan status eligibility secara detail dengan tema terang.
// Caller: components/schedule/ScheduleGeneratorClient.tsx
// Dependensi: React, components/schedule/PoolBadge.tsx, lucide-react
// Main Functions: ScoringPreviewTable
// Side Effects: None
// */

"use client";

import React from "react";
import PoolBadge from "./PoolBadge";
import { Search, ChevronDown, ChevronUp, Info, AlertTriangle } from "lucide-react";

interface ScoringPreviewTableProps {
  scoredProducts: any[];
  excludedProducts: any[];
  scheduledProductIds: Set<string>;
  search: string;
  setSearch: (s: string) => void;
  filterPool: string;
  setFilterPool: (f: string) => void;
}

export default function ScoringPreviewTable({
  scoredProducts,
  excludedProducts,
  scheduledProductIds,
  search,
  setSearch,
  filterPool,
  setFilterPool,
}: ScoringPreviewTableProps) {
  const [sortField, setSortField] = React.useState<string>("score");
  const [sortAsc, setSortAsc] = React.useState<boolean>(false);

  // Satukan data produk terskor dan terexcluded untuk satu tabel visual
  const allRows = [
    ...scoredProducts.map((p) => ({
      ...p,
      isExcluded: false,
      reason: null,
      displayScore: p.score.toFixed(3),
    })),
    ...excludedProducts.map((p) => ({
      product_id: p.product_id,
      product_name: p.product_name,
      pool: p.pool || null,
      score: -1,
      displayScore: "—",
      isExcluded: true,
      reason: p.reason,
      score_breakdown: {},
      aggregate: p.aggregate || {
        total_orders: 0,
        total_content: 0,
        dslo: 9999,
        dslc: 9999,
      },
    })),
  ];

  // Filter
  const filteredRows = allRows.filter((row) => {
    const matchesSearch = row.product_name.toLowerCase().includes(search.toLowerCase());
    
    if (filterPool === "ALL") return matchesSearch;
    if (filterPool === "HOT") return matchesSearch && row.aggregate?.is_hot;
    if (filterPool === "EXCLUDED") return matchesSearch && row.isExcluded;
    if (filterPool === "SCHEDULED") return matchesSearch && scheduledProductIds.has(row.product_id);
    return matchesSearch && row.pool === filterPool && !row.isExcluded;
  });

  // Sort
  const sortedRows = [...filteredRows].sort((a, b) => {
    let valA: any = a[sortField as keyof typeof a];
    let valB: any = b[sortField as keyof typeof b];

    // Handle nested aggregates
    if (sortField.startsWith("agg_")) {
      const field = sortField.replace("agg_", "");
      valA = a.aggregate?.[field] ?? 0;
      valB = b.aggregate?.[field] ?? 0;
    }

    if (valA === undefined || valA === null) return sortAsc ? -1 : 1;
    if (valB === undefined || valB === null) return sortAsc ? 1 : -1;

    if (typeof valA === "string") {
      return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
    }
    return sortAsc ? valA - valB : valB - valA;
  });

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  const RenderSortIcon = ({ field }: { field: string }) => {
    if (sortField !== field) return null;
    return sortAsc ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />;
  };

  return (
    <div className="space-y-4">
      {/* Control panel */}
      <div className="flex flex-col sm:flex-row gap-3 justify-between items-center bg-white border border-border-light p-4 rounded-xl shadow-2xs">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-text-placeholder" />
          <input
            type="text"
            placeholder="Cari produk..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-bg border border-border-light rounded-lg pl-9 pr-3 py-2 text-xs text-text-main focus:outline-none focus:border-accent"
          />
        </div>

        <div className="flex gap-2 w-full sm:w-auto">
          <select
            value={filterPool}
            onChange={(e) => setFilterPool(e.target.value)}
            className="bg-bg border border-border-light rounded-lg px-3 py-2 text-xs text-text-main font-semibold focus:outline-none focus:border-accent"
          >
            <option value="ALL">Semua Pool & Kelayakan</option>
            <option value="HOT">🔥 Produk Winning / Hot</option>
            <option value="A">Pool A — Proven</option>
            <option value="B">Pool B — Testing</option>
            <option value="C">Pool C — Watchlist</option>
            <option value="D">Pool D — Baru</option>
            <option value="EXCLUDED">Tereliminasi (Filter Keras)</option>
            <option value="SCHEDULED">Masuk Jadwal Hari Ini</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="border border-border-light rounded-xl overflow-hidden bg-white shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-text-placeholder text-[10px] font-mono tracking-wider uppercase border-b border-border-light select-none">
                <th
                  onClick={() => handleSort("product_name")}
                  className="px-4 py-3 cursor-pointer hover:text-text-main font-bold"
                >
                  <div className="flex items-center gap-1">
                    <span>Nama Produk</span>
                    <RenderSortIcon field="product_name" />
                  </div>
                </th>
                <th className="px-4 py-3 font-bold text-text-placeholder">Klasifikasi / Status</th>
                <th
                  onClick={() => handleSort("score")}
                  className="px-4 py-3 cursor-pointer hover:text-text-main font-bold text-center"
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>Skor</span>
                    <RenderSortIcon field="score" />
                  </div>
                </th>
                <th className="px-4 py-3 font-mono text-[9px] text-center font-bold text-text-placeholder">Recency</th>
                <th className="px-4 py-3 font-mono text-[9px] text-center font-bold text-text-placeholder">Momentum</th>
                <th className="px-4 py-3 font-mono text-[9px] text-center font-bold text-text-placeholder">Efficiency</th>
                <th className="px-4 py-3 font-mono text-[9px] text-center font-bold text-text-placeholder">Content Debt</th>
                <th className="px-4 py-3 font-mono text-[9px] text-center font-bold text-text-placeholder text-orange-600">Hot Boost</th>
                <th
                  onClick={() => handleSort("agg_total_orders")}
                  className="px-4 py-3 cursor-pointer hover:text-text-main font-bold text-center"
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>Orders</span>
                    <RenderSortIcon field="agg_total_orders" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort("agg_items_sold_7d")}
                  className="px-4 py-3 cursor-pointer hover:text-text-main font-bold text-center"
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>Items 7d</span>
                    <RenderSortIcon field="agg_items_sold_7d" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort("agg_total_content")}
                  className="px-4 py-3 cursor-pointer hover:text-text-main font-bold text-center"
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>Konten</span>
                    <RenderSortIcon field="agg_total_content" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort("agg_dslo")}
                  className="px-4 py-3 cursor-pointer hover:text-text-main font-bold text-center"
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>DSLO</span>
                    <RenderSortIcon field="agg_dslo" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort("agg_dslc")}
                  className="px-4 py-3 cursor-pointer hover:text-text-main font-bold text-center"
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>DSLC</span>
                    <RenderSortIcon field="agg_dslc" />
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-light text-xs text-text-main">
              {sortedRows.length === 0 ? (
                <tr>
                  <td colSpan={13} className="text-center py-8 text-text-placeholder font-semibold">
                    Tidak ada produk yang sesuai dengan filter pencarian.
                  </td>
                </tr>
              ) : (
                sortedRows.map((row) => {
                  const isScheduled = scheduledProductIds.has(row.product_id);
                  const isHot = row.aggregate?.is_hot;
                  return (
                    <tr
                      key={row.product_id}
                      className={`hover:bg-slate-50/50 transition-colors ${
                        isScheduled ? "bg-accent/5 font-semibold" : ""
                      }`}
                    >
                      <td className="px-4 py-3 font-semibold max-w-xs truncate">
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center gap-1.5 min-w-0">
                            {isHot && (
                              <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[9px] font-black bg-orange-100 text-orange-800 border border-orange-200 flex-shrink-0">
                                🔥 HOT
                              </span>
                            )}
                            <span className="truncate" title={row.product_name}>{row.product_name}</span>
                          </div>
                          {isScheduled && (
                            <span className="text-[9px] text-accent font-black uppercase tracking-wider">
                              ✓ Masuk Jadwal Hari Ini
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {row.isExcluded ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-red-50 text-red-700 border border-red-200/80 uppercase shadow-2xs">
                            <AlertTriangle className="w-3 h-3 text-red-600" />
                            {row.reason === "stok_habis" ? "Stok Habis" : "Tidak Aktif"}
                          </span>
                        ) : (
                          <PoolBadge pool={row.pool} />
                        )}
                      </td>
                      <td className="px-4 py-3 text-center font-bold font-mono">
                        {row.isExcluded ? (
                          <span className="text-text-placeholder">—</span>
                        ) : (
                          <span className={isScheduled ? "text-accent font-extrabold" : "text-text-main"}>
                            {row.displayScore}
                          </span>
                        )}
                      </td>
                      {/* Breakdown columns */}
                      <td className="px-4 py-3 text-center font-mono text-[10px] text-text-muted">
                        {row.score_breakdown?.recency?.toFixed(2) ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-center font-mono text-[10px] text-text-muted">
                        {row.score_breakdown?.momentum !== undefined ? (
                          <span className={row.score_breakdown.momentum > 0 ? "text-emerald-600 font-bold" : row.score_breakdown.momentum < 0 ? "text-rose-600 font-bold" : ""}>
                            {row.score_breakdown.momentum > 0 ? "+" : ""}
                            {row.score_breakdown.momentum.toFixed(2)}
                          </span>
                        ) : "—"}
                      </td>
                      <td className="px-4 py-3 text-center font-mono text-[10px] text-text-muted">
                        {row.score_breakdown?.efficiency?.toFixed(2) ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-center font-mono text-[10px] text-text-muted">
                        {row.score_breakdown?.content_debt?.toFixed(2) ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-center font-mono text-[10px] font-bold text-orange-600">
                        {row.score_breakdown?.hot_product_boost !== undefined ? row.score_breakdown.hot_product_boost.toFixed(2) : "—"}
                      </td>
                      {/* Aggregate metrics */}
                      <td className="px-4 py-3 text-center font-mono text-text-muted">
                        {row.aggregate?.total_orders}
                      </td>
                      <td className="px-4 py-3 text-center font-mono font-bold text-orange-600">
                        {row.aggregate?.items_sold_7d ?? 0}
                      </td>
                      <td className="px-4 py-3 text-center font-mono text-text-muted">
                        {row.aggregate?.total_content}
                      </td>
                      <td className="px-4 py-3 text-center font-mono text-text-muted">
                        {row.aggregate?.dslo === 9999 ? "—" : `${row.aggregate?.dslo}h`}
                      </td>
                      <td className="px-4 py-3 text-center font-mono text-text-muted">
                        {row.aggregate?.dslc === 9999 ? "—" : `${row.aggregate?.dslc}h`}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
      <div className="flex items-center gap-1.5 text-[10px] text-text-placeholder px-1">
        <Info className="w-3.5 h-3.5 text-accent" />
        <span>
          Rumus Efisiensi: <code>orders / max(content, 1)</code> di-skala rank-percentile. Bobot: Recency (25%), Momentum (15%), Efisiensi (15%), Debt (10%), Untapped (5%), Hot Boost (30%).
        </span>
      </div>
    </div>
  );
}
