// /*
// Tujuan: Halaman UI Pengaturan (Server Component) untuk memuat profil pengguna dari Supabase dan merender form pengaturan.
// Caller: Route /settings
// Dependensi: lib/supabase/server.ts, types/index.ts, components/settings/SettingsForm.tsx, components/layout/Topbar.tsx
// Main Functions: SettingsPage
// Side Effects: Mengambil data profil dari database Supabase.
// */

import React from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
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
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (error || !profile) {
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
