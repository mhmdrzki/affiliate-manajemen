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
│   │   ├── schedule/       # Halaman penjadwalan cerdas (generator & tuning) [NEW]
│   │   ├── scripts/        # Halaman AI Script Generator (Gemini Integration)
│   │   ├── settings/       # Halaman pengaturan API Key & Profil
│   │   └── templates/      # Halaman bank template naskah (Hooks, Proofs, CTAs)
│   ├── actions/            # Next.js Server Actions
│   │   ├── contents.ts     # Aksi memperbarui relasi produk pada konten [NEW]
│   │   ├── import.ts       # Aksi parsing spreadsheet & update database (legacy wrapper)
│   │   ├── import-orders.ts # Aksi utama pemrosesan rekap pesanan TikTok & update DB
│   │   ├── import-products.ts # Aksi impor data master produk dengan de-duplikasi [NEW]
│   │   ├── migrate.ts      # Aksi dump data JSON lama ke database baru
│   │   ├── products.ts     # Aksi tambah produk & update status produk
│   │   ├── schedule.ts     # Aksi generate, load, dan hapus jadwal konten [NEW]
│   │   ├── settings.ts     # Aksi pembaruan pengaturan profil & skoring
│   │   └── templates.ts    # Aksi kelola template naskah (get, add, delete, reset)
│   ├── api/                # API Route Handlers (Gemini API & Scraper API)
│   ├── globals.css         # Tailwind v4 Entry & Custom CSS
│   ├── layout.tsx          # Root Layout HTML
│   └── page.tsx            # Dashboard Analytics
├── components/             # Reusable UI Components
│   ├── layout/             # Sidebar & Topbar
│   ├── import/             # Interactive components for import page
│   ├── history/            # Interactive components for history page
│   ├── products/           # Interactive components for products page
│   ├── scripts/            # Interactive components for scripts page
│   ├── templates/          # Interactive components for templates page
│   └── schedule/           # Komponen halaman jadwal (Generator, Card, Table, Params) [NEW]
├── lib/                    # Helpers, Engines, & Client Inits
│   ├── db/                 # Setup database SQLite lokal & Drizzle Schema [NEW]
│   ├── scoring/            # Engine scoring regularity, pool classification, & slot allocation [NEW]
│   ├── supabase/           # Mocked client & server auth session [MOCKED]
│   └── utils/              # Data formatters & Excel parsers
├── drizzle/                # Hasil migrasi skema Drizzle [NEW]
├── drizzle.config.ts       # Konfigurasi Drizzle ORM [NEW]
├── local.db                # File database SQLite lokal [NEW]
├── scripts/                # Kumpulan skrip utilitas CLI & pembaruan database [NEW]
├── types/                  # TypeScript interface definitions (types/index.ts)
└── SYSTEM_MAP.md           # Berkas ini (Kompas Navigasi)
```

---

## 4. Module Map (Backend Actions & Libs)

1. **`app/actions/products.ts`**: Server Actions untuk manajemen master produk.
   * *Fungsi*: `createProductAction()`, `updateProductStatusAction()`, `saveProductDescVariantAction()`, `updateProductAction()`, `updateProductsBulkAction()`, `deleteProductAction()`, `deleteProductsBulkAction()`, `resetProductTestingAction()`.
2. **`app/actions/import-orders.ts`**: Server Actions pengolahan Excel analitik rekap pesanan TikTok.
   * *Fungsi*: `importAffiliateOrdersAction()`, `getImportLogsAction()`, `deleteImportLogAction()`, `recomputeProductAndContentMetrics()`, `getAllFilteredOrdersAction()`.
3. **`lib/scoring/index.ts`**: Orkestrator utama skoring dan generator jadwal konten. Mendukung fitur "Estafet Rencana Masa Depan" — saat generate jadwal masa depan, membaca jadwal tersimpan sebagai riwayat virtual.
   * *Fungsi*: `generateDailySchedule()`, `generateWeeklySchedule()`, `loadParams()`, `loadSavedScheduleHistory()`.
4. **`lib/scoring/aggregator.ts`**: Modul agregator data order dan data konten per produk.
   * *Fungsi*: `aggregateProducts()`.
5. **`lib/scoring/engine.ts`**: Implementasi core filter keras, klasifikasi pool, formula skor Pool A & B, dan distribusi merata slot kolaborasi.
   * *Fungsi*: `filterKeras()`, `identifyCollaborationSlots()`, `classifyPools()`, `scorePoolA()`, `scorePoolB()`, `mergeAndRank()`.
6. **`lib/scoring/scheduler.ts`**: Modul alokator slot (7 slot) harian dengan distribusi proporsional per pool. Menggunakan Bresenham spacing untuk menyebar Pool B merata di antara Pool A.
   * *Fungsi*: `allocateSlots()`.
7. **`app/actions/schedule.ts`**: Server Actions manajemen data jadwal konten harian/mingguan dan parameter scoring.
   * *Fungsi*: `generateAndSaveScheduleAction()`, `getSchedulesAction()`, `deleteScheduleAction()`, `deleteScheduleRangeAction()`, `clearAllSchedulesAction()`, `getScoringParamsAction()`, `updateScoringParamsAction()`, `previewScoringAction()`.
8. **`app/actions/settings.ts`**: Server Actions untuk pembaruan profil pengguna.
   * *Fungsi*: `updateProfileAction()`.
9. **`app/actions/contents.ts`**: Server Actions untuk manajemen riwayat konten.
   * *Fungsi*: `updateContentProductIdAction()`, `deleteContentAction()`, `getContentsAction()`, `getAllFilteredContentsAction()`.
10. **`app/actions/import-products.ts`**: Server Actions untuk impor data master produk secara massal dari CSV/XLSX maupun ekstraksi link produk TikTok Shop. [NEW]
    * *Fungsi*: `importProductsAction()`.
11. **`app/actions/product-ranking.ts`**: Server Action untuk ranking produk berdasarkan total items sold dalam rentang waktu tertentu. [NEW]
    * *Fungsi*: `getProductRankingAction()`.
