// /*
// Tujuan: Server Action untuk mengolah impor data rekap pesanan afiliasi TikTok Shop (bulk import), menyimpan riwayat, dan membatalkannya.
// Caller: Halaman uploader impor data (/import)
// Dependensi: lib/db/index.ts, lib/supabase/server.ts, lib/utils/excel.ts, lib/scoring/engine.ts, next/cache (revalidatePath)
// Main Functions: importAffiliateOrdersAction, getImportLogsAction, deleteImportLogAction, recomputeProductAndContentMetrics
// Side Effects: Menulis ke tabel products, contents, orders, import_logs di SQLite lokal, dan menghitung ulang skor produk.
// */

"use server";

import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { products, contents, orders, import_logs, stock_history } from "@/lib/db/schema";
import { eq, and, inArray, desc } from "drizzle-orm";
import { parseTikTokNumber, parseTikTokDate, detectBrand, detectJenis } from "@/lib/utils/excel";
import {
  computeOrderBasedStats,
  computeCompositeScore,
  classifyProduct,
  calcWeeklyQuota,
  generateRecommendation,
  slotR
} from "@/lib/scoring/engine";
import { Product, Order, StockHistory } from "@/types";
import { ActionResponse } from "./products";
import { revalidatePath } from "next/cache";

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
  const supabase = await createClient();

  // 1. Verifikasi User
  const {
    data: { user },
  } = await supabase.auth.getUser();

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
  let inserted = 0;
  let updated = 0;
  let skipped = 0;
  let skippedIneligible = 0;

  try {
    // --- TAHAP 1: PARSING & FILTER DATA RAW ---
    const parsedOrders = [];
    const uniqueTikTokProductIds = new Set<string>();
    const uniqueTikTokContentIds = new Set<string>();

    for (const row of rows) {
      const orderId = String(row["Order ID"] || "").trim();
      if (!orderId || orderId.length < 5 || orderId.toLowerCase() === "order id") {
        continue;
      }

      const settlementStatus = String(row["Order settlement status"] || "").trim();
      if (settlementStatus === "Ineligible") {
        skippedIneligible++;
        continue; // Abaikan total
      }

      const orderTypeRaw = String(row["Order type"] || "").trim();
      const orderType = orderTypeRaw.includes("Shop ads") ? "shop_ads" : "affiliate";

      const commRateStr = String(row["Standard"] || "0").trim();
      const commRate = parseFloat(commRateStr.replace("%", "")) || 0;

      const orderDateStr = String(row["Order date"] || "").trim();
      const orderDate = parseTikTokDate(orderDateStr);

      const settDateStr = String(row["Commission settlement date"] || "").trim();
      const settlementDate = (settDateStr === "/" || !settDateStr) ? null : parseTikTokDate(settDateStr);

      const price = parseTikTokNumber(row["Price"]);
      const gmv = parseTikTokNumber(row["GMV"]);
      const estComm = parseTikTokNumber(row["Est. standard commission"]);
      const totalFinal = parseTikTokNumber(row["Total final earned amount"] || row["Est. standard commission"]); // fallback

      const tiktokProductId = String(row["Product ID"] || "").trim();
      const tiktokContentId = String(row["Content ID"] || "").trim();

      if (tiktokProductId) uniqueTikTokProductIds.add(tiktokProductId);
      if (tiktokContentId) uniqueTikTokContentIds.add(tiktokContentId);

      parsedOrders.push({
        tiktok_order_id: orderId,
        tiktok_product_id: tiktokProductId,
        product_name: String(row["Product name"] || "").trim(),
        sku_id: String(row["SKU ID"] || "").trim(),
        content_id: tiktokContentId,
        content_type: String(row["Content Type"] || "Video").trim(),
        items_sold: parseInt(row["Items sold"]) || 0,
        items_refunded: parseInt(row["Items refunded"]) || 0,
        price,
        gmv,
        est_commission: estComm,
        actual_commission: settlementStatus === "Settled" ? totalFinal : 0,
        total_final_earned: totalFinal,
        order_type: orderType as "shop_ads" | "affiliate",
        settlement_status: settlementStatus as "Settled" | "Pending" | "AwaitingPayment",
        commission_rate: commRate,
        shop_name: String(row["Shop name"] || "").trim(),
        shop_code: String(row["Shop code"] || "").trim(),
        order_date: orderDate || new Date().toISOString(),
        settlement_date: settlementDate,
      });
    }

    if (parsedOrders.length === 0) {
      return {
        success: true,
        inserted: 0,
        updated: 0,
        skipped: 0,
        skippedIneligible,
        message: `Impor selesai. Tidak ada order valid yang diimpor (melompati ${skippedIneligible} pesanan berstatus Ineligible).`
      };
    }

    // Deduplicate parsedOrders by tiktok_order_id + sku_id locally first
    const dedupedParsedOrders = [];
    const seenOrderSkuKeys = new Set<string>();
    
    for (const o of parsedOrders) {
      const key = `${o.tiktok_order_id}_${o.sku_id}`;
      if (!seenOrderSkuKeys.has(key)) {
        seenOrderSkuKeys.add(key);
        dedupedParsedOrders.push(o);
      } else {
        skipped++;
      }
    }

    // --- TAHAP 2: DEDUP CHECK ---
    const orderIds = dedupedParsedOrders.map((o) => o.tiktok_order_id);
    
    const existingOrders = orderIds.length > 0
      ? await db
          .select({
            tiktok_order_id: orders.tiktok_order_id,
            sku_id: orders.sku_id,
            settlement_status: orders.settlement_status,
          })
          .from(orders)
          .where(and(eq(orders.user_id, userId), inArray(orders.tiktok_order_id, orderIds)))
      : [];

    const existingMap = new Map<string, string>();
    existingOrders.forEach((o) => {
      existingMap.set(`${o.tiktok_order_id}_${o.sku_id}`, o.settlement_status || "Pending");
    });

    const newOrdersToInsert = [];
    const ordersToUpdateStatus = [];

    for (const parsed of dedupedParsedOrders) {
      const key = `${parsed.tiktok_order_id}_${parsed.sku_id}`;
      if (existingMap.has(key)) {
        const oldStatus = existingMap.get(key);
        if (oldStatus !== parsed.settlement_status) {
          ordersToUpdateStatus.push(parsed);
          updated++;
        } else {
          skipped++;
        }
      } else {
        newOrdersToInsert.push(parsed);
        inserted++;
      }
    }

    // --- TAHAP 3: RESOLVE PRODUCTS ---
    const tiktokProductIds = Array.from(uniqueTikTokProductIds);
    const existingProducts = tiktokProductIds.length > 0
      ? await db
          .select({ id: products.id, tiktok_product_id: products.tiktok_product_id })
          .from(products)
          .where(and(eq(products.user_id, userId), inArray(products.tiktok_product_id, tiktokProductIds)))
      : [];

    const productMap = new Map<string, string>();
    existingProducts.forEach((p) => {
      if (p.tiktok_product_id) {
        productMap.set(p.tiktok_product_id, p.id);
      }
    });

    const productsToAutoCreate = [];
    for (const tid of tiktokProductIds) {
      if (!productMap.has(tid)) {
        const sample = parsedOrders.find((o) => o.tiktok_product_id === tid);
        if (sample) {
          productsToAutoCreate.push({
            user_id: userId,
            tiktok_product_id: tid,
            nama: sample.product_name,
            brand: detectBrand(sample.product_name),
            jenis: detectJenis(sample.product_name),
            harga: sample.price,
            komisi: sample.commission_rate,
            shop_name: sample.shop_name,
            shop_code: sample.shop_code,
            kategori: "Umum",
            status: "aktif",
            label_prestasi: "-",
            klasifikasi: "NEW",
          });
        }
      }
    }

    if (productsToAutoCreate.length > 0) {
      const toInsert = productsToAutoCreate.map(p => ({
        id: crypto.randomUUID(),
        ...p,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }));

      const createdProducts = await db.insert(products).values(toInsert).returning({
        id: products.id,
        tiktok_product_id: products.tiktok_product_id,
      });

      createdProducts.forEach((p) => {
        if (p.tiktok_product_id) {
          productMap.set(p.tiktok_product_id, p.id);
        }
      });
    }

    // --- TAHAP 4: RESOLVE CONTENTS ---
    const tiktokContentIds = Array.from(uniqueTikTokContentIds);
    const existingContents = tiktokContentIds.length > 0
      ? await db
          .select({ id: contents.id, tiktok_content_id: contents.tiktok_content_id })
          .from(contents)
          .where(and(eq(contents.user_id, userId), inArray(contents.tiktok_content_id, tiktokContentIds)))
      : [];

    const contentMap = new Map<string, string>();
    existingContents.forEach((c) => {
      if (c.tiktok_content_id) {
        contentMap.set(c.tiktok_content_id, c.id);
      }
    });

    const contentsToAutoCreate = [];
    for (const cid of tiktokContentIds) {
      if (!contentMap.has(cid)) {
        const sample = parsedOrders.find((o) => o.content_id === cid);
        contentsToAutoCreate.push({
          user_id: userId,
          tiktok_content_id: cid,
          content_type: sample?.content_type || "Video",
          tanggal_upload: sample?.order_date || new Date().toISOString(),
        });
      }
    }

    if (contentsToAutoCreate.length > 0) {
      const toInsert = contentsToAutoCreate.map(c => ({
        id: crypto.randomUUID(),
        ...c,
        created_at: new Date().toISOString(),
      }));

      const createdContents = await db.insert(contents).values(toInsert).returning({
        id: contents.id,
        tiktok_content_id: contents.tiktok_content_id,
      });

      createdContents.forEach((c) => {
        if (c.tiktok_content_id) {
          contentMap.set(c.tiktok_content_id, c.id);
        }
      });
    }

    // --- TAHAP 4.5: CREATE IMPORT LOG ENTRY ---
    let importLogId = null;
    if (newOrdersToInsert.length > 0 || ordersToUpdateStatus.length > 0) {
      const newLog = {
        id: crypto.randomUUID(),
        user_id: userId,
        filename: filename,
        inserted_count: inserted,
        updated_count: updated,
        skipped_count: skipped,
        created_at: new Date().toISOString(),
      };
      await db.insert(import_logs).values(newLog);
      importLogId = newLog.id;
    }

    // --- TAHAP 5: INSERT & UPDATE ORDERS ---
    if (newOrdersToInsert.length > 0) {
      const finalOrdersToInsert = newOrdersToInsert.map((o) => ({
        id: crypto.randomUUID(),
        user_id: userId,
        tiktok_order_id: o.tiktok_order_id,
        product_id: productMap.get(o.tiktok_product_id) || null,
        content_id: contentMap.get(o.content_id) || null,
        sku_id: o.sku_id,
        product_name: o.product_name,
        items_sold: o.items_sold,
        items_refunded: o.items_refunded,
        price: o.price,
        gmv: o.gmv,
        order_type: o.order_type,
        settlement_status: o.settlement_status,
        commission_rate: o.commission_rate,
        est_commission: o.est_commission,
        actual_commission: o.actual_commission,
        total_final_earned: o.total_final_earned,
        shop_name: o.shop_name,
        shop_code: o.shop_code,
        order_date: o.order_date,
        settlement_date: o.settlement_date,
        import_log_id: importLogId,
        created_at: new Date().toISOString(),
      }));

      for (let i = 0; i < finalOrdersToInsert.length; i += 500) {
        const chunk = finalOrdersToInsert.slice(i, i + 500);
        await db.insert(orders).values(chunk);
      }
    }

    if (ordersToUpdateStatus.length > 0) {
      for (const item of ordersToUpdateStatus) {
        await db
          .update(orders)
          .set({
            settlement_status: item.settlement_status,
            actual_commission: item.settlement_status === "Settled" ? item.total_final_earned : 0,
            total_final_earned: item.total_final_earned,
            settlement_date: item.settlement_date,
          })
          .where(and(
            eq(orders.user_id, userId),
            eq(orders.tiktok_order_id, item.tiktok_order_id),
            eq(orders.sku_id, item.sku_id)
          ));
      }
    }

    // --- TAHAP 6: RECOMPUTE SCORING ENGINE ---
    await recomputeProductAndContentMetrics(userId);

    revalidatePath("/import");
    revalidatePath("/products");
    revalidatePath("/");

    return {
      success: true,
      inserted,
      updated,
      skipped,
      skippedIneligible,
      message: `Impor berhasil! Berhasil menambah +${inserted} order baru, mengupdate ${updated} status order, melompati ${skipped} duplikat, dan mengabaikan ${skippedIneligible} order Ineligible.`
    };
  } catch (err: any) {
    return {
      success: false,
      inserted: 0,
      updated: 0,
      skipped: 0,
      skippedIneligible: 0,
      message: `Gagal memproses impor: ${err.message}`
    };
  }
}

/**
 * Menghitung ulang seluruh statistik & skor produk serta performa konten berdasarkan order saat ini.
 */
export async function recomputeProductAndContentMetrics(
  userId: string
): Promise<void> {
  const updatedProducts = await db
    .select()
    .from(products)
    .where(eq(products.user_id, userId));

  const allOrders = await db
    .select()
    .from(orders)
    .where(eq(orders.user_id, userId));

  const allContents = await db
    .select()
    .from(contents)
    .where(eq(contents.user_id, userId));

  const allStockHistory = (await db
    .select({
      id: stock_history.id,
      product_id: stock_history.product_id,
      status: stock_history.status,
      changed_at: stock_history.changed_at,
      changed_by: stock_history.changed_by,
      notes: stock_history.notes,
    })
    .from(stock_history)
    .innerJoin(products, eq(stock_history.product_id, products.id))
    .where(eq(products.user_id, userId))) as unknown as StockHistory[];

  const typedProducts = updatedProducts as unknown as Product[];
  const typedOrders = allOrders as unknown as Order[];

  for (const p of typedProducts) {
    const productOrders = typedOrders.filter((o) => o.product_id === p.id);
    const productHistory = allStockHistory.filter((sh) => sh.product_id === p.id);
    const productContents = allContents.filter((c) => c.product_id === p.id);

    const stats = computeOrderBasedStats(productOrders, p, productHistory, productContents);
    const score = computeCompositeScore(stats);
    const klas = classifyProduct(stats, score, p);
    const kuota = calcWeeklyQuota(klas, score, p.is_kerjasama || false, p.kerjasama_target || 0);
    const slot = slotR(klas);
    const rec = generateRecommendation(klas, stats);

    await db
      .update(products)
      .set({
        bench_score: score,
        topsis_score: score / 100,
        klasifikasi: klas,
        kuota_mingguan: kuota,
        slot_rek: slot,
        aksi_rekomendasi: rec,
        total_orders: stats.totalOrders,
        net_items_sold: stats.netItemsSold,
        total_revenue: stats.totalRevenue,
        total_refunded: stats.totalRefunded,
        avg_commission_rate: stats.avgCommissionRate,
        shop_ads_ratio: stats.shopAdsRatio,
        regularity_score: stats.regularityScore,
        gmv_aktif: stats.shopAdsRatio > 0.3,
        harga: Math.round(stats.avgPrice || p.harga || 0),
      })
      .where(eq(products.id, p.id));
  }

  // Update contents summary table
  const contentIds = Array.from(new Set(typedOrders.map(o => o.content_id).filter(Boolean))) as string[];
  for (const cid of contentIds) {
    const filtered = typedOrders.filter(o => o.content_id === cid);
    const totalOrd = filtered.length;
    const totalRev = filtered.reduce((s, o) => s + (o.est_commission || 0), 0);

    await db
      .update(contents)
      .set({
        total_orders: totalOrd,
        total_revenue: totalRev
      })
      .where(eq(contents.id, cid));
  }
}

/**
 * Mendapatkan daftar riwayat impor log milik user
 */
export async function getImportLogsAction(): Promise<ActionResponse<any[]>> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: "Sesi habis, silakan login ulang." };
  }

  try {
    const data = await db
      .select()
      .from(import_logs)
      .where(eq(import_logs.user_id, user.id))
      .orderBy(desc(import_logs.created_at));

    return {
      success: true,
      message: "Riwayat impor berhasil dimuat.",
      data: data || [],
    };
  } catch (err: any) {
    return {
      success: false,
      message: err.message || "Gagal memuat riwayat impor.",
    };
  }
}

/**
 * Membatalkan / menghapus riwayat impor tertentu (cascade orders) dan menghitung ulang skor
 */
export async function deleteImportLogAction(
  logId: string
): Promise<ActionResponse> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: "Sesi habis, silakan login ulang." };
  }

  try {
    // 1. Hapus entri log (SQLite dengan CASCADE akan menghapus orders baru yang berelasi)
    await db
      .delete(import_logs)
      .where(and(eq(import_logs.id, logId), eq(import_logs.user_id, user.id)));

    // 2. Hitung ulang statistik produk & konten
    await recomputeProductAndContentMetrics(user.id);

    revalidatePath("/import");
    revalidatePath("/products");
    revalidatePath("/");

    return {
      success: true,
      message: "Riwayat impor berhasil dibatalkan dan seluruh statistik produk telah dihitung ulang.",
    };
  } catch (err: any) {
    return {
      success: false,
      message: err.message || "Gagal membatalkan riwayat impor.",
    };
  }
}

