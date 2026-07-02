// /*
// Tujuan: Halaman UI Master Produk untuk mengelola produk dengan data tabel interaktif (ProductTable) berkemampuan hapus massal di SQLite lokal.
// Caller: Route /products
// Dependensi: lib/db/index.ts, lib/supabase/server.ts, types/index.ts, components/layout/Topbar.tsx, components/products/ProductTable.tsx
// Main Functions: ProductsPage
// Side Effects: Mengambil data produk dari SQLite lokal.
// */

import React from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { products as productsTable } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import Topbar from "@/components/layout/Topbar";
import { Product } from "@/types";
import ProductTable from "@/components/products/ProductTable";

export default async function ProductsPage() {
  const supabase = await createClient();

  // 1. Verifikasi User
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // 2. Fetch data products
  const products = await db
    .select()
    .from(productsTable)
    .where(eq(productsTable.user_id, user.id))
    .orderBy(desc(productsTable.bench_score));

  const typedProducts = (products || []).map(p => ({
    ...p,
    desc_variants: p.desc_variants ? JSON.parse(p.desc_variants) : [],
  })) as unknown as Product[];

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-bg">
      <Topbar title="Master Produk" />

      <div className="p-6 space-y-6">
        <ProductTable products={typedProducts} />
      </div>
    </div>
  );
}

