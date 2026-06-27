// /*
// Tujuan: Mesin penjadwalan cerdas berbasis kuota proporsi, rotasi round-robin dengan cooldown produk & brand, serta interpolasi script video.
// Caller: Route API /api/schedule, Dashboard UI
// Dependensi: types/index.ts, lib/scoring/engine.ts
// Main Functions: generateSchedule, allocateQuotas, roundRobinPick, buildSlotScript
// Side Effects: None (Pure algorithm helper)
// */

import { Product, Template, ScheduleDaySlot } from "@/types";

const PATS: Record<string, string[]> = {
  "3": ["10:00", "14:00", "18:00"],
  "5": ["09:00", "11:00", "14:00", "16:00", "18:00"],
  "6": ["08:00", "10:00", "12:00", "14:00", "16:00", "18:00"],
  "10": ["07:00", "08:00", "09:00", "10:00", "11:00", "13:00", "14:00", "16:00", "17:00", "18:00"],
};

const DEFAULT_PRIME_SLOTS = ["18:00", "17:00", "16:00"];
const DEFAULT_MID_SLOTS = ["14:00", "13:00", "11:00", "10:00", "09:00"];

export function getFilteredPool<T extends { kategori?: string; content?: string }>(
  pool: T[],
  kategori: string | null
): T[] {
  const cat = (kategori || "Umum").toLowerCase();
  let filtered = pool.filter((item) => {
    const c = (item.kategori || "Umum").toLowerCase();
    return c === cat || c === "umum" || c === "";
  });
  if (!filtered.length) filtered = pool;
  return filtered;
}

export function buildSlotScript(
  prod: Product | null,
  hIdx: number,
  pfIdx: number,
  ctaIdx: number,
  descIdx: number,
  templates: Template[]
): string {
  if (!prod) return "[Slot Kosong]";

  const cat = prod.kategori || "Umum";
  const hooks = getFilteredPool(templates.filter((t) => t.type === "hook"), cat);
  const proofs = getFilteredPool(templates.filter((t) => t.type === "proof"), cat);
  const ctas = getFilteredPool(templates.filter((t) => t.type === "cta"), cat);

  const prodLabel = prod.jenis || (prod.kategori && prod.kategori !== "Umum" ? prod.kategori : "") || prod.nama.split(" ").slice(0, 3).join(" ");
  
  const hookTemplate = (hooks[hIdx] || hooks[0])?.content || "Gue iseng coba [PRODUK] ini.";
  const hook = hookTemplate.replace(/\[PRODUK\]/g, prodLabel);
  
  const proof = (proofs[pfIdx] || proofs[0])?.content || "Ratingnya 4.9 dari ribuan pembeli.";
  const cta = (ctas[ctaIdx] || ctas[0])?.content || "Cek keranjang kuning sekarang.";
  
  const desc =
    (prod.desc_variants || [])[descIdx] ||
    `[Belum ada naskah isi konten AI. Buka Master Produk → ${prod.jenis || "produk ini"} → Generate Deskripsi AI]`;

  return `[HOOK]\n${hook}\n\n[ISI]\n${desc}\n\n[PROOF]\n${proof}\n\n[CTA]\n${cta}`;
}

export function allocateQuotas(
  totalSlots: number,
  winPct: number
): { win: number; pot: number; test: number } {
  const winSlots = Math.max(1, Math.round((totalSlots * winPct) / 100));
  const remaining = totalSlots - winSlots;
  const potSlots = Math.max(0, Math.round(remaining * 0.5));
  const testSlots = Math.max(0, remaining - potSlots);
  return { win: winSlots, pot: potSlots, test: testSlots };
}

export function roundRobinPick(
  pool: Product[],
  cursor: { idx: number },
  cooldownMap: Record<string, number>,
  slotIdx: number,
  useCooldown: boolean,
  brandCooldownMap: Record<string, number>
): Product | null {
  if (!pool.length) return null;
  const startIdx = cursor.idx;

  for (let attempt = 0; attempt < pool.length; attempt++) {
    const idx = (startIdx + attempt) % pool.length;
    const p = pool[idx];
    const brand = (p.brand || p.kategori || "").toLowerCase();

    if (useCooldown) {
      // Cooldown produk (jarak minimal 2 slot)
      const lastIdx = cooldownMap[p.id];
      if (lastIdx !== undefined && slotIdx - lastIdx < 2) continue;

      // Cooldown brand (jarak minimal 1 slot / tidak boleh berturutan)
      if (brand) {
        const lastBrandIdx = brandCooldownMap[brand];
        if (lastBrandIdx !== undefined && slotIdx - lastBrandIdx < 1) continue;
      }
    }

    cursor.idx = (idx + 1) % pool.length;
    cooldownMap[p.id] = slotIdx;
    if (brand) brandCooldownMap[brand] = slotIdx;
    return p;
  }

  // Fallback jika semua kena cooldown: ambil cursor saat ini
  const p = pool[cursor.idx % pool.length];
  cursor.idx = (cursor.idx + 1) % pool.length;
  cooldownMap[p.id] = slotIdx;
  const brand = (p.brand || p.kategori || "").toLowerCase();
  if (brand) brandCooldownMap[brand] = slotIdx;
  return p;
}

export interface GeneratorParams {
  startDate: string;
  rangeDays: number;
  patternSlotsKey: string;
  winPct: number;
  useDynamicJam: boolean;
  useCooldown: boolean;
  products: Product[];
  templates: Template[];
  competitorJamList?: { j: string; n: number }[];
  personalJamList?: { j: string; n: number }[];
}

export function generateSchedule({
  startDate,
  rangeDays,
  patternSlotsKey,
  winPct,
  useDynamicJam,
  useCooldown,
  products,
  templates,
  competitorJamList = [],
  personalJamList = [],
}: GeneratorParams): ScheduleDaySlot[] {
  // Filter produk aktif (kecuali DROP)
  const winning = products.filter((p) => p.klasifikasi === "WINNING" && p.status === "aktif").sort((a, b) => b.bench_score - a.bench_score);
  const potential = products.filter((p) => p.klasifikasi === "POTENTIAL" && p.status === "aktif").sort((a, b) => b.bench_score - a.bench_score);
  const testing = products.filter((p) => (p.klasifikasi === "MONITOR" || p.klasifikasi === "DROP") && p.status === "aktif").sort((a, b) => b.bench_score - a.bench_score);
  const allActive = products.filter((p) => p.status === "aktif").sort((a, b) => b.bench_score - a.bench_score);

  // Tentukan slot waktu posting
  const defaultSlots = PATS[patternSlotsKey] || PATS["6"];
  let daySlotsTimes = [...defaultSlots].sort();

  // Dynamic jam calculations
  let primeSlotsList = [...DEFAULT_PRIME_SLOTS];
  let midSlotsList = [...DEFAULT_MID_SLOTS];

  if (useDynamicJam) {
    let jamData = competitorJamList;
    if (personalJamList.length >= 10) {
      jamData = personalJamList;
    }
    
    if (jamData.length >= 3) {
      const sortedJam = [...jamData].sort((a, b) => b.n - a.n);
      const primeCount = Math.max(2, Math.ceil(sortedJam.length * 0.3));
      const midCount = Math.max(3, Math.ceil(sortedJam.length * 0.4));
      
      primeSlotsList = sortedJam.slice(0, primeCount).map((j) => j.j);
      midSlotsList = sortedJam.slice(primeCount, primeCount + midCount).map((j) => j.j);
    }
  }

  // Quotas per tier
  const quotas = allocateQuotas(daySlotsTimes.length, winPct);

  // Cursor inisialisasi acak
  const winCursor = { idx: Math.floor(Math.random() * Math.max(winning.length, 1)) };
  const potCursor = { idx: Math.floor(Math.random() * Math.max(potential.length, 1)) };
  const testCursor = { idx: Math.floor(Math.random() * Math.max(testing.length, 1)) };

  const results: ScheduleDaySlot[] = [];

  for (let d = 0; d < rangeDays; d++) {
    const dt = new Date(startDate);
    dt.setDate(dt.getDate() + d);
    const dateStr = dt.toISOString().split("T")[0];
    const dayName = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"][dt.getDay()];

    // Kelompokkan slot berdasarkan prioritas pengisian
    const primeSlots = daySlotsTimes.filter((t) => primeSlotsList.includes(t));
    const midSlots = daySlotsTimes.filter((t) => midSlotsList.includes(t));
    const otherSlots = daySlotsTimes.filter((t) => !primeSlotsList.includes(t) && !midSlotsList.includes(t));

    const orderedSlots = [...primeSlots, ...midSlots, ...otherSlots];
    const slotAssignment = new Map<string, "win" | "pot" | "test">();
    let winCount = 0;
    let potCount = 0;

    orderedSlots.forEach((time) => {
      if (winCount < quotas.win) {
        slotAssignment.set(time, "win");
        winCount++;
      } else if (potCount < quotas.pot) {
        slotAssignment.set(time, "pot");
        potCount++;
      } else {
        slotAssignment.set(time, "test");
      }
    });

    const cooldownMap: Record<string, number> = {};
    const brandCooldownMap: Record<string, number> = {};

    const slots = daySlotsTimes.map((time, si) => {
      const assignment = slotAssignment.get(time) || "test";
      let prod: Product | null = null;
      let type: "PRIME" | "MID" | "TEST" = "TEST";

      if (assignment === "win") {
        prod =
          roundRobinPick(winning, winCursor, cooldownMap, si, useCooldown, brandCooldownMap) ||
          roundRobinPick(potential, potCursor, cooldownMap, si, useCooldown, brandCooldownMap) ||
          roundRobinPick(testing, testCursor, cooldownMap, si, useCooldown, brandCooldownMap);
        type = "PRIME";
      } else if (assignment === "pot") {
        prod =
          roundRobinPick(potential, potCursor, cooldownMap, si, useCooldown, brandCooldownMap) ||
          roundRobinPick(winning, winCursor, cooldownMap, si, useCooldown, brandCooldownMap) ||
          roundRobinPick(testing, testCursor, cooldownMap, si, useCooldown, brandCooldownMap);
        type = "MID";
      } else {
        prod =
          roundRobinPick(testing, testCursor, cooldownMap, si, useCooldown, brandCooldownMap) ||
          roundRobinPick(potential, potCursor, cooldownMap, si, useCooldown, brandCooldownMap) ||
          roundRobinPick(winning, winCursor, cooldownMap, si, useCooldown, brandCooldownMap);
        type = "TEST";
      }

      // Fallback
      if (!prod && allActive.length > 0) {
        prod = allActive[0];
      }

      const cat = prod ? prod.kategori : "Umum";
      const filteredHooks = getFilteredPool(templates.filter((t) => t.type === "hook"), cat);
      const filteredProofs = getFilteredPool(templates.filter((t) => t.type === "proof"), cat);
      const filteredCtas = getFilteredPool(templates.filter((t) => t.type === "cta"), cat);

      const hIdx = filteredHooks.length ? Math.floor(Math.random() * filteredHooks.length) : 0;
      const pfIdx = filteredProofs.length ? Math.floor(Math.random() * filteredProofs.length) : 0;
      const ctaIdx = filteredCtas.length ? Math.floor(Math.random() * filteredCtas.length) : 0;

      return {
        jam: time,
        tipe: type,
        productId: prod ? prod.id : null,
        productName: prod ? prod.nama : null,
        brand: prod ? prod.brand : null,
        kategori: prod ? prod.kategori : null,
        hook: prod ? buildSlotScript(prod, hIdx, pfIdx, ctaIdx, 0, templates).split("\n\n")[0].replace("[HOOK]\n", "") : null,
        proof: prod ? buildSlotScript(prod, hIdx, pfIdx, ctaIdx, 0, templates).split("\n\n")[2].replace("[PROOF]\n", "") : null,
        cta: prod ? buildSlotScript(prod, hIdx, pfIdx, ctaIdx, 0, templates).split("\n\n")[3].replace("[CTA]\n", "") : null,
      };
    });

    results.push({
      hari: `${dayName}, ${dateStr}`,
      slots,
    });
  }

  return results;
}
