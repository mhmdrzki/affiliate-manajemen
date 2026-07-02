// /*
// Tujuan: Server Actions untuk pembaruan profil pengguna (nama tampilan, API key Gemini, dan model skoring default) di SQLite lokal.
// Caller: Halaman Pengaturan (/settings)
// Dependensi: lib/db/index.ts, lib/supabase/server.ts, next/cache (revalidatePath)
// Main Functions: updateProfileAction
// Side Effects: Mengubah baris data profil pengguna pada tabel `profiles` di SQLite lokal.
// */

"use server";

import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { profiles } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
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

  if (data.scoring_mode !== undefined) {
    if (!["benchmark", "topsis"].includes(data.scoring_mode)) {
      return { success: false, message: "Mode skoring tidak valid." };
    }
  }

  try {
    const defaultDisplayName = user.user_metadata?.display_name || user.email || 'Local User';
    
    await db
      .insert(profiles)
      .values({
        id: user.id,
        email: user.email || 'local@domain.com',
        display_name: data.display_name !== undefined ? (data.display_name.trim() || null) : defaultDisplayName,
        gemini_api_key_encrypted: data.gemini_api_key_encrypted !== undefined ? (data.gemini_api_key_encrypted.trim() || null) : null,
        scoring_mode: data.scoring_mode || 'benchmark',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .onConflictDoUpdate({
        target: profiles.id,
        set: {
          ...(data.display_name !== undefined ? { display_name: data.display_name.trim() || null } : {}),
          ...(data.gemini_api_key_encrypted !== undefined ? { gemini_api_key_encrypted: data.gemini_api_key_encrypted.trim() || null } : {}),
          ...(data.scoring_mode !== undefined ? { scoring_mode: data.scoring_mode } : {}),
          updated_at: new Date().toISOString(),
        }
      });

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

