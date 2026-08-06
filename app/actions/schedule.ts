// /*
// Tujuan: Menyediakan server actions untuk CRUD jadwal konten dan parameter scoring.
// Caller: components/schedule/* (Halaman UI Jadwal)
// Dependensi: lib/db/index.ts, lib/db/schema.ts, lib/auth.ts, lib/scoring/index.ts, drizzle-orm
// Main Functions: generateAndSaveScheduleAction, getSchedulesAction, deleteScheduleAction, deleteScheduleRangeAction, clearAllSchedulesAction, getScoringParamsAction, updateScoringParamsAction, previewScoringAction
// Side Effects: Membaca dan menulis database (schedules, scoring_params)
// */

"use server";

import { getMockUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { schedules, scoring_params } from "@/lib/db/schema";
import { eq, and, gte, lte, inArray, asc } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import {
  generateDailySchedule,
  generateWeeklySchedule,
  loadParams,
} from "@/lib/scoring";
import { ActionResponse } from "./products";
import crypto from "crypto";

/**
 * Generate jadwal konten dan langsung simpan ke database.
 * Jika jadwal sudah ada pada tanggal tersebut, akan ditimpa (delete lalu insert baru).
 */
export async function generateAndSaveScheduleAction(
  mode: "today" | "week",
  startDateStr?: string
): Promise<ActionResponse> {
  const user = await getMockUser();
  if (!user) {
    return { success: false, message: "Sesi habis, silakan login ulang." };
  }
  const userId = user.id;

  try {
    const startStr = startDateStr || new Date().toISOString().split("T")[0];

    if (mode === "today") {
      const result = await generateDailySchedule(userId, new Date(startStr));
      
      // Hapus jadwal hari ini yang lama
      await db
        .delete(schedules)
        .where(and(eq(schedules.user_id, userId), eq(schedules.schedule_date, startStr)));

      // Masukkan jadwal baru
      if (result.slots.length > 0) {
        const toInsert = result.slots.map((s) => ({
          id: "sch_" + crypto.randomUUID(),
          user_id: userId,
          schedule_date: startStr,
          slot_number: s.slot_number,
          product_id: s.product_id,
          product_name: s.product_name,
          slot_type: s.slot_type,
          pool: s.pool,
          score: s.score,
          created_at: new Date().toISOString(),
        }));
        await db.insert(schedules).values(toInsert);
      }
    } else {
      // Generate seminggu
      const result = await generateWeeklySchedule(userId, startStr);

      // Ambil seluruh tanggal yang di-generate
      const dates = result.daily_schedules.map((d) => d.date);

      if (dates.length > 0) {
        // Hapus jadwal pada tanggal-tanggal tersebut yang lama
        await db
          .delete(schedules)
          .where(and(eq(schedules.user_id, userId), inArray(schedules.schedule_date, dates)));

        // Masukkan semua slot baru
        const toInsert: any[] = [];
        result.daily_schedules.forEach((dayResult) => {
          dayResult.slots.forEach((s) => {
            toInsert.push({
              id: "sch_" + crypto.randomUUID(),
              user_id: userId,
              schedule_date: dayResult.date,
              slot_number: s.slot_number,
              product_id: s.product_id,
              product_name: s.product_name,
              slot_type: s.slot_type,
              pool: s.pool,
              score: s.score,
              created_at: new Date().toISOString(),
            });
          });
        });

        if (toInsert.length > 0) {
          // Chunk insert jika datanya besar
          const chunkSize = 100;
          for (let i = 0; i < toInsert.length; i += chunkSize) {
            await db.insert(schedules).values(toInsert.slice(i, i + chunkSize));
          }
        }
      }
    }

    revalidatePath("/schedule");
    revalidatePath("/products");
    revalidatePath("/");

    return {
      success: true,
      message: `Jadwal konten berhasil di-generate dan disimpan.`,
    };
  } catch (err: any) {
    console.error("Gagal melakukan generate jadwal:", err);
    return {
      success: false,
      message: err.message || "Gagal melakukan generate jadwal.",
    };
  }
}

/**
 * Mengambil seluruh data jadwal tersimpan milik user aktif.
 */
export async function getSchedulesAction(filters?: {
  startDate?: string;
  endDate?: string;
}): Promise<ActionResponse<any[]>> {
  const user = await getMockUser();
  if (!user) {
    return { success: false, message: "Sesi habis, silakan login ulang." };
  }

  try {
    const conditions = [eq(schedules.user_id, user.id)];

    if (filters?.startDate) {
      conditions.push(gte(schedules.schedule_date, filters.startDate));
    }
    if (filters?.endDate) {
      conditions.push(lte(schedules.schedule_date, filters.endDate));
    }

    const list = await db
      .select()
      .from(schedules)
      .where(and(...conditions))
      .orderBy(asc(schedules.schedule_date), asc(schedules.slot_number));

    return {
      success: true,
      message: "Daftar jadwal berhasil diambil.",
      data: list,
    };
  } catch (err: any) {
    return {
      success: false,
      message: err.message || "Gagal mengambil daftar jadwal.",
    };
  }
}

/**
 * Menghapus jadwal konten untuk satu tanggal tertentu.
 */
export async function deleteScheduleAction(scheduleDate: string): Promise<ActionResponse> {
  const user = await getMockUser();
  if (!user) {
    return { success: false, message: "Sesi habis, silakan login ulang." };
  }

  try {
    await db
      .delete(schedules)
      .where(and(eq(schedules.user_id, user.id), eq(schedules.schedule_date, scheduleDate)));

    revalidatePath("/schedule");

    return {
      success: true,
      message: `Berhasil menghapus seluruh slot jadwal pada tanggal ${scheduleDate}.`,
    };
  } catch (err: any) {
    return {
      success: false,
      message: err.message || "Gagal menghapus jadwal.",
    };
  }
}

/**
 * Menghapus jadwal konten untuk rentang tanggal tertentu (inklusif).
 */
export async function deleteScheduleRangeAction(
  startDateStr: string,
  endDateStr: string
): Promise<ActionResponse> {
  const user = await getMockUser();
  if (!user) {
    return { success: false, message: "Sesi habis, silakan login ulang." };
  }

  try {
    await db
      .delete(schedules)
      .where(
        and(
          eq(schedules.user_id, user.id),
          gte(schedules.schedule_date, startDateStr),
          lte(schedules.schedule_date, endDateStr)
        )
      );

    revalidatePath("/schedule");
    revalidatePath("/products");
    revalidatePath("/");

    return {
      success: true,
      message: `Berhasil menghapus seluruh slot jadwal dari tanggal ${startDateStr} sampai ${endDateStr}.`,
    };
  } catch (err: any) {
    return {
      success: false,
      message: err.message || "Gagal menghapus rentang jadwal.",
    };
  }
}

/**
 * Menghapus seluruh jadwal konten milik user aktif dari database.
 */
export async function clearAllSchedulesAction(): Promise<ActionResponse> {
  const user = await getMockUser();
  if (!user) {
    return { success: false, message: "Sesi habis, silakan login ulang." };
  }

  try {
    await db
      .delete(schedules)
      .where(eq(schedules.user_id, user.id));

    revalidatePath("/schedule");
    revalidatePath("/products");
    revalidatePath("/");

    return {
      success: true,
      message: "Berhasil menghapus seluruh jadwal konten Anda.",
    };
  } catch (err: any) {
    return {
      success: false,
      message: err.message || "Gagal menghapus semua jadwal.",
    };
  }
}

/**
 * Mengambil parameter tuning skoring milik user.
 */
export async function getScoringParamsAction(): Promise<ActionResponse<Record<string, number>>> {
  const user = await getMockUser();
  if (!user) {
    return { success: false, message: "Sesi habis, silakan login ulang." };
  }

  try {
    const params = await loadParams(user.id);
    return {
      success: true,
      message: "Parameter scoring berhasil diambil.",
      data: params,
    };
  } catch (err: any) {
    return {
      success: false,
      message: err.message || "Gagal mengambil parameter skoring.",
    };
  }
}

/**
 * Memperbarui parameter tuning skoring milik user.
 */
export async function updateScoringParamsAction(
  params: Record<string, number>
): Promise<ActionResponse> {
  const user = await getMockUser();
  if (!user) {
    return { success: false, message: "Sesi habis, silakan login ulang." };
  }
  const userId = user.id;

  try {
    // Validasi parameter
    for (const [key, val] of Object.entries(params)) {
      if (isNaN(val)) {
        return { success: false, message: `Nilai parameter "${key}" harus berupa angka.` };
      }
    }

    // Hapus parameter lama
    await db
      .delete(scoring_params)
      .where(eq(scoring_params.user_id, userId));

    // Insert parameter baru
    const toInsert = Object.entries(params).map(([key, val]) => ({
      id: "sp_" + crypto.randomUUID(),
      user_id: userId,
      param_key: key,
      param_value: val,
      updated_at: new Date().toISOString(),
    }));

    if (toInsert.length > 0) {
      await db.insert(scoring_params).values(toInsert);
    }

    revalidatePath("/schedule");

    return {
      success: true,
      message: "Parameter skoring berhasil diperbarui.",
    };
  } catch (err: any) {
    return {
      success: false,
      message: err.message || "Gagal memperbarui parameter skoring.",
    };
  }
}

/**
 * Menghasilkan preview scoring (data mentah) tanpa menyimpannya ke database.
 * Sangat berguna untuk di-render di tabel visual analisis skoring.
 */
export async function previewScoringAction(
  startDateStr?: string,
  paramsOverride?: Record<string, number>
): Promise<ActionResponse<any>> {
  const user = await getMockUser();
  if (!user) {
    return { success: false, message: "Sesi habis, silakan login ulang." };
  }

  try {
    const start = startDateStr ? new Date(startDateStr) : new Date();
    const result = await generateDailySchedule(user.id, start, paramsOverride);
    
    return {
      success: true,
      message: "Preview skoring berhasil di-generate.",
      data: result,
    };
  } catch (err: any) {
    return {
      success: false,
      message: err.message || "Gagal melakukan preview skoring.",
    };
  }
}
