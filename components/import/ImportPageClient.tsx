// /*
// Tujuan: Komponen klien-side untuk mengkoordinasikan tabel data pesanan, log riwayat impor, panel ranking produk, dan dialog modal uploader.
// Caller: app/(dashboard)/import/page.tsx
// Dependensi: components/import/SalesDataTable.tsx, components/import/ImportLogsTable.tsx, components/import/ImportModal.tsx, components/import/ProductRankingPanel.tsx, components/layout/Topbar.tsx
// Main Functions: ImportPageClient
// Side Effects: None
// */

"use client";

import React, { useState } from "react";
import Topbar from "@/components/layout/Topbar";
import ImportLogsTable from "./ImportLogsTable";
import SalesDataTable from "./SalesDataTable";
import ImportModal from "./ImportModal";
import ProductRankingPanel from "./ProductRankingPanel";

interface Product {
  product_id: string;
  product_name: string;
}

interface OrderItem {
  order_id: string;
  product_id: string | null;
  product_name: string | null;
  order_type: string;
  price: number;
  items_sold: number;
  gmv: number;
  est_commission: number;
  actual_commission: number;
  settlement_status: string;
  ordered_at: string;
}

interface ImportLog {
  id: string;
  user_id: string;
  filename: string;
  inserted_count: number;
  updated_count: number;
  skipped_count: number;
  created_at: string;
}

interface ImportPageClientProps {
  orders: OrderItem[];
  products: Product[];
  logs: ImportLog[];
  currentPage: number;
  totalPages: number;
  totalRows: number;
  limit: number;
  search: string;
  startDate: string;
  endDate: string;
  productId: string;
  orderType: string;
  status: string;
}

export default function ImportPageClient({
  orders,
  products,
  logs,
  currentPage,
  totalPages,
  totalRows,
  limit,
  search,
  startDate,
  endDate,
  productId,
  orderType,
  status
}: ImportPageClientProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-bg">
      <Topbar title="Impor Data & Riwayat Pesanan" />

      <div className="p-6 max-w-6xl mx-auto w-full space-y-6">
        {/* Riwayat Impor (Logs) */}
        <ImportLogsTable 
          logs={logs} 
          onOpenImportModal={() => setIsModalOpen(true)} 
        />

        {/* Ranking Produk */}
        <ProductRankingPanel />

        {/* Tabel Data Penjualan (sales_data) */}
        <SalesDataTable
          orders={orders}
          products={products}
          currentPage={currentPage}
          totalPages={totalPages}
          totalRows={totalRows}
          limit={limit}
          search={search}
          startDate={startDate}
          endDate={endDate}
          productId={productId}
          orderType={orderType}
          status={status}
        />
      </div>

      {/* Modal Impor File */}
      <ImportModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
      />
    </div>
  );
}
