// /*
// Tujuan: Route Handler untuk upload & import file report XLSX TikTok sales_data.
// Caller: Halaman uploader impor data (/import)
// Dependensi: lib/db/index.ts, lib/db/schema.ts, lib/auth.ts, lib/utils/sales-parser.ts, drizzle-orm
// Main Functions: POST
// Side Effects: Menyimpan data penjualan ke sales_data, mengupdate/auto-create produk
// */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sales_data, products, contents } from "@/lib/db/schema";
import { getMockUser } from "@/lib/auth";
import { parseSalesXlsx } from "@/lib/utils/sales-parser";
import { eq, and, inArray } from "drizzle-orm";
import crypto from "crypto";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const user = await getMockUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = user.id;

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "File tidak ditemukan." }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    let parsedResult;

    try {
      parsedResult = parseSalesXlsx(buffer);
    } catch (parseError: any) {
      return NextResponse.json({ error: parseError.message || "Gagal memproses file." }, { status: 400 });
    }

    const { rows: parsedRows, ineligibleCount: rows_skipped_ineligible } = parsedResult;

    if (parsedRows.length === 0) {
      return NextResponse.json({
        success: true,
        summary: {
          rows_imported: 0,
          rows_skipped_duplicate: 0,
          rows_skipped_ineligible,
          rows_missing_content_match: 0,
        },
      });
    }

    // --- TAHAP 1.5: KONSOLIDASI MULTI-ITEM/VARIAN ---
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

    // --- TAHAP 2: DEDUP CHECK ORDER ID ---
    const orderIds = Array.from(new Set(consolidatedRows.map((r) => r.order_id)));
    const existingOrders = orderIds.length > 0
      ? await db
          .select({ order_id: sales_data.order_id, product_id: sales_data.product_id })
          .from(sales_data)
          .where(and(eq(sales_data.user_id, userId), inArray(sales_data.order_id, orderIds)))
      : [];

    const existingKeysSet = new Set(existingOrders.map((o) => `${o.order_id}::${o.product_id || ""}`));

    // --- TAHAP 3: RESOLVE PRODUCTS (Auto-create if not exists) ---
    const rawProductIds = Array.from(new Set(consolidatedRows.map((r) => r.product_id).filter(Boolean))) as string[];
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
            stock_status: "available" as const,
            date_added: new Date().toISOString().split("T")[0],
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
        }
      }
    }

    if (productsToAutoCreate.length > 0) {
      await db.insert(products).values(productsToAutoCreate);
      productsToAutoCreate.forEach((p) => {
        productMap.set(p.product_id, p.product_id);
      });
    }

    // --- TAHAP 4: RESOLVE CONTENTS (Check match with contents.tiktok_content_id) ---
    const rawContentIds = Array.from(new Set(consolidatedRows.map((r) => r.video_id).filter(Boolean))) as string[];
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

    // --- TAHAP 5: PROCESS & DEDUP BATCH ---
    let rows_imported = 0;
    let rows_skipped_duplicate = 0;
    let rows_missing_content_match = 0;

    const finalRowsToInsert: any[] = [];
    const seenKeysInBatch = new Set<string>();
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    const importBatch = `IMP-${year}${month}${day}`;

    for (const row of consolidatedRows) {
      const key = `${row.order_id}::${row.product_id || ""}`;
      if (existingKeysSet.has(key) || seenKeysInBatch.has(key)) {
        rows_skipped_duplicate++;
        continue;
      }
      seenKeysInBatch.add(key);

      let matchedContentId: string | null = null;
      if (row.video_id) {
        if (contentMap.has(row.video_id)) {
          matchedContentId = row.video_id;
        } else {
          rows_missing_content_match++;
          // TETAP disimpan, set to null to satisfy strict SQLite FK constraint if parent key is missing
          matchedContentId = null;
        }
      }

      finalRowsToInsert.push({
        id: "sal_" + crypto.randomBytes(8).toString("hex"),
        order_id: row.order_id,
        product_id: row.product_id ? (productMap.get(row.product_id) || null) : null,
        contents_id: matchedContentId,
        order_type: row.order_type,
        price: row.price,
        items_sold: row.items_sold,
        gmv: row.gmv,
        est_commission: row.est_commission,
        actual_commission: row.actual_commission,
        settlement_status: row.settlement_status,
        ordered_at: row.ordered_at,
        user_id: userId,
        created_at: new Date().toISOString(),
      });
      rows_imported++;
    }

    if (finalRowsToInsert.length > 0) {
      const chunkSize = 200;
      for (let i = 0; i < finalRowsToInsert.length; i += chunkSize) {
        const chunk = finalRowsToInsert.slice(i, i + chunkSize);
        await db.insert(sales_data).values(chunk);
      }
    }

    // --- TAHAP 5: TRIGGER RECALCULATE STUB ---
    // Recalculation disabled since scoring is removed

    return NextResponse.json({
      success: true,
      summary: {
        rows_imported,
        rows_skipped_duplicate,
        rows_skipped_ineligible,
        rows_missing_content_match,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Terjadi kesalahan internal." }, { status: 500 });
  }
}
