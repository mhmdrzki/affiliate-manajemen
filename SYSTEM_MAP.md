<!--
Tujuan: Kompas Navigasi & Arsitektur Utama (Next.js v16 + Supabase v3.0)
Caller: AI Coding Assistant (Antigravity), Pengembang Manusia (awal sesi)
Dependensi: app/**/*.tsx, app/actions/*.ts, lib/supabase/*.ts
Main Functions: Menyediakan peta struktur berkas, alur data backend/frontend, dan skema database.
Side Effects: Tidak ada side effects runtime.
-->
# SYSTEM_MAP.md — AffiliateOS Next.js & Supabase Navigation Map (v3.0)

Peta arsitektur ini berfungsi sebagai kompas navigasi utama di awal sesi untuk mengontrol pemahaman struktur file baru dan interaksi database.

---

## 1. Project Summary

* **Tujuan Aplikasi**: Aplikasi pemantau analitik performa kreator afiliasi TikTok Shop berbasis Next.js, mencakup evaluasi scoring produk (SAW/TOPSIS), generator jadwal round-robin, pengelola naskah AI, dan template Hook/Proof/CTA.
* **Tech Stack**: Next.js 16 (App Router), React 19, Supabase (PostgreSQL + RLS), Tailwind CSS v4, Lucide React, Zustand.
* **Arsitektur**: Full-stack Next.js dengan Server Actions untuk modifikasi data, client-side React components untuk interaktivitas premium, dan Supabase Auth/Database sebagai backend.

---

## 2. Core Logic Flow (Next.js)

* **Autentikasi**: `app/(auth)/login` & `register` ➔ Supabase Auth ➔ JWT Cookies ➔ Checked by `middleware.ts`.
* **Dashboard Utama**: Rute `/` (`app/page.tsx`) ➔ Fetch `products` & `contents` dari Supabase ➔ Kalkulasi live metrics `recomputeProductStats()` & `detectAnomalies()` ➔ Render visual.
* **Master Produk**: Rute `/products` (`app/(dashboard)/products/page.tsx`) ➔ Fetch master produk ➔ Render tabel interaktif status & form tambah produk.
* **Impor Data**: Rute `/import` ➔ XLSX/CSV parsed client-side ➔ Server Action `importAnalyticsAction` ➔ Simpan data contents & recalculate scoring ➔ Redireksi dashboard.
* **Migrasi Data**: Rute `/migrate` ➔ JSON file upload ➔ Server Action `migrateLegacyDataAction` ➔ Reset data & insert bulk ke Supabase.

---

## 3. Clean Tree

```
affiliate-manajemen/
├── app/
│   ├── (auth)/             # Login & Register routes
│   ├── (dashboard)/        # Layout dashboard & sub-pages
│   │   ├── import/         # Halaman uploader XLSX/CSV
│   │   ├── migrate/        # Halaman uploader cadangan JSON v2.5
│   │   ├── products/       # Halaman master produk (tabel & kontrol status/tambah)
│   │   ├── schedule/       # Halaman penjadwalan cerdas (Round-Robin generator)
│   │   ├── scripts/        # Halaman AI Script Generator (Gemini Integration)
│   │   ├── settings/       # Halaman pengaturan API Key & Profil
│   │   └── templates/      # Halaman bank template naskah (Hooks, Proofs, CTAs)
│   ├── actions/            # Next.js Server Actions
│   │   ├── import.ts       # Aksi parsing spreadsheet & update database
│   │   ├── migrate.ts      # Aksi dump data JSON lama ke database baru
│   │   ├── products.ts     # Aksi tambah produk & update status produk
│   │   ├── schedule.ts     # Aksi generate, load, dan hapus jadwal konten
│   │   ├── settings.ts     # Aksi pembaruan pengaturan profil & skoring
│   │   └── templates.ts    # Aksi kelola template naskah (get, add, delete, reset)
│   ├── api/                # API Route Handlers (Gemini API)
│   ├── globals.css         # Tailwind v4 Entry & Custom CSS
│   ├── layout.tsx          # Root Layout HTML
│   └── page.tsx            # Dashboard Analytics
├── components/             # Reusable UI Components
│   ├── layout/             # Sidebar & Topbar
│   ├── products/           # Interactive components for products page
│   ├── scripts/            # Interactive components for scripts page (ScriptGeneratorClient)
│   └── templates/          # Interactive components for templates page (AddTemplateDialog)
├── lib/                    # Helpers, Engines, & Client Inits
│   ├── schedule/           # Algoritma penjadwalan cerdas
│   ├── scoring/            # Engine scoring TOPSIS/SAW & anomalies
│   ├── supabase/           # Supabase Client & Server initializers
│   └── utils/              # Data formatters & Excel parsers
├── supabase/
│   └── migrations/         # PostgreSQL DB Schemas (RLS, Indexes)
├── types/                  # TypeScript interface definitions (types/index.ts)
└── SYSTEM_MAP.md           # Berkas ini (Kompas Navigasi)
```

---

## 4. Module Map (Backend Actions & Libs)

1. **`app/actions/products.ts`**: Server Actions untuk manajemen master produk.
   * *Fungsi*: `createProductAction()`, `updateProductStatusAction()`, `saveProductDescVariantAction()`, `updateProductAction()`, `deleteProductAction()`.
2. **`app/actions/import.ts`**: Server Actions pengolahan Excel analitik.
   * *Fungsi*: `importAnalyticsAction()`.
3. **`app/actions/migrate.ts`**: Server Actions migrasi dari v2.5.
   * *Fungsi*: `migrateLegacyDataAction()`.
4. **`lib/scoring/engine.ts`**: Algoritma skoring SAW & TOPSIS.
   * *Fungsi*: `recomputeProductStats()`, `scoreBenchmark()`, `scoreTOPSIS()`, `computeCompositeScore()`, `classifyP()`.
5. **`lib/scoring/anomalies.ts`**: Deteksi anomali performa produk.
   * *Fungsi*: `detectAnomalies()`.
6. **`app/actions/templates.ts`**: Server Actions untuk pengelolaan bank template naskah video.
   * *Fungsi*: `getTemplatesAction()`, `addTemplateAction()`, `deleteTemplateAction()`, `resetTemplatesToDefaultAction()`.
7. **`app/actions/schedule.ts`**: Server Actions untuk kalkulasi dan penyimpanan jadwal konten cerdas.
   * *Fungsi*: `getSchedulesAction()`, `deleteScheduleAction()`, `generateAndSaveScheduleAction()`.
8. **`app/actions/settings.ts`**: Server Actions untuk pembaruan profil pengguna.
   * *Fungsi*: `updateProfileAction()`.
