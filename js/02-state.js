/*
Tujuan: Data Defaults, State Global S (v2.4 dengan Bank Template Hook/Proof/CTA yang ditingkatkan), dan Konfigurasi Gemini API
Caller: index.html, 01-gdrive.js, dan modul lainnya
Dependensi: gdScheduleSync (dari 01-gdrive)
Main Functions:
  - callGemini(prompt, maxTokens): Melakukan request ke Google Gemini API.
  - save(): Menyimpan mutasi state ke localStorage dan menjadwalkan sync cloud.
  - initGeminiKey() & saveGeminiKey(): Mengelola custom API key di sidebar.
Side Effects: Membaca/menulis LocalStorage ('affos4', 'gemini_api_key'), memanggil Gemini API.

================================================================================
DATABASE DATA SCHEMA (State Global 'S')
================================================================================
S = {
  products: [],          // Array objek produk master (prod)
  contents: [],          // Array objek riwayat video analitik (content)
  categories: [],        // Array master kategori dinamis (String)
  hooks: [{id, txt, kategori}],   // Array Hook template bank
  proofs: [{id, txt, kategori}],  // Array Proof template bank
  ctas: [{id, txt, kategori}],    // Array CTA template bank
  importHistory: [],     // Array log impor ({filename, added, merged, skipped, ts, total})
  scheduleHistory: [],   // Array riwayat jadwal generated
  scoringMode: String,   // Mode kalkulasi skor aktif ('benchmark' | 'topsis')
  lastModified: Number   // Timestamp milidetik modifikasi terakhir database
}

Objek Master Produk (S.products[i]):
prod = {
  id: String,              // ID Unik ('p' + Timestamp + Random)
  nama: String,            // Nama lengkap produk dari etalase TikTok Shop
  brand: String,           // Brand / Merk produk (kustom / auto-detect)
  jenis: String,           // Tipe pendek produk (ex: "Celana Jogger")
  harga: Number,           // Harga produk dalam Rupiah
  komisi: Number,          // Komisi afiliasi per unit terjual
  kategori: String,        // Kategori (bebas / dinamis)
  labelPrestasi: String,   // Label seller dari TikTok (ex: "Top selling #4" atau "-")
  gmvAktif: Boolean,       // Status keaktifan seller beriklan/GMV Max
  descVariants: [],        // Array maks 3 string deskripsi isi konten buatan AI
  nVideo: Number,          // Total video terasosiasi hasil impor
  spreadDays: Number,      // Jumlah hari unik posting terdeteksi
  maxViews: Number,        // Views video tertinggi
  avgViews: Number,        // Rata-rata views video
  totalItemsSold: Number,  // Total unit terjual
  totalGMV: Number,        // Total GMV dalam Rupiah
  conversionRate: Number,  // Rasio sold/views (%)
  avgCTR: Number,          // Rata-rata CTR berbobot eksponensial (EMA .7 / .3)
  avgCTOR: Number,         // Rata-rata CTOR berbobot eksponensial (EMA .7 / .3)
  uploadDates: [],         // Kumpulan tanggal upload unik
  benchScore: Number,      // Skor keunggulan akhir (0-100) hasil SAW / TOPSIS
  topsisScore: Number,     // Skor TOPSIS murni (0.000 - 1.000) atau null jika SAW mode
  klasifikasi: String,     // Status klasifikasi ('WINNING'|'POTENTIAL'|'MONITOR'|'DROP')
  slotRek: String,         // Rekomendasi slot waktu posting ('16:00/18:00', dsb.)
  scoreMode: String        // Indikator mode kalkulasi skor terakhir ('topsis' | 'benchmark')
}

Objek Riwayat Konten (S.contents[i]):
content = {
  id: String,          // ID Unik ('c' + Timestamp + Random)
  produk: String,      // Nama produk terasosiasi (Relasi manual name-match ke prod.nama)
  desc: String,        // Caption / deskripsi video TikTok
  tanggal: String,     // Tanggal posting terdeteksi
  durasi: String,      // Durasi video dalam detik
  periode: String,     // Periode data analitik berjalan (string asli dari Excel)
  periodeStart: Number,// Timestamp milidetik awal rentang periode (parsed dari kolom periode)
  periodeEnd: Number,  // Timestamp milidetik akhir rentang periode (parsed dari kolom periode)
  gmv: Number,         // GMV kontribusi dari video ini (SUM dari periodSnapshots)
  itemsSold: Number,   // Unit produk terjual dari video ini (SUM dari periodSnapshots)
  ctr: Number,         // Click-Through Rate (%) (dari snapshot periode terakhr)
  ctor: Number,        // Click-to-Order Rate (%) (dari snapshot periode terakhr)
  views: Number,       // Jumlah penayangan video (SUM dari periodSnapshots)
  estK: Number,        // Estimasi komisi (itemsSold * prod.komisi)
  periodSnapshots: [], // Array snapshot per-periode non-overlapping: { periode, pStart, pEnd, gmv, itemsSold, views, ctr, ctor }
  ts: Number           // Timestamp internal pembuatan objek
}
================================================================================
*/

// ============================================================
// SHARED UTILS (dipindah ke sini agar tersedia lebih awal)
// ============================================================
function toast(m){const t=document.getElementById('toast');t.textContent=m;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2400);}

// ============================================================
// DATA DEFAULTS
// ============================================================
const DEF_HOOKS=[
  {id:'h1',txt:'Gue iseng coba [PRODUK] ini — dan sekarang susah balik ke yang lama.',kategori:'Umum'},
  {id:'h2',txt:'Jujur, gue awalnya ragu. Tapi setelah pakai [PRODUK] ini seminggu, pendapat gue berubah total.',kategori:'Umum'},
  {id:'h3',txt:'Kalau lo capek buang duit buat [PRODUK] yang zonk, coba tonton dulu 30 detik ini.',kategori:'Umum'},
  {id:'h4',txt:'Ribuan orang udah order [PRODUK] ini. Gue penasaran — ini hasilnya setelah gue coba sendiri.',kategori:'Umum'},
  {id:'h5',txt:'Stop scroll. Kalau lo lagi nyari [PRODUK] yang beneran worth it, ini dia.',kategori:'Umum'},
  {id:'h6',txt:'[PRODUK] ini yang sekarang gue pakai tiap hari. Dan gue kasih tau kenapa.',kategori:'Umum'},
  {id:'h7',txt:'Kenapa 90% orang salah pilih [PRODUK]? Ini yang harusnya lo perhatiin.',kategori:'Umum'},
  {id:'h8',txt:'Jangan beli [PRODUK] sembarangan sebelum lo tau ini.',kategori:'Umum'},
  {id:'h9',txt:'Gue nggak nyangka [PRODUK] harga segini bisa sekualitas ini. Serius.',kategori:'Umum'},
  {id:'h10',txt:'[PRODUK] ini sering sold out — dan akhirnya gue ngerti kenapa.',kategori:'Umum'},
  {id:'h11',txt:'3 hal yang wajib lo tau sebelum beli [PRODUK]. Nomor 2 sering diabaikan.',kategori:'Umum'},
  {id:'h12',txt:'Gue challenge diri sendiri pakai [PRODUK] ini selama 7 hari. Ini yang terjadi.',kategori:'Umum'},
  {id:'h13',txt:'Dulu gue selalu kecewa sama [PRODUK]. Sampai akhirnya nemu yang ini.',kategori:'Umum'},
  {id:'h14',txt:'Kalau lo tipe yang riset dulu sebelum checkout, ini review jujur [PRODUK] dari gue.',kategori:'Umum'},
  {id:'h15',txt:'Udah 10rb+ terjual dan ratingnya 4.9. Gue buktiin sendiri apa beneran sebagus itu.',kategori:'Umum'},
  {id:'h16',txt:'Semua orang rekomendasiin [PRODUK] yang itu-itu aja. Gue kasih alternatif yang lebih worth it.',kategori:'Umum'},
  {id:'h17',txt:'Ini [PRODUK] yang jarang dibahas tapi diam-diam banyak yang repeat order.',kategori:'Umum'},
  {id:'h18',txt:'Kalau lo sering nunda beli [PRODUK] karena banyak pilihan — coba yang ini dulu.',kategori:'Umum'},
  {id:'h19',txt:'Ini bukan endorse, bukan iklan. Ini murni pengalaman gue pakai [PRODUK] ini.',kategori:'Umum'},
  {id:'h20',txt:'Gue udah coba 5 [PRODUK] berbeda. Yang ini yang paling gue suka — dan ini alasannya.',kategori:'Umum'}
];
const DEF_PROOFS=[
  {id:'p1',txt:'Udah ribuan yang order, dan reviewnya konsisten bagus — bukan dari gue doang, tapi dari yang udah beli.',kategori:'Umum'},
  {id:'p2',txt:'Rating 4.9 dari ribuan pembeli. Angka segitu nggak bisa dimanipulasi.',kategori:'Umum'},
  {id:'p3',txt:'Yang repeat order biasanya nggak bohong soal kualitas. Dan ini salah satu produk yang sering di-repeat.',kategori:'Umum'},
  {id:'p4',txt:'Reviewnya konsisten positif dari berbagai tipe pembeli — itu yang bikin gue yakin rekomendasiin.',kategori:'Umum'},
  {id:'p5',txt:'Bukan karena viral sesaat, tapi karena emang bagus. Makanya penjualannya terus naik.',kategori:'Umum'},
  {id:'p6',txt:'Gue udah pakai ini hampir sebulan. Kalau jelek, nggak mungkin gue rekomendasiin.',kategori:'Umum'},
  {id:'p7',txt:'Temen gue yang awalnya skeptis akhirnya ikut beli setelah liat punya gue. Itu bukti paling jujur.',kategori:'Umum'},
  {id:'p8',txt:'Udah gue pakai rutin dan masih awet sampai sekarang. Worth every rupiah.',kategori:'Umum'},
  {id:'p9',txt:'Cek sendiri kolom komentarnya — banyak yang udah buktiin dan share hasilnya.',kategori:'Umum'},
  {id:'p10',txt:'Harga segini dapet kualitas kayak gini? Wajar aja banyak yang langsung checkout.',kategori:'Umum'},
  {id:'p11',txt:'Bandingkan aja sebelum dan sesudah pakai — hasilnya ngomong sendiri.',kategori:'Umum'},
  {id:'p12',txt:'Ini produk yang masuk daftar top seller bukan karena iklan, tapi karena performa penjualannya emang bagus.',kategori:'Umum'}
];
const DEF_CTAS=[
  {id:'c1',txt:'Link produknya ada di keranjang kuning, tap kalau tertarik.',kategori:'Umum'},
  {id:'c2',txt:'Cek dulu aja di keranjang kuning — nggak ada ruginya liat-liat.',kategori:'Umum'},
  {id:'c3',txt:'Harga segini worth banget. Keranjang kuning ada di bawah.',kategori:'Umum'},
  {id:'c4',txt:'Stoknya sering kosong, jadi kalau masih available mending langsung amankan.',kategori:'Umum'},
  {id:'c5',txt:'Mumpung masih ada promo, langsung cek keranjang kuning sebelum harga normal.',kategori:'Umum'},
  {id:'c6',txt:'Bisa bayar di tempat. Langsung order aja di keranjang kuning.',kategori:'Umum'},
  {id:'c7',txt:'Kalau mau coba, link-nya ada di bawah. Bebas cek dulu detailnya.',kategori:'Umum'},
  {id:'c8',txt:'Udah banyak yang checkout dari video ini. Keranjang kuning ada di bawah ya.',kategori:'Umum'},
  {id:'c9',txt:'Ini rekomendasi jujur dari gue. Tap keranjang kuning kalau mau punya juga.',kategori:'Umum'},
  {id:'c10',txt:'Save dulu videonya buat pertimbangan, atau langsung cek di keranjang kuning.',kategori:'Umum'}
];

// ============================================================
// STATE
// ============================================================
const INIT_S={
  products:[],
  contents:[],
  benchmarks:[],
  categories:['Fashion', 'Parfum', 'Skincare', 'Olahraga', 'Elektronik', 'Makanan & Minuman', 'Rumah Tangga', 'Umum'],
  hooks:[...DEF_HOOKS],
  proofs:[...DEF_PROOFS],
  ctas:[...DEF_CTAS],
  importHistory:[],
  scheduleHistory:[],
  scoringMode:'benchmark',
  lastModified:0,
  benchmarkActiveProfile:'bangjie.id (bawaan)'
};
let S=JSON.parse(JSON.stringify(INIT_S));
try{
  const sv=localStorage.getItem('affos4');
  if(sv){
    const parsed=JSON.parse(sv);
    S={...INIT_S,...parsed};
    if(!S.proofs||!S.proofs.length)S.proofs=[...DEF_PROOFS];
    // Migrasi hook/proof/cta agar punya property kategori jika belum ada
    if(S.hooks) S.hooks.forEach(h => { if(!h.kategori) h.kategori = 'Umum'; });
    if(S.proofs) S.proofs.forEach(p => { if(!p.kategori) p.kategori = 'Umum'; });
    if(S.ctas) S.ctas.forEach(c => { if(!c.kategori) c.kategori = 'Umum'; });

    // Migrasi status produk (aktif / jeda / habis)
    if(S.products) S.products.forEach(p => {
      if(!p.status) p.status = p.stokHabis ? 'habis' : 'aktif';
    });
    
    // Migrasi benchmark lama
    if(S.benchmarks&&S.benchmarks.length){
      let m=false;
      S.benchmarks.forEach(b=>{if(!b.profile){b.profile='bangjie.id (bawaan)';m=true;}});
      if(m)localStorage.setItem('affos4',JSON.stringify(S));
    }
    if(!S.benchmarkActiveProfile)S.benchmarkActiveProfile='bangjie.id (bawaan)';
    if(!S.categories||!S.categories.length)S.categories=['Fashion', 'Parfum', 'Skincare', 'Olahraga', 'Elektronik', 'Makanan & Minuman', 'Rumah Tangga', 'Umum'];
    if(!S.scheduleHistory)S.scheduleHistory=[];
  }
}catch(e){}
function save(){S.lastModified=Date.now();try{localStorage.setItem('affos4',JSON.stringify(S));}catch(e){} gdScheduleSync(); }

// ============================================================
// AI API CONFIG & HELPER (GEMINI)
// ============================================================
const DEFAULT_GEMINI_API_KEY = 'AIzaSyBLsiHRd90qyb4GMyL_knX7-egPMi9nGpo';

async function callGemini(prompt, maxTokens = 1000) {
  const customKey = localStorage.getItem('gemini_api_key') || DEFAULT_GEMINI_API_KEY;
  const customModel = localStorage.getItem('gemini_model') || 'gemini-2.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${customModel}:generateContent?key=${customKey}`;
  
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: maxTokens, temperature: 0.8 }
    })
  });
  
  if (!res.ok) {
    let errDetail = '';
    try {
      const errJson = await res.json();
      errDetail = errJson.error?.message || '';
    } catch(e) {}

    if (res.status === 429) {
      if (customKey === DEFAULT_GEMINI_API_KEY) {
        throw new Error(`API Key bawaan telah habis kuota/dinonaktifkan karena bocor. Masukkan API Key Anda sendiri di sidebar.`);
      } else {
        throw new Error(`Rate Limit (429). Kuota API Key Anda habis atau request terlalu cepat. Detail: ${errDetail}`);
      }
    } else if (res.status === 403) {
      if (customKey === DEFAULT_GEMINI_API_KEY) {
        throw new Error(`API Key bawaan tidak valid/diblokir karena bocor. Masukkan API Key Anda sendiri di sidebar.`);
      } else {
        throw new Error(`Akses Ditolak (403). API Key tidak valid / terblokir. Detail: ${errDetail}`);
      }
    } else if (res.status === 400) {
      throw new Error(`Bad Request (400). Pastikan API Key valid. Detail: ${errDetail}`);
    } else if (res.status === 404) {
      throw new Error(`Model tidak ditemukan (404). Detail: ${errDetail}`);
    }
    throw new Error(`HTTP Error ${res.status}. Detail: ${errDetail}`);
  }
  
  const data = await res.json();
  const raw = data.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || '';
  return raw.replace(/```json|```/g, '').trim();
}

// ============================================================
// GEMINI API KEY MANAGEMENT
// ============================================================
function initGeminiKey() {
  const customKey = localStorage.getItem('gemini_api_key') || '';
  const inp = document.getElementById('gemini-key-input');
  if (inp) inp.value = customKey;
  updateGeminiBadge(customKey);

  const savedModel = localStorage.getItem('gemini_model') || 'gemini-2.5-flash';
  const sel = document.getElementById('gemini-model-sel');
  if (sel) sel.value = savedModel;
}

function saveGeminiModel() {
  const sel = document.getElementById('gemini-model-sel');
  if (sel) {
    localStorage.setItem('gemini_model', sel.value);
    toast('Model diubah ke ' + sel.value);
  }
}

function updateGeminiBadge(key) {
  const badge = document.getElementById('gemini-status-badge');
  if (!badge) return;
  if (key && (key.startsWith('AIzaSy') || key.startsWith('AQ.'))) {
    badge.textContent = '✔ Aktif';
    badge.style.background = 'var(--grb)';
    badge.style.color = 'var(--gr)';
    badge.style.borderColor = 'var(--grd)';
  } else if (key) {
    badge.textContent = '⚠️ Format Salah';
    badge.style.background = 'var(--amb)';
    badge.style.color = 'var(--am)';
    badge.style.borderColor = 'var(--amd)';
  } else {
    badge.textContent = '⚠️ Inaktif';
    badge.style.background = 'var(--rdb)';
    badge.style.color = 'var(--rd)';
    badge.style.borderColor = 'var(--rdd)';
  }
}

function saveGeminiKey() {
  const inp = document.getElementById('gemini-key-input');
  if (!inp) return;
  const key = inp.value.trim();
  if (key) {
    localStorage.setItem('gemini_api_key', key);
    toast('API Key disimpan!');
  } else {
    localStorage.removeItem('gemini_api_key');
    toast('API Key dikosongkan!');
  }
  updateGeminiBadge(key);
}

function toggleGeminiKeyVisibility() {
  const inp = document.getElementById('gemini-key-input');
  const eye = document.getElementById('gemini-eye-toggle');
  if (!inp || !eye) return;
  if (inp.type === 'password') {
    inp.type = 'text';
    eye.textContent = '🙈';
  } else {
    inp.type = 'password';
    eye.textContent = '👁️';
  }
}

function onGeminiKeyChange() {
  const inp = document.getElementById('gemini-key-input');
  if (inp) updateGeminiBadge(inp.value.trim());
}
