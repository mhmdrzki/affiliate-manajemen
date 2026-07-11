/*
Tujuan: Skrip migrasi database SQLite lokal untuk mengubah skema tabel `products`, `contents`, dan `sales_data` ke skema baru secara aman dengan mempertahankan data relasional.
Caller: CLI (npx tsx scripts/migrate-to-new-schema.ts)
Dependensi: better-sqlite3
Main Functions: None (Self-executing migration script)
Side Effects: Membaca, mengubah skema, dan menulis ulang data pada file `local.db`
*/

import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.join(__dirname, '../local.db');
console.log(`Membuka database di: ${dbPath}`);

const db = new Database(dbPath);

// Pastikan foreign keys aktif di awal
db.pragma('foreign_keys = ON');

try {
  console.log("Memulai proses migrasi skema database baru...");

  // Matikan foreign keys sementara selama proses drop dan re-create table
  db.pragma('foreign_keys = OFF');

  // Mulai transaksi
  db.exec("BEGIN TRANSACTION;");

  // 1. Buat tabel produk baru dengan skema baru
  console.log("Membuat tabel products_new...");
  db.exec(`
    CREATE TABLE products_new (
      product_id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL,
      product_name TEXT NOT NULL,
      shop_name TEXT,
      shop_code TEXT,
      category TEXT DEFAULT 'Umum' NOT NULL,
      stock_status TEXT DEFAULT 'unknown' NOT NULL,
      date_added TEXT DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
      is_collaboration INTEGER DEFAULT 0 NOT NULL,
      collab_target_count INTEGER,
      collab_deadline TEXT,
      collab_start_date TEXT,
      status TEXT DEFAULT 'active' NOT NULL,
      created_at TEXT DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
      updated_at TEXT DEFAULT (CURRENT_TIMESTAMP) NOT NULL
    );
  `);

  // Salin data dari products ke products_new dengan pemetaan product_id menggunakan tiktok_product_id (jika ada)
  console.log("Menyalin data ke products_new...");
  db.exec(`
    INSERT INTO products_new (
      product_id, user_id, product_name, shop_name, shop_code, category,
      stock_status, date_added, is_collaboration, collab_target_count,
      collab_deadline, collab_start_date, status, created_at, updated_at
    )
    SELECT 
      COALESCE(NULLIF(tiktok_product_id, ''), product_id),
      user_id,
      product_name,
      shop_name,
      shop_code,
      category,
      stock_status,
      date_added,
      is_collaboration,
      collab_target_count,
      collab_deadline,
      collab_start_date,
      status,
      created_at,
      updated_at
    FROM products;
  `);

  // 2. Buat tabel contents baru dengan skema baru
  console.log("Membuat tabel contents_new...");
  db.exec(`
    CREATE TABLE contents_new (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL,
      product_id TEXT,
      desc_text TEXT,
      tanggal_upload TEXT NOT NULL,
      views INTEGER DEFAULT 0 NOT NULL,
      ctr REAL DEFAULT 0 NOT NULL,
      ctor REAL DEFAULT 0 NOT NULL,
      items_sold INTEGER DEFAULT 0 NOT NULL,
      content_type TEXT DEFAULT 'Video' NOT NULL,
      likes INTEGER DEFAULT 0 NOT NULL,
      comments INTEGER DEFAULT 0 NOT NULL,
      shares INTEGER DEFAULT 0 NOT NULL,
      tiktok_content_id TEXT UNIQUE,
      link_video TEXT,
      created_at TEXT DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
      FOREIGN KEY (product_id) REFERENCES products (product_id) ON DELETE SET NULL
    );
  `);

  // Salin data contents ke contents_new dengan pemetaan product_id yang mengacu pada COALESCE(p.tiktok_product_id, c.product_id)
  console.log("Menyalin data ke contents_new...");
  db.exec(`
    INSERT INTO contents_new (
      id, user_id, product_id, desc_text, tanggal_upload, views, ctr, ctor,
      items_sold, content_type, likes, comments, shares, tiktok_content_id, link_video, created_at
    )
    SELECT 
      c.id,
      c.user_id,
      COALESCE(NULLIF(p.tiktok_product_id, ''), c.product_id),
      c.desc_text,
      c.tanggal_upload,
      c.views,
      c.ctr,
      c.ctor,
      c.items_sold,
      c.content_type,
      c.likes,
      c.comments,
      c.shares,
      c.tiktok_content_id,
      c.link_video,
      c.created_at
    FROM contents c
    LEFT JOIN products p ON c.product_id = p.product_id;
  `);

  // 3. Buat tabel sales_data baru dengan skema baru
  console.log("Membuat tabel sales_data_new...");
  db.exec(`
    CREATE TABLE sales_data_new (
      order_id TEXT PRIMARY KEY NOT NULL,
      product_id TEXT,
      contents_id TEXT,
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
      FOREIGN KEY (contents_id) REFERENCES contents (tiktok_content_id) ON DELETE SET NULL
    );
  `);

  // Salin data sales_data ke sales_data_new dengan pemetaan product_id dan menghubungkan contents_id ke contents.tiktok_content_id
  console.log("Menyalin data ke sales_data_new...");
  db.exec(`
    INSERT INTO sales_data_new (
      order_id, product_id, contents_id, order_type, price, items_sold, gmv,
      est_commission, actual_commission, settlement_status, ordered_at, user_id, created_at
    )
    SELECT 
      s.order_id,
      COALESCE(NULLIF(p.tiktok_product_id, ''), s.product_id),
      c.tiktok_content_id,
      s.order_type,
      s.price,
      s.items_sold,
      s.gmv,
      s.est_commission,
      s.actual_commission,
      s.settlement_status,
      s.ordered_at,
      s.user_id,
      s.created_at
    FROM sales_data s
    LEFT JOIN products p ON s.product_id = p.product_id
    LEFT JOIN contents c ON s.video_id = c.id;
  `);

  // 4. Hapus tabel lama dan ganti nama tabel baru
  console.log("Menghapus tabel lama...");
  db.exec("DROP TABLE sales_data;");
  db.exec("DROP TABLE contents;");
  db.exec("DROP TABLE products;");

  console.log("Mengubah nama tabel baru...");
  db.exec("ALTER TABLE sales_data_new RENAME TO sales_data;");
  db.exec("ALTER TABLE contents_new RENAME TO contents;");
  db.exec("ALTER TABLE products_new RENAME TO products;");

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
  console.log("🎉 Sukses! Database berhasil dimigrasi ke skema baru secara aman.");
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
