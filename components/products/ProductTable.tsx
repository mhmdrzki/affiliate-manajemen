// /*
// Tujuan: Komponen Client berupa tabel master produk interaktif dengan seleksi checkbox untuk hapus massal (bulk delete).
// Caller: app/(dashboard)/products/page.tsx
// Dependensi: app/actions/products.ts, types/index.ts, components/products/StatusSelector.tsx, components/products/AddProductDialog.tsx, components/products/EditProductDialog.tsx, lucide-react, next/navigation (useRouter)
// Main Functions: ProductTable
// Side Effects: Mengaktifkan loading, memanggil deleteProductsBulkAction server action, refresh halaman setelah hapus.
// */

"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { ShoppingBag, Trash2, AlertTriangle, Loader2, X, Info } from "lucide-react";
import { Product } from "@/types";
import { fmt, fmtIDR } from "@/lib/utils/format";
import StatusSelector from "./StatusSelector";
import AddProductDialog from "./AddProductDialog";
import EditProductDialog from "./EditProductDialog";
import { deleteProductsBulkAction } from "@/app/actions/products";

interface ProductTableProps {
  products: Product[];
}

export default function ProductTable({ products }: ProductTableProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const isAllSelected = products.length > 0 && selectedIds.length === products.length;

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(products.map((p) => p.id));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleBulkDelete = async () => {
    setDeleting(true);
    setError(null);
    try {
      const res = await deleteProductsBulkAction(selectedIds);
      if (res.success) {
        setSelectedIds([]);
        setShowConfirmModal(false);
        router.refresh();
      } else {
        setError(res.message);
      }
    } catch (err: any) {
      setError(err.message || "Terjadi kesalahan saat menghapus produk.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="bg-white border border-border-light rounded-xl p-5 shadow-sm">
      <div className="flex justify-between items-center mb-4 pb-2 border-b border-border-light">
        <div className="flex items-center gap-4">
          <h3 className="text-xs font-bold text-text-main flex items-center gap-2">
            <ShoppingBag className="w-4 h-4 text-accent" />
            <span>Daftar Master Produk ({products.length})</span>
          </h3>
          {selectedIds.length > 0 && (
            <button
              onClick={() => {
                setError(null);
                setShowConfirmModal(true);
              }}
              className="flex items-center gap-1.5 bg-danger hover:bg-danger/90 text-white text-[10px] font-bold px-3 py-1.5 rounded-lg transition-all cursor-pointer shadow-[0_2px_6px_rgba(239,68,68,0.15)] animate-in fade-in duration-200"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Hapus {selectedIds.length} Terpilih</span>
            </button>
          )}
        </div>
        {/* Modal Tambah Produk Baru */}
        <AddProductDialog />
      </div>

      <div className="overflow-x-auto border border-border-light rounded-lg">
        <table className="w-full border-collapse text-left text-xs">
          <thead>
            <tr className="bg-bg-panel border-b border-border-light text-[10px] font-bold text-text-placeholder uppercase tracking-wider">
              {/* Checkbox Header */}
              <th className="p-3 text-center w-10">
                <input
                  type="checkbox"
                  checked={isAllSelected}
                  onChange={toggleSelectAll}
                  className="rounded text-accent focus:ring-accent w-4 h-4 border-border-light cursor-pointer"
                />
              </th>
              <th className="p-3">Nama Produk</th>
              <th className="p-3">Toko / Seller</th>
              <th className="p-3">Kategori</th>
              <th className="p-3">Harga</th>
              <th className="p-3">Komisi</th>
              <th className="p-3 text-center">Orders</th>
              <th className="p-3 text-center">Net Sold</th>
              <th className="p-3 text-center">Revenue</th>
              <th className="p-3 text-center">GMV Max %</th>
              <th className="p-3 text-center">Regularity</th>
              <th className="p-3 text-center">Skor</th>
              <th className="p-3 text-center">Klasifikasi</th>
              <th className="p-3 text-center">Kuota/Mg</th>
              <th className="p-3 text-center">Status</th>
              <th className="p-3 text-center">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-light">
            {products.length > 0 ? (
              products.map((p) => {
                let badgeStyles = "bg-bg text-text-placeholder border-border-light";
                switch (p.klasifikasi) {
                  case "COLLABORATION":
                    badgeStyles = "bg-purple-50 text-purple-600 border-purple-200";
                    break;
                  case "RESTOCK_CONFIRMED":
                    badgeStyles = "bg-emerald-50 text-emerald-600 border-emerald-200";
                    break;
                  case "PROVEN_WINNER":
                    badgeStyles = "bg-success-bg text-success border-success-border";
                    break;
                  case "GMV_ACTIVE":
                    badgeStyles = "bg-teal-50 text-teal-600 border-teal-200";
                    break;
                  case "RESTOCK_RECOVERY":
                    badgeStyles = "bg-blue-50 text-blue-600 border-blue-200";
                    break;
                  case "GROWING":
                    badgeStyles = "bg-info-bg text-info border-info-border";
                    break;
                  case "EARLY_STAGE":
                    badgeStyles = "bg-warning-bg text-warning border-warning-border";
                    break;
                  case "MONITOR":
                    badgeStyles = "bg-gray-50 text-gray-600 border-gray-200";
                    break;
                  case "SPIKE_ONLY":
                    badgeStyles = "bg-amber-50 text-amber-600 border-amber-200";
                    break;
                  case "STAGNANT":
                    badgeStyles = "bg-danger-bg text-danger border-danger-border";
                    break;
                  case "DECLINING":
                    badgeStyles = "bg-orange-50 text-orange-600 border-orange-200";
                    break;
                }

                const isSelected = selectedIds.includes(p.id);

                return (
                  <tr key={p.id} className={`hover:bg-bg-panel transition-colors ${isSelected ? "bg-bg-panel" : ""}`}>
                    {/* Checkbox cell */}
                    <td className="p-3 text-center align-middle">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelect(p.id)}
                        className="rounded text-accent focus:ring-accent w-4 h-4 border-border-light cursor-pointer"
                      />
                    </td>
                    <td className="p-3">
                      <div className="font-bold text-text-main max-w-xs truncate">
                        {p.nama}
                      </div>
                      <div className="text-[10px] text-text-placeholder mt-0.5">
                        Brand: {p.brand || "—"} · Jenis: {p.jenis || "—"}
                      </div>
                      {p.is_kerjasama && (
                        <span className="inline-flex mt-1 items-center gap-0.5 px-1.5 py-0.5 rounded bg-purple-50 text-purple-600 border border-purple-100 text-[9px] font-bold">
                          🤝 Kerjasama ({p.kerjasama_target}x)
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-text-muted font-medium">
                      {p.shop_name || "—"}
                      <div className="text-[9px] text-text-placeholder mt-0.5 font-mono">
                        {p.shop_code || ""}
                      </div>
                    </td>
                    <td className="p-3 font-semibold text-text-muted">
                      {p.kategori}
                    </td>
                    <td className="p-3 font-mono font-medium text-text-main">
                      {fmtIDR(p.harga)}
                    </td>
                    <td className="p-3 font-mono font-medium text-success">
                      {p.avg_commission_rate > 0 ? `${p.avg_commission_rate.toFixed(1)}%` : `${p.komisi}%`}
                    </td>
                    <td className="p-3 text-center font-mono font-medium text-text-main">
                      {fmt(p.total_orders || 0)}
                    </td>
                    <td className="p-3 text-center font-mono font-medium text-text-main">
                      {fmt(p.net_items_sold || 0)}
                    </td>
                    <td className="p-3 text-center font-mono font-bold text-success">
                      {fmtIDR(p.total_revenue || 0)}
                    </td>
                    <td className="p-3 text-center font-mono font-medium text-text-main">
                      {Math.round((p.shop_ads_ratio || 0) * 100)}%
                    </td>
                    <td className="p-3 text-center font-mono font-semibold text-text-main">
                      {p.regularity_score ? p.regularity_score.toFixed(0) : 0}
                    </td>
                    <td className="p-3 text-center font-mono font-bold text-text-main">
                      {p.bench_score}
                    </td>
                    <td className="p-3 text-center">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[9px] font-bold border uppercase tracking-wide ${badgeStyles}`}>
                        {p.klasifikasi}
                      </span>
                    </td>
                    <td className="p-3 text-center font-mono font-bold text-accent">
                      {p.kuota_mingguan}x
                    </td>
                    <td className="p-3 text-center align-middle">
                      {/* Dropdown pemilih status interaktif */}
                      <StatusSelector productId={p.id} initialStatus={p.status} />
                    </td>
                    <td className="p-3 text-center">
                      <div className="flex items-center justify-center">
                        <EditProductDialog product={p} />
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={16} className="p-8 text-center text-text-placeholder">
                  Belum ada data produk. Silakan tambah produk baru secara manual di atas atau melalui menu **Impor Data**.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          {/* Backdrop Click */}
          <div className="absolute inset-0" onClick={() => !deleting && setShowConfirmModal(false)} />

          {/* Modal Container */}
          <div className="bg-white border border-border-light rounded-2xl shadow-xl w-full max-w-md overflow-hidden relative z-10 transform transition-all duration-300 scale-95 animate-in zoom-in-95 duration-200 flex flex-col">
            {/* Header */}
            <div className="px-5 py-4 border-b border-border-light flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 bg-danger/10 border border-danger/20 text-danger rounded-lg flex items-center justify-center">
                  <Trash2 className="w-3.5 h-3.5" />
                </div>
                <h3 className="font-extrabold text-sm text-text-main tracking-tight">
                  Konfirmasi Hapus Massal
                </h3>
              </div>
              <button
                onClick={() => setShowConfirmModal(false)}
                disabled={deleting}
                className="text-text-placeholder hover:text-text-muted p-1 rounded-lg hover:bg-bg-panel transition-all cursor-pointer disabled:opacity-50"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content */}
            <div className="p-5 space-y-4 text-center">
              <div className="mx-auto w-12 h-12 bg-danger-bg border border-danger-border text-danger rounded-full flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 animate-bounce" />
              </div>
              <div className="space-y-1">
                <h4 className="font-bold text-xs text-text-main">
                  Hapus {selectedIds.length} produk yang dipilih?
                </h4>
                <p className="text-[10px] text-text-placeholder px-4 leading-relaxed">
                  Apakah Anda yakin? Tindakan ini akan menghapus semua produk terpilih secara permanen dari database. Relasi data analitik terkait akan disesuaikan secara otomatis.
                </p>
              </div>

              {error && (
                <div className="p-3 bg-danger-bg border border-danger-border text-danger text-[11px] rounded-lg font-semibold flex gap-2 text-left">
                  <Info className="w-4 h-4 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div className="pt-4 flex gap-3 justify-center">
                <button
                  type="button"
                  onClick={() => setShowConfirmModal(false)}
                  disabled={deleting}
                  className="px-4 py-2 bg-bg border border-border-light hover:border-border-active text-text-muted rounded-lg text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleBulkDelete}
                  disabled={deleting}
                  className="flex items-center gap-1.5 px-4 py-2 bg-danger hover:bg-danger/90 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer disabled:opacity-50 shadow-[0_2px_6px_rgba(239,68,68,0.15)]"
                >
                  {deleting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Menghapus...</span>
                    </>
                  ) : (
                    "Ya, Hapus Semua"
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
