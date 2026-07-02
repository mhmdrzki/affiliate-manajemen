// /*
// Tujuan: Menyediakan fungsi utilitas untuk parsing file Excel TikTok Orders, dan auto-deteksi metadata produk.
// Caller: Server Actions pengolah impor data (import-orders.ts)
// Dependensi: None
// Main Functions: detectBrand, detectJenis, parseTikTokNumber, parseTikTokDate
// Side Effects: None (Pure utilities)
// */

// TikTok XLSX format: "142.814" = Rp 142.814 (dot = ribuan separator)
// Juga bisa: "99.000", "261.440", atau kosong ""
export function parseTikTokNumber(v: any): number {
  if (v === undefined || v === null || v === "") return 0;
  const s = String(v).trim();
  // Jika berisi dot DAN semua segmen setelah dot = 3 digit → dot = ribuan
  const dotParts = s.split(".");
  if (dotParts.length === 2 && dotParts[1].length === 3) {
    return parseInt(s.replace(/\./g, ""), 10) || 0;
  }
  return parseFloat(s.replace(/,/g, "")) || 0;
}

// Format tanggal TikTok: "25/06/2026 13:55:03" → ISO string
export function parseTikTokDate(dateStr: string): string | null {
  if (!dateStr || dateStr === "/") return null;
  const parts = dateStr.match(/(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2}):(\d{2})/);
  if (!parts) return null;
  const [, dd, mm, yyyy, hh, mi, ss] = parts;
  return new Date(`${yyyy}-${mm}-${dd}T${hh}:${mi}:${ss}+07:00`).toISOString();
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
