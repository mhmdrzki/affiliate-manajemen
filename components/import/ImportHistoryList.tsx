// /*
// Tujuan: Komponen Client untuk menampilkan riwayat impor dan menyediakan opsi pembatalan/reset impor tertentu.
// Caller: app/(dashboard)/import/page.tsx
// Dependensi: app/actions/import-orders.ts, lucide-react, next/navigation (useRouter)
// Main Functions: ImportHistoryList
// Side Effects: Memanggil deleteImportLogAction server action untuk membatalkan impor dan memicu render ulang.
// */

"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { History, Trash2, AlertTriangle, Loader2, X, Info, Calendar, FileText } from "lucide-react";
import { deleteImportLogAction } from "@/app/actions/import-orders";

interface ImportLog {
  id: string;
  filename: string;
  inserted_count: number;
  updated_count: number;
  skipped_count: number;
  created_at: string;
}

interface ImportHistoryListProps {
  logs: ImportLog[];
}

export default function ImportHistoryList({ logs }: ImportHistoryListProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const selectedLog = logs.find((l) => l.id === deletingId);

  const handleDelete = async () => {
    if (!deletingId) return;
    setLoading(true);
    setError(null);

    try {
      const res = await deleteImportLogAction(deletingId);
      if (res.success) {
        setShowConfirmModal(false);
        setDeletingId(null);
        router.refresh();
      } else {
        setError(res.message);
      }
    } catch (err: any) {
      setError(err.message || "Gagal membatalkan riwayat impor.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white border border-border-light rounded-xl p-5 shadow-sm space-y-4">
      <div className="flex items-center gap-2 pb-2 border-b border-border-light">
        <History className="w-4 h-4 text-accent" />
        <h3 className="font-extrabold text-sm tracking-tight text-text-main">
          Riwayat Impor Pesanan ({logs.length})
        </h3>
      </div>

      <div className="overflow-x-auto border border-border-light rounded-lg">
        <table className="w-full border-collapse text-left text-xs">
          <thead>
            <tr className="bg-bg-panel border-b border-border-light text-[10px] font-bold text-text-placeholder uppercase tracking-wider">
              <th className="p-3">File / Berkas</th>
              <th className="p-3">Waktu Impor</th>
              <th className="p-3 text-center">Baru</th>
              <th className="p-3 text-center">Update</th>
              <th className="p-3 text-center">Skip</th>
              <th className="p-3 text-center">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-light">
            {logs.length > 0 ? (
              logs.map((log) => (
                <tr key={log.id} className="hover:bg-bg-panel transition-colors">
                  <td className="p-3 font-semibold text-text-main">
                    <div className="flex items-center gap-1.5 max-w-xs truncate" title={log.filename}>
                      <FileText className="w-3.5 h-3.5 text-text-placeholder flex-shrink-0" />
                      <span>{log.filename}</span>
                    </div>
                  </td>
                  <td className="p-3 text-text-muted font-medium">
                    <div className="flex items-center gap-1 font-mono text-[10px]">
                      <Calendar className="w-3 h-3 text-text-placeholder" />
                      <span>{new Date(log.created_at).toLocaleString("id-ID")}</span>
                    </div>
                  </td>
                  <td className="p-3 text-center font-mono font-bold text-success">
                    +{log.inserted_count}
                  </td>
                  <td className="p-3 text-center font-mono font-medium text-info">
                    {log.updated_count}
                  </td>
                  <td className="p-3 text-center font-mono font-medium text-text-placeholder">
                    {log.skipped_count}
                  </td>
                  <td className="p-3 text-center align-middle">
                    <button
                      onClick={() => {
                        setDeletingId(log.id);
                        setError(null);
                        setShowConfirmModal(true);
                      }}
                      className="inline-flex items-center justify-center gap-1 px-2.5 py-1 text-[10px] font-bold text-danger hover:bg-danger/10 border border-danger/25 hover:border-danger rounded-lg transition-colors cursor-pointer"
                      title="Batalkan Impor ini"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Batalkan</span>
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} className="p-8 text-center text-text-placeholder">
                  Belum ada riwayat impor data pesanan.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && selectedLog && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="absolute inset-0" onClick={() => !loading && setShowConfirmModal(false)} />

          <div className="bg-white border border-border-light rounded-2xl shadow-xl w-full max-w-md overflow-hidden relative z-10 transform transition-all duration-300 scale-95 animate-in zoom-in-95 duration-200 flex flex-col">
            <div className="px-5 py-4 border-b border-border-light flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 bg-danger/10 border border-danger/20 text-danger rounded-lg flex items-center justify-center">
                  <Trash2 className="w-3.5 h-3.5" />
                </div>
                <h3 className="font-extrabold text-sm text-text-main tracking-tight">
                  Batalkan Riwayat Impor
                </h3>
              </div>
              <button
                onClick={() => setShowConfirmModal(false)}
                disabled={loading}
                className="text-text-placeholder hover:text-text-muted p-1 rounded-lg hover:bg-bg-panel transition-all cursor-pointer disabled:opacity-50"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-center">
              <div className="mx-auto w-12 h-12 bg-danger-bg border border-danger-border text-danger rounded-full flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 animate-bounce" />
              </div>
              <div className="space-y-1.5">
                <h4 className="font-bold text-xs text-text-main">
                  Batalkan impor file "{selectedLog.filename}"?
                </h4>
                <p className="text-[10px] text-text-placeholder px-4 leading-relaxed">
                  Tindakan ini akan <strong>menghapus {selectedLog.inserted_count} pesanan baru</strong> yang dimasukkan oleh file ini dari database. Metrik skoring dan klasifikasi produk akan secara otomatis dihitung ulang ke kondisi sebelumnya.
                </p>
              </div>

              {error && (
                <div className="p-3 bg-danger-bg border border-danger-border text-danger text-[11px] rounded-lg font-semibold flex gap-2 text-left">
                  <Info className="w-4 h-4 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div className="pt-4 flex gap-3 justify-center">
                <button
                  type="button"
                  onClick={() => setShowConfirmModal(false)}
                  disabled={loading}
                  className="px-4 py-2 bg-bg border border-border-light hover:border-border-active text-text-muted rounded-lg text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={loading}
                  className="flex items-center gap-1.5 px-4 py-2 bg-danger hover:bg-danger/90 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer disabled:opacity-50 shadow-[0_2px_6px_rgba(239,68,68,0.15)]"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Membatalkan...</span>
                    </>
                  ) : (
                    "Ya, Batalkan Impor"
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
