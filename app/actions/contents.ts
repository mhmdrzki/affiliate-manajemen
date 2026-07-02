// /*
// Tujuan: Server Actions untuk mutasi data konten, termasuk memperbarui relasi produk (product_id).
// Caller: Komponen Halaman Riwayat Konten (/history)
// Dependensi: lib/db/index.ts, lib/supabase/server.ts, next/cache (revalidatePath)
// Main Functions: updateContentProductIdAction
// Side Effects: Memperbarui baris data di tabel `contents` pada SQLite lokal.
// */

"use server";

import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { contents } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
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
  const supabase = await createClient();

  // 1. Verifikasi User
  const {
    data: { user },
  } = await supabase.auth.getUser();

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
