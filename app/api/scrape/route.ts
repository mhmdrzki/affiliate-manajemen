// /*
// Tujuan: API Route Handler untuk memicu scraper TikTok via python subprocess, dan menyimpan metrik interaksi (engagement) ke SQLite lokal.
// Caller: Komponen Scheduler / Dashboard UI
// Dependensi: child_process (exec), lib/db/index.ts, lib/supabase/server.ts, tiktok_affiliate_scraper_v2.py
// Main Functions: POST
// Side Effects: Menjalankan skrip Python di system server, memperbarui data tabel `contents` di SQLite lokal.
// */

import { NextRequest, NextResponse } from "next/server";
import { exec } from "child_process";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { contents } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { parseTikTokDate } from "@/lib/utils/excel";
import path from "path";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();

    // 1. Verifikasi Auth
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const { username, days } = await req.json();

    if (!username) {
      return NextResponse.json({ success: false, message: "Username TikTok wajib diisi." }, { status: 400 });
    }

    const rentangHari = parseInt(days) || 1;
    const projectDir = process.cwd();
    const scraperPath = path.join(projectDir, "tiktok_affiliate_scraper_v2.py");

    // Exec python script
    const cmd = `python3 "${scraperPath}" --username "${username}" --days ${rentangHari} --json`;

    return new Promise<NextResponse>((resolve) => {
      exec(cmd, async (error, stdout, stderr) => {
        if (error) {
          console.error("Scraper subprocess error:", error);
          console.error("Scraper stderr:", stderr);
          resolve(
            NextResponse.json(
              {
                success: false,
                message: `Gagal menjalankan scraper: ${error.message}. Pastikan python3 dan dependencies (yt-dlp, pandas, openpyxl) terinstall.`,
                stderr
              },
              { status: 500 }
            )
          );
          return;
        }

        try {
          const scrapedVideos = JSON.parse(stdout.trim());
          if (!Array.isArray(scrapedVideos)) {
            throw new Error("Format output scraper tidak valid.");
          }

          let insertedCount = 0;
          let updatedCount = 0;

          for (const vid of scrapedVideos) {
            const tiktokContentId = String(vid["Konten ID"] || "").trim();
            if (!tiktokContentId) continue;

            const dateStr = `${vid["Tanggal Upload"]} ${vid["Jam Upload"]}:00`;
            const uploadDate = parseTikTokDate(dateStr) || new Date().toISOString();

            // Cek existing content di SQLite lokal
            const existingContent = await db
              .select({ id: contents.id })
              .from(contents)
              .where(and(eq(contents.user_id, user.id), eq(contents.tiktok_content_id, tiktokContentId)))
              .then(rows => rows[0]);

            if (existingContent) {
              await db
                .update(contents)
                .set({
                  desc_text: vid["Deskripsi"],
                  durasi: parseInt(vid["Durasi (detik)"]) || 0,
                  views: parseInt(vid["Views"]) || 0,
                  likes: parseInt(vid["Likes"]) || 0,
                  comments: parseInt(vid["Komentar"]) || 0,
                  shares: parseInt(vid["Share"]) || 0,
                  link_video: vid["Link Video"],
                  tanggal_upload: uploadDate,
                })
                .where(eq(contents.id, existingContent.id));

              updatedCount++;
            } else {
              await db.insert(contents).values({
                id: crypto.randomUUID(),
                user_id: user.id,
                tiktok_content_id: tiktokContentId,
                content_type: "Video",
                desc_text: vid["Deskripsi"],
                durasi: parseInt(vid["Durasi (detik)"]) || 0,
                views: parseInt(vid["Views"]) || 0,
                likes: parseInt(vid["Likes"]) || 0,
                comments: parseInt(vid["Komentar"]) || 0,
                shares: parseInt(vid["Share"]) || 0,
                link_video: vid["Link Video"],
                tanggal_upload: uploadDate,
                created_at: new Date().toISOString(),
              });

              insertedCount++;
            }
          }

          resolve(
            NextResponse.json({
              success: true,
              message: `Scraping selesai! Berhasil menambahkan +${insertedCount} video baru dan memperbarui ${updatedCount} metrik video.`,
              data: {
                scrapedCount: scrapedVideos.length,
                insertedCount,
                updatedCount
              }
            })
          );
        } catch (err: any) {
          console.error("Scraper JSON parse / DB save error:", err);
          resolve(
            NextResponse.json(
              {
                success: false,
                message: `Gagal memproses hasil scraping: ${err.message}. Output mentah: ${stdout.substring(0, 500)}`
              },
              { status: 500 }
            )
          );
        }
      });
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}

