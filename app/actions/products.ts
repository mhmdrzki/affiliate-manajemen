// /*
// Tujuan: Server Actions untuk CRUD master produk (create, read, update, delete) + otomatisasi transisi stock status + update massal (bulk).
// Caller: Komponen Halaman Master Produk (/products) dan AI Script Generator (/scripts)
// Dependensi: lib/db/index.ts, lib/db/schema.ts, lib/auth.ts, next/cache (revalidatePath)
// Main Functions: createProductAction, updateProductAction, updateProductStatusAction, updateProductStockStatusAction, updateProductsBulkAction, deleteProductAction, deleteProductsBulkAction, saveProductDescVariantAction, resetProductTestingAction
// Side Effects: Menulis, memperbarui, dan menghapus data produk di SQLite lokal.
// */

"use server";

import { getMockUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { products, sales_data as ordersTable, contents as contentsTable, sales_data } from "@/lib/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { Product, Order } from "@/types";

export interface ActionResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
}

export interface ProductFormData {
  product_name: string;
  shop_name?: string | null;
  shop_code?: string | null;
  category: string;
  stock_status: "available" | "out_of_stock" | "unknown";
  is_collaboration: boolean;
  collab_target_count?: number | null;
  collab_deadline?: string | null;
  collab_start_date?: string | null;
  status: "active" | "paused" | "stopped";
  tiktok_product_id?: string | null;
}

/**
 * Memproses logika otomatisasi ketika status stok produk berubah
 */
async function processStockStatusTransition(
  productId: string,
  currentStatus: "available" | "out_of_stock" | "unknown",
  newStatus: "available" | "out_of_stock" | "unknown",
  changedBy: "user" | "system",
  notes: string | null = null
): Promise<{
  stock_status: "available" | "out_of_stock" | "unknown";
}> {
  return {
    stock_status: newStatus,
  };
}

/**
 * Membuat data produk baru
 */
export async function createProductAction(formData: ProductFormData): Promise<ActionResponse> {
  const user = await getMockUser();

  if (!user) {
    return { success: false, message: "Sesi habis, silakan login ulang." };
  }

  if (!formData.product_name.trim()) {
    return { success: false, message: "Nama produk wajib diisi." };
  }

  try {
    const today = new Date().toISOString().split("T")[0];
    const uuid = formData.tiktok_product_id?.trim() || crypto.randomUUID();

    const newProduct = {
      product_id: uuid,
      user_id: user.id,
      product_name: formData.product_name.trim(),
      shop_name: formData.shop_name?.trim() || null,
      shop_code: formData.shop_code?.trim() || null,
      category: formData.category.trim() || "Umum",
      stock_status: formData.stock_status || "available",
      date_added: today,
      is_collaboration: formData.is_collaboration || false,
      collab_target_count: formData.is_collaboration ? (formData.collab_target_count || 0) : null,
      collab_deadline: formData.is_collaboration ? (formData.collab_deadline || null) : null,
      collab_start_date: formData.is_collaboration ? (formData.collab_start_date || null) : null,
      status: formData.status || "active",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await db.insert(products).values(newProduct);

    // Memicu perhitungan skor awal setelah produk berhasil dibuat
    await recalculateProductAnalytics(user.id);

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
 * Memperbarui data detail produk
 */
export async function updateProductAction(
  productId: string,
  formData: ProductFormData
): Promise<ActionResponse> {
  const user = await getMockUser();

  if (!user) {
    return { success: false, message: "Sesi habis, silakan login ulang." };
  }

  if (!formData.product_name.trim()) {
    return { success: false, message: "Nama produk wajib diisi." };
  }

  try {
    const currentProduct = await db
      .select()
      .from(products)
      .where(and(eq(products.product_id, productId), eq(products.user_id, user.id)))
      .then((rows) => rows[0]);

    if (!currentProduct) {
      return { success: false, message: "Produk tidak ditemukan." };
    }

    const updateFields: any = {
      product_name: formData.product_name.trim(),
      shop_name: formData.shop_name?.trim() || null,
      shop_code: formData.shop_code?.trim() || null,
      category: formData.category.trim() || "Umum",
      is_collaboration: formData.is_collaboration,
      collab_target_count: formData.is_collaboration ? (formData.collab_target_count || 0) : null,
      collab_deadline: formData.is_collaboration ? (formData.collab_deadline || null) : null,
      collab_start_date: formData.is_collaboration ? (formData.collab_start_date || null) : null,
      status: formData.status,
      stock_status: formData.stock_status || "available",
      updated_at: new Date().toISOString(),
    };

    await db
      .update(products)
      .set(updateFields)
      .where(and(eq(products.product_id, productId), eq(products.user_id, user.id)));

    // Memicu perhitungan skor ulang setelah produk berhasil diperbarui
    await recalculateProductAnalytics(user.id);

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
 * Memperbarui status keaktifan kerjasama afiliasi produk (active | paused | stopped)
 */
export async function updateProductStatusAction(
  productId: string,
  status: "active" | "paused" | "stopped"
): Promise<ActionResponse> {
  const user = await getMockUser();

  if (!user) {
    return { success: false, message: "Sesi habis, silakan login ulang." };
  }

  if (!["active", "paused", "stopped"].includes(status)) {
    return { success: false, message: "Status tidak valid." };
  }

  try {
    const currentProduct = await db
      .select()
      .from(products)
      .where(and(eq(products.product_id, productId), eq(products.user_id, user.id)))
      .then((rows) => rows[0]);

    if (!currentProduct) {
      return { success: false, message: "Produk tidak ditemukan." };
    }

    const updateFields: any = {
      status,
      updated_at: new Date().toISOString(),
    };

    await db
      .update(products)
      .set(updateFields)
      .where(and(eq(products.product_id, productId), eq(products.user_id, user.id)));

    // Trigger recalculation for all scores to calculate components and classification
    // Trigger recalculation for analytics
    await recalculateProductAnalytics(user.id);

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
 * Endpoint server action khusus untuk memperbarui stock_status produk (available | out_of_stock | unknown)
 * Otomatis memicu log stock_history dan pengaturan tanggal OOS
 */
export async function updateProductStockStatusAction(
  productId: string,
  stockStatus: "available" | "out_of_stock" | "unknown",
  changedBy: "user" | "system" = "user",
  notes: string | null = null
): Promise<ActionResponse> {
  const user = await getMockUser();

  if (!user) {
    return { success: false, message: "Sesi habis, silakan login ulang." };
  }

  if (!["available", "out_of_stock", "unknown"].includes(stockStatus)) {
    return { success: false, message: "Status stock tidak valid." };
  }

  try {
    await db
      .update(products)
      .set({ stock_status: stockStatus })
      .where(and(eq(products.product_id, productId), eq(products.user_id, user.id)));

    revalidatePath("/products");
    revalidatePath("/");

    return {
      success: true,
      message: `Status stok produk berhasil diperbarui menjadi ${stockStatus}.`,
    };
  } catch (err: any) {
    return {
      success: false,
      message: err.message || "Gagal memperbarui status stok produk.",
    };
  }
}

/**
 * Menghapus produk dari database
 */
export async function deleteProductAction(
  productId: string
): Promise<ActionResponse> {
  const user = await getMockUser();

  if (!user) {
    return { success: false, message: "Sesi habis, silakan login ulang." };
  }

  try {
    await db
      .delete(products)
      .where(and(eq(products.product_id, productId), eq(products.user_id, user.id)));

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
  const user = await getMockUser();

  if (!user) {
    return { success: false, message: "Sesi habis, silakan login ulang." };
  }

  if (!productIds || productIds.length === 0) {
    return { success: false, message: "Tidak ada produk yang dipilih untuk dihapus." };
  }

  try {
    await db
      .delete(products)
      .where(and(inArray(products.product_id, productIds), eq(products.user_id, user.id)));

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

/**
 * Menyimpan varian deskripsi isi naskah (isi) ke kolom notes sebagai JSON array
 */
export async function saveProductDescVariantAction(
  productId: string,
  variantText: string
): Promise<ActionResponse> {
  return {
    success: false,
    message: "Fitur simpan variasi ke master produk dinonaktifkan karena skema database disederhanakan.",
  };
}

export async function recalculateProductAnalytics(userId: string): Promise<void> {
  // No-op
}

export async function resetProductTestingAction(productId: string): Promise<ActionResponse> {
  const user = await getMockUser();
  if (!user) {
    return {
      success: false,
      message: "Pengguna tidak terautentikasi.",
    };
  }

  try {
    await db
      .update(products)
      .set({
        reset_testing_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .where(and(eq(products.product_id, productId), eq(products.user_id, user.id)));

    revalidatePath("/products");
    revalidatePath("/schedule");

    return {
      success: true,
      message: "Siklus testing produk berhasil di-reset.",
    };
  } catch (err: any) {
    return {
      success: false,
      message: err.message || "Gagal mereset testing produk.",
    };
  }
}

/**
 * Memperbarui status/stok/kerjasama/kategori beberapa produk secara massal
 */
export async function updateProductsBulkAction(
  productIds: string[],
  updates: {
    status?: "active" | "paused" | "stopped";
    stock_status?: "available" | "out_of_stock" | "unknown";
    is_collaboration?: boolean;
    collab_target_count?: number | null;
    collab_deadline?: string | null;
    collab_start_date?: string | null;
    category?: string;
  }
): Promise<ActionResponse> {
  const user = await getMockUser();

  if (!user) {
    return { success: false, message: "Sesi habis, silakan login ulang." };
  }

  if (!productIds || productIds.length === 0) {
    return { success: false, message: "Tidak ada produk yang dipilih." };
  }

  try {
    const updateFields: any = {
      updated_at: new Date().toISOString(),
    };

    if (updates.status !== undefined) {
      updateFields.status = updates.status;
    }
    if (updates.stock_status !== undefined) {
      updateFields.stock_status = updates.stock_status;
    }
    if (updates.is_collaboration !== undefined) {
      updateFields.is_collaboration = updates.is_collaboration;
      if (updates.is_collaboration) {
        if (updates.collab_target_count !== undefined) {
          updateFields.collab_target_count = updates.collab_target_count;
        }
        if (updates.collab_deadline !== undefined) {
          updateFields.collab_deadline = updates.collab_deadline;
        }
        if (updates.collab_start_date !== undefined) {
          updateFields.collab_start_date = updates.collab_start_date;
        }
      } else {
        updateFields.collab_target_count = null;
        updateFields.collab_deadline = null;
        updateFields.collab_start_date = null;
      }
    }
    if (updates.category !== undefined) {
      updateFields.category = updates.category.trim() || "Umum";
    }

    await db
      .update(products)
      .set(updateFields)
      .where(and(inArray(products.product_id, productIds), eq(products.user_id, user.id)));

    // Revalidate paths
    revalidatePath("/products");
    revalidatePath("/");

    return {
      success: true,
      message: `${productIds.length} produk berhasil diperbarui secara massal.`,
    };
  } catch (err: any) {
    return {
      success: false,
      message: err.message || "Gagal memperbarui produk secara massal.",
    };
  }
}
