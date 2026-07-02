// /*
// Tujuan: Server Actions untuk pembuatan, pembacaan, dan penghapusan riwayat penjadwalan konten di SQLite lokal.
// Caller: Halaman jadwal konten (/schedule)
// Dependensi: lib/db/index.ts, lib/supabase/server.ts, next/cache (revalidatePath), lib/schedule/generator.ts, types/index.ts
// Main Functions: getSchedulesAction, deleteScheduleAction, generateAndSaveScheduleAction
// Side Effects: Membaca, menulis, dan menghapus baris data di tabel `schedules` di SQLite lokal.
// */

"use server";

import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { schedules, products, templates, contents } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { generateSchedule } from "@/lib/schedule/generator";
import { Product, Template } from "@/types";

export interface ActionResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
}

/**
 * Mengambil semua riwayat jadwal milik pengguna aktif
 */
export async function getSchedulesAction(): Promise<any[]> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return [];

  try {
    const data = await db
      .select()
      .from(schedules)
      .where(eq(schedules.user_id, user.id))
      .orderBy(desc(schedules.created_at));

    return (data || []).map(s => {
      try {
        return {
          ...s,
          schedule_data: JSON.parse(s.schedule_data)
        };
      } catch {
        return {
          ...s,
          schedule_data: []
        };
      }
    });
  } catch (err) {
    console.error("Gagal mengambil riwayat jadwal:", err);
    return [];
  }
}

/**
 * Menghapus catatan riwayat jadwal berdasarkan ID
 */
export async function deleteScheduleAction(id: string): Promise<ActionResponse> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: "Sesi habis, silakan login ulang." };
  }

  try {
    await db
      .delete(schedules)
      .where(and(eq(schedules.id, id), eq(schedules.user_id, user.id)));

    revalidatePath("/schedule");

    return { success: true, message: "Riwayat jadwal berhasil dihapus." };
  } catch (err: any) {
    return {
      success: false,
      message: err.message || "Gagal menghapus riwayat jadwal.",
    };
  }
}

/**
 * Mengambil pool produk dan template, menghitung jam analitik akun (dynamic hours),
 * lalu memicu engine generator jadwal dan menyimpannya ke database.
 */
export async function generateAndSaveScheduleAction(params: {
  startDate: string;
  rangeDays: number;
  patternSlotsKey: string;
  winPct: number;
  useDynamicJam: boolean;
  useCooldown: boolean;
}): Promise<ActionResponse> {
  const supabase = await createClient();

  // 1. Verifikasi User
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: "Sesi habis, silakan login ulang." };
  }

  const userId = user.id;

  try {
    // 2. Fetch Active Products
    const productsData = await db
      .select()
      .from(products)
      .where(and(eq(products.user_id, userId), eq(products.status, "aktif")));

    // Fetch content counts per product to calculate collaboration content made
    const contentsLog = await db
      .select({ product_id: contents.product_id })
      .from(contents)
      .where(eq(contents.user_id, userId));

    const contentCounts: Record<string, number> = {};
    (contentsLog || []).forEach(c => {
      if (c.product_id) {
        contentCounts[c.product_id] = (contentCounts[c.product_id] || 0) + 1;
      }
    });

    const mappedProducts = (productsData || []).map(p => ({
      ...p,
      desc_variants: p.desc_variants ? JSON.parse(p.desc_variants) : [],
      content_made: contentCounts[p.id] || 0,
    })) as unknown as Product[];

    if (mappedProducts.length === 0) {
      return {
        success: false,
        message:
          "Gagal men-generate jadwal. Tidak ditemukan produk dengan status 'aktif' di Master Produk Anda.",
      };
    }

    // 3. Fetch Templates
    const templatesData = await db
      .select()
      .from(templates)
      .where(eq(templates.user_id, userId));

    const typedTemplates = (templatesData || []) as unknown as Template[];
    if (typedTemplates.length === 0) {
      return {
        success: false,
        message:
          "Gagal men-generate jadwal. Silakan isi Bank Template (Hooks, Proofs, CTAs) terlebih dahulu.",
      };
    }

    // 4. Compute Personal Jam List (jika opsi useDynamicJam aktif)
    let personalJamList: { j: string; n: number }[] = [];
    if (params.useDynamicJam) {
      // Fetch contents
      const contentsData = await db
        .select({ tanggal_upload: contents.tanggal_upload })
        .from(contents)
        .where(eq(contents.user_id, userId));

      const jamMap: Record<string, number> = {};

      contentsData.forEach((c) => {
        if (c.tanggal_upload) {
          const date = new Date(c.tanggal_upload);
          const hStr = date.getHours().toString().padStart(2, "0") + ":00";
          jamMap[hStr] = (jamMap[hStr] || 0) + 1;
        }
      });

      personalJamList = Object.entries(jamMap)
        .map(([j, n]) => ({ j, n }))
        .sort((a, b) => b.n - a.n);
    }

    // 5. Default Competitor Jam List (BENCH_JAM)
    const competitorJamList = [
      { j: "08:00", n: 18 },
      { j: "10:00", n: 37 },
      { j: "12:00", n: 28 },
      { j: "14:00", n: 30 },
      { j: "16:00", n: 23 },
      { j: "18:00", n: 18 },
    ];

    // 6. Generate Schedule using lib engine
    const scheduleDaySlots = generateSchedule({
      startDate: params.startDate,
      rangeDays: params.rangeDays,
      patternSlotsKey: params.patternSlotsKey,
      winPct: params.winPct,
      useDynamicJam: params.useDynamicJam,
      useCooldown: params.useCooldown,
      products: mappedProducts,
      templates: typedTemplates,
      competitorJamList,
      personalJamList,
    });

    // 7. Simpan ke database
    const newSchedule = {
      id: crypto.randomUUID(),
      user_id: userId,
      schedule_data: JSON.stringify(scheduleDaySlots),
      created_at: new Date().toISOString(),
    };

    await db.insert(schedules).values(newSchedule);

    revalidatePath("/schedule");

    return {
      success: true,
      message: "Jadwal cerdas berhasil di-generate dan disimpan.",
      data: {
        ...newSchedule,
        schedule_data: scheduleDaySlots
      },
    };
  } catch (err: any) {
    return {
      success: false,
      message: err.message || "Gagal membuat jadwal baru.",
    };
  }
}
