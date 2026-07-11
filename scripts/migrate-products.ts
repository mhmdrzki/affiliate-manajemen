// /*
// Tujuan: Migrasi database SQLite lokal untuk mengubah skema tabel `products` dan `stock_history` ke skema baru secara aman.
// Caller: CLI (npx tsx scripts/migrate-products.ts)
// Dependensi: better-sqlite3
// Main Functions: Menjalankan transaksi migrasi database
// Side Effects: Mengubah skema dan memetakan data pada file `local.db`
// */

const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '../local.db');
console.log(`Membuka database di: ${dbPath}`);

const db = new Database(dbPath);

// Pastikan foreign keys aktif di awal untuk melacak relasi sebelum rename kolom
db.pragma('foreign_keys = ON');

try {
  console.log("Memulai proses migrasi...");

  // 1. Ganti nama kolom id di tabel products terlebih dahulu agar SQLite otomatis memperbarui foreign key di tabel contents dan orders
  db.exec("ALTER TABLE products RENAME COLUMN id TO product_id;");
  console.log("Langkah 1: Berhasil mengganti nama kolom products.id -> products.product_id");

  // Matikan foreign keys sementara selama proses drop dan re-create table
  db.pragma('foreign_keys = OFF');

  // Mulai transaksi
  db.exec("BEGIN TRANSACTION;");

  // 2. Buat tabel produk baru dengan skema baru
  db.exec(`
    CREATE TABLE products_new (
      product_id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL,
      product_name TEXT NOT NULL,
      shop_name TEXT,
      shop_code TEXT,
      category TEXT DEFAULT 'Umum' NOT NULL,
      commission_rate REAL DEFAULT 0 NOT NULL,
      avg_price REAL DEFAULT 0 NOT NULL,
      stock_status TEXT DEFAULT 'unknown' NOT NULL,
      stock_updated_at TEXT DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
      last_oos_started_at TEXT,
      last_oos_ended_at TEXT,
      pre_oos_classification TEXT,
      date_added TEXT DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
      is_collaboration INTEGER DEFAULT 0 NOT NULL,
      collab_target_count INTEGER,
      collab_deadline TEXT,
      collab_notes TEXT,
      status TEXT DEFAULT 'active' NOT NULL,
      notes TEXT,
      
      -- Kolom scoring dan metrik penunjang
      bench_score REAL DEFAULT 0 NOT NULL,
      topsis_score REAL DEFAULT 0 NOT NULL,
      klasifikasi TEXT DEFAULT 'MONITOR' NOT NULL,
      slot_rek TEXT DEFAULT '' NOT NULL,
      score_mode TEXT DEFAULT 'benchmark' NOT NULL,
      tiktok_product_id TEXT,
      avg_commission_rate REAL DEFAULT 0 NOT NULL,
      total_revenue REAL DEFAULT 0 NOT NULL,
      total_orders INTEGER DEFAULT 0 NOT NULL,
      net_items_sold INTEGER DEFAULT 0 NOT NULL,
      total_refunded INTEGER DEFAULT 0 NOT NULL,
      kuota_mingguan INTEGER DEFAULT 0 NOT NULL,
      aksi_rekomendasi TEXT DEFAULT '' NOT NULL,
      shop_ads_ratio REAL DEFAULT 0 NOT NULL,
      regularity_score REAL DEFAULT 0 NOT NULL,
      gmv_aktif INTEGER DEFAULT 0 NOT NULL,
      created_at TEXT DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
      updated_at TEXT DEFAULT (CURRENT_TIMESTAMP) NOT NULL
    );
  `);
  console.log("Langkah 2: Berhasil membuat tabel products_new");

  // 3. Salin data dari products ke products_new dengan pemetaan kolom
  db.exec(`
    INSERT INTO products_new (
      product_id, user_id, product_name, shop_name, shop_code, category,
      commission_rate, avg_price, stock_status, stock_updated_at,
      last_oos_started_at, last_oos_ended_at, pre_oos_classification,
      date_added, is_collaboration, collab_target_count, collab_deadline,
      status, notes, bench_score, topsis_score, klasifikasi, slot_rek,
      score_mode, tiktok_product_id, avg_commission_rate, total_revenue,
      total_orders, net_items_sold, total_refunded, kuota_mingguan,
      aksi_rekomendasi, shop_ads_ratio, regularity_score, gmv_aktif,
      created_at, updated_at
    )
    SELECT 
      product_id,
      user_id,
      nama,
      shop_name,
      shop_code,
      kategori,
      COALESCE(avg_commission_rate, komisi, 0.0),
      CAST(harga AS REAL),
      CASE WHEN status = 'habis' THEN 'out_of_stock' ELSE 'available' END,
      updated_at,
      last_oos_started_at,
      last_oos_ended_at,
      pre_oos_classification,
      created_at,
      is_kerjasama,
      kerjasama_target,
      kerjasama_deadline,
      CASE 
        WHEN status = 'aktif' THEN 'active'
        WHEN status = 'jeda' THEN 'paused'
        ELSE 'stopped'
      END,
      NULL,
      bench_score,
      topsis_score,
      klasifikasi,
      slot_rek,
      score_mode,
      tiktok_product_id,
      avg_commission_rate,
      total_revenue,
      total_orders,
      net_items_sold,
      total_refunded,
      kuota_mingguan,
      aksi_rekomendasi,
      shop_ads_ratio,
      regularity_score,
      gmv_aktif,
      created_at,
      updated_at
    FROM products;
  `);
  console.log("Langkah 3: Berhasil menyalin data produk lama ke products_new");

  // 4. Drop tabel products lama dan ganti nama products_new -> products
  db.exec("DROP TABLE products;");
  db.exec("ALTER TABLE products_new RENAME TO products;");
  console.log("Langkah 4: Berhasil me-rename products_new menjadi products");

  // 5. Migrasikan tabel stock_history ke skema integer PK autoincrement
  db.exec("ALTER TABLE stock_history RENAME TO stock_history_old;");
  db.exec(`
    CREATE TABLE stock_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      product_id TEXT NOT NULL,
      status TEXT NOT NULL,
      changed_at TEXT DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
      changed_by TEXT DEFAULT 'user' NOT NULL,
      notes TEXT,
      FOREIGN KEY (product_id) REFERENCES products(product_id) ON DELETE CASCADE
    );
  `);
  console.log("Langkah 5: Berhasil membuat tabel stock_history baru");

  // 6. Salin data dari stock_history_old ke stock_history (biarkan id auto-increment)
  db.exec(`
    INSERT INTO stock_history (product_id, status, changed_at, changed_by, notes)
    SELECT product_id, status, changed_at, changed_by, notes FROM stock_history_old;
  `);
  console.log("Langkah 6: Berhasil memindahkan data riwayat stok ke tabel baru");

  // 7. Drop stock_history_old
  db.exec("DROP TABLE stock_history_old;");
  console.log("Langkah 7: Berhasil menghapus tabel stock_history_old");

  // Commit transaksi
  db.exec("COMMIT;");
  console.log("Transaksi berhasil disimpan.");

  // Nyalakan kembali foreign keys
  db.pragma('foreign_keys = ON');

  // Jalankan PRAGMA foreign_key_check untuk memastikan integritas data setelah migrasi
  const fkErrors = db.prepare("PRAGMA foreign_key_check").all();
  if (fkErrors.length > 0) {
    console.warn("PERINGATAN: Ada pelanggaran foreign key setelah migrasi:", fkErrors);
  } else {
    console.log("Pemeriksaan integritas sukses: Tidak ada pelanggaran foreign key.");
  }

  console.log("Migrasi selesai dengan sukses!");
} catch (error) {
  // Rollback transaksi jika terjadi kesalahan
  try {
    db.exec("ROLLBACK;");
    console.log("Transaksi di-rollback.");
  } catch (rollbackError) {
    // Abaikan jika rollback gagal karena transaksi belum berjalan
  }
  console.error("Gagal melakukan migrasi database:", error);
  process.exit(1);
}
