// /*
// Tujuan: Menampilkan halaman generator jadwal konten cerdas harian/mingguan dan form penyesuaian parameter scoring.
// Caller: Rute navigasi /schedule
// Dependensi: React, app/actions/schedule.ts, components/schedule/ScheduleGeneratorClient.tsx
// Main Functions: SchedulePage
// Side Effects: Membaca database untuk inisialisasi data halaman.
// */

import React from "react";
import { redirect } from "next/navigation";
import { getMockUser } from "@/lib/auth";
import {
  getScoringParamsAction,
  getSchedulesAction,
  previewScoringAction,
} from "@/app/actions/schedule";
import ScheduleGeneratorClient from "@/components/schedule/ScheduleGeneratorClient";
import { CalendarDays } from "lucide-react";

export const metadata = {
  title: "Jadwal Konten — AffiliateOS",
  description: "Generate jadwal posting konten affiliate TikTok secara otomatis dengan algoritma skoring proporsional.",
};

export default async function SchedulePage() {
  const user = await getMockUser();
  if (!user) {
    redirect("/login");
  }

  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];
  const endOfWeek = new Date(today.getTime() + 6 * 24 * 60 * 60 * 1000);
  const endOfWeekStr = endOfWeek.toISOString().split("T")[0];

  // Fetch initial data secara paralel
  const [paramsRes, schedulesRes, previewRes] = await Promise.all([
    getScoringParamsAction(),
    getSchedulesAction({ startDate: todayStr, endDate: endOfWeekStr }),
    previewScoringAction(todayStr),
  ]);

  const initialParams = paramsRes.success && paramsRes.data ? paramsRes.data : {};
  const initialSchedules = schedulesRes.success && schedulesRes.data ? schedulesRes.data : [];
  const initialPreview = previewRes.success && previewRes.data ? previewRes.data : null;

  return (
    <main className="flex-1 p-6 space-y-6">
      {/* Page Header */}
      <div className="flex justify-between items-center pb-5 border-b border-border">
        <div>
          <h1 className="text-xl font-bold text-sb-text flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-accent" />
            <span>Generator Jadwal Konten</span>
          </h1>
          <p className="text-xs text-sb-text-muted mt-1.5">
            Kelola pembagian slot video TikTok Shop berdasarkan prioritas kolaborasi dan ranking scoring produk.
          </p>
        </div>
      </div>

      {/* Interactive client scheduler workspace */}
      <ScheduleGeneratorClient
        initialParams={initialParams}
        initialSchedules={initialSchedules}
        initialPreview={initialPreview}
      />
    </main>
  );
}
