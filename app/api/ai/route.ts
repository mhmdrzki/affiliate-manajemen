// /*
// Tujuan: Route Handler API (Server-Side Proxy) aman untuk memanggil Google Gemini API menggunakan API key yang tersimpan di environment server atau profil pengguna di SQLite lokal.
// Caller: Komponen Script Generator (/scripts), Detail Produk (/products/[id])
// Dependensi: next/server, lib/db/index.ts, lib/supabase/server.ts, GEMINI_API_KEY
// Main Functions: POST
// Side Effects: Melakukan fetch request HTTP keluar ke Google Gemini API.
// */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { profiles } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // 1. Verifikasi sesi user secara server-side
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized. Silakan login terlebih dahulu." },
        { status: 401 }
      );
    }

    const { prompt, maxTokens = 1000, temperature = 0.8 } = await request.json();

    if (!prompt) {
      return NextResponse.json(
        { error: "Prompt wajib diisi." },
        { status: 400 }
      );
    }

    // 2. Cari custom API key dari profil pengguna di database SQLite lokal
    const profile = await db
      .select({ gemini_api_key_encrypted: profiles.gemini_api_key_encrypted })
      .from(profiles)
      .where(eq(profiles.id, user.id))
      .then(rows => rows[0]);

    let apiKey = profile?.gemini_api_key_encrypted || process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            "API Key Gemini tidak dikonfigurasi. Silakan tambahkan API Key Anda sendiri di menu Pengaturan.",
        },
        { status: 400 }
      );
    }

    // 3. Request ke Google Gemini API (menggunakan model stabil gemini-2.5-flash)
    const model = "gemini-2.5-flash";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const geminiResponse = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          maxOutputTokens: maxTokens,
          temperature: temperature,
        },
      }),
    });

    if (!geminiResponse.ok) {
      let errDetail = "";
      try {
        const errJson = await geminiResponse.json();
        errDetail = errJson.error?.message || "";
      } catch (e) {}

      return NextResponse.json(
        { error: `Google Gemini API Error: ${errDetail || geminiResponse.statusText}` },
        { status: geminiResponse.status }
      );
    }

    const data = await geminiResponse.json();
    const rawResult =
      data.candidates?.[0]?.content?.parts?.map((p: any) => p.text || "").join("") || "";
    
    // Hilangkan formatting markdown JSON block jika ada
    const cleanResult = rawResult.replace(/```json|```/g, "").trim();

    return NextResponse.json({ result: cleanResult });
  } catch (error: any) {
    return NextResponse.json(
      { error: `Terjadi kesalahan internal: ${error.message}` },
      { status: 500 }
    );
  }
}
