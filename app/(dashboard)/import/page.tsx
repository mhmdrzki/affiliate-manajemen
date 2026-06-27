"use client";

// /*
// Tujuan: Halaman UI Impor Data untuk mengunggah file XLSX/CSV analitik video TikTok Shop dan memprosesnya secara server-side.
// Caller: Route /import
// Dependensi: app/actions/import.ts, xlsx, components/layout/Topbar.tsx, lib/utils/format.ts
// Main Functions: ImportPage
// Side Effects: Membaca file biner Excel/CSV via FileReader, memanggil Server Action impor, mengalihkan rute dashboard.
// */

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import * as XLSX from "xlsx";
import { importAnalyticsAction } from "@/app/actions/import";
import Topbar from "@/components/layout/Topbar";
import { Upload, AlertCircle, CheckCircle2, Loader2, ArrowRight } from "lucide-react";

export default function ImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    added: number;
    merged: number;
    skipped: number;
    message: string;
  } | null>(null);

  const router = useRouter();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const f = e.target.files[0];
      const ext = f.name.split(".").pop()?.toLowerCase();
      if (ext !== "xlsx" && ext !== "xls" && ext !== "csv") {
        setError("File harus berupa berkas lembar kerja Excel (.xlsx, .xls) atau CSV.");
        setFile(null);
        return;
      }
      setFile(f);
      setError(null);
      setResult(null);
    }
  };

  const handleImport = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    setResult(null);

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const dataBytes = e.target?.result;
        let rows: any[] = [];

        if (file.name.toLowerCase().endsWith(".csv")) {
          const text = new TextDecoder().decode(dataBytes as ArrayBuffer);
          rows = parseCSV(text);
        } else {
          const wb = XLSX.read(dataBytes, { type: "array" });
          const sheetName = wb.SheetNames[0];
          rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { defval: "" });
        }
        const sanitizedRows = JSON.parse(JSON.stringify(rows));
        const res = await importAnalyticsAction(sanitizedRows, file.name);

        if (res.success) {
          setResult({
            added: res.added,
            merged: res.merged,
            skipped: res.skipped,
            message: res.message,
          });
          setFile(null);
        } else {
          setError(res.message);
        }
      } catch (err: any) {
        setError(err.message || "Gagal memproses file impor data.");
      } finally {
        setLoading(false);
      }
    };

    reader.readAsArrayBuffer(file);
  };

  // Helper parser CSV
  const parseCSV = (text: string) => {
    const lines = text.split("\n").filter((l) => l.trim());
    if (!lines.length) return [];
    const headers = lines[0].split(",").map((h) => h.replace(/"/g, "").trim());
    return lines.slice(1).map((line) => {
      const vals: string[] = [];
      let cur = "";
      let inQ = false;
      for (const ch of line) {
        if (ch === '"') {
          inQ = !inQ;
        } else if (ch === "," && !inQ) {
          vals.push(cur.trim());
          cur = "";
        } else cur += ch;
      }
      vals.push(cur.trim());
      const row: Record<string, string> = {};
      headers.forEach((h, i) => (row[h] = (vals[i] || "").replace(/^"|"$/g, "").trim()));
      return row;
    });
  };

  return (
    <div className="flex-1 flex flex-col min-h-screen">
      <Topbar title="Impor Data Analitik" />

      <div className="p-6 max-w-xl mx-auto w-full space-y-6">
        <div className="bg-white border border-border-light rounded-xl p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-accent/10 border border-accent/25 rounded-lg flex items-center justify-center text-accent">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm tracking-tight text-text-main">
                Unggah File Rekap TikTok
              </h3>
              <p className="text-[11px] text-text-placeholder mt-0.5">
                Unggah file Excel hasil ekspor laporan analitik video TikTok Shop Anda.
              </p>
            </div>
          </div>

          <div className="border-t border-border-light pt-4 space-y-3">
            <div className="bg-info-bg border border-info-border text-info text-xs p-3 rounded-lg flex gap-2.5 leading-relaxed font-medium">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>
                <strong>Format Tabel Fleksibel</strong>: Aplikasi otomatis mencocokkan kolom nama produk, views, sold, ctr, ctor, durasi, dan tanggal upload secara dinamis.
              </span>
            </div>

            {/* File Drag Zone */}
            <div className="border-2 border-dashed border-border-active hover:border-accent rounded-xl p-8 text-center bg-bg-panel hover:bg-accent/5 transition-all relative">
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileChange}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                disabled={loading}
              />
              <Upload className="w-8 h-8 text-text-placeholder mx-auto mb-3" />
              <div className="text-xs font-bold text-text-main">
                {file ? file.name : "Pilih atau Seret file Excel/CSV analitik Anda"}
              </div>
              <div className="text-[10px] text-text-placeholder mt-1.5">
                Mendukung .xlsx, .xls, atau .csv
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
                  <span>Impor Selesai</span>
                </div>
                <p className="text-[11px] font-medium leading-relaxed">
                  {result.message}
                </p>
                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-success-border/30 text-[10px] font-bold text-center">
                  <div>✓ Konten Baru: {result.added}</div>
                  <div>✓ Digabungkan: {result.merged}</div>
                  <div>✓ Dilompati: {result.skipped}</div>
                </div>
                <button
                  onClick={() => router.push("/")}
                  className="mt-3 w-full flex items-center justify-center gap-1.5 py-1.5 px-3 bg-success text-white hover:bg-emerald-700 rounded-lg text-[10px] font-bold transition-all duration-150 cursor-pointer"
                >
                  <span>Lihat Hasil Dashboard</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            )}

            {/* Action Button */}
            <button
              onClick={handleImport}
              disabled={!file || loading}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-accent hover:bg-accent-hover text-white rounded-lg text-xs font-bold transition-all duration-150 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Memproses data lembar kerja...</span>
                </>
              ) : (
                "Eksekusi Impor Data"
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
