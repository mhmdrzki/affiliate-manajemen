// /*
// Tujuan: Unit testing untuk logika impor data master produk (de-duplikasi, penanganan baris kosong, dan bulk insert).
// Caller: Vitest runner (npx vitest run tests/import-products.test.ts)
// Dependensi: vitest, lib/db/index.ts, lib/db/schema.ts, app/actions/import-products.ts
// Main Functions: None
// Side Effects: Menulis dan menghapus data produk di tabel products pada SQLite lokal.
// */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "../lib/db";
import { products } from "../lib/db/schema";
import { eq, inArray } from "drizzle-orm";
import { importProductsAction, ImportedProductInput } from "../app/actions/import-products";

const userId = "00000000-0000-0000-0000-000000000000";
const testProductIds = [
  "TEST-PROD-ID-9991",
  "TEST-PROD-ID-9992",
  "TEST-PROD-ID-9993"
];

describe("Product CSV/Excel Import Logic", () => {
  beforeAll(async () => {
    // Bersihkan data testing sebelum tes dijalankan
    await db.delete(products).where(
      inArray(products.product_id, testProductIds)
    );
  });

  afterAll(async () => {
    // Bersihkan data testing setelah tes selesai
    await db.delete(products).where(
      inArray(products.product_id, testProductIds)
    );
  });

  it("should successfully import new valid products", async () => {
    const input: ImportedProductInput[] = [
      { product_id: "TEST-PROD-ID-9991", product_name: "Produk Uji Coba 1" },
      { product_id: "TEST-PROD-ID-9992", product_name: "Produk Uji Coba 2" },
    ];

    const result = await importProductsAction(input);

    expect(result.success).toBe(true);
    expect(result.insertedCount).toBe(2);
    expect(result.skippedCount).toBe(0);

    // Pastikan produk ter-insert di database
    const dbRows = await db
      .select()
      .from(products)
      .where(inArray(products.product_id, ["TEST-PROD-ID-9991", "TEST-PROD-ID-9992"]));

    expect(dbRows.length).toBe(2);
    expect(dbRows.find(r => r.product_id === "TEST-PROD-ID-9991")?.product_name).toBe("Produk Uji Coba 1");
  });

  it("should filter out duplicate product IDs within the input list itself", async () => {
    const input: ImportedProductInput[] = [
      { product_id: "TEST-PROD-ID-9993", product_name: "Produk Uji Coba 3" },
      { product_id: "TEST-PROD-ID-9993", product_name: "Produk Uji Coba 3 Duplikat" }, // Duplikat ID di dalam list
    ];

    const result = await importProductsAction(input);

    expect(result.success).toBe(true);
    expect(result.insertedCount).toBe(1);
    expect(result.skippedCount).toBe(1); // 1 duplikat terdeteksi & dilompati

    const dbRows = await db
      .select()
      .from(products)
      .where(eq(products.product_id, "TEST-PROD-ID-9993"));

    expect(dbRows.length).toBe(1);
    // Harus menyimpan nama dari baris unik pertama
    expect(dbRows[0].product_name).toBe("Produk Uji Coba 3");
  });

  it("should skip product IDs that already exist in the database", async () => {
    // TEST-PROD-ID-9991 sudah di-insert di test case pertama
    const input: ImportedProductInput[] = [
      { product_id: "TEST-PROD-ID-9991", product_name: "Produk Uji Coba 1 Modifikasi" }, // Duplikat DB
    ];

    const result = await importProductsAction(input);

    expect(result.success).toBe(true);
    expect(result.insertedCount).toBe(0);
    expect(result.skippedCount).toBe(1);

    // Pastikan nama produk di database TIDAK berubah (tidak ter-overwrite karena di-skip)
    const dbRows = await db
      .select()
      .from(products)
      .where(eq(products.product_id, "TEST-PROD-ID-9991"));

    expect(dbRows.length).toBe(1);
    expect(dbRows[0].product_name).toBe("Produk Uji Coba 1");
  });

  it("should ignore invalid rows with empty product_id or product_name", async () => {
    const input: ImportedProductInput[] = [
      { product_id: "", product_name: "Produk Tanpa ID" },
      { product_id: "TEST-PROD-ID-9994", product_name: "" },
    ];

    const result = await importProductsAction(input);

    expect(result.success).toBe(true);
    expect(result.insertedCount).toBe(0);
    expect(result.skippedCount).toBe(2);
  });
});
