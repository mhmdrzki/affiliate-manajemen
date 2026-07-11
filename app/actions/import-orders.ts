// /*
// Tujuan: Server Action untuk mengolah impor & query data rekap penjualan (sales_data) TikTok Affiliate.
// Caller: Halaman uploader impor data (/import)
// Dependensi: lib/db/index.ts, lib/auth.ts, lib/utils/sales-parser.ts, lib/scoring/engine.ts, next/cache (revalidatePath)
// Main Functions: importAffiliateOrdersAction, getImportLogsAction, deleteImportLogAction, recomputeProductAndContentMetrics, getAllFilteredOrdersAction
// Side Effects: Menulis ke tabel products dan sales_data di SQLite lokal, dan menghitung ulang skor produk.
// */

"use server";

import { getMockUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { products, contents, sales_data, import_logs } from "@/lib/db/schema";
import { eq, and, inArray, desc, or, gte, lte, like } from "drizzle-orm";
import { parseSalesRows } from "@/lib/utils/sales-parser";
import { recalculateProductAnalytics } from "./products";
import { Product, Order } from "@/types";
import { ActionResponse } from "./products";
import { revalidatePath } from "next/cache";
import crypto from "crypto";

export interface ImportOrdersResult {
  success: boolean;
  inserted: number;
  updated: number;
  skipped: number;
  skippedIneligible: number;
  message: string;
}

export async function importAffiliateOrdersAction(
  rows: any[],
  filename: string
): Promise<ImportOrdersResult> {
  const user = await getMockUser();

  if (!user) {
    return {
      success: false,
      inserted: 0,
      updated: 0,
      skipped: 0,
      skippedIneligible: 0,
      message: "Sesi habis, silakan login ulang."
    };
  }

  const userId = user.id;

  try {
    // --- TAHAP 1: PARSING & FILTER DATA RAW menggunakan sales-parser ---
    let parsedResult;
    try {
      parsedResult = parseSalesRows(rows);
    } catch (err: any) {
      return {
        success: false,
        inserted: 0,
        updated: 0,
        skipped: 0,
        skippedIneligible: 0,
        message: err.message || "Gagal memproses file impor data."
      };
    }

    const { rows: parsedRows, ineligibleCount: skippedIneligible } = parsedResult;

    if (parsedRows.length === 0) {
      return {
        success: true,
        inserted: 0,
        updated: 0,
        skipped: 0,
        skippedIneligible,
        message: `Impor selesai. Tidak ada order valid yang diimpor (mengabaikan ${skippedIneligible} pesanan berstatus Ineligible).`
      };
    }

    // --- TAHAP 1.5: KONSOLIDASI MULTI-ITEM/VARIAN ---
    // Mengonsolidasikan baris dengan order_id & product_id yang sama dengan menjumlahkan data numerik
    const consolidatedMap = new Map<string, any>();
    for (const r of parsedRows) {
      const key = `${r.order_id}::${r.product_id || ""}`;
      if (consolidatedMap.has(key)) {
        const existing = consolidatedMap.get(key);
        existing.items_sold += r.items_sold;
        existing.gmv += r.gmv;
        existing.est_commission += r.est_commission;
        existing.actual_commission += r.actual_commission;
      } else {
        consolidatedMap.set(key, { ...r });
      }
    }
    const consolidatedRows = Array.from(consolidatedMap.values());

    // --- TAHAP 2: DEDUP CHECK ---
    const orderIds = Array.from(new Set(consolidatedRows.map((o) => o.order_id)));
    const existingOrders = orderIds.length > 0
      ? await db
          .select({ order_id: sales_data.order_id, product_id: sales_data.product_id })
          .from(sales_data)
          .where(and(eq(sales_data.user_id, userId), inArray(sales_data.order_id, orderIds)))
      : [];

    const existingKeysSet = new Set(existingOrders.map(o => `${o.order_id}::${o.product_id || ""}`));

    // --- TAHAP 3: RESOLVE PRODUCTS ---
    const rawProductIds = Array.from(new Set(consolidatedRows.map(r => r.product_id).filter(Boolean))) as string[];
    const existingProducts = rawProductIds.length > 0
      ? await db
          .select({ product_id: products.product_id })
          .from(products)
          .where(and(eq(products.user_id, userId), inArray(products.product_id, rawProductIds)))
      : [];

    const productMap = new Map<string, string>();
    existingProducts.forEach((p) => {
      productMap.set(p.product_id, p.product_id);
    });

    const productsToAutoCreate = [];
    let productsUpdatedCount = 0;

    // Update existing products information
    if (existingProducts.length > 0) {
      for (const p of existingProducts) {
        const tid = p.product_id;
        const sample = consolidatedRows.find((o) => o.product_id === tid);
        if (sample) {
          await db
            .update(products)
            .set({
              product_name: sample.product_name || "Produk Auto-Created",
              shop_name: sample.shop_name || "Toko Auto-Created",
              shop_code: sample.shop_code,
              updated_at: new Date().toISOString(),
            })
            .where(and(eq(products.product_id, p.product_id), eq(products.user_id, userId)));
          productsUpdatedCount++;
        }
      }
    }

    for (const tid of rawProductIds) {
      if (!productMap.has(tid)) {
        const sample = consolidatedRows.find((o) => o.product_id === tid);
        if (sample) {
          productsToAutoCreate.push({
            user_id: userId,
            product_id: tid,
            product_name: sample.product_name || "Produk Auto-Created",
            shop_name: sample.shop_name || "Toko Auto-Created",
            shop_code: sample.shop_code,
            category: "Umum",
            status: "active",
          });
        }
      }
    }

    if (productsToAutoCreate.length > 0) {
      const toInsert = productsToAutoCreate.map(p => ({
        ...p,
        stock_status: "available" as const,
        date_added: new Date().toISOString().split("T")[0],
        is_collaboration: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }));

      const createdProducts = await db.insert(products).values(toInsert).returning({
        product_id: products.product_id,
      });

      createdProducts.forEach((p) => {
        productMap.set(p.product_id, p.product_id);
      });
    }

    // --- TAHAP 4: RESOLVE CONTENTS (Jangan auto-create content!) ---
    const rawContentIds = Array.from(new Set(consolidatedRows.map(r => r.video_id).filter(Boolean))) as string[];
    const existingContents = rawContentIds.length > 0
      ? await db
          .select({ tiktok_content_id: contents.tiktok_content_id })
          .from(contents)
          .where(and(eq(contents.user_id, userId), inArray(contents.tiktok_content_id, rawContentIds)))
      : [];

    const contentMap = new Set<string>();
    existingContents.forEach((c) => {
      if (c.tiktok_content_id) {
        contentMap.add(c.tiktok_content_id);
      }
    });

    // Generate Import Batch ID
    const importId = "imp_" + crypto.randomBytes(8).toString("hex");

    let inserted = 0;
    let skipped = 0;
    const finalRowsToInsert: any[] = [];
    const seenKeysInBatch = new Set<string>();

    for (const o of consolidatedRows) {
      const key = `${o.order_id}::${o.product_id || ""}`;
      if (existingKeysSet.has(key) || seenKeysInBatch.has(key)) {
        skipped++;
        continue;
      }
      seenKeysInBatch.add(key);

      finalRowsToInsert.push({
        id: "sal_" + crypto.randomBytes(8).toString("hex"),
        order_id: o.order_id,
        product_id: o.product_id ? (productMap.get(o.product_id) || null) : null,
        contents_id: o.video_id ? (contentMap.has(o.video_id) ? o.video_id : null) : null,
        import_id: importId,
        order_type: o.order_type,
        price: o.price,
        items_sold: o.items_sold,
        gmv: o.gmv,
        est_commission: o.est_commission,
        actual_commission: o.actual_commission,
        settlement_status: o.settlement_status,
        ordered_at: o.ordered_at,
        user_id: userId,
        created_at: new Date().toISOString(),
      });
      inserted++;
    }

    if (finalRowsToInsert.length > 0) {
      // Save Import Log
      await db.insert(import_logs).values({
        id: importId,
        user_id: userId,
        filename,
        inserted_count: inserted,
        updated_count: productsUpdatedCount,
        skipped_count: skipped,
      });

      // Chunk inserts in case there are too many variables (SQLite limits)
      const chunkSize = 200;
      for (let i = 0; i < finalRowsToInsert.length; i += chunkSize) {
        const chunk = finalRowsToInsert.slice(i, i + chunkSize);
        await db.insert(sales_data).values(chunk);
      }
    }

    // --- TAHAP 5: RECOMPUTE METRICS & SCORES ---
    await recomputeProductAndContentMetrics(userId);

    safeRevalidatePath("/products");
    safeRevalidatePath("/history");
    safeRevalidatePath("/import");
    safeRevalidatePath("/");

    return {
      success: true,
      inserted,
      updated: productsUpdatedCount,
      skipped,
      skippedIneligible,
      message: `Impor berhasil! Berhasil menambah +${inserted} data penjualan, memperbarui ${productsUpdatedCount} informasi produk, melompati ${skipped} duplikat, dan mengabaikan ${skippedIneligible} baris Ineligible.`
    };
  } catch (err: any) {
    console.error("Gagal melakukan impor data pesanan affiliate:", err);
    return {
      success: false,
      inserted: 0,
      updated: 0,
      skipped: 0,
      skippedIneligible: 0,
      message: err.message || "Gagal melakukan impor data penjualan."
    };
  }
}

/**
 * Mengambil log riwayat impor milik pengguna.
 */
export async function getImportLogsAction() {
  const user = await getMockUser();
  if (!user) return [];

  try {
    return await db
      .select()
      .from(import_logs)
      .where(eq(import_logs.user_id, user.id))
      .orderBy(desc(import_logs.created_at));
  } catch (err) {
    console.error("Gagal mendapatkan log riwayat impor:", err);
    return [];
  }
}

/**
 * Membatalkan/menghapus sebuah log impor beserta pesanan yang terkait dengannya.
 */
export async function deleteImportLogAction(importId: string): Promise<ActionResponse> {
  const user = await getMockUser();
  if (!user) {
    return { success: false, message: "Sesi habis, silakan login ulang." };
  }

  try {
    // 1. Hapus record sales_data yang berasosiasi dengan import_id ini
    await db
      .delete(sales_data)
      .where(and(eq(sales_data.import_id, importId), eq(sales_data.user_id, user.id)));

    // 2. Hapus log riwayat impor itu sendiri
    const deletedLog = await db
      .delete(import_logs)
      .where(and(eq(import_logs.id, importId), eq(import_logs.user_id, user.id)))
      .returning({ filename: import_logs.filename });

    // 3. Re-kalkulasi analitik produk
    await recomputeProductAndContentMetrics(user.id);

    safeRevalidatePath("/products");
    safeRevalidatePath("/history");
    safeRevalidatePath("/import");
    safeRevalidatePath("/");

    const filename = deletedLog[0]?.filename || "file";
    return {
      success: true,
      message: `Berhasil membatalkan impor dan menghapus seluruh pesanan dari berkas "${filename}".`
    };
  } catch (err: any) {
    console.error("Gagal menghapus log impor:", err);
    return {
      success: false,
      message: err.message || "Gagal menghapus log riwayat impor."
    };
  }
}

/**
 * Helper revalidatePath yang aman untuk lingkungan non-Next (unit testing).
 */
function safeRevalidatePath(path: string) {
  try {
    revalidatePath(path);
  } catch (err) {
    // Abaikan jika dijalankan di luar runtime Next (misalnya Vitest)
  }
}

/**
 * Menghitung ulang seluruh statistik & skor produk serta performa konten berdasarkan order saat ini.
 */
export async function recomputeProductAndContentMetrics(
  userId: string
): Promise<void> {
  // Panggil kalkulator analitik produk sederhana
  await recalculateProductAnalytics(userId);
}

/**
 * Mengambil seluruh data pesanan penjualan terfilter milik user aktif tanpa batasan paginasi (untuk ekspor CSV)
 */
export async function getAllFilteredOrdersAction(filters: {
  search?: string;
  startDate?: string;
  endDate?: string;
  productId?: string;
  orderType?: string;
  status?: string;
}): Promise<ActionResponse<any[]>> {
  const user = await getMockUser();
  if (!user) {
    return { success: false, message: "Sesi habis, silakan login ulang." };
  }

  try {
    const conditions = [eq(sales_data.user_id, user.id)];

    if (filters.search) {
      conditions.push(
        or(
          like(sales_data.order_id, `%${filters.search}%`),
          like(products.product_name, `%${filters.search}%`)
        )!
      );
    }

    if (filters.startDate) {
      conditions.push(gte(sales_data.ordered_at, `${filters.startDate}T00:00:00.000Z`));
    }

    if (filters.endDate) {
      conditions.push(lte(sales_data.ordered_at, `${filters.endDate}T23:59:59.999Z`));
    }

    if (filters.productId) {
      conditions.push(eq(sales_data.product_id, filters.productId));
    }

    if (filters.orderType) {
      conditions.push(eq(sales_data.order_type, filters.orderType));
    }

    if (filters.status) {
      conditions.push(eq(sales_data.settlement_status, filters.status));
    }

    const list = await db
      .select({
        order_id: sales_data.order_id,
        product_id: sales_data.product_id,
        product_name: products.product_name,
        contents_id: sales_data.contents_id,
        import_id: sales_data.import_id,
        order_type: sales_data.order_type,
        price: sales_data.price,
        items_sold: sales_data.items_sold,
        gmv: sales_data.gmv,
        est_commission: sales_data.est_commission,
        actual_commission: sales_data.actual_commission,
        settlement_status: sales_data.settlement_status,
        ordered_at: sales_data.ordered_at,
        created_at: sales_data.created_at,
        user_id: sales_data.user_id,
      })
      .from(sales_data)
      .leftJoin(products, eq(sales_data.product_id, products.product_id))
      .where(and(...conditions)!)
      .orderBy(desc(sales_data.ordered_at));

    return {
      success: true,
      message: "Berhasil mengambil data pesanan untuk ekspor.",
      data: list,
    };
  } catch (err: any) {
    return {
      success: false,
      message: err.message || "Gagal mengambil data pesanan.",
    };
  }
}

