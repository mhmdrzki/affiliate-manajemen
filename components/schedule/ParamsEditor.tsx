// /*
// Tujuan: Menyediakan form editor parameter tuning skoring dengan tema terang yang interaktif dan modern.
// Caller: components/schedule/ScheduleGeneratorClient.tsx
// Dependensi: React, app/actions/schedule.ts, lib/scoring/constants.ts, lucide-react
// Main Functions: ParamsEditor
// Side Effects: Memanggil server action updateScoringParamsAction untuk menyimpan ke SQLite.
// */

"use client";

import React, { useState, useEffect } from "react";
import { updateScoringParamsAction } from "@/app/actions/schedule";
import { SCORING_DEFAULTS } from "@/lib/scoring/constants";
import { Save, RotateCcw, AlertCircle } from "lucide-react";

interface ParamsEditorProps {
  initialParams: Record<string, number>;
  onParamsSaved: (newParams: Record<string, number>) => void;
}

export default function ParamsEditor({ initialParams, onParamsSaved }: ParamsEditorProps) {
  const [params, setParams] = useState<Record<string, number>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (initialParams) {
      setParams(initialParams);
    }
  }, [initialParams]);

  const handleChange = (key: string, value: string) => {
    const num = parseFloat(value);
    setParams((prev) => ({
      ...prev,
      [key]: isNaN(num) ? 0 : num,
    }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setMessage(null);

    const res = await updateScoringParamsAction(params);
    setIsSaving(false);

    if (res.success) {
      setMessage({ type: "success", text: res.message });
      onParamsSaved(params);
    } else {
      setMessage({ type: "error", text: res.message });
    }
  };

  const handleReset = () => {
    if (confirm("Apakah Anda yakin ingin mengembalikan seluruh parameter skoring ke default bawaan sistem?")) {
      setParams({ ...SCORING_DEFAULTS });
      setMessage(null);
    }
  };

  const formFields = [
    {
      group: "Pool Klasifikasi & Testing",
      fields: [
        {
          key: "TEST_BUDGET",
          label: "Test Budget (Batas Percobaan)",
          desc: "Batas jumlah konten yang dicoba pada produk baru sebelum dipindahkan ke Pool C (Watchlist).",
          step: 1,
        },
        {
          key: "GRACE_DAYS",
          label: "Grace Days (Hari Masa Tenggang)",
          desc: "Jumlah hari sejak produk ditambahkan di mana produk tersebut dianggap sebagai produk baru (Pool D).",
          step: 1,
        },
        {
          key: "BASE_TESTING",
          label: "Base Testing Score",
          desc: "Titik awal skor default produk di Pool B (Testing).",
          step: 0.1,
        },
        {
          key: "TESTING_CONTENT_PENALTY",
          label: "Content Penalty Score (Penalti Konten)",
          desc: "Pengurangan skor per konten testing yang telah diposting tanpa hasil closing order.",
          step: 0.01,
        },
        {
          key: "NEW_PRODUCT_BONUS",
          label: "New Product Bonus (Bonus Produk Baru)",
          desc: "Tambahan bonus skor untuk produk baru yang sama sekali belum pernah dicoba di sistem.",
          step: 0.1,
        },
      ],
    },
    {
      group: "Scheduler & Keadilan (Fairness)",
      fields: [
        {
          key: "TOTAL_DAILY_SLOTS",
          label: "Total Daily Slots (Slot Harian)",
          desc: "Jumlah total slot jadwal konten yang dibuat setiap hari.",
          step: 1,
        },
        {
          key: "MAX_SLOT_PER_PRODUK",
          label: "Max Slots Per Product (Batas Keberagaman)",
          desc: "Batas maksimal jumlah slot yang dapat diperoleh satu produk dalam hari yang sama.",
          step: 1,
        },
        {
          key: "FAIRNESS_WINDOW",
          label: "Fairness Window (Batas Dilupakan)",
          desc: "Jumlah hari maksimal produk Proven boleh tanpa konten sebelum dipaksa masuk jadwal kembali.",
          step: 1,
        },
      ],
    },
  ];

  return (
    <div className="bg-white border border-border-light rounded-xl p-6 shadow-2xs max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-border-light">
        <div>
          <h3 className="text-sm font-black text-text-main">Konfigurasi & Parameter Skoring</h3>
          <p className="text-[11px] text-text-placeholder mt-1 font-semibold">
            Ubah bobot dan batasan untuk menyesuaikan cara algoritma merekomendasikan jadwal harian konten Anda.
          </p>
        </div>
        <button
          type="button"
          onClick={handleReset}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border-light text-text-muted hover:text-text-main hover:bg-slate-50 text-xs font-bold transition shadow-2xs cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Reset Default</span>
        </button>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {formFields.map((group, gIdx) => (
          <div key={gIdx} className="space-y-4 border-t border-border-light/60 pt-5 first:border-t-0 first:pt-0">
            <h4 className="text-xs font-black tracking-wider uppercase text-accent font-mono">
              {group.group}
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {group.fields.map((f) => (
                <div key={f.key} className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <label htmlFor={f.key} className="text-xs font-bold text-text-main">
                      {f.label}
                    </label>
                    <span className="text-[10px] text-accent font-bold font-mono bg-accent/5 border border-accent/10 px-1.5 py-0.5 rounded">
                      Default: {SCORING_DEFAULTS[f.key as keyof typeof SCORING_DEFAULTS]}
                    </span>
                  </div>
                  <input
                    type="number"
                    id={f.key}
                    step={f.step}
                    value={params[f.key] ?? 0}
                    onChange={(e) => handleChange(f.key, e.target.value)}
                    className="w-full bg-bg border border-border-light rounded-lg px-3 py-2 text-xs text-text-main focus:outline-none focus:border-accent font-semibold font-mono"
                    required
                  />
                  <p className="text-[10px] text-text-placeholder leading-relaxed font-semibold">
                    {f.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ))}

        {message && (
          <div
            className={`flex items-start gap-2 p-3.5 rounded-xl text-xs font-bold border ${
              message.type === "success"
                ? "bg-emerald-50 text-emerald-700 border-emerald-250/60"
                : "bg-red-50 text-red-700 border-red-250/60"
            }`}
          >
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{message.text}</span>
          </div>
        )}

        <div className="flex justify-end pt-5 border-t border-border-light">
          <button
            type="submit"
            disabled={isSaving}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-accent text-white hover:bg-accent-hover text-xs font-bold shadow-md cursor-pointer transition disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{isSaving ? "Menyimpan..." : "Simpan Konfigurasi"}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
