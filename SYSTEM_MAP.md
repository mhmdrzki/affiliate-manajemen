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

* **Tujuan Aplikasi**: Halaman analitik performa kreator afiliasi TikTok Shop khusus lokal & privat, mencakup scoring produk (SAW/TOPSIS/Regularity), generator jadwal cerdas, pengelola naskah AI, dan template Hook/Proof/CTA.
* **Tech Stack**: Next.js 16 (App Router), React 19, SQLite (local.db via better-sqlite3), Drizzle ORM, Tailwind CSS v4, Lucide React, Zustand.
* **Arsitektur**: Full-stack Next.js lokal dengan Server Actions untuk modifikasi data langsung ke file database SQLite lokal (`local.db`), komponen React interaktif, serta sesi single-user termok.

---

## 2. Core Logic Flow (Next.js)

* **Autentikasi**: Single-User Mode (Sesi offline statis termok di `lib/supabase/` & bypass di `middleware.ts` untuk langsung ke dashboard).
* **Dashboard Utama**: Rute `/` (`app/page.tsx`) ➔ Fetch `products` & `orders` langsung dari SQLite via Drizzle ➔ Kalkulasi live metrics `computeOrderBasedStats()` & `detectAnomalies()` ➔ Render visual.
* **Master Produk**: Rute `/products` (`app/(dashboard)/products/page.tsx`) ➔ Fetch master produk dari SQLite ➔ Render tabel interaktif status & form tambah produk.
* **Impor Data**: Rute `/import` ➔ XLSX/CSV parsed client-side ➔ Server Action `importAffiliateOrdersAction` ➔ Simpan data orders & recalculate scoring ke SQLite ➔ Redireksi dashboard.
* **Migrasi Data**: Rute `/migrate` ➔ JSON file upload ➔ Server Action `migrateLegacyDataAction` ➔ Reset data & insert bulk ke SQLite.

---

## 3. Clean Tree

```
affiliate-manajemen/
├── app/
│   ├── (auth)/             # Login & Register routes
│   ├── (dashboard)/        # Layout dashboard & sub-pages
│   │   ├── import/         # Halaman uploader XLSX/CSV (TikTok orders)
│   │   ├── migrate/        # Halaman uploader cadangan JSON v2.5
│   │   ├── products/       # Halaman master produk (tabel & kontrol status/tambah)
│   │   ├── schedule/       # Halaman penjadwalan cerdas (Round-Robin generator)
│   │   ├── scripts/        # Halaman AI Script Generator (Gemini Integration)
│   │   ├── settings/       # Halaman pengaturan API Key & Profil
│   │   └── templates/      # Halaman bank template naskah (Hooks, Proofs, CTAs)
│   ├── actions/            # Next.js Server Actions
│   │   ├── contents.ts     # Aksi memperbarui relasi produk pada konten [NEW]
│   │   ├── import.ts       # Aksi parsing spreadsheet & update database (legacy wrapper)
│   │   ├── import-orders.ts # Aksi utama pemrosesan rekap pesanan TikTok & update DB
│   │   ├── migrate.ts      # Aksi dump data JSON lama ke database baru
│   │   ├── products.ts     # Aksi tambah produk & update status produk
│   │   ├── schedule.ts     # Aksi generate, load, dan hapus jadwal konten
│   │   ├── settings.ts     # Aksi pembaruan pengaturan profil & skoring
│   │   └── templates.ts    # Aksi kelola template naskah (get, add, delete, reset)
│   ├── api/                # API Route Handlers (Gemini API & Scraper API)
│   ├── globals.css         # Tailwind v4 Entry & Custom CSS
│   ├── layout.tsx          # Root Layout HTML
│   └── page.tsx            # Dashboard Analytics
├── components/             # Reusable UI Components
│   ├── layout/             # Sidebar & Topbar
│   ├── import/             # Interactive components for import page (ImportUploader, ImportHistoryList)
│   ├── history/            # Interactive components for history page (ProductSelector, ContentHistoryTable, ScraperPanel) [NEW]
│   ├── products/           # Interactive components for products page (Add, Edit, Status, ProductTable)
│   ├── scripts/            # Interactive components for scripts page (ScriptGeneratorClient)
│   └── templates/          # Interactive components for templates page (AddTemplateDialog)
├── lib/                    # Helpers, Engines, & Client Inits
│   ├── db/                 # Setup database SQLite lokal & Drizzle Schema [NEW]
│   ├── schedule/           # Algoritma penjadwalan cerdas proporsional
│   ├── scoring/            # Engine scoring regularity, TOPSIS & anomalies
│   ├── supabase/           # Mocked client & server auth session [MOCKED]
│   └── utils/              # Data formatters & Excel parsers
├── drizzle/                # Hasil migrasi skema Drizzle [NEW]
├── drizzle.config.ts       # Konfigurasi Drizzle ORM [NEW]
├── local.db                # File database SQLite lokal [NEW]
├── types/                  # TypeScript interface definitions (types/index.ts)
└── SYSTEM_MAP.md           # Berkas ini (Kompas Navigasi)
```

---

## 4. Module Map (Backend Actions & Libs)

1. **`app/actions/products.ts`**: Server Actions untuk manajemen master produk.
   * *Fungsi*: `createProductAction()`, `updateProductStatusAction()`, `saveProductDescVariantAction()`, `updateProductAction()`, `deleteProductAction()`, `deleteProductsBulkAction()`.
2. **`app/actions/import-orders.ts`**: Server Actions pengolahan Excel analitik rekap pesanan TikTok.
   * *Fungsi*: `importAffiliateOrdersAction()`, `getImportLogsAction()`, `deleteImportLogAction()`, `recomputeProductAndContentMetrics()`.
3. **`app/actions/migrate.ts`**: Server Actions migrasi dari v2.5.
   * *Fungsi*: `migrateLegacyDataAction()`.
4. **`lib/scoring/engine.ts`**: Algoritma skoring Regularity, TOPSIS, dan Kuota.
   * *Fungsi*: `computeOrderBasedStats()`, `computeCompositeScore()`, `classifyProduct()`, `calcWeeklyQuota()`, `generateRecommendation()`, `recomputeFromOrders()`.
5. **`lib/scoring/anomalies.ts`**: Deteksi anomali performa produk berdasarkan pesanan detail.
   * *Fungsi*: `detectAnomalies()`.
6. **`app/actions/templates.ts`**: Server Actions untuk pengelolaan bank template naskah video.
   * *Fungsi*: `getTemplatesAction()`, `addTemplateAction()`, `deleteTemplateAction()`, `resetTemplatesToDefaultAction()`.
7. **`app/actions/schedule.ts`**: Server Actions untuk kalkulasi dan penyimpanan jadwal konten cerdas.
   * *Fungsi*: `getSchedulesAction()`, `deleteScheduleAction()`, `generateAndSaveScheduleAction()`.
8. **`app/actions/settings.ts`**: Server Actions untuk pembaruan profil pengguna.
   * *Fungsi*: `updateProfileAction()`.
9. **`app/actions/contents.ts`**: Server Actions untuk manajemen riwayat konten.
   * *Fungsi*: `updateContentProductIdAction()`.
