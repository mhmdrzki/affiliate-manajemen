// /*
// Tujuan: Komponen Client berupa tabel master produk interaktif dengan seleksi checkbox, pencarian real-time klien, edit massal (bulk), tampilan metrik, pemilih status stok, status kerjasama, ekspor CSV, dan impor CSV/Excel.
// Caller: app/(dashboard)/products/page.tsx
// Dependensi: app/actions/products.ts, types/index.ts, components/products/StatusSelector.tsx, components/products/StockStatusSelector.tsx, components/products/AddProductDialog.tsx, components/products/EditProductDialog.tsx, components/products/ImportProductDialog.tsx, components/products/BulkEditProductDialog.tsx, lucide-react, next/navigation (useRouter)
// Main Functions: ProductTable
// Side Effects: Memanggil deleteProductsBulkAction server action dan updateProductsBulkAction server action.
// */

"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { ShoppingBag, Trash2, AlertTriangle, Loader2, X, Info, Download, RotateCcw, Search } from "lucide-react";
import { Product } from "@/types";
import StatusSelector from "./StatusSelector";
import StockStatusSelector from "./StockStatusSelector";
import AddProductDialog from "./AddProductDialog";
import EditProductDialog from "./EditProductDialog";
import ImportProductDialog from "./ImportProductDialog";
import BulkEditProductDialog from "./BulkEditProductDialog";
import { deleteProductsBulkAction, resetProductTestingAction } from "@/app/actions/products";

interface ProductTableProps {
  products: Product[];
}

export default function ProductTable({ products }: ProductTableProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resettingProduct, setResettingProduct] = useState<Product | null>(null);
  const [resetting, setResetting] = useState(false);
  const router = useRouter();

  const handleTriggerResetTesting = (product: Product) => {
    setError(null);
    setResettingProduct(product);
  };

  const handleExecuteResetTesting = async () => {
    if (!resettingProduct) return;
    setResetting(true);
    setError(null);
    try {
      const res = await resetProductTestingAction(resettingProduct.product_id);
      if (res.success) {
        setResettingProduct(null);
        router.refresh();
      } else {
        setError(res.message);
      }
    } catch (err: any) {
      setError(err.message || "Gagal mereset testing produk.");
    } finally {
      setResetting(false);
    }
  };

  const [searchQuery, setSearchQuery] = useState("");

  const filteredProducts = products.filter((p) => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return true;
    return (
      p.product_name.toLowerCase().includes(query) ||
      (p.shop_name && p.shop_name.toLowerCase().includes(query)) ||
      (p.category && p.category.toLowerCase().includes(query)) ||
      p.product_id.toLowerCase().includes(query)
    );
  });

  const isAllSelected = filteredProducts.length > 0 && filteredProducts.every((p) => selectedIds.includes(p.product_id));

  const toggleSelectAll = () => {
    if (isAllSelected) {
      const filteredIds = filteredProducts.map((p) => p.product_id);
      setSelectedIds((prev) => prev.filter((id) => !filteredIds.includes(id)));
    } else {
      const filteredIds = filteredProducts.map((p) => p.product_id);
      setSelectedIds((prev) => Array.from(new Set([...prev, ...filteredIds])));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleExportCSV = () => {
    const headers = [
      "ID Produk",
      "Nama Produk",
      "Nama Toko",
      "Kode Toko",
      "Kategori",
      "Status Stok",
      "Status Aktif",
      "Tanggal Ditambahkan",
      "Kerjasama",
      "Target Kolaborasi",
      "Mulai Kolaborasi",
      "Deadline Kolaborasi"
    ];
    const keys = [
      "product_id",
      "product_name",
      "shop_name",
      "shop_code",
      "category",
      "stock_status",
      "status",
      "date_added",
      "is_collaboration",
      "collab_target_count",
      "collab_start_date",
      "collab_deadline"
    ];

    const exportData = products.map((p) => ({
      ...p,
      is_collaboration: p.is_collaboration ? "Ya" : "Tidak",
      collab_target_count: p.collab_target_count ?? "",
      collab_start_date: p.collab_start_date ?? "",
      collab_deadline: p.collab_deadline ?? ""
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
    link.setAttribute("download", `master_produk_${new Date().toISOString().split("T")[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
            <div className="flex items-center gap-2 animate-in fade-in duration-200">
              <BulkEditProductDialog
                selectedIds={selectedIds}
                onSuccess={() => setSelectedIds([])}
              />
              <button
                onClick={() => {
                  setError(null);
                  setShowConfirmModal(true);
                }}
                className="flex items-center gap-1.5 bg-danger hover:bg-danger/90 text-white text-[10px] font-bold px-3 py-1.5 rounded-lg transition-all cursor-pointer shadow-[0_2px_6px_rgba(239,68,68,0.15)]"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Hapus {selectedIds.length} Terpilih</span>
              </button>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 bg-white hover:bg-bg-panel text-text-muted border border-border-light hover:border-border-active text-xs font-bold px-3 py-2 rounded-lg transition-all cursor-pointer shadow-sm"
          >
            <Download className="w-3.5 h-3.5 text-text-placeholder" />
            <span>Ekspor CSV</span>
          </button>
          <ImportProductDialog />
          <AddProductDialog />
        </div>
      </div>

      {/* Input Pencarian */}
      <div className="mb-4 flex items-center max-w-sm relative">
        <input
          type="text"
          placeholder="Cari nama produk, toko, kategori, atau ID..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full text-xs pl-8 pr-8 py-2 border border-border-light focus:border-accent rounded-lg bg-bg outline-none text-text-main font-semibold"
        />
        <Search className="w-4 h-4 text-text-placeholder absolute left-2.5" />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery("")}
            className="absolute right-2.5 text-text-placeholder hover:text-text-muted transition-colors cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
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
              <th className="p-3 text-center">Stok</th>
              <th className="p-3 text-center">Status</th>
              <th className="p-3 text-center">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-light">
            {filteredProducts.length > 0 ? (
              filteredProducts.map((p) => {


                const isSelected = selectedIds.includes(p.product_id);

                return (
                  <tr key={p.product_id} className={`hover:bg-bg-panel transition-colors ${isSelected ? "bg-bg-panel" : ""}`}>
                    {/* Checkbox cell */}
                    <td className="p-3 text-center align-middle">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelect(p.product_id)}
                        className="rounded text-accent focus:ring-accent w-4 h-4 border-border-light cursor-pointer"
                      />
                    </td>
                    <td className="p-3">
                      <div className="font-bold text-text-main max-w-xs truncate">
                        {p.product_name}
                      </div>
                      <div className="text-[10px] text-text-placeholder mt-0.5 font-mono">
                        ID: {p.product_id || "—"}
                      </div>
                      {p.is_collaboration && (
                        <span className="inline-flex mt-1 items-center gap-0.5 px-1.5 py-0.5 rounded bg-purple-50 text-purple-600 border border-purple-100 text-[9px] font-bold">
                          🤝 Kerjasama ({p.collab_target_count}x)
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
                      {p.category}
                    </td>
                    <td className="p-3 text-center align-middle">
                      <StockStatusSelector productId={p.product_id} initialStockStatus={p.stock_status} />
                    </td>
                    <td className="p-3 text-center align-middle">
                      <StatusSelector productId={p.product_id} initialStatus={p.status} />
                    </td>
                    <td className="p-3 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <EditProductDialog product={p} />
                        <button
                          onClick={() => handleTriggerResetTesting(p)}
                          title="Reset siklus testing produk"
                          className="p-1 hover:bg-bg-panel text-text-placeholder hover:text-accent rounded-lg transition-all cursor-pointer"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={7} className="p-8 text-center text-text-placeholder">
                  {searchQuery
                    ? "Tidak ditemukan produk yang cocok dengan pencarian."
                    : "Belum ada data produk. Silakan tambah produk baru secara manual di atas atau melalui menu Impor Data."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="absolute inset-0" onClick={() => !deleting && setShowConfirmModal(false)} />

          <div className="bg-white border border-border-light rounded-2xl shadow-xl w-full max-w-md overflow-hidden relative z-10 transform transition-all duration-300 scale-95 animate-in zoom-in-95 duration-200 flex flex-col">
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

      {/* Reset Testing Confirmation Modal */}
      {resettingProduct && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="absolute inset-0" onClick={() => !resetting && setResettingProduct(null)} />

          <div className="bg-white border border-border-light rounded-2xl shadow-xl w-full max-w-md overflow-hidden relative z-10 transform transition-all duration-300 scale-95 animate-in zoom-in-95 duration-200 flex flex-col">
            <div className="px-5 py-4 border-b border-border-light flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 bg-accent/10 border border-accent/20 text-accent rounded-lg flex items-center justify-center">
                  <RotateCcw className="w-3.5 h-3.5" />
                </div>
                <h3 className="font-extrabold text-sm text-text-main tracking-tight">
                  Konfirmasi Reset Testing
                </h3>
              </div>
              <button
                onClick={() => setResettingProduct(null)}
                disabled={resetting}
                className="text-text-placeholder hover:text-text-muted p-1 rounded-lg hover:bg-bg-panel transition-all cursor-pointer disabled:opacity-50"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-center">
              <div className="mx-auto w-12 h-12 bg-accent/10 border border-accent/20 text-accent rounded-full flex items-center justify-center">
                <RotateCcw className="w-6 h-6 animate-spin-slow" />
              </div>
              <div className="space-y-1">
                <h4 className="font-bold text-xs text-text-main">
                  Reset siklus testing produk?
                </h4>
                <p className="text-[10px] text-text-placeholder px-4 leading-relaxed">
                  Apakah Anda yakin ingin mereset testing untuk produk <strong className="text-text-muted font-extrabold">{resettingProduct.product_name}</strong>? Tindakan ini akan mengosongkan jumlah konten terhitung untuk keperluan scoring (status produk akan kembali bersih seperti produk baru). Data riwayat postingan fisik di TikTok tidak akan dihapus.
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
                  onClick={() => setResettingProduct(null)}
                  disabled={resetting}
                  className="px-4 py-2 bg-bg border border-border-light hover:border-border-active text-text-muted rounded-lg text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleExecuteResetTesting}
                  disabled={resetting}
                  className="flex items-center gap-1.5 px-4 py-2 bg-accent hover:bg-accent/90 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer disabled:opacity-50 shadow-[0_2px_6px_rgba(var(--color-accent),0.15)]"
                >
                  {resetting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Mereset...</span>
                    </>
                  ) : (
                    "Ya, Reset Testing"
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
