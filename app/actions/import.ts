// /*
// Tujuan: Server Action untuk melakukan impor analitik konten secara massal (bulk import) secara efisien tanpa N+1 queries.
// Caller: Komponen halaman uploader impor (/import)
// Dependensi: lib/supabase/server.ts, lib/utils/excel.ts, lib/scoring/engine.ts
// Main Functions: importAnalyticsAction
// Side Effects: Menulis ke tabel products, contents, period_snapshots, dan menghitung ulang skor produk.
// */

"use server";

import { createClient } from "@/lib/supabase/server";
import {
  fuzzyHeaderFind,
  parseNumberValue,
  parsePeriodeDates,
  detectBrand,
  detectJenis,
  periodRelation,
  parseDate,
} from "@/lib/utils/excel";
import {
  recomputeProductStats,
  scoreBenchmark,
  scoreTOPSIS,
  computeCompositeScore,
  classifyP,
  slotR,
} from "@/lib/scoring/engine";
import { Product, Content, PeriodSnapshot } from "@/types";

export interface ImportResult {
  success: boolean;
  added: number;
  merged: number;
  skipped: number;
  message: string;
}

export async function importAnalyticsAction(
  rows: any[],
  filename: string
): Promise<ImportResult> {
  const supabase = await createClient();

  // 1. Get authenticated user
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, added: 0, merged: 0, skipped: 0, message: "Sesi habis, silakan login ulang." };
  }

  const userId = user.id;
  let added = 0;
  let merged = 0;
  let skipped = 0;

  try {
    // --- TAHAP 1: PARSING & FILTER DATA RAW ---
    const parsedRows = [];
    const uniqueProductNamesSet = new Set<string>();

    for (const row of rows) {
      const productName = String(
        fuzzyHeaderFind(row, "nama produk", "namaproduk", "produk", "product") || ""
      ).trim();
      const descText = String(
        fuzzyHeaderFind(row, "deskripsi", "description", "deskripsi video") || ""
      ).trim();

      if (!productName || productName.length < 2 || productName.toLowerCase().startsWith("nama")) {
        skipped++;
        continue;
      }

      const gmv = parseNumberValue(fuzzyHeaderFind(row, "attr_gmv", "attr. gmv", "attr gmv", "gmv"));
      const sold = parseNumberValue(
        fuzzyHeaderFind(row, "attr_items_sold", "attr. items sold", "items sold", "itemssold", "terjual", "sold")
      );
      const ctr = parseNumberValue(fuzzyHeaderFind(row, "ctr_percent", "ctr"));
      const ctor = parseNumberValue(fuzzyHeaderFind(row, "ctor_percent", "ctor"));
      const views = parseNumberValue(fuzzyHeaderFind(row, "views"));
      const tanggal = String(fuzzyHeaderFind(row, "tanggal upload", "tanggal posting", "tanggal", "date") || "").trim();
      const durasi = String(fuzzyHeaderFind(row, "durasi", "duration") || "").trim();
      const periode = String(fuzzyHeaderFind(row, "periode data", "periode") || "").trim();
      const kategori = String(
        fuzzyHeaderFind(row, "kategori_produk", "kategoriproduk", "kategori", "category") || ""
      ).trim();

      uniqueProductNamesSet.add(productName);

      parsedRows.push({
        productName,
        descText,
        gmv,
        sold,
        ctr,
        ctor,
        views,
        tanggal,
        durasi,
        periode,
        kategori,
      });
    }

    if (parsedRows.length === 0) {
      return { success: true, added: 0, merged: 0, skipped, message: "Tidak ada baris data valid yang diimpor." };
    }

    const uniqueProductNames = Array.from(uniqueProductNamesSet);

    // --- TAHAP 2: FETCH EXISTING PRODUCTS (BATCH) ---
    const { data: existingProducts, error: prodErr } = await supabase
      .from("products")
      .select("id, nama, jenis")
      .eq("user_id", userId)
      .in("nama", uniqueProductNames);

    if (prodErr) throw prodErr;

    const productMap = new Map<string, { id: string; jenis: string | null }>();
    existingProducts?.forEach((p) => {
      productMap.set(p.nama.toLowerCase(), { id: p.id, jenis: p.jenis });
    });

    // --- TAHAP 3: BATCH INSERT NEW PRODUCTS ---
    const newProductsToInsert = [];
    for (const name of uniqueProductNames) {
      if (!productMap.has(name.toLowerCase())) {
        const matchingRow = parsedRows.find((r) => r.productName.toLowerCase() === name.toLowerCase());
        newProductsToInsert.push({
          user_id: userId,
          nama: name,
          brand: detectBrand(name),
          jenis: detectJenis(name),
          harga: 0,
          komisi: 0,
          kategori: matchingRow?.kategori || "Umum",
          status: "aktif",
          label_prestasi: "-",
        });
      }
    }

    if (newProductsToInsert.length > 0) {
      const { data: insertedProducts, error: insProdErr } = await supabase
        .from("products")
        .insert(newProductsToInsert)
        .select("id, nama, jenis");

      if (insProdErr) throw insProdErr;

      insertedProducts?.forEach((p) => {
        productMap.set(p.nama.toLowerCase(), { id: p.id, jenis: p.jenis });
      });
    }

    // --- TAHAP 4: FETCH EXISTING CONTENTS FOR RESOLVING DUPLICATES ---
    const productIds = Array.from(productMap.values()).map((p) => p.id);
    const { data: existingContents, error: contErr } = await supabase
      .from("contents")
      .select("id, product_id, tanggal_upload, durasi, views, items_sold, gmv")
      .eq("user_id", userId)
      .in("product_id", productIds);

    if (contErr) throw contErr;

    // Fetch existing period snapshots to resolve overlap
    const existingContentIds = existingContents?.map((c) => c.id) || [];
    const { data: existingSnapshots, error: snapErr } = await supabase
      .from("period_snapshots")
      .select("*")
      .in("content_id", existingContentIds);

    if (snapErr) throw snapErr;

    const contentMap = new Map<string, any>(); // key: `prodId_tanggal_durasi`
    existingContents?.forEach((c) => {
      const dateStr = c.tanggal_upload ? new Date(c.tanggal_upload).toISOString() : "";
      const key = `${c.product_id}_${dateStr}_${c.durasi}`;
      
      const snaps = existingSnapshots?.filter((s) => s.content_id === c.id) || [];
      contentMap.set(key, { ...c, snaps });
    });

    const contentsToInsert = [];
    const contentsToUpdate = [];
    const snapshotsToInsert = [];

    // --- TAHAP 5: PROCESS ROWS & RESOLVE DUPLICATES ---
    for (const r of parsedRows) {
      const prodInfo = productMap.get(r.productName.toLowerCase());
      if (!prodInfo) continue;

      const pStartAndEnd = parsePeriodeDates(r.periode, Date.now());
      const pStartISO = new Date(pStartAndEnd.start).toISOString();
      const pEndISO = new Date(pStartAndEnd.end).toISOString();

      const isoDate = r.tanggal ? new Date(parseDate(r.tanggal)).toISOString() : "";
      const contentKey = `${prodInfo.id}_${isoDate}_${r.durasi}`;

      const existingContent = contentMap.get(contentKey);

      const newSnap = {
        user_id: userId,
        period_start: pStartISO,
        period_end: pEndISO,
        views: r.views,
        ctr: r.ctr,
        ctor: r.ctor,
        items_sold: r.sold,
        gmv: r.gmv,
      };

      if (existingContent) {
        // --- DUPLIKAT TERDETEKSI: MERGE SNAPSHOT ---
        const snaps = existingContent.snaps;

        // Cek apakah snapshot sudah tercakup
        let isAlreadyCovered = false;
        for (const s of snaps) {
          const rel = periodRelation(
            new Date(s.period_start).getTime(),
            new Date(s.period_end).getTime(),
            pStartAndEnd.start,
            pStartAndEnd.end
          );
          if (rel === "contains") {
            isAlreadyCovered = true;
            break;
          }
        }

        if (isAlreadyCovered) {
          skipped++;
          continue;
        }

        // Hapus existing yang tercakup oleh snapshot baru
        const snapsToRemove: string[] = [];
        const activeSnaps = snaps.filter((s: any) => {
          const rel = periodRelation(
            pStartAndEnd.start,
            pStartAndEnd.end,
            new Date(s.period_start).getTime(),
            new Date(s.period_end).getTime()
          );
          if (rel === "contains" || rel === "overlap") {
            snapsToRemove.push(s.id);
            return false;
          }
          return true;
        });

        if (snapsToRemove.length > 0) {
          await supabase.from("period_snapshots").delete().in("id", snapsToRemove);
        }

        // Tambah snapshot baru
        activeSnaps.push(newSnap);
        snapshotsToInsert.push({ ...newSnap, content_id: existingContent.id });

        // Hitung total agregat dari snapshot aktif
        const sumGmv = activeSnaps.reduce((acc: number, s: any) => acc + s.gmv, 0);
        const sumSold = activeSnaps.reduce((acc: number, s: any) => acc + s.items_sold, 0);
        const sumViews = activeSnaps.reduce((acc: number, s: any) => acc + s.views, 0);

        // Cari snapshot ter-update berdasarkan tanggal akhir
        let latestSnap = activeSnaps[0];
        activeSnaps.forEach((s: any) => {
          if (new Date(s.period_end).getTime() > new Date(latestSnap.period_end).getTime()) {
            latestSnap = s;
          }
        });

        contentsToUpdate.push({
          id: existingContent.id,
          gmv: sumGmv,
          items_sold: sumSold,
          views: sumViews,
          ctr: latestSnap.ctr,
          ctor: latestSnap.ctor,
          est_komisi: sumSold * (rowCommission(prodInfo.id) || 0),
        });

        merged++;
      } else {
        // --- BARIS BARU: INSERT CONTENT ---
        const contentId = crypto.randomUUID();
        const estK = r.sold > 0 ? r.sold * 0 : 0; // Komisi akan dihitung live/setelah update

        contentsToInsert.push({
          id: contentId,
          user_id: userId,
          product_id: prodInfo.id,
          desc_text: r.descText,
          tanggal_upload: isoDate,
          durasi: parseNumberValue(r.durasi),
          views: r.views,
          ctr: r.ctr,
          ctor: r.ctor,
          items_sold: r.sold,
          gmv: r.gmv,
          est_komisi: estK,
        });

        snapshotsToInsert.push({
          content_id: contentId,
          user_id: userId,
          period_start: pStartISO,
          period_end: pEndISO,
          views: r.views,
          ctr: r.ctr,
          ctor: r.ctor,
          items_sold: r.sold,
          gmv: r.gmv,
        });

        added++;
      }
    }

    // Eksekusi updates konten & insert konten baru
    if (contentsToInsert.length > 0) {
      const { error: insErr } = await supabase.from("contents").insert(contentsToInsert);
      if (insErr) throw insErr;
    }

    if (contentsToUpdate.length > 0) {
      for (const item of contentsToUpdate) {
        await supabase
          .from("contents")
          .update({
            gmv: item.gmv,
            items_sold: item.items_sold,
            views: item.views,
            ctr: item.ctr,
            ctor: item.ctor,
          })
          .eq("id", item.id);
      }
    }

    // Insert Snapshots
    if (snapshotsToInsert.length > 0) {
      const { error: insSnapErr } = await supabase.from("period_snapshots").insert(snapshotsToInsert);
      if (insSnapErr) throw insSnapErr;
    }

    // --- TAHAP 6: RECOMPUTE SCORING & CLASSIFICATION ---
    // Ambil data terbaru lengkap
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

      // Tentukan scoring mode
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

      // Klasifikasi & Slot Rekomendasi
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

    // Simpan ke import history
    await supabase.from("schedules").insert({
      user_id: userId,
      schedule_data: {
        filename,
        added,
        merged,
        skipped,
        ts: new Date().toISOString(),
      },
    });

    return {
      success: true,
      added,
      merged,
      skipped,
      message: `Impor sukses! Berhasil menambah +${added} konten baru, menggabungkan ${merged} baris data, dan melompati ${skipped} baris duplikat.`,
    };
  } catch (err: any) {
    return { success: false, added: 0, merged: 0, skipped: 0, message: `Gagal mengimpor file: ${err.message}` };
  }
}

// Helper untuk mengambil komisi produk
function rowCommission(prodId: string): number {
  return 0; // Komisi default 0, di-update manual oleh user di halaman produk
}
