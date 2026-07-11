// /*
// Tujuan: Komponen UI untuk merender badge warna-warni representasi pool produk (A, B, C, D) dengan kontras tinggi untuk tema terang.
// Caller: components/schedule/ScoringPreviewTable.tsx, components/schedule/ScheduleCard.tsx
// Dependensi: None
// Main Functions: PoolBadge
// Side Effects: None
// */

import React from "react";
import { Pool } from "@/lib/scoring/types";

interface PoolBadgeProps {
  pool: Pool | string | null;
}

export default function PoolBadge({ pool }: PoolBadgeProps) {
  if (!pool) return null;

  let classes = "";
  let label = "";

  switch (pool) {
    case "A":
      classes = "bg-emerald-50 text-emerald-700 border border-emerald-250/60 shadow-xs";
      label = "Pool A — Proven";
      break;
    case "B":
      classes = "bg-blue-50 text-blue-700 border border-blue-250/60 shadow-xs";
      label = "Pool B — Testing";
      break;
    case "C":
      classes = "bg-amber-50 text-amber-700 border border-amber-250/60 shadow-xs";
      label = "Pool C — Watchlist";
      break;
    case "D":
      classes = "bg-purple-50 text-purple-700 border border-purple-250/60 shadow-xs";
      label = "Pool D — Baru";
      break;
    default:
      classes = "bg-slate-50 text-slate-700 border border-slate-200 shadow-xs";
      label = `Pool ${pool}`;
  }

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase ${classes}`}>
      {label}
    </span>
  );
}

