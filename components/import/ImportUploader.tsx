// /*
// Tujuan: Komponen Client untuk mengunggah file spreadsheet orders (XLSX/CSV) dan menampilkan preview sebelum diimpor.
// Caller: app/(dashboard)/import/page.tsx
// Dependensi: app/actions/import-orders.ts, xlsx, lucide-react, next/navigation (useRouter)
// Main Functions: ImportUploader
// Side Effects: Membaca file lembar kerja via FileReader, memanggil importAffiliateOrdersAction server action.
// */

"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import * as XLSX from "xlsx";
import { importAffiliateOrdersAction } from "@/app/actions/import-orders";
import { Upload, AlertCircle, CheckCircle2, Loader2, ArrowRight, FileSpreadsheet, TrendingUp, ShoppingBag } from "lucide-react";
import { parseTikTokNumber, parseTikTokDate } from "@/lib/utils/excel";

interface ImportUploaderProps {
  onSuccessAction?: () => void;
}

export default function ImportUploader({ onSuccessAction }: ImportUploaderProps) {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{
    totalRows: number;
    validRows: number;
    ineligibleRows: number;
    uniqueProducts: number;
    uniqueVideos: number;
    totalGmv: number;
    minDate: string;
    maxDate: string;
    rowsData: any[];
  } | null>(null);

  const [result, setResult] = useState<{
    inserted: number;
    updated: number;
    skipped: number;
    skippedIneligible: number;
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
        setPreview(null);
        return;
      }
      setFile(f);
      setError(null);
      setResult(null);

      // Generate preview client-side
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const dataBytes = e.target?.result;
          let rows: any[] = [];

          if (f.name.toLowerCase().endsWith(".csv")) {
            const text = new TextDecoder().decode(dataBytes as ArrayBuffer);
            rows = parseCSV(text);
          } else {
            const wb = XLSX.read(dataBytes, { type: "array" });
            const sheetName = wb.SheetNames[0];
            rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { defval: "" });
          }

          // Parse and summarize
          let valid = 0;
          let ineligible = 0;
          const products = new Set<string>();
          const videos = new Set<string>();
          let gmvSum = 0;
          let minD = 9999999999999;
          let maxD = 0;

          rows.forEach((row: any) => {
            const orderId = String(row["Order ID"] || "").trim();
            if (!orderId || orderId.toLowerCase() === "order id") return;

            const status = String(row["Order settlement status"] || "").trim();
            if (status === "Ineligible") {
              ineligible++;
              return;
            }

            valid++;
            const pId = String(row["Product ID"] || "").trim();
            const cId = String(row["Content ID"] || "").trim();
            if (pId) products.add(pId);
            if (cId) videos.add(cId);

            gmvSum += parseTikTokNumber(row["GMV"]);

            const dateStr = String(row["Order date"] || "").trim();
            const dateIso = parseTikTokDate(dateStr);
            if (dateIso) {
              const ts = new Date(dateIso).getTime();
              if (ts < minD) minD = ts;
              if (ts > maxD) maxD = ts;
            }
          });

          setPreview({
            totalRows: rows.length,
            validRows: valid,
            ineligibleRows: ineligible,
            uniqueProducts: products.size,
            uniqueVideos: videos.size,
            totalGmv: gmvSum,
            minDate: minD === 9999999999999 ? "—" : new Date(minD).toLocaleDateString("id-ID"),
            maxDate: maxD === 0 ? "—" : new Date(maxD).toLocaleDateString("id-ID"),
            rowsData: rows
          });
        } catch (err: any) {
          setError("Gagal membaca preview file: " + err.message);
        }
      };
      reader.readAsArrayBuffer(f);
    }
  };

  const handleImport = async () => {
    if (!file || !preview) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const sanitizedRows = JSON.parse(JSON.stringify(preview.rowsData));
      const res = await importAffiliateOrdersAction(sanitizedRows, file.name);

      if (res.success) {
        setResult({
          inserted: res.inserted,
          updated: res.updated,
          skipped: res.skipped,
          skippedIneligible: res.skippedIneligible,
          message: res.message,
        });
        setFile(null);
        setPreview(null);
        if (onSuccessAction) {
          onSuccessAction();
        }
      } else {
        setError(res.message);
      }
    } catch (err: any) {
      setError(err.message || "Gagal memproses file impor data.");
    } finally {
      setLoading(false);
    }
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
    <div className="bg-white border border-border-light rounded-xl p-6 shadow-sm space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-accent/10 border border-accent/25 rounded-lg flex items-center justify-center text-accent">
          <Upload className="w-5 h-5" />
        </div>
        <div>
          <h3 className="font-extrabold text-sm tracking-tight text-text-main">
            Unggah File Affiliate Orders TikTok
          </h3>
          <p className="text-[11px] text-text-placeholder mt-0.5">
            Download file dari TikTok Shop Analytics (Pesanan Afiliasi) dan upload ke sini.
          </p>
        </div>
      </div>

      <div className="border-t border-border-light pt-4 space-y-3">
        <div className="bg-info-bg border border-info-border text-info text-xs p-3 rounded-lg flex gap-2.5 leading-relaxed font-medium">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>
            <strong>Instruksi Penting:</strong> Ekspor data pesanan afiliasi dari TikTok Shop Creator Center. Format file berkolom <em>Order ID, Product ID, Standard (komisi), GMV</em>, dll. Kolom <strong>Ineligible</strong> akan otomatis dilewati oleh sistem.
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
            {file ? file.name : "Pilih atau Seret file Excel rekap pesanan TikTok Anda"}
          </div>
          <div className="text-[10px] text-text-placeholder mt-1.5">
            Mendukung .xlsx, .xls, atau .csv
          </div>
        </div>

        {/* Preview Panel client-side sebelum di-submit */}
        {preview && (
          <div className="p-4 bg-bg border border-border-light rounded-xl space-y-3">
            <div className="flex items-center gap-2 font-bold text-xs text-text-main pb-2 border-b border-border-light">
              <FileSpreadsheet className="w-4 h-4 text-accent" />
              <span>Preview File: {file?.name}</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
              <div className="bg-white border border-border-light p-2.5 rounded-lg">
                <div className="text-[10px] font-bold text-text-placeholder uppercase">Total Orders</div>
                <div className="text-sm font-extrabold text-text-main mt-0.5">{preview.validRows}</div>
                <div className="text-[9px] text-text-placeholder mt-0.5">{preview.ineligibleRows} ineligible skipped</div>
              </div>
              <div className="bg-white border border-border-light p-2.5 rounded-lg">
                <div className="text-[10px] font-bold text-text-placeholder uppercase">Produk Unik</div>
                <div className="text-sm font-extrabold text-text-main mt-0.5 flex items-center justify-center gap-1">
                  <ShoppingBag className="w-3.5 h-3.5 text-accent" />
                  <span>{preview.uniqueProducts}</span>
                </div>
              </div>
              <div className="bg-white border border-border-light p-2.5 rounded-lg">
                <div className="text-[10px] font-bold text-text-placeholder uppercase">Total GMV</div>
                <div className="text-sm font-extrabold text-success mt-0.5 flex items-center justify-center gap-0.5">
                  <TrendingUp className="w-3.5 h-3.5 text-success" />
                  <span>Rp{preview.totalGmv.toLocaleString("id-ID")}</span>
                </div>
              </div>
              <div className="bg-white border border-border-light p-2.5 rounded-lg">
                <div className="text-[10px] font-bold text-text-placeholder uppercase">Rentang Tanggal</div>
                <div className="text-[10px] font-bold text-text-main mt-1 leading-snug">
                  {preview.minDate}<br/>s/d {preview.maxDate}
                </div>
              </div>
            </div>
          </div>
        )}

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
              <span>Impor Sukses</span>
            </div>
            <p className="text-[11px] font-medium leading-relaxed">
              {result.message}
            </p>
            <div className="grid grid-cols-4 gap-2 pt-2 border-t border-success-border/30 text-[9px] font-bold text-center">
              <div className="bg-white/40 p-1.5 rounded">Baru: {result.inserted}</div>
              <div className="bg-white/40 p-1.5 rounded">Status Update: {result.updated}</div>
              <div className="bg-white/40 p-1.5 rounded">Duplikat: {result.skipped}</div>
              <div className="bg-white/40 p-1.5 rounded text-danger">Ineligible: {result.skippedIneligible}</div>
            </div>
            <button
              onClick={() => router.push("/")}
              className="mt-3 w-full flex items-center justify-center gap-1.5 py-2 px-3 bg-success text-white hover:bg-emerald-700 rounded-lg text-xs font-bold transition-all duration-150 cursor-pointer shadow-sm"
            >
              <span>Lihat Hasil Dashboard</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        )}

        {/* Action Button */}
        <button
          onClick={handleImport}
          disabled={!file || !preview || loading}
          className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-accent hover:bg-accent-hover text-white rounded-lg text-xs font-bold transition-all duration-150 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Memproses data lembar kerja...</span>
            </>
          ) : (
            "Eksekusi Impor Data Pesanan"
          )}
        </button>
      </div>
    </div>
  );
}
