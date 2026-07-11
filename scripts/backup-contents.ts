/*
Tujuan: Melakukan backup isi tabel `contents` (riwayat konten) ke file JSON.
Caller: CLI / Manual execution via `npx tsx scripts/backup-contents.ts`
Dependensi: better-sqlite3, fs, path
Main Functions: backupContents()
Side Effects: Membaca tabel `contents` dari local.db, membuat folder `backups/` jika belum ada, menulis file backup JSON.
*/

import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

async function backupContents() {
  const dbPath = path.join(__dirname, "../local.db");
  const sqlite = new Database(dbPath);

  console.log("Menghubungkan ke database:", dbPath);

  // Cek apakah tabel contents ada
  const tableCheck = sqlite.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='contents'"
  ).get();

  if (!tableCheck) {
    console.error("Tabel 'contents' tidak ditemukan di database.");
    process.exit(1);
  }

  // Ambil semua data dari tabel contents
  const rows = sqlite.prepare("SELECT * FROM contents").all();
  console.log(`Berhasil mengambil ${rows.length} baris data dari tabel 'contents'.`);

  // Buat folder backups jika belum ada
  const backupsDir = path.join(__dirname, "../backups");
  if (!fs.existsSync(backupsDir)) {
    fs.mkdirSync(backupsDir, { recursive: true });
    console.log("Folder backups dibuat:", backupsDir);
  }

  // Tulis ke file JSON dengan timestamp
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupFileName = `contents_backup_${timestamp}.json`;
  const backupFilePath = path.join(backupsDir, backupFileName);

  fs.writeFileSync(backupFilePath, JSON.stringify(rows, null, 2), "utf8");
  console.log(`Backup berhasil disimpan ke: ${backupFilePath}`);
}

backupContents().catch((err) => {
  console.error("Gagal melakukan backup:", err);
  process.exit(1);
});
