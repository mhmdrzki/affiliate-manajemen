/*
Tujuan: Skrip migrasi database SQLite lokal untuk membuat tabel import_logs dan menambahkan kolom import_id pada tabel sales_data secara aman.
Caller: CLI (npx tsx scripts/migrate-import-logs.ts)
Dependensi: better-sqlite3
Main Functions: None (Self-executing migration script)
Side Effects: Mengubah skema database local.db
*/

import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.join(__dirname, '../local.db');
console.log(`Membuka database di: ${dbPath}`);

const db = new Database(dbPath);
db.pragma('foreign_keys = ON');

try {
  console.log("Memulai migrasi skema tabel import_logs...");

  // 1. Buat tabel import_logs
  db.exec(`
    CREATE TABLE IF NOT EXISTS import_logs (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL,
      filename TEXT NOT NULL,
      inserted_count INTEGER NOT NULL,
      updated_count INTEGER NOT NULL,
      skipped_count INTEGER NOT NULL,
      created_at TEXT DEFAULT (CURRENT_TIMESTAMP) NOT NULL
    );
  `);
  console.log("✓ Tabel 'import_logs' berhasil divalidasi/dibuat.");

  // 2. Tambahkan kolom import_id ke sales_data jika belum ada
  const tableInfo = db.prepare("PRAGMA table_info(sales_data)").all() as any[];
  const hasImportId = tableInfo.some((col: any) => col.name === 'import_id');

  if (!hasImportId) {
    console.log("Menambahkan kolom 'import_id' ke tabel 'sales_data'...");
    db.exec(`
      ALTER TABLE sales_data 
      ADD COLUMN import_id TEXT REFERENCES import_logs(id) ON DELETE CASCADE;
    `);
    console.log("✓ Kolom 'import_id' berhasil ditambahkan.");
  } else {
    console.log("✓ Kolom 'import_id' sudah ada pada tabel 'sales_data'.");
  }

  console.log("🎉 Migrasi database sukses!");
} catch (err) {
  console.error("❌ Terjadi kesalahan saat migrasi database:", err);
  process.exit(1);
} finally {
  db.close();
}
