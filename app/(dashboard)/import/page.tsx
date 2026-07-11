// /*
// Tujuan: Halaman Server Component untuk mengelola rute impor data, mem-fetch data transaksi & riwayat impor, dan merender ImportPageClient.
// Caller: Route /import
// Dependensi: lib/auth.ts, lib/db/index.ts, lib/db/schema.ts, components/import/ImportPageClient.tsx, drizzle-orm
// Main Functions: ImportPage
// Side Effects: Mengambil data transaksi penjualan, log impor, dan produk master dari SQLite lokal.
// */

import React from "react";
import { redirect } from "next/navigation";
import { getMockUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { sales_data, products as productsTable, import_logs } from "@/lib/db/schema";
import { eq, and, gte, lte, like, or, count, desc } from "drizzle-orm";
import ImportPageClient from "@/components/import/ImportPageClient";

interface PageProps {
  searchParams: Promise<{
    page?: string;
    search?: string;
    startDate?: string;
    endDate?: string;
    limit?: string;
    productId?: string;
    orderType?: string;
    status?: string;
  }>;
}

export default async function ImportPage({ searchParams }: PageProps) {
  const user = await getMockUser();

  if (!user) {
    redirect("/login");
  }

  // 1. Parse Parameters
  const params = await searchParams;
  const pageNum = Math.max(1, parseInt(params.page || "1") || 1);
  const limitNum = Math.min(50, Math.max(15, parseInt(params.limit || "15") || 15));
  const offsetNum = (pageNum - 1) * limitNum;

  const searchVal = params.search || "";
  const startDateVal = params.startDate || "";
  const endDateVal = params.endDate || "";
  const productIdVal = params.productId || "";
  const orderTypeVal = params.orderType || "";
  const statusVal = params.status || "";

  // 2. Build Query Conditions
  const conditions = [eq(sales_data.user_id, user.id)];

  if (searchVal) {
    conditions.push(
      or(
        like(sales_data.order_id, `%${searchVal}%`),
        like(productsTable.product_name, `%${searchVal}%`)
      )!
    );
  }

  if (startDateVal) {
    conditions.push(gte(sales_data.ordered_at, `${startDateVal}T00:00:00.000Z`));
  }

  if (endDateVal) {
    conditions.push(lte(sales_data.ordered_at, `${endDateVal}T23:59:59.999Z`));
  }

  if (productIdVal) {
    conditions.push(eq(sales_data.product_id, productIdVal));
  }

  if (orderTypeVal) {
    conditions.push(eq(sales_data.order_type, orderTypeVal));
  }

  if (statusVal) {
    conditions.push(eq(sales_data.settlement_status, statusVal));
  }

  // 3. Count Total Rows
  const totalCountResult = await db
    .select({ value: count() })
    .from(sales_data)
    .leftJoin(productsTable, eq(sales_data.product_id, productsTable.product_id))
    .where(and(...conditions)!);

  const totalRows = totalCountResult[0]?.value || 0;
  const totalPages = Math.ceil(totalRows / limitNum);

  // 4. Fetch Paginated Sales Data
  const rawOrders = await db
    .select({
      order_id: sales_data.order_id,
      product_id: sales_data.product_id,
      product_name: productsTable.product_name,
      order_type: sales_data.order_type,
      price: sales_data.price,
      items_sold: sales_data.items_sold,
      gmv: sales_data.gmv,
      est_commission: sales_data.est_commission,
      actual_commission: sales_data.actual_commission,
      settlement_status: sales_data.settlement_status,
      ordered_at: sales_data.ordered_at,
    })
    .from(sales_data)
    .leftJoin(productsTable, eq(sales_data.product_id, productsTable.product_id))
    .where(and(...conditions)!)
    .orderBy(desc(sales_data.ordered_at))
    .limit(limitNum)
    .offset(offsetNum);

  // 5. Fetch Import Logs
  const rawLogs = await db
    .select()
    .from(import_logs)
    .where(eq(import_logs.user_id, user.id))
    .orderBy(desc(import_logs.created_at));

  // 6. Fetch Products list for Dropdown
  const rawProducts = await db
    .select({
      product_id: productsTable.product_id,
      product_name: productsTable.product_name,
    })
    .from(productsTable)
    .where(eq(productsTable.user_id, user.id))
    .orderBy(productsTable.product_name);

  return (
    <ImportPageClient
      orders={rawOrders}
      products={rawProducts}
      logs={rawLogs}
      currentPage={pageNum}
      totalPages={totalPages}
      totalRows={totalRows}
      limit={limitNum}
      search={searchVal}
      startDate={startDateVal}
      endDate={endDateVal}
      productId={productIdVal}
      orderType={orderTypeVal}
      status={statusVal}
    />
  );
}

