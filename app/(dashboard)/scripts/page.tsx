// /*
// Tujuan: Halaman UI AI Script Generator (Server Component) untuk memuat daftar master produk pengguna dari SQLite lokal.
// Caller: Route /scripts
// Dependensi: lib/db/index.ts, lib/supabase/server.ts, types/index.ts, components/scripts/ScriptGeneratorClient.tsx, components/layout/Topbar.tsx
// Main Functions: ScriptsPage
// Side Effects: Mengambil data produk dari database SQLite lokal.
// */

import React from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { products as productsTable } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
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
  const products = await db
    .select()
    .from(productsTable)
    .where(and(eq(productsTable.user_id, user.id), eq(productsTable.status, "aktif")))
    .orderBy(desc(productsTable.bench_score));

  const typedProducts = (products || []).map(p => ({
    ...p,
    desc_variants: p.desc_variants ? JSON.parse(p.desc_variants) : [],
  })) as unknown as Product[];

  return (
    <div className="flex-1 flex flex-col min-h-screen">
      <Topbar title="AI Script Generator" />

      <div className="p-6 flex-1 space-y-6">
        <ScriptGeneratorClient products={typedProducts} />
      </div>
    </div>
  );
}

