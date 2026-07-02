// /*
// Tujuan: Halaman Server Component untuk mengelola rute impor data, mengambil riwayat impor dari SQLite lokal, dan merender Uploader serta Riwayat Impor.
// Caller: Route /import
// Dependensi: lib/db/index.ts, lib/supabase/server.ts, components/layout/Topbar.tsx, components/import/ImportUploader.tsx, components/import/ImportHistoryList.tsx
// Main Functions: ImportPage
// Side Effects: Mengambil riwayat import_logs dari SQLite lokal untuk user aktif.
// */

import React from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { import_logs } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import Topbar from "@/components/layout/Topbar";
import ImportUploader from "@/components/import/ImportUploader";
import ImportHistoryList from "@/components/import/ImportHistoryList";

export default async function ImportPage() {
  const supabase = await createClient();

  // 1. Verifikasi User
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // 2. Mengambil riwayat impor log dari database
  const logs = await db
    .select()
    .from(import_logs)
    .where(eq(import_logs.user_id, user.id))
    .orderBy(desc(import_logs.created_at));

  const typedLogs = logs || [];

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-bg">
      <Topbar title="Impor Data Analitik" />

      <div className="p-6 max-w-5xl mx-auto w-full">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Uploader Panel */}
          <div className="lg:col-span-5">
            <ImportUploader />
          </div>

          {/* History Panel */}
          <div className="lg:col-span-7">
            <ImportHistoryList logs={typedLogs} />
          </div>
        </div>
      </div>
    </div>
  );
}

