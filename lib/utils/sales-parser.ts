// /*
// Tujuan: Helper utility untuk membaca & mem-parsing file lembar kerja XLSX/XLS laporan penjualan (sales_data) TikTok Affiliate.
// Caller: Route API /api/sales-data/import, Server Actions import-orders.ts
// Dependensi: xlsx, lib/utils/excel.ts
// Main Functions: parseSalesXlsx, parseSalesRows
// Side Effects: None (Pure parser)
// */

import * as XLSX from "xlsx";
import { parseTikTokNumber, parseTikTokDate } from "./excel";

export interface ParsedSalesRow {
  order_id: string;
  product_id: string | null; // Raw TikTok Product ID
  product_name: string | null;
  video_id: string | null;    // Raw Content ID (TikTok Content ID)
  shop_code: string | null;
  shop_name: string | null;
  order_type: "shop_ads" | "affiliate";
  price: number;
  items_sold: number;
  gmv: number;
  est_commission: number;
  actual_commission: number;
  settlement_status: "settled" | "pending" | "awaiting_payment";
  ordered_at: string;
}

export function parseSalesRows(rawRows: Record<string, any>[]): {
  rows: ParsedSalesRow[];
  ineligibleCount: number;
} {
  if (rawRows.length === 0) {
    return { rows: [], ineligibleCount: 0 };
  }

  // Validate required columns on the first row
  const firstRow = rawRows[0];
  const requiredColumns = [
    "Order ID",
    "Product ID",
    "Product name",
    "Content ID",
    "Shop code",
    "Order type",
    "Price",
    "Items sold",
    "GMV",
    "Est. standard commission",
    "Est. Shop Ads commission",
    "Total final earned amount",
    "Order settlement status",
    "Order date"
  ];

  const missingColumns = requiredColumns.filter((col) => !(col in firstRow));
  if (missingColumns.length > 0) {
    throw new Error("Kolom wajib berikut tidak ditemukan di file XLSX: " + missingColumns.join(", "));
  }

  let ineligibleCount = 0;
  const parsedRows: ParsedSalesRow[] = [];

  for (const row of rawRows) {
    const orderId = String(row["Order ID"] || "").trim();
    if (!orderId || orderId.toLowerCase() === "order id") {
      continue;
    }

    const settlementStatusRaw = String(row["Order settlement status"] || "").trim();
    if (settlementStatusRaw === "Ineligible") {
      ineligibleCount++;
      continue;
    }

    const orderTypeRaw = String(row["Order type"] || "").trim();
    const orderType = orderTypeRaw.toLowerCase().includes("shop ads") ? "shop_ads" : "affiliate";

    const price = parseTikTokNumber(row["Price"]);
    const itemsSold = parseInt(row["Items sold"]) || 0;
    const gmv = parseTikTokNumber(row["GMV"]);
    
    // est_commission = "Est. standard commission" + "Est. Shop Ads commission"
    const estStdComm = parseTikTokNumber(row["Est. standard commission"]);
    const estAdComm = parseTikTokNumber(row["Est. Shop Ads commission"]);
    const estCommission = estStdComm + estAdComm;

    const actualCommission = parseTikTokNumber(row["Total final earned amount"]);

    let settlementStatus: "settled" | "pending" | "awaiting_payment" = "pending";
    const statusLower = settlementStatusRaw.toLowerCase();
    if (statusLower === "settled") {
      settlementStatus = "settled";
    } else if (statusLower === "pending") {
      settlementStatus = "pending";
    } else if (statusLower === "awaiting payment" || statusLower === "awaiting_payment") {
      settlementStatus = "awaiting_payment";
    }

    const orderedAtRaw = String(row["Order date"] || "").trim();
    const orderedAt = parseTikTokDate(orderedAtRaw);
    if (!orderedAt) {
      throw new Error(`Format tanggal Order date tidak valid pada baris Order ID: ${orderId}`);
    }

    parsedRows.push({
      order_id: orderId,
      product_id: String(row["Product ID"] || "").trim() || null,
      product_name: String(row["Product name"] || "").trim() || null,
      video_id: row["Content ID"] !== undefined && row["Content ID"] !== null ? String(row["Content ID"]).trim() || null : null,
      shop_code: row["Shop code"] !== undefined && row["Shop code"] !== null ? String(row["Shop code"]).trim() || null : null,
      shop_name: String(row["Shop name"] || "").trim() || null,
      order_type: orderType,
      price,
      items_sold: itemsSold,
      gmv,
      est_commission: estCommission,
      actual_commission: actualCommission,
      settlement_status: settlementStatus,
      ordered_at: orderedAt,
    });
  }

  return {
    rows: parsedRows,
    ineligibleCount,
  };
}

export function parseSalesXlsx(fileBuffer: Buffer): {
  rows: ParsedSalesRow[];
  ineligibleCount: number;
} {
  const workbook = XLSX.read(fileBuffer, { type: "buffer" });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) {
    throw new Error("File XLSX kosong atau tidak memiliki sheet.");
  }

  // Read raw JSON rows
  const rawRows = XLSX.utils.sheet_to_json(sheet) as Record<string, any>[];
  return parseSalesRows(rawRows);
}
