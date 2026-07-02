// /*
// Tujuan: Komponen Client berupa dialog modal premium dengan glassmorphic overlay untuk menambahkan data produk baru ke Supabase.
// Caller: app/(dashboard)/products/page.tsx (area header)
// Dependensi: app/actions/products.ts, lucide-react, next/navigation (useRouter)
// Main Functions: AddProductDialog
// Side Effects: Memanggil createProductAction server action, melakukan refresh halaman secara client-side setelah sukses.
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
  const [nama, setNama] = useState("");
  const [brand, setBrand] = useState("");
  const [jenis, setJenis] = useState("");
  const [harga, setHarga] = useState("");
  const [komisi, setKomisi] = useState("");
  const [kategori, setKategori] = useState("Umum");
  
  // New TikTok mapping & Collaboration states
  const [tiktokProductId, setTiktokProductId] = useState("");
  const [shopName, setShopName] = useState("");
  const [shopCode, setShopCode] = useState("");
  const [isKerjasama, setIsKerjasama] = useState(false);
  const [kerjasamaTarget, setKerjasamaTarget] = useState("");
  const [kerjasamaDeadline, setKerjasamaDeadline] = useState("");

  const popularCategories = [
    "Umum",
    "Kecantikan",
    "Pakaian & Fashion",
    "Elektronik & Gadget",
    "Makanan & Minuman",
    "Rumah Tangga",
  ];

  const handleOpen = () => {
    setNama("");
    setBrand("");
    setJenis("");
    setHarga("");
    setKomisi("");
    setKategori("Umum");
    setTiktokProductId("");
    setShopName("");
    setShopCode("");
    setIsKerjasama(false);
    setKerjasamaTarget("");
    setKerjasamaDeadline("");
    setError(null);
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
      const res = await createProductAction({
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
      setError(err.message || "Terjadi kesalahan saat menambah produk.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Trigger Button */}
      <button
        onClick={handleOpen}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-accent hover:bg-accent-hover text-white text-xs font-bold rounded-lg transition-all duration-150 cursor-pointer shadow-[0_2px_8px_rgba(99,102,241,0.25)] select-none focus:outline-none"
      >
        <Plus className="w-4 h-4" />
        <span>Tambah Produk Baru</span>
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

            {/* Form Content */}
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
              {error && (
                <div className="p-3 bg-danger-bg border border-danger-border text-danger text-[11px] rounded-lg font-semibold flex gap-2">
                  <Info className="w-4 h-4 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

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

              {/* Action Buttons */}
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
