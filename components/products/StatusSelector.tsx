// /*
// Tujuan: Komponen Client dropdown pemilihan status keaktifan produk secara instan (inline status changer).
// Caller: app/(dashboard)/products/page.tsx (tabel produk)
// Dependensi: app/actions/products.ts, lucide-react
// Main Functions: StatusSelector
// Side Effects: Memanggil updateProductStatusAction server action dan melakukan trigger refresh router.
// */

"use client";

import React, { useState, useRef, useEffect } from "react";
import { ChevronDown, Check, Loader2 } from "lucide-react";
import { updateProductStatusAction } from "@/app/actions/products";

interface StatusSelectorProps {
  productId: string;
  initialStatus: "aktif" | "jeda" | "habis";
}

export default function StatusSelector({
  productId,
  initialStatus,
}: StatusSelectorProps) {
  const [status, setStatus] = useState<"aktif" | "jeda" | "habis">(initialStatus);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

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

  const handleStatusChange = async (newStatus: "aktif" | "jeda" | "habis") => {
    if (newStatus === status) {
      setIsOpen(false);
      return;
    }

    setLoading(true);
    setIsOpen(false);

    try {
      const res = await updateProductStatusAction(productId, newStatus);
      if (res.success) {
        setStatus(newStatus);
      } else {
        alert(res.message);
      }
    } catch (err: any) {
      alert(err.message || "Gagal mengubah status.");
    } finally {
      setLoading(false);
    }
  };

  const statusConfig = {
    aktif: {
      dot: "bg-emerald-500",
      text: "Aktif",
      btnClass: "bg-success-bg border-success-border text-success hover:bg-emerald-100/50",
    },
    jeda: {
      dot: "bg-amber-500",
      text: "Jeda",
      btnClass: "bg-warning-bg border-warning-border text-warning hover:bg-amber-100/50",
    },
    habis: {
      dot: "bg-rose-500",
      text: "Habis",
      btnClass: "bg-danger-bg border-danger-border text-danger hover:bg-rose-100/50",
    },
  };

  const current = statusConfig[status];

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
          {(["aktif", "jeda", "habis"] as const).map((s) => {
            const active = s === status;
            const config = statusConfig[s];
            return (
              <button
                key={s}
                onClick={() => handleStatusChange(s)}
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
