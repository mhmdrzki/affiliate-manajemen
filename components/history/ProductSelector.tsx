// /*
// Tujuan: Komponen dropdown inline dengan pencarian & tooltip instan (fixed-position, anti-clip) untuk memilih & memperbarui relasi produk pada konten.
// Caller: components/history/ContentHistoryTable.tsx
// Dependensi: app/actions/contents.ts, types/index.ts, next/navigation (useRouter), lucide-react, react-dom (createPortal)
// Main Functions: ProductSelector, FixedTooltip
// Side Effects: Memanggil updateContentProductIdAction dan memicu refresh router.
// */

"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Product } from "@/types";
import { updateContentProductIdAction } from "@/app/actions/contents";
import { Loader2, ChevronDown, Search, Check, X } from "lucide-react";

// ── Fixed Tooltip (render via portal ke document.body, tidak terpengaruh overflow parent) ──
interface FixedTooltipProps {
  text: string;
  subText?: string | null;
  anchorRect: DOMRect | null;
  visible: boolean;
}

function FixedTooltip({ text, subText, anchorRect, visible }: FixedTooltipProps) {
  if (!visible || !anchorRect) return null;

  const style: React.CSSProperties = {
    position: "fixed",
    left: anchorRect.left,
    top: anchorRect.top - 8,
    transform: "translateY(-100%)",
    maxWidth: 340,
    zIndex: 99999,
    pointerEvents: "none",
  };

  return createPortal(
    <div style={style} className="bg-amber-50 text-gray-800 text-[10px] leading-relaxed font-medium rounded-lg px-3.5 py-2.5 shadow-xl ring-1 ring-amber-200 animate-in fade-in duration-75">
      <div className="break-words whitespace-normal">{text}</div>
      {subText && (
        <div className="text-amber-700 mt-0.5 break-words font-bold">{subText}</div>
      )}
      <div className="absolute left-4 top-full w-0 h-0 border-x-[5px] border-x-transparent border-t-[5px] border-t-amber-50" />
    </div>,
    document.body
  );
}

// ── Komponen Utama ──
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

  // Tooltip state — digunakan untuk trigger button & item list
  const [tooltip, setTooltip] = useState<{
    text: string;
    subText?: string | null;
    rect: DOMRect | null;
  } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const selectedProduct = products.find((p) => p.product_id === selectedId);

  // Handler tooltip — getBoundingClientRect() lalu set state (instan, tanpa delay)
  const showTooltip = useCallback((e: React.MouseEvent, text: string, subText?: string | null) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setTooltip({ text, subText, rect });
  }, []);

  const hideTooltip = useCallback(() => {
    setTooltip(null);
  }, []);

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
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    } else {
      setSearchTerm("");
    }
    // Sembunyikan tooltip saat dropdown dibuka/ditutup
    setTooltip(null);
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
    setTooltip(null);

    try {
      const res = await updateContentProductIdAction(contentId, newProductId || null);
      if (res.success) {
        router.refresh();
      } else {
        alert(res.message);
        setSelectedId(previousId);
      }
    } catch (err: any) {
      alert(err.message || "Gagal memperbarui produk konten.");
      setSelectedId(previousId);
    } finally {
      setLoading(false);
    }
  };

  // Filter produk berdasarkan nama atau shop
  const filteredProducts = products.filter((p) =>
    p.product_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.shop_name && p.shop_name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <>
      <div className={`relative inline-block w-full max-w-[260px] ${isOpen ? "z-50" : "z-0"}`} ref={containerRef}>
        {/* Trigger Button */}
        <button
          type="button"
          onClick={() => !loading && setIsOpen(!isOpen)}
          disabled={loading}
          onMouseEnter={(e) => {
            if (selectedProduct && !isOpen) {
              showTooltip(e, selectedProduct.product_name, selectedProduct.shop_name);
            }
          }}
          onMouseLeave={hideTooltip}
          className={`w-full flex items-center justify-between bg-bg border border-border text-[11px] rounded-lg py-1.5 px-2.5 text-text-main hover:bg-bg/50 outline-none transition-all duration-150 select-none ${
            loading ? "opacity-60 cursor-not-allowed" : "cursor-pointer"
          }`}
        >
          <span className="truncate pr-1.5 text-left flex-1 font-medium">
            {selectedProduct
              ? `${selectedProduct.product_name}${selectedProduct.shop_name ? ` (${selectedProduct.shop_name})` : ""}`
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
          <div className="absolute left-0 mt-1 w-[300px] bg-white border border-border rounded-xl shadow-xl z-50 p-2 flex flex-col gap-1.5 animate-in fade-in slide-in-from-top-1 duration-150">
            {/* Search Box */}
            <div className="relative flex items-center">
              <Search className="w-3.5 h-3.5 text-text-placeholder absolute left-2.5 pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Cari nama atau toko..."
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
                  const isSelected = p.product_id === selectedId;
                  return (
                    <button
                      key={p.product_id}
                      type="button"
                      onClick={() => handleProductChange(p.product_id)}
                      onMouseEnter={(e) => showTooltip(e, p.product_name, p.shop_name)}
                      onMouseLeave={hideTooltip}
                      className={`w-full text-left px-2 py-2 text-[10px] rounded-md hover:bg-bg transition-colors flex items-center justify-between cursor-pointer ${
                        isSelected ? "text-accent font-bold bg-accent/5" : "text-text-main"
                      }`}
                    >
                      <span className="line-clamp-2 pr-2 flex-1 text-left leading-snug">
                        {p.product_name} {p.shop_name ? <span className="text-text-placeholder">({p.shop_name})</span> : ""}
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

      {/* Fixed Tooltip — render via portal ke document.body, tidak pernah terpotong overflow */}
      <FixedTooltip
        text={tooltip?.text || ""}
        subText={tooltip?.subText}
        anchorRect={tooltip?.rect || null}
        visible={!!tooltip}
      />
    </>
  );
}
