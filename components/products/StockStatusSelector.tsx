// /*
// Tujuan: Komponen Client berupa dropdown pemilihan status ketersediaan stok produk secara instan (inline stock changer).
// Caller: components/products/ProductTable.tsx
// Dependensi: app/actions/products.ts, lucide-react
// Main Functions: StockStatusSelector
// Side Effects: Memanggil updateProductStockStatusAction server action dan me-refresh router.
// */

"use client";

import React, { useState, useRef, useEffect } from "react";
import { ChevronDown, Check, Loader2 } from "lucide-react";
import { updateProductStockStatusAction } from "@/app/actions/products";
import { useRouter } from "next/navigation";

interface StockStatusSelectorProps {
  productId: string;
  initialStockStatus: "available" | "out_of_stock" | "unknown";
}

export default function StockStatusSelector({
  productId,
  initialStockStatus,
}: StockStatusSelectorProps) {
  const [stockStatus, setStockStatus] = useState<"available" | "out_of_stock" | "unknown">(initialStockStatus);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Close dropdown if clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleStockStatusChange = async (newStatus: "available" | "out_of_stock" | "unknown") => {
    if (newStatus === stockStatus) {
      setIsOpen(false);
      return;
    }

    setLoading(true);
    setIsOpen(false);

    try {
      const res = await updateProductStockStatusAction(productId, newStatus, "user", `Stok produk diubah menjadi ${newStatus} oleh user`);
      if (res.success) {
        setStockStatus(newStatus);
        router.refresh();
      } else {
        alert(res.message);
      }
    } catch (err: any) {
      alert(err.message || "Gagal mengubah status stok.");
    } finally {
      setLoading(false);
    }
  };

  const statusConfig = {
    available: {
      dot: "bg-emerald-500",
      text: "Tersedia",
      btnClass: "bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100/50",
    },
    out_of_stock: {
      dot: "bg-rose-500",
      text: "Habis",
      btnClass: "bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100/50",
    },
    unknown: {
      dot: "bg-slate-400",
      text: "Unknown",
      btnClass: "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100/50",
    },
  };

  const current = statusConfig[stockStatus] || statusConfig.unknown;

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <button
        onClick={() => !loading && setIsOpen(!isOpen)}
        disabled={loading}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border transition-all duration-150 cursor-pointer focus:outline-none select-none ${current.btnClass} ${
          loading ? "opacity-60 cursor-not-allowed" : ""
        }`}
      >
        {loading ? (
          <Loader2 className="w-3 h-3 animate-spin text-text-placeholder" />
        ) : (
          <span className={`w-1.5 h-1.5 rounded-full ${current.dot}`} />
        )}
        <span>{current.text}</span>
        <ChevronDown
          className={`w-3 h-3 opacity-60 transition-transform duration-200 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-1 w-28 bg-white border border-border-light rounded-xl shadow-lg z-50 overflow-hidden py-1 animate-in fade-in slide-in-from-top-1 duration-150">
          {(["available", "out_of_stock", "unknown"] as const).map((s) => {
            const active = s === stockStatus;
            const config = statusConfig[s];
            return (
              <button
                key={s}
                onClick={() => handleStockStatusChange(s)}
                className={`w-full flex items-center justify-between px-3 py-1.5 text-[10px] font-bold text-left cursor-pointer hover:bg-bg-panel transition-colors duration-150 ${
                  active ? "text-text-main" : "text-text-placeholder hover:text-text-muted"
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
                  <span>{config.text}</span>
                </div>
                {active && <Check className="w-3 h-3 text-accent" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
