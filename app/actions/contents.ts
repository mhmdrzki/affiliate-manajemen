// /*
// Tujuan: Server Actions untuk mutasi & query data konten, termasuk memperbarui relasi produk (product_id), menghapus entri konten, dan mengambil data terfilter tanpa paginasi.
// Caller: Komponen Halaman Riwayat Konten (/history)
// Dependensi: lib/db/index.ts, lib/auth.ts, next/cache (revalidatePath)
// Main Functions: updateContentProductIdAction, deleteContentAction, getContentsAction, getAllFilteredContentsAction
// Side Effects: Memperbarui baris data di tabel `contents` dan menghapus baris data di tabel `contents` pada SQLite lokal.
// */

"use server";

import { getMockUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { contents } from "@/lib/db/schema";
import { eq, and, or, gte, lte, like, desc } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export interface ActionResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
}

/**
 * Memperbarui product_id dari data konten spesifik milik user aktif
 */
export async function updateContentProductIdAction(
  contentId: string,
  productId: string | null
): Promise<ActionResponse> {
  const user = await getMockUser();

  if (!user) {
    return { success: false, message: "Sesi habis, silakan login ulang." };
  }

  if (!contentId) {
    return { success: false, message: "ID konten wajib diisi." };
  }

  try {
    // 2. Lakukan update data
    await db
      .update(contents)
      .set({
        product_id: productId || null, // set to null if empty
      })
      .where(and(eq(contents.id, contentId), eq(contents.user_id, user.id)));

    // 3. Revalidasi path agar UI ter-refresh
    revalidatePath("/history");

    return {
      success: true,
      message: "Produk konten berhasil diperbarui.",
    };
  } catch (err: any) {
    return {
      success: false,
      message: err.message || "Gagal memperbarui produk konten.",
    };
  }
}

/**
 * Menghapus data konten spesifik milik user aktif
 */
export async function deleteContentAction(
  contentId: string
): Promise<ActionResponse> {
  const user = await getMockUser();

  if (!user) {
    return { success: false, message: "Sesi habis, silakan login ulang." };
  }

  if (!contentId) {
    return { success: false, message: "ID konten wajib diisi." };
  }

  try {
    // Lakukan penghapusan data
    await db
      .delete(contents)
      .where(and(eq(contents.id, contentId), eq(contents.user_id, user.id)));

    // Revalidasi path agar UI ter-refresh
    revalidatePath("/history");

    return {
      success: true,
      message: "Konten berhasil dihapus dari riwayat.",
    };
  } catch (err: any) {
    return {
      success: false,
      message: err.message || "Gagal menghapus konten dari riwayat.",
    };
  }
}

/**
 * Mengambil daftar data konten milik user aktif
 */
export async function getContentsAction(): Promise<ActionResponse<any[]>> {
  const user = await getMockUser();

  if (!user) {
    return { success: false, message: "Sesi habis, silakan login ulang." };
  }

  try {
    const list = await db
      .select()
      .from(contents)
      .where(eq(contents.user_id, user.id));

    return {
      success: true,
      message: "Daftar konten berhasil diambil.",
      data: list,
    };
  } catch (err: any) {
    return {
      success: false,
      message: err.message || "Gagal mengambil daftar konten.",
    };
  }
}

/**
 * Mengambil daftar data konten milik user aktif yang sudah difilter tanpa batasan paginasi (untuk ekspor CSV)
 */
export async function getAllFilteredContentsAction(filters: {
  search?: string;
  startDate?: string;
  endDate?: string;
  productId?: string;
}): Promise<ActionResponse<any[]>> {
  const user = await getMockUser();

  if (!user) {
    return { success: false, message: "Sesi habis, silakan login ulang." };
  }

  try {
    const conditions = [eq(contents.user_id, user.id)];

    if (filters.search) {
      conditions.push(
        or(
          like(contents.desc_text, `%${filters.search}%`),
          like(contents.tiktok_content_id, `%${filters.search}%`)
        )!
      );
    }

    if (filters.startDate) {
      conditions.push(gte(contents.tanggal_upload, `${filters.startDate}T00:00:00.000Z`));
    }

    if (filters.endDate) {
      conditions.push(lte(contents.tanggal_upload, `${filters.endDate}T23:59:59.999Z`));
    }

    if (filters.productId) {
      conditions.push(eq(contents.product_id, filters.productId));
    }

    const list = await db
      .select()
      .from(contents)
      .where(and(...conditions)!)
      .orderBy(desc(contents.tanggal_upload));

    return {
      success: true,
      message: "Berhasil mengambil data konten untuk ekspor.",
      data: list,
    };
  } catch (err: any) {
    return {
      success: false,
      message: err.message || "Gagal mengambil data konten.",
    };
  }
}

