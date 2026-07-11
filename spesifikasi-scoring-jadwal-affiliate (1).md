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
Score_A = (0.35 x Recency) + (0.20 x Momentum) + (0.20 x Efficiency)
        + (0.15 x ContentDebt) + (0.10 x UntappedBonus)
```

- **Recency** = `max(0.05, 1 - DSLO/30)` — floor 0.05 supaya produk lama tidak closing tetap punya skor minimum, tidak pernah nol mutlak.
- **Momentum** = normalisasi `(orders_14d - orders_14d_prev)`, di-clamp ke [-1, 1]. Naik → dorong ke atas. Turun → dikurangi porsinya, bukan didiskualifikasi.
- **Efficiency** = rank-percentile dari `total_gmv / max(total_content, 1)` dibanding sesama Pool A (bukan angka mentah, biar tidak bias ke produk mahal).
- **ContentDebt** = `min(1, DSLC/21)` — makin lama nggak "dicek ulang" lewat konten, makin didorong naik. Ini yang menjamin produk proven tidak pernah benar-benar dilupakan.
- **UntappedBonus**: berlaku kalau `total_content` sangat rendah dibanding rata-rata Pool A. Besarnya bonus di-skala oleh keyakinan data:
  ```
  jika Tanggal Ditambahkan >= content_tracking_start:
      bonus penuh (1.0)   # histori kontennya pasti lengkap tercatat
  jika Tanggal Ditambahkan < content_tracking_start:
      bonus dikecilkan (0.3)  # bisa jadi ada histori konten lama yang tak tercatat
  ```

### Pool B (Testing)
```
Score_B = BASE_TESTING - (total_content x 0.12) + NewProductBonus
```
- `BASE_TESTING` default 0.6 (kompetitif tapi di bawah rata-rata Pool A)
- Setiap konten testing yang sudah dipakai tanpa hasil, sedikit menurunkan urgensinya
- `NewProductBonus = +0.3` jika `total_content == 0` (produk yang belum pernah dicoba didahulukan dari yang sudah dicoba 3-4x tanpa hasil)

Pool A dan Pool B digabung jadi satu ranking untuk berebut sisa slot.

---

## 7. Tahap 5 — Alokasi 7 Slot Harian

```
1. slot_terisi = slot wajib kolaborasi (Tahap 2)
2. sisa_slot = 7 - slot_terisi
3. gabungkan kandidat Pool A + Pool B (lolos filter Tahap 1), urutkan Score turun
4. terapkan batas keberagaman: maksimal MAX_SLOT_PER_PRODUK (default 2) per produk/hari
5. cek Fairness Queue (Tahap 5a) -> masukkan duluan sebelum sisa ranking normal
6. isi sisa_slot dari ranking teratas ke bawah, lewati produk yang sudah kena batas
```

### 7a. Fairness Queue
Untuk tiap produk Pool A: jika sudah `FAIRNESS_WINDOW` (default 30 hari) **tanpa** dapat slot konten sama sekali, paksa masuk 1 slot hari itu terlepas dari skornya — prioritas di bawah slot wajib kolaborasi, tapi di atas ranking skor biasa. Ini menjamin "pernah closing = tidak pernah nol perhatian" sebagai aturan pasti, bukan cuma hasil skor yang kebetulan tinggi.

**Pengaman kematangan data**: kalau rentang data yang tersedia di sistem belum mencapai `FAIRNESS_WINDOW` (misal sistem baru jalan 10 hari), aturan ini belum diaktifkan dulu — supaya tidak menghukum produk berdasarkan histori yang memang belum ada.

---

## 8. Parameter yang Bisa Di-tuning

| Parameter | Default | Fungsi |
|---|---|---|
| `TEST_BUDGET` | 6 konten | Batas percobaan sebelum masuk Watchlist |
| `GRACE_DAYS` | 5 hari | Masa produk baru bebas penalti testing |
| `FLOOR_RECENCY` | 0.05 | Skor minimum produk Proven walau lama tidak closing |
| `FAIRNESS_WINDOW` | 30 hari | Batas maksimal produk Proven "dilupakan" |
| `MAX_SLOT_PER_PRODUK` | 2 slot/hari | Batas keberagaman harian |
| `BASE_TESTING` | 0.6 | Titik awal skor produk testing |

---

## 9. Ringkasan Alur (Pseudocode)

```
setiap kali data direfresh:
    hitung ulang agregat per produk (Bagian 2)
    kandidat = filter_keras(semua_produk)                    # Bagian 3
    wajib = ambil_slot_kolaborasi(kandidat)                  # Bagian 4
    sisa = 7 - len(wajib)

    A, B, C = klasifikasi(kandidat - wajib)                  # Bagian 5
    ranking = urutkan_turun(
        [score_a(p) for p in A] + [score_b(p) for p in B]
    )                                                         # Bagian 6

    fairness = cek_fairness_queue(A)                          # Bagian 7a
    jadwal = wajib + fairness + ambil_top(
        ranking, sisa - len(fairness), max_per_produk=MAX_SLOT_PER_PRODUK
    )

    return jadwal
```
