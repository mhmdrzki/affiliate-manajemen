// /*
// Tujuan: Komponen Client berupa dialog modal premium dengan glassmorphic overlay untuk mengedit detail produk dan menghapus produk.
// Caller: app/(dashboard)/products/page.tsx (tiap baris tabel)
// Dependensi: app/actions/products.ts, lucide-react, next/navigation (useRouter), types/index.ts
// Main Functions: EditProductDialog
// Side Effects: Memanggil updateProductAction dan deleteProductAction server actions, melakukan refresh halaman secara client-side setelah sukses.
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
  const [nama, setNama] = useState(product.nama);
  const [brand, setBrand] = useState(product.brand || "");
  const [jenis, setJenis] = useState(product.jenis || "");
  const [harga, setHarga] = useState(product.harga.toString());
  const [komisi, setKomisi] = useState(product.komisi.toString());
  const [kategori, setKategori] = useState(product.kategori || "Umum");
  
  // New TikTok mapping & Collaboration states
  const [tiktokProductId, setTiktokProductId] = useState(product.tiktok_product_id || "");
  const [shopName, setShopName] = useState(product.shop_name || "");
  const [shopCode, setShopCode] = useState(product.shop_code || "");
  const [isKerjasama, setIsKerjasama] = useState(product.is_kerjasama || false);
  const [kerjasamaTarget, setKerjasamaTarget] = useState(product.kerjasama_target?.toString() || "");
  const [kerjasamaDeadline, setKerjasamaDeadline] = useState("");

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
    setNama(product.nama);
    setBrand(product.brand || "");
    setJenis(product.jenis || "");
    setHarga(product.harga.toString());
    setKomisi(product.komisi.toString());
    setKategori(product.kategori || "Umum");
    setTiktokProductId(product.tiktok_product_id || "");
    setShopName(product.shop_name || "");
    setShopCode(product.shop_code || "");
    setIsKerjasama(product.is_kerjasama || false);
    setKerjasamaTarget(product.kerjasama_target?.toString() || "");
    
    if (product.kerjasama_deadline) {
      const date = new Date(product.kerjasama_deadline);
      setKerjasamaDeadline(date.toISOString().split("T")[0]);
    } else {
      setKerjasamaDeadline("");
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
    if (!nama.trim()) {
      setError("Nama produk wajib diisi.");
      return;
    }

    const priceNum = parseInt(harga) || 0;
    const commNum = parseInt(komisi) || 0;

    if (priceNum < 0 || commNum < 0) {
      setError("Harga dan komisi tidak boleh bernilai negatif.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await updateProductAction(product.id, {
        nama,
        brand,
        jenis,
        harga: priceNum,
        komisi: commNum,
        kategori,
        tiktok_product_id: tiktokProductId || null,
        shop_name: shopName || null,
        shop_code: shopCode || null,
        is_kerjasama: isKerjasama,
        kerjasama_target: isKerjasama ? (parseInt(kerjasamaTarget) || 0) : 0,
        kerjasama_deadline: isKerjasama && kerjasamaDeadline ? new Date(kerjasamaDeadline).toISOString() : null
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
      const res = await deleteProductAction(product.id);

      if (res.success) {
        setIsOpen(false);
        router.refresh();
      } else {
        setError(res.message);
      }
    } catch (err: any) {
      setError(err.message || "Terjadi kesalahan saat menghapus produk.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Trigger Button (Edit Icon) */}
      <button
        onClick={handleOpen}
        className="w-7 h-7 bg-bg border border-border-light hover:border-border-active hover:bg-bg-panel text-text-muted hover:text-text-main rounded-lg flex items-center justify-center transition-all cursor-pointer focus:outline-none"
        title="Edit Produk"
      >
        <Edit3 className="w-3.5 h-3.5" />
      </button>

      {/* Modal Overlay */}
      {isOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          {/* Backdrop Click */}
          <div className="absolute inset-0" onClick={handleClose} />

          {/* Modal Container */}
          <div className="bg-white border border-border-light rounded-2xl shadow-xl w-full max-w-lg overflow-hidden relative z-10 transform transition-all duration-300 scale-95 animate-in zoom-in-95 duration-200 flex flex-col max-h-[95vh]">
            {/* Header */}
            <div className="px-5 py-4 border-b border-border-light flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 bg-accent/10 border border-accent/20 text-accent rounded-lg flex items-center justify-center">
                  <Edit3 className="w-3.5 h-3.5" />
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

            {/* Form Content / Delete Confirmation View */}
            <div className="flex-1 overflow-y-auto p-5">
              {error && (
                <div className="p-3 mb-4 bg-danger-bg border border-danger-border text-danger text-[11px] rounded-lg font-semibold flex gap-2">
                  <Info className="w-4 h-4 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {showDeleteConfirm ? (
                /* Delete Confirmation View */
                <div className="space-y-4 py-4 text-center animate-in fade-in duration-200">
                  <div className="mx-auto w-12 h-12 bg-danger-bg border border-danger-border text-danger rounded-full flex items-center justify-center">
                    <AlertTriangle className="w-6 h-6 animate-bounce" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="font-bold text-xs text-text-main">
                      Hapus Produk "{product.nama}"?
                    </h4>
                    <p className="text-[10px] text-text-placeholder px-4 leading-relaxed">
                      Apakah Anda yakin? Tindakan ini akan menghapus produk secara permanen. Seluruh relasi video analitik terkait akan dinonaktifkan referensinya (diatur menjadi Kosong).
                    </p>
                  </div>

                  <div className="pt-4 flex gap-3 justify-center">
                    <button
                      type="button"
                      onClick={() => setShowDeleteConfirm(false)}
                      disabled={loading}
                      className="px-4 py-2 bg-bg border border-border-light hover:border-border-active text-text-muted rounded-lg text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
                    >
                      Batal
                    </button>
                    <button
                      type="button"
                      onClick={handleDelete}
                      disabled={loading}
                      className="flex items-center gap-1.5 px-4 py-2 bg-danger hover:bg-danger/90 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Menghapus...</span>
                        </>
                      ) : (
                        "Ya, Hapus Sekarang"
                      )}
                    </button>
                  </div>
                </div>
              ) : (
                /* Edit Product Form View */
                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* Input: Nama Produk */}
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-bold text-text-placeholder uppercase tracking-wider">
                      Nama Produk <span className="text-danger">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Contoh: Skintific 5X Ceramide Barrier Moisture Gel"
                      value={nama}
                      onChange={(e) => setNama(e.target.value)}
                      className="w-full text-xs px-3 py-2 bg-bg border border-border-light focus:border-accent rounded-lg focus:outline-none transition-colors"
                    />
                  </div>

                  {/* SECTION: TikTok Mapping */}
                  <div className="p-3.5 bg-bg-panel border border-border-light rounded-xl space-y-3">
                    <h4 className="text-[10px] font-bold text-text-muted uppercase tracking-wider flex items-center gap-1">
                      <span>TikTok Shop Mapping</span>
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

                  {/* Grid 2 Column (Brand & Jenis) */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="block text-[10px] font-bold text-text-placeholder uppercase tracking-wider">
                        Brand / Merek
                      </label>
                      <input
                        type="text"
                        placeholder="Skintific"
                        value={brand}
                        onChange={(e) => setBrand(e.target.value)}
                        className="w-full text-xs px-3 py-2 bg-bg border border-border-light focus:border-accent rounded-lg focus:outline-none transition-colors"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-[10px] font-bold text-text-placeholder uppercase tracking-wider">
                        Jenis Barang
                      </label>
                      <input
                        type="text"
                        placeholder="Moisturizer"
                        value={jenis}
                        onChange={(e) => setJenis(e.target.value)}
                        className="w-full text-xs px-3 py-2 bg-bg border border-border-light focus:border-accent rounded-lg focus:outline-none transition-colors"
                      />
                    </div>
                  </div>

                  {/* Grid 2 Column (Harga & Komisi) */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="block text-[10px] font-bold text-text-placeholder uppercase tracking-wider">
                        Harga Jual (Rp)
                      </label>
                      <input
                        type="number"
                        min="0"
                        placeholder="139000"
                        value={harga}
                        onChange={(e) => setHarga(e.target.value)}
                        className="w-full text-xs px-3 py-2 bg-bg border border-border-light focus:border-accent rounded-lg focus:outline-none transition-colors font-mono"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-[10px] font-bold text-text-placeholder uppercase tracking-wider">
                        Komisi (%)
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        placeholder="10"
                        value={komisi}
                        onChange={(e) => setKomisi(e.target.value)}
                        className="w-full text-xs px-3 py-2 bg-bg border border-border-light focus:border-accent rounded-lg focus:outline-none transition-colors font-mono"
                      />
                    </div>
                  </div>

                  {/* SECTION: Program Kerjasama / Sponsor */}
                  <div className="p-3.5 bg-purple-50/50 border border-purple-100 rounded-xl space-y-3">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={isKerjasama}
                        onChange={(e) => setIsKerjasama(e.target.checked)}
                        className="rounded text-purple-600 focus:ring-purple-500 w-4 h-4 border-purple-200"
                      />
                      <span className="text-[10px] font-bold text-purple-950 uppercase tracking-wider">Program Kerjasama Konten</span>
                    </label>

                    {isKerjasama && (
                      <div className="grid grid-cols-2 gap-3 pt-1 animate-in slide-in-from-top-1 duration-150">
                        <div className="space-y-1.5">
                          <label className="block text-[9px] font-bold text-purple-900 uppercase">
                            Target Posting (Video)
                          </label>
                          <input
                            type="number"
                            min="1"
                            placeholder="3"
                            required={isKerjasama}
                            value={kerjasamaTarget}
                            onChange={(e) => setKerjasamaTarget(e.target.value)}
                            className="w-full text-xs px-3 py-2 bg-white border border-purple-200 focus:border-purple-500 rounded-lg focus:outline-none transition-colors font-mono text-purple-950"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="block text-[9px] font-bold text-purple-900 uppercase">
                            Tanggal Deadline
                          </label>
                          <input
                            type="date"
                            required={isKerjasama}
                            value={kerjasamaDeadline}
                            onChange={(e) => setKerjasamaDeadline(e.target.value)}
                            className="w-full text-xs px-3 py-2 bg-white border border-purple-200 focus:border-purple-500 rounded-lg focus:outline-none transition-colors font-mono text-purple-950"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Input: Kategori */}
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-bold text-text-placeholder uppercase tracking-wider">
                      Kategori
                    </label>
                    <input
                      type="text"
                      placeholder="Kategori Produk"
                      value={kategori}
                      onChange={(e) => setKategori(e.target.value)}
                      className="w-full text-xs px-3 py-2 bg-bg border border-border-light focus:border-accent rounded-lg focus:outline-none transition-colors"
                    />

                    {/* Popular Tags Quick Select */}
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {popularCategories.map((cat) => (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => setKategori(cat)}
                          className={`text-[9px] font-bold px-2 py-0.5 rounded-full border transition-all duration-150 cursor-pointer ${
                            kategori === cat
                              ? "bg-accent-hover/10 border-accent text-accent"
                              : "bg-bg-panel border-border-light text-text-placeholder hover:text-text-muted hover:border-border-active"
                          }`}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Action Buttons with Delete Option */}
                  <div className="pt-4 border-t border-border-light flex justify-between items-center">
                    {/* Delete Trigger */}
                    <button
                      type="button"
                      onClick={() => setShowDeleteConfirm(true)}
                      disabled={loading}
                      className="inline-flex items-center gap-1 text-danger hover:text-white border border-danger/25 hover:border-danger hover:bg-danger px-3 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Hapus</span>
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
                        className="flex items-center gap-1.5 px-4 py-2 bg-accent hover:bg-accent-hover text-white rounded-lg text-xs font-bold transition-colors cursor-pointer disabled:opacity-50 shadow-[0_2px_6px_rgba(99,102,241,0.15)]"
                      >
                        {loading ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Menyimpan...</span>
                          </>
                        ) : (
                          "Simpan"
                        )}
                      </button>
                    </div>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
