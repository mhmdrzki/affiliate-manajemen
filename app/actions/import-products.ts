// /*
// Tujuan: Server Action untuk mengimpor data master produk dari berkas CSV dengan de-duplikasi otomatis.
// Caller: Komponen ImportProductDialog (/components/products/ImportProductDialog.tsx)
// Dependensi: lib/db/index.ts, lib/db/schema.ts, lib/auth.ts, next/cache (revalidatePath)
// Main Functions: importProductsAction
// Side Effects: Menulis data produk baru ke database SQLite lokal, revalidasi halaman.
// */

"use server";

import { getMockUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { products } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export interface ImportedProductInput {
  product_id: string;
  product_name: string;
  category?: string;
  shop_name?: string;
  shop_code?: string;
}

export interface ImportProductsResult {
  success: boolean;
  insertedCount: number;
  skippedCount: number;
  message: string;
}

export async function importProductsAction(
  items: ImportedProductInput[]
): Promise<ImportProductsResult> {
  const user = await getMockUser();

  if (!user) {
    return {
      success: false,
      insertedCount: 0,
      skippedCount: 0,
      message: "Sesi habis, silakan login ulang.",
    };
  }

  const userId = user.id;

  try {
    if (!items || items.length === 0) {
      return {
        success: false,
        insertedCount: 0,
        skippedCount: 0,
        message: "Tidak ada data produk yang diunggah.",
      };
    }

    // 1. Ambil daftar product_id yang sudah ada di database untuk user ini
    const existingProducts = await db
      .select({ product_id: products.product_id })
      .from(products)
      .where(eq(products.user_id, userId));

    const existingIdsSet = new Set(existingProducts.map((p) => p.product_id));

    // 2. Filter & de-duplikasi
    const uniqueItemsToInsertMap = new Map<string, ImportedProductInput>();
    let duplicateInFileCount = 0;
    let duplicateInDbCount = 0;

    for (const item of items) {
      const pid = String(item.product_id || "").trim();
      const pname = String(item.product_name || "").trim();

      // Abaikan jika ID produk atau nama produk kosong
      if (!pid || !pname) {
        duplicateInFileCount++; // anggap data tidak valid dilewati
        continue;
      }

      if (existingIdsSet.has(pid)) {
        duplicateInDbCount++;
        continue;
      }

      if (uniqueItemsToInsertMap.has(pid)) {
        duplicateInFileCount++;
        continue;
      }

      uniqueItemsToInsertMap.set(pid, {
        ...item,
        product_id: pid,
        product_name: pname,
      });
    }

    const newProductsToInsert = Array.from(uniqueItemsToInsertMap.values());
    const insertedCount = newProductsToInsert.length;
    const skippedCount = duplicateInFileCount + duplicateInDbCount;

    if (insertedCount > 0) {
      const today = new Date().toISOString().split("T")[0];
      const nowIso = new Date().toISOString();

      const insertValues = newProductsToInsert.map((item) => ({
        product_id: item.product_id,
        user_id: userId,
        product_name: item.product_name,
        shop_name: item.shop_name?.trim() || null,
        shop_code: item.shop_code?.trim() || null,
        category: item.category?.trim() || "Umum",
        stock_status: "unknown" as const,
        date_added: today,
        is_collaboration: false,
        collab_target_count: null,
        collab_deadline: null,
        collab_start_date: null,
        status: "active" as const,
        created_at: nowIso,
        updated_at: nowIso,
      }));

      // Bulk insert dengan chunking 200
      const chunkSize = 200;
      for (let i = 0; i < insertValues.length; i += chunkSize) {
        const chunk = insertValues.slice(i, i + chunkSize);
        await db.insert(products).values(chunk);
      }

      safeRevalidatePath("/products");
      safeRevalidatePath("/");
    }

    let message = `Impor berhasil! Berhasil menambahkan ${insertedCount} produk baru.`;
    if (skippedCount > 0) {
      message += ` Melompati ${skippedCount} produk (sudah ada: ${duplicateInDbCount}, duplikat di file: ${duplicateInFileCount}).`;
    }

    return {
      success: true,
      insertedCount,
      skippedCount,
      message,
    };
  } catch (err: any) {
    console.error("Gagal melakukan impor data produk:", err);
    return {
      success: false,
      insertedCount: 0,
      skippedCount: 0,
      message: err.message || "Gagal melakukan impor data produk.",
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
