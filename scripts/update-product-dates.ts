// /*
// Tujuan: Skrip satu kali (one-off) untuk memperbarui tanggal ditambahkan produk (date_added) berdasarkan tanggal penjualan pertamanya di tabel sales_data.
// Caller: CLI (npx tsx scripts/update-product-dates.ts)
// Dependensi: better-sqlite3
// Main Functions: main
// Side Effects: Mengubah data pada tabel products di local.db (DB read/write)
// */

import Database from "better-sqlite3";
import path from "path";

const dbPath = path.join(__dirname, "../local.db");
console.log(`Membuka database di: ${dbPath}`);

const db = new Database(dbPath);

async function main() {
  console.log("Memulai pembaruan tanggal ditambahkan produk berdasarkan tanggal penjualan pertama...");

  try {
    db.exec("BEGIN TRANSACTION;");

    // Ambil produk dan tanggal penjualan pertamanya dari tabel sales_data
    const rows = db.prepare(`
      SELECT 
        p.product_id, 
        p.product_name, 
        p.date_added as old_date, 
        min(s.ordered_at) as first_sale
      FROM products p
      INNER JOIN sales_data s ON p.product_id = s.product_id
      WHERE s.ordered_at IS NOT NULL AND s.ordered_at != ''
      GROUP BY p.product_id
    `).all() as { product_id: string; product_name: string; old_date: string; first_sale: string }[];

    console.log(`Ditemukan ${rows.length} produk yang memiliki riwayat penjualan di sales_data.`);

    let updatedCount = 0;

    for (const row of rows) {
      // Ambil bagian tanggal saja (YYYY-MM-DD) dari tanggal penjualan pertama
      // Contoh: "2026-07-08T00:00:00.000Z" -> "2026-07-08"
      const newDate = row.first_sale.substring(0, 10);
      
      if (row.old_date !== newDate) {
        db.prepare(`
          UPDATE products
          SET date_added = ?, updated_at = ?
          WHERE product_id = ?
        `).run(newDate, new Date().toISOString(), row.product_id);

        console.log(`Updated [${row.product_id}] "${row.product_name}": ${row.old_date} -> ${newDate}`);
        updatedCount++;
      } else {
        console.log(`Skipped [${row.product_id}] "${row.product_name}": Tanggal sudah sesuai (${newDate})`);
      }
    }

    db.exec("COMMIT;");
    console.log(`\n🎉 Selesai! Berhasil memperbarui ${updatedCount} produk.`);
  } catch (error) {
    try {
      db.exec("ROLLBACK;");
      console.log("Transaksi di-rollback karena kesalahan.");
    } catch {
      // Abaikan
    }
    console.error("Gagal memperbarui tanggal ditambahkan produk:", error);
    process.exit(1);
  }
}

main();
