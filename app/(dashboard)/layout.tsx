// /*
// Tujuan: Menyediakan layout utama server-side untuk halaman terproteksi, mengamankan rute via Mock Auth, dan menyisipkan Sidebar.
// Caller: Seluruh rute di dalam grup (dashboard)
// Dependensi: next/navigation, lib/auth.ts, components/layout/Sidebar.tsx
// Main Functions: DashboardLayout
// Side Effects: Mengecek sesi aktif ke Mock Auth, mengalihkan rute jika tidak valid.
// */

import { redirect } from "next/navigation";
import { getMockUser } from "@/lib/auth";
import Sidebar from "@/components/layout/Sidebar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getMockUser();

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
