import Module from "module";

// Mock next/cache sebelum modul-modul lain di-import secara dinamis
const originalRequire = Module.prototype.require;
Module.prototype.require = function (id) {
  if (id === "next/cache") {
    return {
      revalidatePath: () => {},
      revalidateTag: () => {},
    };
  }
  return originalRequire.apply(this, arguments as any);
};

import * as XLSX from "xlsx";
import fs from "fs";
import path from "path";
import { db } from "../lib/db";
import { sales_data, products, contents } from "../lib/db/schema";
import { parseSalesXlsx, parseSalesRows } from "../lib/utils/sales-parser";
import { eq, and } from "drizzle-orm";

const TEST_FILE_PATH = path.join(__dirname, "temp_test_sales.xlsx");
const MISSING_FILE_PATH = path.join(__dirname, "temp_test_missing.xlsx");

// Helper untuk membuat file excel mock
function createMockExcel(filePath: string, rows: any[]) {
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Sheet 1");
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  fs.writeFileSync(filePath, buf);
}

async function runTests() {
  const { importAffiliateOrdersAction } = await import("../app/actions/import-orders");
  console.log("=== MEMULAI PENGUJIAN LOGIKA IMPOR SALES_DATA ===");

  const userId = "00000000-0000-0000-0000-000000000000";

  // Data mock awal
  const mockValidRow = {
    "Order ID": "ORD-TEST-001",
    "SKU ID": "SKU-TEST-101",
    "Product ID": "PROD-TEST-TIKOK-111",
    "Product name": "Test Product Sales A",
    "Content ID": "CONTENT-TEST-VIDEO-999",
    "Shop code": "SHOP-TEST-CODE-AA",
    "Shop name": "Mock Shop Name A",
    "Order type": "Affiliate order",
    "Price": "150.000",
    "Items sold": "2",
    "GMV": "300.000",
    "Est. standard commission": "15.000",
    "Est. Shop Ads commission": "5.000",
    "Total final earned amount": "20.000",
    "Order settlement status": "Settled",
    "Order date": "03/07/2026 15:30:00"
  };

  const mockIneligibleRow = {
    ...mockValidRow,
    "Order ID": "ORD-TEST-002",
    "Order settlement status": "Ineligible"
  };

  const mockExtraColumnsRow = {
    ...mockValidRow,
    "Order ID": "ORD-TEST-003",
    "Extra Column A": "Abaikan Saya",
    "Extra Column B": "12345"
  };

  // Bersihkan data lama jika ada
  await db.delete(sales_data).where(eq(sales_data.user_id, userId));
  
  // Ambil isi content_log (contents) saat ini untuk pengecekan video_id
  const totalContentsBefore = await db.select().from(contents).then(r => r.length);

  try {
    // -------------------------------------------------------------
    // Skenario A: File berisi baris Ineligible -> pastikan tidak masuk ke database
    // -------------------------------------------------------------
    console.log("\n-> Skenario A: Menguji baris status 'Ineligible'...");
    createMockExcel(TEST_FILE_PATH, [mockValidRow, mockIneligibleRow]);

    const fileBuffer = fs.readFileSync(TEST_FILE_PATH);
    const parsed = parseSalesXlsx(fileBuffer);
    
    if (parsed.ineligibleCount !== 1) {
      throw new Error(`Gagal: ineligibleCount harus 1, terdeteksi: ${parsed.ineligibleCount}`);
    }
    if (parsed.rows.length !== 1) {
      throw new Error(`Gagal: parsed rows yang valid harus 1, terdeteksi: ${parsed.rows.length}`);
    }
    console.log("✅ Parser berhasil menyaring baris Ineligible di memory.");

    // Impor ke database lewat server action
    const actionRes = await importAffiliateOrdersAction([mockValidRow, mockIneligibleRow], "temp_test_sales.xlsx");
    
    if (!actionRes.success) {
      throw new Error(`Gagal memanggil import action: ${actionRes.message}`);
    }
    if (actionRes.inserted !== 1 || actionRes.skippedIneligible !== 1) {
      throw new Error(`Gagal: inserted=${actionRes.inserted}, skippedIneligible=${actionRes.skippedIneligible} (harus 1 dan 1)`);
    }

    const createdProduct = await db
      .select()
      .from(products)
      .where(eq(products.product_id, "PROD-TEST-TIKOK-111"))
      .then(rows => rows[0]);

    if (!createdProduct) {
      throw new Error("Gagal: Produk baru tidak terbuat secara otomatis!");
    }
    if (createdProduct.shop_name !== "Mock Shop Name A") {
      throw new Error(`Gagal: Nama toko terbuat salah. Bernilai: ${createdProduct.shop_name}`);
    }
    console.log("✅ BERHASIL Skenario A: Produk terbuat otomatis dengan Nama Toko yang sesuai.");

    const savedIneligible = await db
      .select()
      .from(sales_data)
      .where(eq(sales_data.order_id, "ORD-TEST-002"));
    
    if (savedIneligible.length > 0) {
      throw new Error("Gagal: Baris ineligible tersimpan di tabel sales_data!");
    }
    console.log("✅ BERHASIL Skenario A: Baris Ineligible tidak tersimpan di database.");

    // -------------------------------------------------------------
    // Skenario B: Import file yang sama dua kali -> pastikan duplikat di-skip
    // -------------------------------------------------------------
    console.log("\n-> Skenario B: Menguji pengimporan berulang (anti-duplikat)...");
    const repeatRes = await importAffiliateOrdersAction([mockValidRow, mockIneligibleRow], "temp_test_sales.xlsx");
    
    if (!repeatRes.success) {
      throw new Error(`Gagal memanggil import action kedua kali: ${repeatRes.message}`);
    }
    if (repeatRes.inserted !== 0 || repeatRes.skipped !== 1) {
      throw new Error(`Gagal: inserted=${repeatRes.inserted}, skipped=${repeatRes.skipped} (harus 0 dan 1)`);
    }

    const allSaved = await db
      .select()
      .from(sales_data)
      .where(eq(sales_data.user_id, userId));
    
    if (allSaved.length !== 1) {
      throw new Error(`Gagal: Total baris tersimpan harus tetap 1, terdeteksi: ${allSaved.length}`);
    }
    console.log("✅ BERHASIL Skenario B: Baris duplikat berhasil di-skip dan tidak diduplikasi.");

    // -------------------------------------------------------------
    // Skenario C: File dengan kolom tambahan yang tidak dikenal -> tetap sukses
    // -------------------------------------------------------------
    console.log("\n-> Skenario C: Menguji kolom ekstra tambahan...");
    createMockExcel(TEST_FILE_PATH, [mockExtraColumnsRow]);
    const extraBuffer = fs.readFileSync(TEST_FILE_PATH);
    const parsedExtra = parseSalesXlsx(extraBuffer);

    if (parsedExtra.rows.length !== 1) {
      throw new Error(`Gagal: Kolom tambahan menyebabkan parser gagal. Rows parsed: ${parsedExtra.rows.length}`);
    }
    
    const extraRes = await importAffiliateOrdersAction([mockExtraColumnsRow], "temp_test_sales.xlsx");
    if (!extraRes.success) {
      throw new Error(`Gagal mengimpor file kolom ekstra: ${extraRes.message}`);
    }
    console.log("✅ BERHASIL Skenario C: Sukses memproses file yang memiliki kolom tambahan.");

    // -------------------------------------------------------------
    // Skenario D: File dengan kolom wajib hilang -> laporkan error yang jelas
    // -------------------------------------------------------------
    console.log("\n-> Skenario D: Menguji validasi jika kolom wajib hilang...");
    const missingColRow = {
      "Order ID": "ORD-TEST-004",
      "SKU ID": "SKU-TEST-104",
      "Product ID": "PROD-TEST-TIKOK-111"
      // Kolom wajib lainnya tidak disertakan
    };
    createMockExcel(MISSING_FILE_PATH, [missingColRow]);
    
    let errorThrown = false;
    try {
      const missingBuffer = fs.readFileSync(MISSING_FILE_PATH);
      parseSalesXlsx(missingBuffer);
    } catch (err: any) {
      errorThrown = true;
      console.log(`Pesan error tertangkap: "${err.message}"`);
      if (!err.message.includes("Kolom wajib berikut tidak ditemukan")) {
        throw new Error("Gagal: Pesan error tidak memuat info kolom wajib yang hilang.");
      }
    }

    if (!errorThrown) {
      throw new Error("Gagal: Parser tidak melempar error padahal kolom wajib hilang.");
    }
    console.log("✅ BERHASIL Skenario D: Error deskriptif terlempar dengan sukses.");

    // -------------------------------------------------------------
    // Skenario E: Pengecekan tidak menulis balik ke content_log
    // -------------------------------------------------------------
    console.log("\n-> Skenario E: Memastikan tidak menulis balik ke content_log...");
    const totalContentsAfter = await db.select().from(contents).then(r => r.length);
    if (totalContentsBefore !== totalContentsAfter) {
      throw new Error(`Gagal: Jumlah baris data contents bertambah dari ${totalContentsBefore} menjadi ${totalContentsAfter}!`);
    }
    console.log("✅ BERHASIL Skenario E: Tabel content_log tidak disentuh (tidak ada auto-create).");

    // -------------------------------------------------------------
    // Skenario F: Menguji pembaruan informasi produk jika produk sudah ada
    // -------------------------------------------------------------
    console.log("\n-> Skenario F: Menguji pembaruan informasi produk jika produk sudah ada...");
    const mockUpdatedProductRow = {
      ...mockValidRow,
      "Order ID": "ORD-TEST-006",
      "Product name": "Test Product Sales A - UPDATED NAME",
      "Price": "200.000",
      "GMV": "400.000",
      "Est. standard commission": "30.000",
      "Est. shop Ads commission": "10.000",
      "Total final earned amount": "40.000"
    };

    const updateRes = await importAffiliateOrdersAction([mockUpdatedProductRow], "temp_test_sales.xlsx");
    if (!updateRes.success) {
      throw new Error(`Gagal memanggil import action untuk pembaruan produk: ${updateRes.message}`);
    }
    if (updateRes.updated !== 1) {
      throw new Error(`Gagal: Jumlah produk terupdate harus 1, terdeteksi: ${updateRes.updated}`);
    }

    const updatedProduct = await db
      .select()
      .from(products)
      .where(eq(products.product_id, "PROD-TEST-TIKOK-111"))
      .then(rows => rows[0]);

    if (!updatedProduct) {
      throw new Error("Gagal: Produk hilang!");
    }
    if (updatedProduct.product_name !== "Test Product Sales A - UPDATED NAME") {
      throw new Error(`Gagal: Nama produk tidak terupdate. Bernilai: ${updatedProduct.product_name}`);
    }
    console.log("✅ BERHASIL Skenario F: Informasi produk lama berhasil diperbarui dari data impor baru.");

  } finally {
    // Bersihkan file sementara
    if (fs.existsSync(TEST_FILE_PATH)) fs.unlinkSync(TEST_FILE_PATH);
    if (fs.existsSync(MISSING_FILE_PATH)) fs.unlinkSync(MISSING_FILE_PATH);

    // Bersihkan data uji di database
    await db.delete(sales_data).where(eq(sales_data.user_id, userId));
    await db.delete(products).where(and(eq(products.user_id, userId), eq(products.product_id, "PROD-TEST-TIKOK-111")));
  }

  console.log("\n===========================================");
  console.log("🎉 SEMUA SKENARIO UJI SALES_DATA BERHASIL! 🎉");
  console.log("===========================================\n");
}

runTests().catch((err) => {
  console.error("❌ PENGUJIAN GAGAL:", err.message);
  process.exit(1);
});
