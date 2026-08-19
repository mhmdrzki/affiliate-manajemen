// /*
// Tujuan: Komponen UI untuk merender kartu slot jadwal konten harian dengan styling premium tema terang dan aksi interaktif.
// Caller: components/schedule/ScheduleGeneratorClient.tsx
// Dependensi: React, next/link, components/schedule/PoolBadge.tsx, lucide-react
// Main Functions: ScheduleCard
// Side Effects: None
// */

import React from "react";
import Link from "next/link";
import PoolBadge from "./PoolBadge";
import { HelpCircle, Flame, ShieldAlert, Award, Sparkles, LineChart } from "lucide-react";

interface ScheduleCardProps {
  productId?: string;
  slotNumber: number;
  productName: string;
  slotType: "collaboration" | "fairness" | "ranked" | string;
  pool: "A" | "B" | string | null;
  score: number | null;
  paceInfo?: {
    sisa_wajib: number;
    hari_tersisa: number;
    pace_harian: number;
  };
  onViewScoring?: (productId: string) => void;
}

export default function ScheduleCard({
  productId,
  slotNumber,
  productName,
  slotType,
  pool,
  score,
  paceInfo,
  onViewScoring,
}: ScheduleCardProps) {
  let typeLabel = "";
  let typeClasses = "";
  let icon = <HelpCircle className="w-3.5 h-3.5" />;

  switch (slotType) {
    case "collaboration":
      typeLabel = "Wajib Kolaborasi";
      typeClasses = "bg-rose-50 text-rose-700 border border-rose-200/80 shadow-2xs";
      icon = <Flame className="w-3.5 h-3.5 text-rose-600" />;
      break;
    case "hot_product":
      typeLabel = "🔥 Winning Product";
      typeClasses = "bg-orange-50 text-orange-700 border border-orange-200/80 shadow-2xs font-extrabold";
      icon = <Flame className="w-3.5 h-3.5 text-orange-600" />;
      break;
    case "fairness":
      typeLabel = "Keadilan (Fairness)";
      typeClasses = "bg-amber-50 text-amber-700 border border-amber-200/80 shadow-2xs";
      icon = <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />;
      break;
    case "ranked":
      typeLabel = "Skor Tertinggi";
      typeClasses = "bg-indigo-50 text-indigo-700 border border-indigo-200/80 shadow-2xs";
      icon = <Award className="w-3.5 h-3.5 text-indigo-600" />;
      break;
    default:
      typeLabel = slotType;
      typeClasses = "bg-slate-50 text-slate-700 border border-slate-200 shadow-2xs";
  }

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-border-light p-4 rounded-xl hover:border-accent hover:shadow-[0_4px_20px_rgba(99,102,241,0.08)] hover:-translate-y-[1px] transition-all duration-200 group">
      <div className="flex items-center gap-4 flex-1 min-w-0">
        {/* Slot number Badge */}
        <div className="w-10 h-10 rounded-lg bg-accent/5 border border-accent/20 flex flex-col items-center justify-center font-mono flex-shrink-0 group-hover:bg-accent group-hover:border-accent transition-all duration-200">
          <span className="text-[8px] text-accent font-extrabold uppercase tracking-widest group-hover:text-white transition-colors">Slot</span>
          <span className="text-sm font-black text-text-main group-hover:text-white -mt-0.5 transition-colors">{slotNumber}</span>
        </div>

        {/* Main product detail */}
        <div className="flex-1 min-w-0 space-y-1.5">
          <h4 className="text-xs sm:text-sm font-bold text-text-main truncate" title={productName}>
            {productName}
          </h4>
          <div className="flex flex-wrap items-center gap-2">
            {/* Slot Type Badge */}
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-extrabold uppercase tracking-wider ${typeClasses}`}>
              {icon}
              <span>{typeLabel}</span>
            </span>

            {/* Pool Badge */}
            {pool && <PoolBadge pool={pool} />}

            {/* Score Badge (for ranked slots) */}
            {score !== null && score !== undefined && (
              <span className="text-[10px] text-indigo-700 font-mono font-bold bg-indigo-50 border border-indigo-150 px-1.5 py-0.5 rounded shadow-2xs">
                Skor: {score.toFixed(3)}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap sm:flex-nowrap items-center gap-3 sm:pl-4 sm:border-l sm:border-border-light flex-shrink-0 justify-end">
        {/* Right side helper info (e.g., Pace info for Collaboration) */}
        {slotType === "collaboration" && paceInfo && (
          <div className="text-right font-mono mr-2 hidden md:block">
            <div className="text-[9px] text-text-placeholder uppercase font-extrabold tracking-wider">
              Target Pace
            </div>
            <div className="text-xs font-black text-rose-600 mt-0.5">
              {paceInfo.pace_harian} Konten/Hari
            </div>
            <div className="text-[9px] text-text-muted mt-0.5">
              Sisa: {paceInfo.sisa_wajib} video | {paceInfo.hari_tersisa} hari
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {productId && (
            <Link
              href={`/scripts?product_id=${productId}`}
              title="Tulis naskah video affiliate dengan AI"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border-light hover:border-accent/40 bg-white hover:bg-accent/5 text-[10px] font-bold text-text-muted hover:text-accent shadow-2xs transition-all duration-150"
            >
              <Sparkles className="w-3 h-3 text-accent" />
              <span>Naskah AI</span>
            </Link>
          )}

          {productId && onViewScoring && (
            <button
              onClick={() => onViewScoring(productId)}
              title="Lihat rincian scoring di kalkulator"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border-light hover:border-accent/40 bg-white hover:bg-accent/5 text-[10px] font-bold text-text-muted hover:text-accent shadow-2xs transition-all duration-150"
            >
              <LineChart className="w-3 h-3 text-indigo-500" />
              <span>Analisis Skor</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

