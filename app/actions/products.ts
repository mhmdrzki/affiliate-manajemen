// /*
// Tujuan: Server Actions untuk mutasi data produk (tambah, edit, status, variasi deskripsi, dan hapus).
// Caller: Komponen Halaman Master Produk (/products)
// Dependensi: lib/supabase/server.ts, next/cache (revalidatePath)
// Main Functions: createProductAction, updateProductStatusAction, saveProductDescVariantAction, updateProductAction, deleteProductAction
// Side Effects: Menulis, memperbarui, dan menghapus baris data di tabel `products` di Supabase.
// */

"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export interface ActionResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
}

/**
 * Membuat data produk baru di database Supabase untuk user aktif
 */
export async function createProductAction(formData: {
  nama: string;
  brand: string;
  jenis: string;
  harga: number;
  komisi: number;
  kategori: string;
}): Promise<ActionResponse> {
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
    const { data, error } = await supabase
      .from("products")
      .insert({
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
        bench_score: 0,
        topsis_score: 0,
        klasifikasi: "MONITOR",
        slot_rek: "08:00/12:00",
        score_mode: "benchmark",
      })
      .select()
      .single();

    if (error) throw error;

    revalidatePath("/products");
    revalidatePath("/");

    return {
      success: true,
      message: "Produk berhasil ditambahkan.",
      data,
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
    const { error } = await supabase
      .from("products")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", productId)
      .eq("user_id", user.id); // RLS safety fallback

    if (error) throw error;

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
    const { data: product, error: getErr } = await supabase
      .from("products")
      .select("desc_variants")
      .eq("id", productId)
      .eq("user_id", user.id)
      .single();

    if (getErr) throw getErr;

    const currentVariants = product?.desc_variants || [];

    if (currentVariants.length >= 3) {
      return {
        success: false,
        message: "Produk sudah memiliki batas maksimal 3 variasi naskah. Silakan hapus salah satu variasi di master produk terlebih dahulu.",
      };
    }

    // 3. Tambahkan ke array dan simpan
    const updatedVariants = [...currentVariants, variantText.trim()];
    const { error: updateErr } = await supabase
      .from("products")
      .update({
        desc_variants: updatedVariants,
        updated_at: new Date().toISOString(),
      })
      .eq("id", productId)
      .eq("user_id", user.id);

    if (updateErr) throw updateErr;

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
  formData: {
    nama: string;
    brand: string;
    jenis: string;
    harga: number;
    komisi: number;
    kategori: string;
  }
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
    const { error } = await supabase
      .from("products")
      .update({
        nama: formData.nama.trim(),
        brand: formData.brand.trim() || null,
        jenis: formData.jenis.trim() || null,
        harga: Math.round(formData.harga),
        komisi: Math.round(formData.komisi),
        kategori: formData.kategori.trim() || "Umum",
        updated_at: new Date().toISOString(),
      })
      .eq("id", productId)
      .eq("user_id", user.id);

    if (error) throw error;

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
    const { error } = await supabase
      .from("products")
      .delete()
      .eq("id", productId)
      .eq("user_id", user.id);

    if (error) throw error;

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

