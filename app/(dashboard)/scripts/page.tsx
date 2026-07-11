// Tujuan: Halaman UI AI Script Generator (Server Component) untuk memuat daftar master produk pengguna dari SQLite lokal.
// Caller: Route /scripts
// Dependensi: lib/db/index.ts, lib/auth.ts, types/index.ts, components/scripts/ScriptGeneratorClient.tsx, components/layout/Topbar.tsx
// Main Functions: ScriptsPage
// Side Effects: Mengambil data produk dari database SQLite lokal.
// */

import React, { Suspense } from "react";
import { redirect } from "next/navigation";
import { getMockUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { products as productsTable } from "@/lib/db/schema";
import { eq, and, desc, or } from "drizzle-orm";
import ScriptGeneratorClient from "@/components/scripts/ScriptGeneratorClient";
import Topbar from "@/components/layout/Topbar";
import { Product } from "@/types";

export default async function ScriptsPage() {
  const user = await getMockUser();

  if (!user) {
    redirect("/login");
  }

  // 2. Fetch Active Products (status = 'active' or 'aktif')
  const products = await db
    .select()
    .from(productsTable)
    .where(and(eq(productsTable.user_id, user.id), or(eq(productsTable.status, "aktif"), eq(productsTable.status, "active"))))
    .orderBy(desc(productsTable.date_added));

  const typedProducts = (products || []).map(p => {
    return {
      ...p,
      desc_variants: [],
      tiktok_product_id: p.product_id, // tiktok_product_id is now the same as product_id
    };
  }) as unknown as Product[];

  return (
    <div className="flex-1 flex flex-col min-h-screen">
      <Topbar title="AI Script Generator" />

      <div className="p-6 flex-1 space-y-6">
        <Suspense fallback={<div className="text-center text-text-placeholder py-8 font-semibold">Memuat formulir...</div>}>
          <ScriptGeneratorClient products={typedProducts} />
        </Suspense>
      </div>
    </div>
  );
}


