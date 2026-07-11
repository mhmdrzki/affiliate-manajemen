// /*
// Tujuan: Skrip migrasi database SQLite lokal untuk mengubah skema tabel `sales_data` agar mendukung pesanan multi-item secara aman.
// Caller: CLI (npx tsx scripts/migrate-sales-pk.ts)
// Dependensi: better-sqlite3
// Main Functions: None (Self-executing migration script)
// Side Effects: Mengubah skema database dan mengonsolidasikan data penjualan lama di `local.db`.
// */

import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.join(__dirname, '../local.db');
console.log(`Membuka database di: ${dbPath}`);

const db = new Database(dbPath);

// Pastikan foreign keys aktif di awal
db.pragma('foreign_keys = ON');

try {
  console.log("Memulai proses migrasi skema tabel sales_data...");

  // Matikan foreign keys sementara selama proses drop dan re-create table
  db.pragma('foreign_keys = OFF');

  // Mulai transaksi
  db.exec("BEGIN TRANSACTION;");

  // 1. Buat tabel sales_data baru dengan skema baru
  console.log("Membuat tabel sales_data_new...");
  db.exec(`
    CREATE TABLE sales_data_new (
      id TEXT PRIMARY KEY NOT NULL,
      order_id TEXT NOT NULL,
      product_id TEXT,
      contents_id TEXT,
      import_id TEXT,
      order_type TEXT NOT NULL,
      price REAL NOT NULL,
      items_sold INTEGER NOT NULL,
      gmv REAL NOT NULL,
      est_commission REAL NOT NULL,
      actual_commission REAL NOT NULL,
      settlement_status TEXT NOT NULL,
      ordered_at TEXT NOT NULL,
      user_id TEXT NOT NULL,
      created_at TEXT DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
      FOREIGN KEY (product_id) REFERENCES products (product_id) ON DELETE SET NULL,
      FOREIGN KEY (contents_id) REFERENCES contents (tiktok_content_id) ON DELETE SET NULL,
      FOREIGN KEY (import_id) REFERENCES import_logs (id) ON DELETE CASCADE
    );
  `);

  // 2. Buat indeks unik komposit pada tabel baru
  console.log("Membuat indeks unik komposit pada sales_data_new...");
  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS sales_data_order_product_unique_idx ON sales_data_new (order_id, product_id);
  `);

  // 3. Salin data dari sales_data ke sales_data_new dengan konsolidasi group-by
  console.log("Menyalin dan mengonsolidasikan data ke sales_data_new...");
  db.exec(`
    INSERT INTO sales_data_new (
      id, order_id, product_id, contents_id, import_id, order_type, price, items_sold, gmv,
      est_commission, actual_commission, settlement_status, ordered_at, user_id, created_at
    )
    SELECT 
      'sal_' || lower(hex(randomblob(8))) AS id,
      order_id,
      product_id,
      MAX(contents_id) AS contents_id,
      import_id,
      MAX(order_type) AS order_type,
      MAX(price) AS price,
      SUM(items_sold) AS items_sold,
      SUM(gmv) AS gmv,
      SUM(est_commission) AS est_commission,
      SUM(actual_commission) AS actual_commission,
      MAX(settlement_status) AS settlement_status,
      ordered_at,
      user_id,
      MAX(created_at) AS created_at
    FROM sales_data
    GROUP BY order_id, product_id;
  `);

  // 4. Hapus tabel lama dan ganti nama tabel baru
  console.log("Menghapus tabel lama...");
  db.exec("DROP TABLE sales_data;");

  console.log("Mengubah nama tabel baru...");
  db.exec("ALTER TABLE sales_data_new RENAME TO sales_data;");

  // Komit transaksi
  db.exec("COMMIT;");
  console.log("Transaksi migrasi berhasil dijalankan.");

  // Jalankan pemeriksaan integritas foreign key
  console.log("Menjalankan pemeriksaan foreign key database...");
  const fkIssues = db.prepare("PRAGMA foreign_key_check;").all();
  if (fkIssues.length > 0) {
    console.warn("⚠️ Peringatan: Ditemukan inkonsistensi foreign key setelah migrasi:", fkIssues);
  } else {
    console.log("✅ Pemeriksaan foreign key berhasil tanpa masalah.");
  }

  db.pragma('foreign_keys = ON');
  console.log("🎉 Sukses! Tabel sales_data berhasil dimigrasi ke skema baru secara aman.");
} catch (err: any) {
  console.log("Membatalkan transaksi karena terjadi error...");
  try {
    db.exec("ROLLBACK;");
  } catch (rollbackErr) {
    // Abaikan jika rollback gagal karena transaksi belum dibuka
  }
  db.pragma('foreign_keys = ON');
  console.error("❌ Gagal menjalankan migrasi:", err.message);
  process.exit(1);
}
