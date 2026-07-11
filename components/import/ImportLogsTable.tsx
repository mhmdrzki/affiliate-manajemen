// /*
// Tujuan: Komponen klien-side untuk menampilkan daftar log riwayat impor dan menyediakan aksi hapus/batal impor batch.
// Caller: app/(dashboard)/import/page.tsx
// Dependensi: app/actions/import-orders.ts, lucide-react, next/navigation
// Main Functions: ImportLogsTable
// Side Effects: Memanggil deleteImportLogAction untuk menghapus log impor dan pesanan terkait.
// */

"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { History, Trash2, Calendar, FileSpreadsheet, PlusCircle, Loader2 } from "lucide-react";
import { deleteImportLogAction } from "@/app/actions/import-orders";

interface ImportLog {
  id: string;
  user_id: string;
  filename: string;
  inserted_count: number;
  updated_count: number;
  skipped_count: number;
  created_at: string;
}

interface ImportLogsTableProps {
  logs: ImportLog[];
  onOpenImportModal: () => void;
}

export default function ImportLogsTable({ logs, onOpenImportModal }: ImportLogsTableProps) {
  const router = useRouter();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDeleteClick = async (id: string, filename: string) => {
    if (
      !confirm(
        `Apakah Anda yakin ingin membatalkan impor dari file "${filename}"?\n` +
        `Semua data pesanan baru dari file ini akan dihapus secara permanen.`
      )
    ) {
      return;
    }

    setDeletingId(id);
    try {
      const res = await deleteImportLogAction(id);
      if (res.success) {
        alert(res.message);
        router.refresh();
      } else {
        alert(res.message);
      }
    } catch (err: any) {
      alert("Terjadi kesalahan saat membatalkan impor: " + (err.message || err));
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="bg-card border border-border rounded-xl shadow-md overflow-hidden">
      {/* Header */}
      <div className="p-5 border-b border-border flex flex-col sm:flex-row items-center justify-between gap-4 bg-bg/10">
        <div className="flex items-center gap-2">
          <History className="w-5 h-5 text-accent" />
          <div>
            <h3 className="font-extrabold text-sm text-text-main">
              Riwayat Impor Pesanan
            </h3>
            <p className="text-[10px] text-text-placeholder mt-0.5">
              Kelola berkas spreadsheet TikTok Affiliate yang pernah diimpor ke sistem.
            </p>
          </div>
        </div>

        <button
          onClick={onOpenImportModal}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-accent hover:bg-accent-hover text-white text-xs font-bold rounded-lg cursor-pointer transition-colors shadow-sm"
        >
          <PlusCircle className="w-4 h-4" />
          <span>Unggah File Baru</span>
        </button>
      </div>

      {/* Logs Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-bg border-b border-border text-[10px] font-bold text-text-muted uppercase tracking-wider">
              <th className="py-3 px-4">Waktu Impor</th>
              <th className="py-3 px-4">Nama Berkas</th>
              <th className="py-3 px-4 text-center">Data Baru</th>
              <th className="py-3 px-4 text-center">Duplikat Lewat</th>
              <th className="py-3 px-4 text-center">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border text-xs text-text-main">
            {logs.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-6 text-center text-text-placeholder font-medium">
                  Belum ada riwayat impor data. Silakan klik "Unggah File Baru" untuk memulai.
                </td>
              </tr>
            ) : (
              logs.map((log) => (
                <tr key={log.id} className="hover:bg-bg/50 transition-colors">
                  {/* Timestamp */}
                  <td className="py-3 px-4 font-mono text-[11px] whitespace-nowrap">
                    <span className="inline-flex items-center gap-1.5 text-text-placeholder">
                      <Calendar className="w-3.5 h-3.5" />
                      {log.created_at ? new Date(log.created_at).toLocaleString("id-ID", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      }) : "-"}
                    </span>
                  </td>

                  {/* Filename */}
                  <td className="py-3 px-4 font-semibold">
                    <div className="flex items-center gap-2 max-w-[280px] sm:max-w-[400px]">
                      <FileSpreadsheet className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                      <span className="truncate" title={log.filename}>{log.filename}</span>
                    </div>
                  </td>

                  {/* Inserted Count */}
                  <td className="py-3 px-4 text-center font-bold text-success">
                    +{log.inserted_count}
                  </td>

                  {/* Skipped Count */}
                  <td className="py-3 px-4 text-center font-medium text-text-placeholder">
                    {log.skipped_count}
                  </td>

                  {/* Cancel Action */}
                  <td className="py-3 px-4 text-center">
                    <button
                      onClick={() => handleDeleteClick(log.id, log.filename)}
                      disabled={deletingId === log.id}
                      className="inline-flex items-center gap-1 text-[10px] font-bold text-danger hover:text-danger-hover transition-colors disabled:opacity-50 cursor-pointer"
                      title="Batalkan & Hapus Impor"
                    >
                      {deletingId === log.id ? (
                        <>
                          <Loader2 className="w-3 h-3 animate-spin" />
                          <span>Hapus...</span>
                        </>
                      ) : (
                        <>
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Batalkan Impor</span>
                        </>
                      )}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
