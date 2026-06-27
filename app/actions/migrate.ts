// /*
// Tujuan: Server Action sekali pakai untuk memigrasikan data JSON cadangan (v2.5) ke database relasional PostgreSQL Supabase dengan mapping UUID.
// Caller: Halaman alat migrasi data (/migrate)
// Dependensi: lib/supabase/server.ts, types/index.ts, lib/scoring/engine.ts
// Main Functions: migrateLegacyDataAction
// Side Effects: Mengisi tabel products, contents, period_snapshots, dan templates dengan data impor, lalu mereset skor.
// */

"use server";

import { createClient } from "@/lib/supabase/server";
import {
  recomputeProductStats,
  scoreBenchmark,
  scoreTOPSIS,
  computeCompositeScore,
  classifyP,
  slotR,
} from "@/lib/scoring/engine";
import { Product, Content, PeriodSnapshot } from "@/types";

export interface MigrationResult {
  success: boolean;
  productsCount: number;
  contentsCount: number;
  snapshotsCount: number;
  templatesCount: number;
  message: string;
}

export async function migrateLegacyDataAction(
  legacyData: any
): Promise<MigrationResult> {
  const supabase = await createClient();

  // 1. Verifikasi user
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      success: false,
      productsCount: 0,
      contentsCount: 0,
      snapshotsCount: 0,
      templatesCount: 0,
      message: "Sesi habis, silakan login ulang.",
    };
  }

  const userId = user.id;

  try {
    const products = legacyData.products || [];
    const contents = legacyData.contents || [];
    const hooks = legacyData.hooks || [];
    const proofs = legacyData.proofs || [];
    const ctas = legacyData.ctas || [];

    // Hapus data lama user terlebih dahulu untuk full cut-over bersih
    await supabase.from("products").delete().eq("user_id", userId);
    await supabase.from("templates").delete().eq("user_id", userId);

    let productsCount = 0;
    let contentsCount = 0;
    let snapshotsCount = 0;
    let templatesCount = 0;

    // Map untuk mencatat UUID baru: oldProductId -> newProductUUID
    const productIdMap = new Map<string, string>();
    // Map untuk fallback pencarian berdasarkan nama produk
    const productNameMap = new Map<string, string>();

    // --- MIGRATION TAHAP 1: PRODUCTS ---
    if (products.length > 0) {
      const productsToInsert = products.map((p: any) => ({
        user_id: userId,
        nama: p.nama,
        brand: p.brand || "",
        jenis: p.jenis || "",
        harga: p.harga || 0,
        komisi: p.komisi || 0,
        kategori: p.kategori || "Umum",
        status: p.status || "aktif",
        label_prestasi: p.labelPrestasi || "-",
        gmv_aktif: p.gmvAktif || false,
      }));

      const { data: insertedProds, error: pErr } = await supabase
        .from("products")
        .insert(productsToInsert)
        .select("id, nama");

      if (pErr) throw pErr;

      insertedProds?.forEach((newP, idx) => {
        const oldP = products[idx];
        productIdMap.set(oldP.id, newP.id);
        productNameMap.set(newP.nama.toLowerCase(), newP.id);
        productsCount++;
      });
    }

    // --- MIGRATION TAHAP 2: CONTENTS & SNAPSHOTS ---
    if (contents.length > 0) {
      const contentsToInsert: any[] = [];
      const snapshotsToInsert: any[] = [];

      contents.forEach((c: any) => {
        // Cari UUID produk baru
        let prodId: string | null = productIdMap.get(c.produk) || null; // coba match by old ID jika content menyimpan ref ID
        if (!prodId && c.produk) {
          prodId = productNameMap.get(c.produk.toLowerCase()) || null; // fallback by name match
        }

        const contentId = crypto.randomUUID();
        const isoDate = c.tanggal ? new Date(c.tanggal).toISOString() : new Date().toISOString();

        contentsToInsert.push({
          id: contentId,
          user_id: userId,
          product_id: prodId,
          desc_text: c.desc || "",
          tanggal_upload: isoDate,
          durasi: parseInt(c.durasi) || 0,
          views: c.views || 0,
          ctr: c.ctr || 0,
          ctor: c.ctor || 0,
          items_sold: c.itemsSold || 0,
          gmv: c.gmv || 0,
          est_komisi: c.estK || 0,
        });

        // Map periodSnapshots
        const snaps = c.periodSnapshots || [];
        snaps.forEach((snap: any) => {
          snapshotsToInsert.push({
            content_id: contentId,
            user_id: userId,
            period_start: snap.pStart ? new Date(snap.pStart).toISOString() : isoDate,
            period_end: snap.pEnd ? new Date(snap.pEnd).toISOString() : isoDate,
            views: snap.views || 0,
            ctr: snap.ctr || 0,
            ctor: snap.ctor || 0,
            items_sold: snap.itemsSold || 0,
            gmv: snap.gmv || 0,
          });
          snapshotsCount++;
        });

        contentsCount++;
      });

      // Insert contents
      if (contentsToInsert.length > 0) {
        const { error: cErr } = await supabase.from("contents").insert(contentsToInsert);
        if (cErr) throw cErr;
      }

      // Insert snapshots
      if (snapshotsToInsert.length > 0) {
        const { error: sErr } = await supabase.from("period_snapshots").insert(snapshotsToInsert);
        if (sErr) throw sErr;
      }
    }

    // --- MIGRATION TAHAP 3: TEMPLATES (HOOK, PROOF, CTA) ---
    const templatesToInsert: any[] = [];
    hooks.forEach((h: any) => {
      templatesToInsert.push({ user_id: userId, type: "hook", content: h.txt, kategori: h.kategori || "Umum" });
      templatesCount++;
    });
    proofs.forEach((p: any) => {
      templatesToInsert.push({ user_id: userId, type: "proof", content: p.txt, kategori: p.kategori || "Umum" });
      templatesCount++;
    });
    ctas.forEach((c: any) => {
      templatesToInsert.push({ user_id: userId, type: "cta", content: c.txt, kategori: c.kategori || "Umum" });
      templatesCount++;
    });

    if (templatesToInsert.length > 0) {
      const { error: tErr } = await supabase.from("templates").insert(templatesToInsert);
      if (tErr) throw tErr;
    }

    // --- MIGRATION TAHAP 4: RECALCULATE SCORING ---
    const { data: updatedProducts } = await supabase
      .from("products")
      .select("*")
      .eq("user_id", userId);

    const { data: updatedContents } = await supabase
      .from("contents")
      .select("*, period_snapshots(*)")
      .eq("user_id", userId);

    if (updatedProducts && updatedContents) {
      const statsMap = recomputeProductStats(
        updatedProducts as unknown as Product[],
        updatedContents as unknown as (Content & { period_snapshots?: PeriodSnapshot[] })[]
      );

      const hasCommerce = updatedProducts.filter(
        (p) =>
          (statsMap[p.id]?.avgCTR || 0) > 0 ||
          (statsMap[p.id]?.avgCTOR || 0) > 0 ||
          (statsMap[p.id]?.totalItemsSold || 0) > 0
      ).length;

      const activeScoringMode = hasCommerce >= 3 ? "topsis" : "benchmark";

      if (activeScoringMode === "topsis") {
        scoreTOPSIS(updatedProducts as unknown as Product[], statsMap);
        updatedProducts.forEach((p) => {
          computeCompositeScore(p as unknown as Product, statsMap[p.id]);
        });
      } else {
        scoreBenchmark(updatedProducts as unknown as Product[], statsMap);
      }

      for (const p of updatedProducts) {
        const pStats = statsMap[p.id];
        const klas = classifyP(p as unknown as Product, pStats, activeScoringMode);
        const slot = slotR(klas);

        await supabase
          .from("products")
          .update({
            bench_score: p.bench_score,
            topsis_score: p.topsis_score,
            klasifikasi: klas,
            slot_rek: slot,
            score_mode: activeScoringMode,
            gmv_aktif: pStats.gmv_aktif,
          })
          .eq("id", p.id);
      }
    }

    return {
      success: true,
      productsCount,
      contentsCount,
      snapshotsCount,
      templatesCount,
      message: "Migrasi sukses! Data v2.5 berhasil dipetakan ke skema database baru.",
    };
  } catch (err: any) {
    return {
      success: false,
      productsCount: 0,
      contentsCount: 0,
      snapshotsCount: 0,
      templatesCount: 0,
      message: `Terjadi kesalahan saat memproses migrasi: ${err.message}`,
    };
  }
}
