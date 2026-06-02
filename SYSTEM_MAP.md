<!--
Tujuan: Kompas Navigasi & Arsitektur Utama (Ultra-Compact).
Caller: AI Coding Assistant (Antigravity), Pengembang Manusia (awal sesi).
Dependensi: js/*.js, css/style.css, index.html.
Main Functions: Menyediakan peta struktur berkas statis, alur data inti, dan blind spots.
Side Effects: Tidak ada side effects runtime.
-->
# SYSTEM_MAP.md — AffiliateOS Ultra-Compact Navigation Map

Peta arsitektur super ringkas ini berfungsi sebagai **kompas navigasi utama** di awal sesi untuk menghemat penggunaan token tanpa kehilangan arah pengembangan. Detail implementasi fungsional dan skema database disimpan secara modular di file terkait.

---

## 1. Project Summary

* **Tujuan Aplikasi**: Aplikasi SPA (*Single Page Application*) desktop tanpa backend untuk memantau analitik performa kreator afiliasi TikTok Shop, Dual Scoring (SAW/TOPSIS) master produk, slot planner jadwal posting, bank template, dan formulasi naskah video kreatif via Gemini AI.
* **Tech Stack**: HTML5, Vanilla JS, CSS Modern, LocalStorage (`affos4`, `affos_gd`, `gemini_api_key`), SheetJS (XLSX.js), Google Identity Services (GIS) OAuth2 client, Google Gemini API, Google Drive API.
* **Arsitektur**: SPA modular berbasis static files (tanpa bundler). Mutasi state global `S` disimpan ke LocalStorage via `save()` dan di-sync debounced (3 detik) asinkron ke cloud Google Drive AppData Folder.

---

## 2. Core Logic Flow (Function-Level Flowchart)

* **Impor Data Analitik / Benchmark**: Drop File ➔ `handleFile()` / `handleBenchmarkFile()` ([js/08-views.js](file:///Users/mhmdrzki/Documents/affiliate-manajemen/js/08-views.js)) ➔ SheetJS ➔ `importRows()` / `importBenchmark()` ➔ `refreshScores()` / `analyzeBenchPatterns()` ([js/03-scoring.js](file:///Users/mhmdrzki/Documents/affiliate-manajemen/js/03-scoring.js))
* **Scoring & Klasifikasi**: `refreshScores()` ➔ `recomputeProductStats()` (Agregasi ulang: Content Decay untuk views, penjualan & GMV mutlak tanpa decay, metrik `salesConsistency` teragregasi) ➔ `scoreTOPSIS()` (dengan log-dampening) / `scoreBenchmark()` ➔ `classifyP()` (WINNING/POTENTIAL/UJI COBA/MONITOR/DROP) ➔ Urutkan `S.products` ➔ `save()`
* **Generate Jadwal**: Klik Generate ➔ `genSched()` ([js/07-jadwal.js](file:///Users/mhmdrzki/Documents/affiliate-manajemen/js/07-jadwal.js)) ➔ `computeDynamicSlots()` & `computeDayMultiplier()` ➔ Weighted `pickWithCooldown()` ➔ `buildSlotScript()` ➔ `renderSchedOutput()`
* **AI Naskah Video**: Form UI ➔ `genScript() / doGenDesc()` ([js/08-views.js](file:///Users/mhmdrzki/Documents/affiliate-manajemen/js/08-views.js)) ➔ `callGemini()` ([js/02-state.js](file:///Users/mhmdrzki/Documents/affiliate-manajemen/js/02-state.js)) ➔ Gemini API ➔ `saveVarToMaster()` ➔ `save()`
* **Cloud Sync**: `save()` ➔ `gdScheduleSync()` ➔ Debounce 3s ➔ `gdSaveNow()` ([js/01-gdrive.js](file:///Users/mhmdrzki/Documents/affiliate-manajemen/js/01-gdrive.js)) ➔ PATCH/POST ke Google Drive AppData Folder

---

## 3. Clean Tree

```
affiliate-manajemen/
├── index.html          # SPA Layout & Form Modals
├── SYSTEM_MAP.md       # Kompas Navigasi Awal (Berkas ini)
├── README.md           # Petunjuk instalasi dasar
├── css/
│   └── style.css       # Tema gelap, glassmorphism, responsive grid
└── js/
    ├── 01-gdrive.js    # Google Drive Sync (OAuth2 implicit flow & AppData CRUD)
    ├── 02-state.js     # State Global S, defaults, save(), callGemini()
    ├── 03-scoring.js   # Dual Scoring SAW/TOPSIS, classifyP(), detectAnomalies()
    ├── 04-nav.js       # SPA Switcher, tab navigasi, modals
    ├── 05-dashboard.js # Dashboard widget, data KPI, table sorting, fmt()
    ├── 06-produk.js    # Master produk, add/edit form, AI Desc Generator (doGenDesc)
    ├── 07-jadwal.js    # Sched Generator, slot planner, script perakit, copySlot
    └── 08-views.js     # Text bank, AI standalone gen, SheetJS importer, init aplikasi
```

---

## 4. Module Map (The Chapters)

Peran 1 kalimat dan fungsi utama dari 8 modul JavaScript:

1. **[js/01-gdrive.js](file:///Users/mhmdrzki/Documents/affiliate-manajemen/js/01-gdrive.js)**: Sinkronisasi cloud Google Drive.
   * *Fungsi Utama*: `gdConnect()`, `gdDisconnect()`, `gdLoadFromDrive()`, `gdSaveNow()`, `gdScheduleSync()`.
2. **[js/02-state.js](file:///Users/mhmdrzki/Documents/affiliate-manajemen/js/02-state.js)**: State management `S` & Gemini API key/model selector.
   * *Fungsi Utama*: `toast()`, `save()`, `callGemini()`, `initGeminiKey()`, `saveGeminiKey()`.
3. **[js/03-scoring.js](file:///Users/mhmdrzki/Documents/affiliate-manajemen/js/03-scoring.js)**: Algoritma dual pemeringkatan, anomali, dan agregasi jadwal dinamis.
   * *Fungsi Utama*: `scoreBenchmark()`, `scoreTOPSIS()`, `classifyP()`, `analyzePersonalPatterns()`, `computeDynamicSlots()`, `computeDayMultiplier()`, `refreshScores()`, `updateBadges()`.
4. **[js/04-nav.js](file:///Users/mhmdrzki/Documents/affiliate-manajemen/js/04-nav.js)**: Navigasi halaman SPA dan handling modals.
   * *Fungsi Utama*: `goPage()`, `tabSw()`, `setMode()`, `openModal()`, `closeModal()`.
5. **[js/05-dashboard.js](file:///Users/mhmdrzki/Documents/affiliate-manajemen/js/05-dashboard.js)**: Agregasi KPI bisnis analitik dan widget alert.
   * *Fungsi Utama*: `fmt()`, `renderDash()`.
6. **[js/06-produk.js](file:///Users/mhmdrzki/Documents/affiliate-manajemen/js/06-produk.js)**: Master produk dan AI deskripsi generator.
   * *Fungsi Utama*: `renderProduk()`, `openGenDesc()`, `doGenDesc()`, `saveNewProd()`.
7. **[js/07-jadwal.js](file:///Users/mhmdrzki/Documents/affiliate-manajemen/js/07-jadwal.js)**: Mesin jadwal cerdas (Level 2), slot planner, dan perakit naskah.
   * *Fungsi Utama*: `genSched()`, `pickWithCooldown()`, `computeWeights()`, `buildSlotScript()`, `renderSchedOutput()`, `rotateSlot()`, `copySlot()`.
8. **[js/08-views.js](file:///Users/mhmdrzki/Documents/affiliate-manajemen/js/08-views.js)**: Impor SheetJS, AI standalone generator, bank teks, dan app inisialisasi.
   * *Fungsi Utama*: `renderBank()`, `genScript()`, `processFile()`, `importRows()`, `renderBench()`, `adoptBench()`.

---

## 5. Data, Config, & Integrations

* **Detail Skema Database**: `localStorage` key `affos4`. Detail parameter objek `S`, `prod`, dan `content` didefinisikan secara modular di Header Doc **[js/02-state.js](file:///Users/mhmdrzki/Documents/affiliate-manajemen/js/02-state.js)**.
* **Konfigurasi & API**:
  * API Key kustom disimpan di `localStorage` key `gemini_api_key` (sidebar).
  * GDrive Client ID berupa konstanta di [js/01-gdrive.js](file:///Users/mhmdrzki/Documents/affiliate-manajemen/js/01-gdrive.js).
  * API Eksternal: Google Gemini API (AI Generator) via [js/02-state.js](file:///Users/mhmdrzki/Documents/affiliate-manajemen/js/02-state.js), GDrive API (Cloud Backup) via [js/01-gdrive.js](file:///Users/mhmdrzki/Documents/affiliate-manajemen/js/01-gdrive.js), SheetJS CDN via [index.html](file:///Users/mhmdrzki/Documents/affiliate-manajemen/index.html).
  * Lokasi `.env*`/Migration/Seed: `Not found`.

---

## 6. Risks / Blind Spots

Semua risiko teridentifikasi dari versi sebelumnya (Deduplikasi, Ketergantungan CDN Luring, dan Sesi Drive Expired) telah ditangani:
- ✅ **Deduplikasi Benchmark** diselesaikan dengan perbandingan nama lengkap secara ketat.
- ✅ **Sesi Drive Expired** dimitigasi dengan proaktif timer mematikan sesi tepat 1 jam dan UI persist di sidebar untuk reconnect.
- ✅ **CDN Luring** dimitigasi dengan fallback peringatan ramah saat pengguna mencoba impor `.xlsx` atau menghubungkan Drive tanpa koneksi.

- ✅ **Akumulasi Mingguan Inakurat** diselesaikan dengan `recomputeProductStats()` yang menghitung ulang dari nol menggunakan data mentah `S.contents` (Scratch Aggregation) plus Time-Decay factor 60 hari.
- ✅ **Dedup Key Lemah** diselesaikan dengan menggunakan `nama + tanggal + durasi`.
- ✅ **Statik Benchmark** diselesaikan dengan Import Benchmark dinamis dari fail Excel/CSV independen.
- ✅ **Benchmark Campur Aduk** diselesaikan dengan sistem Multi-Profil Benchmark (opsi *merge/overwrite*) untuk melacak pola antar-affiliator secara terpisah dan memantau perubahan tren dari waktu ke waktu.
