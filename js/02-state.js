/*
Tujuan: Data Defaults, State Global S, dan Konfigurasi Gemini API
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
  {id:'h2',txt:'Jujur, gue awalnya ragu. Tapi setelah pakai [PRODUK] ini, pendapat gue berubah.',kategori:'Umum'},
  {id:'h3',txt:'Kalau lo lagi cari [PRODUK] yang worth it, mungkin ini yang lo cari.',kategori:'Umum'},
  {id:'h4',txt:'Ribuan orang udah order ini. Gue penasaran, gue coba — ini hasilnya.',kategori:'Umum'},
  {id:'h5',txt:'Gue nemu [PRODUK] ini dan langsung ngerti kenapa banyak yang repeat order.',kategori:'Umum'},
  {id:'h6',txt:'[PRODUK] ini yang sekarang gue pakai sehari-hari. Dan gue punya alasannya.',kategori:'Umum'},
  {id:'h7',txt:'Ini [PRODUK] yang sering orang tanya ke gue — akhirnya gue bahas juga.',kategori:'Umum'},
  {id:'h8',txt:'Sebelum lo beli [PRODUK] sembarangan, tonton ini dulu.',kategori:'Umum'},
  {id:'h9',txt:'Gue nggak nyangka [PRODUK] harga segini bisa sekualitas ini.',kategori:'Umum'},
  {id:'h10',txt:'Kalau lo sering nunda beli [PRODUK] karena banyak pilihan — coba yang ini dulu.',kategori:'Umum'},
];
const DEF_PROOFS=[
  {id:'p1',txt:'Udah ribuan yang order, dan reviewnya konsisten — bukan dari gue, tapi dari yang udah beli.',kategori:'Umum'},
  {id:'p2',txt:'Rating-nya tinggi karena memang worth it, bukan karena kebetulan.',kategori:'Umum'},
  {id:'p3',txt:'Gue bukan satu-satunya yang rekomendasiin ini — cek sendiri jumlah pembelinya.',kategori:'Umum'},
  {id:'p4',txt:'Yang repeat order biasanya nggak bohong soal kualitas.',kategori:'Umum'},
  {id:'p5',txt:'Reviewnya konsisten dari berbagai pembeli — itu yang bikin gue yakin rekomendasiin ini.',kategori:'Umum'},
  {id:'p6',txt:'Bukan karena viral, tapi karena emang bagus. Makanya terus laku.',kategori:'Umum'},
  {id:'p7',txt:'Sudah terbukti dari review pembeli — kualitasnya sesuai harganya.',kategori:'Umum'},
];
const DEF_CTAS=[
  {id:'c1',txt:'Link produknya ada di keranjang, tap kalau mau.',kategori:'Umum'},
  {id:'c2',txt:'Tap keranjang kuning di bawah kalau tertarik.',kategori:'Umum'},
  {id:'c3',txt:'Kalau mau coba, keranjangnya ada di bawah.',kategori:'Umum'},
  {id:'c4',txt:'Cek dulu di keranjang — siapa tahu cocok buat lo.',kategori:'Umum'},
  {id:'c5',txt:'Ada di keranjang, tap aja.',kategori:'Umum'},
  {id:'c6',txt:'Link ada di keranjang, bebas dicek dulu.',kategori:'Umum'},
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
