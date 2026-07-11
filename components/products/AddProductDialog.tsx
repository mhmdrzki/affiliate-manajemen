// /*
// Tujuan: Komponen Client modal dialog premium untuk menambahkan produk baru sesuai skema database yang diperbarui.
// Caller: app/(dashboard)/products/page.tsx
// Dependensi: app/actions/products.ts, lucide-react, next/navigation (useRouter)
// Main Functions: AddProductDialog
// Side Effects: Memanggil createProductAction server action dan me-refresh router.
// */

"use client";

import React, { useState } from "react";
import { Plus, X, Loader2, Info, HelpCircle } from "lucide-react";
import { createProductAction } from "@/app/actions/products";
import { useRouter } from "next/navigation";

export default function AddProductDialog() {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  // Form States
  const [productName, setProductName] = useState("");
  const [shopName, setShopName] = useState("");
  const [shopCode, setShopCode] = useState("");
  const [category, setCategory] = useState("Umum");
  const [stockStatus, setStockStatus] = useState<"available" | "out_of_stock" | "unknown">("available");
  const [tiktokProductId, setTiktokProductId] = useState("");
  
  // Collaboration Program
  const [isCollaboration, setIsCollaboration] = useState(false);
  const [collabTargetCount, setCollabTargetCount] = useState("");
  const [collabDeadline, setCollabDeadline] = useState("");
  const [collabStartDate, setCollabStartDate] = useState("");

  const popularCategories = [
    "Umum",
    "Kecantikan",
    "Pakaian & Fashion",
    "Elektronik & Gadget",
    "Makanan & Minuman",
    "Rumah Tangga",
  ];

  const handleOpen = () => {
    setProductName("");
    setShopName("");
    setShopCode("");
    setCategory("Umum");
    setStockStatus("available");
    setTiktokProductId("");
    setIsCollaboration(false);
    setCollabTargetCount("");
    setCollabDeadline("");
    setCollabStartDate("");
    setError(null);
    setIsOpen(true);
  };

  const handleClose = () => {
    if (loading) return;
    setIsOpen(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productName.trim()) {
      setError("Nama produk wajib diisi.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await createProductAction({
        product_name: productName.trim(),
        shop_name: shopName.trim() || null,
        shop_code: shopCode.trim() || null,
        category: category.trim() || "Umum",
        stock_status: stockStatus,
        is_collaboration: isCollaboration,
        collab_target_count: isCollaboration ? (parseInt(collabTargetCount) || 0) : null,
        collab_deadline: isCollaboration && collabDeadline ? new Date(collabDeadline).toISOString().split("T")[0] : null,
        collab_start_date: isCollaboration && collabStartDate ? new Date(collabStartDate).toISOString().split("T")[0] : null,
        status: "active",
        tiktok_product_id: tiktokProductId.trim() || null,
      });

      if (res.success) {
        setIsOpen(false);
        router.refresh();
      } else {
        setError(res.message);
      }
    } catch (err: any) {
      setError(err.message || "Terjadi kesalahan saat menambah produk.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={handleOpen}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-accent hover:bg-accent-hover text-white text-xs font-bold rounded-lg transition-all duration-150 cursor-pointer shadow-[0_2px_8px_rgba(99,102,241,0.25)] select-none focus:outline-none"
      >
        <Plus className="w-4 h-4" />
        <span>Tambah Produk Baru</span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="absolute inset-0" onClick={handleClose} />

          <div className="bg-white border border-border-light rounded-2xl shadow-xl w-full max-w-lg overflow-hidden relative z-10 transform transition-all duration-300 scale-95 animate-in zoom-in-95 duration-200 flex flex-col max-h-[95vh]">
            <div className="px-5 py-4 border-b border-border-light flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 bg-accent/10 border border-accent/20 text-accent rounded-lg flex items-center justify-center">
                  <Plus className="w-4 h-4" />
                </div>
                <h3 className="font-extrabold text-sm text-text-main tracking-tight">
                  Tambah Produk Baru
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

            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
              {error && (
                <div className="p-3 bg-danger-bg border border-danger-border text-danger text-[11px] rounded-lg font-semibold flex gap-2">
                  <Info className="w-4 h-4 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold text-text-placeholder uppercase tracking-wider">
                  Nama Produk <span className="text-danger">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Skintific 5X Ceramide Barrier Moisture Gel"
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-bg border border-border-light focus:border-accent rounded-lg focus:outline-none transition-colors"
                />
              </div>

              <div className="p-3.5 bg-bg-panel border border-border-light rounded-xl space-y-3">
                <h4 className="text-[10px] font-bold text-text-muted uppercase tracking-wider flex items-center gap-1">
                  <span>TikTok Shop Mapping & Toko</span>
                  <span title="Untuk sinkronisasi otomatis data rekap pesanan TikTok">
                    <HelpCircle className="w-3 h-3 text-text-placeholder" />
                  </span>
                </h4>
                
                <div className="space-y-1.5">
                  <label className="block text-[9px] font-bold text-text-placeholder uppercase">
                    TikTok Product ID
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: 1730353572051453257"
                    value={tiktokProductId}
                    onChange={(e) => setTiktokProductId(e.target.value)}
                    className="w-full text-xs px-3 py-2 bg-white border border-border-light focus:border-accent rounded-lg focus:outline-none transition-colors font-mono"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="block text-[9px] font-bold text-text-placeholder uppercase">
                      Nama Toko / Seller
                    </label>
                    <input
                      type="text"
                      placeholder="MSGLOWFORMEN"
                      value={shopName}
                      onChange={(e) => setShopName(e.target.value)}
                      className="w-full text-xs px-3 py-2 bg-white border border-border-light focus:border-accent rounded-lg focus:outline-none transition-colors"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-[9px] font-bold text-text-placeholder uppercase">
                      Kode Toko
                    </label>
                    <input
                      type="text"
                      placeholder="IDLCH3LWQ9"
                      value={shopCode}
                      onChange={(e) => setShopCode(e.target.value)}
                      className="w-full text-xs px-3 py-2 bg-white border border-border-light focus:border-accent rounded-lg focus:outline-none transition-colors font-mono"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold text-text-placeholder uppercase tracking-wider">
                  Status Ketersediaan Stok
                </label>
                <select
                  value={stockStatus}
                  onChange={(e) => setStockStatus(e.target.value as any)}
                  className="w-full text-xs px-2.5 py-2 bg-bg border border-border-light focus:border-accent rounded-lg focus:outline-none cursor-pointer"
                >
                  <option value="available">Tersedia (Available)</option>
                  <option value="out_of_stock">Habis (Out of Stock)</option>
                  <option value="unknown">Tidak Diketahui (Unknown)</option>
                </select>
              </div>

              <div className="p-3.5 bg-purple-50/50 border border-purple-100 rounded-xl space-y-3">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={isCollaboration}
                    onChange={(e) => setIsCollaboration(e.target.checked)}
                    className="rounded text-purple-600 focus:ring-purple-500 w-4 h-4 border-purple-200"
                  />
                  <span className="text-[10px] font-bold text-purple-950 uppercase tracking-wider">Program Kerjasama Konten</span>
                </label>

                {isCollaboration && (
                  <div className="space-y-3 pt-1 animate-in slide-in-from-top-1 duration-150">
                    <div className="grid grid-cols-3 gap-2.5">
                      <div className="space-y-1.5 col-span-1">
                        <label className="block text-[9px] font-bold text-purple-900 uppercase">
                          Target Video
                        </label>
                        <input
                          type="number"
                          min="1"
                          placeholder="3"
                          required={isCollaboration}
                          value={collabTargetCount}
                          onChange={(e) => setCollabTargetCount(e.target.value)}
                          className="w-full text-xs px-2.5 py-2 bg-white border border-purple-200 focus:border-purple-500 rounded-lg focus:outline-none transition-colors font-mono text-purple-950"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="block text-[9px] font-bold text-purple-900 uppercase">
                          Tanggal Mulai
                        </label>
                        <input
                          type="date"
                          value={collabStartDate}
                          onChange={(e) => setCollabStartDate(e.target.value)}
                          className="w-full text-xs px-2 py-2 bg-white border border-purple-200 focus:border-purple-500 rounded-lg focus:outline-none transition-colors font-mono text-purple-950"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="block text-[9px] font-bold text-purple-900 uppercase">
                          Deadline
                        </label>
                        <input
                          type="date"
                          required={isCollaboration}
                          value={collabDeadline}
                          onChange={(e) => setCollabDeadline(e.target.value)}
                          className="w-full text-xs px-2 py-2 bg-white border border-purple-200 focus:border-purple-500 rounded-lg focus:outline-none transition-colors font-mono text-purple-950"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold text-text-placeholder uppercase tracking-wider">
                  Kategori
                </label>
                <input
                  type="text"
                  placeholder="Kategori Produk"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-bg border border-border-light focus:border-accent rounded-lg focus:outline-none transition-colors"
                />
                
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {popularCategories.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setCategory(cat)}
                      className={`text-[9px] font-bold px-2 py-0.5 rounded-full border transition-all duration-150 cursor-pointer ${
                        category === cat
                          ? "bg-accent-hover/10 border-accent text-accent"
                          : "bg-bg-panel border-border-light text-text-placeholder hover:text-text-muted hover:border-border-active"
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-4 border-t border-border-light flex gap-3 justify-end">
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
                  className="flex items-center gap-1.5 px-4 py-2 bg-accent hover:bg-accent-hover text-white rounded-lg text-xs font-bold transition-colors cursor-pointer disabled:opacity-50 shadow-[0_2px_6px_rgba(99,102,241,0.15)]"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Menyimpan...</span>
                    </>
                  ) : (
                    "Simpan Produk"
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
