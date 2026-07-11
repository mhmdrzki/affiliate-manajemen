// /*
// Tujuan: Komponen Client UI untuk formulir pembaruan pengaturan akun (Display Name, Gemini API Key, dan default Scoring Mode).
// Caller: app/(dashboard)/settings/page.tsx
// Dependensi: app/actions/settings.ts, types/index.ts, lucide-react, next/navigation (useRouter)
// Main Functions: SettingsForm
// Side Effects: Memanggil updateProfileAction server action, melakukan refresh router saat sukses.
// */

"use client";

import React, { useState } from "react";
import { Profile } from "@/types";
import { updateProfileAction } from "@/app/actions/settings";
import { useRouter } from "next/navigation";
import {
  Settings,
  Eye,
  EyeOff,
  Loader2,
  CheckCircle,
  AlertTriangle,
  Key,
} from "lucide-react";

interface SettingsFormProps {
  profile: Profile;
}

export default function SettingsForm({ profile }: SettingsFormProps) {
  const [displayName, setDisplayName] = useState(profile.display_name || "");
  const [geminiApiKey, setGeminiApiKey] = useState(
    profile.gemini_api_key_encrypted || ""
  );


  const [showApiKey, setShowApiKey] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setSuccessMsg(null);
    setErrorMsg(null);

    try {
      const res = await updateProfileAction({
        display_name: displayName,
        gemini_api_key_encrypted: geminiApiKey,
      });

      if (res.success) {
        setSuccessMsg(res.message);
        router.refresh();
      } else {
        setErrorMsg(res.message);
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Gagal memperbarui pengaturan.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl mx-auto w-full">
      <div className="bg-white border border-border-light rounded-xl p-6 shadow-sm space-y-6">
        <div className="flex items-center gap-2.5 pb-4 border-b border-border-light">
          <div className="w-8 h-8 bg-accent/10 border border-accent/25 text-accent rounded-lg flex items-center justify-center">
            <Settings className="w-4.5 h-4.5" />
          </div>
          <div>
            <h3 className="font-extrabold text-sm text-text-main tracking-tight">
              Profil & Parameter Aplikasi
            </h3>
            <p className="text-[10px] text-text-placeholder mt-0.5">
              Kelola kredensial akun Anda.
            </p>
          </div>
        </div>

        {/* Alert Notifications */}
        {successMsg && (
          <div className="p-3.5 bg-success-bg border border-success-border text-success text-xs rounded-lg font-bold flex items-center gap-2 animate-in fade-in duration-200">
            <CheckCircle className="w-4.5 h-4.5 flex-shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {errorMsg && (
          <div className="p-3.5 bg-danger-bg border border-danger-border text-danger text-xs rounded-lg font-bold flex items-center gap-2 animate-in fade-in duration-200">
            <AlertTriangle className="w-4.5 h-4.5 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Input: Nama Tampilan */}
        <div className="space-y-1.5">
          <label className="block text-[10px] font-bold text-text-placeholder uppercase tracking-wider">
            Nama Tampilan (Display Name)
          </label>
          <input
            type="text"
            required
            placeholder="Contoh: Bang Jie Creator"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="w-full text-xs px-3.5 py-2 bg-bg border border-border-light focus:border-accent rounded-lg focus:outline-none transition-colors"
          />
        </div>

        {/* Input: Gemini API Key */}
        <div className="space-y-1.5">
          <label className="block text-[10px] font-bold text-text-placeholder uppercase tracking-wider flex items-center justify-between">
            <span>Google Gemini API Key</span>
            <span className="text-[8px] font-semibold text-text-placeholder flex items-center gap-1 normal-case bg-bg-panel px-1.5 py-0.5 rounded border border-border-light">
              <Key className="w-2.5 h-2.5" /> Digunakan di menu AI Script Generator
            </span>
          </label>
          <div className="relative">
            <input
              type={showApiKey ? "text" : "password"}
              placeholder="Masukkan API Key Gemini Anda..."
              value={geminiApiKey}
              onChange={(e) => setGeminiApiKey(e.target.value)}
              className="w-full text-xs pl-3.5 pr-10 py-2 bg-bg border border-border-light focus:border-accent rounded-lg focus:outline-none transition-colors font-mono"
            />
            <button
              type="button"
              onClick={() => setShowApiKey(!showApiKey)}
              className="absolute right-3 top-2.5 text-text-placeholder hover:text-text-muted focus:outline-none cursor-pointer"
            >
              {showApiKey ? (
                <EyeOff className="w-4 h-4" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>



        {/* Submit Area */}
        <div className="pt-4 border-t border-border-light flex justify-end">
          <button
            type="submit"
            disabled={submitting}
            className="flex items-center gap-1.5 py-2.5 px-6 bg-accent hover:bg-accent-hover text-white rounded-lg text-xs font-bold transition-all duration-150 cursor-pointer disabled:opacity-50 shadow-[0_2px_8px_rgba(99,102,241,0.25)] focus:outline-none"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Menyimpan Pengaturan...</span>
              </>
            ) : (
              <span>Simpan Pengaturan</span>
            )}
          </button>
        </div>
      </div>
    </form>
  );
}
