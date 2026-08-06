// /*
// Tujuan: Komponen Client berupa dialog modal premium untuk mengimpor data master produk dari berkas CSV/XLSX atau paste URL produk TikTok Shop.
// Caller: components/products/ProductTable.tsx
// Dependensi: app/actions/import-products.ts, xlsx, lucide-react, next/navigation (useRouter)
// Main Functions: ImportProductDialog, extractProductID, extractProductName, isShortLink
// Side Effects: Membaca berkas/URL di browser, memanggil importProductsAction Server Action, me-refresh halaman.
// */

"use client";

import React, { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import * as XLSX from "xlsx";
import {
  Upload,
  X,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Info,
  FileSpreadsheet,
  Link as LinkIcon,
  Search,
  Trash2,
} from "lucide-react";
import { importProductsAction, ImportedProductInput } from "@/app/actions/import-products";

// --- Helper Extract Logics dari TikTok Extractor ---
function extractProductID(url: string): string | null {
  const patterns = [
    /tokopedia\.com\/view\/product\/(\d+)/i,
    /shop-id\.tokopedia\.com\/view\/product\/(\d+)/i,
    /tiktok\.com\/view\/product\/(\d+)/i,
    /tiktok\.com\/product\/(\d+)/i,
    /item_id=(\d+)/i,
    /product_id=(\d+)/i,
    /\/product\/(\d{10,})/i,
    /\/(\d{15,})(?:[?&/]|$)/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

function decodeProductName(raw: string): string {
  try {
    return decodeURIComponent(raw.replace(/\+/g, " "));
  } catch (e) {
    return raw.replace(/\+/g, " ");
  }
}

function extractProductName(url: string): string | null {
  try {
    const ogMatch = url.match(/[?&]og_info=([^&]*)/);
    if (ogMatch) {
      const decoded = decodeProductName(ogMatch[1]);
      const parsed = JSON.parse(decoded);
      if (parsed.title) return parsed.title;
    }
  } catch (e) {}

  try {
    const u = new URL(url);
    const ogRaw = u.searchParams.get("og_info");
    if (ogRaw) {
      const fixed = ogRaw.replace(/\+/g, " ");
      const parsed = JSON.parse(fixed);
      if (parsed.title) return parsed.title;
    }
  } catch (e) {}

  try {
    const titleMatch = url.match(/[?&]title=([^&]+)/i);
    if (titleMatch) return decodeProductName(titleMatch[1]);
    const nameMatch = url.match(/[?&]name=([^&]+)/i);
    if (nameMatch) return decodeProductName(nameMatch[1]);
  } catch (e) {}

  return null;
}

function isShortLink(url: string): boolean {
  return /vt\.tiktok\.com|vm\.tiktok\.com|vt\.tokopedia\.com|shp\.ee/.test(url);
}

export default function ImportProductDialog() {
  const [isOpen, setIsOpen] = useState(false);
  const [importMode, setImportMode] = useState<"file" | "url">("file");
  
  // State mode file
  const [file, setFile] = useState<File | null>(null);

  // State mode URL
  const [urlInput, setUrlInput] = useState<string>("");

  // Shared states
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewProducts, setPreviewProducts] = useState<ImportedProductInput[] | null>(null);
  const [summary, setSummary] = useState<{
    total: number;
    valid: number;
    duplicatesInFile: number;
  } | null>(null);

  const [result, setResult] = useState<{
    success: boolean;
    insertedCount: number;
    skippedCount: number;
    message: string;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const handleOpen = () => {
    setFile(null);
    setUrlInput("");
    setError(null);
    setPreviewProducts(null);
    setSummary(null);
    setResult(null);
    setImportMode("file");
    setIsOpen(true);
  };

  const handleClose = () => {
    if (loading) return;
    setIsOpen(false);
  };

  // Parser CSV
  const parseCSV = (text: string): Record<string, string>[] => {
    let cleanText = text;
    if (cleanText.charCodeAt(0) === 0xfeff) {
      cleanText = cleanText.substring(1);
    }

    const linesForDetection = cleanText.split("\n").filter((l) => l.trim());
    if (!linesForDetection.length) return [];

    const firstLine = linesForDetection[0];
    const commaCount = (firstLine.match(/,/g) || []).length;
    const semiCount = (firstLine.match(/;/g) || []).length;
    const delimiter = semiCount > commaCount ? ";" : ",";

    const rows: string[][] = [];
    let currentRow: string[] = [];
    let currentField = "";
    let insideQuotes = false;

    for (let i = 0; i < cleanText.length; i++) {
      const char = cleanText[i];
      const nextChar = cleanText[i + 1];

      if (char === '"') {
        if (insideQuotes && nextChar === '"') {
          currentField += '"';
          i++;
        } else {
          insideQuotes = !insideQuotes;
        }
      } else if (char === delimiter && !insideQuotes) {
        currentRow.push(currentField.trim());
        currentField = "";
      } else if ((char === "\n" || char === "\r") && !insideQuotes) {
        if (char === "\r" && nextChar === "\n") {
          i++;
        }
        currentRow.push(currentField.trim());
        if (currentRow.length > 1 || (currentRow.length === 1 && currentRow[0] !== "")) {
          rows.push(currentRow);
        }
        currentRow = [];
        currentField = "";
      } else {
        currentField += char;
      }
    }

    if (currentField || currentRow.length > 0) {
      currentRow.push(currentField.trim());
      rows.push(currentRow);
    }

    if (rows.length === 0) return [];

    const headers = rows[0].map((h) => h.replace(/^"|"$/g, "").trim());
    return rows.slice(1).map((lineVals) => {
      const row: Record<string, string> = {};
      headers.forEach((h, idx) => {
        row[h] = (lineVals[idx] || "").replace(/^"|"$/g, "").trim();
      });
      return row;
    });
  };

  const processImportData = (rows: Record<string, string>[]) => {
    if (rows.length === 0) {
      setError("File kosong atau tidak berisi data produk.");
      return;
    }

    const keys = Object.keys(rows[0]);
    const productIdKey = keys.find((k) => {
      const lk = k.toLowerCase().trim();
      return (
        lk === "product id" ||
        lk === "product_id" ||
        lk === "id produk" ||
        lk === "id" ||
        lk === "productid"
      );
    });

    const productNameKey = keys.find((k) => {
      const lk = k.toLowerCase().trim();
      return (
        lk === "nama produk" ||
        lk === "product name" ||
        lk === "product_name" ||
        lk === "nama" ||
        lk === "name" ||
        lk === "productname"
      );
    });

    const categoryKey = keys.find((k) => {
      const lk = k.toLowerCase().trim();
      return lk === "category" || lk === "kategori";
    });

    const shopNameKey = keys.find((k) => {
      const lk = k.toLowerCase().trim();
      return (
        lk === "shop name" ||
        lk === "shop_name" ||
        lk === "nama toko" ||
        lk === "toko" ||
        lk === "shopname"
      );
    });

    const shopCodeKey = keys.find((k) => {
      const lk = k.toLowerCase().trim();
      return (
        lk === "shop code" ||
        lk === "shop_code" ||
        lk === "kode toko" ||
        lk === "shopcode"
      );
    });

    if (!productIdKey || !productNameKey) {
      setError(
        `Kolom 'Product ID' atau 'Nama Produk' tidak ditemukan dalam file. Kolom yang terdeteksi: ${keys.join(", ")}`
      );
      return;
    }

    const productsMap = new Map<string, ImportedProductInput>();
    let duplicates = 0;

    const mapped = rows
      .map((r) => {
        const pid = String(r[productIdKey] || "").replace(/^'|'$/g, "").trim();
        const pname = String(r[productNameKey] || "").trim();
        return {
          product_id: pid,
          product_name: pname,
          category: categoryKey ? String(r[categoryKey] || "").trim() : "Umum",
          shop_name: shopNameKey ? String(r[shopNameKey] || "").trim() : undefined,
          shop_code: shopCodeKey ? String(r[shopCodeKey] || "").trim() : undefined,
        };
      })
      .filter((p) => p.product_id !== "" && p.product_name !== "");

    mapped.forEach((item) => {
      if (productsMap.has(item.product_id)) {
        duplicates++;
      } else {
        productsMap.set(item.product_id, item);
      }
    });

    const finalProducts = Array.from(productsMap.values());

    setPreviewProducts(finalProducts);
    setSummary({
      total: rows.length,
      valid: finalProducts.length,
      duplicatesInFile: duplicates,
    });
    setError(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const f = e.target.files[0];
      const ext = f.name.split(".").pop()?.toLowerCase();
      if (ext !== "xlsx" && ext !== "xls" && ext !== "csv") {
        setError("Format file tidak didukung. Unggah file .csv, .xlsx, atau .xls.");
        return;
      }
      setFile(f);
      setError(null);
      setResult(null);

      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const dataBytes = evt.target?.result;
          let parsedRows: Record<string, string>[] = [];

          if (f.name.toLowerCase().endsWith(".csv")) {
            const text = new TextDecoder().decode(dataBytes as ArrayBuffer);
            parsedRows = parseCSV(text);
          } else {
            const wb = XLSX.read(dataBytes, { type: "array" });
            const sheetName = wb.SheetNames[0];
            parsedRows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { defval: "" });
          }

          processImportData(parsedRows);
        } catch (err: any) {
          setError("Gagal memproses file: " + err.message);
        }
      };
      reader.readAsArrayBuffer(f);
    }
  };

  // Handler ekstraksi URL TikTok
  const handleExtractUrls = () => {
    const lines = urlInput
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (lines.length === 0) {
      setError("Masukkan setidaknya 1 link produk TikTok.");
      return;
    }

    let countShort = 0;
    let countFail = 0;
    let duplicates = 0;

    const productsMap = new Map<string, ImportedProductInput>();

    lines.forEach((url) => {
      const pid = extractProductID(url);
      const name = pid ? extractProductName(url) : null;
      const short = !pid && isShortLink(url);

      if (short) countShort++;
      if (!pid && !short) countFail++;

      if (pid) {
        const item: ImportedProductInput = {
          product_id: pid,
          product_name: name || `Produk TikTok (${pid})`,
          category: "TikTok Shop",
        };

        if (productsMap.has(pid)) {
          duplicates++;
        } else {
          productsMap.set(pid, item);
        }
      }
    });

    const finalProducts = Array.from(productsMap.values());

    if (finalProducts.length === 0) {
      if (countShort > 0) {
        setError(
          `Terdeteksi ${countShort} link pendek. Buka link tersebut di browser HP/PC, lalu salin URL panjang dari address bar.`
        );
      } else {
        setError("Tidak dapat menemukan Product ID dari link yang dimasukkan. Pastikan Anda menyalin URL panjang produk TikTok Shop.");
      }
      return;
    }

    setPreviewProducts(finalProducts);
    setSummary({
      total: lines.length,
      valid: finalProducts.length,
      duplicatesInFile: duplicates,
    });
    setError(null);
  };

  const executeImport = async () => {
    if (!previewProducts || previewProducts.length === 0) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await importProductsAction(previewProducts);
      if (res.success) {
        setResult({
          success: true,
          insertedCount: res.insertedCount,
          skippedCount: res.skippedCount,
          message: res.message,
        });
        setPreviewProducts(null);
        setSummary(null);
        setFile(null);
        setUrlInput("");
        router.refresh();
      } else {
        setError(res.message);
      }
    } catch (err: any) {
      setError(err.message || "Gagal mengimpor produk.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={handleOpen}
        className="flex items-center gap-1.5 bg-white hover:bg-bg-panel text-text-muted border border-border-light hover:border-border-active text-xs font-bold px-3 py-2 rounded-lg transition-all cursor-pointer shadow-sm select-none"
      >
        <Upload className="w-3.5 h-3.5 text-text-placeholder" />
        <span>Impor Produk</span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="absolute inset-0" onClick={handleClose} />

          <div className="bg-white border border-border-light rounded-2xl shadow-xl w-full max-w-lg overflow-hidden relative z-10 transform transition-all duration-300 scale-95 animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="px-5 py-4 border-b border-border-light flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 bg-accent/10 border border-accent/20 text-accent rounded-lg flex items-center justify-center">
                  <Upload className="w-4 h-4" />
                </div>
                <h3 className="font-extrabold text-sm text-text-main tracking-tight">
                  Impor Master Produk
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

            {/* Sub-Header Tabs */}
            {!previewProducts && !result && (
              <div className="px-5 pt-3 border-b border-border-light bg-bg-panel flex gap-4 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => {
                    setImportMode("file");
                    setError(null);
                  }}
                  className={`pb-2.5 flex items-center gap-1.5 border-b-2 transition-all cursor-pointer ${
                    importMode === "file"
                      ? "border-accent text-accent"
                      : "border-transparent text-text-placeholder hover:text-text-muted"
                  }`}
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>Berkas CSV / Excel</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setImportMode("url");
                    setError(null);
                  }}
                  className={`pb-2.5 flex items-center gap-1.5 border-b-2 transition-all cursor-pointer ${
                    importMode === "url"
                      ? "border-accent text-accent"
                      : "border-transparent text-text-placeholder hover:text-text-muted"
                  }`}
                >
                  <LinkIcon className="w-3.5 h-3.5" />
                  <span>Paste Link TikTok</span>
                </button>
              </div>
            )}

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {error && (
                <div className="p-3 bg-danger-bg border border-danger-border text-danger text-[11px] rounded-lg font-semibold flex gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {result && (
                <div className="p-4 bg-success-bg border border-success-border text-success rounded-xl space-y-2 animate-in fade-in duration-300">
                  <div className="flex gap-2 font-bold text-xs">
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                    <span>Impor Produk Berhasil</span>
                  </div>
                  <p className="text-[10px] text-success/80 leading-relaxed font-semibold">
                    {result.message}
                  </p>
                </div>
              )}

              {!previewProducts && !result && (
                <>
                  {importMode === "file" ? (
                    <div className="space-y-4">
                      {/* Info Box File */}
                      <div className="bg-info-bg border border-info-border text-info text-xs p-3 rounded-lg flex gap-2.5 leading-relaxed font-medium">
                        <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
                        <span>
                          Unggah file CSV/XLSX dengan kolom utama <strong>Product ID</strong> dan{" "}
                          <strong>Nama Produk</strong>. Kolom tambahan seperti Kategori, Nama Toko,
                          atau Kode Toko bersifat opsional.
                        </span>
                      </div>

                      {/* Drag and Drop Zone */}
                      <div
                        onClick={() => fileInputRef.current?.click()}
                        className="border-2 border-dashed border-border-light hover:border-accent hover:bg-bg-panel transition-all duration-200 rounded-xl p-8 text-center cursor-pointer space-y-3"
                      >
                        <input
                          type="file"
                          ref={fileInputRef}
                          onChange={handleFileChange}
                          accept=".csv, .xlsx, .xls"
                          className="hidden"
                        />
                        <div className="mx-auto w-12 h-12 bg-bg border border-border-light text-text-placeholder rounded-full flex items-center justify-center">
                          <FileSpreadsheet className="w-6 h-6" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-text-main">
                            Pilih file CSV / Excel untuk diimpor
                          </p>
                          <p className="text-[10px] text-text-placeholder mt-1">
                            Format berkas yang didukung: .csv, .xlsx, .xls
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* Info Box URL */}
                      <div className="bg-info-bg border border-info-border text-info text-xs p-3 rounded-lg flex gap-2.5 leading-relaxed font-medium">
                        <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
                        <span>
                          Salin link produk dari aplikasi/web TikTok Shop, buka di browser lalu salin <strong>URL panjang</strong> di address bar. Paste URL panjang tersebut di bawah (satu link per baris).
                        </span>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-text-placeholder uppercase mb-1.5">
                          Paste URL Produk TikTok (satu per baris):
                        </label>
                        <textarea
                          rows={6}
                          value={urlInput}
                          onChange={(e) => setUrlInput(e.target.value)}
                          placeholder={`https://shop-id.tokopedia.com/view/product/1730353572051453257?og_info=...
https://www.tiktok.com/view/product/1234567890123456789`}
                          className="w-full text-xs font-mono p-3 border border-border-light rounded-xl focus:outline-none focus:border-accent resize-y bg-bg"
                        />
                      </div>

                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setUrlInput("")}
                          disabled={!urlInput}
                          className="px-3 py-2 bg-bg border border-border-light hover:border-border-active text-text-muted rounded-lg text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
                          title="Bersihkan"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={handleExtractUrls}
                          disabled={!urlInput.trim()}
                          className="flex-1 py-2 bg-accent hover:bg-accent-hover text-white rounded-lg text-xs font-bold transition-all cursor-pointer text-center disabled:opacity-50 flex items-center justify-center gap-1.5"
                        >
                          <Search className="w-3.5 h-3.5" />
                          <span>Ekstrak Product ID & Nama</span>
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}

              {previewProducts && summary && (
                <div className="space-y-4">
                  {/* Summary Cards */}
                  <div className="grid grid-cols-3 gap-2">
                    <div className="bg-bg border border-border-light p-2.5 rounded-lg text-center">
                      <div className="text-[10px] text-text-placeholder font-bold uppercase">
                        {importMode === "url" ? "Total Link" : "Total Baris"}
                      </div>
                      <div className="text-base font-extrabold text-text-main mt-0.5">
                        {summary.total}
                      </div>
                    </div>
                    <div className="bg-bg border border-border-light p-2.5 rounded-lg text-center">
                      <div className="text-[10px] text-text-placeholder font-bold uppercase">
                        Siap Impor
                      </div>
                      <div className="text-base font-extrabold text-accent mt-0.5">
                        {summary.valid}
                      </div>
                    </div>
                    <div className="bg-bg border border-border-light p-2.5 rounded-lg text-center">
                      <div className="text-[10px] text-text-placeholder font-bold uppercase">
                        Duplikat
                      </div>
                      <div className="text-base font-extrabold text-warning mt-0.5">
                        {summary.duplicatesInFile}
                      </div>
                    </div>
                  </div>

                  {/* Preview Table */}
                  <div className="border border-border-light rounded-lg overflow-hidden">
                    <div className="bg-bg-panel px-3 py-2 border-b border-border-light flex justify-between items-center">
                      <span className="text-[10px] font-bold text-text-placeholder uppercase">
                        Preview Data Ditemukan ({previewProducts.length})
                      </span>
                      <span className="text-[9px] bg-white border border-border-light text-text-placeholder px-1.5 py-0.5 rounded font-mono font-semibold">
                        {importMode === "file" ? `File: ${file?.name}` : "Sumber: Paste Link TikTok"}
                      </span>
                    </div>
                    <div className="overflow-x-auto max-h-[25vh]">
                      <table className="w-full text-left text-[11px] border-collapse">
                        <thead>
                          <tr className="bg-bg-panel border-b border-border-light text-[9px] font-bold text-text-placeholder uppercase">
                            <th className="p-2 w-1/3">Product ID</th>
                            <th className="p-2 w-2/3">Nama Produk</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border-light font-medium text-text-muted">
                          {previewProducts.slice(0, 10).map((p, index) => (
                            <tr key={index} className="hover:bg-bg-panel">
                              <td className="p-2 font-mono text-[10px]">{p.product_id}</td>
                              <td className="p-2 truncate max-w-xs">{p.product_name}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setPreviewProducts(null);
                        setSummary(null);
                        setFile(null);
                        setError(null);
                      }}
                      disabled={loading}
                      className="flex-1 py-2 bg-bg border border-border-light hover:border-border-active text-text-muted rounded-lg text-xs font-bold transition-all cursor-pointer text-center disabled:opacity-50"
                    >
                      Batal & Reset
                    </button>
                    <button
                      type="button"
                      onClick={executeImport}
                      disabled={loading}
                      className="flex-1 py-2 bg-accent hover:bg-accent-hover text-white rounded-lg text-xs font-bold transition-all cursor-pointer text-center disabled:opacity-50 shadow-[0_2px_8px_rgba(99,102,241,0.25)] flex items-center justify-center gap-1.5"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Mengimpor...</span>
                        </>
                      ) : (
                        "Mulai Impor"
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-5 py-4 border-t border-border-light flex justify-end">
              <button
                type="button"
                onClick={handleClose}
                disabled={loading}
                className="px-4 py-2 bg-bg border border-border-light hover:border-border-active text-text-muted rounded-lg text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
