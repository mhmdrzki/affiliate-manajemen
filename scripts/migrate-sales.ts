// /*
// Tujuan: Skrip migrasi database SQLite lokal untuk menghapus tabel orders lama dan membuat tabel sales_data baru.
// Caller: CLI (npx tsx scripts/migrate-sales.ts)
// Dependensi: better-sqlite3
// Main Functions: migrate
// Side Effects: Mengubah skema database local.db
// */

import Database from "better-sqlite3";
import path from "path";

const dbPath = path.join(__dirname, "../local.db");
const db = new Database(dbPath);

console.log("Memulai migrasi skema sales_data...");

try {
  db.exec("PRAGMA foreign_keys = OFF;");
  
  console.log("Menghapus tabel orders lama...");
  db.exec("DROP TABLE IF EXISTS orders;");
  
  console.log("Membuat tabel sales_data baru...");
  db.exec(`
    CREATE TABLE IF NOT EXISTS sales_data (
      order_id TEXT PRIMARY KEY,
      sku_id TEXT,
      product_id TEXT,
      product_name TEXT,
      video_id TEXT,
      shop_code TEXT,
      order_type TEXT NOT NULL,
      price REAL NOT NULL,
      items_sold INTEGER NOT NULL,
      gmv REAL NOT NULL,
      est_commission REAL NOT NULL,
      actual_commission REAL NOT NULL,
      settlement_status TEXT NOT NULL,
      ordered_at TEXT NOT NULL,
      import_batch TEXT NOT NULL,
      user_id TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (product_id) REFERENCES products(product_id) ON DELETE SET NULL,
      FOREIGN KEY (video_id) REFERENCES contents(id) ON DELETE SET NULL
    );
  `);
  
  console.log("Menjalankan pemeriksaan foreign key database...");
  const fkIssues = db.prepare("PRAGMA foreign_key_check;").all();
  if (fkIssues.length > 0) {
    console.warn("⚠️ Peringatan: Ditemukan inkonsistensi foreign key:", fkIssues);
  } else {
    console.log("✅ Pemeriksaan foreign key berhasil tanpa masalah.");
  }
  
  db.exec("PRAGMA foreign_keys = ON;");
  console.log("🎉 Migrasi database sales_data sukses!");
} catch (err: any) {
  console.error("❌ Gagal menjalankan migrasi:", err.message);
  process.exit(1);
}
