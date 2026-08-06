"use client";

// /*
// Tujuan: Komponen tabel interaktif klien-side terpaginasi untuk menampilkan riwayat konten. Menampilkan deskripsi lengkap & nama produk. Kolom like/komentar/share dihilangkan.
// Caller: app/(dashboard)/history/page.tsx
// Dependensi: types/index.ts, lucide-react, lib/utils/format.ts, components/history/ProductSelector.tsx, next/navigation (useRouter, usePathname, useSearchParams), app/actions/contents.ts (deleteContentAction, getAllFilteredContentsAction)
// Main Functions: ContentHistoryTable
// Side Effects: Memanggil deleteContentAction untuk menghapus entri konten, memicu refresh router, dan mengunduh berkas CSV.
// */

import React, { useState, useEffect } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import {
  Search,
  Eye,
  ExternalLink,
  Film,
  Calendar,
  X,
  ChevronLeft,
  ChevronRight,
  Trash2,
  ArrowUpDown,
  Download,
  Loader2,
} from "lucide-react";
import { Content, Product } from "@/types";
import { fmt } from "@/lib/utils/format";
import ProductSelector from "./ProductSelector";
import { deleteContentAction, getAllFilteredContentsAction } from "@/app/actions/contents";

interface ContentHistoryTableProps {
  contents: Content[];
  products: Product[];
  currentPage: number;
  totalPages: number;
  totalRows: number;
  limit: number;
  search: string;
  startDate: string;
  endDate: string;
  productId: string;
  sortBy: string;
}

export default function ContentHistoryTable({
  contents,
  products,
  currentPage,
  totalPages,
  totalRows,
  limit,
  search,
  startDate,
  endDate,
  productId,
  sortBy,
}: ContentHistoryTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Local state untuk input agar pengetikan cepat & responsif
  const [localSearch, setLocalSearch] = useState(search);
  const [localStartDate, setLocalStartDate] = useState(startDate);
  const [localEndDate, setLocalEndDate] = useState(endDate);
  const [localProductId, setLocalProductId] = useState(productId);
  const [localSortBy, setLocalSortBy] = useState(sortBy);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const handleExportCSV = async () => {
    setExporting(true);
    try {
      const res = await getAllFilteredContentsAction({
        search,
        startDate,
        endDate,
        productId,
      });

      if (!res.success || !res.data) {
        alert(res.message || "Gagal mengambil data konten untuk ekspor.");
        return;
      }

      const headers = [
        "ID Konten",
        "TikTok Content ID",
        "Tanggal Upload",
        "Tipe Konten",
        "Deskripsi",
        "Views",
        "Likes",
        "Comments",
        "Shares",
        "CTR (%)",
        "CTOR (%)",
        "Items Sold",
        "Link Video",
        "ID Produk",
        "Nama Produk"
      ];

      const keys = [
        "id",
        "tiktok_content_id",
        "tanggal_upload",
        "content_type",
        "desc_text",
        "views",
        "likes",
        "comments",
        "shares",
        "ctr",
        "ctor",
        "items_sold",
        "link_video",
        "product_id",
        "product_name"
      ];

      const productMap = new Map(products.map(p => [p.product_id, p.product_name]));

      const exportData = res.data.map(c => ({
        ...c,
        product_name: c.product_id ? (productMap.get(c.product_id) || "") : ""
      }));

      const csvContent = [
        headers.join(","),
        ...exportData.map((item) =>
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
      link.setAttribute("download", `riwayat_konten_${new Date().toISOString().split("T")[0]}.csv`);
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      alert("Terjadi kesalahan saat mengekspor data.");
    } finally {
      setExporting(false);
    }
  };

  // Sinkronisasi state lokal dengan parameter URL saat terjadi navigasi (back/forward)
  useEffect(() => {
    setLocalSearch(search);
  }, [search]);

  useEffect(() => {
    setLocalStartDate(startDate);
  }, [startDate]);

  useEffect(() => {
    setLocalEndDate(endDate);
  }, [endDate]);

  useEffect(() => {
    setLocalProductId(productId);
  }, [productId]);

  useEffect(() => {
    setLocalSortBy(sortBy);
  }, [sortBy]);

  // Handler mengubah parameter filter URL
  const handleFilterChange = (params: Record<string, string | null>) => {
    const nextParams = new URLSearchParams(searchParams.toString());
    Object.entries(params).forEach(([key, val]) => {
      if (val === null || val === "") {
        nextParams.delete(key);
      } else {
        nextParams.set(key, val);
      }
    });

    // Reset ke halaman 1 jika mengubah filter selain navigasi halaman
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
    setLocalSortBy("");
    router.push(pathname);
  };

  const handleDeleteClick = async (contentId: string) => {
    if (!confirm("Apakah Anda yakin ingin menghapus konten ini dari riwayat secara permanen?")) {
      return;
    }

    setDeletingId(contentId);
    try {
      const res = await deleteContentAction(contentId);
      if (res.success) {
        alert(res.message);
      } else {
        alert(res.message);
      }
    } catch (err) {
      alert("Terjadi kesalahan saat menghapus konten.");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="bg-card border border-border rounded-xl shadow-md overflow-hidden">
      {/* Header and Filters Section */}
      <div className="p-5 border-b border-border flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
          <div className="flex items-center gap-3">
            <Film className="w-5 h-5 text-accent" />
            <h3 className="font-extrabold text-sm text-text-main">
              Daftar Konten Terdeteksi ({totalRows})
            </h3>
            <button
              onClick={handleExportCSV}
              disabled={exporting}
              className="flex items-center gap-1.5 bg-white hover:bg-bg-panel text-text-muted border border-border-light hover:border-border-active text-[10px] font-bold px-2.5 py-1.5 rounded-lg transition-all cursor-pointer shadow-sm disabled:opacity-50"
              title="Ekspor data riwayat konten saat ini berdasarkan filter yang aktif"
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
                placeholder="Cari deskripsi atau ID..."
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

        {/* Date & Product Filter Row */}
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex items-center gap-2 bg-bg border border-border rounded-lg px-2.5 py-1.5">
            <Calendar className="w-3.5 h-3.5 text-text-placeholder" />
            <span className="text-[10px] font-bold text-text-placeholder uppercase tracking-wider">
              Tanggal Upload:
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
              className="bg-transparent text-xs text-text-main font-bold outline-none border-none p-0 cursor-pointer focus:ring-0 max-w-[200px] truncate"
            >
              <option value="" className="bg-card text-text-main">Semua Produk</option>
              {products.map((p) => (
                <option key={p.product_id} value={p.product_id} className="bg-card text-text-main">
                  {p.product_name}
                </option>
              ))}
            </select>
          </div>

          {/* Sort By Filter */}
          <div className="flex items-center gap-2 bg-bg border border-border rounded-lg px-2.5 py-1.5">
            <ArrowUpDown className="w-3.5 h-3.5 text-text-placeholder" />
            <span className="text-[10px] font-bold text-text-placeholder uppercase tracking-wider">
              Urutkan:
            </span>
            <select
              value={localSortBy}
              onChange={(e) => {
                setLocalSortBy(e.target.value);
                handleFilterChange({ sortBy: e.target.value });
              }}
              className="bg-transparent text-xs text-text-main font-bold outline-none border-none p-0 cursor-pointer focus:ring-0"
            >
              <option value="" className="bg-card text-text-main">Terbaru</option>
              <option value="no_product_first" className="bg-card text-text-main">Belum Dikaitkan Produk</option>
            </select>
          </div>

          {/* Clear Filters Button */}
          {(search || startDate || endDate || productId || sortBy) && (
            <button
              onClick={handleClearFilters}
              className="inline-flex items-center gap-1.5 text-[10px] font-bold text-danger hover:text-danger-hover border border-danger-border bg-danger-bg hover:bg-danger-bg/80 rounded-lg px-2.5 py-1.5 transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" /> Clear Filters
            </button>
          )}
        </div>
      </div>

      {/* Table Container */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-bg border-b border-border text-[10px] font-bold text-text-muted uppercase tracking-wider">
              <th className="py-3.5 px-4">Tanggal Upload</th>
              <th className="py-3.5 px-4">TikTok ID</th>
              <th className="py-3.5 px-4 min-w-[300px]">Deskripsi</th>
              <th className="py-3.5 px-4 min-w-[220px]">Nama Produk</th>
              <th className="py-3.5 px-4 text-right">Views</th>
              <th className="py-3.5 px-4 text-center">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border text-xs text-text-main">
            {contents.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-text-placeholder font-medium">
                  Tidak ada data konten ditemukan. Silakan gunakan Scraper di atas atau sesuaikan filter Anda.
                </td>
              </tr>
            ) : (
              contents.map((c) => (
                <tr key={c.id} className="hover:bg-bg/50 transition-colors">
                  {/* Upload Date */}
                  <td className="py-3.5 px-4 font-mono text-[11px] whitespace-nowrap">
                    {c.tanggal_upload ? new Date(c.tanggal_upload).toLocaleString("id-ID", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    }) : "-"}
                  </td>

                  {/* TikTok Content ID */}
                  <td className="py-3.5 px-4 font-mono text-[10px] text-text-placeholder">
                    {c.tiktok_content_id || "-"}
                  </td>

                  {/* Description — ditampilkan lengkap */}
                  <td className="py-3.5 px-4">
                    <p className="max-w-[480px] leading-relaxed break-words text-[11px]">
                      {c.desc_text || <span className="italic text-text-placeholder">Tanpa deskripsi</span>}
                    </p>
                  </td>

                  {/* Product Selector */}
                  <td className="py-3.5 px-4 whitespace-nowrap">
                    <ProductSelector
                      contentId={c.id}
                      initialProductId={c.product_id}
                      products={products}
                    />
                  </td>

                  {/* Views */}
                  <td className="py-3.5 px-4 text-right font-bold whitespace-nowrap">
                    <span className="inline-flex items-center gap-1">
                      <Eye className="w-3 h-3 text-sky-400" />
                      {fmt(c.views)}
                    </span>
                  </td>



                  {/* Actions */}
                  <td className="py-3.5 px-4 text-center">
                    <div className="flex items-center justify-center gap-3">
                      {c.link_video ? (
                        <a
                          href={c.link_video}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[10px] font-bold text-accent hover:underline"
                        >
                          Tonton <ExternalLink className="w-3 h-3" />
                        </a>
                      ) : (
                        <span className="text-[10px] text-text-placeholder italic">Tidak ada link</span>
                      )}
                      <button
                        onClick={() => handleDeleteClick(c.id)}
                        disabled={deletingId === c.id}
                        className="inline-flex items-center gap-1 text-[10px] font-bold text-danger hover:text-danger-hover transition-colors disabled:opacity-50 cursor-pointer"
                        title="Hapus Konten"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        {deletingId === c.id ? "Hapus..." : "Hapus"}
                      </button>
                    </div>
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
          {/* Info Range & Limit Selector */}
          <div className="text-[11px] text-text-placeholder font-medium flex flex-wrap items-center gap-4">
            <span>
              Menampilkan <span className="font-bold text-text-main">{Math.min(totalRows, (currentPage - 1) * limit + 1)}</span>
              {" - "}
              <span className="font-bold text-text-main">{Math.min(totalRows, currentPage * limit)}</span> dari{" "}
              <span className="font-bold text-text-main">{totalRows}</span> data
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

          {/* Page Buttons List */}
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
