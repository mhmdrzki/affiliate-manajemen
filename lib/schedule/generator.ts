// /*
// Tujuan: Mesin penjadwalan cerdas berbasis alokasi budget proporsional, prioritas produk kerjasama, jam analitik akun, dan cooldown produk/brand.
// Caller: Route API /api/schedule, Dashboard UI, Server Actions (schedule.ts)
// Dependensi: types/index.ts
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
  excludeDays?: string[];
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
  excludeDays = ["Minggu"],
}: GeneratorParams): ScheduleDaySlot[] {
  const todayMs = new Date().setHours(0, 0, 0, 0);

  // 1. Hard Filter: active products, excluding expired collaborations
  const activeProducts = products.filter((p) => {
    if (p.status !== "aktif") return false;
    if (p.is_kerjasama) {
      if (p.kerjasama_deadline) {
        const dl = new Date(p.kerjasama_deadline).getTime();
        if (dl < todayMs) return false;
      }
    }
    return true;
  });

  if (activeProducts.length === 0) {
    return [];
  }

  // 2. Classify Pools (Sorted by priority score descending)
  const primePool = activeProducts
    .filter((p) => ["PROVEN_WINNER", "GMV_ACTIVE", "RESTOCK_CONFIRMED"].includes(p.klasifikasi))
    .sort((a, b) => b.bench_score - a.bench_score);

  const regularPool = activeProducts
    .filter((p) => ["GROWING", "MONITOR", "SPIKE_ONLY"].includes(p.klasifikasi))
    .sort((a, b) => b.bench_score - a.bench_score);

  const testingPool = activeProducts
    .filter((p) => ["EARLY_STAGE", "RESTOCK_RECOVERY", "STAGNANT", "DECLINING"].includes(p.klasifikasi))
    .sort((a, b) => b.bench_score - a.bench_score);

  const collabProducts = activeProducts.filter((p) => p.is_kerjasama);

  // Slot times setup
  const defaultSlots = PATS[patternSlotsKey] || PATS["6"];
  const daySlotsTimes = [...defaultSlots].sort();

  // Dynamic jam mapping
  let jamData = competitorJamList;
  if (useDynamicJam && personalJamList.length >= 5) {
    jamData = personalJamList;
  }
  const sortedJam = [...jamData].sort((a, b) => b.n - a.n).map((j) => j.j);

  // Helper to map slot type based on strict clock ranges
  function getSlotType(time: string): "PRIME" | "MID" | "TEST" {
    const hour = parseInt(time.split(":")[0], 10);
    if (hour < 10) {
      return "TEST";
    }
    if (hour >= 17) {
      return "PRIME";
    }
    return "MID";
  }

  // Round-Robin state cursors
  const poolCursors = {
    prime: 0,
    regular: 0,
    testing: 0,
  };

  // Robust round robin pick function with daily limits and exclusions
  function pickFromPool(
    pool: Product[],
    poolKey: "prime" | "regular" | "testing",
    dailyProductCount: Record<string, number>,
    maxPerDay: number,
    excludeProductIds: Set<string> = new Set()
  ): Product | null {
    if (!pool.length) return null;

    const startIdx = poolCursors[poolKey];
    for (let i = 0; i < pool.length; i++) {
      const idx = (startIdx + i) % pool.length;
      const product = pool[idx];

      if (excludeProductIds.has(product.id)) continue;

      const count = dailyProductCount[product.id] || 0;
      if (count >= maxPerDay) continue;

      poolCursors[poolKey] = (idx + 1) % pool.length;
      return product;
    }

    // Exclude constraint fallback
    if (excludeProductIds.size > 0) {
      for (let i = 0; i < pool.length; i++) {
        const idx = (startIdx + i) % pool.length;
        const product = pool[idx];
        const count = dailyProductCount[product.id] || 0;
        if (count >= maxPerDay) continue;

        poolCursors[poolKey] = (idx + 1) % pool.length;
        return product;
      }
    }

    // Overlimit fallback
    const fallbackIdx = startIdx % pool.length;
    const product = pool[fallbackIdx];
    poolCursors[poolKey] = (fallbackIdx + 1) % pool.length;
    return product;
  }

  // Track remaining collab slot counts
  const collabSlotsRemaining: Record<string, number> = {};
  collabProducts.forEach((cp) => {
    const deadlineTs = cp.kerjasama_deadline ? new Date(cp.kerjasama_deadline).getTime() : 0;
    const daysUntilDeadline = deadlineTs ? Math.max(1, Math.ceil((deadlineTs - todayMs) / 86400000)) : 7;
    const collab_remaining = Math.max(0, cp.kerjasama_target - (cp.content_made || 0));
    collabSlotsRemaining[cp.id] = Math.min(
      collab_remaining,
      Math.ceil(collab_remaining * (rangeDays / daysUntilDeadline))
    );
  });

  const results: ScheduleDaySlot[] = [];

  for (let d = 0; d < rangeDays; d++) {
    const dt = new Date(startDate);
    dt.setDate(dt.getDate() + d);
    const dateStr = dt.toISOString().split("T")[0];
    const dayName = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"][dt.getDay()];

    const isExcluded = excludeDays.includes(dayName);
    if (isExcluded) {
      results.push({
        hari: `${dayName}, ${dateStr}`,
        slots: [],
      });
      continue;
    }

    // Initialize daily slot structures
    const daySlots = daySlotsTimes.map((time) => ({
      jam: time,
      tipe: getSlotType(time),
      productId: null as string | null,
      productName: null as string | null,
      brand: null as string | null,
      kategori: null as string | null,
      isCollabSlot: false,
      reason: "",
    }));

    const dailyProductCount: Record<string, number> = {};
    const scheduledProductIdsToday = new Set<string>();

    // 1. Collaboration (Collab Required) priority allocation
    collabProducts.forEach((cp) => {
      if (collabSlotsRemaining[cp.id] > 0) {
        let slotIdx = daySlots.findIndex((s) => s.tipe === "MID" && s.productId === null);
        if (slotIdx === -1) {
          slotIdx = daySlots.findIndex((s) => s.tipe === "TEST" && s.productId === null);
        }
        if (slotIdx === -1) {
          slotIdx = daySlots.findIndex((s) => s.productId === null);
        }

        if (slotIdx !== -1) {
          daySlots[slotIdx].productId = cp.id;
          daySlots[slotIdx].productName = cp.nama;
          daySlots[slotIdx].brand = cp.brand;
          daySlots[slotIdx].kategori = cp.kategori;
          daySlots[slotIdx].isCollabSlot = true;
          daySlots[slotIdx].reason = `COLLABORATION | Sisa target: ${collabSlotsRemaining[cp.id]} | Deadline: ${cp.kerjasama_deadline}`;
          
          dailyProductCount[cp.id] = (dailyProductCount[cp.id] || 0) + 1;
          scheduledProductIdsToday.add(cp.id);
          collabSlotsRemaining[cp.id]--;
        }
      }
    });

    // 2. Prime Slots Allocation
    daySlots.forEach((slot) => {
      if (slot.productId !== null) return;
      if (slot.tipe === "PRIME") {
        const prod = pickFromPool(primePool, "prime", dailyProductCount, 2);
        if (prod) {
          slot.productId = prod.id;
          slot.productName = prod.nama;
          slot.brand = prod.brand;
          slot.kategori = prod.kategori;
          slot.reason = `PRIME | Skor: ${Math.round(prod.bench_score)} | Klasifikasi: ${prod.klasifikasi}`;
          dailyProductCount[prod.id] = (dailyProductCount[prod.id] || 0) + 1;
          scheduledProductIdsToday.add(prod.id);
        }
      }
    });

    // 3. Regular (MID) Slots Allocation
    daySlots.forEach((slot) => {
      if (slot.productId !== null) return;
      if (slot.tipe === "MID") {
        const prod = pickFromPool(regularPool, "regular", dailyProductCount, 2);
        if (prod) {
          slot.productId = prod.id;
          slot.productName = prod.nama;
          slot.brand = prod.brand;
          slot.kategori = prod.kategori;
          slot.reason = `REGULAR | Skor: ${Math.round(prod.bench_score)} | Klasifikasi: ${prod.klasifikasi}`;
          dailyProductCount[prod.id] = (dailyProductCount[prod.id] || 0) + 1;
          scheduledProductIdsToday.add(prod.id);
        }
      }
    });

    // 4. Testing (TEST) Slots Allocation
    daySlots.forEach((slot) => {
      if (slot.productId !== null) return;
      if (slot.tipe === "TEST") {
        const prod = pickFromPool(testingPool, "testing", dailyProductCount, 1, scheduledProductIdsToday);
        if (prod) {
          slot.productId = prod.id;
          slot.productName = prod.nama;
          slot.brand = prod.brand;
          slot.kategori = prod.kategori;
          slot.reason = `TESTING | Skor: ${Math.round(prod.bench_score)} | Klasifikasi: ${prod.klasifikasi}`;
          dailyProductCount[prod.id] = (dailyProductCount[prod.id] || 0) + 1;
          scheduledProductIdsToday.add(prod.id);
        }
      }
    });

    // 5. Fallback for empty slots
    daySlots.forEach((slot) => {
      if (slot.productId !== null) return;
      
      let prod = null;
      if (slot.tipe === "PRIME") {
        prod = pickFromPool(primePool, "prime", dailyProductCount, 2) ||
               pickFromPool(regularPool, "regular", dailyProductCount, 2) ||
               pickFromPool(testingPool, "testing", dailyProductCount, 1);
      } else if (slot.tipe === "MID") {
        prod = pickFromPool(regularPool, "regular", dailyProductCount, 2) ||
               pickFromPool(primePool, "prime", dailyProductCount, 2) ||
               pickFromPool(testingPool, "testing", dailyProductCount, 1);
      } else {
        prod = pickFromPool(testingPool, "testing", dailyProductCount, 1) ||
               pickFromPool(regularPool, "regular", dailyProductCount, 2) ||
               pickFromPool(primePool, "prime", dailyProductCount, 2);
      }

      if (prod) {
        slot.productId = prod.id;
        slot.productName = prod.nama;
        slot.brand = prod.brand;
        slot.kategori = prod.kategori;
        slot.reason = `FALLBACK | Skor: ${Math.round(prod.bench_score)}`;
        dailyProductCount[prod.id] = (dailyProductCount[prod.id] || 0) + 1;
      }
    });

    // 6. Cooldown Swap: Prevent back-to-back same product slots
    if (useCooldown) {
      for (let i = 1; i < daySlots.length; i++) {
        if (daySlots[i].productId && daySlots[i].productId === daySlots[i - 1].productId) {
          for (let j = i + 1; j < daySlots.length; j++) {
            if (
              daySlots[j].productId &&
              daySlots[j].productId !== daySlots[i].productId &&
              daySlots[j].productId !== daySlots[i - 1].productId
            ) {
              const temp = { ...daySlots[i] };
              daySlots[i].productId = daySlots[j].productId;
              daySlots[i].productName = daySlots[j].productName;
              daySlots[i].brand = daySlots[j].brand;
              daySlots[i].kategori = daySlots[j].kategori;
              daySlots[i].isCollabSlot = daySlots[j].isCollabSlot;
              daySlots[i].reason = daySlots[j].reason;

              daySlots[j].productId = temp.productId;
              daySlots[j].productName = temp.productName;
              daySlots[j].brand = temp.brand;
              daySlots[j].kategori = temp.kategori;
              daySlots[j].isCollabSlot = temp.isCollabSlot;
              daySlots[j].reason = temp.reason;
              break;
            }
          }
        }
      }
    }

    // Populate script template texts
    const populatedSlots = daySlots.map((slot) => {
      if (!slot.productId) {
        return {
          jam: slot.jam,
          tipe: slot.tipe,
          productId: null,
          productName: null,
          brand: null,
          kategori: null,
          hook: null,
          proof: null,
          cta: null,
        };
      }

      const prod = products.find((p) => p.id === slot.productId)!;
      const cat = prod.kategori || "Umum";
      const hooks = getFilteredPool(templates.filter((t) => t.type === "hook"), cat);
      const proofs = getFilteredPool(templates.filter((t) => t.type === "proof"), cat);
      const ctas = getFilteredPool(templates.filter((t) => t.type === "cta"), cat);

      const hIdx = hooks.length ? Math.floor(Math.random() * hooks.length) : 0;
      const pfIdx = proofs.length ? Math.floor(Math.random() * proofs.length) : 0;
      const ctaIdx = ctas.length ? Math.floor(Math.random() * ctas.length) : 0;

      const script = buildSlotScript(prod, hIdx, pfIdx, ctaIdx, 0, templates);
      const lines = script.split("\n\n");
      const hookText = lines[0] ? lines[0].replace("[HOOK]\n", "") : null;
      const proofText = lines[2] ? lines[2].replace("[PROOF]\n", "") : null;
      const ctaText = lines[3] ? lines[3].replace("[CTA]\n", "") : null;

      return {
        jam: slot.jam,
        tipe: slot.tipe,
        productId: slot.productId,
        productName: slot.productName,
        brand: slot.brand,
        kategori: slot.kategori,
        hook: hookText,
        proof: proofText,
        cta: ctaText,
      };
    });

    results.push({
      hari: `${dayName}, ${dateStr}`,
      slots: populatedSlots,
    });
  }

  return results;
}
