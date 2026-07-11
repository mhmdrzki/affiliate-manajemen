// /*
// Tujuan: Unit testing untuk logika impor data penjualan (XLSX parsing dan database logging).
// Caller: Vitest runner (npx vitest run tests/import-sales.test.ts)
// Dependensi: vitest, xlsx, lib/db/index.ts, lib/db/schema.ts, app/api/sales-data/import/route.ts
// Main Functions: None
// Side Effects: Menulis dan membaca tabel sales_data dan products di local.db
// */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import * as XLSX from "xlsx";
import { db } from "../lib/db";
import { sales_data, products, import_logs } from "../lib/db/schema";
import { POST } from "../app/api/sales-data/import/route";
import { eq, and, inArray } from "drizzle-orm";
import { NextRequest } from "next/server";
import { importAffiliateOrdersAction, getImportLogsAction, deleteImportLogAction } from "../app/actions/import-orders";

const userId = "00000000-0000-0000-0000-000000000000";

// Helper to create Excel buffer
function createExcelBuffer(rows: any[]): Buffer {
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Sheet 1");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

// Helper to wrap buffer into mock NextRequest
function createMockRequest(buffer: Buffer, filename: string = "test.xlsx"): NextRequest {
  const file = new File([new Uint8Array(buffer)], filename, { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const formData = new FormData();
  formData.append("file", file);
  
  return new NextRequest("http://localhost/api/sales-data/import", {
    method: "POST",
    body: formData,
  });
}

describe("Sales Data XLSX Import Overhaul", () => {
  beforeAll(async () => {
    // Clean up sales_data, import_logs, and testing products
    await db.delete(sales_data).where(eq(sales_data.user_id, userId));
    await db.delete(import_logs).where(eq(import_logs.user_id, userId));
    await db.delete(products).where(and(eq(products.user_id, userId), eq(products.product_id, "PROD-TEST-123")));
  });

  afterAll(async () => {
    // Cleanup
    await db.delete(sales_data).where(eq(sales_data.user_id, userId));
    await db.delete(import_logs).where(eq(import_logs.user_id, userId));
    await db.delete(products).where(and(eq(products.user_id, userId), eq(products.product_id, "PROD-TEST-123")));
  });

  const mockBaseRow = {
    "Order ID": "ORD-IM-001",
    "SKU ID": "SKU-IM-001",
    "Product ID": "PROD-TEST-123",
    "Product name": "Import Test Product",
    "Content ID": "CONTENT-IM-001",
    "Shop code": "SHOP-IM-001",
    "Shop name": "Import Shop",
    "Order type": "Affiliate order",
    "Price": "150.000",
    "Items sold": "1",
    "GMV": "150.000",
    "Est. standard commission": "15.000",
    "Est. Shop Ads commission": "5.000",
    "Total final earned amount": "20.000",
    "Order settlement status": "Settled",
    "Order date": "07/07/2026 12:00:00",
  };

  // a) file berisi baris Ineligible -> tidak masuk ke sales_data
  it("should skip Ineligible rows", async () => {
    const rowIneligible = {
      ...mockBaseRow,
      "Order ID": "ORD-IM-INELIGIBLE",
      "Order settlement status": "Ineligible",
    };

    const buffer = createExcelBuffer([mockBaseRow, rowIneligible]);
    const req = createMockRequest(buffer);
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.summary.rows_imported).toBe(1);
    expect(data.summary.rows_skipped_ineligible).toBe(1);

    // Verify rowIneligible is not in DB
    const saved = await db
      .select()
      .from(sales_data)
      .where(eq(sales_data.order_id, "ORD-IM-INELIGIBLE"));
    expect(saved.length).toBe(0);
  });

  // b) import file yang sama dua kali -> baris kedua tidak menggandakan data
  it("should deduplicate already imported orders", async () => {
    const buffer = createExcelBuffer([mockBaseRow]);
    
    // Import first time (already imported in previous test, so it should report duplicate skip)
    const req1 = createMockRequest(buffer);
    const res1 = await POST(req1);
    const data1 = await res1.json();

    expect(res1.status).toBe(200);
    expect(data1.success).toBe(true);
    expect(data1.summary.rows_imported).toBe(0);
    expect(data1.summary.rows_skipped_duplicate).toBe(1);
  });

  // c) file dengan kolom tambahan tak dikenal -> parser tetap sukses
  it("should process files with extra unrecognized columns", async () => {
    const rowWithExtra = {
      ...mockBaseRow,
      "Order ID": "ORD-IM-EXTRA",
      "Extra Column X": "Random Value",
      "Unrecognized field Y": 999,
    };

    const buffer = createExcelBuffer([rowWithExtra]);
    const req = createMockRequest(buffer);
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.summary.rows_imported).toBe(1);
  });

  // d) file dengan kolom wajib hilang -> error jelas, bukan crash senyap
  it("should throw descriptive error when required columns are missing", async () => {
    const rowMissing = {
      "Order ID": "ORD-IM-MISSING",
      "SKU ID": "SKU-IM-001",
      // missing Product name, Price, etc.
    };

    const buffer = createExcelBuffer([rowMissing]);
    const req = createMockRequest(buffer);
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain("Kolom wajib berikut tidak ditemukan di file XLSX");
  });

  // e) baris dengan Content ID yang tidak match contents.tiktok_content_id mana pun -> tetap masuk ke sales_data, muncul di summary sebagai info
  it("should still import order if Content ID does not match any registered content, and report it", async () => {
    // Ensure no registered content matches "CONTENT-NONEXISTENT-999"
    const nonexistentContentId = "CONTENT-NONEXISTENT-999";
    const rowNoMatch = {
      ...mockBaseRow,
      "Order ID": "ORD-IM-NOMATCH",
      "Content ID": nonexistentContentId,
    };

    const buffer = createExcelBuffer([rowNoMatch]);
    const req = createMockRequest(buffer);
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.summary.rows_imported).toBe(1);
    expect(data.summary.rows_missing_content_match).toBe(1);

    // Verify rowNoMatch is in DB
    const [saved] = await db
      .select()
      .from(sales_data)
      .where(eq(sales_data.order_id, "ORD-IM-NOMATCH"));
    expect(saved).toBeDefined();
    expect(saved.contents_id).toBeNull(); // Stored as NULL to satisfy DB foreign key constraints, while order is still imported
  });

  describe("Server Actions - Import Logs and Deletion", () => {
    it("should successfully record logs and delete them cascadingly", async () => {
      // 1. Prepare raw rows
      const testRawRows = [
        {
          "Order ID": "ORD-ACTION-001",
          "Product ID": "PROD-TEST-123",
          "Product name": "Import Action Product",
          "Content ID": "CONTENT-ACTION-001",
          "Shop code": "SHOP-ACTION-001",
          "Shop name": "Action Shop",
          "Order type": "Affiliate order",
          "Price": "100.000",
          "Items sold": "2",
          "GMV": "200.000",
          "Est. standard commission": "20.000",
          "Est. Shop Ads commission": "0",
          "Total final earned amount": "20.000",
          "Order settlement status": "Settled",
          "Order date": "07/07/2026 13:00:00",
        }
      ];

      // 2. Run Import Action
      const filename = "action_test.xlsx";
      const importResult = await importAffiliateOrdersAction(testRawRows, filename);
      
      expect(importResult.success).toBe(true);
      expect(importResult.inserted).toBe(1);

      // 3. Verify Log Exists
      const logs = await getImportLogsAction();
      const myLog = logs.find(l => l.filename === filename);
      expect(myLog).toBeDefined();
      expect(myLog?.inserted_count).toBe(1);

      // 4. Verify Order Saved with correct import_id
      const savedOrders = await db
        .select()
        .from(sales_data)
        .where(eq(sales_data.order_id, "ORD-ACTION-001"));
      
      expect(savedOrders.length).toBe(1);
      expect(savedOrders[0].import_id).toBe(myLog?.id);

      // 5. Delete Import Log
      const deleteResult = await deleteImportLogAction(myLog!.id);
      expect(deleteResult.success).toBe(true);
      expect(deleteResult.message).toContain(filename);

      // 6. Verify Log Deleted
      const logsAfter = await getImportLogsAction();
      const myLogAfter = logsAfter.find(l => l.filename === filename);
      expect(myLogAfter).toBeUndefined();

      // 7. Verify Orders Deleted (Cascade)
      const savedOrdersAfter = await db
        .select()
        .from(sales_data)
        .where(eq(sales_data.order_id, "ORD-ACTION-001"));
      expect(savedOrdersAfter.length).toBe(0);
    });

    it("should successfully import multi-product orders (same Order ID, different Product IDs)", async () => {
      const prodA = "PROD-TEST-MULTI-A";
      const prodB = "PROD-TEST-MULTI-B";
      
      const rowA = {
        ...mockBaseRow,
        "Order ID": "ORD-MULTI-PROD",
        "Product ID": prodA,
        "Product name": "Multi Prod A",
        "Items sold": "1",
        "GMV": "100.000",
        "Total final earned amount": "10.000",
      };
      
      const rowB = {
        ...mockBaseRow,
        "Order ID": "ORD-MULTI-PROD",
        "Product ID": prodB,
        "Product name": "Multi Prod B",
        "Items sold": "2",
        "GMV": "200.000",
        "Total final earned amount": "20.000",
      };

      const buffer = createExcelBuffer([rowA, rowB]);
      const req = createMockRequest(buffer, "multi_product_test.xlsx");
      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.summary.rows_imported).toBe(2);

      // Verify both rows exist in DB
      const saved = await db
        .select()
        .from(sales_data)
        .where(eq(sales_data.order_id, "ORD-MULTI-PROD"));
      
      expect(saved.length).toBe(2);
      const savedProdA = saved.find(s => s.product_id === prodA);
      const savedProdB = saved.find(s => s.product_id === prodB);
      expect(savedProdA).toBeDefined();
      expect(savedProdB).toBeDefined();
      expect(savedProdA?.items_sold).toBe(1);
      expect(savedProdB?.items_sold).toBe(2);

      // Cleanup
      await db.delete(sales_data).where(eq(sales_data.order_id, "ORD-MULTI-PROD"));
      await db.delete(products).where(and(eq(products.user_id, userId), inArray(products.product_id, [prodA, prodB])));
    });

    it("should consolidate multi-variant orders (same Order ID, same Product ID, different rows) into a single row", async () => {
      const prodId = "PROD-TEST-VARIANTS";
      
      const rowVariant1 = {
        ...mockBaseRow,
        "Order ID": "ORD-MULTI-VAR",
        "Product ID": prodId,
        "Product name": "Variant Prod",
        "Items sold": "2",
        "GMV": "200.000",
        "Est. standard commission": "20.000",
        "Est. Shop Ads commission": "0",
        "Total final earned amount": "20.000",
      };
      
      const rowVariant2 = {
        ...mockBaseRow,
        "Order ID": "ORD-MULTI-VAR",
        "Product ID": prodId,
        "Product name": "Variant Prod",
        "Items sold": "3",
        "GMV": "300.000",
        "Est. standard commission": "30.000",
        "Est. Shop Ads commission": "0",
        "Total final earned amount": "30.000",
      };

      const buffer = createExcelBuffer([rowVariant1, rowVariant2]);
      const req = createMockRequest(buffer, "multi_variant_test.xlsx");
      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.summary.rows_imported).toBe(1); // Consolidated to 1 row

      // Verify consolidated row in DB
      const saved = await db
        .select()
        .from(sales_data)
        .where(eq(sales_data.order_id, "ORD-MULTI-VAR"));
      
      expect(saved.length).toBe(1);
      expect(saved[0].product_id).toBe(prodId);
      expect(saved[0].items_sold).toBe(5); // 2 + 3
      expect(saved[0].gmv).toBe(500000); // 200k + 300k
      expect(saved[0].est_commission).toBe(50000); // 20k + 30k
      expect(saved[0].actual_commission).toBe(50000); // 20k + 30k

      // Cleanup
      await db.delete(sales_data).where(eq(sales_data.order_id, "ORD-MULTI-VAR"));
      await db.delete(products).where(and(eq(products.user_id, userId), eq(products.product_id, prodId)));
    });
  });
});
