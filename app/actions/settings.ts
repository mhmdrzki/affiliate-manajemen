// /*
// Tujuan: Server Actions untuk pembaruan profil pengguna (nama tampilan, API key Gemini, dan model skoring default).
// Caller: Halaman Pengaturan (/settings)
// Dependensi: lib/supabase/server.ts, next/cache (revalidatePath)
// Main Functions: updateProfileAction
// Side Effects: Mengubah baris data profil pengguna pada tabel `profiles` di Supabase.
// */

"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export interface ActionResponse {
  success: boolean;
  message: string;
}

/**
 * Memperbarui profil pengguna (display_name, gemini_api_key_encrypted, scoring_mode)
 */
export async function updateProfileAction(data: {
  display_name?: string;
  gemini_api_key_encrypted?: string;
  scoring_mode?: "benchmark" | "topsis";
}): Promise<ActionResponse> {
  const supabase = await createClient();

  // 1. Verifikasi User
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: "Sesi habis, silakan login ulang." };
  }

  const updatePayload: Record<string, any> = {
    updated_at: new Date().toISOString(),
  };

  if (data.display_name !== undefined) {
    updatePayload.display_name = data.display_name.trim() || null;
  }

  if (data.gemini_api_key_encrypted !== undefined) {
    updatePayload.gemini_api_key_encrypted = data.gemini_api_key_encrypted.trim() || null;
  }

  if (data.scoring_mode !== undefined) {
    if (!["benchmark", "topsis"].includes(data.scoring_mode)) {
      return { success: false, message: "Mode skoring tidak valid." };
    }
    updatePayload.scoring_mode = data.scoring_mode;
  }

  try {
    const { error } = await supabase
      .from("profiles")
      .update(updatePayload)
      .eq("id", user.id);

    if (error) throw error;

    // Revalidate paths to distribute profile updates
    revalidatePath("/settings");
    revalidatePath("/");
    revalidatePath("/products");
    revalidatePath("/schedule");
    revalidatePath("/scripts");

    return {
      success: true,
      message: "Pengaturan profil berhasil diperbarui.",
    };
  } catch (err: any) {
    return {
      success: false,
      message: err.message || "Gagal memperbarui profil.",
    };
  }
}
