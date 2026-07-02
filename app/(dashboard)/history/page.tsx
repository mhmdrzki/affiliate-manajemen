// /*
// Tujuan: Halaman Riwayat Konten (Server Component) untuk menyajikan log performa video terpaginasi dengan pencarian, filter tanggal, & kontrol Live Scraper.
// Caller: Route /history
// Dependensi: lib/db/index.ts, lib/supabase/server.ts, types/index.ts, components/layout/Topbar.tsx, components/history/ScraperPanel.tsx, components/history/ContentHistoryTable.tsx
// Main Functions: ContentHistoryPage
// Side Effects: Mengambil data konten terpaginasi & terfilter, serta data master produk dari SQLite lokal.
// */

import React from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { contents as contentsTable, products as productsTable } from "@/lib/db/schema";
import { eq, desc, and, gte, lte, like, or, count } from "drizzle-orm";
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
  }>;
}

export default async function ContentHistoryPage({ searchParams }: PageProps) {
  const supabase = await createClient();

  // 1. Verifikasi User
  const {
    data: { user },
  } = await supabase.auth.getUser();

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

  // 4. Hitung total data terfilter
  const totalCountResult = await db
    .select({ value: count() })
    .from(contentsTable)
    .where(and(...conditions)!);

  const totalRows = totalCountResult[0]?.value || 0;
  const totalPages = Math.ceil(totalRows / limitNum);

  // 5. Fetch data konten terpaginasi
  const contents = await db
    .select()
    .from(contentsTable)
    .where(and(...conditions)!)
    .orderBy(desc(contentsTable.tanggal_upload))
    .limit(limitNum)
    .offset(offsetNum);

  const typedContents = (contents || []) as unknown as Content[];

  // 6. Fetch seluruh data produk master untuk user dari SQLite lokal (untuk dropdown)
  const products = await db
    .select()
    .from(productsTable)
    .where(eq(productsTable.user_id, user.id))
    .orderBy(productsTable.nama);

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
        />
      </div>
    </div>
  );
}
