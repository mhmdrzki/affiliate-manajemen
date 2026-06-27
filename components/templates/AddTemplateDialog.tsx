// /*
// Tujuan: Komponen Client berupa dialog modal premium dengan glassmorphic overlay untuk menambahkan template naskah baru (Hook, Proof, CTA).
// Caller: app/(dashboard)/templates/page.tsx (area kontrol atas)
// Dependensi: app/actions/templates.ts, lucide-react, next/navigation (useRouter)
// Main Functions: AddTemplateDialog
// Side Effects: Memanggil addTemplateAction server action, melakukan refresh router setelah sukses.
// */

"use client";

import React, { useState } from "react";
import { Plus, X, Loader2, Info } from "lucide-react";
import { addTemplateAction } from "@/app/actions/templates";
import { useRouter } from "next/navigation";

interface AddTemplateDialogProps {
  onSuccess?: () => void;
  existingCategories?: string[];
}

export default function AddTemplateDialog({
  onSuccess,
  existingCategories = ["Umum"],
}: AddTemplateDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  // Form States
  const [content, setContent] = useState("");
  const [type, setType] = useState<"hook" | "proof" | "cta">("hook");
  const [kategori, setKategori] = useState("Umum");

  const handleOpen = () => {
    setContent("");
    setType("hook");
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
    if (!content.trim()) {
      setError("Isi template naskah wajib ditulis.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await addTemplateAction(type, content.trim(), kategori.trim() || "Umum");

      if (res.success) {
        setIsOpen(false);
        router.refresh();
        if (onSuccess) onSuccess();
      } else {
        setError(res.error || "Gagal menyimpan template.");
      }
    } catch (err: any) {
      setError(err.message || "Terjadi kesalahan saat menyimpan template.");
    } finally {
      setLoading(false);
    }
  };

  // Get unique list of categories for quick select tags, limit to 6 popular ones
  const categoriesList = Array.from(
    new Set(["Umum", ...existingCategories])
  ).slice(0, 6);

  return (
    <>
      {/* Trigger Button */}
      <button
        onClick={handleOpen}
        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-accent hover:bg-accent-hover text-white text-xs font-bold rounded-lg transition-all duration-150 cursor-pointer shadow-[0_2px_8px_rgba(99,102,241,0.25)] select-none focus:outline-none"
      >
        <Plus className="w-4 h-4" />
        <span>Tambah Template</span>
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
                  Tambah Template Naskah
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

              {/* Input: Tipe Template */}
              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold text-text-placeholder uppercase tracking-wider">
                  Tipe Template
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(["hook", "proof", "cta"] as const).map((t) => {
                    const active = type === t;
                    const labels = { hook: "Hook (Pembuka)", proof: "Proof (Bukti)", cta: "CTA (Aksi)" };
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setType(t)}
                        className={`py-2 px-1 text-[10px] font-bold rounded-lg border text-center transition-all duration-150 cursor-pointer capitalize ${
                          active
                            ? "bg-accent border-accent text-white shadow-sm"
                            : "bg-bg-panel border-border-light text-text-placeholder hover:text-text-muted hover:border-border-active"
                        }`}
                      >
                        {labels[t]}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Input: Konten Template */}
              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold text-text-placeholder uppercase tracking-wider">
                  Isi Naskah Template <span className="text-danger">*</span>
                </label>
                <textarea
                  required
                  rows={4}
                  placeholder="Contoh: Gue capek banget cobain [PRODUK] abal-abal, akhirnya nemu yang beneran worth it!"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-bg border border-border-light focus:border-accent rounded-lg focus:outline-none transition-colors resize-none leading-relaxed"
                />
                <p className="text-[9px] text-text-placeholder flex items-start gap-1 leading-normal">
                  <Info className="w-3.5 h-3.5 flex-shrink-0 text-accent mt-0.5" />
                  <span>TIPS: Masukkan placeholder <strong>[PRODUK]</strong> untuk diisi otomatis dengan nama produk saat generator jadwal berjalan.</span>
                </p>
              </div>

              {/* Input: Kategori */}
              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold text-text-placeholder uppercase tracking-wider">
                  Kategori
                </label>
                <input
                  type="text"
                  placeholder="Kategori Template"
                  value={kategori}
                  onChange={(e) => setKategori(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-bg border border-border-light focus:border-accent rounded-lg focus:outline-none transition-colors"
                />
                
                {/* Popular Tags Quick Select */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {categoriesList.map((cat) => (
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
                    "Simpan Template"
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
