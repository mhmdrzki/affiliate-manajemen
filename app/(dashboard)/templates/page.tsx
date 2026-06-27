// /*
// Tujuan: Halaman UI Bank Template interaktif untuk menampilkan, memfilter, menambahkan, dan menghapus template naskah naskah video (Hook, Proof, CTA) per-kategori.
// Caller: Route /templates
// Dependensi: components/layout/Topbar.tsx, app/actions/templates.ts, types/index.ts, components/templates/AddTemplateDialog.tsx, lucide-react
// Main Functions: TemplatesPage
// Side Effects: Mengambil data template dari database Supabase, menghapus template, mereset template ke default.
// */

"use client";

import React, { useState, useEffect } from "react";
import Topbar from "@/components/layout/Topbar";
import AddTemplateDialog from "@/components/templates/AddTemplateDialog";
import {
  getTemplatesAction,
  deleteTemplateAction,
  resetTemplatesToDefaultAction,
} from "@/app/actions/templates";
import { Template } from "@/types";
import { FileText, Trash2, AlertCircle, Loader2, RefreshCw } from "lucide-react";

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  
  // Filtering states
  const [activeTab, setActiveTab] = useState<"hook" | "proof" | "cta">("hook");
  const [selectedCategory, setSelectedCategory] = useState("Semua");

  const fetchTemplates = async () => {
    try {
      const data = await getTemplatesAction();
      setTemplates(data);
    } catch (err) {
      console.error("Gagal mengambil data template:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm("Apakah Anda yakin ingin menghapus template naskah ini?")) return;

    setActionLoading(true);
    try {
      const res = await deleteTemplateAction(id);
      if (res.success) {
        setTemplates((prev) => prev.filter((t) => t.id !== id));
      } else {
        alert(res.error || "Gagal menghapus template.");
      }
    } catch (err: any) {
      alert(err.message || "Terjadi kesalahan saat menghapus.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleResetDefaults = async () => {
    if (
      !confirm(
        "Peringatan: Aksi ini bersifat destruktif. Semua template saat ini akan DIBERSIHKAN dan di-reset ke template bawaan sistem (35+ naskah baru). Lanjutkan?"
      )
    ) {
      return;
    }

    setLoading(true);
    try {
      const res = await resetTemplatesToDefaultAction();
      if (res.success) {
        await fetchTemplates();
      } else {
        alert(res.error || "Gagal mereset template ke bawaan.");
      }
    } catch (err: any) {
      alert(err.message || "Terjadi kesalahan saat mereset.");
    } finally {
      setLoading(false);
    }
  };

  // Helper untuk menyoroti placeholder "[PRODUK]" secara premium
  const highlightProductTag = (text: string) => {
    const parts = text.split("[PRODUK]");
    return (
      <span>
        {parts.map((part, index) => (
          <React.Fragment key={index}>
            {part}
            {index < parts.length - 1 && (
              <span className="inline-flex px-1.5 py-0.5 rounded-md bg-accent/10 border border-accent/20 text-accent font-extrabold text-[10px] mx-0.5 select-all">
                [PRODUK]
              </span>
            )}
          </React.Fragment>
        ))}
      </span>
    );
  };

  // Dinamis menyusun daftar kategori yang ada
  const uniqueCategories = Array.from(
    new Set(templates.map((t) => t.kategori || "Umum"))
  ).filter(Boolean);

  // Filter templates berdasarkan tab aktif dan kategori
  const filteredTemplates = templates.filter((t) => {
    const matchTab = t.type === activeTab;
    const matchCategory =
      selectedCategory === "Semua" || t.kategori === selectedCategory;
    return matchTab && matchCategory;
  });

  return (
    <div className="flex-1 flex flex-col min-h-screen">
      <Topbar title="Bank Template Naskah" />

      <div className="p-6 space-y-6 flex-1 flex flex-col">
        {/* Layout Atas: Kontrol Navigasi & Aksi */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white border border-border-light rounded-xl p-4 shadow-sm">
          {/* Tab Selector */}
          <div className="flex items-center gap-1.5 bg-bg-panel border border-border-light rounded-lg p-1 select-none">
            {([
              { key: "hook", label: "Hook (Pembuka)" },
              { key: "proof", label: "Proof (Bukti)" },
              { key: "cta", label: "CTA (Aksi)" },
            ] as const).map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all duration-150 cursor-pointer ${
                  activeTab === tab.key
                    ? "bg-white text-text-main shadow-xs border border-border-light"
                    : "text-text-placeholder hover:text-text-muted"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Filters & Actions Area */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Category Filter */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-text-placeholder uppercase tracking-wider">
                Kategori:
              </span>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="text-xs px-2.5 py-1.5 bg-bg border border-border-light hover:border-border-active rounded-lg focus:outline-none cursor-pointer transition-colors"
              >
                <option value="Semua">Semua Kategori</option>
                {uniqueCategories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div className="w-px h-6 bg-border-light hidden md:block" />

            {/* Tambah Template Modal Dialog */}
            <AddTemplateDialog
              onSuccess={fetchTemplates}
              existingCategories={uniqueCategories}
            />

            {/* Reset ke Bawaan Button */}
            <button
              onClick={handleResetDefaults}
              disabled={loading || actionLoading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-danger-border hover:bg-danger-bg text-danger text-xs font-bold rounded-lg transition-all duration-150 cursor-pointer select-none disabled:opacity-50"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Reset ke Bawaan</span>
            </button>
          </div>
        </div>

        {/* Layout Tengah: Tampilan List/Grid Template */}
        {loading ? (
          <div className="flex-1 flex items-center justify-center py-20">
            <div className="text-center space-y-3">
              <Loader2 className="w-8 h-8 animate-spin text-accent mx-auto" />
              <p className="text-xs text-text-placeholder font-medium">
                Memuat data dari bank naskah...
              </p>
            </div>
          </div>
        ) : filteredTemplates.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredTemplates.map((t) => (
              <div
                key={t.id}
                className="bg-white border border-border-light hover:border-border-active rounded-xl p-4 shadow-sm hover:shadow transition-all duration-200 flex flex-col justify-between group relative min-h-[120px]"
              >
                {/* Text Content */}
                <p className="text-xs text-text-muted leading-relaxed font-medium select-text">
                  {highlightProductTag(t.content)}
                </p>

                {/* Bottom Card Area */}
                <div className="flex items-center justify-between mt-4 pt-3 border-t border-border-light/50">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold bg-bg-panel border border-border-light text-text-placeholder uppercase">
                    {t.kategori || "Umum"}
                  </span>

                  <button
                    onClick={() => handleDelete(t.id)}
                    disabled={actionLoading}
                    className="p-1.5 text-text-placeholder hover:text-danger hover:bg-danger-bg rounded-lg transition-all cursor-pointer opacity-0 group-hover:opacity-100 focus:opacity-100 disabled:opacity-50"
                    title="Hapus template naskah"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* Empty State */
          <div className="flex-1 flex flex-col items-center justify-center border border-dashed border-border-active rounded-2xl p-12 bg-white/50 text-center min-h-[300px]">
            <div className="w-16 h-16 bg-accent/10 border border-accent/25 rounded-2xl flex items-center justify-center text-accent mx-auto mb-4">
              <FileText className="w-8 h-8" />
            </div>
            <h3 className="font-extrabold text-base tracking-tight text-text-main">
              Tidak Ada Template Naskah
            </h3>
            <p className="text-xs text-text-placeholder mt-2 max-w-sm mx-auto leading-relaxed">
              Tidak ada data template dengan tipe <strong>{activeTab}</strong> di bawah kategori{" "}
              <strong>{selectedCategory}</strong>.
            </p>
            <div className="mt-6 flex gap-3">
              {templates.length === 0 && (
                <button
                  onClick={handleResetDefaults}
                  className="inline-flex items-center gap-1.5 py-2 px-4 bg-accent hover:bg-accent-hover text-white rounded-lg text-xs font-bold transition-all duration-150 cursor-pointer shadow-sm"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Reset Default Naskah Bawaan</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
