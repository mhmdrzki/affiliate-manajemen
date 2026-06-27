"use client";

// /*
// Tujuan: Halaman login pengguna untuk masuk ke platform AffiliateOS menggunakan Supabase Auth.
// Caller: Route /login
// Dependensi: next/link, next/navigation, lib/supabase/client.ts
// Main Functions: LoginPage
// Side Effects: Berkomunikasi dengan Supabase Auth untuk sign-in, menyimpan sesi cookie, mengalihkan rute.
// */

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        setError(authError.message);
      } else {
        router.refresh();
        router.push("/");
      }
    } catch (err) {
      setError("Terjadi kesalahan sistem saat mencoba masuk.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-bg-card border border-border-light rounded-2xl p-8 shadow-[0_10px_25px_-5px_rgba(0,0,0,0.02),0_10px_10px_-5px_rgba(0,0,0,0.01)]">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-accent rounded-xl flex items-center justify-center font-bold text-white text-lg shadow-[0_4px_12px_rgba(99,102,241,0.3)] mx-auto mb-3">
            A
          </div>
          <h2 className="font-extrabold text-xl tracking-tight text-text-main">
            Selamat Datang Kembali
          </h2>
          <p className="text-xs text-text-placeholder mt-1">
            Masuk ke akun AffiliateOS Anda untuk mengelola kinerja komisi
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-4 p-3 bg-danger-bg border border-danger-border text-danger text-xs rounded-lg font-medium">
            ⚠️ {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-[11px] font-bold text-text-muted mb-1 uppercase tracking-wider">
              Alamat Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nama@email.com"
              className="w-full bg-bg border border-border-active focus:border-accent focus:ring-3 focus:ring-accent/15 rounded-lg px-3 py-2 text-xs text-text-main placeholder-text-placeholder outline-none transition-all duration-150"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-text-muted mb-1 uppercase tracking-wider">
              Kata Sandi
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-bg border border-border-active focus:border-accent focus:ring-3 focus:ring-accent/15 rounded-lg px-3 py-2 text-xs text-text-main placeholder-text-placeholder outline-none transition-all duration-150"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center py-2.5 px-4 bg-accent hover:bg-accent-hover text-white rounded-lg text-xs font-bold transition-all duration-150 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_2px_4px_rgba(99,102,241,0.15)]"
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              "Masuk Sekarang"
            )}
          </button>
        </form>

        {/* Footer */}
        <div className="text-center mt-6 pt-6 border-t border-border-light">
          <p className="text-xs text-text-placeholder">
            Belum punya akun?{" "}
            <Link
              href="/register"
              className="font-bold text-accent hover:underline"
            >
              Daftar Gratis
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
