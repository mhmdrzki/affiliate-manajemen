// /*
// Tujuan: Komponen Client berupa dialog modal premium untuk mengedit beberapa properti produk terpilih secara massal.
// Caller: components/products/ProductTable.tsx
// Dependensi: app/actions/products.ts, lucide-react, next/navigation (useRouter)
// Main Functions: BulkEditProductDialog
// Side Effects: Memanggil updateProductsBulkAction server action, melakukan refresh halaman secara client-side.
// */

"use client";

import React, { useState } from "react";
import { Edit, X, Loader2, Info } from "lucide-react";
import { updateProductsBulkAction } from "@/app/actions/products";
import { useRouter } from "next/navigation";

interface BulkEditProductDialogProps {
  selectedIds: string[];
  onSuccess: () => void;
}

export default function BulkEditProductDialog({ selectedIds, onSuccess }: BulkEditProductDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  // Field selection toggles (whether to update this field)
  const [updateStatus, setUpdateStatus] = useState(false);
  const [updateStockStatus, setUpdateStockStatus] = useState(false);
  const [updateCollab, setUpdateCollab] = useState(false);
  const [updateCategory, setUpdateCategory] = useState(false);

  // Field values
  const [status, setStatus] = useState<"active" | "paused" | "stopped">("active");
  const [stockStatus, setStockStatus] = useState<"available" | "out_of_stock" | "unknown">("available");
  const [isCollaboration, setIsCollaboration] = useState(false);
  const [collabTargetCount, setCollabTargetCount] = useState("");
  const [collabStartDate, setCollabStartDate] = useState("");
  const [collabDeadline, setCollabDeadline] = useState("");
  const [category, setCategory] = useState("Umum");

  const popularCategories = [
    "Umum",
    "Kecantikan",
    "Pakaian & Fashion",
    "Elektronik & Gadget",
    "Makanan & Minuman",
    "Rumah Tangga",
  ];

  const handleOpen = () => {
    // Reset selections and values
    setUpdateStatus(false);
    setUpdateStockStatus(false);
    setUpdateCollab(false);
    setUpdateCategory(false);

    setStatus("active");
    setStockStatus("available");
    setIsCollaboration(false);
    setCollabTargetCount("");
    setCollabStartDate("");
    setCollabDeadline("");
    setCategory("Umum");

    setError(null);
    setIsOpen(true);
  };

  const handleClose = () => {
    if (loading) return;
    setIsOpen(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!updateStatus && !updateStockStatus && !updateCollab && !updateCategory) {
      setError("Silakan pilih minimal satu kolom untuk diubah.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const updates: any = {};

      if (updateStatus) {
        updates.status = status;
      }
      if (updateStockStatus) {
        updates.stock_status = stockStatus;
      }
      if (updateCollab) {
        updates.is_collaboration = isCollaboration;
        if (isCollaboration) {
          updates.collab_target_count = collabTargetCount ? parseInt(collabTargetCount, 10) : null;
          updates.collab_start_date = collabStartDate || null;
          updates.collab_deadline = collabDeadline || null;
        }
      }
      if (updateCategory) {
        updates.category = category.trim();
      }

      const res = await updateProductsBulkAction(selectedIds, updates);

      if (res.success) {
        setIsOpen(false);
        onSuccess();
        router.refresh();
      } else {
        setError(res.message);
      }
    } catch (err: any) {
      setError(err.message || "Terjadi kesalahan saat memperbarui produk.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={handleOpen}
        className="flex items-center gap-1.5 bg-accent hover:bg-accent/90 text-white text-[10px] font-bold px-3 py-1.5 rounded-lg transition-all cursor-pointer shadow-sm shadow-accent/15"
      >
        <Edit className="w-3.5 h-3.5" />
        <span>Ubah {selectedIds.length} Terpilih</span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="absolute inset-0" onClick={handleClose} />

          <div className="bg-white border border-border-light rounded-2xl shadow-xl w-full max-w-lg overflow-hidden relative z-10 transform transition-all duration-300 scale-95 animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="px-5 py-4 border-b border-border-light flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 bg-accent/10 border border-accent/20 text-accent rounded-lg flex items-center justify-center">
                  <Edit className="w-3.5 h-3.5" />
                </div>
                <h3 className="font-extrabold text-sm text-text-main tracking-tight">
                  Ubah Massal ({selectedIds.length} Produk)
                </h3>
              </div>
              <button
                onClick={handleClose}
                disabled={loading}
                className="text-text-placeholder hover:text-text-muted p-1 rounded-lg hover:bg-bg-panel transition-all cursor-pointer disabled:opacity-50"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
              <div className="p-3 bg-bg-panel border border-border-light rounded-lg text-[10px] text-text-muted flex gap-2">
                <Info className="w-4 h-4 text-accent flex-shrink-0" />
                <span>
                  Centang kolom yang ingin diubah pada semua produk yang dipilih. Nilai kolom yang tidak dicentang tidak akan diubah.
                </span>
              </div>

              {error && (
                <div className="p-3 bg-danger-bg border border-danger-border text-danger text-[11px] rounded-lg font-semibold flex gap-2">
                  <Info className="w-4 h-4 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div className="space-y-4 divide-y divide-border-light">
                {/* 1. Status Kerjasama / Keaktifan */}
                <div className="pt-3 first:pt-0">
                  <label className="flex items-center gap-2 mb-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={updateStatus}
                      onChange={(e) => setUpdateStatus(e.target.checked)}
                      className="rounded text-accent focus:ring-accent w-4 h-4 border-border-light cursor-pointer"
                    />
                    <span className="text-xs font-bold text-text-main">Ubah Status (Aktif/Jeda/Berhenti)</span>
                  </label>
                  {updateStatus && (
                    <div className="pl-6 animate-in slide-in-from-top-1 duration-150">
                      <select
                        value={status}
                        onChange={(e) => setStatus(e.target.value as any)}
                        className="w-full text-xs bg-white border border-border-light focus:border-accent rounded-lg p-2 outline-none font-medium text-text-main"
                      >
                        <option value="active">Aktif</option>
                        <option value="paused">Jeda</option>
                        <option value="stopped">Berhenti</option>
                      </select>
                    </div>
                  )}
                </div>

                {/* 2. Status Stok */}
                <div className="pt-3">
                  <label className="flex items-center gap-2 mb-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={updateStockStatus}
                      onChange={(e) => setUpdateStockStatus(e.target.checked)}
                      className="rounded text-accent focus:ring-accent w-4 h-4 border-border-light cursor-pointer"
                    />
                    <span className="text-xs font-bold text-text-main">Ubah Status Stok</span>
                  </label>
                  {updateStockStatus && (
                    <div className="pl-6 animate-in slide-in-from-top-1 duration-150">
                      <select
                        value={stockStatus}
                        onChange={(e) => setStockStatus(e.target.value as any)}
                        className="w-full text-xs bg-white border border-border-light focus:border-accent rounded-lg p-2 outline-none font-medium text-text-main"
                      >
                        <option value="available">Tersedia (Ready Stock)</option>
                        <option value="out_of_stock">Habis (Out of Stock)</option>
                        <option value="unknown">Tidak Diketahui</option>
                      </select>
                    </div>
                  )}
                </div>

                {/* 3. Kerjasama Kampanye */}
                <div className="pt-3">
                  <label className="flex items-center gap-2 mb-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={updateCollab}
                      onChange={(e) => setUpdateCollab(e.target.checked)}
                      className="rounded text-accent focus:ring-accent w-4 h-4 border-border-light cursor-pointer"
                    />
                    <span className="text-xs font-bold text-text-main">Ubah Kerja Sama Afiliasi (Kolaborasi)</span>
                  </label>
                  {updateCollab && (
                    <div className="pl-6 space-y-3 animate-in slide-in-from-top-1 duration-150">
                      <div className="flex gap-4">
                        <label className="flex items-center gap-1.5 cursor-pointer text-xs text-text-muted">
                          <input
                            type="radio"
                            name="bulk_is_collaboration"
                            checked={isCollaboration === true}
                            onChange={() => setIsCollaboration(true)}
                            className="text-accent focus:ring-accent cursor-pointer"
                          />
                          <span>Ya (Kerjasama Khusus/Targeted)</span>
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer text-xs text-text-muted">
                          <input
                            type="radio"
                            name="bulk_is_collaboration"
                            checked={isCollaboration === false}
                            onChange={() => setIsCollaboration(false)}
                            className="text-accent focus:ring-accent cursor-pointer"
                          />
                          <span>Tidak (Bukan Kerjasama/Reguler)</span>
                        </label>
                      </div>

                      {isCollaboration && (
                        <div className="grid grid-cols-3 gap-3 p-3 bg-bg-panel border border-border-light rounded-lg animate-in fade-in duration-200">
                          <div>
                            <label className="block text-[9px] font-bold text-text-placeholder uppercase mb-1">
                              Target Posting
                            </label>
                            <input
                              type="number"
                              min="0"
                              placeholder="Contoh: 10"
                              value={collabTargetCount}
                              onChange={(e) => setCollabTargetCount(e.target.value)}
                              className="w-full text-xs bg-white border border-border-light focus:border-accent rounded-lg p-2 outline-none font-medium text-text-main"
                            />
                          </div>
                          <div>
                            <label className="block text-[9px] font-bold text-text-placeholder uppercase mb-1">
                              Tanggal Mulai
                            </label>
                            <input
                              type="date"
                              value={collabStartDate}
                              onChange={(e) => setCollabStartDate(e.target.value)}
                              className="w-full text-xs bg-white border border-border-light focus:border-accent rounded-lg p-2 outline-none font-medium text-text-main"
                            />
                          </div>
                          <div>
                            <label className="block text-[9px] font-bold text-text-placeholder uppercase mb-1">
                              Tanggal Selesai
                            </label>
                            <input
                              type="date"
                              value={collabDeadline}
                              onChange={(e) => setCollabDeadline(e.target.value)}
                              className="w-full text-xs bg-white border border-border-light focus:border-accent rounded-lg p-2 outline-none font-medium text-text-main"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* 4. Kategori */}
                <div className="pt-3">
                  <label className="flex items-center gap-2 mb-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={updateCategory}
                      onChange={(e) => setUpdateCategory(e.target.checked)}
                      className="rounded text-accent focus:ring-accent w-4 h-4 border-border-light cursor-pointer"
                    />
                    <span className="text-xs font-bold text-text-main">Ubah Kategori</span>
                  </label>
                  {updateCategory && (
                    <div className="pl-6 space-y-2 animate-in slide-in-from-top-1 duration-150">
                      <input
                        type="text"
                        placeholder="Kategori baru"
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                        className="w-full text-xs bg-white border border-border-light focus:border-accent rounded-lg p-2 outline-none font-semibold text-text-main"
                      />
                      <div className="flex flex-wrap gap-1">
                        {popularCategories.map((c) => (
                          <button
                            key={c}
                            type="button"
                            onClick={() => setCategory(c)}
                            className={`px-2 py-1 text-[9px] font-bold rounded-md border transition-all cursor-pointer ${
                              category === c
                                ? "bg-accent/10 border-accent/30 text-accent"
                                : "bg-white border-border-light hover:border-border-active text-text-placeholder hover:text-text-muted"
                            }`}
                          >
                            {c}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-4 flex gap-3 border-t border-border-light justify-end">
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={loading}
                  className="px-4 py-2 bg-bg border border-border-light hover:border-border-active text-text-muted rounded-lg text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex items-center gap-1.5 px-4 py-2 bg-accent hover:bg-accent/90 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer disabled:opacity-50 shadow-sm"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Menyimpan...</span>
                    </>
                  ) : (
                    "Terapkan Perubahan"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
