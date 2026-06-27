// /*
// Tujuan: Halaman UI AI Script Generator (Server Component) untuk memuat daftar master produk pengguna.
// Caller: Route /scripts
// Dependensi: lib/supabase/server.ts, types/index.ts, components/scripts/ScriptGeneratorClient.tsx, components/layout/Topbar.tsx
// Main Functions: ScriptsPage
// Side Effects: Mengambil data produk dari database Supabase.
// */

import React from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ScriptGeneratorClient from "@/components/scripts/ScriptGeneratorClient";
import Topbar from "@/components/layout/Topbar";
import { Product } from "@/types";

export default async function ScriptsPage() {
  const supabase = await createClient();

  // 1. Verifikasi Sesi User
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // 2. Fetch Active Products (status = 'aktif')
  const { data: products } = await supabase
    .from("products")
    .select("*")
    .eq("user_id", user.id)
    .eq("status", "aktif")
    .order("bench_score", { ascending: false });

  const typedProducts = (products || []) as unknown as Product[];

  return (
    <div className="flex-1 flex flex-col min-h-screen">
      <Topbar title="AI Script Generator" />

      <div className="p-6 flex-1 space-y-6">
        <ScriptGeneratorClient products={typedProducts} />
      </div>
    </div>
  );
}
