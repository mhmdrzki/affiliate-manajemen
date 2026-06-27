"use client";

// /*
// Tujuan: Halaman UI Migrasi Data untuk memuat file cadangan JSON dari AffiliateOS v2.5 (localStorage) dan mengimpornya ke database Supabase.
// Caller: Route /migrate
// Dependensi: app/actions/migrate.ts, lucide-react, components/layout/Topbar.tsx
// Main Functions: MigratePage
// Side Effects: Mengunggah file JSON, menjalankan Server Action migrasi database, memperbarui state tampilan.
// */

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { migrateLegacyDataAction } from "@/app/actions/migrate";
import Topbar from "@/components/layout/Topbar";
import { Database, Upload, AlertCircle, CheckCircle2, Loader2, ArrowRight } from "lucide-react";

export default function MigratePage() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    productsCount: number;
    contentsCount: number;
    snapshotsCount: number;
    templatesCount: number;
    message: string;
  } | null>(null);
  
  const router = useRouter();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const f = e.target.files[0];
      if (f.type !== "application/json" && !f.name.endsWith(".json")) {
        setError("File harus berupa berkas cadangan JSON (.json).");
        setFile(null);
        return;
      }
      setFile(f);
      setError(null);
      setResult(null);
    }
  };

  const handleMigration = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    setResult(null);

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const text = e.target?.result as string;
        const legacyData = JSON.parse(text);

        // Validasi struktur schema dasar V2.5
        if (!legacyData.products || !legacyData.contents) {
          throw new Error("Struktur berkas JSON tidak valid. Pastikan ini adalah cadangan dari AffiliateOS.");
        }

        const res = await migrateLegacyDataAction(legacyData);

        if (res.success) {
          setResult({
            productsCount: res.productsCount,
            contentsCount: res.contentsCount,
            snapshotsCount: res.snapshotsCount,
            templatesCount: res.templatesCount,
            message: res.message,
          });
          setFile(null);
        } else {
          setError(res.message);
        }
      } catch (err: any) {
        setError(err.message || "Gagal memproses file JSON migrasi.");
      } finally {
        setLoading(false);
      }
    };

    reader.readAsText(file);
  };

  return (
    <div className="flex-1 flex flex-col min-h-screen">
      <Topbar title="Migrasi Data Legacy (v2.5)" />

      <div className="p-6 max-w-xl mx-auto w-full space-y-6">
        <div className="bg-white border border-border-light rounded-xl p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-accent/10 border border-accent/25 rounded-lg flex items-center justify-center text-accent">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm tracking-tight text-text-main">
                Alat Migrasi Satu Arah
              </h3>
              <p className="text-[11px] text-text-placeholder mt-0.5">
                Impor semua data produk, riwayat video, dan template naskah dari localStorage versi v2.5 Anda.
              </p>
            </div>
          </div>

          <div className="border-t border-border-light pt-4 space-y-3">
            <div className="bg-warning-bg border border-warning-border text-warning text-xs p-3 rounded-lg flex gap-2.5 leading-relaxed font-medium">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>
                <strong>Peringatan Cut-Over</strong>: Proses migrasi akan menghapus seluruh data produk lokal Anda yang terhubung dengan akun ini di database baru ini agar tidak terjadi tumpang tindih data.
              </span>
            </div>

            {/* Drag & Drop Zone */}
            <div className="border-2 border-dashed border-border-active hover:border-accent rounded-xl p-8 text-center bg-bg-panel hover:bg-accent/5 transition-all relative">
              <input
                type="file"
                accept=".json"
                onChange={handleFileChange}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                disabled={loading}
              />
              <Upload className="w-8 h-8 text-text-placeholder mx-auto mb-3" />
              <div className="text-xs font-bold text-text-main">
                {file ? file.name : "Pilih atau Seret file JSON cadangan Anda"}
              </div>
              <div className="text-[10px] text-text-placeholder mt-1.5">
                Hanya menerima file format JSON (.json)
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="p-3 bg-danger-bg border border-danger-border text-danger text-xs rounded-lg font-medium">
                ⚠️ {error}
              </div>
            )}

            {/* Success Result Panel */}
            {result && (
              <div className="p-4 bg-success-bg border border-success-border text-success text-xs rounded-xl space-y-2">
                <div className="flex items-center gap-2 font-bold text-sm">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Migrasi Berhasil</span>
                </div>
                <p className="text-[11px] font-medium leading-relaxed">
                  {result.message}
                </p>
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-success-border/30 text-[10px] font-bold">
                  <div>✓ Produk: {result.productsCount}</div>
                  <div>✓ Riwayat Video: {result.contentsCount}</div>
                  <div>✓ Snapshots: {result.snapshotsCount}</div>
                  <div>✓ Template Naskah: {result.templatesCount}</div>
                </div>
                <button
                  onClick={() => router.push("/")}
                  className="mt-3 w-full flex items-center justify-center gap-1.5 py-1.5 px-3 bg-success text-white hover:bg-emerald-700 rounded-lg text-[10px] font-bold transition-all duration-150 cursor-pointer"
                >
                  <span>Masuk Dashboard</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            )}

            {/* Action Button */}
            <button
              onClick={handleMigration}
              disabled={!file || loading}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-accent hover:bg-accent-hover text-white rounded-lg text-xs font-bold transition-all duration-150 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Mengeksekusi Migrasi Database...</span>
                </>
              ) : (
                "Eksekusi Migrasi Sekarang"
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
