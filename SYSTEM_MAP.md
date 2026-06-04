<!--
Tujuan: Kompas Navigasi & Arsitektur Utama (Ultra-Compact) - v2.0.
Caller: AI Coding Assistant (Antigravity), Pengembang Manusia (awal sesi).
Dependensi: js/*.js, css/style.css, index.html.
Main Functions: Menyediakan peta struktur berkas statis, alur data inti, dan blind spots.
Side Effects: Tidak ada side effects runtime.
-->
# SYSTEM_MAP.md — AffiliateOS Ultra-Compact Navigation Map (v2.0)

Peta arsitektur super ringkas ini berfungsi sebagai **kompas navigasi utama** di awal sesi untuk menghemat penggunaan token tanpa kehilangan arah pengembangan. Detail implementasi fungsional dan skema database disimpan secara modular di file terkait.

---

## 1. Project Summary

* **Tujuan Aplikasi**: Aplikasi SPA (*Single Page Application*) desktop tanpa backend untuk memantau analitik performa kreator afiliasi TikTok Shop, Dual Scoring (SAW/TOPSIS) master produk, slot planner jadwal posting, bank template, dan formulasi naskah video kreatif via Gemini AI.
* **Tech Stack**: HTML5, Vanilla JS, CSS Modern (Light Mode), LocalStorage (`affos4`, `affos_gd`, `gemini_api_key`), SheetJS (XLSX.js), Google Identity Services (GIS) OAuth2 client, Google Gemini API, Google Drive API.
* **Arsitektur**: SPA modular berbasis static files (tanpa bundler). Mutasi state global `S` disimpan ke LocalStorage via `save()` dan di-sync debounced (3 detik) asinkron ke cloud Google Drive AppData Folder.

---

## 2. Core Logic Flow (Function-Level Flowchart)

* **Impor Data Analitik / Benchmark**: Drop File ➔ `handleFile()` / `handleBenchmarkFile()` ([js/08-views.js](file:///d:/xampp/htdocs/affiliate-manajemen/js/08-views.js)) ➔ SheetJS ➔ `importRows()` (baca format 12 kolom baru dengan Period Snapshots merge, `nama_produk` wajib, `kategori_produk` opsional, ignore `sumber_data`) / `importBenchmark()` ➔ `refreshScores()` / `analyzeBenchPatterns()` ([js/03-scoring.js](file:///d:/xampp/htdocs/affiliate-manajemen/js/03-scoring.js))
* **Scoring & Klasifikasi**: `refreshScores()` ➔ `recomputeProductStats()` (Agregasi metrik: salesConsistency, conversionEfficiency, conversionRate, bestDays/Hours; views decayed, sales/GMV tanpa decay) ➔ `scoreTOPSIS()` (TOPSIS 6 kriteria: CTOR 30%, Sold 35%, CTR 20%, GMV 0%, nVideo 10%, conversionRate 5%) / `scoreBenchmark()` ➔ `classifyP()` (WINNING volume-first: sold >= 4, sold >= 2 + CR >= 0.5%, sc >= 0.4 + sold >= 2, ts >= 0.60) ➔ Urutkan `S.products` ➔ `save()`
* **Generate Jadwal**: Klik Generate ➔ `genSched()` ([js/07-jadwal.js](file:///d:/xampp/htdocs/affiliate-manajemen/js/07-jadwal.js)) ➔ `computeDynamicSlots()` (jika opsi jam analitik dicentang) ➔ Pembagian slot proporsi kuota (`allocateQuotas()`) ➔ Round-Robin produk per tier (`roundRobinPick()`) dengan jeda cooldown ➔ `buildSlotScript()` (per-kategori filter) ➔ `renderSchedOutput()` ➔ Auto-save ke `S.scheduleHistory` (max 20 entries)
* **AI Naskah Video**: Form UI ➔ `genScript() / doGenDesc()` ([js/08-views.js](file:///d:/xampp/htdocs/affiliate-manajemen/js/08-views.js)) ➔ `callGemini()` ([js/02-state.js](file:///d:/xampp/htdocs/affiliate-manajemen/js/02-state.js)) ➔ Gemini API ➔ `saveVarToMaster()` ➔ `save()`
* **Cloud Sync**: `save()` ➔ `gdScheduleSync()` ➔ Debounce 3s ➔ `gdSaveNow()` ([js/01-gdrive.js](file:///d:/xampp/htdocs/affiliate-manajemen/js/01-gdrive.js)) ➔ PATCH/POST ke Google Drive AppData Folder

---

## 3. Clean Tree

```
affiliate-manajemen/
├── index.html          # SPA Layout (Tema Terang) & Form Modals
├── SYSTEM_MAP.md       # Kompas Navigasi Awal (Berkas ini)
├── README.md           # Petunjuk instalasi dasar
├── css/
│   └── style.css       # Tema terang (Light Mode), responsive grid
└── js/
    ├── 01-gdrive.js    # Google Drive Sync (OAuth2 implicit flow & AppData CRUD)
    ├── 02-state.js     # State Global S (defaults, S.categories, S.scheduleHistory, save(), callGemini())
    ├── 03-scoring.js   # Dual Scoring SAW/TOPSIS (6 kriteria), classifyP() volume-first, detectAnomalies()
    ├── 04-nav.js       # SPA Switcher, tab navigasi, modals
    ├── 05-dashboard.js # Dashboard widget, data KPI, table sorting, fmt() (Tabel 9 kolom)
    ├── 06-produk.js    # Master produk, add/edit form, AI Desc Generator, Categories manager
    ├── 07-jadwal.js    # Sched Generator (Hook per kategori, Riwayat, Unduh CSV & TXT)
    └── 08-views.js     # Text bank (Hook per kategori), Importer, init aplikasi
```

---

## 4. Module Map (The Chapters)

Peran 1 kalimat dan fungsi utama dari 8 modul JavaScript:

1. **[js/01-gdrive.js](file:///d:/xampp/htdocs/affiliate-manajemen/js/01-gdrive.js)**: Sinkronisasi cloud Google Drive.
   * *Fungsi Utama*: `gdConnect()`, `gdDisconnect()`, `gdLoadFromDrive()`, `gdSaveNow()`, `gdScheduleSync()`.
2. **[js/02-state.js](file:///d:/xampp/htdocs/affiliate-manajemen/js/02-state.js)**: State management `S` & Gemini API key/model selector.
   * *Fungsi Utama*: `toast()`, `save()`, `callGemini()`, `initGeminiKey()`, `saveGeminiKey()`.
3. **[js/03-scoring.js](file:///d:/xampp/htdocs/affiliate-manajemen/js/03-scoring.js)**: Algoritma dual pemeringkatan volume-first, anomali, dan agregasi jadwal dinamis.
   * *Fungsi Utama*: `scoreBenchmark()`, `scoreTOPSIS()`, `classifyP()`, `analyzePersonalPatterns()`, `computeDynamicSlots()`, `refreshScores()`, `updateBadges()`.
4. **[js/04-nav.js](file:///d:/xampp/htdocs/affiliate-manajemen/js/04-nav.js)**: Navigasi halaman SPA dan handling modals.
   * *Fungsi Utama*: `goPage()`, `tabSw()`, `setMode()`, `openModal()`, `closeModal()`.
5. **[js/05-dashboard.js](file:///d:/xampp/htdocs/affiliate-manajemen/js/05-dashboard.js)**: Agregasi KPI bisnis analitik dan widget alert.
   * *Fungsi Utama*: `fmt()`, `renderDash()`.
6. **[js/06-produk.js](file:///d:/xampp/htdocs/affiliate-manajemen/js/06-produk.js)**: Master produk, kategori master dinamis, dan AI deskripsi generator.
   * *Fungsi Utama*: `renderProduk()`, `openGenDesc()`, `doGenDesc()`, `saveNewProd()`, `renderCatOptions()`, `addNewCategory()`, `removeCategory()`, `renderCatManager()`.
7. **[js/07-jadwal.js](file:///d:/xampp/htdocs/affiliate-manajemen/js/07-jadwal.js)**: Mesin jadwal cerdas (Level 2) berbasis kuota proporsi, hook per-kategori, riwayat jadwal, dan ekspor CSV/TXT.
   * *Fungsi Utama*: `genSched()`, `allocateQuotas()`, `roundRobinPick()`, `buildSlotScript()`, `renderSchedOutput()`, `loadSchedHistory()`, `deleteSchedHistory()`, `downloadScheduleCSV()`, `downloadScheduleTXT()`, `renderSchedHistory()`.
8. **[js/08-views.js](file:///d:/xampp/htdocs/affiliate-manajemen/js/08-views.js)**: Impor SheetJS, AI standalone generator, hook/proof/cta per-kategori, bank teks, dan app inisialisasi.
   * *Fungsi Utama*: `renderBank()`, `genScript()`, `processFile()`, `importRows()`, `renderBench()`, `adoptBench()`, `renderBankCatDropdowns()`.

---

## 5. Data, Config, & Integrations

* **Detail Skema Database**: `localStorage` key `affos4`. Detail parameter objek `S`, `prod`, dan `content` didefinisikan secara modular di Header Doc **[js/02-state.js](file:///d:/xampp/htdocs/affiliate-manajemen/js/02-state.js)**.
* **Konfigurasi & API**:
  * API Key kustom disimpan di `localStorage` key `gemini_api_key` (sidebar).
  * GDrive Client ID berupa konstanta di [js/01-gdrive.js](file:///d:/xampp/htdocs/affiliate-manajemen/js/01-gdrive.js).
  * API Eksternal: Google Gemini API (AI Generator) via [js/02-state.js](file:///d:/xampp/htdocs/affiliate-manajemen/js/02-state.js), GDrive API (Cloud Backup) via [js/01-gdrive.js](file:///d:/xampp/htdocs/affiliate-manajemen/js/01-gdrive.js), SheetJS CDN via [index.html](file:///d:/xampp/htdocs/affiliate-manajemen/index.html).
  * Lokasi `.env*`/Migration/Seed: `Not found`.

---

## 6. Risks / Blind Spots

Semua risiko teridentifikasi dari versi sebelumnya telah ditangani:
- ✅ **Deduplikasi Benchmark** diselesaikan dengan perbandingan nama lengkap secara ketat.
- ✅ **Sesi Drive Expired** dimitigasi dengan proaktif timer mematikan sesi tepat 1 jam dan UI persist di sidebar untuk reconnect.
- ✅ **CDN Luring** dimitigasi dengan fallback peringatan ramah saat pengguna mencoba impor `.xlsx` atau menghubungkan Drive tanpa koneksi.
- ✅ **Akumulasi Mingguan Inakurat** diselesaikan dengan `recomputeProductStats()` yang menghitung ulang dari nol menggunakan data mentah `S.contents` (Scratch Aggregation) plus Time-Decay factor 60 hari.
- ✅ **Dedup Key Lemah** diselesaikan dengan menggunakan `nama + tanggal + durasi`.
- ✅ **Statik Benchmark** diselesaikan dengan Import Benchmark dinamis dari fail Excel/CSV independen.
- ✅ **Benchmark Campur Aduk** diselesaikan dengan sistem Multi-Profil Benchmark (opsi *merge/overwrite*) untuk melacak pola antar-affiliator secara terpisah.
- ✅ **Bias GMV Produk Mahal** dimitigasi dengan TOPSIS volume-first (Sold bobot naik ke 35%, GMV dihapus 0%, kriteria conversionRate 5%) dan klasifikasi WINNING murni berbasis volume penjualan (sold >= 4 atau sold >= 2 + CR >= 0.5%).
- ✅ **Data Duplikat Konten Multi-Periode** ditangani dengan `periodSnapshots` non-overlapping array & overlap detection (contains/contained/overlap).
- ✅ **Error Hapus Riwayat Jadwal** diselesaikan dengan event delegation pada DOM wrap riwayat jadwal.
- ✅ **Sinkronisasi Drive Lintas Perangkat** ditangani dengan validasi token dan `gdInitOnLoad()` auto-load saat aplikasi dibuka.
- ✅ **Ketidakakuratan Penjadwalan Berbasis Hari & Komisi** diselesaikan di v2.2 dengan menghapus komisi/harga dari bobot penjadwalan, menghapus dynamic day multiplier, serta beralih ke quota-based proportion + round-robin rotation.
- ✅ **Penanganan Stok Produk Kosong & Penangguhan Konten** diselesaikan di v2.2 dengan sistem Status 3-level (`aktif`, `jeda`, `habis`). Produk dengan status `jeda` (ditangguhkan) atau `habis` (stok kosong) otomatis dikecualikan dari generate jadwal otomatis. Menambahkan dropdown filter status di halaman Master Produk serta quick action buttons (Jeda, Habis, Aktifkan) pada setiap card produk.
