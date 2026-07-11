import Module from "module";

// Mock next/cache sebelum modul-modul lain di-import secara dinamis
const originalRequire = Module.prototype.require;
Module.prototype.require = function (id) {
  if (id === "next/cache") {
    return {
      revalidatePath: () => {},
      revalidateTag: () => {},
    };
  }
  return originalRequire.apply(this, arguments as any);
};

import Database from "better-sqlite3";
import path from "path";

const dbPath = path.join(__dirname, "../local.db");
const sqlite = new Database(dbPath);

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ GAGAL: ${message}`);
    process.exit(1);
  }
  console.log(`✅ BERHASIL: ${message}`);
}

async function runTests() {
  const { updateProductStockStatusAction, createProductAction } = await import("../app/actions/products");

  console.log("\n=== Menjalankan Pengujian Pasca-Migrasi ===");

  // ==========================================
  // a) Migrasi tidak menghapus/merusak data contents (content_log)
  // ==========================================
  const contentsCount = sqlite.prepare("SELECT count(*) as count FROM contents").get() as { count: number };
  console.log(`Jumlah baris data contents saat ini: ${contentsCount.count}`);
  assert(contentsCount.count > 0, "Tabel contents memiliki baris data (tidak kosong/rusak)");

  // ==========================================
  // b) Join contents <-> products by product_id berfungsi
  // ==========================================
  // Hitung berapa contents yang memiliki product_id
  const linkedContentsCount = sqlite.prepare(
    "SELECT count(*) as count FROM contents WHERE product_id IS NOT NULL"
  ).get() as { count: number };

  // Hitung hasil join contents dan products
  const joinedCount = sqlite.prepare(
    "SELECT count(*) as count FROM contents INNER JOIN products ON contents.product_id = products.product_id"
  ).get() as { count: number };

  console.log(`Contents terhubung (product_id NOT NULL): ${linkedContentsCount.count}`);
  console.log(`Hasil JOIN contents <-> products: ${joinedCount.count}`);
  
  assert(
    linkedContentsCount.count === joinedCount.count,
    "Relasi JOIN contents <-> products masih utuh 1:1 setelah migrasi (tidak ada orphan/broken foreign keys)"
  );

  // ==========================================
  // c) Transisi stock_status
  // ==========================================
  console.log("\n=== Menguji Logika Transisi Stok ===");

  // Buat produk dummy baru untuk diuji
  const dummyTiktokId = "test_tiktok_prod_" + Date.now();
  const createRes = await createProductAction({
    product_name: "Produk Uji Transisi Stok",
    shop_name: "Toko Uji",
    shop_code: "TOKO123",
    category: "Umum",
    stock_status: "available",
    is_collaboration: false,
    status: "active",
    tiktok_product_id: dummyTiktokId,
  });

  console.log("Response dari createProductAction:", createRes);
  assert(createRes.success === true, "Berhasil membuat produk uji transisi");
  const testProduct = createRes.data;
  const testProductId = testProduct.product_id;

  // Cek database langsung untuk produk uji
  let prodRow = sqlite.prepare("SELECT * FROM products WHERE product_id = ?").get(testProductId) as any;
  assert(prodRow.stock_status === "available", "Status awal produk uji adalah 'available'");

  // 1. Transisi ke 'out_of_stock'
  console.log("\nMemicu transisi stock_status -> 'out_of_stock'...");
  const updateOosRes = await updateProductStockStatusAction(
    testProductId,
    "out_of_stock",
    "user",
    "Uji coba habis stok"
  );
  assert(updateOosRes.success === true, "Server action updateProductStockStatusAction sukses");

  prodRow = sqlite.prepare("SELECT * FROM products WHERE product_id = ?").get(testProductId) as any;
  assert(prodRow.stock_status === "out_of_stock", "Status stok produk terupdate ke 'out_of_stock'");

  // 2. Transisi kembali ke 'available'
  console.log("\nMemicu transisi stock_status -> 'available'...");
  const updateAvailRes = await updateProductStockStatusAction(
    testProductId,
    "available",
    "system",
    "Uji coba restock otomatis"
  );
  assert(updateAvailRes.success === true, "Server action updateProductStockStatusAction sukses");

  prodRow = sqlite.prepare("SELECT * FROM products WHERE product_id = ?").get(testProductId) as any;
  assert(prodRow.stock_status === "available", "Status stok produk terupdate kembali ke 'available'");

  // Hapus produk uji agar tidak mengotori database
  sqlite.prepare("DELETE FROM products WHERE product_id = ?").run(testProductId);
  console.log("\nProduk uji berhasil dibersihkan dari database.");

  console.log("\n===========================================");
  console.log("🎉 SEMUA PENGUJIAN BERHASIL DIJALANKAN! 🎉");
  console.log("===========================================");
}

runTests().catch((err) => {
  console.error("Kesalahan saat menjalankan tes:", err);
  process.exit(1);
});
