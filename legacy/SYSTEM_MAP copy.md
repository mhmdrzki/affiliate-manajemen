<!--
Tujuan: Peta Navigasi Utama, Flow Logika Kritis, Module Map, dan Manajemen Aset Aplikasi Modular AffiliateOS.
Caller: AI Coding Assistant (Antigravity), Pengembang Manusia.
Dependensi: js/*.js, css/style.css, index.html.
Main Functions: Menyediakan kompas arsitektur, flow data kritis, data model, integrasi, dan blind spots proyek.
Side Effects: Tidak ada side effects runtime.
-->
# SYSTEM_MAP.md — AffiliateOS Navigation Map

Dokumen ini berfungsi sebagai **navigasi utama, peta modul modular, dan penjelas logika dasar** untuk aplikasi **AffiliateOS** setelah pemisahan kode (*modularization*). Dirancang untuk mempercepat pemahaman arsitektur dan memandu pengembangan AI serta developer agar tetap selaras tanpa merusak sistem.

---

## 1. Project Summary

* **Tujuan Aplikasi**: 
  Aplikasi SPA (*Single Page Application*) desktop tanpa backend untuk membantu kreator afiliasi TikTok Shop memantau analitik performa konten, mengelola master produk, menyusun jadwal posting otomatis secara strategis, memelihara bank materi video (Hook/Proof/CTA), serta memformulasikan naskah video kreatif memanfaatkan integrasi Gemini API.
* **Tech Stack Utama**:
  * **Core**: HTML5, Vanilla JavaScript, CSS Modern (dengan variabel tema gelap, glassmorphism, dan animasi mikro).
  * **CDN Libraries**:
    * **SheetJS (XLSX.js)**: Memproses file laporan analitik TikTok dalam format Excel (`.xlsx`/`.xls`) atau `.csv` secara lokal di browser.
    * **Google Identity Services (GIS)**: Client OAuth2 untuk proses autentikasi akun Google Drive pengguna.
  * **Storage (Local)**:
    * `localStorage` key `affos4`: Menyimpan database utama aplikasi (`S` state).
    * `localStorage` key `affos_gd`: Menyimpan token otorisasi (`token`) dan file ID Google Drive (`fileId`).
    * `localStorage` key `gemini_api_key`: Menyimpan custom Gemini API Key pengguna.
  * **AI Integration**: Pemanggilan API langsung ke Google Gemini API (`https://generativelanguage.googleapis.com/v1beta/models/<model>:generateContent`). Mendukung kustomisasi API Key secara lokal (`localStorage`), dan **pemilihan model** (`gemini-2.5-flash`, `gemini-3.0-flash`, `gemini-2.0-flash`) dari UI Sidebar untuk resolusi deprecation / _Rate Limit_ (429) pada akun gratisan.
  * **Typography**: `@import` Google Fonts (`Raleway`, `DM Sans`, `IBM Plex Mono`).
* **Pola Arsitektur**:
  * **SPA Modular Tanpa Bundler**: Halaman tunggal berbasis navigasi manual yang memicu manipulasi kelas CSS `.act` pada blok halaman dan menu navigasi. Berkas JS dipisah menjadi 8 modul logis yang dimuat berurutan via tag `<script>` di `index.html`.
  * **Reactive State Management**: Objek database global tunggal `S` diubah secara langsung di memori, diikuti dengan pemanggilan fungsi pembantu `save()` untuk menyimpan state ke `localStorage` dan memicu asinkronisasi debounced otomatis ke Google Drive (`gdScheduleSync`).

---

## 2. Core Logic Flow (Function-Level Flowchart)

Berikut flow teks alur kritikal yang menggerakkan sistem:

### A. Alur Impor Analytics (Excel/CSV)
`Drop/Pilih File (UI)` ➔ [js/08-views.js](file:///Users/mhmdrzki/Documents/affiliate-manajemen/js/08-views.js)➔ `handleFile(inp)` ➔ `processFile(file)` ➔ `SheetJS / parseCSV` ➔ `importRows(rows, filename)` ➔ Mutasi state global `S.contents` & `S.products` ➔ [js/03-scoring.js](file:///Users/mhmdrzki/Documents/affiliate-manajemen/js/03-scoring.js)➔ `refreshScores()` ➔ [js/02-state.js](file:///Users/mhmdrzki/Documents/affiliate-manajemen/js/02-state.js)➔ `save()` ➔ [js/01-gdrive.js](file:///Users/mhmdrzki/Documents/affiliate-manajemen/js/01-gdrive.js)➔ `gdScheduleSync()` ➔ PATCH/POST ke Google Drive API

### B. Alur Pembuatan Jadwal Konten Otomatis (Schedule Generation)
`Klik Button "Generate" (UI)` ➔ [js/07-jadwal.js](file:///Users/mhmdrzki/Documents/affiliate-manajemen/js/07-jadwal.js)➔ `genSched()` ➔ Pengelompokan produk aktif non-DROP ➔ Alokasi slot waktu strategis (`PATS`, `PRIME_SLOTS`, `MID_SLOTS`) ➔ `buildSlotScript(prod, hIdx, pfIdx, ctaIdx, descIdx)` ➔ `renderSchedOutput()` ➔ Render visualisasi di UI & Fitur Salin Clipboard

### C. Alur Pembuatan Naskah Video (Gemini AI Integration)
`Form Generator / Master Produk` ➔ [js/08-views.js](file:///Users/mhmdrzki/Documents/affiliate-manajemen/js/08-views.js)➔ `genScript() / doGenDesc()` ➔ [js/02-state.js](file:///Users/mhmdrzki/Documents/affiliate-manajemen/js/02-state.js)➔ `callGemini(prompt, maxTokens)` ➔ Fetch POST ke Google Gemini API ➔ JSON Parse Output ➔ `saveVarToMaster(varIdx)` ➔ Mutasi `S.products[i].descVariants` ➔ `save()` ➔ LocalStorage & Google Drive Sync

### D. Alur Pemeringkatan & Klasifikasi (Dual Scoring System)
`Data Trigger (Import / Save)` ➔ [js/03-scoring.js](file:///Users/mhmdrzki/Documents/affiliate-manajemen/js/03-scoring.js)➔ `refreshScores()` ➔ Evaluasi jumlah produk ber-data komersial ➔
* **Bila >= 3 produk**: `scoreTOPSIS(ps)` (TOPSIS multi-kriteria)
* **Bila < 3 produk**: `scoreBenchmark(ps)` (Benchmark SAW frekuensi-based)
➔ `classifyP(p, mode)` (klasifikasi `WINNING`, `POTENTIAL`, `MONITOR`, `DROP`) ➔ `updateBadges()` ➔ `save()`

### E. Alur Sinkronisasi Google Drive (Backup Cloud)
* **Sinkronisasi Unduh**: `Klik Connect` ➔ [js/01-gdrive.js](file:///Users/mhmdrzki/Documents/affiliate-manajemen/js/01-gdrive.js)➔ `gdConnect()` ➔ `gdLoadFromDrive()` ➔ `gdFindFile()` ➔ Download data JSON ➔ Validasi `lastModified` timestamp vs data lokal ➔ Merge/Timpa ke state global `S` ➔ Refresh UI & save
* **Sinkronisasi Unggah**: `UI State Mutasi` ➔ [js/02-state.js](file:///Users/mhmdrzki/Documents/affiliate-manajemen/js/02-state.js)➔ `save()` ➔ [js/01-gdrive.js](file:///Users/mhmdrzki/Documents/affiliate-manajemen/js/01-gdrive.js)➔ `gdScheduleSync()` ➔ Debounce 3 detik ➔ `gdSaveNow()` ➔ PATCH (file lama) / POST Multipart (file baru) ke `appDataFolder` Google Drive

---

## 3. Clean Tree

Peta folder proyek yang bersih dari dependency luring dan artefak build:

```
affiliate-manajemen/
├── index.html          # Struktur HTML UI Utama (SPA Layout)
├── SYSTEM_MAP.md       # Kompas Navigasi & Arsitektur Utama (File ini)
├── README.md           # Catatan instruksi dasar proyek
├── css/
│   └── style.css       # Seluruh gaya visual, tema gelap, & glassmorphism
└── js/
    ├── 01-gdrive.js    # Google Drive Sync Module (OAuth2 & File CRUD)
    ├── 02-state.js     # State Global S, Save Helper, & Gemini API Connector
    ├── 03-scoring.js   # Dual Scoring System (SAW & TOPSIS) & Anomaly Detector
    ├── 04-nav.js       # SPA Page Switcher, Tab Switcher, & Modal Manager
    ├── 05-dashboard.js # Render KPI Dashboard, Sorting Tabel, & Widget Alert
    ├── 06-produk.js    # Render Master Produk, Add/Edit Form, & AI Desc Generator
    ├── 07-jadwal.js    # Render Jadwal, Slot Planner, Script Builder, & Clipboard
    └── 08-views.js     # Bank Template, Standalone AI Gen, SheetJS Parser, & Init
```

---

## 4. Module Map (The Chapters)

Berikut adalah daftar peran dan fungsi publik utama dari setiap berkas sumber di dalam proyek:

### A. Core Layout & Styles
* **[index.html](file:///Users/mhmdrzki/Documents/affiliate-manajemen/index.html)**
  * *Peran*: File SPA utama tempat seluruh struktur layout markup UI, form modal tambah/edit produk, penugasan slot jadwal, kontainer toast, dan pemanggilan script modular didefinisikan.
  * *Fungsi Utama*: Didefinisikan statis di HTML, tidak memiliki fungsi JS internal (seluruh logika dialokasikan ke folder `js/`).
* **[css/style.css](file:///Users/mhmdrzki/Documents/affiliate-manajemen/css/style.css)**
  * *Peran*: Mengelola seluruh desain visual aplikasi, palet warna gelap modern, glassmorphism, flex/grid layouts, responsive styling, dan transisi animasi mikro.

### B. JavaScript Modules (Di-load berurutan di `index.html`)
* **[js/01-gdrive.js](file:///Users/mhmdrzki/Documents/affiliate-manajemen/js/01-gdrive.js)**
  * *Peran*: Menangani integrasi sinkronisasi data cloud dengan Google Drive API di folder terisolasi (`appDataFolder`).
  * *Fungsi Publik Utama*:
    * `gdConnect()`: Meluncurkan GIS OAuth2 client flow untuk mengambil token akses.
    * `gdDisconnect()`: Menghapus token Google Drive dari sesi lokal.
    * `gdLoadFromDrive()`: Mengunduh data JSON dari Drive dan melakukan merge dengan validasi timestamp `lastModified`.
    * `gdSaveNow()`: Mengirim state JSON lokal ke Drive via PATCH (update) atau POST (multipart baru).
    * `gdScheduleSync()`: Penjadwal sinkronisasi otomatis menggunakan metode debounce selama 3 detik setelah operasi `save()`.
* **[js/02-state.js](file:///Users/mhmdrzki/Documents/affiliate-manajemen/js/02-state.js)**
  * *Peran*: Mengelola default data template, inisialisasi state global `S`, persistensi LocalStorage, dan koneksi dasar Gemini AI.
  * *Fungsi Publik Utama*:
    * `toast(msg)`: Menampilkan pop-up toast notifikasi di browser.
    * `save()`: Menyimpan mutasi state global `S` ke `localStorage` dengan key `affos4`, memperbarui timestamp `lastModified`, dan memicu penjadwalan sinkronisasi cloud.
    * `callGemini(prompt, maxTokens)`: Mengirim payload POST langsung ke Google Gemini API secara aman menggunakan custom key atau default key, menangani model dinamis, dan menyaring wrapper Markdown triple backtick sebelum merespons.
    * `initGeminiKey()` & `saveGeminiKey()`: Mengatur inisialisasi, input, validasi format key kustom (`AIzaSy...` atau `AQ....`), dan visualisasi badge indikator API di sidebar.
* **[js/03-scoring.js](file:///Users/mhmdrzki/Documents/affiliate-manajemen/js/03-scoring.js)**
  * *Peran*: Mesin pengolah algoritma Dual Scoring System (SAW & TOPSIS), penentu slot waktu posting, deteksi anomali konten, dan kontrol badge.
  * *Fungsi Publik Utama*:
    * `scoreBenchmark(ps)`: Melakukan kalkulasi SAW (Simple Additive Weighting) terobos berdasarkan frekuensi posting ketika data komersial personal masih minim (<3 produk).
    * `scoreTOPSIS(ps)`: Melakukan kalkulasi TOPSIS multi-kriteria (avgCTOR, avgCTR, totalItemsSold, totalGMV, nVideo) otomatis ketika data komersial mencukupi (>=3 produk).
    * `classifyP(p, mode)`: Mengklasifikasikan tingkat performa produk (`WINNING`, `POTENTIAL`, `MONITOR`, `DROP`) berdasarkan aturan bersyarat skor.
    * `detectAnomalies(products)`: Menjalankan sensor otomatis untuk mendeteksi anomali data (indikasi GMV Max seller, *hidden winner*, klaster seller aktif iklan, dan winning tanpa skrip AI).
    * `refreshScores()`: Orkes utama pemeringkatan yang mendeteksi mode skoring, mengeksekusi kalkulator, mengurutkan array produk, memperbarui badge, dan menyimpan database.
* **[js/04-nav.js](file:///Users/mhmdrzki/Documents/affiliate-manajemen/js/04-nav.js)**
  * *Peran*: Mesin navigasi SPA, pertukaran tab visual, dan manajemen modal dialog overlay.
  * *Fungsi Publik Utama*:
    * `goPage(id, el)`: Melakukan switch halaman aktif dengan mematikan/menyalakan kelas CSS `.act` dan memicu pre-render data spesifik halaman bersangkutan.
    * `tabSw(btn, tpId)`: Melakukan pertukaran tab aktif di dalam halaman atau modal.
    * `setMode(m)`: Mengubah mode aplikasi global antara 'mine' (Akunmu) dan 'bench' (Benchmark).
    * `openModal(id)` & `closeModal(id)`: Mengatur animasi kelas CSS `.open` untuk memicu dialog dialog overlay.
* **[js/05-dashboard.js](file:///Users/mhmdrzki/Documents/affiliate-manajemen/js/05-dashboard.js)**
  * *Peran*: Menghitung performa analitik konten, menyusun widget KPI utama, dan merender panel rekomendasi dashboard.
  * *Fungsi Publik Utama*:
    * `fmt(n)`: Pemformat angka Rupiah/Jumlah ke format ringkas (misal: `1.5jt`, `12rb`).
    * `renderDash()`: Menghitung akumulasi statistik riwayat konten, mengurutkan tabel konten secara dinamis (berdasarkan GMV, CTOR, CTR, unit, views, tanggal), dan merangkai widget indikator skoring serta anomali.
* **[js/06-produk.js](file:///Users/mhmdrzki/Documents/affiliate-manajemen/js/06-produk.js)**
  * *Peran*: Mengelola render kartu produk master, form tambah/edit produk, dan pembuatan deskripsi variasi konten AI.
  * *Fungsi Publik Utama*:
    * `renderProduk()`: Membagi visualisasi list produk ke 5 filter tab (Semua, Winning, Potential, Monitor, Drop).
    * `openGenDesc(pi)` & `doGenDesc()`: Membuka modal arahan AI dan mengeksekusi request `callGemini()` untuk merancang hingga 3 variasi ringkasan isi konten produk unik.
    * `saveNewProd()`: Mengambil data modal form lalu menyimpan produk baru atau memperbarui produk lama (edit mode) ke database master produk.
* **[js/07-jadwal.js](file:///Users/mhmdrzki/Documents/affiliate-manajemen/js/07-jadwal.js)**
  * *Peran*: Mengelola generator kalender posting, perakit script rekam instan, dan penugasan slot produk.
  * *Fungsi Publik Utama*:
    * `buildSlotScript(prod, hIdx, pfIdx, ctaIdx, descIdx)`: Merakit naskah video utuh dengan menggabungkan dinamis: Hook (menyisipkan nama produk), deskripsi isi produk master, Proof, dan CTA terpilih.
    * `genSched()`: Algoritma penyusun jadwal kerja harian (1 s/d 30 hari) berlandaskan prioritas performa produk di slot strategis (Prime diisi Winning, Mid diisi Potential, Test diisi Monitor).
    * `renderSchedOutput()`: Me-render visualisasi baris jadwal, accordion naskah rekam, selector manual modifikasi hook/proof/cta, rotasi sekuensial instan (`rotateSlot`), dan fitur salin clipboard (`copySlot`).
    * `openAssign(di, si)` & `doAssign(pid)`: Modal handling untuk penugasan manual produk tertentu ke slot jadwal terpilih.
* **[js/08-views.js](file:///Users/mhmdrzki/Documents/affiliate-manajemen/js/08-views.js)**
  * *Peran*: Pengelola bank teks template, script generator AI mandiri, parser impor SheetJS/CSV, dan orkes awal pemuatan aplikasi.
  * *Fungsi Publik Utama*:
    * `renderBank()`: Memicu pembaruan list visual untuk Hook Bank, Proof Bank, dan CTA Bank.
    * `addHook()` / `addProof()` / `addCTA()` & `del...`: Operasi CRUD untuk template bank teks state global.
    * `genScript()`: Request AI mandiri ke Gemini untuk menghasilkan 3 variasi naskah video utuh terstruktur (Hook, Isi, Proof, CTA) berdasarkan arahan, model kamera (OOTD, demo, dsb.), dan durasi.
    * `processFile(file)`: Menganalisis ekstensi berkas impor analitik TikTok untuk dilewatkan ke `parseCSV()` atau SheetJS `XLSX.read()`.
    * `importRows(rows, filename)`: Logika pemrosesan impor data analitik TikTok, deduplikasi konten berdasarkan nama produk + tanggal posting, klasifikasi tipe produk otomatis via regex kata kunci, akumulasi performa CTR/CTOR EMA, dan pemicu pembaruan peringkat.
    * `renderBench()`: Merender visualisasi grafik, jam upload tersibuk, pola mingguan, dan data produk andalan benchmark dari top akun `bangjie.id`.

---

## 5. Data & Config

* **Lokasi `.env*` / Config Utama**: `Not found`
  *(Aplikasi bersifat frontend-only tanpa backend server. Konfigurasi Client ID Google Drive didefinisikan sebagai konstanta di `js/01-gdrive.js`. Gemini API Key disimpan secara lokal di `localStorage` key `gemini_api_key` dengan fallback API Key bawaan aman di `js/02-state.js`)*.
* **Lokasi Migration/Seed**: `Not found`
* **Folder Output/Runtime Artifacts**: `Not found`
  *(Seluruh state disimpan di browser memori dan LocalStorage, lalu dicadangkan asinkron ke `appDataFolder` Google Drive milik pengguna)*.

### Skema Data Entity Inti

#### A. Database Utama (`S`)
Disimpan di LocalStorage dengan key `affos4`:
```javascript
S = {
  products: [],          // Array objek produk master (Detail di bawah)
  contents: [],          // Array objek riwayat video hasil impor (Detail di bawah)
  hooks: [],             // Array objek Hook Template ({ id, txt })
  proofs: [],            // Array objek Proof Template ({ id, txt })
  ctas: [],              // Array objek CTA Template ({ id, txt })
  importHistory: [],     // Array log riwayat impor ({ filename, added, merged, skipped, ts, total })
  scoringMode: String,   // Mode skoring aktif ('benchmark' | 'topsis')
  lastModified: Number   // Timestamp waktu modifikasi terakhir database
}
```

#### B. Objek Master Produk (`S.products[i]`)
```javascript
prod = {
  id: String,              // ID Unik bentukan 'p' + Timestamp + Random
  nama: String,            // Nama lengkap produk dari etalase TikTok Shop
  jenis: String,           // Tipe / Kategori pendek produk (ex: "Celana Jogger")
  harga: Number,           // Harga produk dalam Rupiah
  komisi: Number,          // Komisi afiliasi per unit produk terjual
  kategori: String,        // Kategori ('fashion'|'parfum'|'skincare'|'olahraga'|'elektronik'|'umum')
  labelPrestasi: String,   // Badge prestasi seller (ex: "Top selling #4" atau "-")
  gmvAktif: Boolean,       // Status keaktifan seller beriklan/GMV Max (memicu deteksi anomali)
  descVariants: [],        // Maksimal 3 variasi deskripsi isi konten buatan AI
  nVideo: Number,          // Total video/konten terasosiasi hasil impor
  spreadDays: Number,      // Jumlah hari unik posting terdeteksi
  maxViews: Number,        // Views video tertinggi hasil impor
  avgViews: Number,        // Rata-rata views video terhitung dinamis
  totalItemsSold: Number,  // Total unit terjual terakumulasi
  totalGMV: Number,        // Total nilai penjualan (GMV) terakumulasi dalam Rupiah
  avgCTR: Number,          // Rata-rata CTR berbobot eksponensial (EMA .7 / .3)
  avgCTOR: Number,         // Rata-rata CTOR berbobot eksponensial (EMA .7 / .3)
  uploadDates: [],         // Kumpulan tanggal upload unik dari data analitik
  benchScore: Number,      // Skor keunggulan akhir (0-100) hasil SAW / TOPSIS
  topsisScore: Number,     // Skor TOPSIS murni (0.000 - 1.000) atau null jika SAW mode
  klasifikasi: String,     // Status klasifikasi ('WINNING'|'POTENTIAL'|'MONITOR'|'DROP')
  slotRek: String,         // Rekomendasi slot waktu posting ('16:00/18:00', dsb.)
  scoreMode: String        // Indikator mode kalkulasi skor terakhir ('topsis' | 'benchmark')
}
```

#### C. Objek Riwayat Konten (`S.contents[i]`)
```javascript
content = {
  id: String,          // ID Unik bentukan 'c' + Timestamp + Random
  produk: String,      // Nama produk terasosiasi (Relasi manual name-match ke prod.nama)
  desc: String,        // Caption / deskripsi video TikTok
  tanggal: String,     // Tanggal posting terdeteksi (format YYYY-MM-DD atau lokal)
  durasi: String,      // Durasi video dalam detik
  periode: String,     // Periode data analitik berjalan
  gmv: Number,         // GMV kontribusi dari video ini
  itemsSold: Number,   // Unit produk terjual dari video ini
  ctr: Number,         // Click-Through Rate (%)
  ctor: Number,        // Click-to-Order Rate (%)
  aov: Number,         // Rata-rata nilai per transaksi (AOV)
  views: Number,       // Jumlah penayangan video
  link: String,        // URL tautan video TikTok
  estK: Number,        // Estimasi komisi (itemsSold * prod.komisi)
  ts: Number           // Timestamp internal pembuatan objek
}
```

---

## 6. External Integrations

1. **Google Gemini API** (AI Engine)
   * *Modul Pemanggil*: [js/02-state.js](file:///Users/mhmdrzki/Documents/affiliate-manajemen/js/02-state.js)➔ `callGemini(prompt, maxTokens)`
   * *Tujuan*: Inferensi teks kecerdasan buatan untuk merancang variasi isi produk di Master Produk dan merakit naskah video 3 variasi di Script Generator.
   * *Endpoints & Model*:
     * URL API: `POST https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={key}`
     * Pilihan Model UI: `gemini-2.5-flash` (Default), `gemini-3.0-flash` (Terbaru), `gemini-2.0-flash` (Deprecated).
2. **Google Drive API** (Cloud Backup)
   * *Modul Pemanggil*: [js/01-gdrive.js](file:///Users/mhmdrzki/Documents/affiliate-manajemen/js/01-gdrive.js)
   * *Tujuan*: Backup terenkripsi otomatis dan pemulihan data lokal pengguna.
   * *Scope*: `https://www.googleapis.com/auth/drive.appdata` (AppData Folder aman terisolasi).
   * *Endpoints*:
     * Pencarian: `GET https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=name='affiliateos_data.json'`
     * Unduh: `GET https://www.googleapis.com/drive/v3/files/{fileId}?alt=media`
     * Pembaruan (PATCH): `PATCH https://www.googleapis.com/upload/drive/v3/files/{fileId}?uploadType=media`
     * Unggah Baru (POST Multipart): `POST https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart`
3. **SheetJS (XLSX.js)** (Data Parser)
   * *Modul Pemanggil*: [js/08-views.js](file:///Users/mhmdrzki/Documents/affiliate-manajemen/js/08-views.js)➔ `processFile(file)`
   * *Tujuan*: Menguraikan data biner spreadsheet laporan analitik konten yang diekspor dari seller/creator center TikTok Shop menjadi JSON lokal.

---

## 7. Risks / Blind Spots

Berikut adalah wilayah abu-abu atau risiko potensial yang perlu diperhatikan saat melakukan modifikasi fungsionalitas di masa depan:

1. **Tabrakan Deduplikasi String Pendek (12 Karakter)**
   * *Wilayah*: `copyOneBench` & `copyAllBench` di [js/08-views.js](file:///Users/mhmdrzki/Documents/affiliate-manajemen/js/08-views.js).
   * *Risiko*: Deduplikasi membandingkan 12 karakter pertama nama produk (`nama.substring(0,12)`). Bila ada dua produk berbeda dari benchmark yang diawali kata yang mirip (misalnya `"NEW HEXA Celana Jogger"` vs `"NEW HEXA Celana Chinos"`), sistem akan mendeteksi salah satunya sebagai duplikat dan menolak menyalinnya ke Master Produk.
2. **Ketergantungan Mutlak Layanan CDN Online**
   * *Wilayah*: `head` di [index.html](file:///Users/mhmdrzki/Documents/affiliate-manajemen/index.html).
   * *Risiko*: Aplikasi 100% bergantung pada CDN SheetJS (`xlsx.full.min.js`) dan Google GIS API (`gsi/client`). Apabila browser berada dalam kondisi offline total, library ini gagal dimuat sehingga melumpuhkan total fitur impor analitik dan koneksi Google Drive, meskipun aplikasi dijalankan dari protocol `file:///`.
3. **Implicit Flow Expired Tanpa Background Refresh**
   * *Wilayah*: `gdHandleExpired()` di [js/01-gdrive.js](file:///Users/mhmdrzki/Documents/affiliate-manajemen/js/01-gdrive.js).
   * *Risiko*: Otorisasi Google Drive menggunakan OAuth2 *Implicit Flow* tanpa refresh token. Setelah token habis (1 jam), operasi backup akan mendadak terputus (`HTTP 401`) dan langsung menghapus sesi token di `localStorage`. Ini memaksa pengguna mengklik tombol "Connect" ulang secara manual di sidebar tanpa adanya peringatan proaktif sebelum sesi mati.
4. **Perubahan Format Ekspor File TikTok Analytics**
   * *Wilayah*: `fk(row, ...keys)` di [js/08-views.js](file:///Users/mhmdrzki/Documents/affiliate-manajemen/js/08-views.js).
   * *Risiko*: Algoritma pencarian kolom analitik menggunakan pencocokan substring longgar (*fuzzy match*). Jika TikTok Shop mengubah penamaan kolom header secara drastis dalam ekspor analitiknya, kolom penting (seperti CTR/CTOR) tidak akan terdeteksi, sehingga importir mengabaikan data tersebut atau mengisi nilai `0`.
