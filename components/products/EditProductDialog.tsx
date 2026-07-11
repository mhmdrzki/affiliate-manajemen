// /*
// Tujuan: Komponen Client berupa dialog modal premium untuk mengedit detail produk dan menghapus produk sesuai skema baru.
// Caller: app/(dashboard)/products/page.tsx (tiap baris tabel)
// Dependensi: app/actions/products.ts, lucide-react, next/navigation (useRouter), types/index.ts
// Main Functions: EditProductDialog
// Side Effects: Memanggil updateProductAction dan deleteProductAction server actions, melakukan refresh halaman secara client-side.
// */

"use client";

import React, { useState } from "react";
import { Edit3, X, Loader2, Info, Trash2, AlertTriangle, HelpCircle } from "lucide-react";
import { updateProductAction, deleteProductAction } from "@/app/actions/products";
import { useRouter } from "next/navigation";
import { Product } from "@/types";

interface EditProductDialogProps {
  product: Product;
}

export default function EditProductDialog({ product }: EditProductDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  // Form States pre-filled with existing product data
  const [productName, setProductName] = useState(product.product_name);
  const [shopName, setShopName] = useState(product.shop_name || "");
  const [shopCode, setShopCode] = useState(product.shop_code || "");
  const [category, setCategory] = useState(product.category || "Umum");
  const [stockStatus, setStockStatus] = useState<"available" | "out_of_stock" | "unknown">(product.stock_status || "available");
  const [tiktokProductId, setTiktokProductId] = useState(product.product_id || "");
  
  // Collaboration Program & notes
  const [isCollaboration, setIsCollaboration] = useState(product.is_collaboration || false);
  const [collabTargetCount, setCollabTargetCount] = useState(product.collab_target_count?.toString() || "");
  const [collabDeadline, setCollabDeadline] = useState("");
  const [collabStartDate, setCollabStartDate] = useState("");
  const [status, setStatus] = useState<"active" | "paused" | "stopped">(product.status || "active");

  // Delete Confirmation States
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const popularCategories = [
    "Umum",
    "Kecantikan",
    "Pakaian & Fashion",
    "Elektronik & Gadget",
    "Makanan & Minuman",
    "Rumah Tangga",
  ];

  const handleOpen = () => {
    setProductName(product.product_name);
    setShopName(product.shop_name || "");
    setShopCode(product.shop_code || "");
    setCategory(product.category || "Umum");
    setStockStatus(product.stock_status || "available");
    setTiktokProductId(product.product_id || "");
    setIsCollaboration(product.is_collaboration || false);
    setCollabTargetCount(product.collab_target_count?.toString() || "");
    setStatus(product.status || "active");
    
    if (product.collab_deadline) {
      const date = new Date(product.collab_deadline);
      setCollabDeadline(date.toISOString().split("T")[0]);
    } else {
      setCollabDeadline("");
    }

    if (product.collab_start_date) {
      const date = new Date(product.collab_start_date);
      setCollabStartDate(date.toISOString().split("T")[0]);
    } else {
      setCollabStartDate("");
    }
    
    setError(null);
    setShowDeleteConfirm(false);
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
      const res = await updateProductAction(product.product_id, {
        product_name: productName.trim(),
        shop_name: shopName.trim() || null,
        shop_code: shopCode.trim() || null,
        category: category.trim() || "Umum",
        stock_status: stockStatus,
        is_collaboration: isCollaboration,
        collab_target_count: isCollaboration ? (parseInt(collabTargetCount) || 0) : null,
        collab_deadline: isCollaboration && collabDeadline ? new Date(collabDeadline).toISOString().split("T")[0] : null,
        collab_start_date: isCollaboration && collabStartDate ? new Date(collabStartDate).toISOString().split("T")[0] : null,
        status: status,
        tiktok_product_id: tiktokProductId.trim() || null,
      });

      if (res.success) {
        setIsOpen(false);
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

  const handleDelete = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await deleteProductAction(product.product_id);
      if (res.success) {
        setIsOpen(false);
        router.refresh();
      } else {
        setError(res.message);
        setShowDeleteConfirm(false);
      }
    } catch (err: any) {
      setError(err.message || "Terjadi kesalahan saat menghapus produk.");
      setShowDeleteConfirm(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={handleOpen}
        className="p-1.5 hover:bg-bg border border-border-light hover:border-border-active rounded-lg text-text-placeholder hover:text-text-muted transition-colors cursor-pointer"
        title="Edit Detail Produk"
      >
        <Edit3 className="w-3.5 h-3.5" />
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="absolute inset-0" onClick={handleClose} />

          <div className="bg-white border border-border-light rounded-2xl shadow-xl w-full max-w-lg overflow-hidden relative z-10 transform transition-all duration-300 scale-95 animate-in zoom-in-95 duration-200 flex flex-col max-h-[95vh]">
            <div className="px-5 py-4 border-b border-border-light flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 bg-accent/10 border border-accent/20 text-accent rounded-lg flex items-center justify-center">
                  <Edit3 className="w-4 h-4" />
                </div>
                <h3 className="font-extrabold text-sm text-text-main tracking-tight">
                  Edit Detail Produk
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

            {showDeleteConfirm ? (
              <div className="p-6 flex-1 flex flex-col justify-center items-center text-center space-y-4">
                <div className="w-12 h-12 bg-danger-bg border border-danger-border text-danger rounded-full flex items-center justify-center">
                  <AlertTriangle className="w-6 h-6 animate-bounce" />
                </div>
                <div>
                  <h4 className="font-extrabold text-sm text-text-main">Hapus Produk Ini?</h4>
                  <p className="text-[11px] text-text-placeholder mt-2 leading-relaxed max-w-sm">
                    Tindakan ini permanen. Produk <strong>{product.product_name}</strong> beserta seluruh riwayat performa & mapping TikTok akan dihapus dari database lokal.
                  </p>
                </div>
                <div className="flex gap-3 w-full max-w-xs pt-2">
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    disabled={loading}
                    className="flex-1 py-2 bg-bg border border-border-light text-text-muted rounded-lg text-xs font-bold transition-colors cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={loading}
                    className="flex-1 flex items-center justify-center gap-1 py-2 bg-danger hover:bg-danger/90 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer shadow-sm disabled:opacity-50"
                  >
                    {loading ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <>
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Hapus</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            ) : (
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

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-bold text-text-placeholder uppercase tracking-wider">
                      Status Kerjasama
                    </label>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value as any)}
                      className="w-full text-xs px-2.5 py-2 bg-bg border border-border-light focus:border-accent rounded-lg focus:outline-none cursor-pointer"
                    >
                      <option value="active">Aktif (Active)</option>
                      <option value="paused">Jeda (Paused)</option>
                      <option value="stopped">Berhenti (Stopped)</option>
                    </select>
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
                        <div className="space-y-1.5">
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

                <div className="pt-4 border-t border-border-light flex gap-3 justify-between items-center">
                  <button
                    type="button"
                    onClick={() => setShowDeleteConfirm(true)}
                    className="flex items-center gap-1 text-danger hover:text-danger/80 border border-transparent hover:border-danger-border/30 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Hapus Produk</span>
                  </button>

                  <div className="flex gap-3">
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
                      className="flex items-center gap-1.5 px-4 py-2 bg-accent hover:bg-accent-hover text-white rounded-lg text-xs font-bold transition-colors cursor-pointer disabled:opacity-50 shadow-sm"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Menyimpan...</span>
                        </>
                      ) : (
                        "Simpan Perubahan"
                      )}
                    </button>
                  </div>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
