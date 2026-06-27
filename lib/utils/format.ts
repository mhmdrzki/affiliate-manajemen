// /*
// Tujuan: Menyediakan fungsi pemformatan angka ribuan dan mata uang rupiah untuk visualisasi UI.
// Caller: Dashboard widgets, Tables, Cards
// Dependensi: None
// Main Functions: fmt, fmtIDR, fmtPercent
// Side Effects: None (Formatting helpers)
// */

// Pemformatan pemisah ribuan (titik)
export function fmt(v: number | string | undefined | null): string {
  if (v === undefined || v === null) return "0";
  const num = typeof v === "string" ? parseFloat(v) : v;
  if (isNaN(num)) return "0";
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

// Pemformatan Rupiah
export function fmtIDR(v: number | undefined | null): string {
  if (v === undefined || v === null) return "Rp0";
  return `Rp${fmt(v)}`;
}

// Pemformatan Persentase
export function fmtPercent(v: number | undefined | null): string {
  if (v === undefined || v === null) return "0%";
  return `${v.toFixed(1)}%`;
}
