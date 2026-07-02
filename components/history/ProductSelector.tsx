// /*
// Tujuan: Komponen dropdown inline berbasis Client untuk memilih & memperbarui relasi produk (product_id) pada konten.
// Caller: components/history/ContentHistoryTable.tsx
// Dependensi: app/actions/contents.ts, types/index.ts, next/navigation (useRouter)
// Main Functions: ProductSelector
// Side Effects: Memanggil updateContentProductIdAction dan memicu refresh router.
// */

// /*
// Tujuan: Komponen dropdown inline berbasis Client dengan fitur pencarian untuk memilih & memperbarui relasi produk (product_id) pada konten.
// Caller: components/history/ContentHistoryTable.tsx
// Dependensi: app/actions/contents.ts, types/index.ts, next/navigation (useRouter), lucide-react
// Main Functions: ProductSelector
// Side Effects: Memanggil updateContentProductIdAction dan memicu refresh router.
// */

"use client";

import React, { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Product } from "@/types";
import { updateContentProductIdAction } from "@/app/actions/contents";
import { Loader2, ChevronDown, Search, Check, X } from "lucide-react";

interface ProductSelectorProps {
  contentId: string;
  initialProductId: string | null;
  products: Product[];
}

export default function ProductSelector({
  contentId,
  initialProductId,
  products,
}: ProductSelectorProps) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string>(initialProductId || "");
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Cari objek produk terpilih saat ini
  const selectedProduct = products.find((p) => p.id === selectedId);

  // Tutup dropdown jika klik di luar komponen
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Autofokus ke input pencarian ketika dropdown dibuka
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      // Small timeout to ensure input is rendered in DOM
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    } else {
      setSearchTerm("");
    }
  }, [isOpen]);

  const handleProductChange = async (newProductId: string) => {
    if (newProductId === selectedId) {
      setIsOpen(false);
      return;
    }

    const previousId = selectedId;
    setSelectedId(newProductId);
    setIsOpen(false);
    setLoading(true);

    try {
      const res = await updateContentProductIdAction(contentId, newProductId || null);
      if (res.success) {
        router.refresh();
      } else {
        alert(res.message);
        setSelectedId(previousId); // Rollback
      }
    } catch (err: any) {
      alert(err.message || "Gagal memperbarui produk konten.");
      setSelectedId(previousId); // Rollback
    } finally {
      setLoading(false);
    }
  };

  // Filter produk berdasarkan nama atau brand
  const filteredProducts = products.filter((p) =>
    p.nama.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.brand && p.brand.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className={`relative inline-block w-full max-w-[180px] ${isOpen ? "z-50" : "z-0"}`} ref={containerRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => !loading && setIsOpen(!isOpen)}
        disabled={loading}
        className={`w-full flex items-center justify-between bg-bg border border-border text-[11px] rounded-lg py-1.5 px-2.5 text-text-main hover:bg-bg/50 outline-none transition-all duration-150 select-none ${
          loading ? "opacity-60 cursor-not-allowed" : "cursor-pointer"
        }`}
        title={selectedProduct ? `${selectedProduct.nama} ${selectedProduct.brand ? `(${selectedProduct.brand})` : ""}` : "Pilih Produk"}
      >
        <span className="truncate pr-1.5 text-left flex-1 font-medium">
          {selectedProduct
            ? `${selectedProduct.nama}${selectedProduct.brand ? ` (${selectedProduct.brand})` : ""}`
            : "-- Pilih Produk --"}
        </span>
        {loading ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin text-accent flex-shrink-0" />
        ) : (
          <ChevronDown
            className={`w-3.5 h-3.5 text-text-placeholder transition-transform duration-200 flex-shrink-0 ${
              isOpen ? "rotate-180" : ""
            }`}
          />
        )}
      </button>

      {/* Popover Dropdown */}
      {isOpen && (
        <div className="absolute left-0 mt-1 w-[220px] bg-white border border-border rounded-xl shadow-xl z-50 p-2 flex flex-col gap-1.5 animate-in fade-in slide-in-from-top-1 duration-150">
          {/* Search Box */}
          <div className="relative flex items-center">
            <Search className="w-3.5 h-3.5 text-text-placeholder absolute left-2.5 pointer-events-none" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Cari nama atau brand..."
              className="w-full bg-bg border border-border text-[10px] rounded-md py-1.5 pl-8 pr-7 text-text-main placeholder-text-placeholder outline-none focus:border-accent transition-all"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm("")}
                className="absolute right-2 p-0.5 text-text-placeholder hover:text-text-main rounded-full"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Product Items List */}
          <div className="max-h-40 overflow-y-auto divide-y divide-border/20 flex flex-col scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
            {/* Opsi Kosong (Clear) */}
            <button
              type="button"
              onClick={() => handleProductChange("")}
              className={`w-full text-left px-2 py-2 text-[10px] rounded-md hover:bg-bg transition-colors flex items-center justify-between cursor-pointer ${
                !selectedId ? "text-accent font-bold bg-accent/5" : "text-text-placeholder"
              }`}
            >
              <span className="truncate">-- Pilih Produk --</span>
              {!selectedId && <Check className="w-3.5 h-3.5 text-accent flex-shrink-0" />}
            </button>

            {/* List Master Produk */}
            {filteredProducts.length === 0 ? (
              <div className="text-[10px] text-text-placeholder text-center py-4 italic">
                Produk tidak ditemukan
              </div>
            ) : (
              filteredProducts.map((p) => {
                const isSelected = p.id === selectedId;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleProductChange(p.id)}
                    className={`w-full text-left px-2 py-2 text-[10px] rounded-md hover:bg-bg transition-colors flex items-center justify-between cursor-pointer ${
                      isSelected ? "text-accent font-bold bg-accent/5" : "text-text-main"
                    }`}
                    title={`${p.nama} ${p.brand ? `(${p.brand})` : ""}`}
                  >
                    <span className="truncate pr-2 flex-1 text-left">
                      {p.nama} {p.brand ? `(${p.brand})` : ""}
                    </span>
                    {isSelected && <Check className="w-3.5 h-3.5 text-accent flex-shrink-0" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
