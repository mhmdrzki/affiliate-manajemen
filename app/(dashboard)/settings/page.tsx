// /*
// Tujuan: Halaman UI Pengaturan (Server Component) untuk memuat profil pengguna dari SQLite lokal dan merender form pengaturan.
// Caller: Route /settings
// Dependensi: lib/db/index.ts, lib/supabase/server.ts, types/index.ts, components/settings/SettingsForm.tsx, components/layout/Topbar.tsx
// Main Functions: SettingsPage
// Side Effects: Mengambil data profil dari database SQLite lokal.
// */

import React from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { profiles } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import SettingsForm from "@/components/settings/SettingsForm";
import Topbar from "@/components/layout/Topbar";
import { Profile } from "@/types";

export default async function SettingsPage() {
  const supabase = await createClient();

  // 1. Verifikasi Sesi User
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // 2. Fetch User Profile
  const profile = await db
    .select()
    .from(profiles)
    .where(eq(profiles.id, user.id))
    .then(rows => rows[0]);

  if (!profile) {
    // Fallback jika profile belum terbentuk (safety check)
    const fallbackProfile: Profile = {
      id: user.id,
      email: user.email || "",
      display_name: user.email || "",
      gemini_api_key_encrypted: null,
      scoring_mode: "benchmark",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    return (
      <div className="flex-1 flex flex-col min-h-screen">
        <Topbar title="Pengaturan Profil" />
        <div className="p-6 flex-1 space-y-6">
          <SettingsForm profile={fallbackProfile} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-screen">
      <Topbar title="Pengaturan Profil" />

      <div className="p-6 flex-1 space-y-6">
        <SettingsForm profile={profile as unknown as Profile} />
      </div>
    </div>
  );
}

