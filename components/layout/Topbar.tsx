// /*
// Tujuan: Menyediakan topbar header di atas halaman dashboard dengan status scoring mode dan sinkronisasi database.
// Caller: app/(dashboard)/layout.tsx
// Dependensi: lucide-react
// Main Functions: Topbar
// Side Effects: None (UI display only)
// */

import { CloudLightning, HelpCircle } from "lucide-react";

interface TopbarProps {
  title: string;
  scoringMode?: "benchmark" | "topsis";
}

export default function Topbar({ title, scoringMode = "benchmark" }: TopbarProps) {
  return (
    <header className="h-14 border-b border-border-light px-6 bg-white/85 backdrop-blur-md sticky top-0 z-40 flex items-center justify-between gap-4">
      {/* Page Title */}
      <div className="flex items-center gap-3">
        <h1 className="font-extrabold text-base tracking-tight text-text-main">
          {title}
        </h1>
        {scoringMode && (
          <span
            className={`text-[9px] px-2 py-0.5 rounded-full font-mono font-bold uppercase tracking-wider ${
              scoringMode === "topsis"
                ? "bg-special-bg text-special border border-special-border"
                : "bg-success-bg text-success border border-success-border"
            }`}
          >
            {scoringMode === "topsis" ? "TOPSIS Mode" : "Benchmark Mode"}
          </span>
        )}
      </div>

      {/* Status Bar */}
      <div className="flex items-center gap-3">
        {/* Supabase connection indicator */}
        <div className="flex items-center gap-2 text-[10px] text-text-placeholder">
          <div className="w-2 h-2 rounded-full bg-success shadow-[0_0_6px_var(--success)] animate-pulse-dot" />
          <span className="font-semibold">Cloud Sync Aktif</span>
        </div>

        <div className="w-px h-4 bg-border-light" />

        {/* Documentation help */}
        <a
          href="https://github.com/mhmdrzki/affiliate-manajemen"
          target="_blank"
          rel="noopener noreferrer"
          className="text-text-placeholder hover:text-accent p-1 transition-colors duration-150"
          title="Dokumentasi & Bantuan"
        >
          <HelpCircle className="w-4 h-4" />
        </a>
      </div>
    </header>
  );
}
