// /*
// Tujuan: Menyediakan fungsi utilitas untuk parsing file Excel/CSV menggunakan SheetJS, pemetaan header dinamis, dan auto-deteksi metadata produk.
// Caller: Komponen uploader impor data (/import)
// Dependensi: xlsx
// Main Functions: detectBrand, detectJenis, fuzzyHeaderFind, parseNumberValue, parsePeriodeDates
// Side Effects: None (Pure utilities)
// */

import * as XLSX from "xlsx";

// Parser nilai numerik
export function parseNumberValue(v: any): number {
  if (v === undefined || v === null) return 0;
  const s = String(v).replace(/[Rp%\s,]/g, "").replace(/\./g, "").trim();
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

// Pencarian kolom dengan pencocokan fuzzy/fleksibel (misal: "Item Nama" atau "Nama Produk")
export function fuzzyHeaderFind(row: any, ...keys: string[]): string {
  for (const k of keys) {
    const foundField = Object.keys(row).find((rk) =>
      rk.toLowerCase().replace(/[\s._]/g, "").includes(k.toLowerCase().replace(/[\s._]/g, ""))
    );
    if (foundField !== undefined) return String(row[foundField]);
  }
  return "";
}

// Parsing tanggal
export function parseDate(ds: string | null): number {
  if (!ds) return 0;
  if (ds.includes("/")) {
    const p = ds.split("/");
    if (p.length === 3) {
      // dd/mm/yyyy -> yyyy-mm-dd
      return new Date(`${p[2]}-${p[1]}-${p[0]}T00:00:00`).getTime();
    }
  }
  return new Date(ds).getTime() || 0;
}

// Parsing periode
export function parsePeriodeDates(periodeStr: string, fallbackTs: number): { start: number; end: number } {
  if (!periodeStr) return { start: fallbackTs, end: fallbackTs };
  const clean = periodeStr.replace(/"/g, "").trim();
  const parts = clean.split(/\s+[-–—~]\s+|\s+s\/d\s+|\s+to\s+|\s+s\.d\.\s+|\s+sampai\s+/i);
  if (parts.length >= 2) {
    const start = parseDate(parts[0].trim()) || fallbackTs;
    const end = parseDate(parts[parts.length - 1].trim()) || fallbackTs;
    return { start, end };
  }
  const d = parseDate(clean) || fallbackTs;
  return { start: d, end: d };
}

// Auto-detect Brand/Merk produk
export function detectBrand(name: string): string {
  if (!name) return "";
  const words = name.trim().split(/\s+/);
  if (!words.length) return "";
  const generic = [
    "new", "3pcs", "2pcs", "1pcs", "promo", "kaos", "baju", "celana",
    "ready", "super", "original", "ori", "murah", "premium", "diskon",
    "grosir", "hot", "best", "top", "sale", "viral", "terlaris", "free", "ongkir"
  ];
  let brand = words[0];
  if (generic.includes(brand.toLowerCase()) && words.length > 1) {
    brand = words[1];
  }
  brand = brand.replace(/[^a-zA-Z0-9]/g, "");
  return brand ? brand.charAt(0).toUpperCase() + brand.slice(1) : "";
}

// Auto-detect Jenis Produk
export function detectJenis(name: string): string {
  if (!name) return "";
  const words = name.trim().split(/\s+/);
  const jenisKeywords = [
    "parfum", "edp", "edt", "cologne", "body mist",
    "kaos", "kemeja", "celana", "jaket", "hoodie", "jogger", "polo", "sweater", "cardigan", "vest",
    "sepatu", "sandal", "sneakers", "boots",
    "tas", "ransel", "sling bag", "clutch", "backpack",
    "jam tangan", "gelang", "kalung", "cincin", "anting",
    "serum", "sunscreen", "moisturizer", "toner", "cleanser", "masker",
    "skincare", "bodycare", "haircare", "shampoo", "conditioner",
    "vitamin", "suplemen",
    "snack", "kopi", "teh", "coklat", "susu",
    "charger", "earphone", "headset", "powerbank", "kabel", "case", "casing",
    "alat", "set", "kit"
  ];
  const searchRange = words.slice(0, Math.min(5, words.length));
  for (const keyword of jenisKeywords) {
    const kwWords = keyword.split(" ");
    for (let i = 0; i <= searchRange.length - kwWords.length; i++) {
      const slice = searchRange.slice(i, i + kwWords.length).join(" ").toLowerCase();
      if (slice === keyword) {
        return kwWords.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
      }
    }
  }
  return "";
}

// Relasi snapshot periode non-overlapping
export function periodRelation(
  aStart: number,
  aEnd: number,
  bStart: number,
  bEnd: number
): "contains" | "contained" | "overlap" | "none" {
  if (aStart <= bStart && aEnd >= bEnd) return "contains";
  if (bStart <= aStart && bEnd >= aEnd) return "contained";
  if (aStart <= bEnd && aEnd >= bStart) return "overlap";
  return "none";
}
