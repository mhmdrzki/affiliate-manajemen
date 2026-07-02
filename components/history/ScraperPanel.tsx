"use client";

// /*
// Tujuan: Panel input interaktif klien-side untuk memicu scraper TikTok via API route `/api/scrape`.
// Caller: app/(dashboard)/history/page.tsx
// Dependensi: next/navigation (useRouter), lucide-react
// Main Functions: ScraperPanel
// Side Effects: Mengirimkan request POST HTTP ke `/api/scrape`.
// */

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Play, Loader2, Sparkles, AlertCircle, CheckCircle } from "lucide-react";

export default function ScraperPanel() {
  const [username, setUsername] = useState("");
  const [days, setDays] = useState("3");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const router = useRouter();

  const handleScrape = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) {
      setStatus({ type: "error", message: "Username TikTok wajib diisi." });
      return;
    }

    setLoading(true);
    setStatus(null);

    try {
      const response = await fetch("/api/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: username.trim(),
          days: parseInt(days) || 1,
        }),
      });

      const resData = await response.json();

      if (!response.ok || !resData.success) {
        throw new Error(resData.message || "Gagal melakukan penarikan data.");
      }

      setStatus({
        type: "success",
        message: resData.message || "Scraping selesai dengan sukses!",
      });

      router.refresh();
    } catch (err: any) {
      console.error(err);
      setStatus({
        type: "error",
        message: err.message || "Koneksi terputus atau terjadi kesalahan server.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-card border border-border rounded-xl p-6 shadow-md relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-accent/5 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none" />

      <div className="flex items-center gap-2 mb-4">
        <div className="p-1.5 bg-accent/10 rounded-lg text-accent">
          <Sparkles className="w-5 h-5" />
        </div>
        <div>
          <h2 className="font-extrabold text-sm tracking-tight text-text-main">
            Live Scraper TikTok
          </h2>
          <p className="text-[10px] text-text-muted">
            Tarik langsung data performa video dari profil TikTok publik secara real-time
          </p>
        </div>
      </div>

      <form onSubmit={handleScrape} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
          {/* Input Username */}
          <div className="md:col-span-7">
            <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1.5">
              Username TikTok
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-xs text-text-muted font-bold">@</span>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value.replace(/@/g, ""))}
                placeholder="dutaparfumlokal"
                disabled={loading}
                className="w-full bg-bg border border-border focus:border-accent text-xs rounded-lg py-2 pl-7 pr-3 text-text-main placeholder-text-muted/50 outline-none transition-all"
              />
            </div>
          </div>

          {/* Input Days */}
          <div className="md:col-span-5">
            <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1.5">
              Rentang Waktu
            </label>
            <select
              value={days}
              onChange={(e) => setDays(e.target.value)}
              disabled={loading}
              className="w-full bg-bg border border-border focus:border-accent text-xs rounded-lg py-2 px-3 text-text-main outline-none transition-all cursor-pointer"
            >
              <option value="1">1 Hari Terakhir</option>
              <option value="3">3 Hari Terakhir</option>
              <option value="7">7 Hari Terakhir</option>
              <option value="14">14 Hari Terakhir</option>
              <option value="30">30 Hari Terakhir</option>
            </select>
          </div>
        </div>

        {/* Submit button */}
        <button
          type="submit"
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-accent hover:bg-accent-hover disabled:bg-accent/50 text-white text-xs font-extrabold rounded-lg shadow-[0_3px_10px_rgba(99,102,241,0.2)] transition-all cursor-pointer"
        >
          {loading ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Menarik Data TikTok (Mungkin butuh beberapa menit)...</span>
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Mulai Scrape Sekarang</span>
            </>
          )}
        </button>
      </form>

      {/* Status banner */}
      {status && (
        <div
          className={`mt-4 p-3 rounded-lg border text-xs flex gap-2.5 items-start ${
            status.type === "success"
              ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
              : "bg-red-500/10 border-red-500/20 text-red-400"
          }`}
        >
          {status.type === "success" ? (
            <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          )}
          <span className="font-semibold leading-relaxed">{status.message}</span>
        </div>
      )}
    </div>
  );
}
