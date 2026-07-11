// /*
// Tujuan: Route Handler untuk upload & import file report XLSX TikTok sales_data.
// Caller: UI uploader / Client forms
// Dependensi: next/server, lib/auth.ts, lib/db/index.ts, lib/db/schema.ts, lib/utils/sales-parser.ts
// Main Functions: POST
// Side Effects: Menyimpan data penjualan baru ke sales_data, memicu kalkulasi placeholder scoring
// */

import { NextRequest, NextResponse } from "next/server";
import { getMockUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { parseSalesXlsx } from "@/lib/utils/sales-parser";
import { sales_data, products, contents } from "@/lib/db/schema";
import { inArray, eq, and } from "drizzle-orm";
import crypto from "crypto";

export async function POST(req: NextRequest) {
  try {
    const user = await getMockUser();
    if (!user) {
      return NextResponse.json({ success: false, message: "Sesi habis, silakan login ulang." }, { status: 401 });
    }
    const userId = user.id;

    // Extract form data
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ success: false, message: "File wajib disertakan." }, { status: 400 });
    }

    const fileBuffer = Buffer.from(await file.arrayBuffer());
    
    // Parse XLSX using our helper
    let parsedResult;
    try {
      parsedResult = parseSalesXlsx(fileBuffer);
    } catch (err: any) {
      return NextResponse.json({ success: false, message: err.message }, { status: 400 });
    }

    const { rows: parsedRows, ineligibleCount } = parsedResult;

    if (parsedRows.length === 0) {
      return NextResponse.json({
        success: true,
        inserted: 0,
        ineligible: ineligibleCount,
        skipped: 0,
        errors: [],
        message: `Impor selesai. Tidak ada order valid yang diimpor (mengabaikan ${ineligibleCount} baris Ineligible).`
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

    // Deduplication check
    const orderIds = Array.from(new Set(consolidatedRows.map(r => r.order_id)));
    
    // Query existing order IDs
    const existingOrders = orderIds.length > 0
      ? await db
          .select({ order_id: sales_data.order_id, product_id: sales_data.product_id })
          .from(sales_data)
          .where(and(eq(sales_data.user_id, userId), inArray(sales_data.order_id, orderIds)))
      : [];

    const existingKeysSet = new Set(existingOrders.map(o => `${o.order_id}::${o.product_id || ""}`));

    // Resolve products mapping
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

    // Update existing products information
    let productsUpdatedCount = 0;
    if (existingProducts.length > 0) {
      for (const p of existingProducts) {
        const tid = p.product_id;
        const sample = consolidatedRows.find((r) => r.product_id === tid);
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

    // Auto-create missing products
    const productsToAutoCreate = [];
    for (const tid of rawProductIds) {
      if (!productMap.has(tid)) {
        const sample = consolidatedRows.find((r) => r.product_id === tid);
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
      const productsInsert = productsToAutoCreate.map(p => ({
        ...p,
        stock_status: "available" as const,
        date_added: new Date().toISOString().split("T")[0],
        is_collaboration: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }));

      const created = await db.insert(products).values(productsInsert).returning({
        product_id: products.product_id,
      });

      created.forEach(p => {
        productMap.set(p.product_id, p.product_id);
      });
    }

    // Resolve contents mapping
    const rawContentIds = Array.from(new Set(consolidatedRows.map(r => r.video_id).filter(Boolean))) as string[];
    const existingContents = rawContentIds.length > 0
      ? await db
          .select({ tiktok_content_id: contents.tiktok_content_id })
          .from(contents)
          .where(and(eq(contents.user_id, userId), inArray(contents.tiktok_content_id, rawContentIds)))
      : [];

    const contentMap = new Set<string>();
    existingContents.forEach(c => {
      if (c.tiktok_content_id) {
        contentMap.add(c.tiktok_content_id);
      }
    });

    let inserted = 0;
    let skipped = 0;
    const finalRowsToInsert: any[] = [];
    const seenKeysInBatch = new Set<string>();

    for (const r of consolidatedRows) {
      const key = `${r.order_id}::${r.product_id || ""}`;
      if (existingKeysSet.has(key) || seenKeysInBatch.has(key)) {
        skipped++;
        continue;
      }
      seenKeysInBatch.add(key);

      finalRowsToInsert.push({
        id: "sal_" + crypto.randomBytes(8).toString("hex"),
        order_id: r.order_id,
        product_id: r.product_id ? (productMap.get(r.product_id) || null) : null,
        contents_id: r.video_id ? (contentMap.has(r.video_id) ? r.video_id : null) : null,
        order_type: r.order_type,
        price: r.price,
        items_sold: r.items_sold,
        gmv: r.gmv,
        est_commission: r.est_commission,
        actual_commission: r.actual_commission,
        settlement_status: r.settlement_status,
        ordered_at: r.ordered_at,
        user_id: userId,
        created_at: new Date().toISOString(),
      });
      inserted++;
    }

    if (finalRowsToInsert.length > 0) {
      const chunkSize = 200;
      for (let i = 0; i < finalRowsToInsert.length; i += chunkSize) {
        const chunk = finalRowsToInsert.slice(i, i + chunkSize);
        await db.insert(sales_data).values(chunk);
      }
    }

    return NextResponse.json({
      success: true,
      inserted,
      updated: productsUpdatedCount,
      ineligible: ineligibleCount,
      skipped,
      errors: [],
      message: `Impor berhasil! Berhasil menambah +${inserted} data penjualan, memperbarui ${productsUpdatedCount} informasi produk, melompati ${skipped} duplikat, dan mengabaikan ${ineligibleCount} baris Ineligible.`
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: "Gagal memproses file impor: " + err.message }, { status: 500 });
  }
}
