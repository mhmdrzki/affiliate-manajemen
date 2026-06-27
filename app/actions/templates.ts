// /*
// Tujuan: Server Actions untuk pengelolaan bank template naskah video (Hook, Proof, CTA) per-kategori milik pengguna.
// Caller: Halaman manajemen template (/templates), Generator Jadwal (/schedule)
// Dependensi: lib/supabase/server.ts, types/index.ts
// Main Functions: getTemplatesAction, addTemplateAction, deleteTemplateAction, resetTemplatesToDefaultAction
// Side Effects: Membaca, menulis, atau menghapus record di tabel templates.
// */

"use server";

import { createClient } from "@/lib/supabase/server";
import { Template } from "@/types";

const DEF_HOOKS = [
  { content: "Gue iseng coba [PRODUK] ini — dan sekarang susah balik ke yang lama.", kategori: "Umum" },
  { content: "Jujur, gue awalnya ragu. Tapi setelah pakai [PRODUK] ini seminggu, pendapat gue berubah total.", kategori: "Umum" },
  { content: "Kalau lo capek buang duit buat [PRODUK] yang zonk, coba tonton dulu 30 detik ini.", kategori: "Umum" },
  { content: "Ribuan orang udah order [PRODUK] ini. Gue penasaran — ini hasilnya setelah gue coba sendiri.", kategori: "Umum" },
  { content: "Stop scroll. Kalau lo lagi nyari [PRODUK] yang beneran worth it, ini dia.", kategori: "Umum" },
  { content: "[PRODUK] ini yang sekarang gue pakai tiap hari. Dan gue kasih tau kenapa.", kategori: "Umum" },
  { content: "Kenapa 90% orang salah pilih [PRODUK]? Ini yang harusnya lo perhatiin.", kategori: "Umum" },
  { content: "Jangan beli [PRODUK] sembarangan sebelum lo tau ini.", kategori: "Umum" },
  { content: "Gue nggak nyangka [PRODUK] harga segini bisa sekualitas ini. Serius.", kategori: "Umum" },
  { content: "[PRODUK] ini sering sold out — dan akhirnya gue ngerti kenapa.", kategori: "Umum" },
  { content: "3 hal yang wajib lo tau sebelum beli [PRODUK]. Nomor 2 sering diabaikan.", kategori: "Umum" },
  { content: "Gue challenge diri sendiri pakai [PRODUK] ini selama 7 hari. Ini yang terjadi.", kategori: "Umum" },
  { content: "Dulu gue selalu kecewa sama [PRODUK]. Sampai akhirnya nemu yang ini.", kategori: "Umum" },
  { content: "Kalau lo tipe yang riset dulu sebelum checkout, ini review jujur [PRODUK] dari gue.", kategori: "Umum" },
  { content: "Udah 10rb+ terjual dan ratingnya 4.9. Gue buktiin sendiri apa beneran sebagus itu.", kategori: "Umum" },
  { content: "Semua orang rekomendasiin [PRODUK] yang itu-itu aja. Gue alternatif yang lebih worth it.", kategori: "Umum" },
  { content: "Ini [PRODUK] yang jarang dibahas tapi diam-diam banyak yang repeat order.", kategori: "Umum" },
  { content: "Kalau lo sering nunda beli [PRODUK] karena banyak pilihan — coba yang ini dulu.", kategori: "Umum" },
  { content: "Ini bukan endorse, bukan iklan. Ini murni pengalaman gue pakai [PRODUK] ini.", kategori: "Umum" },
  { content: "Gue udah coba 5 [PRODUK] berbeda. Yang ini yang paling gue suka — dan ini alasannya.", kategori: "Umum" },
];

const DEF_PROOFS = [
  { content: "Udah ribuan yang order, dan reviewnya konsisten bagus — bukan dari gue doang, tapi dari yang udah beli.", kategori: "Umum" },
  { content: "Rating 4.9 dari ribuan pembeli. Angka segitu nggak bisa dimanipulasi.", kategori: "Umum" },
  { content: "Yang repeat order biasanya nggak bohong soal kualitas. Dan ini salah satu produk yang sering di-repeat.", kategori: "Umum" },
  { content: "Reviewnya konsisten positif dari berbagai tipe pembeli — itu yang bikin gue yakin rekomendasiin.", kategori: "Umum" },
  { content: "Bukan karena viral sesaat, tapi karena emang bagus. Makanya penjualannya terus naik.", kategori: "Umum" },
  { content: "Gue udah pakai ini hampir sebulan. Kalau jelek, nggak mungkin gue rekomendasiin.", kategori: "Umum" },
  { content: "Temen gue yang awalnya skeptis akhirnya ikut beli setelah liat punya gue. Itu bukti paling jujur.", kategori: "Umum" },
  { content: "Udah gue pakai rutin dan masih awet sampai sekarang. Worth every rupiah.", kategori: "Umum" },
  { content: "Cek sendiri kolom komentarnya — banyak yang udah buktiin dan share hasilnya.", kategori: "Umum" },
  { content: "Harga segini dapet kualitas kayak gini? Wajar aja banyak yang langsung checkout.", kategori: "Umum" },
];

const DEF_CTAS = [
  { content: "Link produknya ada di keranjang kuning, tap kalau tertarik.", kategori: "Umum" },
  { content: "Cek dulu aja di keranjang kuning — nggak ada ruginya liat-liat.", kategori: "Umum" },
  { content: "Harga segini worth banget. Keranjang kuning ada di bawah.", kategori: "Umum" },
  { content: "Stoknya sering kosong, jadi kalau masih available mending langsung amankan.", kategori: "Umum" },
  { content: "Mumpung masih ada promo, langsung cek keranjang kuning sebelum harga normal.", kategori: "Umum" },
  { content: "Bisa bayar di tempat. Langsung order aja di keranjang kuning.", kategori: "Umum" },
  { content: "Kalau mau coba, link-nya ada di bawah. Bebas cek dulu detailnya.", kategori: "Umum" },
  { content: "Udah banyak yang checkout dari video ini. Keranjang kuning ada di bawah ya.", kategori: "Umum" },
  { content: "Ini rekomendasi jujur dari gue. Tap keranjang kuning kalau mau punya juga.", kategori: "Umum" },
  { content: "Save dulu videonya buat pertimbangan, atau langsung cek di keranjang kuning.", kategori: "Umum" },
];

// Fetch all templates for active user
export async function getTemplatesAction(): Promise<Template[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("templates")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data || [];
}

// Add new template
export async function addTemplateAction(
  type: "hook" | "proof" | "cta",
  content: string,
  kategori: string = "Umum"
): Promise<{ success: boolean; data?: Template; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Unauthorized" };

  const { data, error } = await supabase
    .from("templates")
    .insert({
      user_id: user.id,
      type,
      content,
      kategori,
    })
    .select()
    .single();

  if (error) return { success: false, error: error.message };
  return { success: true, data };
}

// Delete template
export async function deleteTemplateAction(id: string): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Unauthorized" };

  const { error } = await supabase
    .from("templates")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { success: false, error: error.message };
  return { success: true };
}

// Reset templates to default
export async function resetTemplatesToDefaultAction(): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Unauthorized" };

  try {
    // 1. Delete all current user templates
    const { error: delErr } = await supabase
      .from("templates")
      .delete()
      .eq("user_id", user.id);

    if (delErr) throw delErr;

    // 2. Prepare default records
    const templatesToInsert = [
      ...DEF_HOOKS.map((h) => ({ user_id: user.id, type: "hook", content: h.content, kategori: h.kategori })),
      ...DEF_PROOFS.map((p) => ({ user_id: user.id, type: "proof", content: p.content, kategori: p.kategori })),
      ...DEF_CTAS.map((c) => ({ user_id: user.id, type: "cta", content: c.content, kategori: c.kategori })),
    ];

    // 3. Batch insert defaults
    const { error: insErr } = await supabase
      .from("templates")
      .insert(templatesToInsert);

    if (insErr) throw insErr;

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
