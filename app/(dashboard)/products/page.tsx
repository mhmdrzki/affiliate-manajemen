// /*
// Tujuan: Halaman UI Master Produk untuk mengelola (menampilkan, menambah, mengubah status/detail, dan menghapus) produk.
// Caller: Route /products
// Dependensi: lib/supabase/server.ts, types/index.ts, components/layout/Topbar.tsx, lib/utils/format.ts, components/products/StatusSelector.tsx, components/products/AddProductDialog.tsx, components/products/EditProductDialog.tsx
// Main Functions: ProductsPage
// Side Effects: Mengambil data produk dari Supabase.
// */

import React from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Topbar from "@/components/layout/Topbar";
import { fmtIDR } from "@/lib/utils/format";
import { ShoppingBag } from "lucide-react";
import { Product } from "@/types";
import StatusSelector from "@/components/products/StatusSelector";
import AddProductDialog from "@/components/products/AddProductDialog";
import EditProductDialog from "@/components/products/EditProductDialog";

export default async function ProductsPage() {
  const supabase = await createClient();

  // 1. Verifikasi User
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // 2. Fetch data products
  const { data: products } = await supabase
    .from("products")
    .select("*")
    .eq("user_id", user.id)
    .order("bench_score", { ascending: false });

  const typedProducts = (products || []) as unknown as Product[];

  return (
    <div className="flex-1 flex flex-col min-h-screen">
      <Topbar title="Master Produk" />

      <div className="p-6 space-y-6">
        <div className="bg-white border border-border-light rounded-xl p-5 shadow-sm">
          <div className="flex justify-between items-center mb-4 pb-2 border-b border-border-light">
            <h3 className="text-xs font-bold text-text-main flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 text-accent" />
              <span>Daftar Master Produk ({typedProducts.length})</span>
            </h3>
            {/* Modal Tambah Produk Baru */}
            <AddProductDialog />
          </div>

          <div className="overflow-x-auto border border-border-light rounded-lg">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="bg-bg-panel border-b border-border-light text-[10px] font-bold text-text-placeholder uppercase tracking-wider">
                  <th className="p-3">Nama Produk</th>
                  <th className="p-3">Kategori</th>
                  <th className="p-3">Harga</th>
                  <th className="p-3">Komisi</th>
                  <th className="p-3 text-center">Status</th>
                  <th className="p-3 text-center">Skor</th>
                  <th className="p-3 text-center">Klasifikasi</th>
                  <th className="p-3 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-light">
                {typedProducts.length > 0 ? (
                  typedProducts.map((p) => {
                    const badgeStyles =
                      p.klasifikasi === "WINNING" ? "bg-success-bg text-success border-success-border" :
                      p.klasifikasi === "POTENTIAL" ? "bg-info-bg text-info border-info-border" :
                      p.klasifikasi === "DROP" ? "bg-danger-bg text-danger border-danger-border" :
                      "bg-warning-bg text-warning border-warning-border";

                    return (
                      <tr key={p.id} className="hover:bg-bg-panel transition-colors">
                        <td className="p-3">
                          <div className="font-bold text-text-main max-w-sm truncate">
                            {p.nama}
                          </div>
                          <div className="text-[10px] text-text-placeholder mt-0.5">
                            Brand: {p.brand || "—"} · Jenis: {p.jenis || "—"}
                          </div>
                        </td>
                        <td className="p-3 font-semibold text-text-muted">
                          {p.kategori}
                        </td>
                        <td className="p-3 font-mono font-medium text-text-main">
                          {fmtIDR(p.harga)}
                        </td>
                        <td className="p-3 font-mono font-medium text-success">
                          {fmtIDR(p.komisi)}
                        </td>
                        <td className="p-3 text-center align-middle">
                          {/* Dropdown pemilih status interaktif */}
                          <StatusSelector productId={p.id} initialStatus={p.status} />
                        </td>
                        <td className="p-3 text-center font-mono font-bold text-text-main">
                          {p.bench_score}
                        </td>
                        <td className="p-3 text-center">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-[9px] font-bold border uppercase tracking-wide ${badgeStyles}`}>
                            {p.klasifikasi}
                          </span>
                        </td>
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center">
                            <EditProductDialog product={p} />
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-text-placeholder">
                      Belum ada data produk. Silakan tambah produk baru secara manual di atas atau melalui menu **Impor Data** / **Migrasi Data**.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
