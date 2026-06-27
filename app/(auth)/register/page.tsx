"use client";

// /*
// Tujuan: Halaman registrasi pengguna baru untuk membuat akun AffiliateOS menggunakan Supabase Auth.
// Caller: Route /register
// Dependensi: next/link, next/navigation, lib/supabase/client.ts
// Main Functions: RegisterPage
// Side Effects: Berkomunikasi dengan Supabase Auth untuk sign-up, membuat profile record secara otomatis via DB trigger, mengalihkan rute.
// */

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      const { error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            display_name: displayName,
          },
        },
      });

      if (authError) {
        setError(authError.message);
      } else {
        setSuccess("Pendaftaran berhasil! Akun Anda telah dibuat.");
        // Redirect ke dashboard setelah delay singkat agar user sempat membaca sukses info
        setTimeout(() => {
          router.refresh();
          router.push("/");
        }, 1500);
      }
    } catch (err) {
      setError("Terjadi kesalahan sistem saat mencoba mendaftar.");
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
            Buat Akun Baru
          </h2>
          <p className="text-xs text-text-placeholder mt-1">
            Mulailah mengoptimalkan performa penjualan afiliasi Anda secara gratis
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-4 p-3 bg-danger-bg border border-danger-border text-danger text-xs rounded-lg font-medium">
            ⚠️ {error}
          </div>
        )}

        {/* Success Alert */}
        {success && (
          <div className="mb-4 p-3 bg-success-bg border border-success-border text-success text-xs rounded-lg font-medium">
            ✓ {success}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleRegister} className="space-y-4">
          <div>
            <label className="block text-[11px] font-bold text-text-muted mb-1 uppercase tracking-wider">
              Nama Lengkap
            </label>
            <input
              type="text"
              required
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Budi Setiawan"
              className="w-full bg-bg border border-border-active focus:border-accent focus:ring-3 focus:ring-accent/15 rounded-lg px-3 py-2 text-xs text-text-main placeholder-text-placeholder outline-none transition-all duration-150"
            />
          </div>

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
              placeholder="Minimal 6 karakter"
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
              "Daftar Akun"
            )}
          </button>
        </form>

        {/* Footer */}
        <div className="text-center mt-6 pt-6 border-t border-border-light">
          <p className="text-xs text-text-placeholder">
            Sudah memiliki akun?{" "}
            <Link
              href="/login"
              className="font-bold text-accent hover:underline"
            >
              Masuk Disini
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
