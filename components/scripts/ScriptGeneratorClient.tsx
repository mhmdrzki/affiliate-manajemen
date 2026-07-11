// /*
// Tujuan: Komponen Client UI untuk formulir konfigurasi generator naskah AI dan panel penampil 3 variasi naskah video TikTok.
// Caller: app/(dashboard)/scripts/page.tsx
// Dependensi: app/actions/products.ts, types/index.ts, lucide-react, next/navigation (useRouter, useSearchParams)
// Main Functions: ScriptGeneratorClient
// Side Effects: Mengirimkan HTTP POST request ke server proxy /api/ai, memicu Server Action saveProductDescVariantAction.
// */

"use client";

import React, { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Product } from "@/types";
import { saveProductDescVariantAction } from "@/app/actions/products";
import {
  Sparkles,
  RefreshCw,
  Copy,
  Check,
  Save,
  Loader2,
  AlertCircle,
  Video,
  Info,
} from "lucide-react";

interface ScriptGeneratorClientProps {
  products: Product[];
}

export default function ScriptGeneratorClient({
  products,
}: ScriptGeneratorClientProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Form States
  const [selectedProdIdx, setSelectedProdIdx] = useState("");
  const [nama, setNama] = useState("");
  const [desc, setDesc] = useState("");
  const [dur, setDur] = useState("30");
  const [style, setStyle] = useState("onetake");
  const [saveProdId, setSaveProdId] = useState("");

  const searchParams = useSearchParams();
  const prefillProductId = searchParams.get("product_id");

  // Result States
  const [variations, setVariations] = useState<
    { hook: string; isi: string; proof: string; cta: string }[] | null
  >(null);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [savingIdx, setSavingIdx] = useState<number | null>(null);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  const styleDesc: Record<string, string> = {
    onetake: "one take dengan kamera tetap dan background sudut ruangan yang natural",
    demo: "demo produk langsung dengan close-up detail produk",
    ootd: "lifestyle/OOTD dengan tampilan gaya busana/outfit",
    review: "review jujur, conversational, dan natural",
  };

  const handlePrefillChange = (idxStr: string) => {
    setSelectedProdIdx(idxStr);
    if (idxStr === "") {
      setNama("");
      setDesc("");
      setSaveProdId("");
      return;
    }

    const idx = parseInt(idxStr);
    const p = products[idx];
    if (!p) return;

    setNama(p.product_name.substring(0, 40));
    
    const infoParts = [];
    if (p.shop_name) infoParts.push(`Toko: ${p.shop_name}`);

    setDesc(infoParts.join(", "));
    setSaveProdId(p.product_id); // Default auto-select saving product
  };

  useEffect(() => {
    if (prefillProductId && products.length > 0) {
      const idx = products.findIndex((p) => p.product_id === prefillProductId);
      if (idx !== -1) {
        handlePrefillChange(String(idx));
      }
    }
  }, [prefillProductId, products]);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nama.trim()) {
      setError("Nama produk wajib diisi.");
      return;
    }

    setLoading(true);
    setError(null);
    setVariations(null);
    setSaveSuccessMsg(null);

    const prompt = `Kamu adalah asisten profesional untuk kreator/affiliator TikTok Shop Indonesia. Buat 3 variasi naskah video singkat yang natural dan persuasif untuk produk berikut:

Nama Produk: ${nama}
Keterangan Produk: ${desc || "Produk berkualitas tinggi dengan penawaran terbaik."}
Gaya Video: ${styleDesc[style] || styleDesc.onetake}
Target Durasi: ~${dur} detik

Format output HARUS berupa JSON array yang valid dengan struktur objek berikut (tulis dalam bentuk JSON bersih, jangan ada markdown code block atau formatting lain):
[
  {
    "hook": "Tulis 1 kalimat pembuka yang sangat memikat, membangkitkan rasa ingin tahu, tidak clickbait, dan natural.",
    "isi": "Tulis 2-3 kalimat deskripsi atau manfaat produk utama yang terdengar jujur, subjektif, dan seperti bercerita ke teman dekat.",
    "proof": "Tulis 1 kalimat bukti sosial (social proof) seperti jumlah terjual atau rating secara kasual tanpa terkesan berlebihan.",
    "cta": "Tulis 1 kalimat ajakan bertindak (Call to Action) ke keranjang kuning secara kasual dan tidak memaksa."
  }
]

Ketentuan PENTING:
- Gunakan bahasa Indonesia kasual percakapan (seperti 'gue/lo' atau gaya santai kekinian yang ramah).
- DILARANG menggunakan kata-kata klise berikut: "terbaik", "paling", "luar biasa", "sempurna", "wajib punya", "must-have", "satu-satunya".
- Jangan overclaim atau berlebihan. Klaim harus logis, realistis, dan believable.
- Buat sudut pandang (angle) promosi yang berbeda untuk masing-masing dari 3 variasi tersebut.`;

    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, maxTokens: 1200, temperature: 0.85 }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Gagal memproses naskah AI.");
      }

      // Parse JSON array hasil Gemini
      let parsedResult;
      try {
        parsedResult = JSON.parse(data.result);
      } catch (pErr) {
        // Jika respons tidak ber-JSON bersih, bersihkan string dan coba lagi
        const cleanedStr = data.result
          .replace(/^[^{\[]*/, "")
          .replace(/[^}\]]*$/, "");
        parsedResult = JSON.parse(cleanedStr);
      }

      if (Array.isArray(parsedResult) && parsedResult.length > 0) {
        setVariations(parsedResult);
      } else {
        throw new Error("Format hasil generator Gemini tidak sesuai.");
      }
    } catch (err: any) {
      setError(err.message || "Gagal menghubungi Gemini API. Pastikan API Key di Pengaturan sudah benar.");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (v: any, idx: number) => {
    const fullText = `[HOOK]\n${v.hook}\n\n[ISI]\n${v.isi}\n\n[PROOF]\n${v.proof}\n\n[CTA]\n${v.cta}`;
    navigator.clipboard.writeText(fullText);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  const handleSaveToMaster = async (isiText: string, idx: number) => {
    if (!saveProdId) {
      alert("Silakan pilih produk target pada kolom 'Simpan Hasil ke Master' terlebih dahulu.");
      return;
    }

    setSavingIdx(idx);
    setSaveSuccessMsg(null);

    try {
      const res = await saveProductDescVariantAction(saveProdId, isiText);
      if (res.success) {
        setSaveSuccessMsg(`Variasi ${idx + 1} berhasil disimpan ke master produk!`);
      } else {
        alert(res.message);
      }
    } catch (err: any) {
      alert(err.message || "Gagal menyimpan variasi ke master produk.");
    } finally {
      setSavingIdx(null);
    }
  };

  const varColors = [
    "border-accent hover:border-accent/80",
    "border-success-border hover:border-success",
    "border-special-border hover:border-special",
  ];
  
  const varTitleBg = [
    "bg-accent/10 text-accent",
    "bg-success-bg text-success",
    "bg-special-bg text-special",
  ];

  return (
    <div className="flex flex-col lg:flex-row gap-6 items-start w-full">
      {/* --- PANEL KIRI: FORM CONFIG --- */}
      <div className="w-full lg:w-80 bg-white border border-border-light rounded-xl p-5 shadow-sm space-y-4 shrink-0">
        <div className="flex items-center gap-2 pb-3 border-b border-border-light">
          <Sparkles className="w-4 h-4 text-accent" />
          <h3 className="text-xs font-extrabold text-text-main uppercase tracking-wider">
            Konfigurasi AI Naskah
          </h3>
        </div>

        <form onSubmit={handleGenerate} className="space-y-4">
          {/* Dropdown: Prefill dari Master Produk */}
          <div className="space-y-1.5">
            <label className="block text-[10px] font-bold text-text-placeholder uppercase tracking-wider">
              Prefill dari Produk
            </label>
            <select
              value={selectedProdIdx}
              onChange={(e) => handlePrefillChange(e.target.value)}
              className="w-full text-xs px-2.5 py-2 bg-bg border border-border-light focus:border-accent rounded-lg focus:outline-none cursor-pointer transition-colors"
            >
              <option value="">— Isi Manual —</option>
              {products.map((p, i) => (
                <option key={p.product_id} value={i}>
                  {p.product_name.substring(0, 30)}
                </option>
              ))}
            </select>
          </div>

          {/* Input: Nama Produk */}
          <div className="space-y-1.5">
            <label className="block text-[10px] font-bold text-text-placeholder uppercase tracking-wider">
              Nama Produk <span className="text-danger">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="Contoh: Jogger Pants Loose"
              value={nama}
              onChange={(e) => setNama(e.target.value)}
              className="w-full text-xs px-3 py-2 bg-bg border border-border-light focus:border-accent rounded-lg focus:outline-none transition-colors"
            />
          </div>

          {/* Input: Detail Keterangan */}
          <div className="space-y-1.5">
            <label className="block text-[10px] font-bold text-text-placeholder uppercase tracking-wider">
              Detail Keterangan & Keunggulan
            </label>
            <textarea
              rows={3}
              placeholder="Bahan fleece tebal, adem, cocok untuk santai atau olahraga..."
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              className="w-full text-xs px-3 py-2 bg-bg border border-border-light focus:border-accent rounded-lg focus:outline-none transition-colors resize-none leading-relaxed"
            />
          </div>

          {/* Dropdown: Gaya Video */}
          <div className="space-y-1.5">
            <label className="block text-[10px] font-bold text-text-placeholder uppercase tracking-wider">
              Gaya Video (TikTok Angle)
            </label>
            <select
              value={style}
              onChange={(e) => setStyle(e.target.value)}
              className="w-full text-xs px-2.5 py-2 bg-bg border border-border-light focus:border-accent rounded-lg focus:outline-none cursor-pointer transition-colors"
            >
              <option value="onetake">One Take (Natural Room)</option>
              <option value="demo">Demo Produk (Close-up Detail)</option>
              <option value="ootd">Outfit & Gaya (OOTD Lifestyle)</option>
              <option value="review">Review Jujur & Santai</option>
            </select>
          </div>

          {/* Dropdown: Durasi Video */}
          <div className="space-y-1.5">
            <label className="block text-[10px] font-bold text-text-placeholder uppercase tracking-wider">
              Target Durasi Video
            </label>
            <select
              value={dur}
              onChange={(e) => setDur(e.target.value)}
              className="w-full text-xs px-2.5 py-2 bg-bg border border-border-light focus:border-accent rounded-lg focus:outline-none cursor-pointer transition-colors"
            >
              <option value="15">~15 Detik (Singkat & Padat)</option>
              <option value="30">~30 Detik (Ideal & Proporsional)</option>
              <option value="60">~60 Detik (Informasi Lengkap)</option>
            </select>
          </div>

          <div className="h-px bg-border-light my-2" />

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-accent hover:bg-accent-hover text-white rounded-lg text-xs font-bold transition-all duration-150 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_2px_8px_rgba(99,102,241,0.25)] focus:outline-none"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>AI sedang berpikir...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Generate 3 Variasi (AI)</span>
              </>
            )}
          </button>
        </form>
      </div>

      {/* --- PANEL KANAN: OUTPUT HASIL GENERATE --- */}
      <div className="flex-1 w-full space-y-4">
        {loading ? (
          /* Loading State Card */
          <div className="bg-white border border-border-light rounded-xl p-12 text-center shadow-sm min-h-[350px] flex flex-col justify-center items-center">
            <Loader2 className="w-8 h-8 animate-spin text-accent mb-4" />
            <h4 className="font-extrabold text-sm text-text-main">
              Gemini AI Sedang Merangkai Kalimat
            </h4>
            <p className="text-xs text-text-placeholder mt-2 max-w-sm leading-relaxed">
              Membuat 3 variasi naskah dengan gaya <strong>{styleDesc[style] || "natural"}</strong> dan target durasi <strong>~{dur} detik</strong> tanpa kata-kata overclaim...
            </p>
          </div>
        ) : error ? (
          /* Error State Card */
          <div className="bg-danger-bg border border-danger-border text-danger p-6 rounded-xl shadow-sm space-y-3">
            <div className="flex items-center gap-2 font-bold text-sm">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span>Gagal Generate Naskah</span>
            </div>
            <p className="text-xs font-medium leading-relaxed">{error}</p>
            <p className="text-[10px] text-text-placeholder mt-2 leading-relaxed">
              Petunjuk: Silakan periksa apakah Anda telah menambahkan **Gemini API Key** yang valid pada menu **Pengaturan**.
            </p>
          </div>
        ) : variations && variations.length > 0 ? (
          /* Success Output Cards Grid */
          <div className="space-y-4">
            {saveSuccessMsg && (
              <div className="p-3 bg-success-bg border border-success-border text-success text-[11px] rounded-lg font-bold flex items-center gap-2">
                <Check className="w-4 h-4" />
                <span>{saveSuccessMsg}</span>
              </div>
            )}

            <div className="grid grid-cols-1 gap-4">
              {variations.map((v, i) => (
                <div
                  key={i}
                  className={`bg-white border-l-4 rounded-xl p-5 shadow-sm transition-all duration-200 ${varColors[i]}`}
                >
                  <div className="flex justify-between items-center pb-2 border-b border-border-light/60 mb-3">
                    <span
                      className={`text-[9px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider ${varTitleBg[i]}`}
                    >
                      Variasi #{i + 1}
                    </span>
                    <span className="text-[10px] font-mono text-text-placeholder font-bold">
                      Est. Durasi: ~{dur}s
                    </span>
                  </div>

                  {/* Naskah Grid */}
                  <div className="space-y-3 text-xs leading-relaxed font-medium text-text-muted select-text">
                    <div>
                      <span className="text-[9px] font-bold text-accent bg-accent/5 border border-accent/15 px-1 py-0.5 rounded mr-1.5 uppercase font-mono">
                        Hook
                      </span>
                      <span>{v.hook}</span>
                    </div>

                    <div className="border-t border-border-light/40 pt-2.5">
                      <span className="text-[9px] font-bold text-success bg-success-bg border border-success-border px-1 py-0.5 rounded mr-1.5 uppercase font-mono">
                        Isi
                      </span>
                      <span>{v.isi}</span>
                    </div>

                    <div className="border-t border-border-light/40 pt-2.5">
                      <span className="text-[9px] font-bold text-warning bg-warning-bg border border-warning-border px-1 py-0.5 rounded mr-1.5 uppercase font-mono">
                        Proof
                      </span>
                      <span>{v.proof}</span>
                    </div>

                    <div className="border-t border-border-light/40 pt-2.5">
                      <span className="text-[9px] font-bold text-special bg-special-bg border border-special-border px-1 py-0.5 rounded mr-1.5 uppercase font-mono">
                        CTA
                      </span>
                      <span>{v.cta}</span>
                    </div>
                  </div>

                  {/* Action Group */}
                  <div className="flex items-center gap-3 mt-4 pt-3 border-t border-border-light/60">
                    <button
                      onClick={() => handleCopy(v, i)}
                      className="inline-flex items-center gap-1 py-1.5 px-3 bg-bg border border-border-light hover:border-border-active text-text-muted text-[10px] font-bold rounded-lg transition-colors cursor-pointer"
                    >
                      {copiedIdx === i ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-success" />
                          <span className="text-success">Naskah Disalin</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Salin Naskah</span>
                        </>
                      )}
                    </button>

                    {saveProdId && (
                      <button
                        onClick={() => handleSaveToMaster(v.isi, i)}
                        disabled={savingIdx !== null}
                        className="inline-flex items-center gap-1.5 py-1.5 px-3 bg-accent/10 hover:bg-accent hover:text-white border border-accent/25 hover:border-accent text-[10px] font-bold rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                      >
                        {savingIdx === i ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Save className="w-3.5 h-3.5" />
                        )}
                        <span>Simpan Isi Ke Master</span>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* Empty/Initial State Card */
          <div className="bg-white border border-border-light border-dashed rounded-xl p-12 text-center min-h-[350px] flex flex-col justify-center items-center">
            <div className="w-12 h-12 bg-bg-panel border border-border-light rounded-xl flex items-center justify-center text-text-placeholder mx-auto mb-4">
              <Video className="w-6 h-6" />
            </div>
            <h4 className="font-extrabold text-sm text-text-main tracking-tight">
              Menunggu Input Konfigurasi
            </h4>
            <p className="text-xs text-text-placeholder mt-2 max-w-sm leading-relaxed">
              Silakan tentukan produk dan parameters di panel kiri, lalu klik **Generate 3 Variasi (AI)** untuk meminta Google Gemini merumuskan naskah video TikTok Shop Anda secara otomatis.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
