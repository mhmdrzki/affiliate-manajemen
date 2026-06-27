// /*
// Tujuan: Menyediakan layout utama server-side untuk halaman terproteksi, mengamankan rute via Supabase Auth, dan menyisipkan Sidebar.
// Caller: Seluruh rute di dalam grup (dashboard)
// Dependensi: next/navigation, lib/supabase/server.ts, components/layout/Sidebar.tsx
// Main Functions: DashboardLayout
// Side Effects: Mengecek sesi aktif ke Supabase Auth, mengalihkan rute jika tidak valid.
// */

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Sidebar from "@/components/layout/Sidebar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  // Validasi sesi user secara server-side
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-screen bg-bg text-text-main">
      {/* Sidebar - Fix position di kiri */}
      <Sidebar userEmail={user.email} />

      {/* Main Content Area */}
      <main className="pl-64 flex-1 flex flex-col min-h-screen min-w-0">
        {children}
      </main>
    </div>
  );
}
