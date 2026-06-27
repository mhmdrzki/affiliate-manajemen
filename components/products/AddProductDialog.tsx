// /*
// Tujuan: Komponen Client berupa dialog modal premium dengan glassmorphic overlay untuk menambahkan data produk baru ke Supabase.
// Caller: app/(dashboard)/products/page.tsx (area header)
// Dependensi: app/actions/products.ts, lucide-react, next/navigation (useRouter)
// Main Functions: AddProductDialog
// Side Effects: Memanggil createProductAction server action, melakukan refresh halaman secara client-side setelah sukses.
// */

"use client";

import React, { useState } from "react";
import { Plus, X, Loader2, Info } from "lucide-react";
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
          <div className="bg-white border border-border-light rounded-2xl shadow-xl w-full max-w-md overflow-hidden relative z-10 transform transition-all duration-300 scale-95 animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
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
                    Komisi (Rp)
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="13900"
                    value={komisi}
                    onChange={(e) => setKomisi(e.target.value)}
                    className="w-full text-xs px-3 py-2 bg-bg border border-border-light focus:border-accent rounded-lg focus:outline-none transition-colors font-mono"
                  />
                </div>
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
