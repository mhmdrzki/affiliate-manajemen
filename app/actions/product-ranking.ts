// /*
// Tujuan: Server Action untuk mengambil ranking produk berdasarkan total items sold dalam rentang waktu tertentu.
// Caller: components/import/ProductRankingPanel.tsx
// Dependensi: lib/db/index.ts, lib/db/schema.ts, lib/auth.ts, drizzle-orm
// Main Functions: getProductRankingAction
// Side Effects: Read-only query ke tabel sales_data + products.
// */

"use server";

import { getMockUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { sales_data, products } from "@/lib/db/schema";
import { eq, and, gte, lte, sql, desc } from "drizzle-orm";

export interface RankedProduct {
  rank: number;
  product_id: string;
  product_name: string;
  shop_name: string | null;
  total_items_sold: number;
  total_orders: number;
  total_gmv: number;
  total_est_commission: number;
}

interface RankingResult {
  success: boolean;
  message: string;
  data?: RankedProduct[];
  summary?: {
    total_products: number;
    total_orders: number;
    total_items_sold: number;
    total_gmv: number;
    total_commission: number;
  };
}

export async function getProductRankingAction(filters: {
  startDate: string;
  endDate: string;
}): Promise<RankingResult> {
  const user = await getMockUser();
  if (!user) {
    return { success: false, message: "Sesi habis, silakan login ulang." };
  }

  if (!filters.startDate || !filters.endDate) {
    return { success: false, message: "Tanggal mulai dan akhir wajib diisi." };
  }

  try {
    const conditions = [
      eq(sales_data.user_id, user.id),
      gte(sales_data.ordered_at, `${filters.startDate}T00:00:00.000Z`),
      lte(sales_data.ordered_at, `${filters.endDate}T23:59:59.999Z`),
    ];

    // Aggregate GROUP BY product_id — ranking by total items_sold DESC
    const rows = await db
      .select({
        product_id: sales_data.product_id,
        product_name: products.product_name,
        shop_name: products.shop_name,
        total_items_sold: sql<number>`COALESCE(SUM(${sales_data.items_sold}), 0)`.as("total_items_sold"),
        total_orders: sql<number>`COUNT(*)`.as("total_orders"),
        total_gmv: sql<number>`COALESCE(SUM(${sales_data.gmv}), 0)`.as("total_gmv"),
        total_est_commission: sql<number>`COALESCE(SUM(${sales_data.est_commission}), 0)`.as("total_est_commission"),
      })
      .from(sales_data)
      .leftJoin(products, eq(sales_data.product_id, products.product_id))
      .where(and(...conditions)!)
      .groupBy(sales_data.product_id)
      .orderBy(desc(sql`total_items_sold`));

    // Assign ranking number
    const ranked: RankedProduct[] = rows.map((r, idx) => ({
      rank: idx + 1,
      product_id: r.product_id || "unknown",
      product_name: r.product_name || "Produk Tidak Diketahui",
      shop_name: r.shop_name || null,
      total_items_sold: Number(r.total_items_sold) || 0,
      total_orders: Number(r.total_orders) || 0,
      total_gmv: Number(r.total_gmv) || 0,
      total_est_commission: Number(r.total_est_commission) || 0,
    }));

    // Summary totals
    const summary = {
      total_products: ranked.length,
      total_orders: ranked.reduce((s, r) => s + r.total_orders, 0),
      total_items_sold: ranked.reduce((s, r) => s + r.total_items_sold, 0),
      total_gmv: ranked.reduce((s, r) => s + r.total_gmv, 0),
      total_commission: ranked.reduce((s, r) => s + r.total_est_commission, 0),
    };

    return {
      success: true,
      message: `Berhasil mengambil ranking ${ranked.length} produk.`,
      data: ranked,
      summary,
    };
  } catch (err: any) {
    return {
      success: false,
      message: err.message || "Gagal mengambil data ranking produk.",
    };
  }
}
