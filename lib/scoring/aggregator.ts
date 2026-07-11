// /*
// Tujuan: Mengagregasi metrik performa produk (order, konten, kolaborasi) secara efisien dari database SQLite serta mendukung simulasi riwayat virtual.
// Caller: lib/scoring/index.ts
// Dependensi: lib/db/index.ts, lib/db/schema.ts, drizzle-orm, lib/scoring/types.ts
// Main Functions: aggregateProducts (dengan dukungan parameter virtualHistory)
// Side Effects: Membaca database (DB read-only)
// */

import { db } from "../db";
import { products, sales_data, contents } from "../db/schema";
import { eq, and, sql } from "drizzle-orm";
import { ProductAggregate } from "./types";

/**
 * Mengambil dan mengagregasi data performa semua produk milik user tertentu.
 * @param userId ID pengguna aktif
 * @param referenceDate Tanggal referensi kalkulasi (biasanya waktu saat ini)
 * @param virtualHistory Data riwayat konten simulasi di memori
 */
export async function aggregateProducts(
  userId: string,
  referenceDate: Date,
  virtualHistory?: Map<string, string[]>
): Promise<{
  aggregates: ProductAggregate[];
  contentTrackingStart: string | null;
}> {
  const refTime = referenceDate.getTime();
  const date14dAgo = new Date(refTime - 14 * 24 * 60 * 60 * 1000).toISOString();
  const date28dAgo = new Date(refTime - 28 * 24 * 60 * 60 * 1000).toISOString();

  // 1. Ambil semua master produk milik user
  const allProducts = await db
    .select()
    .from(products)
    .where(eq(products.user_id, userId));

  if (allProducts.length === 0) {
    return { aggregates: [], contentTrackingStart: null };
  }

  // 2. Ambil agregat order per produk
  const ordersAgg = await db
    .select({
      product_id: sales_data.product_id,
      total_orders: sql<number>`count(${sales_data.order_id})`,
      total_items_sold: sql<number>`sum(${sales_data.items_sold})`,
      last_order_date: sql<string | null>`max(${sales_data.ordered_at})`,
      orders_14d: sql<number>`sum(case when ${sales_data.ordered_at} >= ${date14dAgo} then 1 else 0 end)`,
      orders_14d_prev: sql<number>`sum(case when ${sales_data.ordered_at} >= ${date28dAgo} and ${sales_data.ordered_at} < ${date14dAgo} then 1 else 0 end)`,
    })
    .from(sales_data)
    .where(eq(sales_data.user_id, userId))
    .groupBy(sales_data.product_id);

  // Map untuk akses cepat order
  const ordersMap = new Map<string, typeof ordersAgg[0]>();
  ordersAgg.forEach((row) => {
    if (row.product_id) {
      ordersMap.set(row.product_id, row);
    }
  });

  // 3. Ambil semua riwayat konten bertarget produk dari DB
  const allContents = await db
    .select({
      product_id: contents.product_id,
      tanggal_upload: contents.tanggal_upload,
    })
    .from(contents)
    .where(and(eq(contents.user_id, userId), sql`${contents.product_id} is not null`));

  // Map product_id -> array of upload dates
  const productContentsListMap = new Map<string, string[]>();
  allContents.forEach((c) => {
    if (c.product_id) {
      const list = productContentsListMap.get(c.product_id) || [];
      list.push(c.tanggal_upload);
      productContentsListMap.set(c.product_id, list);
    }
  });

  // Gabungkan dengan simulasi riwayat konten virtual (untuk simulasi multi-hari)
  if (virtualHistory) {
    for (const [prodId, virtualDates] of virtualHistory.entries()) {
      const list = productContentsListMap.get(prodId) || [];
      const formattedVirtual = virtualDates.map((d) =>
        d.includes("T") ? d : `${d}T09:00:00.000Z`
      );
      productContentsListMap.set(prodId, [...list, ...formattedVirtual]);
    }
  }

  // 4. Ambil data tracking konten paling awal secara global
  const earliestContent = await db
    .select({
      earliest: sql<string | null>`min(${contents.tanggal_upload})`,
    })
    .from(contents)
    .where(eq(contents.user_id, userId));
  
  const contentTrackingStart = earliestContent[0]?.earliest || null;

  const time14d = new Date(date14dAgo).getTime();
  const time28d = new Date(date28dAgo).getTime();

  // 5. Satukan data ke interface ProductAggregate
  const aggregates: ProductAggregate[] = allProducts.map((p) => {
    const oData = ordersMap.get(p.product_id);
    const resetTestingAt = p.reset_testing_at ? new Date(p.reset_testing_at).getTime() : null;
    const rawUploadDates = productContentsListMap.get(p.product_id) || [];

    // Saring uploadDates berdasarkan tanggal reset_testing_at milik produk
    const uploadDates = rawUploadDates.filter((d) => {
      if (resetTestingAt) {
        return new Date(d).getTime() > resetTestingAt;
      }
      return true;
    });

    // Hitung DSLO (Days Since Last Order)
    let dslo = 9999;
    if (oData && oData.last_order_date) {
      const diffMs = refTime - new Date(oData.last_order_date).getTime();
      dslo = Math.max(0, Math.floor(diffMs / (24 * 60 * 60 * 1000)));
    }

    // Hitung metrik agregat konten di memory
    const total_content = uploadDates.length;
    let last_content_date: string | null = null;
    let dslc = 9999;
    let content_14d = 0;
    let content_14d_prev = 0;

    if (uploadDates.length > 0) {
      // Cari tanggal upload terakhir
      const sortedDates = [...uploadDates].sort(
        (a, b) => new Date(b).getTime() - new Date(a).getTime()
      );
      last_content_date = sortedDates[0];
      
      const diffMs = refTime - new Date(last_content_date).getTime();
      dslc = Math.max(0, Math.floor(diffMs / (24 * 60 * 60 * 1000)));

      // Hitung pembagian konten 14 hari
      uploadDates.forEach((d) => {
        const time = new Date(d).getTime();
        if (time >= time14d && time <= refTime) {
          content_14d++;
        } else if (time >= time28d && time < time14d) {
          content_14d_prev++;
        }
      });
    }

    // Hitung usia produk dalam hari sejak ditambahkan
    const ageMs = refTime - new Date(p.date_added).getTime();
    const product_age_days = Math.max(0, Math.floor(ageMs / (24 * 60 * 60 * 1000)));

    // Hitung konten yang diposting dalam periode kolaborasi
    let collab_content_posted = 0;
    if (p.is_collaboration && p.collab_start_date && p.collab_deadline) {
      const start = new Date(p.collab_start_date).getTime();
      const end = new Date(p.collab_deadline).getTime();
      collab_content_posted = uploadDates.filter((d) => {
        const time = new Date(d).getTime();
        return time >= start && time <= end;
      }).length;
    }

    return {
      product_id: p.product_id,
      product_name: p.product_name,
      date_added: p.date_added,
      stock_status: p.stock_status,
      status: p.status,
      is_collaboration: p.is_collaboration,
      collab_target_count: p.collab_target_count,
      collab_deadline: p.collab_deadline,
      collab_start_date: p.collab_start_date,

      // Order metrics
      total_orders: oData?.total_orders || 0,
      total_items_sold: oData?.total_items_sold || 0,
      last_order_date: oData?.last_order_date || null,
      dslo,
      orders_14d: oData?.orders_14d || 0,
      orders_14d_prev: oData?.orders_14d_prev || 0,

      // Content metrics
      total_content,
      last_content_date,
      dslc,
      content_14d,
      content_14d_prev,

      // Derived
      has_ever_sold: (oData?.total_orders || 0) > 0,
      product_age_days,
      collab_content_posted,
    };
  });

  return { aggregates, contentTrackingStart };
}
