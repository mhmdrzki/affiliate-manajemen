// /*
// Tujuan: Komponen klien-side interaktif untuk menampilkan tabel data penjualan (sales_data) dengan filter, pencarian, dan ekspor CSV.
// Caller: app/(dashboard)/import/page.tsx
// Dependensi: lucide-react, lib/utils/format.ts, next/navigation, app/actions/import-orders.ts (getAllFilteredOrdersAction)
// Main Functions: SalesDataTable
// Side Effects: Mengubah parameter pencarian URL ketika filter berubah, dan mengunduh berkas CSV.
// */

"use client";

import React, { useState, useEffect } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import {
  Search,
  Calendar,
  X,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  ShoppingBag,
  Info,
  DollarSign,
  Download,
  Loader2
} from "lucide-react";
import { fmt } from "@/lib/utils/format";
import { getAllFilteredOrdersAction } from "@/app/actions/import-orders";

interface Product {
  product_id: string;
  product_name: string;
}

interface OrderItem {
  order_id: string;
  product_id: string | null;
  product_name: string | null;
  order_type: string;
  price: number;
  items_sold: number;
  gmv: number;
  est_commission: number;
  actual_commission: number;
  settlement_status: string;
  ordered_at: string;
}

interface SalesDataTableProps {
  orders: OrderItem[];
  products: Product[];
  currentPage: number;
  totalPages: number;
  totalRows: number;
  limit: number;
  search: string;
  startDate: string;
  endDate: string;
  productId: string;
  orderType: string;
  status: string;
}

export default function SalesDataTable({
  orders,
  products,
  currentPage,
  totalPages,
  totalRows,
  limit,
  search,
  startDate,
  endDate,
  productId,
  orderType,
  status
}: SalesDataTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Local state for filters
  const [localSearch, setLocalSearch] = useState(search);
  const [localStartDate, setLocalStartDate] = useState(startDate);
  const [localEndDate, setLocalEndDate] = useState(endDate);
  const [localProductId, setLocalProductId] = useState(productId);
  const [localOrderType, setLocalOrderType] = useState(orderType);
  const [localStatus, setLocalStatus] = useState(status);

  // Sync local state when URL changes (e.g. back navigation)
  useEffect(() => { setLocalSearch(search); }, [search]);
  useEffect(() => { setLocalStartDate(startDate); }, [startDate]);
  useEffect(() => { setLocalEndDate(endDate); }, [endDate]);
  useEffect(() => { setLocalProductId(productId); }, [productId]);
  useEffect(() => { setLocalOrderType(orderType); }, [orderType]);
  useEffect(() => { setLocalStatus(status); }, [status]);

  const [exporting, setExporting] = useState(false);

  const handleExportCSV = async () => {
    setExporting(true);
    try {
      const res = await getAllFilteredOrdersAction({
        search,
        startDate,
        endDate,
        productId,
        orderType,
        status,
      });

      if (!res.success || !res.data) {
        alert(res.message || "Gagal mengambil data pesanan untuk ekspor.");
        return;
      }

      const headers = [
        "Order ID",
        "Product ID",
        "Product Name",
        "Content ID",
        "Order Type",
        "Price",
        "Items Sold",
        "GMV",
        "Est. Commission",
        "Actual Commission",
        "Settlement Status",
        "Ordered At"
      ];

      const keys = [
        "order_id",
        "product_id",
        "product_name",
        "contents_id",
        "order_type",
        "price",
        "items_sold",
        "gmv",
        "est_commission",
        "actual_commission",
        "settlement_status",
        "ordered_at"
      ];

      const csvContent = [
        headers.join(","),
        ...res.data.map((item) =>
          keys.map((key) => {
            let val = item[key as keyof typeof item];
            if (val === null || val === undefined) {
              val = "";
            }
            val = String(val);
            if (val.includes(",") || val.includes('"') || val.includes("\n") || val.includes(";")) {
              val = `"${val.replace(/"/g, '""')}"`;
            }
            return val;
          }).join(",")
        )
      ].join("\n");

      const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `daftar_pesanan_${new Date().toISOString().split("T")[0]}.csv`);
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      alert("Terjadi kesalahan saat mengekspor data pesanan.");
    } finally {
      setExporting(false);
    }
  };

  const handleFilterChange = (params: Record<string, string | null>) => {
    const nextParams = new URLSearchParams(searchParams.toString());
    Object.entries(params).forEach(([key, val]) => {
      if (val === null || val === "") {
        nextParams.delete(key);
      } else {
        nextParams.set(key, val);
      }
    });

    // Reset to page 1 for filter changes
    if (!("page" in params)) {
      nextParams.delete("page");
    }

    router.push(`${pathname}?${nextParams.toString()}`);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleFilterChange({ search: localSearch });
  };

  const handleClearFilters = () => {
    setLocalSearch("");
    setLocalStartDate("");
    setLocalEndDate("");
    setLocalProductId("");
    setLocalOrderType("");
    setLocalStatus("");
    router.push(pathname);
  };

  return (
    <div className="bg-card border border-border rounded-xl shadow-md overflow-hidden">
      {/* Header & Filters Section */}
      <div className="p-5 border-b border-border flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
          <div className="flex items-center gap-3">
            <ShoppingBag className="w-5 h-5 text-accent" />
            <h3 className="font-extrabold text-sm text-text-main">
              Daftar Pesanan Terimpor ({totalRows})
            </h3>
            <button
              onClick={handleExportCSV}
              disabled={exporting}
              className="flex items-center gap-1.5 bg-white hover:bg-bg-panel text-text-muted border border-border-light hover:border-border-active text-[10px] font-bold px-2.5 py-1.5 rounded-lg transition-all cursor-pointer shadow-sm disabled:opacity-50"
              title="Ekspor data pesanan saat ini berdasarkan filter yang aktif"
            >
              {exporting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-text-placeholder" />
              ) : (
                <Download className="w-3.5 h-3.5 text-text-placeholder" />
              )}
              <span>Ekspor CSV</span>
            </button>
          </div>

          {/* Search Form */}
          <form onSubmit={handleSearchSubmit} className="relative w-full sm:w-64 flex gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-text-placeholder absolute left-3 top-2.5" />
              <input
                type="text"
                value={localSearch}
                onChange={(e) => setLocalSearch(e.target.value)}
                placeholder="Cari ID Pesanan / Nama Produk..."
                className="w-full bg-bg border border-border focus:border-accent text-xs rounded-lg py-2 pl-9 pr-8 text-text-main placeholder-text-placeholder outline-none transition-all"
              />
              {localSearch && (
                <button
                  type="button"
                  onClick={() => {
                    setLocalSearch("");
                    handleFilterChange({ search: "" });
                  }}
                  className="absolute right-2.5 top-2.5 text-text-placeholder hover:text-text-main transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <button
              type="submit"
              className="bg-accent hover:bg-accent-hover text-white text-xs font-bold px-3 py-2 rounded-lg cursor-pointer transition-colors"
            >
              Cari
            </button>
          </form>
        </div>

        {/* Date, Product, Type, Status Filter Row */}
        <div className="flex flex-wrap gap-3 items-center">
          {/* Order Date Filter */}
          <div className="flex items-center gap-2 bg-bg border border-border rounded-lg px-2.5 py-1.5">
            <Calendar className="w-3.5 h-3.5 text-text-placeholder" />
            <span className="text-[10px] font-bold text-text-placeholder uppercase tracking-wider">
              Tanggal Pesanan:
            </span>
            <input
              type="date"
              value={localStartDate}
              onChange={(e) => {
                setLocalStartDate(e.target.value);
                handleFilterChange({ startDate: e.target.value });
              }}
              className="bg-transparent text-xs text-text-main outline-none border-none py-0 px-1 cursor-pointer focus:ring-0"
            />
            <span className="text-text-placeholder text-xs">-</span>
            <input
              type="date"
              value={localEndDate}
              onChange={(e) => {
                setLocalEndDate(e.target.value);
                handleFilterChange({ endDate: e.target.value });
              }}
              className="bg-transparent text-xs text-text-main outline-none border-none py-0 px-1 cursor-pointer focus:ring-0"
            />
          </div>

          {/* Product Filter */}
          <div className="flex items-center gap-2 bg-bg border border-border rounded-lg px-2.5 py-1.5">
            <span className="text-[10px] font-bold text-text-placeholder uppercase tracking-wider">
              Produk:
            </span>
            <select
              value={localProductId}
              onChange={(e) => {
                setLocalProductId(e.target.value);
                handleFilterChange({ productId: e.target.value });
              }}
              className="bg-transparent text-xs text-text-main font-bold outline-none border-none p-0 cursor-pointer focus:ring-0 max-w-[160px] truncate"
            >
              <option value="" className="bg-card text-text-main">Semua Produk</option>
              {products.map((p) => (
                <option key={p.product_id} value={p.product_id} className="bg-card text-text-main">
                  {p.product_name}
                </option>
              ))}
            </select>
          </div>

          {/* Type Filter */}
          <div className="flex items-center gap-2 bg-bg border border-border rounded-lg px-2.5 py-1.5">
            <span className="text-[10px] font-bold text-text-placeholder uppercase tracking-wider">
              Tipe:
            </span>
            <select
              value={localOrderType}
              onChange={(e) => {
                setLocalOrderType(e.target.value);
                handleFilterChange({ orderType: e.target.value });
              }}
              className="bg-transparent text-xs text-text-main font-bold outline-none border-none p-0 cursor-pointer focus:ring-0"
            >
              <option value="" className="bg-card text-text-main">Semua Tipe</option>
              <option value="affiliate" className="bg-card text-text-main">Affiliate</option>
              <option value="shop_ads" className="bg-card text-text-main">Shop Ads</option>
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-2 bg-bg border border-border rounded-lg px-2.5 py-1.5">
            <span className="text-[10px] font-bold text-text-placeholder uppercase tracking-wider">
              Status:
            </span>
            <select
              value={localStatus}
              onChange={(e) => {
                setLocalStatus(e.target.value);
                handleFilterChange({ status: e.target.value });
              }}
              className="bg-transparent text-xs text-text-main font-bold outline-none border-none p-0 cursor-pointer focus:ring-0"
            >
              <option value="" className="bg-card text-text-main">Semua Status</option>
              <option value="settled" className="bg-card text-text-main">Settled</option>
              <option value="pending" className="bg-card text-text-main">Pending</option>
              <option value="awaiting_payment" className="bg-card text-text-main">Awaiting Payment</option>
            </select>
          </div>

          {/* Clear Filters Button */}
          {(search || startDate || endDate || productId || orderType || status) && (
            <button
              onClick={handleClearFilters}
              className="inline-flex items-center gap-1.5 text-[10px] font-bold text-danger hover:text-danger-hover border border-danger-border bg-danger-bg hover:bg-danger-bg/80 rounded-lg px-2.5 py-1.5 transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" /> Bersihkan Filter
            </button>
          )}
        </div>
      </div>

      {/* Info Notice */}
      <div className="px-5 py-3 bg-info-bg border-b border-border text-info text-[11px] font-medium flex items-center gap-2">
        <Info className="w-4 h-4 flex-shrink-0" />
        <span>Pesanan di bawah direlasikan secara otomatis ke Master Produk berdasarkan <strong>Product ID</strong> dari file Excel.</span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-bg border-b border-border text-[10px] font-bold text-text-muted uppercase tracking-wider">
              <th className="py-3.5 px-4">Tanggal Pesanan</th>
              <th className="py-3.5 px-4">Order ID</th>
              <th className="py-3.5 px-4 min-w-[200px]">Nama Produk</th>
              <th className="py-3.5 px-4 text-center">Tipe</th>
              <th className="py-3.5 px-4 text-right">Harga</th>
              <th className="py-3.5 px-4 text-center">Jumlah</th>
              <th className="py-3.5 px-4 text-right">GMV</th>
              <th className="py-3.5 px-4 text-right">Estimasi Komisi</th>
              <th className="py-3.5 px-4 text-center">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border text-xs text-text-main">
            {orders.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-8 text-center text-text-placeholder font-medium">
                  Tidak ada data pesanan ditemukan. Silakan lakukan impor atau sesuaikan filter pencarian Anda.
                </td>
              </tr>
            ) : (
              orders.map((o) => (
                <tr key={o.order_id} className="hover:bg-bg/50 transition-colors">
                  {/* Ordered At */}
                  <td className="py-3.5 px-4 font-mono text-[11px] whitespace-nowrap">
                    {o.ordered_at ? new Date(o.ordered_at).toLocaleDateString("id-ID", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric"
                    }) : "-"}
                  </td>

                  {/* Order ID */}
                  <td className="py-3.5 px-4 font-mono text-[11px] text-text-placeholder font-semibold">
                    {o.order_id}
                  </td>

                  {/* Product Name */}
                  <td className="py-3.5 px-4">
                    <div className="font-semibold max-w-[280px] truncate" title={o.product_name || "Produk Tidak Ditemukan"}>
                      {o.product_name || <span className="italic text-text-placeholder">Produk tidak dikenal ({o.product_id})</span>}
                    </div>
                  </td>

                  {/* Order Type */}
                  <td className="py-3.5 px-4 text-center whitespace-nowrap">
                    <span
                      className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold ${
                        o.order_type === "affiliate"
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-250"
                          : "bg-blue-50 text-blue-700 border border-blue-250"
                      }`}
                    >
                      {o.order_type === "affiliate" ? "Affiliate" : "Shop Ads"}
                    </span>
                  </td>

                  {/* Price */}
                  <td className="py-3.5 px-4 text-right font-medium whitespace-nowrap">
                    Rp{fmt(o.price)}
                  </td>

                  {/* Items Sold */}
                  <td className="py-3.5 px-4 text-center font-bold">
                    {o.items_sold}
                  </td>

                  {/* GMV */}
                  <td className="py-3.5 px-4 text-right font-extrabold text-text-main whitespace-nowrap">
                    Rp{fmt(o.gmv)}
                  </td>

                  {/* Estimated Commission */}
                  <td className="py-3.5 px-4 text-right font-extrabold text-success whitespace-nowrap">
                    Rp{fmt(o.est_commission)}
                  </td>

                  {/* Settlement Status */}
                  <td className="py-3.5 px-4 text-center whitespace-nowrap">
                    <span
                      className={`inline-flex px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wide ${
                        o.settlement_status === "settled"
                          ? "bg-success-bg text-success border border-success-border/30"
                          : o.settlement_status === "pending"
                          ? "bg-warning-bg text-warning border border-warning-border/30"
                          : "bg-danger-bg text-danger border border-danger-border/30"
                      }`}
                    >
                      {o.settlement_status === "settled"
                        ? "Settled"
                        : o.settlement_status === "pending"
                        ? "Pending"
                        : "Awaiting Payment"}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      {totalRows > 0 && (
        <div className="p-4 border-t border-border flex flex-col sm:flex-row gap-4 items-center justify-between bg-bg/20">
          {/* Info Range */}
          <div className="text-[11px] text-text-placeholder font-medium flex items-center gap-4">
            <span>
              Menampilkan <span className="font-bold text-text-main">{Math.min(totalRows, (currentPage - 1) * limit + 1)}</span>
              {" - "}
              <span className="font-bold text-text-main">{Math.min(totalRows, currentPage * limit)}</span> dari{" "}
              <span className="font-bold text-text-main">{totalRows}</span> data pesanan
            </span>

            {/* Limit Selector */}
            <div className="flex items-center gap-1.5 bg-bg border border-border rounded-lg px-2 py-0.5">
              <span className="text-[9px] font-bold text-text-placeholder uppercase tracking-wider">
                Baris:
              </span>
              <select
                value={limit}
                onChange={(e) => handleFilterChange({ limit: e.target.value })}
                className="bg-transparent text-[11px] text-text-main font-bold outline-none border-none p-0 cursor-pointer focus:ring-0"
              >
                <option value="15">15</option>
                <option value="25">25</option>
                <option value="50">50</option>
              </select>
            </div>
          </div>

          {/* Page Selector Buttons */}
          {totalPages > 1 && (
            <div className="flex items-center gap-1.5">
              <button
                disabled={currentPage <= 1}
                onClick={() => handleFilterChange({ page: String(currentPage - 1) })}
                className="p-1.5 border border-border rounded-lg bg-card text-text-main hover:bg-bg disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-card transition-colors cursor-pointer"
                title="Halaman Sebelumnya"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              {(() => {
                const pages: (number | string)[] = [];
                const maxVisible = 5;
                if (totalPages <= maxVisible) {
                  for (let i = 1; i <= totalPages; i++) pages.push(i);
                } else {
                  pages.push(1);
                  if (currentPage > 3) pages.push("...");
                  const start = Math.max(2, currentPage - 1);
                  const end = Math.min(totalPages - 1, currentPage + 1);
                  for (let i = start; i <= end; i++) {
                    if (i !== 1 && i !== totalPages) pages.push(i);
                  }
                  if (currentPage < totalPages - 2) pages.push("...");
                  pages.push(totalPages);
                }

                return pages.map((p, idx) => {
                  if (p === "...") {
                    return (
                      <span key={`dots-${idx}`} className="px-2 text-text-placeholder text-xs">
                        ...
                      </span>
                    );
                  }
                  const isActive = p === currentPage;
                  return (
                    <button
                      key={`page-${p}`}
                      onClick={() => handleFilterChange({ page: String(p) })}
                      className={`min-w-8 h-8 flex items-center justify-center text-xs font-bold rounded-lg transition-colors cursor-pointer border ${
                        isActive
                          ? "bg-accent border-accent text-white shadow-sm shadow-accent/20 hover:bg-accent"
                          : "border-border bg-card text-text-muted hover:bg-bg hover:text-text-main"
                      }`}
                    >
                      {p}
                    </button>
                  );
                });
              })()}

              <button
                disabled={currentPage >= totalPages}
                onClick={() => handleFilterChange({ page: String(currentPage + 1) })}
                className="p-1.5 border border-border rounded-lg bg-card text-text-main hover:bg-bg disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-card transition-colors cursor-pointer"
                title="Halaman Selanjutnya"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
