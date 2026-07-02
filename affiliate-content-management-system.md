# Sistem Manajemen Konten Produk Affiliate TikTok Shop
## Planning Document — Ready to Execute

> **Tujuan dokumen ini:** Blueprint lengkap untuk membangun sistem yang secara otomatis menentukan jadwal konten produk affiliate TikTok Shop berdasarkan data penjualan, performa konten, status produk, dan prioritas bisnis (termasuk produk kerjasama).
>
> **Target pembaca:** AI eksekutor (Cursor, Claude Code, atau sejenisnya) yang akan membangun sistem ini dari nol.

---

## Daftar isi

1. [Konteks bisnis dan asumsi](#1-konteks-bisnis-dan-asumsi)
2. [Arsitektur sistem](#2-arsitektur-sistem)
3. [Skema data lengkap](#3-skema-data-lengkap)
4. [Logika penilaian produk](#4-logika-penilaian-produk)
5. [Algoritma generate jadwal](#5-algoritma-generate-jadwal)
6. [Alur kerja pengguna (User workflow)](#6-alur-kerja-pengguna-user-workflow)
7. [Spesifikasi fitur per modul](#7-spesifikasi-fitur-per-modul)
8. [Aturan bisnis kritis](#8-aturan-bisnis-kritis)
9. [Rekomendasi tech stack](#9-rekomendasi-tech-stack)
10. [Urutan eksekusi pembangunan](#10-urutan-eksekusi-pembangunan)
11. [Contoh skenario end-to-end](#11-contoh-skenario-end-to-end)

---

## 1. Konteks bisnis dan asumsi

### 1.1 Apa yang dilakukan pengguna sistem ini

Pengguna adalah seorang **affiliator TikTok Shop** yang:
- Mengelola puluhan hingga ratusan produk sekaligus dari berbagai seller
- Membuat konten video (bukan live) untuk mempromosikan produk
- Tujuan utama: mendapatkan order dari konten yang diposting, baik organik maupun yang "kena" GMV Max dari seller
- Setiap hari memposting konten dalam jumlah tertentu (misal 6 video/hari)
- Setiap minggu ada produk baru masuk, ada produk lama yang dihentikan

### 1.2 Memahami GMV Max (krusial untuk logika sistem)

**GMV Max** adalah sistem iklan otomatis TikTok Shop dari sisi seller. Cara kerjanya:
- Seller mengaktifkan GMV Max di Seller Center, memilih produk dan budget harian
- TikTok AI secara otomatis memilih video affiliate yang paling perform sebagai aset iklan
- Jika konten affiliate kamu dipilih, ordernya masuk sebagai **"Shop ads order"** di laporan affiliate
- Seller yang aktif GMV Max = seller yang rutin spend iklan = kontenmu punya peluang kena boost berulang

**Implikasi untuk sistem:**
- Produk dengan % "Shop ads order" tinggi = seller aktif GMV Max = prioritaskan lebih banyak konten
- Semakin banyak konten dibuat untuk produk dari seller GMV aktif, semakin besar peluang salah satunya dipilih algoritma TikTok sebagai aset iklan
- Ini sebabnya affiliator membuat puluhan konten untuk satu produk — bukan karena satu konten tidak cukup, tapi karena GMV Max memilih yang paling cocok dari semua konten yang tersedia

### 1.3 Mengapa data penjualan saja tidak cukup

Data penjualan TikTok hanya menampilkan produk yang **sudah menghasilkan order**. Sistem butuh data tambahan:

| Yang tidak ada di data penjualan | Dampak jika tidak ada |
|---|---|
| Produk yang sudah dikontenkan tapi belum laku | Tidak tahu mana yang perlu diberi waktu lebih vs dihentikan |
| Jumlah konten yang sudah dibuat per produk | Tidak bisa hitung efisiensi (berapa konten per order) |
| Tanggal konten pertama diposting | Tidak bisa tahu apakah produk "masih baru" atau "sudah lama stagnan" |
| Status stok seller | Bisa terus buat konten untuk produk yang stoknya habis |
| Performa video (views, CTR) | Tidak bisa bedakan produk tidak laku vs konten yang jelek |
| Komitmen produk kerjasama | Tidak bisa alokasikan slot khusus dengan deadline |

### 1.4 Asumsi sistem

- Pengguna memposting konten video (bukan live streaming)
- Data penjualan ditarik manual dari TikTok affiliate dashboard dalam format XLSX, bebas rentang waktu
- Status stok dan data konten diinput manual atau semi-manual oleh pengguna
- Sistem berjalan dalam siklus mingguan: pull data → update → generate jadwal → eksekusi → review
- Order dengan status "Ineligible" **diabaikan sepenuhnya** dalam semua perhitungan
- Satu "konten" = satu video yang diposting di TikTok untuk satu produk tertentu

---

## 2. Arsitektur sistem

### 2.1 Gambaran besar

```
┌─────────────────────────────────────────────────────────────────┐
│                        INPUT LAYER                              │
│                                                                 │
│  [A] Data Penjualan XLSX  [B] Log Konten  [C] Master Produk    │
│      (dari TikTok)            (manual)        (manual)          │
└──────────────────┬──────────────┬───────────────┬──────────────┘
                   │              │               │
                   ▼              ▼               ▼
┌─────────────────────────────────────────────────────────────────┐
│                      PROCESSING LAYER                           │
│                                                                 │
│  [1] Parser & Cleaner      → Buang Ineligible, normalize data  │
│  [2] Enrichment Engine     → Gabungkan 3 sumber data           │
│  [3] Scoring Engine        → Hitung skor per produk            │
│  [4] Classifier            → Tentukan status/label produk      │
│  [5] Schedule Generator    → Buat jadwal berdasarkan skor      │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                        OUTPUT LAYER                             │
│                                                                 │
│  [X] Jadwal konten harian   [Y] Laporan status produk          │
│  [Z] Alert & rekomendasi    [W] Log keputusan sistem           │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Siklus operasional (mingguan)

```
MINGGU MALAM (Review & Planning)
        │
        ├─ 1. Pull data penjualan terbaru dari TikTok (XLSX)
        ├─ 2. Update status stok per produk
        ├─ 3. Update log konten (tambah konten yang dibuat minggu ini)
        ├─ 4. Sistem auto-recalculate semua skor produk
        ├─ 5. Review alert: produk stagnant, stok habis, kerjasama mendekati deadline
        └─ 6. Generate jadwal untuk minggu depan
                │
                ▼
SENIN–SABTU (Eksekusi)
        │
        ├─ Posting konten sesuai jadwal
        ├─ Update log konten setelah posting (video ID, tanggal)
        └─ Catat performa video (views setelah 24 jam, opsional)
```

---

## 3. Skema data lengkap

### 3.1 Tabel `products` — Master produk

```
products
├── product_id          STRING  PK  — Product ID dari TikTok Shop (dari kolom "Product ID" di XLSX)
├── product_name        STRING      — Nama produk (bisa disingkat untuk display)
├── shop_name           STRING      — Nama toko seller (kolom "Shop name" di XLSX)
├── shop_code           STRING      — Kode toko (kolom "Shop code" di XLSX)
├── category            STRING      — Kategori manual: "parfum_pria" | "parfum_wanita" | "skincare" | "fashion" | dll
├── commission_rate     FLOAT       — Rate komisi dalam % (ambil dari kolom "Standard" atau "Shop ads" di XLSX)
├── avg_price           FLOAT       — Harga rata-rata produk (Rupiah, tanpa titik ribuan)
├── stock_status        ENUM        — "available" | "out_of_stock" | "unknown"
├── stock_updated_at    DATE        — Tanggal terakhir status stok diupdate manual
├── last_oos_started_at DATE        — Tanggal terakhir produk masuk kondisi out_of_stock, NULL jika belum pernah
├── last_oos_ended_at   DATE        — Tanggal terakhir produk kembali available dari out_of_stock, NULL jika belum pernah
├── pre_oos_classification ENUM     — Klasifikasi produk SEBELUM out_of_stock terakhir terjadi
│                                    Diisi otomatis oleh sistem saat stock_status berubah ke "out_of_stock"
│                                    Nilai: "PROVEN_WINNER" | "GMV_ACTIVE" | "GROWING" | dst, NULL jika belum pernah OOS
├── date_added          DATE        — Tanggal produk ini pertama kali ditambahkan ke sistem
├── is_collaboration    BOOLEAN     — TRUE jika produk ini adalah produk kerjasama berbayar
├── collab_target_count INTEGER     — Jumlah konten yang harus dibuat (jika kerjasama), NULL jika bukan
├── collab_deadline     DATE        — Batas waktu selesai (jika kerjasama), NULL jika bukan
├── collab_notes        STRING      — Catatan tambahan kerjasama (persyaratan khusus dll), NULL jika bukan
├── status              ENUM        — "active" | "paused" | "stopped"
│                                    "active" = masih dalam rotasi jadwal
│                                    "paused" = sementara tidak dijadwalkan (misal stok habis)
│                                    "stopped" = sudah dihentikan permanen
└── notes               STRING      — Catatan bebas dari pengguna
```

**Aturan pengisian:**
- `product_id` harus konsisten dengan yang ada di data penjualan TikTok — ini kunci penghubung antar tabel
- `stock_status` diupdate manual setiap minggu. Jika "out_of_stock", sistem otomatis exclude dari jadwal
- `commission_rate` diisi dari rate yang tertera di TikTok affiliate center, bukan dari data order (karena bisa berbeda per order)
- Saat `stock_status` berubah ke `"out_of_stock"`: sistem otomatis mengisi `last_oos_started_at` = hari ini dan menyimpan klasifikasi produk saat itu ke `pre_oos_classification`
- Saat `stock_status` berubah kembali ke `"available"`: sistem otomatis mengisi `last_oos_ended_at` = hari ini

---

### 3.1b Tabel `stock_history` — Riwayat perubahan status stok

Tabel ini adalah memori sistem tentang kapan saja sebuah produk pernah tidak bisa dijual. Digunakan untuk mengeluarkan periode tidak aktif dari semua kalkulasi waktu.

```
stock_history
├── id                  INTEGER PK  — Auto increment
├── product_id          STRING  FK  → products.product_id
├── status              ENUM        — "out_of_stock" | "available"
├── changed_at          DATE        — Tanggal status berubah ke nilai ini
├── changed_by          ENUM        — "user" (diubah manual) | "system" (trigger otomatis)
└── notes               STRING      — Alasan opsional (misal: "seller konfirmasi restock", "stok habis di app")
```

**Cara sistem menggunakan tabel ini:**

Setiap kali menghitung metrik berbasis waktu untuk sebuah produk, sistem terlebih dahulu menghitung total `suspended_days` — total hari di mana produk dalam kondisi `out_of_stock`:

```
suspended_days = SUM(
  untuk setiap pasangan (oos_start, oos_end) di stock_history produk ini:
    (oos_end - oos_start).days
)

Jika saat ini masih out_of_stock (belum ada oos_end):
  suspended_days += (TODAY - last_oos_started_at).days
```

Semua formula yang menggunakan rentang waktu kemudian menggunakan nilai efektif:

```
effective_day_span         = day_span - suspended_days
effective_days_since_last  = days_since_last_order - suspended_days_after_last_order
effective_days_since_first = days_since_first_content - suspended_days
```

---

### 3.2 Tabel `content_log` — Log setiap konten yang diposting

```
content_log
├── content_id          STRING  PK  — ID unik internal (format: CNT-YYYYMMDD-XXXX)
├── product_id          STRING  FK  → products.product_id
├── video_id            STRING      — Video ID dari TikTok (dari URL atau Creator Center), NULL sebelum diposting
├── posted_at           DATETIME    — Tanggal & jam posting
├── angle               STRING      — Deskripsi singkat angle/hook konten (maks 100 karakter)
│                                    Contoh: "review jujur", "before-after", "unboxing", "komparasi harga"
├── views_24h           INTEGER     — Views setelah 24 jam, NULL jika belum diupdate
├── views_7d            INTEGER     — Views setelah 7 hari, NULL jika belum diupdate
├── is_scheduled        BOOLEAN     — TRUE jika konten ini dari jadwal sistem, FALSE jika posting manual
├── schedule_slot       STRING      — Slot waktu dari jadwal (misal "18:00"), NULL jika tidak dari jadwal
└── notes               STRING      — Catatan bebas
```

**Aturan pengisian:**
- Setiap kali posting konten untuk produk manapun, tambah satu baris di tabel ini
- `video_id` bisa diisi setelah posting — ambil dari URL video TikTok
- `angle` wajib diisi — ini yang membedakan "konten ke-5 untuk produk yang sama" dari sisi pendekatan
- Views adalah opsional tapi sangat membantu sistem untuk menilai performa konten vs order

---

### 3.3 Tabel `sales_data` — Data penjualan dari TikTok (hasil import XLSX)

```
sales_data
├── order_id            STRING  PK  — Order ID dari TikTok (kolom "Order ID")
├── sku_id              STRING      — SKU ID (kolom "SKU ID")
├── product_id          STRING  FK  → products.product_id  — (kolom "Product ID")
├── product_name        STRING      — Nama produk dari TikTok (simpan asli untuk referensi)
├── video_id            STRING  FK  → content_log.video_id — (kolom "Content ID")
├── shop_code           STRING      — (kolom "Shop code")
├── order_type          ENUM        — "shop_ads" | "affiliate"  — dari kolom "Order type"
├── price               FLOAT       — Harga per item (kolom "Price")
├── items_sold          INTEGER     — Jumlah item terjual (kolom "Items sold")
├── gmv                 FLOAT       — Nilai GMV (kolom "GMV")
├── est_commission      FLOAT       — Total estimasi komisi
│                                    = "Est. standard commission" + "Est. Shop Ads commission"
├── actual_commission   FLOAT       — Komisi final yang benar-benar diterima (kolom "Total final earned amount")
├── settlement_status   ENUM        — "settled" | "pending" | "awaiting_payment"
│                                    CATATAN: "Ineligible" TIDAK DIIMPOR — buang saat parsing
├── ordered_at          DATETIME    — (kolom "Order date")
└── import_batch        STRING      — ID batch import (format: IMP-YYYYMMDD) untuk tracking
```

**Aturan parsing XLSX:**
1. Baca semua baris dari sheet pertama
2. **Buang baris dengan `Order settlement status` = "Ineligible"** sebelum menyimpan
3. Hitung `est_commission` = `Est. standard commission` + `Est. Shop Ads commission` (keduanya bisa 0 atau null)
4. Map `Order type`: "Shop ads order" → "shop_ads", "Affiliate order" → "affiliate"
5. Cek duplikat `order_id` — jika sudah ada di database, skip (jangan overwrite)
6. Simpan `import_batch` = tanggal hari import untuk audit trail

---

### 3.4 Tabel `product_scores` — Skor kalkulasi per produk (di-refresh otomatis)

```
product_scores
├── product_id          STRING  PK  FK → products.product_id
├── scored_at           DATETIME    — Kapan skor ini dihitung (di-refresh setiap pull data baru)
├── total_valid_orders  INTEGER     — Total order non-ineligible sepanjang waktu
├── unique_active_days  INTEGER     — Jumlah hari unik yang ada order (bukan total order)
├── day_span            INTEGER     — Selisih hari antara order pertama dan terakhir + 1
├── routineness_score   FLOAT       — unique_active_days / day_span × 100 (0–100)
├── shopads_pct         FLOAT       — % order yang bertipe "shop_ads" (0–100)
├── total_content_made  INTEGER     — Total konten yang sudah dibuat (dari content_log)
├── content_per_order   FLOAT       — total_content_made / total_valid_orders (efficiency ratio)
│                                    NULL jika total_valid_orders = 0
├── days_since_first_content INTEGER — Hari sejak konten pertama diposting (dari content_log)
├── days_since_last_order INTEGER   — Hari sejak order terakhir (NULL jika belum pernah ada order)
├── last_week_orders    INTEGER     — Order dalam 7 hari terakhir
├── prev_week_orders    INTEGER     — Order dalam 7–14 hari yang lalu
├── order_trend         ENUM        — "growing" | "stable" | "declining" | "dead"
│                                    growing: last_week > prev_week × 1.2
│                                    stable: dalam range ±20%
│                                    declining: last_week < prev_week × 0.8
│                                    dead: last_week = 0
├── classification      ENUM        — Label akhir (lihat bagian 4.3)
└── priority_score      FLOAT       — Skor gabungan 0–100 untuk urutan prioritas di jadwal
```

---

### 3.5 Tabel `schedules` — Jadwal yang di-generate sistem

```
schedules
├── schedule_id         STRING  PK  — ID unik jadwal (format: SCH-YYYYMMDD-XXXX)
├── product_id          STRING  FK  → products.product_id
├── scheduled_date      DATE        — Tanggal rencana posting
├── scheduled_slot      STRING      — Slot waktu (format: "HH:MM", misal "18:00")
├── slot_priority       ENUM        — "prime" | "regular" | "testing"
│                                    prime: 17:00–22:00
│                                    regular: 10:00–16:00
│                                    testing: 06:00–09:00
├── reason              STRING      — Alasan sistem menempatkan produk ini di slot ini (untuk transparansi)
│                                    Contoh: "Proven winner, slot prime time. Skor rutinitas: 100%"
├── is_collab_slot      BOOLEAN     — TRUE jika slot ini untuk memenuhi kewajiban kerjasama
├── status              ENUM        — "scheduled" | "done" | "skipped" | "rescheduled"
├── content_id          STRING  FK  → content_log.content_id — diisi setelah konten diposting
└── generated_at        DATETIME    — Kapan jadwal ini dibuat
```

---

## 4. Logika penilaian produk

### 4.1 Filter keras (hard filter) — dijalankan sebelum scoring

Produk yang memenuhi kondisi berikut **langsung dikeluarkan dari jadwal** tanpa perlu scoring:

```
HARD EXCLUDE:
  IF products.stock_status = "out_of_stock"  → exclude, tambah alert ke pengguna
  IF products.status = "stopped"             → exclude sepenuhnya
  IF products.status = "paused"              → exclude dari jadwal (tapi tetap di database)
  IF products.is_collaboration = TRUE
    AND collab_deadline < TODAY              → exclude, tandai sebagai overdue
```

### 4.2 Penghitungan skor komponen

Setelah hard filter, hitung komponen skor berikut untuk setiap produk yang lolos:

#### Skor Rutinitas (0–30 poin)
```
— Gunakan effective_day_span, bukan day_span mentah —
effective_day_span = day_span - suspended_days

routineness_score = (unique_active_days / effective_day_span) × 100

Konversi ke poin:
  IF routineness_score >= 75  → 30 poin  (sangat rutin)
  IF routineness_score >= 50  → 22 poin  (rutin)
  IF routineness_score >= 30  → 14 poin  (semi-rutin)
  IF routineness_score >= 10  → 6 poin   (sporadic)
  IF routineness_score < 10   → 0 poin   (hampir tidak pernah)

CATATAN: Jika effective_day_span <= 3, gunakan routineness_score = 50 (terlalu dini untuk dinilai)
CATATAN: Hari-hari saat produk out_of_stock tidak dihitung dalam unique_active_days maupun effective_day_span
```

#### Skor Volume Order (0–25 poin)
```
Berdasarkan total_valid_orders:
  >= 100 order  → 25 poin
  >= 50 order   → 20 poin
  >= 20 order   → 15 poin
  >= 10 order   → 10 poin
  >= 5 order    → 6 poin
  >= 1 order    → 3 poin
  = 0 order     → 0 poin
```

#### Skor Sinyal GMV Max (0–25 poin)
```
Berdasarkan shopads_pct:
  >= 90%  → 25 poin  (seller sangat aktif GMV Max)
  >= 70%  → 20 poin  (seller aktif)
  >= 50%  → 14 poin  (campuran)
  >= 30%  → 8 poin   (kebanyakan organik)
  < 30%   → 3 poin   (organik murni / seller tidak iklan)
  = N/A   → 0 poin   (belum pernah ada order — tidak diketahui)

CATATAN: Jika total_valid_orders = 0, skor GMV = 0 (tidak bisa dinilai)
```

#### Skor Tren (0–20 poin)
```
Berdasarkan order_trend:
  "growing"   → 20 poin
  "stable"    → 14 poin
  "declining" → 5 poin
  "dead"      → 0 poin

Jika days_since_first_content <= 7 (produk sangat baru):
  Override tren → 12 poin (netral, terlalu dini untuk dihukum)
```

#### Penalti Stagnasi (-0 sampai -20 poin)
```
— Semua kalkulasi menggunakan nilai EFEKTIF (sudah dikurangi suspended_days) —

effective_days_since_first = days_since_first_content - suspended_days
effective_days_since_last  = days_since_last_order - suspended_days_after_last_order

Kondisi stagnasi:
  IF effective_days_since_first > 14 AND total_valid_orders = 0:
    penalti = MIN(20, (effective_days_since_first - 14) × 1.5)
    → Makin lama stagnan secara efektif, makin besar penalti
    → Periode out_of_stock TIDAK dihitung sebagai hari stagnan

  IF effective_days_since_last > 21 AND last_week_orders = 0:
    penalti += 10  (pernah dapat order tapi sudah 3 minggu efektif mati)
    → Jika produk baru saja restock (last_oos_ended_at dalam 7 hari terakhir),
      penalti ini TIDAK dikenakan — beri waktu pemulihan pasca restock
```

#### Skor Akhir
```
priority_score = skor_rutinitas + skor_volume + skor_gmv + skor_tren - penalti_stagnasi

Range: 0 – 100 (bisa minus teoritis, di-floor ke 0)
```

### 4.3 Klasifikasi produk

Setelah skor dihitung, tentukan `classification`:

```
PROVEN_WINNER:
  priority_score >= 60
  AND routineness_score >= 50
  AND total_valid_orders >= 10
  → Produk terbukti rutin dan volume tinggi

GMV_ACTIVE:
  priority_score >= 35
  AND shopads_pct >= 70
  AND total_valid_orders >= 3
  → Seller aktif GMV Max, ada bukti order, layak dipush lebih banyak konten

EARLY_STAGE:
  days_since_first_content <= 14
  AND total_content_made <= 10
  → Produk baru, belum bisa dinilai, beri kesempatan

GROWING:
  order_trend = "growing"
  AND total_valid_orders >= 3
  → Tren naik, perlu didorong

MONITOR:
  priority_score >= 15
  AND NOT termasuk kategori di atas
  → Ada sinyal tapi belum kuat, pantau

SPIKE_ONLY:
  total_valid_orders >= 5
  AND routineness_score < 25
  AND unique_active_days <= 3
  → Order terpusat di 1–3 hari saja, tidak rutin

STAGNANT:
  effective_days_since_first_content > 14
  AND total_valid_orders = 0
  AND (last_oos_ended_at IS NULL OR last_oos_ended_at < TODAY - 7)
  → Sudah cukup lama secara efektif tapi belum pernah dapat order sama sekali
  → Periode out_of_stock tidak dihitung, dan produk yang baru restock dalam 7 hari diberi pengecualian

DECLINING:
  order_trend = "declining"
  AND effective_days_since_last_order > 14
  AND (last_oos_ended_at IS NULL OR last_oos_ended_at < TODAY - 7)
  → Pernah dapat order tapi sudah lama mati secara efektif
  → Produk yang baru restock tidak dikategorikan DECLINING langsung

RESTOCK_RECOVERY:
  last_oos_ended_at >= TODAY - 7        ← baru restock dalam 7 hari terakhir
  AND pre_oos_classification IS NOT NULL ← pernah punya riwayat sebelum OOS
  AND total_valid_orders_post_restock = 0 ← belum ada order sejak restock
  → Produk baru kembali tersedia, belum cukup waktu untuk dinilai ulang
  → Sistem membawa memori pre_oos_classification sebagai referensi potensi
  → Diperlakukan seperti EARLY_STAGE tapi dengan konteks riwayat sebelumnya
  → Setelah 7 hari atau setelah ada 1 order pasca restock → keluar dari status ini

RESTOCK_CONFIRMED:
  last_oos_ended_at >= TODAY - 14       ← restock dalam 14 hari terakhir
  AND total_valid_orders_post_restock >= 1 ← sudah ada order pasca restock
  AND pre_oos_classification IN ["PROVEN_WINNER", "GMV_ACTIVE"]
  → Produk terbukti kembali aktif setelah restock
  → Sistem mengembalikan klasifikasi ke pre_oos_classification secara langsung
  → Tidak perlu mulai dari nol — riwayat sebelum OOS tetap diperhitungkan

COLLABORATION (override):
  is_collaboration = TRUE
  AND collab_deadline >= TODAY
  AND collab_content_made < collab_target_count
  → Selalu masuk jadwal sampai target terpenuhi atau deadline lewat
  → Classification ini di-override di atas semua klasifikasi lain
```

**Catatan penting:** Satu produk hanya memiliki satu klasifikasi. Urutan pengecekan dari atas ke bawah — jika memenuhi syarat PROVEN_WINNER, tidak perlu cek yang lain.

**Urutan pengecekan lengkap (termasuk status restock):**
```
1. COLLABORATION (override tertinggi)
2. RESTOCK_CONFIRMED (sudah terbukti aktif kembali → langsung ke klasifikasi sebelumnya)
3. PROVEN_WINNER
4. GMV_ACTIVE
5. RESTOCK_RECOVERY (baru restock, belum ada order)
6. GROWING
7. EARLY_STAGE
8. MONITOR
9. SPIKE_ONLY
10. STAGNANT
11. DECLINING
```

---

## 5. Algoritma generate jadwal

### 5.1 Input dari pengguna saat generate

```
generate_schedule(
  start_date,          // Tanggal mulai jadwal
  end_date,            // Tanggal akhir jadwal
  posts_per_day,       // Berapa konten per hari (misal: 6)
  exclude_days,        // Hari yang dikosongkan (misal: ["Sunday"])
  force_include,       // Product ID yang wajib masuk (opsional)
  force_exclude        // Product ID yang tidak boleh masuk (opsional)
)
```

### 5.2 Definisi slot waktu

Sistem membagi hari menjadi 3 tier slot berdasarkan data historis penjualan:

```
PRIME TIME slots (prioritas PROVEN_WINNER dan GMV_ACTIVE):
  Slot A: 18:00
  Slot B: 20:00
  Slot C: 21:00

REGULAR slots (prioritas GROWING dan MONITOR):
  Slot D: 10:00
  Slot E: 12:00
  Slot F: 15:00

TESTING slots (prioritas EARLY_STAGE dan produk baru):
  Slot G: 06:30
  Slot H: 09:00
```

Jika `posts_per_day = 6`, sistem mengisi: Slot A, B, C (prime) + Slot D, E, F (regular).
Jika `posts_per_day = 4`, sistem mengisi: Slot A, B (prime) + Slot D, E (regular).
Jika `posts_per_day = 8`, sistem mengisi: semua 6 slot di atas + Slot G, H (testing).

### 5.3 Algoritma utama generate jadwal

```
STEP 1 — Persiapan
  1a. Ambil semua produk dengan status = "active" dan stock_status != "out_of_stock"
  1b. Jalankan hard filter (lihat 4.1)
  1c. Hitung product_scores untuk semua produk yang lolos
  1d. Urutkan produk berdasarkan priority_score descending

STEP 2 — Hitung beban kerjasama (collaboration obligation)
  Untuk setiap produk dengan is_collaboration = TRUE dan deadline aktif:
    collab_remaining = collab_target_count - collab_content_made
    days_until_deadline = (collab_deadline - today).days
    collab_daily_rate = ceil(collab_remaining / days_until_deadline)
    
    Tandai produk ini dengan flag COLLAB_REQUIRED
    collab_slots_needed_in_range = ceil(collab_remaining × (date_range / days_until_deadline))
    
    CATATAN: collab_slots_needed_in_range tidak boleh melebihi collab_remaining
    Ini mencegah sistem menjadwalkan semua sisa kewajiban di awal rentang waktu

STEP 3 — Bangun pool produk per slot tier
  prime_pool   = produk dengan classification IN ["PROVEN_WINNER", "GMV_ACTIVE"] 
                 urut berdasarkan priority_score DESC
  regular_pool = produk dengan classification IN ["GROWING", "MONITOR", "SPIKE_ONLY"]
                 urut berdasarkan priority_score DESC
  testing_pool = produk dengan classification IN ["EARLY_STAGE", "STAGNANT"]
                 urut berdasarkan priority_score DESC (STAGNANT di bawah EARLY_STAGE)

STEP 4 — Untuk setiap hari dalam rentang (lewati exclude_days):
  
  4a. Inisialisasi slot_list = daftar slot sesuai posts_per_day
  
  4b. Sisipkan produk COLLAB_REQUIRED terlebih dahulu:
      Untuk setiap produk collab, cek apakah perlu dijadwalkan hari ini:
        Hitung apakah sudah diposting cukup di hari-hari sebelumnya dalam range ini
        Jika belum, sisipkan ke slot REGULAR yang tersedia (bukan prime, kecuali tidak ada slot lain)
        Tandai slot tersebut sebagai is_collab_slot = TRUE
      
  4c. Isi sisa slot prime dengan produk dari prime_pool:
      Aturan distribusi harian:
        Satu produk maksimal 2× dalam satu hari (cegah over-expose satu produk)
        Produk yang sudah 2× diposting hari ini → skip ke produk berikutnya di pool
        Produk yang diposting kemarin di slot yang sama → pertimbangkan rotasi ke produk lain
          (bukan aturan keras, tapi diutamakan variasi)
      
  4d. Isi slot regular dengan produk dari regular_pool (aturan sama: maks 2× per hari)
  
  4e. Isi slot testing dengan produk dari testing_pool (maks 1× per hari per produk)
      Jika testing_pool kosong → isi dengan produk dari regular_pool yang belum dapat slot hari ini
  
  4f. Jika setelah semua langkah masih ada slot kosong:
      Isi dengan produk dari prime_pool atau regular_pool yang priority_score tertinggi
      Boleh melebihi 2× per hari jika tidak ada pilihan lain
  
  4g. Untuk setiap slot yang terisi, generate reason string:
      Contoh: "PROVEN_WINNER | Skor: 87 | Rutinitas: 100% | Slot prime 18:00"
      Contoh: "COLLABORATION | Sisa kewajiban: 2 dari 3 | Deadline: 2026-07-10"

STEP 5 — Validasi output
  5a. Pastikan setiap produk COLLAB_REQUIRED mendapatkan slot yang cukup dalam rentang
  5b. Pastikan tidak ada slot kosong (jika ada, log warning)
  5c. Pastikan produk STAGNANT yang sudah >30 hari tidak mendominasi slot (maks 1 slot/hari)
  5d. Return jadwal lengkap beserta summary:
      - Total slot diisi: X
      - Produk kerjasama terjadwalkan: X/Y slot
      - Produk baru yang masuk: [list]
      - Produk yang di-exclude beserta alasan: [list]
```

### 5.4 Aturan anti-monoton

Sistem harus mencegah jadwal yang terlalu monoton:

```
Anti-monoton rules:
  1. Produk yang sama tidak boleh mengisi >40% dari total slot dalam satu hari
     Jika posts_per_day = 6, satu produk maks 2 slot per hari
  
  2. Dalam satu minggu, setiap slot PRIME TIME harus ada setidaknya 2 produk berbeda
     Contoh salah:  Slot 18:00 → MS Glow 6 hari berturut-turut
     Contoh benar:  Slot 18:00 → MS Glow 3 hari, Bali Surfers 3 hari
  
  3. Slot TESTING harus selalu diisi produk yang berbeda dari prime dan regular hari itu
     (kecuali tidak ada produk testing tersedia sama sekali)
  
  4. Jika dua produk memiliki priority_score yang berdekatan (selisih < 5 poin),
     sistem melakukan round-robin di antara keduanya daripada selalu memilih yang lebih tinggi
```

---

## 6. Alur kerja pengguna (User workflow)

### 6.1 Setup awal (sekali saja)

```
1. Isi tabel PRODUCTS:
   - Tambahkan semua produk yang sedang atau pernah dipromosikan
   - Isi: product_id (dari TikTok), nama, seller, komisi %, status stok
   - Tandai produk kerjasama dengan flag is_collaboration dan isi detail-nya

2. Isi tabel CONTENT_LOG secara retroaktif:
   - Untuk produk yang sudah pernah diposting, masukkan log konten yang ada
   - Minimal isi: product_id, posted_at, angle
   - Video ID bisa diisi kemudian

3. Import data penjualan pertama:
   - Upload XLSX dari TikTok
   - Sistem parse dan isi tabel SALES_DATA
   - Sistem auto-calculate semua skor (product_scores)

4. Review hasil klasifikasi pertama:
   - Cek apakah ada produk yang salah klasifikasi
   - Adjust status produk jika perlu (misal: force "paused" untuk produk stok habis)

5. Generate jadwal pertama
```

### 6.2 Siklus mingguan (rutin setiap Minggu malam)

```
STEP 1 — Sinkronisasi data (±15 menit)
  □ Pull data penjualan dari TikTok untuk 7 hari terakhir (atau sejak pull terakhir)
  □ Upload XLSX ke sistem → sistem auto-parse dan update SALES_DATA
  □ Update status stok setiap produk yang tahu ada perubahan
    Tandai "out_of_stock" jika ada konfirmasi dari seller atau tidak muncul di TikTok Shop

STEP 2 — Update log konten (±10 menit)
  □ Untuk setiap konten yang diposting minggu ini, pastikan sudah tercatat di CONTENT_LOG
  □ Tambahkan video_id jika belum diisi
  □ Opsional: isi views_24h atau views_7d untuk video minggu lalu

STEP 3 — Review alert dari sistem (±10 menit)
  □ Cek daftar produk STAGNANT baru (sudah >14 hari, 0 order)
     → Putuskan: lanjut, pause, atau stop?
  □ Cek produk kerjasama mendekati deadline
     → Apakah slot yang diberikan minggu ini cukup?
  □ Cek produk DECLINING
     → Apakah perlu dikurangi frekuensinya?
  □ Cek produk yang baru naik ke PROVEN_WINNER atau GMV_ACTIVE
     → Pertimbangkan naikkan slot

STEP 4 — Tambah produk baru (opsional, ±5 menit)
  □ Jika ada produk baru dari master list atau kerjasama baru:
     → Tambahkan ke tabel PRODUCTS
     → Sistem otomatis masukkan ke EARLY_STAGE
     → Sistem akan memasukkannya ke slot TESTING di jadwal

STEP 5 — Generate jadwal minggu depan
  □ Input: start_date (Senin), end_date (Sabtu), posts_per_day, exclude_days = ["Sunday"]
  □ Tambahkan force_include jika ada produk yang ingin dipaksa masuk
  □ Review output jadwal — apakah masuk akal?
  □ Jika ada yang tidak sesuai, adjust manual lalu simpan

STEP 6 — Export jadwal
  □ Export ke format yang mudah diakses (CSV, atau tampil di antarmuka)
  □ Jadwal siap dieksekusi Senin–Sabtu
```

### 6.3 Alur update harian (opsional, ±5 menit)

```
Setelah posting konten:
  □ Buka CONTENT_LOG
  □ Tandai schedule.status = "done" untuk slot yang sudah diposting
  □ Isi content_log.video_id jika belum ada

Jika tidak bisa posting sesuai jadwal:
  □ Tandai schedule.status = "skipped" atau "rescheduled"
  □ Catatan: sistem tidak otomatis reschedule — pengguna decide
```

---

## 7. Spesifikasi fitur per modul

### 7.1 Modul Import Data Penjualan

**Input:** File XLSX dari TikTok affiliate dashboard (format seperti data yang dianalisis)

**Proses:**
```
1. Baca sheet pertama dari XLSX
2. Identifikasi header row (baris pertama)
3. Map kolom:
   "Order ID"              → order_id
   "Product ID"            → product_id
   "Content ID"            → video_id
   "Shop code"             → shop_code
   "Order type"            → order_type (map: "Shop ads order"→"shop_ads", "Affiliate order"→"affiliate")
   "Price"                 → price
   "Items sold"            → items_sold
   "GMV"                   → gmv
   "Est. standard commission" + "Est. Shop Ads commission" → est_commission (sum keduanya)
   "Total final earned amount" → actual_commission
   "Order settlement status" → settlement_status
   "Order date"            → ordered_at (parse: "DD/MM/YYYY HH:MM:SS")
4. BUANG semua baris dengan settlement_status = "Ineligible"
5. Cek duplikat order_id — skip jika sudah ada
6. Insert ke sales_data dengan import_batch = tanggal hari ini
7. Trigger recalculate product_scores untuk semua product_id yang terpengaruh
8. Return summary: {rows_imported, rows_skipped_duplicate, rows_skipped_ineligible}
```

**Output:** Konfirmasi import + summary + list produk yang skornya berubah

---

### 7.2 Modul Scoring Engine

**Trigger:** Otomatis setiap kali ada import data penjualan baru, atau bisa dijalankan manual.

**Proses:** Jalankan semua kalkulasi di bagian 4.2 untuk setiap produk aktif.

**Output:** Update tabel `product_scores` dengan timestamp `scored_at` terbaru.

---

### 7.3 Modul Laporan Status Produk

Menghasilkan laporan yang bisa dilihat pengguna, menampilkan:

```
Untuk setiap produk aktif:
  - Nama produk (disingkat jika terlalu panjang)
  - Classification (dengan warna/ikon berbeda per label)
  - Priority score (angka 0–100)
  - Total order valid (all time)
  - Order minggu ini vs minggu lalu (dengan indikator ↑↓→)
  - Hari aktif / total span (misal: "22/22 hari")
  - Shop ads % (indikator seberapa aktif seller GMV Max)
  - Jumlah konten dibuat (all time)
  - Hari sejak konten pertama
  - Status stok
  - Alert khusus (jika ada): "⚠️ Stagnant 18 hari", "⏰ Kerjasama: 2 hari lagi deadline", "🔴 Stok habis"
```

**Sorting default:** priority_score descending.

**Filter tersedia:** per classification, per seller, per status stok, per kategori.

---

### 7.4 Modul Alert & Notifikasi

Sistem menghasilkan alert otomatis setiap kali scoring dijalankan:

```
ALERT TYPES:

🔴 CRITICAL (harus ditindaklanjuti):
  - Produk dengan is_collaboration = TRUE dan deadline dalam 3 hari, sisa kewajiban > 0
  - Produk dengan stock_status = "out_of_stock" yang masih ada di jadwal aktif
  - Produk kerjasama yang deadline-nya sudah lewat dan belum terpenuhi

🟡 WARNING (perlu perhatian):
  - Produk STAGNANT baru (baru melewati 14 hari 0 order untuk pertama kali)
  - Produk yang turun dari PROVEN_WINNER ke status di bawahnya
  - Produk kerjasama dengan deadline dalam 7 hari
  - Produk DECLINING yang sudah 3 minggu berturut-turut turun

🟢 INFO (informasional):
  - Produk yang naik ke PROVEN_WINNER atau GMV_ACTIVE untuk pertama kali
  - Produk EARLY_STAGE yang baru mendapat order pertamanya
  - Rekap mingguan: total order, total komisi estimasi, produk terbaik
```

---

### 7.5 Modul Generate Jadwal

Implementasi dari algoritma di bagian 5. Output jadwal dalam format:

```
Jadwal Konten — Senin 30 Jun s/d Sabtu 5 Jul 2026
6 konten/hari × 6 hari = 36 slot total

SENIN, 30 Jun
  06:30 | [EARLY_STAGE]  | Produk Baru X         | Score: 12 | "Baru 3 hari, testing angle review"
  10:00 | [MONITOR]      | SAFF SOTB             | Score: 38 | "GMV 100%, perlu lebih banyak konten"
  12:00 | [PROVEN_WINNER]| MS Glow For Men       | Score: 87 | "Rutin 100%, prime slot"
  15:00 | [GROWING]      | Bali Surfers 100ml    | Score: 52 | "Tren naik, dorong lebih"
  18:00 | [PROVEN_WINNER]| Bali Surfers 37ml     | Score: 81 | "Rutin 75%, prime slot"
  20:00 | [PROVEN_WINNER]| MS Glow For Men       | Score: 87 | "Slot prime kedua untuk winner"

SELASA, 1 Jul
  ...

SUMMARY JADWAL:
  Produk kerjasama: 2 slot dari 5 kewajiban minggu ini (sisa 3 di 2 minggu ke depan)
  Produk baru testing: 1 produk (Produk Baru X)
  Produk STAGNANT yang di-include: 0
  Produk yang di-exclude karena stok habis: Clone You Man EDP
```

---

## 8. Aturan bisnis kritis

Ini adalah aturan yang TIDAK BOLEH dilanggar oleh sistem apapun kondisinya:

```
RULE 1 — Ineligible diabaikan total
  Tidak ada satu pun order dengan status "Ineligible" yang masuk ke perhitungan manapun.
  Ini berlaku di semua kalkulasi: skor, rutinitas, tren, komisi.

RULE 2 — Stok habis = tidak ada jadwal
  Produk dengan stock_status = "out_of_stock" tidak boleh muncul di jadwal manapun.
  Sistem harus aktif mengeluarkannya, bukan menunggu pengguna manual remove.

RULE 3 — Kerjasama dihitung proporsional
  Jika ada produk kerjasama dengan sisa 3 konten dalam 10 hari, dan pengguna minta jadwal 3 hari,
  sistem tidak menjadwalkan semua 3 konten dalam 3 hari itu.
  Sistem menjadwalkan: ceil(3 × 3/10) = 1 konten untuk 3 hari tersebut.
  Sisa 2 konten akan dijadwalkan di sesi generate berikutnya.
  EXCEPTION: Jika deadline dalam ≤ 3 hari dan masih banyak sisa kewajiban,
  sistem boleh menjadwalkan semua sisa kewajiban tersebut sekaligus + tampilkan CRITICAL alert.

RULE 4 — Total order ≠ satu-satunya indikator
  Sistem tidak boleh menggunakan total order saja sebagai dasar keputusan.
  Selalu kombinasikan dengan: hari aktif, distribusi temporal, dan sinyal GMV.
  Clone You Man EDP (19 order tapi 6/16 hari aktif) harus di-classify berbeda
  dari MS Glow For Men (149 order, 22/22 hari aktif).

RULE 5 — Spike tidak sama dengan winner
  Produk dikategorikan SPIKE_ONLY jika: unique_active_days ≤ 3 dari total hari span.
  Produk SPIKE_ONLY mendapat prioritas lebih rendah dari PROVEN_WINNER dan GMV_ACTIVE.

RULE 6 — Beri waktu untuk produk baru
  Produk yang baru masuk (days_since_first_content ≤ 14) tidak boleh dikategorikan STAGNANT
  meski belum ada order sama sekali. Statusnya adalah EARLY_STAGE.
  Penalti stagnasi baru aktif setelah 14 hari.

RULE 7 — Satu hari = maksimal 40% dari total slot untuk satu produk
  Jika posts_per_day = 6, satu produk maksimal 2 slot per hari (33%).
  Jika posts_per_day = 3, satu produk maksimal 1 slot per hari (33%).
  EXCEPTION: Jika hanya ada 1–2 produk aktif di sistem, aturan ini boleh dilonggarkan.

RULE 8 — Hari review tidak diisi jadwal
  Hari yang ditandai sebagai exclude_days tidak boleh ada jadwal konten apapun,
  termasuk untuk produk kerjasama dengan deadline ketat.
```

---

## 9. Rekomendasi tech stack

### 9.1 Level 1 — Spreadsheet (untuk mulai cepat)

**Tool:** Google Sheets atau Excel

**Struktur:**
```
Tab 1: Products          → tabel products manual
Tab 2: Content Log       → tabel content_log manual
Tab 3: Sales Data        → paste data dari XLSX TikTok
Tab 4: Scores            → formula otomatis hitung semua skor
Tab 5: Schedule Output   → jadwal yang di-generate (semi-manual dengan bantuan formula)
Tab 6: Alerts            → conditional formatting + formula untuk alert
```

**Kelemahan:** Generate jadwal masih semi-manual, tidak bisa fully otomatis.

---

### 9.2 Level 2 — No-code database (rekomendasi untuk medium scale)

**Tool:** Airtable atau Notion Database

**Kelebihan:**
- Bisa otomasi dengan Airtable Automations atau Make.com
- Import XLSX bisa dilakukan dengan Zapier/Make
- View yang fleksibel (Kanban, Calendar, Gallery)
- Bisa diakses dari HP

**Keterbatasan:** Logika generate jadwal tetap perlu dibantu script eksternal (Python/JS via API).

---

### 9.3 Level 3 — Aplikasi custom (untuk scale besar, >100 produk aktif)

**Backend:**
```
Language:  Python 3.11+
Framework: FastAPI
Database:  PostgreSQL (atau SQLite untuk single-user)
ORM:       SQLAlchemy
Scheduler: APScheduler (untuk trigger otomatis tiap Minggu malam)
```

**Frontend:**
```
Framework: Next.js (React) atau simple dengan Streamlit (Python)
Tabel:     TanStack Table
Charts:    Recharts atau Chart.js
```

**Struktur folder project:**
```
affiliate-cms/
├── backend/
│   ├── main.py                 — FastAPI app entry point
│   ├── models/
│   │   ├── product.py          — ORM model untuk tabel products
│   │   ├── content_log.py      — ORM model untuk content_log
│   │   ├── sales_data.py       — ORM model untuk sales_data
│   │   ├── product_score.py    — ORM model untuk product_scores
│   │   └── schedule.py         — ORM model untuk schedules
│   ├── services/
│   │   ├── importer.py         — Logic parse & import XLSX
│   │   ├── scorer.py           — Logic hitung semua skor (bagian 4.2)
│   │   ├── classifier.py       — Logic klasifikasi produk (bagian 4.3)
│   │   ├── scheduler.py        — Algoritma generate jadwal (bagian 5.3)
│   │   └── alerter.py          — Logic generate alerts (bagian 7.4)
│   ├── api/
│   │   ├── products.py         — CRUD endpoints products
│   │   ├── content.py          — CRUD endpoints content_log
│   │   ├── import.py           — Endpoint upload XLSX
│   │   ├── schedules.py        — Endpoint generate & fetch jadwal
│   │   └── reports.py          — Endpoint laporan & alerts
│   └── utils/
│       ├── xlsx_parser.py      — Fungsi parsing spesifik format TikTok
│       └── date_helpers.py     — Helper kalkulasi tanggal
├── frontend/
│   ├── pages/
│   │   ├── dashboard.tsx       — Halaman utama: skor produk + alerts
│   │   ├── products.tsx        — Manajemen produk
│   │   ├── content.tsx         — Log konten
│   │   ├── schedule.tsx        — Generate & lihat jadwal
│   │   └── import.tsx          — Upload data penjualan
│   └── components/
│       ├── ProductTable.tsx    — Tabel produk dengan sorting & filter
│       ├── ScheduleGrid.tsx    — Tampilan jadwal per hari
│       ├── AlertBanner.tsx     — Komponen alert
│       └── ScoreChart.tsx      — Visualisasi distribusi skor
└── tests/
    ├── test_scorer.py          — Unit test semua formula scoring
    ├── test_classifier.py      — Unit test logika klasifikasi
    ├── test_scheduler.py       — Unit test generate jadwal (termasuk edge cases)
    └── test_importer.py        — Unit test parse XLSX
```

---

## 10. Urutan eksekusi pembangunan

Bangun dalam urutan ini untuk memastikan setiap bagian bisa ditest sebelum lanjut:

### Fase 1 — Foundation (prioritas tertinggi)
```
[ ] 1.1 Setup database dengan semua tabel di bagian 3
[ ] 1.2 Bangun xlsx_parser.py — parsing file TikTok, buang Ineligible, insert ke sales_data
[ ] 1.3 Bangun CRUD dasar untuk tabel products dan content_log
[ ] 1.4 Test: import file XLSX sample, pastikan data masuk dengan benar
```

### Fase 2 — Scoring engine (inti sistem)
```
[ ] 2.1 Implementasi scorer.py — semua formula di bagian 4.2
[ ] 2.2 Implementasi classifier.py — logika klasifikasi di bagian 4.3
[ ] 2.3 Unit test untuk scorer dan classifier dengan data sample
[ ] 2.4 Test dengan edge cases:
         - Produk yang baru 1 hari (days_since_first_content = 1)
         - Produk dengan 0 order sama sekali
         - Produk dengan 100% ineligible orders (yang sudah dibuang)
         - Produk kerjasama yang deadline-nya besok
```

### Fase 3 — Schedule generator
```
[ ] 3.1 Implementasi scheduler.py — algoritma di bagian 5.3
[ ] 3.2 Test generate jadwal dengan skenario berbeda:
         - 3 hari, 4 konten/hari
         - 7 hari, 6 konten/hari
         - Ada produk kerjasama aktif
         - Ada produk stok habis
         - Hanya 2 produk aktif (edge case pool kosong)
[ ] 3.3 Validasi output: tidak ada slot kosong, aturan bisnis terpenuhi
```

### Fase 4 — Alert system
```
[ ] 4.1 Implementasi alerter.py
[ ] 4.2 Test semua tipe alert
[ ] 4.3 Integrasi alerter dengan trigger post-import
```

### Fase 5 — API & antarmuka
```
[ ] 5.1 Bangun semua endpoints API
[ ] 5.2 Bangun halaman produk (tabel + form tambah/edit)
[ ] 5.3 Bangun halaman import XLSX
[ ] 5.4 Bangun halaman jadwal (generate + tampil + export)
[ ] 5.5 Bangun halaman dashboard (summary + alerts)
[ ] 5.6 End-to-end test dengan skenario nyata (gunakan data XLSX yang ada)
```

---

## 11. Contoh skenario end-to-end

### Skenario A — Minggu pertama setup

```
Input situasi:
  - 50 produk di master list
  - 30 sudah pernah dikontenkan
  - 5 sudah pernah laku
  - 2 adalah produk kerjasama
  - 1 produk (Clone You Man EDP) stok habis

Yang diharapkan sistem:
  1. Import XLSX → 382 order valid masuk ke sales_data
  2. Clone You Man EDP → stock_status = "out_of_stock" (diinput manual) → hard excluded
  3. MS Glow For Men → PROVEN_WINNER (skor 87)
  4. Bali Surfers 37ml → PROVEN_WINNER (skor 81)
  5. 25 produk yang sudah dikontenkan tapi 0 order → 
       Jika <14 hari diposting → EARLY_STAGE
       Jika >14 hari diposting → STAGNANT → alert WARNING
  6. 2 produk kerjasama → classification override = COLLABORATION
  7. 20 produk belum pernah dikontenkan → tidak muncul di jadwal sampai diaktifkan manual
  
  Generate jadwal 7 hari, 6 konten/hari:
  - Slot prime (18:00, 20:00) → MS Glow + Bali Surfers, round-robin
  - Slot regular → produk EARLY_STAGE dan GROWING
  - 1 slot/hari → 1 produk kerjasama (proporsional)
  - Sisanya → produk EARLY_STAGE dari master yang dipilihkan sistem
```

### Skenario B — Pull data minggu ke-4, ada perubahan drastis

```
Input situasi:
  - Clone You Man EDP mulai ada order lagi (seller restock)
  - Bath Ritual tiba-tiba spike 10 order dalam 2 hari
  - BYREX Focus EDP sudah 3 minggu mati total
  - Ada 1 produk baru masuk kerjasama: deadline 10 hari, target 5 konten

Yang diharapkan sistem:
  1. Clone You Man EDP:
     - stock_status diupdate ke "available" (manual oleh pengguna)
     - Masuk kembali ke pool, mulai dari EARLY_STAGE (hari aktif baru)
  
  2. Bath Ritual spike:
     - Jika 10 order dalam 2 hari → routineness_score = 2/2 = 100% tapi day_span pendek
     - Setelah seminggu tidak ada order → drop ke SPIKE_ONLY
     - Alert: "Bath Ritual: spike terdeteksi, pantau 7 hari ke depan"
  
  3. BYREX Focus EDP:
     - days_since_last_order > 21, last_week_orders = 0
     - order_trend = "dead" → classification = DECLINING
     - Alert WARNING: "BYREX Focus EDP: 21 hari tanpa order. Pertimbangkan untuk stop atau ganti angle konten."
  
  4. Produk kerjasama baru:
     - is_collaboration = TRUE, target = 5, deadline = 10 hari
     - collab_daily_rate = ceil(5/10) = 1 konten/hari
     - Masuk sebagai COLLABORATION override
     - Alert INFO: "Produk kerjasama baru ditambahkan. Target: 5 konten dalam 10 hari."
```

### Skenario C — Generate jadwal 3 hari dengan kerjasama aktif

```
Input:
  generate_schedule(
    start_date = "2026-07-01",
    end_date = "2026-07-03",
    posts_per_day = 6,
    exclude_days = []
  )
  
  Status kerjasama: target 5 konten, deadline 2026-07-10, sudah dibuat 0
  Sisa: 5 konten dalam 10 hari tersisa

Kalkulasi kerjasama:
  days_remaining = 10
  range_days = 3
  collab_slots_in_range = ceil(5 × 3/10) = ceil(1.5) = 2
  
  Jadi sistem menjadwalkan 2 slot kerjasama dalam 3 hari ini (bukan 5)
  Sisa 3 slot kerjasama akan masuk di generate jadwal berikutnya

Output jadwal:
  Rabu 1 Jul:
    06:30 — [EARLY_STAGE]   Produk baru testing
    10:00 — [COLLABORATION] Produk kerjasama X  ← slot 1/2
    12:00 — [PROVEN_WINNER] MS Glow For Men
    15:00 — [GMV_ACTIVE]    Bali Surfers 100ml
    18:00 — [PROVEN_WINNER] Bali Surfers 37ml
    20:00 — [PROVEN_WINNER] MS Glow For Men
  
  Kamis 2 Jul:
    06:30 — [STAGNANT]      Produk X (sudah 16 hari, 0 order, ini slot terakhir sebelum sistem rekomendasikan stop)
    10:00 — [GROWING]       SAFF SOTB
    12:00 — [PROVEN_WINNER] MS Glow For Men
    15:00 — [MONITOR]       Wonderlux Hair
    18:00 — [PROVEN_WINNER] Bali Surfers 37ml
    20:00 — [COLLABORATION] Produk kerjasama X  ← slot 2/2
  
  Jumat 3 Jul:
    06:30 — [EARLY_STAGE]   Produk baru dari master
    10:00 — [MONITOR]       Bath Ritual
    12:00 — [PROVEN_WINNER] Bali Surfers 37ml
    15:00 — [GMV_ACTIVE]    Juliette
    18:00 — [PROVEN_WINNER] MS Glow For Men
    20:00 — [PROVEN_WINNER] MS Glow For Men
    
Summary:
  Kerjasama: 2/5 konten dijadwalkan (sisa 3 untuk ≤7 hari ke depan)
  Produk excluded: Clone You Man EDP (stok habis)
  Alert: Produk X (STAGNANT 16 hari) — rekomendasikan evaluasi manual
```

---

## Catatan akhir untuk AI eksekutor

1. **Mulai dari data nyata** — gunakan file XLSX yang sudah dianalisis sebagai data seed untuk testing. File tersebut berisi 488 baris (382 setelah Ineligible dibuang), 25 hari data, 52 produk unik.

2. **Prioritaskan scorer.py dan classifier.py** — ini adalah jantung sistem. Bangun dan test ini dulu sebelum menyentuh UI apapun.

3. **Edge cases yang wajib ditest:**
   - Produk dengan 0 konten di content_log tapi ada di sales_data (produk yang laku dari konten lama yang tidak dilog)
   - Import XLSX dengan kolom yang sama persis dengan contoh (format TikTok bisa berubah — buat parser yang toleran terhadap kolom tambahan)
   - Generate jadwal dengan posts_per_day lebih besar dari jumlah produk aktif

4. **Jangan hardcode jam prime time** — jam prime time (17:00–22:00) berasal dari analisis data historis dan bisa berubah jika pengguna punya data yang berbeda. Jadikan ini konfigurasi yang bisa diubah pengguna, bukan konstanta di kode.

5. **`product_id` dari TikTok bisa berulang** untuk SKU berbeda dari produk yang sama — perhatikan bahwa satu produk bisa punya banyak SKU. Untuk sistem ini, level analisis adalah **product level** (Product ID), bukan SKU level.

6. **Buat log keputusan** — setiap kali sistem mengklasifikasikan produk atau menempatkan slot, simpan reason string-nya. Ini penting untuk pengguna memahami kenapa sistem memutuskan sesuatu, dan untuk debugging ketika hasil tidak sesuai ekspektasi.