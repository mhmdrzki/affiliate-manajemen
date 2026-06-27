// /*
// Tujuan: Halaman UI Jadwal Konten interaktif untuk men-generate jadwal cerdas (round-robin + dynamic hour), melihat riwayat jadwal harian, menyalin naskah video per slot, dan mengunduh CSV/TXT.
// Caller: Route /schedule
// Dependensi: components/layout/Topbar.tsx, app/actions/schedule.ts, types/index.ts, lucide-react, next/navigation (useRouter)
// Main Functions: SchedulePage
// Side Effects: Mengambil data jadwal, memicu generator, menyimpan, menghapus jadwal di database Supabase, dan memicu unduhan file biner di browser.
// */

"use client";

import React, { useState, useEffect } from "react";
import Topbar from "@/components/layout/Topbar";
import {
  getSchedulesAction,
  deleteScheduleAction,
  generateAndSaveScheduleAction,
} from "@/app/actions/schedule";
import { ScheduleDaySlot } from "@/types";
import {
  Calendar,
  Clock,
  Sparkles,
  Download,
  Trash2,
  ChevronRight,
  ChevronDown,
  Loader2,
  FileText,
  Copy,
  Check,
  AlertCircle,
  HelpCircle,
} from "lucide-react";

export default function SchedulePage() {
  const [schedules, setSchedules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  
  // Tab hari aktif untuk jadwal yang sedang dipilih
  const [activeDayIdx, setActiveDayIdx] = useState(0);

  // Modal Pratinjau Naskah
  const [previewScript, setPreviewScript] = useState<{
    jam: string;
    productName: string;
    hook: string;
    proof: string;
    cta: string;
    script: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  // Form Config States
  const [startDate, setStartDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [rangeDays, setRangeDays] = useState(7);
  const [patternSlotsKey, setPatternSlotsKey] = useState("6");
  const [winPct, setWinPct] = useState(50);
  const [useDynamicJam, setUseDynamicJam] = useState(true);
  const [useCooldown, setUseCooldown] = useState(true);

  const fetchSchedules = async () => {
    try {
      const data = await getSchedulesAction();
      setSchedules(data);
      if (data.length > 0 && !expandedId) {
        setExpandedId(data[0].id); // Expand schedule terbaru
      }
    } catch (err) {
      console.error("Gagal memuat jadwal:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSchedules();
  }, []);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const res = await generateAndSaveScheduleAction({
        startDate,
        rangeDays: Number(rangeDays),
        patternSlotsKey,
        winPct: Number(winPct),
        useDynamicJam,
        useCooldown,
      });

      if (res.success) {
        alert(res.message);
        // Refresh schedules
        const data = await getSchedulesAction();
        setSchedules(data);
        if (res.data) {
          setExpandedId(res.data.id);
          setActiveDayIdx(0);
        }
      } else {
        alert(res.message);
      }
    } catch (err: any) {
      alert(err.message || "Gagal men-generate jadwal.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Mencegah accordion ter-toggle
    if (!confirm("Apakah Anda yakin ingin menghapus catatan jadwal ini?")) return;

    try {
      const res = await deleteScheduleAction(id);
      if (res.success) {
        setSchedules((prev) => prev.filter((s) => s.id !== id));
        if (expandedId === id) setExpandedId(null);
      } else {
        alert(res.message);
      }
    } catch (err: any) {
      alert(err.message || "Gagal menghapus jadwal.");
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // --- DOWNLOAD FILE EXPORTERS ---

  const downloadCSV = (schedule: any) => {
    const dataSlots = schedule.schedule_data as ScheduleDaySlot[];
    let csvContent = "\uFEFF"; // BOM untuk Excel agar encoding UTF-8 benar
    csvContent += "Hari/Tanggal,Jam Posting,Tipe Slot,Nama Produk,Brand,Kategori,Naskah Hook,Naskah Proof,Naskah CTA\n";

    dataSlots.forEach((day) => {
      day.slots.forEach((s) => {
        const escapeCSV = (str: string | null) => {
          if (!str) return '""';
          return `"${str.replace(/"/g, '""').replace(/\n/g, " ")}"`;
        };
        csvContent += `${day.hari},${s.jam},${s.tipe},${escapeCSV(s.productName)},${escapeCSV(s.brand)},${escapeCSV(s.kategori)},${escapeCSV(s.hook)},${escapeCSV(s.proof)},${escapeCSV(s.cta)}\n`;
      });
    });

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `jadwal_affiliate_${schedule.id.substring(0, 8)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadTXT = (schedule: any) => {
    const dataSlots = schedule.schedule_data as ScheduleDaySlot[];
    let txtContent = `JADWAL DAN NASKAH AFFILIATE OS\nTanggal Pembuatan: ${new Date(schedule.created_at).toLocaleString("id-ID")}\n\n`;

    dataSlots.forEach((day) => {
      txtContent += `================================================================================\n`;
      txtContent += `HARI: ${day.hari.toUpperCase()}\n`;
      txtContent += `================================================================================\n\n`;

      day.slots.forEach((s, idx) => {
        txtContent += `SLOT #${idx + 1} - ${s.jam} (${s.tipe})\n`;
        txtContent += `Produk: ${s.productName || "—"} (Brand: ${s.brand || "—"} | Kategori: ${s.kategori || "—"})\n`;
        txtContent += `--------------------------------------------------------------------------------\n`;
        txtContent += `[HOOK]\n${s.hook || "—"}\n\n`;
        txtContent += `[PROOF]\n${s.proof || "—"}\n\n`;
        txtContent += `[CTA]\n${s.cta || "—"}\n`;
        txtContent += `\n*Catatan: Isi teks naskah video lengkap bisa Anda generate dari tab AI Script.*\n\n\n`;
      });
    });

    const blob = new Blob([txtContent], { type: "text/plain;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `naskah_affiliate_${schedule.id.substring(0, 8)}.txt`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const currentExpandedSchedule = schedules.find((s) => s.id === expandedId);

  return (
    <div className="flex-1 flex flex-col min-h-screen">
      <Topbar title="Generator Jadwal Cerdas" />

      <div className="p-6 space-y-6 flex-1 flex flex-col lg:flex-row gap-6 items-start">
        {/* --- PANEL KIRI: FORM GENERATOR --- */}
        <div className="w-full lg:w-80 bg-white border border-border-light rounded-xl p-5 shadow-sm space-y-4 shrink-0">
          <div className="flex items-center gap-2 pb-3 border-b border-border-light">
            <Calendar className="w-4 h-4 text-accent" />
            <h3 className="text-xs font-extrabold text-text-main uppercase tracking-wider">
              Konfigurasi Jadwal
            </h3>
          </div>

          <form onSubmit={handleGenerate} className="space-y-4">
            {/* Input: Tanggal Mulai */}
            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold text-text-placeholder uppercase tracking-wider">
                Tanggal Mulai
              </label>
              <input
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full text-xs px-3 py-2 bg-bg border border-border-light focus:border-accent rounded-lg focus:outline-none transition-colors"
              />
            </div>

            {/* Input: Jumlah Hari */}
            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold text-text-placeholder uppercase tracking-wider">
                Rentang Waktu (Hari)
              </label>
              <select
                value={rangeDays}
                onChange={(e) => setRangeDays(Number(e.target.value))}
                className="w-full text-xs px-3 py-2 bg-bg border border-border-light focus:border-accent rounded-lg focus:outline-none transition-colors cursor-pointer"
              >
                <option value="3">3 Hari (Uji Coba Cepat)</option>
                <option value="7">7 Hari (1 Minggu Penuh)</option>
                <option value="14">14 Hari (2 Minggu)</option>
                <option value="30">30 Hari (1 Bulan Penuh)</option>
              </select>
            </div>

            {/* Input: Pola Slot Harian */}
            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold text-text-placeholder uppercase tracking-wider flex items-center justify-between">
                <span>Slot Posting Harian</span>
                <Clock className="w-3.5 h-3.5 text-text-placeholder" />
              </label>
              <select
                value={patternSlotsKey}
                onChange={(e) => setPatternSlotsKey(e.target.value)}
                className="w-full text-xs px-3 py-2 bg-bg border border-border-light focus:border-accent rounded-lg focus:outline-none transition-colors cursor-pointer"
              >
                <option value="3">3 Slot / Hari</option>
                <option value="5">5 Slot / Hari</option>
                <option value="6">6 Slot / Hari</option>
                <option value="10">10 Slot / Hari (Agresif)</option>
              </select>
            </div>

            {/* Input: Kuota Tier Winning */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-[10px] font-bold text-text-placeholder uppercase tracking-wider">
                <span>Kuota Winning Tier</span>
                <span className="text-accent font-mono">{winPct}%</span>
              </div>
              <input
                type="range"
                min="10"
                max="90"
                step="5"
                value={winPct}
                onChange={(e) => setWinPct(Number(e.target.value))}
                className="w-full accent-accent cursor-pointer h-1.5 bg-bg-panel rounded-lg appearance-none"
              />
              <div className="flex justify-between text-[8px] text-text-placeholder font-bold">
                <span>10% (Konservatif)</span>
                <span>90% (Fokus Laku)</span>
              </div>
            </div>

            <div className="h-px bg-border-light my-2" />

            {/* Checkbox Options */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={useDynamicJam}
                  onChange={(e) => setUseDynamicJam(e.target.checked)}
                  className="rounded border-border-light text-accent focus:ring-accent w-4 h-4 cursor-pointer"
                />
                <span className="text-[10px] font-bold text-text-muted">
                  Gunakan Jam Analitik Akun
                </span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={useCooldown}
                  onChange={(e) => setUseCooldown(e.target.checked)}
                  className="rounded border-border-light text-accent focus:ring-accent w-4 h-4 cursor-pointer"
                />
                <span className="text-[10px] font-bold text-text-muted">
                  Terapkan Jeda Cooldown
                </span>
              </label>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={submitting || loading}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-accent hover:bg-accent-hover text-white rounded-lg text-xs font-bold transition-all duration-150 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_2px_8px_rgba(99,102,241,0.25)] focus:outline-none"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Mengkalkulasi Slot...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Generate Jadwal Cerdas</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* --- PANEL KANAN: RIWAYAT & DETAIL JADWAL --- */}
        <div className="flex-1 w-full space-y-6">
          {loading ? (
            <div className="bg-white border border-border-light rounded-xl p-12 text-center shadow-sm">
              <Loader2 className="w-8 h-8 animate-spin text-accent mx-auto mb-3" />
              <p className="text-xs text-text-placeholder font-medium">
                Mengambil data riwayat penjadwalan dari cloud...
              </p>
            </div>
          ) : schedules.length === 0 ? (
            /* Empty State */
            <div className="bg-white border border-border-light border-dashed rounded-xl p-12 text-center">
              <div className="w-12 h-12 bg-bg-panel border border-border-light rounded-xl flex items-center justify-center text-text-placeholder mx-auto mb-4">
                <Calendar className="w-6 h-6" />
              </div>
              <h4 className="font-extrabold text-sm text-text-main tracking-tight">
                Belum Ada Riwayat Jadwal
              </h4>
              <p className="text-xs text-text-placeholder mt-2 max-w-sm mx-auto leading-relaxed">
                Silakan isi konfigurasi parameter di panel sebelah kiri lalu tekan tombol **Generate Jadwal Cerdas** untuk memformulasikan postingan mingguan Anda.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* --- RIWAYAT ACCORDION SELECTOR --- */}
              <div className="bg-white border border-border-light rounded-xl p-4 shadow-sm space-y-2">
                <label className="block text-[10px] font-bold text-text-placeholder uppercase tracking-wider mb-2">
                  Pilih Riwayat Jadwal
                </label>
                <div className="flex flex-col divide-y divide-border-light border border-border-light rounded-lg overflow-hidden">
                  {schedules.map((s) => {
                    const isSelected = expandedId === s.id;
                    const dateObj = new Date(s.created_at);
                    const formattedDate = dateObj.toLocaleDateString("id-ID", {
                      weekday: "long",
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    });
                    const daySlots = s.schedule_data as ScheduleDaySlot[];
                    const nDays = daySlots.length;
                    const nSlots = daySlots[0]?.slots.length || 0;

                    return (
                      <div
                        key={s.id}
                        onClick={() => {
                          setExpandedId(s.id);
                          setActiveDayIdx(0);
                        }}
                        className={`flex items-center justify-between p-3 cursor-pointer text-xs transition-colors select-none ${
                          isSelected
                            ? "bg-accent/5 border-l-2 border-accent"
                            : "hover:bg-bg-panel"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <Calendar className={`w-4 h-4 ${isSelected ? "text-accent" : "text-text-placeholder"}`} />
                          <div>
                            <div className="font-bold text-text-main">
                              Jadwal {nDays} Hari ({nSlots} slot/hari)
                            </div>
                            <div className="text-[10px] text-text-placeholder mt-0.5">
                              Dibuat: {formattedDate}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          {/* Export Actions (Quick buttons) */}
                          <div className="flex items-center gap-1.5 opacity-60 hover:opacity-100 transition-opacity">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                downloadCSV(s);
                              }}
                              className="p-1 hover:bg-bg-panel text-text-muted hover:text-accent rounded"
                              title="Ekspor CSV"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                downloadTXT(s);
                              }}
                              className="p-1 hover:bg-bg-panel text-text-muted hover:text-accent rounded"
                              title="Ekspor TXT Naskah"
                            >
                              <FileText className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          <button
                            onClick={(e) => handleDelete(s.id, e)}
                            className="p-1.5 text-text-placeholder hover:text-danger hover:bg-danger-bg rounded-lg transition-all"
                            title="Hapus jadwal"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* --- TAMPILAN DETAIL JADWAL YANG TERPILIH --- */}
              {currentExpandedSchedule && (
                <div className="bg-white border border-border-light rounded-xl p-5 shadow-sm space-y-4">
                  {/* Header Detail Jadwal */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border-light">
                    <div>
                      <h4 className="text-xs font-extrabold text-text-main uppercase tracking-wider">
                        Rincian Jadwal Harian
                      </h4>
                      <p className="text-[10px] text-text-placeholder mt-0.5">
                        Klik tab hari di bawah untuk melihat susunan slot jam posting.
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => downloadCSV(currentExpandedSchedule)}
                        className="inline-flex items-center gap-1 py-1.5 px-3 bg-bg border border-border-light hover:border-border-active text-text-muted text-[10px] font-bold rounded-lg transition-colors cursor-pointer"
                      >
                        <Download className="w-3 h-3" />
                        <span>Unduh CSV</span>
                      </button>
                      <button
                        onClick={() => downloadTXT(currentExpandedSchedule)}
                        className="inline-flex items-center gap-1 py-1.5 px-3 bg-bg border border-border-light hover:border-border-active text-text-muted text-[10px] font-bold rounded-lg transition-colors cursor-pointer"
                      >
                        <FileText className="w-3 h-3" />
                        <span>Unduh TXT Naskah</span>
                      </button>
                    </div>
                  </div>

                  {/* Horizontal Tabs: Hari */}
                  <div className="overflow-x-auto pb-1.5 flex gap-1.5 scrollbar-thin">
                    {(currentExpandedSchedule.schedule_data as ScheduleDaySlot[]).map((day, idx) => {
                      const isActive = activeDayIdx === idx;
                      const dayName = day.hari.split(",")[0];
                      const dateStr = day.hari.split(",")[1]?.trim() || "";

                      return (
                        <button
                          key={idx}
                          onClick={() => setActiveDayIdx(idx)}
                          className={`px-3 py-2 rounded-lg border text-xs text-left shrink-0 transition-all cursor-pointer ${
                            isActive
                              ? "bg-accent border-accent text-white shadow-xs font-bold"
                              : "bg-bg border-border-light text-text-placeholder hover:text-text-muted hover:border-border-active"
                          }`}
                        >
                          <div className="text-[10px] uppercase font-bold tracking-wider">{dayName}</div>
                          <div className={`text-[9px] font-mono mt-0.5 ${isActive ? "text-white/80" : "text-text-placeholder"}`}>
                            {dateStr}
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* Grid / Tabel Slot Posting Hari Terpilih */}
                  <div className="border border-border-light rounded-xl overflow-hidden bg-bg-panel/40">
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse text-left text-xs">
                        <thead>
                          <tr className="bg-bg-panel border-b border-border-light text-[10px] font-bold text-text-placeholder uppercase tracking-wider">
                            <th className="p-3 w-20">Jam</th>
                            <th className="p-3 w-24">Tipe Slot</th>
                            <th className="p-3">Produk Terjadwal</th>
                            <th className="p-3">Brand & Kategori</th>
                            <th className="p-3 text-center w-28">Naskah</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border-light bg-white">
                          {(currentExpandedSchedule.schedule_data as ScheduleDaySlot[])[activeDayIdx]?.slots.map((s, si) => {
                            const badgeColor =
                              s.tipe === "PRIME" ? "bg-danger-bg text-danger border-danger-border" :
                              s.tipe === "MID" ? "bg-info-bg text-info border-info-border" :
                              "bg-bg-panel text-text-placeholder border-border-light";

                            return (
                              <tr key={si} className="hover:bg-bg-panel/20 transition-colors">
                                <td className="p-3 font-mono font-bold text-text-main">
                                  {s.jam}
                                </td>
                                <td className="p-3">
                                  <span className={`inline-flex px-2 py-0.5 rounded-full text-[9px] font-bold border uppercase ${badgeColor}`}>
                                    {s.tipe}
                                  </span>
                                </td>
                                <td className="p-3 font-bold text-text-main max-w-xs truncate">
                                  {s.productName || "—"}
                                </td>
                                <td className="p-3 text-text-placeholder">
                                  {s.brand || "—"} · <span className="font-semibold text-text-muted">{s.kategori || "—"}</span>
                                </td>
                                <td className="p-3 text-center">
                                  {s.productName ? (
                                    <button
                                      onClick={() =>
                                        setPreviewScript({
                                          jam: s.jam,
                                          productName: s.productName || "",
                                          hook: s.hook || "",
                                          proof: s.proof || "",
                                          cta: s.cta || "",
                                          script: `[HOOK]\n${s.hook}\n\n[PROOF]\n${s.proof}\n\n[CTA]\n${s.cta}`,
                                        })
                                      }
                                      className="inline-flex py-1 px-2.5 bg-accent/10 hover:bg-accent text-accent hover:text-white border border-accent/25 hover:border-accent text-[10px] font-bold rounded-lg transition-all cursor-pointer"
                                    >
                                      Pratinjau
                                    </button>
                                  ) : (
                                    <span className="text-[10px] text-text-placeholder font-semibold">
                                      —
                                    </span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* --- DIALOG PREVIEW NASKAH MODAL --- */}
      {previewScript && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="absolute inset-0" onClick={() => setPreviewScript(null)} />

          <div className="bg-white border border-border-light rounded-2xl shadow-xl w-full max-w-lg overflow-hidden relative z-10 transform scale-95 animate-in zoom-in-95 duration-200 flex flex-col max-h-[85vh]">
            {/* Header */}
            <div className="px-5 py-4 border-b border-border-light flex items-center justify-between">
              <div>
                <h3 className="font-extrabold text-sm text-text-main tracking-tight">
                  Pratinjau Naskah Video
                </h3>
                <p className="text-[10px] text-text-placeholder mt-0.5 font-medium">
                  Posting Jam: <span className="font-bold text-accent">{previewScript.jam}</span> · Produk:{" "}
                  <span className="font-bold text-text-muted">{previewScript.productName}</span>
                </p>
              </div>
              <button
                onClick={() => setPreviewScript(null)}
                className="text-text-placeholder hover:text-text-muted p-1 rounded-lg hover:bg-bg-panel transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4 select-text">
              <div className="space-y-3 bg-bg-panel/40 border border-border-light rounded-xl p-4 font-medium text-xs leading-relaxed text-text-muted max-h-96 overflow-y-auto">
                <div className="space-y-1">
                  <span className="text-[9px] font-bold text-accent bg-accent/10 border border-accent/20 px-1.5 py-0.5 rounded uppercase font-mono">
                    Hook (Pembuka)
                  </span>
                  <p className="pt-1">{previewScript.hook}</p>
                </div>
                <div className="space-y-1 border-t border-border-light/50 pt-2.5">
                  <span className="text-[9px] font-bold text-success bg-success-bg border border-success-border px-1.5 py-0.5 rounded uppercase font-mono">
                    Isi Konten (AI Desc)
                  </span>
                  <p className="pt-1 text-text-placeholder italic text-[11px]">
                    [Gunakan menu **AI Script Generator** di samping untuk mengunggah dan merancang isi konten video menggunakan Google Gemini AI secara live]
                  </p>
                </div>
                <div className="space-y-1 border-t border-border-light/50 pt-2.5">
                  <span className="text-[9px] font-bold text-warning bg-warning-bg border border-warning-border px-1.5 py-0.5 rounded uppercase font-mono">
                    Proof (Bukti)
                  </span>
                  <p className="pt-1">{previewScript.proof}</p>
                </div>
                <div className="space-y-1 border-t border-border-light/50 pt-2.5">
                  <span className="text-[9px] font-bold text-special bg-special-bg border border-special-border px-1.5 py-0.5 rounded uppercase font-mono">
                    CTA (Aksi)
                  </span>
                  <p className="pt-1">{previewScript.cta}</p>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-border-light bg-bg-panel/20 flex gap-3 justify-end">
              <button
                onClick={() => setPreviewScript(null)}
                className="px-4 py-2 bg-white border border-border-light hover:border-border-active text-text-muted rounded-lg text-xs font-bold transition-colors cursor-pointer"
              >
                Tutup
              </button>
              <button
                onClick={() => handleCopy(previewScript.script)}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-accent hover:bg-accent-hover text-white rounded-lg text-xs font-bold transition-colors cursor-pointer shadow-[0_2px_6px_rgba(99,102,241,0.15)]"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Tersalin!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Salin Naskah</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Simple Helper component to render X
function X({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      className={className}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
    </svg>
  );
}
