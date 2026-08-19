// /*
// Tujuan: Client component pengelola state utama halaman jadwal, panel metrik mingguan, toggle layout timeline vs grid, integrasi kartu slot interaktif, dan tuning parameter.
// Caller: app/(dashboard)/schedule/page.tsx
// Dependensi: React, app/actions/schedule.ts, components/schedule/*, lucide-react
// Main Functions: ScheduleGeneratorClient
// Side Effects: Memanggil server actions (generateAndSaveScheduleAction, deleteScheduleAction, dll)
// */

"use client";

import React, { useState, useEffect } from "react";
import {
  generateAndSaveScheduleAction,
  deleteScheduleAction,
  deleteScheduleRangeAction,
  clearAllSchedulesAction,
  getSchedulesAction,
  previewScoringAction,
} from "@/app/actions/schedule";
import ScheduleCard from "./ScheduleCard";
import ScoringPreviewTable from "./ScoringPreviewTable";
import ParamsEditor from "./ParamsEditor";
import {
  CalendarDays,
  Sparkles,
  Sliders,
  Calendar,
  Trash2,
  RefreshCw,
  Info,
  CalendarRange,
  LayoutGrid,
  ListFilter,
  LineChart,
  Video,
  ShoppingBag,
  TrendingUp,
} from "lucide-react";

interface ScheduleGeneratorClientProps {
  initialParams: Record<string, number>;
  initialSchedules: any[];
  initialPreview: any;
}

export default function ScheduleGeneratorClient({
  initialParams,
  initialSchedules,
  initialPreview,
}: ScheduleGeneratorClientProps) {
  const [activeTab, setActiveTab] = useState<"schedules" | "preview" | "params">("schedules");
  const [viewMode, setViewMode] = useState<"timeline" | "grid">("timeline");
  
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [selectedTimelineDate, setSelectedTimelineDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );

  const [schedulesList, setSchedulesList] = useState<any[]>(initialSchedules);
  const [scoringPreview, setScoringPreview] = useState<any>(initialPreview);
  const [params, setParams] = useState<Record<string, number>>(initialParams);
  
  const [isLoading, setIsLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Controlled search and filter states for the preview table
  const [previewSearch, setPreviewSearch] = useState("");
  const [previewFilter, setPreviewFilter] = useState("ALL");

  // Auto-clear message
  useEffect(() => {
    if (actionMessage) {
      const t = setTimeout(() => setActionMessage(null), 5000);
      return () => clearTimeout(t);
    }
  }, [actionMessage]);

  // Muat ulang jadwal ketika selectedDate berubah
  useEffect(() => {
    fetchSchedulesForDate(selectedDate);
    fetchPreviewForDate(selectedDate);
    setSelectedTimelineDate(selectedDate);
  }, [selectedDate]);

  // Helper untuk menambah hari pada string YYYY-MM-DD
  const addDays = (dateStr: string, days: number): string => {
    const date = new Date(dateStr);
    date.setDate(date.getDate() + days);
    return date.toISOString().split("T")[0];
  };

  const fetchSchedulesForDate = async (date: string) => {
    const endDate = addDays(date, 6);
    const res = await getSchedulesAction({ startDate: date, endDate: endDate });
    if (res.success && res.data) {
      setSchedulesList(res.data);
    }
  };

  const fetchPreviewForDate = async (date: string) => {
    const res = await previewScoringAction(date, params);
    if (res.success && res.data) {
      setScoringPreview(res.data);
    }
  };

  const handleGenerateToday = async () => {
    setIsLoading(true);
    setActionMessage(null);
    
    const res = await generateAndSaveScheduleAction("today", selectedDate);
    setIsLoading(false);

    if (res.success) {
      setActionMessage({ type: "success", text: res.message });
      await fetchSchedulesForDate(selectedDate);
      await fetchPreviewForDate(selectedDate);
    } else {
      setActionMessage({ type: "error", text: res.message });
    }
  };

  const handleGenerateWeek = async () => {
    if (
      !confirm(
        "Apakah Anda yakin ingin men-generate jadwal konten langsung untuk 7 hari ke depan dimulai dari tanggal terpilih? Jadwal lama pada tanggal-tanggal tersebut akan ditimpa."
      )
    ) {
      return;
    }

    setIsLoading(true);
    setActionMessage(null);

    const res = await generateAndSaveScheduleAction("week", selectedDate);
    setIsLoading(false);

    if (res.success) {
      setActionMessage({ type: "success", text: res.message });
      await fetchSchedulesForDate(selectedDate);
      await fetchPreviewForDate(selectedDate);
    } else {
      setActionMessage({ type: "error", text: res.message });
    }
  };

  const handleDeleteDate = async (dateToDelete: string) => {
    const formattedDate = new Date(dateToDelete).toLocaleDateString("id-ID", {
      weekday: "long",
      day: "numeric",
      month: "short",
    });

    if (!confirm(`Apakah Anda yakin ingin menghapus seluruh jadwal konten pada hari ${formattedDate}?`)) {
      return;
    }

    setIsLoading(true);
    const res = await deleteScheduleAction(dateToDelete);
    setIsLoading(false);

    if (res.success) {
      setActionMessage({ type: "success", text: res.message });
      await fetchSchedulesForDate(selectedDate);
    } else {
      setActionMessage({ type: "error", text: res.message });
    }
  };

  const handleDeleteWeek = async () => {
    const endDate = addDays(selectedDate, 6);
    const formattedStart = new Date(selectedDate).toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
    const formattedEnd = new Date(endDate).toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });

    if (
      !confirm(
        `Apakah Anda yakin ingin menghapus seluruh jadwal konten selama 7 hari dari tanggal ${formattedStart} sampai ${formattedEnd}?`
      )
    ) {
      return;
    }

    setIsLoading(true);
    setActionMessage(null);
    const res = await deleteScheduleRangeAction(selectedDate, endDate);
    setIsLoading(false);

    if (res.success) {
      setActionMessage({ type: "success", text: res.message });
      await fetchSchedulesForDate(selectedDate);
      await fetchPreviewForDate(selectedDate);
    } else {
      setActionMessage({ type: "error", text: res.message });
    }
  };

  const handleDeleteAll = async () => {
    if (
      !confirm(
        "Apakah Anda yakin ingin menghapus SELURUH jadwal konten yang tersimpan dalam sistem? Tindakan ini bersifat permanen."
      )
    ) {
      return;
    }

    setIsLoading(true);
    setActionMessage(null);
    const res = await clearAllSchedulesAction();
    setIsLoading(false);

    if (res.success) {
      setActionMessage({ type: "success", text: res.message });
      await fetchSchedulesForDate(selectedDate);
      await fetchPreviewForDate(selectedDate);
    } else {
      setActionMessage({ type: "error", text: res.message });
    }
  };

  const handleParamsSaved = (newParams: Record<string, number>) => {
    setParams(newParams);
    fetchPreviewForDate(selectedDate);
  };

  // Navigasi cepat dari kartu jadwal ke tab analisis skor
  const handleViewScoring = (productId: string) => {
    const slot = schedulesList.find((s) => s.product_id === productId);
    const productName = slot ? slot.product_name : "";
    setPreviewSearch(productName);
    setPreviewFilter("ALL");
    setActiveTab("preview");
    
    // Scroll smoothly to preview table wrapper
    setTimeout(() => {
      const el = document.getElementById("preview-table-container");
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 100);
  };

  // Kumpulkan ID Produk yang masuk jadwal untuk highlight di tabel skor
  const scheduledProductIds = new Set<string>(
    schedulesList.map((s) => s.product_id).filter(Boolean)
  );

  // Mengelompokkan data jadwal berdasarkan tanggal (7 hari ke depan)
  const groupedSchedules = new Map<string, any[]>();
  for (let i = 0; i < 7; i++) {
    const dStr = addDays(selectedDate, i);
    groupedSchedules.set(dStr, []);
  }

  schedulesList.forEach((item) => {
    const dStr = item.schedule_date;
    if (groupedSchedules.has(dStr)) {
      groupedSchedules.get(dStr)!.push(item);
    }
  });

  // Kalkulasi statistik mingguan untuk Summary Dashboard
  const totalSlotsScheduled = schedulesList.length;
  const uniqueProductsCount = new Set(schedulesList.map(s => s.product_id).filter(Boolean)).size;
  const collabCount = schedulesList.filter(s => s.slot_type === "collaboration").length;
  const hotCount = schedulesList.filter(s => s.slot_type === "hot_product").length;
  const fairnessCount = schedulesList.filter(s => s.slot_type === "fairness").length;
  const rankedCount = schedulesList.filter(s => s.slot_type === "ranked").length;

  return (
    <div className="space-y-6">
      {/* Navigation tabs */}
      <div className="flex border-b border-border-light text-xs font-semibold">
        <button
          onClick={() => setActiveTab("schedules")}
          className={`flex items-center gap-2 px-5 py-3 border-b-2 transition-all -mb-px cursor-pointer ${
            activeTab === "schedules"
              ? "border-accent text-accent font-bold"
              : "border-transparent text-text-placeholder hover:text-text-main"
          }`}
        >
          <CalendarDays className="w-4 h-4" />
          <span>Jadwal Harian</span>
        </button>

        <button
          onClick={() => setActiveTab("preview")}
          className={`flex items-center gap-2 px-5 py-3 border-b-2 transition-all -mb-px cursor-pointer ${
            activeTab === "preview"
              ? "border-accent text-accent font-bold"
              : "border-transparent text-text-placeholder hover:text-text-main"
          }`}
        >
          <Sparkles className="w-4 h-4" />
          <span>Preview Skor Produk</span>
        </button>

        <button
          onClick={() => setActiveTab("params")}
          className={`flex items-center gap-2 px-5 py-3 border-b-2 transition-all -mb-px cursor-pointer ${
            activeTab === "params"
              ? "border-accent text-accent font-bold"
              : "border-transparent text-text-placeholder hover:text-text-main"
          }`}
        >
          <Sliders className="w-4 h-4" />
          <span>Tuning Algoritma</span>
        </button>
      </div>

      {/* Floating Status Message */}
      {actionMessage && (
        <div
          className={`p-3.5 rounded-xl text-xs font-bold border max-w-2xl mx-auto shadow-xs text-center transition-all animate-in fade-in duration-300 ${
            actionMessage.type === "success"
              ? "bg-emerald-50 text-emerald-700 border-emerald-250/60"
              : "bg-red-50 text-red-700 border-red-250/60"
          }`}
        >
          {actionMessage.text}
        </div>
      )}

      {/* TABS CONTENT */}

      {/* Tab 1: Schedules */}
      {activeTab === "schedules" && (
        <div className="space-y-6 animate-in fade-in duration-200">
          
          {/* Weekly Summary Dashboard */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white border border-border-light p-4 rounded-xl shadow-2xs">
              <span className="text-[10px] font-extrabold uppercase text-text-placeholder tracking-wider flex items-center gap-1">
                <Video className="w-3.5 h-3.5 text-accent" />
                <span>Total Video Terjadwal</span>
              </span>
              <div className="text-xl sm:text-2xl font-black text-text-main mt-1.5 flex items-baseline gap-1">
                {totalSlotsScheduled}
                <span className="text-xs font-bold text-text-muted">slot</span>
              </div>
              <p className="text-[10px] text-text-placeholder mt-1.5 font-medium">Minggu aktif: 7 hari berjalan</p>
            </div>

            <div className="bg-white border border-border-light p-4 rounded-xl shadow-2xs">
              <span className="text-[10px] font-extrabold uppercase text-text-placeholder tracking-wider flex items-center gap-1">
                <ShoppingBag className="w-3.5 h-3.5 text-indigo-500" />
                <span>Keberagaman Produk</span>
              </span>
              <div className="text-xl sm:text-2xl font-black text-text-main mt-1.5 flex items-baseline gap-1">
                {uniqueProductsCount}
                <span className="text-xs font-bold text-text-muted">produk</span>
              </div>
              <p className="text-[10px] text-text-placeholder mt-1.5 font-medium">Batas maksimal {params.MAX_SLOT_PER_PRODUK || 2} slot/produk/hari</p>
            </div>

            <div className="bg-white border border-border-light p-4 rounded-xl shadow-2xs">
              <span className="text-[10px] font-extrabold uppercase text-text-placeholder tracking-wider flex items-center gap-1">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
                <span>Distribusi Slot</span>
              </span>
              <div className="grid grid-cols-4 gap-1 mt-2 text-[9px] font-extrabold">
                <div className="flex flex-col bg-rose-50 text-rose-700 px-1.5 py-1 rounded border border-rose-100 items-center justify-center">
                  <span>Collab</span>
                  <span className="text-xs mt-0.5">{collabCount}</span>
                </div>
                <div className="flex flex-col bg-orange-50 text-orange-700 px-1.5 py-1 rounded border border-orange-100 items-center justify-center">
                  <span>🔥 Win</span>
                  <span className="text-xs mt-0.5">{hotCount}</span>
                </div>
                <div className="flex flex-col bg-amber-50 text-amber-700 px-1.5 py-1 rounded border border-amber-100 items-center justify-center">
                  <span>Fair</span>
                  <span className="text-xs mt-0.5">{fairnessCount}</span>
                </div>
                <div className="flex flex-col bg-indigo-50 text-indigo-700 px-1.5 py-1 rounded border border-indigo-100 items-center justify-center">
                  <span>Rank</span>
                  <span className="text-xs mt-0.5">{rankedCount}</span>
                </div>
              </div>
            </div>

            <div className="bg-white border border-border-light p-4 rounded-xl shadow-2xs">
              <span className="text-[10px] font-extrabold uppercase text-text-placeholder tracking-wider flex items-center gap-1">
                <CalendarRange className="w-3.5 h-3.5 text-rose-500" />
                <span>Navigasi Rentang Minggu</span>
              </span>
              <div className="flex items-center gap-2 mt-2">
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="bg-bg border border-border-light rounded-lg px-2.5 py-1.5 text-xs font-mono text-text-main font-semibold focus:outline-none focus:border-accent w-full"
                />
              </div>
              <p className="text-[9px] text-text-placeholder mt-1 font-medium">Ubah tanggal awal batch jadwal</p>
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white border border-border-light p-4 rounded-xl shadow-2xs">
            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <button
                onClick={handleGenerateToday}
                disabled={isLoading}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-accent text-white hover:bg-accent-hover text-xs font-bold shadow-md cursor-pointer transition disabled:opacity-50"
              >
                <Sparkles className="w-4 h-4" />
                <span>Generate Hari Ini</span>
              </button>

              <button
                onClick={handleGenerateWeek}
                disabled={isLoading}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 text-xs font-bold shadow-md cursor-pointer transition disabled:opacity-50"
              >
                <CalendarDays className="w-4 h-4" />
                <span>Generate 7 Hari</span>
              </button>

              <button
                onClick={handleDeleteWeek}
                disabled={isLoading}
                className="flex items-center gap-1.5 px-3 py-2.5 rounded-lg border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 text-xs font-bold transition shadow-2xs cursor-pointer disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Hapus 7 Hari</span>
              </button>

              <button
                onClick={handleDeleteAll}
                disabled={isLoading}
                className="flex items-center gap-1.5 px-3 py-2.5 rounded-lg border border-border-light text-text-placeholder hover:text-red-600 hover:bg-red-50 text-xs font-bold transition shadow-2xs cursor-pointer disabled:opacity-50"
                title="Kosongkan seluruh jadwal di database"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Reset Semua</span>
              </button>
            </div>

            {/* View Mode Toggle */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200 shadow-2xs">
              <button
                onClick={() => setViewMode("timeline")}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-bold transition cursor-pointer ${
                  viewMode === "timeline"
                    ? "bg-white text-text-main shadow-2xs"
                    : "text-text-placeholder hover:text-text-main"
                }`}
              >
                <ListFilter className="w-3.5 h-3.5" />
                <span>Fokus Harian</span>
              </button>
              <button
                onClick={() => setViewMode("grid")}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-bold transition cursor-pointer ${
                  viewMode === "grid"
                    ? "bg-white text-text-main shadow-2xs"
                    : "text-text-placeholder hover:text-text-main"
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>Grid Seminggu</span>
              </button>
            </div>
          </div>

          {/* VIEW MODE 1: TIMELINE (DAILY FOCUS) */}
          {viewMode === "timeline" && (
            <div className="space-y-4">
              {/* Date Selector Tabs (7 Days) */}
              <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
                {Array.from({ length: 7 }).map((_, i) => {
                  const dateStr = addDays(selectedDate, i);
                  const dateObj = new Date(dateStr);
                  const dayName = dateObj.toLocaleDateString("id-ID", { weekday: "short" });
                  const dayNum = dateObj.getDate();
                  const monthName = dateObj.toLocaleDateString("id-ID", { month: "short" });
                  const isSelected = selectedTimelineDate === dateStr;
                  const daySlotsCount = schedulesList.filter((s) => s.schedule_date === dateStr).length;

                  return (
                    <button
                      key={dateStr}
                      onClick={() => setSelectedTimelineDate(dateStr)}
                      className={`flex flex-col items-center min-w-[90px] px-3 py-2.5 rounded-xl border transition-all cursor-pointer ${
                        isSelected
                          ? "bg-accent text-white border-accent shadow-md scale-[1.02]"
                          : "bg-white border-border-light text-text-main hover:border-accent/40 hover:bg-slate-50"
                      }`}
                    >
                      <span className={`text-[9px] font-mono uppercase tracking-wider ${isSelected ? "text-white/80" : "text-text-placeholder"}`}>
                        {dayName}
                      </span>
                      <span className="text-base font-black font-mono my-0.5">{dayNum}</span>
                      <div className="flex items-center gap-1 mt-0.5">
                        <span className={`text-[9px] font-bold ${isSelected ? "text-white/90" : "text-text-muted"}`}>
                          {monthName}
                        </span>
                        {daySlotsCount > 0 && (
                          <span
                            className={`px-1 rounded-full text-[8px] font-black ${
                              isSelected ? "bg-white/20 text-white" : "bg-accent/10 text-accent"
                            }`}
                          >
                            {daySlotsCount}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Slots Container for Selected Timeline Date */}
              <div className="bg-white border border-border-light rounded-xl p-5 shadow-2xs space-y-4">
                <div className="flex items-center justify-between border-b border-border-light pb-4">
                  <div>
                    <h3 className="text-sm font-black text-text-main flex items-center gap-2">
                      <span>
                        Slot Konten Hari{" "}
                        {new Date(selectedTimelineDate).toLocaleDateString("id-ID", {
                          weekday: "long",
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        })}
                      </span>
                    </h3>
                    <p className="text-[11px] text-text-placeholder mt-0.5 font-medium">
                      Rekomendasi 7 slot harian terbaik hasil scoring algoritma
                    </p>
                  </div>

                  {schedulesList.filter((s) => s.schedule_date === selectedTimelineDate).length > 0 && (
                    <button
                      onClick={() => handleDeleteDate(selectedTimelineDate)}
                      disabled={isLoading}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 text-xs font-bold transition shadow-2xs cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Hapus Hari Ini</span>
                    </button>
                  )}
                </div>

                {/* Slot Cards List */}
                {(() => {
                  const dailySlots = schedulesList
                    .filter((s) => s.schedule_date === selectedTimelineDate)
                    .sort((a, b) => a.slot_number - b.slot_number);

                  if (dailySlots.length === 0) {
                    return (
                      <div className="py-12 text-center space-y-3 bg-slate-50/50 border border-dashed border-border-light rounded-xl">
                        <Calendar className="w-8 h-8 text-text-placeholder mx-auto" />
                        <div>
                          <h4 className="text-xs font-bold text-text-main">Belum Ada Jadwal Tersimpan</h4>
                          <p className="text-[11px] text-text-placeholder mt-1 font-medium">
                            Klik tombol "Generate Hari Ini" atau "Generate 7 Hari" untuk membuat alokasi slot harian.
                          </p>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div className="space-y-3">
                      {dailySlots.map((slot) => (
                        <ScheduleCard
                          key={slot.id}
                          productId={slot.product_id}
                          slotNumber={slot.slot_number}
                          productName={slot.product_name}
                          slotType={slot.slot_type}
                          pool={slot.pool}
                          score={slot.score}
                          onViewScoring={handleViewScoring}
                        />
                      ))}
                    </div>
                  );
                })()}
              </div>
            </div>
          )}

          {/* VIEW MODE 2: GRID SEMINGGU */}
          {viewMode === "grid" && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
                {Array.from({ length: 7 }).map((_, i) => {
                  const dateStr = addDays(selectedDate, i);
                  const dateObj = new Date(dateStr);
                  const dayName = dateObj.toLocaleDateString("id-ID", { weekday: "short" });
                  const dayNum = dateObj.getDate();
                  const monthName = dateObj.toLocaleDateString("id-ID", { month: "short" });

                  const slots = schedulesList.filter((s) => s.schedule_date === dateStr);

                  return (
                    <div
                      key={dateStr}
                      className="bg-white border border-border-light rounded-xl p-3 shadow-2xs flex flex-col justify-between"
                    >
                      {/* Day Header */}
                      <div className="flex items-center justify-between border-b border-border-light pb-2 mb-2 font-mono">
                        <div>
                          <div className="text-[9px] text-text-placeholder uppercase font-extrabold">{dayName}</div>
                          <div className="text-sm font-black text-text-main">
                            {dayNum} <span className="text-[10px] text-text-muted font-bold">{monthName}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] font-extrabold text-accent bg-accent/10 px-1.5 py-0.5 rounded">
                            {slots.length} video
                          </span>
                          {slots.length > 0 && (
                            <button
                              onClick={() => handleDeleteDate(dateStr)}
                              disabled={isLoading}
                              title="Hapus Jadwal Hari Ini"
                              className="text-red-400 hover:text-red-600 transition"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Slots List */}
                      <div className="space-y-2">
                        {slots
                          .sort((a, b) => a.slot_number - b.slot_number)
                          .map((slot) => {
                            let badgeClass = "bg-indigo-50 text-indigo-700 border border-indigo-200/80 shadow-2xs";
                            if (slot.slot_type === "collaboration") {
                              badgeClass = "bg-rose-50 text-rose-700 border border-rose-200/80 shadow-2xs";
                            } else if (slot.slot_type === "hot_product") {
                              badgeClass = "bg-orange-50 text-orange-700 border border-orange-200/80 shadow-2xs";
                            } else if (slot.slot_type === "fairness") {
                              badgeClass = "bg-amber-50 text-amber-700 border border-amber-200/80 shadow-2xs";
                            }
                            return (
                              <div
                                key={slot.id}
                                className="p-2 rounded bg-slate-50 border border-slate-100 text-[10px] cursor-pointer hover:border-accent/40"
                                onClick={() => {
                                  setSelectedTimelineDate(dateStr);
                                  setViewMode("timeline");
                                }}
                              >
                                <div className="flex justify-between items-center gap-1 font-mono">
                                  <span className="font-extrabold text-accent">#{slot.slot_number}</span>
                                  <span className={`text-[8px] font-black uppercase px-1 py-0.5 rounded tracking-wide ${badgeClass}`}>
                                    {slot.slot_type === "collaboration"
                                      ? "Collab"
                                      : slot.slot_type === "hot_product"
                                      ? "🔥 Win"
                                      : slot.slot_type === "fairness"
                                      ? "Fair"
                                      : "Rank"}
                                  </span>
                                </div>
                                <div className="font-bold text-text-main line-clamp-1">{slot.product_name}</div>
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Preview Scoring */}
      {activeTab === "preview" && (
        <div className="space-y-4 animate-in fade-in duration-200" id="preview-table-container">
          <div className="flex justify-between items-center px-1">
            <div>
              <h2 className="text-sm font-extrabold text-text-main">Kalkulator Skor & Analisis Produk</h2>
              <p className="text-[11px] text-text-placeholder mt-0.5 font-medium">
                Preview seluruh produk yang layak beserta rincian rumus skor untuk tanggal referensi{" "}
                <span className="font-mono text-accent font-bold">{selectedDate}</span>.
              </p>
            </div>
            <button
              onClick={() => fetchPreviewForDate(selectedDate)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border-light hover:bg-slate-50 text-xs font-bold text-text-muted hover:text-text-main transition shadow-2xs cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Refresh Skor</span>
            </button>
          </div>

          {scoringPreview ? (
            <ScoringPreviewTable
              scoredProducts={(() => {
                const list = (scoringPreview.slots || [])
                  .map((s: any) => ({
                    product_id: s.product_id,
                    product_name: s.product_name,
                    pool: s.pool,
                    score: s.score || 0,
                    score_breakdown: s.score_breakdown || {},
                    aggregate: s.aggregate || {},
                  })).concat(
                    (scoringPreview.excluded || [])
                      .filter((ex: any) => ex.reason === "no_slot" || ex.reason === "watchlist")
                      .map((ex: any) => ({
                        product_id: ex.product_id,
                        product_name: ex.product_name,
                        pool: ex.pool,
                        score: ex.score || 0,
                        score_breakdown: ex.score_breakdown || {},
                        aggregate: ex.aggregate || {},
                      }))
                  );
                const seen = new Set();
                return list.filter((el: any) => {
                  const dup = seen.has(el.product_id);
                  seen.add(el.product_id);
                  return !dup;
                });
              })()}
              excludedProducts={(scoringPreview.excluded || []).filter(
                (ex: any) => ex.reason === "stok_habis" || ex.reason === "tidak_aktif"
              )}
              scheduledProductIds={scheduledProductIds}
              search={previewSearch}
              setSearch={setPreviewSearch}
              filterPool={previewFilter}
              setFilterPool={setPreviewFilter}
            />
          ) : (
            <div className="text-center py-12 bg-white border border-border-light rounded-xl">
              <RefreshCw className="w-6 h-6 text-accent animate-spin mx-auto mb-2" />
              <span className="text-xs text-text-placeholder font-medium">Memuat data kalkulasi skoring...</span>
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Tuning Parameters */}
      {activeTab === "params" && (
        <div className="animate-in fade-in duration-200">
          <ParamsEditor initialParams={params} onParamsSaved={handleParamsSaved} />
        </div>
      )}
    </div>
  );
}
