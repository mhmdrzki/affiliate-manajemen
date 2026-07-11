// Tujuan: Halaman Riwayat Konten (Server Component) untuk menyajikan log performa video terpaginasi dengan pencarian, filter tanggal, filter produk, & kontrol Live Scraper.
// Caller: Route /history
// Dependensi: lib/db/index.ts, lib/auth.ts, types/index.ts, components/layout/Topbar.tsx, components/history/ScraperPanel.tsx, components/history/ContentHistoryTable.tsx
// Main Functions: ContentHistoryPage
// Side Effects: Mengambil data konten terpaginasi & terfilter, serta data master produk dari SQLite lokal.
// */

import React from "react";
import { redirect } from "next/navigation";
import { getMockUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { contents as contentsTable, products as productsTable } from "@/lib/db/schema";
import { eq, desc, and, gte, lte, like, or, count, sql, asc } from "drizzle-orm";
import Topbar from "@/components/layout/Topbar";
import ScraperPanel from "@/components/history/ScraperPanel";
import ContentHistoryTable from "@/components/history/ContentHistoryTable";
import { Content, Product } from "@/types";

interface PageProps {
  searchParams: Promise<{
    page?: string;
    search?: string;
    startDate?: string;
    endDate?: string;
    limit?: string;
    productId?: string;
    sortBy?: string;
  }>;
}

export default async function ContentHistoryPage({ searchParams }: PageProps) {
  const user = await getMockUser();

  if (!user) {
    redirect("/login");
  }

  // 2. Parsing Query Parameters
  const params = await searchParams;
  const pageNum = Math.max(1, parseInt(params.page || "1") || 1);
  // Membaca limit dinamis (maksimal 50, minimal 15, default 15)
  const limitNum = Math.min(50, Math.max(15, parseInt(params.limit || "15") || 15));
  const offsetNum = (pageNum - 1) * limitNum;

  const searchVal = params.search || "";
  const startDateVal = params.startDate || "";
  const endDateVal = params.endDate || "";
  const productIdVal = params.productId || "";
  const sortByVal = params.sortBy || "";

  // 3. Bangun kondisi query
  const conditions = [eq(contentsTable.user_id, user.id)];

  if (searchVal) {
    conditions.push(
      or(
        like(contentsTable.desc_text, `%${searchVal}%`),
        like(contentsTable.tiktok_content_id, `%${searchVal}%`)
      )!
    );
  }

  if (startDateVal) {
    conditions.push(gte(contentsTable.tanggal_upload, `${startDateVal}T00:00:00.000Z`));
  }

  if (endDateVal) {
    conditions.push(lte(contentsTable.tanggal_upload, `${endDateVal}T23:59:59.999Z`));
  }

  if (productIdVal) {
    conditions.push(eq(contentsTable.product_id, productIdVal));
  }

  // 4. Hitung total data terfilter
  const totalCountResult = await db
    .select({ value: count() })
    .from(contentsTable)
    .where(and(...conditions)!);

  const totalRows = totalCountResult[0]?.value || 0;
  const totalPages = Math.ceil(totalRows / limitNum);

  // 5. Bangun order by
  const orderConditions = [];
  if (sortByVal === "no_product_first") {
    orderConditions.push(
      asc(sql`CASE WHEN product_id IS NULL THEN 0 ELSE 1 END`),
      desc(contentsTable.tanggal_upload)
    );
  } else {
    orderConditions.push(desc(contentsTable.tanggal_upload));
  }

  // 6. Fetch data konten terpaginasi
  const contents = await db
    .select()
    .from(contentsTable)
    .where(and(...conditions)!)
    .orderBy(...orderConditions)
    .limit(limitNum)
    .offset(offsetNum);

  const typedContents = (contents || []) as unknown as Content[];

  // 7. Fetch seluruh data produk master untuk user dari SQLite lokal (untuk dropdown)
  const products = await db
    .select()
    .from(productsTable)
    .where(eq(productsTable.user_id, user.id))
    .orderBy(productsTable.product_name);

  const typedProducts = (products || []) as unknown as Product[];

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-bg">
      <Topbar title="Riwayat Konten & Scraper" />

      <div className="p-6 max-w-6xl mx-auto w-full space-y-6">
        {/* Scraper Control Panel */}
        <ScraperPanel />

        {/* Live Metrics / Engagement Table */}
        <ContentHistoryTable
          contents={typedContents}
          products={typedProducts}
          currentPage={pageNum}
          totalPages={totalPages}
          totalRows={totalRows}
          limit={limitNum}
          search={searchVal}
          startDate={startDateVal}
          endDate={endDateVal}
          productId={productIdVal}
          sortBy={sortByVal}
        />
      </div>
    </div>
  );
}
