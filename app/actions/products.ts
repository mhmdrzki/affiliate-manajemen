// /*
// Tujuan: Server Actions untuk mutasi data produk (tambah, edit, status, variasi deskripsi, hapus, dan hapus massal) termasuk field kustom TikTok & kerjasama.
// Caller: Komponen Halaman Master Produk (/products)
// Dependensi: lib/db/index.ts, lib/supabase/server.ts, next/cache (revalidatePath)
// Main Functions: createProductAction, updateProductStatusAction, saveProductDescVariantAction, updateProductAction, deleteProductAction, deleteProductsBulkAction
// Side Effects: Menulis, memperbarui, dan menghapus baris data di tabel `products` di SQLite lokal.
// */

"use server";

import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { products, stock_history, orders as ordersTable, contents as contentsTable } from "@/lib/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import {
  computeOrderBasedStats,
  computeCompositeScore,
  classifyProduct,
  calcWeeklyQuota,
  slotR,
  generateRecommendation,
} from "@/lib/scoring/engine";
import { Product, StockHistory, Order } from "@/types";

export interface ActionResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
}

export interface ProductFormData {
  nama: string;
  brand: string;
  jenis: string;
  harga: number;
  komisi: number;
  kategori: string;
  tiktok_product_id?: string | null;
  shop_name?: string | null;
  shop_code?: string | null;
  is_kerjasama?: boolean;
  kerjasama_target?: number;
  kerjasama_deadline?: string | null;
}

/**
 * Membuat data produk baru di database SQLite lokal untuk user aktif
 */
export async function createProductAction(formData: ProductFormData): Promise<ActionResponse> {
  const supabase = await createClient();

  // 1. Verifikasi User
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: "Sesi habis, silakan login ulang." };
  }

  // 2. Validasi input
  if (!formData.nama.trim()) {
    return { success: false, message: "Nama produk wajib diisi." };
  }
  if (formData.harga < 0 || formData.komisi < 0) {
    return { success: false, message: "Harga dan komisi tidak boleh bernilai negatif." };
  }

  try {
    const newProduct = {
      id: crypto.randomUUID(),
      user_id: user.id,
      nama: formData.nama.trim(),
      brand: formData.brand.trim() || null,
      jenis: formData.jenis.trim() || null,
      harga: Math.round(formData.harga),
      komisi: Math.round(formData.komisi),
      kategori: formData.kategori.trim() || "Umum",
      status: "aktif",
      label_prestasi: "-",
      gmv_aktif: false,
      bench_score: 0.0,
      topsis_score: 0.0,
      klasifikasi: "MONITOR" as const,
      slot_rek: "10:00/12:00",
      score_mode: "topsis",
      // New TikTok/Kerjasama Fields
      tiktok_product_id: formData.tiktok_product_id?.trim() || null,
      shop_name: formData.shop_name?.trim() || null,
      shop_code: formData.shop_code?.trim() || null,
      is_kerjasama: formData.is_kerjasama || false,
      kerjasama_target: formData.is_kerjasama ? (formData.kerjasama_target || 0) : 0,
      kerjasama_deadline: formData.is_kerjasama ? (formData.kerjasama_deadline || null) : null,
      last_oos_started_at: null,
      last_oos_ended_at: null,
      pre_oos_classification: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await db.insert(products).values(newProduct);

    revalidatePath("/products");
    revalidatePath("/");

    return {
      success: true,
      message: "Produk berhasil ditambahkan.",
      data: newProduct,
    };
  } catch (err: any) {
    return {
      success: false,
      message: err.message || "Gagal membuat data produk.",
    };
  }
}

/**
 * Memperbarui status keaktifan produk (aktif | jeda | habis)
 */
export async function updateProductStatusAction(
  productId: string,
  status: "aktif" | "jeda" | "habis"
): Promise<ActionResponse> {
  const supabase = await createClient();

  // 1. Verifikasi User
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: "Sesi habis, silakan login ulang." };
  }

  if (!["aktif", "jeda", "habis"].includes(status)) {
    return { success: false, message: "Status tidak valid." };
  }

  try {
    const currentProduct = await db
      .select()
      .from(products)
      .where(and(eq(products.id, productId), eq(products.user_id, user.id)))
      .then((rows) => rows[0]);

    if (!currentProduct) {
      return { success: false, message: "Produk tidak ditemukan." };
    }

    const currentStatus = currentProduct.status;
    const nowStr = new Date().toISOString();

    const updateFields: any = {
      status,
      updated_at: nowStr,
    };

    // Transition to OOS (habis)
    if (status === "habis" && currentStatus !== "habis") {
      updateFields.last_oos_started_at = nowStr;
      updateFields.pre_oos_classification = currentProduct.klasifikasi;

      await db.insert(stock_history).values({
        id: crypto.randomUUID(),
        product_id: productId,
        status: "out_of_stock",
        changed_at: nowStr,
        changed_by: "user",
        notes: "Status diubah menjadi habis oleh user",
      });
    }
    // Transition from OOS (habis) back to active/paused
    else if (status !== "habis" && currentStatus === "habis") {
      updateFields.last_oos_ended_at = nowStr;

      await db.insert(stock_history).values({
        id: crypto.randomUUID(),
        product_id: productId,
        status: "available",
        changed_at: nowStr,
        changed_by: "user",
        notes: `Status diubah menjadi ${status} oleh user`,
      });
    }

    // Fetch orders, stock history, and contents for this product to do live recomputation
    const productOrders = (await db.select().from(ordersTable).where(eq(ordersTable.product_id, productId))) as unknown as Order[];
    const productHistory = (await db.select().from(stock_history).where(eq(stock_history.product_id, productId))) as unknown as StockHistory[];
    const productContents = await db.select().from(contentsTable).where(eq(contentsTable.product_id, productId));

    // Merge updated fields for simulated product state
    const simulatedProduct = { ...currentProduct, ...updateFields } as unknown as Product;

    // Recompute scoring
    const stats = computeOrderBasedStats(productOrders, simulatedProduct, productHistory, productContents);
    const score = computeCompositeScore(stats);
    const klas = classifyProduct(stats, score, simulatedProduct);
    const kuota = calcWeeklyQuota(klas, score, simulatedProduct.is_kerjasama || false, simulatedProduct.kerjasama_target || 0);
    const slot = slotR(klas);
    const rec = generateRecommendation(klas, stats);

    updateFields.bench_score = score;
    updateFields.topsis_score = score / 100;
    updateFields.klasifikasi = klas;
    updateFields.kuota_mingguan = kuota;
    updateFields.slot_rek = slot;
    updateFields.aksi_rekomendasi = rec;
    updateFields.regularity_score = stats.regularityScore;
    updateFields.gmv_aktif = stats.shopAdsRatio > 0.3;

    await db
      .update(products)
      .set(updateFields)
      .where(and(eq(products.id, productId), eq(products.user_id, user.id)));

    revalidatePath("/products");
    revalidatePath("/");

    return {
      success: true,
      message: `Status produk berhasil diperbarui menjadi ${status}.`,
    };
  } catch (err: any) {
    return {
      success: false,
      message: err.message || "Gagal memperbarui status produk.",
    };
  }
}

/**
 * Menyimpan varian deskripsi isi naskah (isi) ke master produk
 * Maksimal 3 variasi deskripsi per produk.
 */
export async function saveProductDescVariantAction(
  productId: string,
  variantText: string
): Promise<ActionResponse> {
  const supabase = await createClient();

  // 1. Verifikasi User
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: "Sesi habis, silakan login ulang." };
  }

  if (!variantText.trim()) {
    return { success: false, message: "Isi naskah variasi tidak boleh kosong." };
  }

  try {
    // 2. Ambil data produk saat ini
    const product = await db
      .select({ desc_variants: products.desc_variants })
      .from(products)
      .where(and(eq(products.id, productId), eq(products.user_id, user.id)))
      .then((rows) => rows[0]);

    if (!product) {
      throw new Error("Produk tidak ditemukan.");
    }

    let currentVariants: string[] = [];
    if (product.desc_variants) {
      try {
        currentVariants = JSON.parse(product.desc_variants);
        if (!Array.isArray(currentVariants)) currentVariants = [];
      } catch {
        currentVariants = [];
      }
    }

    if (currentVariants.length >= 3) {
      return {
        success: false,
        message: "Produk sudah memiliki batas maksimal 3 variasi naskah. Silakan hapus salah satu variasi di master produk terlebih dahulu.",
      };
    }

    // 3. Tambahkan ke array dan simpan
    const updatedVariants = [...currentVariants, variantText.trim()];
    await db
      .update(products)
      .set({
        desc_variants: JSON.stringify(updatedVariants),
        updated_at: new Date().toISOString(),
      })
      .where(and(eq(products.id, productId), eq(products.user_id, user.id)));

    revalidatePath("/products");
    revalidatePath("/");

    return {
      success: true,
      message: "Varian naskah berhasil disimpan ke master produk.",
    };
  } catch (err: any) {
    return {
      success: false,
      message: err.message || "Gagal menyimpan varian naskah.",
    };
  }
}

/**
 * Memperbarui data detail produk
 */
export async function updateProductAction(
  productId: string,
  formData: ProductFormData
): Promise<ActionResponse> {
  const supabase = await createClient();

  // 1. Verifikasi User
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: "Sesi habis, silakan login ulang." };
  }

  // 2. Validasi input
  if (!formData.nama.trim()) {
    return { success: false, message: "Nama produk wajib diisi." };
  }
  if (formData.harga < 0 || formData.komisi < 0) {
    return { success: false, message: "Harga dan komisi tidak boleh bernilai negatif." };
  }

  try {
    await db
      .update(products)
      .set({
        nama: formData.nama.trim(),
        brand: formData.brand.trim() || null,
        jenis: formData.jenis.trim() || null,
        harga: Math.round(formData.harga),
        komisi: Math.round(formData.komisi),
        kategori: formData.kategori.trim() || "Umum",
        updated_at: new Date().toISOString(),
        // New TikTok/Kerjasama Fields
        tiktok_product_id: formData.tiktok_product_id?.trim() || null,
        shop_name: formData.shop_name?.trim() || null,
        shop_code: formData.shop_code?.trim() || null,
        is_kerjasama: formData.is_kerjasama || false,
        kerjasama_target: formData.is_kerjasama ? (formData.kerjasama_target || 0) : 0,
        kerjasama_deadline: formData.is_kerjasama ? (formData.kerjasama_deadline || null) : null,
      })
      .where(and(eq(products.id, productId), eq(products.user_id, user.id)));

    revalidatePath("/products");
    revalidatePath("/");

    return {
      success: true,
      message: "Data produk berhasil diperbarui.",
    };
  } catch (err: any) {
    return {
      success: false,
      message: err.message || "Gagal memperbarui data produk.",
    };
  }
}

/**
 * Menghapus produk dari database
 */
export async function deleteProductAction(
  productId: string
): Promise<ActionResponse> {
  const supabase = await createClient();

  // 1. Verifikasi User
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: "Sesi habis, silakan login ulang." };
  }

  try {
    await db
      .delete(products)
      .where(and(eq(products.id, productId), eq(products.user_id, user.id)));

    revalidatePath("/products");
    revalidatePath("/");

    return {
      success: true,
      message: "Produk berhasil dihapus.",
    };
  } catch (err: any) {
    return {
      success: false,
      message: err.message || "Gagal menghapus produk.",
    };
  }
}

/**
 * Menghapus banyak produk sekaligus dari database
 */
export async function deleteProductsBulkAction(
  productIds: string[]
): Promise<ActionResponse> {
  const supabase = await createClient();

  // 1. Verifikasi User
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: "Sesi habis, silakan login ulang." };
  }

  if (!productIds || productIds.length === 0) {
    return { success: false, message: "Tidak ada produk yang dipilih untuk dihapus." };
  }

  try {
    await db
      .delete(products)
      .where(and(inArray(products.id, productIds), eq(products.user_id, user.id)));

    revalidatePath("/products");
    revalidatePath("/");

    return {
      success: true,
      message: `${productIds.length} produk berhasil dihapus.`,
    };
  } catch (err: any) {
    return {
      success: false,
      message: err.message || "Gagal menghapus produk.",
    };
  }
}

