# Spesifikasi Logika Scoring & Penjadwalan Konten Affiliate TikTok (Final)

Fokus dokumen ini: **logika scoring produk** dan **generate jadwal 7 slot konten harian**, berdasarkan 3 sumber data (Master Produk, Riwayat Konten, Daftar Pesanan) yang datanya diperbarui berkala (harian/mingguan/tidak rutin, sudah ditangani di sisi ingest data — bukan bagian dokumen ini).

---

## 1. Pemetaan Data yang Dipakai

**Master Produk**
- `ID Produk`, `Status Stok`, `Status Aktif` → filter keras
- `Kerjasama`, `Target Kolaborasi`, `Mulai Kolaborasi`, `Deadline Kolaborasi` → slot wajib
- `Tanggal Ditambahkan` (akan dikoreksi manual jadi estimasi tanggal riil produk mulai dijual) → dasar usia produk

**Riwayat Konten** (per `ID Produk`)
- Jumlah konten, tanggal konten terakhir, tren jumlah konten 14 hari terakhir vs 14 hari sebelumnya
- `CTR`, `CTOR`, `Items Sold` — **tidak dipakai** (belum terisi valid di data)

**Daftar Pesanan** (per `Product ID`) — sumber tunggal bukti closing
- Jumlah order, total GMV, total item terjual
- Tanggal order terakhir, tren order 14 hari terakhir vs 14 hari sebelumnya
- Split `affiliate` vs `shop_ads` (via `Order Type`)
- Join `Content ID` → `Riwayat Konten.TikTok Content ID` untuk tahu closing itu berasal dari konten yang mana (kalau ada)

---

## 2. Agregasi Per Produk (dihitung ulang tiap data di-refresh)

```
total_orders, total_gmv, total_items_sold
last_order_date -> DSLO (days since last order, dari tanggal data terbaru yang ada)
orders_14d, orders_14d_prev  -> untuk momentum
total_content, last_content_date -> DSLC (days since last content)
content_14d, content_14d_prev
has_ever_sold = total_orders > 0
product_age_days = tanggal_data_terbaru - Tanggal Ditambahkan
content_tracking_start = tanggal konten paling awal yang ada di seluruh sistem (bukan per produk)
```

Catatan penting: `has_ever_sold == False` dan `total_content == 0` **tidak otomatis berarti** "produk ini belum pernah ada aktivitas apa pun" jika `product_age_days` menunjukkan produk sudah lama ada tapi ditambahkan ke sistem sebelum `content_tracking_start` — dalam kasus itu, anggap datanya belum lengkap, bukan anggap produk itu benar-benar nol dari awal. Kalau `Tanggal Ditambahkan` produk **setelah** `content_tracking_start`, artinya seluruh histori kontennya pasti sudah tercatat sistem — datanya bisa dipercaya penuh.

---

## 3. Tahap 1 — Filter Keras

Produk **tidak** ikut proses scoring/jadwal sama sekali jika:
- `Status Stok != available`
- `Status Aktif != active`

---

## 4. Tahap 2 — Slot Wajib (Kolaborasi)

Untuk produk dengan `Kerjasama == Ya` dan hari ini berada di antara `Mulai Kolaborasi` – `Deadline Kolaborasi`:

```
sisa_wajib = Target Kolaborasi - jumlah konten yang sudah diposting sejak Mulai Kolaborasi
hari_tersisa = Deadline Kolaborasi - tanggal hari ini
pace_harian = ceil(sisa_wajib / hari_tersisa)   # otomatis naik kalau mepet deadline
```

Slot ini dikunci lebih dulu, di luar kompetisi skor produk lain.

---

## 5. Tahap 3 — Klasifikasi Pool (sisa produk setelah slot wajib)

| Pool | Kriteria |
|---|---|
| **A — Proven** | `has_ever_sold == True` |
| **B — Testing** | `has_ever_sold == False` dan `total_content < TEST_BUDGET` (default 6) |
| **C — Watchlist** | `has_ever_sold == False` dan `total_content >= TEST_BUDGET` → keluar dari ranking harian otomatis |
| **D — Produk Baru** | `has_ever_sold == False`, `total_content == 0`, `product_age_days <= GRACE_DAYS` (default 5) → prioritas tinggi masuk Pool B |

Pool C hanya kembali aktif lewat trigger manual dari user (tandai "coba lagi" di aplikasi) — tidak otomatis oleh sistem.

---

## 6. Tahap 4 — Formula Skor

### Pool A (Proven)
```
Score_A = (0.25 x Recency) + (0.15 x Momentum) + (0.15 x Efficiency)
        + (0.10 x ContentDebt) + (0.05 x UntappedBonus) + (0.30 x HotProductBoost)
```

- **Recency** = `max(0.05, 1 - DSLO/30)` — floor 0.05 supaya produk lama tidak closing tetap punya skor minimum.
- **Momentum** = normalisasi `(orders_14d - orders_14d_prev)`, di-clamp ke [-1, 1].
- **Efficiency** = rank-percentile dari `total_orders / max(total_content, 1)` dibanding sesama Pool A.
- **ContentDebt** = `min(1, DSLC/21)` — mendorong produk proven yang belum dicek ulang.
- **UntappedBonus**: berlaku jika `total_content` rendah dibanding rata-rata Pool A.
- **HotProductBoost**: `min(1.0, items_sold_7d / HOT_MAX_SCALE)` jika `items_sold_7d >= HOT_THRESHOLD` (default 5 items dalam 7 hari). Memberikan prioritas tertinggi untuk produk winning/viral.

### Pool B (Testing)
```
Score_B = BASE_TESTING - (total_content x 0.05) + NewProductBonus
```
- `BASE_TESTING` default 0.6
- `TESTING_CONTENT_PENALTY` default 0.05
- `NewProductBonus = +0.3` jika `total_content == 0`

Pool A dan Pool B digabung jadi satu ranking untuk berebut sisa slot.

---

## 7. Tahap 5 — Alokasi 7 Slot Harian

```
1. slot_terisi = slot wajib kolaborasi (Tahap 2)
2. slot_hot = slot prioritas produk hot/winning (di-cap oleh HOT_PRIORITY_SLOTS, default 2)
3. alokasikan sisa slot dari ranking teratas (Pool A + Pool B) dengan proporsi interleaved
4. terapkan batas keberagaman: MAX_SLOT_PER_PRODUK (default 1) — setiap produk max 1x/hari
5. jika ranking habis, isi dari Fairness Queue (Tahap 5a)
```

### 7a. Fairness Queue
Untuk tiap produk Pool A: jika sudah `FAIRNESS_WINDOW` (default 30 hari) **tanpa** dapat slot konten sama sekali, dapat masuk 1 slot sebagai cadangan (setelah slot winning & skor teratas terisi).

---

## 8. Parameter yang Bisa Di-tuning

| Parameter | Default | Fungsi |
|---|---|---|
| `TEST_BUDGET` | 10 konten | Batas percobaan sebelum masuk Watchlist |
| `GRACE_DAYS` | 5 hari | Masa produk baru bebas penalti testing |
| `FLOOR_RECENCY` | 0.05 | Skor minimum produk Proven walau lama tidak closing |
| `HOT_THRESHOLD` | 5 items | Batas minimum items_sold 7d untuk dianggap Hot/Winning |
| `HOT_MAX_SCALE` | 30 items | Pembagi skala normalisasi velocity Hot Product |
| `HOT_PRIORITY_SLOTS` | 2 slot/hari | Maks slot prioritas (Step 2) untuk hot product per hari |
| `WEIGHT_HOT_BOOST` | 0.20 | Bobot hot product pada Score_A (seimbang, tidak mendominasi) |
| `FAIRNESS_WINDOW` | 30 hari | Batas maksimal produk Proven "dilupakan" |
| `MAX_SLOT_PER_PRODUK` | 1 slot/hari | Maks 1 produk per hari (lebih banyak variasi) |
| `BASE_TESTING` | 0.6 | Titik awal skor produk testing |

---

## 9. Ringkasan Alur (Pseudocode)

```
setiap kali data direfresh:
    hitung ulang agregat per produk + items_sold_7d (Bagian 2)
    kandidat = filter_keras(semua_produk)                    # Bagian 3
    wajib = ambil_slot_kolaborasi(kandidat)                  # Bagian 4
    
    A, B, C = klasifikasi(kandidat - wajib)                  # Bagian 5
    hot = deteksi_hot_products(kandidat, HOT_THRESHOLD)
    
    ranking = urutkan_turun(
        [score_a(p) for p in A] + [score_b(p) for p in B]
    )                                                         # Bagian 6

    jadwal = wajib + ambil_hot_priority(hot, max=HOT_PRIORITY_SLOTS) + ambil_top_interleaved(
        ranking, sisa_slot, max_per_produk=1
    )

    return jadwal
```
