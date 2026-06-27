"use client";

// /*
// Tujuan: Menyediakan menu navigasi sidebar premium dengan deteksi rute aktif dan integrasi logout Supabase.
// Caller: app/(dashboard)/layout.tsx
// Dependensi: next/link, next/navigation, lucide-react, @supabase/ssr (createClient)
// Main Functions: Sidebar
// Side Effects: Berkomunikasi dengan Supabase Auth untuk logout, mengalihkan rute halaman.
// */

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  ShoppingBag,
  Calendar,
  FileText,
  Sparkles,
  Upload,
  Settings,
  Database,
  LogOut,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface SidebarProps {
  userEmail?: string | null;
}

export default function Sidebar({ userEmail }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  const menuItems = [
    { name: "Dashboard", href: "/", icon: LayoutDashboard },
    { name: "Master Produk", href: "/products", icon: ShoppingBag },
    { name: "Jadwal Konten", href: "/schedule", icon: Calendar },
    { name: "AI Script Generator", href: "/scripts", icon: Sparkles },
    { name: "Bank Template", href: "/templates", icon: FileText },
    { name: "Impor Data", href: "/import", icon: Upload },
    { name: "Migrasi Data", href: "/migrate", icon: Database },
    { name: "Pengaturan", href: "/settings", icon: Settings },
  ];

  const handleLogout = async () => {
    if (confirm("Apakah Anda yakin ingin keluar dari AffiliateOS?")) {
      await supabase.auth.signOut();
      router.refresh();
      router.push("/login");
    }
  };

  return (
    <aside className="w-64 bg-sb-bg border-r border-sb-border flex flex-col fixed inset-y-0 left-0 z-50 text-sb-text select-none">
      {/* Brand Header */}
      <div className="p-5 border-b border-sb-border flex items-center gap-3">
        <div className="w-8 h-8 bg-accent rounded-lg flex items-center justify-center font-bold text-white shadow-[0_2px_8px_rgba(99,102,241,0.4)]">
          A
        </div>
        <div>
          <div className="font-extrabold text-sm tracking-tight text-sb-text">
            Affiliate<em>OS</em>
          </div>
          <div className="text-[8px] text-sb-text-muted font-mono tracking-widest uppercase">
            v3.0 Full-Stack
          </div>
        </div>
      </div>

      {/* Navigations */}
      <nav className="flex-1 py-4 px-2 overflow-y-auto space-y-1">
        <div className="text-[9px] text-sb-text-muted font-mono tracking-wider uppercase px-3 mb-2">
          Menu Utama
        </div>
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-md text-xs font-semibold transition-all duration-150 ${
                isActive
                  ? "bg-accent text-white shadow-[0_3px_10px_rgba(99,102,241,0.3)]"
                  : "text-sb-text-muted hover:bg-sb-item-hover hover:text-sb-text"
              }`}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              <span>{item.name}</span>
            </Link>
          );
        })}
      </nav>

      {/* User Footer Profile */}
      <div className="p-4 border-t border-sb-border flex flex-col gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-full bg-accent/20 border border-accent/30 flex items-center justify-center font-bold text-accent text-xs flex-shrink-0">
            {userEmail ? userEmail.substring(0, 2).toUpperCase() : "U"}
          </div>
          <div className="min-w-0">
            <div className="text-xs font-bold text-sb-text truncate">
              {userEmail ? userEmail.split("@")[0] : "User"}
            </div>
            <div className="text-[10px] text-sb-text-muted truncate">
              {userEmail || "loading..."}
            </div>
          </div>
        </div>
        
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-red-600/10 hover:bg-red-600 text-red-500 hover:text-white border border-red-600/20 hover:border-red-600 rounded-md text-[11px] font-bold transition-all duration-150 cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Keluar</span>
        </button>
      </div>
    </aside>
  );
}
