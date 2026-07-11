// /*
// Tujuan: Komponen dialog modal untuk membungkus ImportUploader dan mengelola visibilitas dialog impor.
// Caller: app/(dashboard)/import/page.tsx
// Dependensi: components/import/ImportUploader.tsx, lucide-react, next/navigation
// Main Functions: ImportModal
// Side Effects: None
// */

"use client";

import React from "react";
import { X } from "lucide-react";
import ImportUploader from "./ImportUploader";
import { useRouter } from "next/navigation";

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ImportModal({ isOpen, onClose }: ImportModalProps) {
  const router = useRouter();

  if (!isOpen) return null;

  const handleSuccess = () => {
    // Refresh page data
    router.refresh();
    // Close modal after brief delay or directly
    setTimeout(() => {
      onClose();
    }, 1000);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 transition-all duration-200">
      <div 
        className="bg-white border border-border-light rounded-2xl shadow-2xl w-full max-w-2xl relative overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-border-light flex items-center justify-between bg-bg/50">
          <h3 className="font-extrabold text-sm text-text-main uppercase tracking-wider">
            Impor File Pesanan Baru
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-bg rounded-lg text-text-placeholder hover:text-text-main transition-colors cursor-pointer"
            title="Tutup"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto">
          <ImportUploader onSuccessAction={handleSuccess} />
        </div>
      </div>
    </div>
  );
}
