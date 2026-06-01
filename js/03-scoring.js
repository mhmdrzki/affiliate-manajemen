/*
Tujuan: Data Benchmark, Pola Jadwal, Sistem Skoring Ganda (TOPSIS & SAW), Anomali Deteksi, dan Update Badge
Caller: 04-nav.js, 05-dashboard.js, 06-produk.js, 08-views.js
Dependensi: S, save (dari 02-state)
*/

// ============================================================
// BENCHMARK DATA
// ============================================================
const BENCH=[
  {nama:"NEW HEXA Celana Jogger Baggy Loose Pants",jenis:"Celana Jogger",komisi:5570,harga:52914,nV:8,sp:8,maxV:34900,avgV:6227,label:"Top selling #4"},
  {nama:"3Pcs Kaos Olahraga Cepat Kering Running",jenis:"Kaos Olahraga",komisi:6390,harga:63900,nV:7,sp:7,maxV:11500,avgV:4657,label:"Top rated #17"},
  {nama:"Screamous Kaos DANBOWL ZACK 290",jenis:"Kaos",komisi:10620,harga:114000,nV:6,sp:5,maxV:2744,avgV:1375,label:"Top selling #4"},
  {nama:"DISAI Sport Yoga Set Unisex",jenis:"Baju Olahraga",komisi:21750,harga:145000,nV:5,sp:2,maxV:9150,avgV:3493,label:"-"},
  {nama:"BROGUY Hoodie Unisex Fleece Tebal",jenis:"Hoodie",komisi:10195,harga:109000,nV:5,sp:5,maxV:4900,avgV:2042,label:"-"},
  {nama:"KKTOP Jaket Olahraga Anti UV UPF50+",jenis:"Jaket",komisi:7824,harga:116952,nV:5,sp:5,maxV:9138,avgV:3939,label:"Top selling #7"},
  {nama:"Rush n Run Kaos Polo Dry Fit",jenis:"Kaos Polo",komisi:5400,harga:54000,nV:3,sp:3,maxV:12300,avgV:5996,label:"Top selling #7"},
  {nama:"PROJECT NINETYSEVEN Kalung ORION",jenis:"Kalung",komisi:6990,harga:69900,nV:1,sp:1,maxV:60600,avgV:60600,label:"Top rated #2"},
  {nama:"Trondheim Jaket Jeans Travis Black",jenis:"Jaket Jeans",komisi:19500,harga:194000,nV:1,sp:1,maxV:41200,avgV:41200,label:"-"},
  {nama:"Celana Corduroy Baggy Unisex",jenis:"Celana",komisi:13813,harga:129842,nV:2,sp:2,maxV:30500,avgV:18000,label:"Top rated #11"},
];
let BENCH_JAM=[{j:"08:00",n:18},{j:"10:00",n:37},{j:"12:00",n:28},{j:"14:00",n:30},{j:"16:00",n:23},{j:"18:00",n:18}];
let BENCH_HARI=[{h:"Senin",n:28,av:4190},{h:"Selasa",n:24,av:3434},{h:"Rabu",n:26,av:3888},{h:"Kamis",n:20,av:2149},{h:"Jumat",n:22,av:1875},{h:"Sabtu",n:29,av:4843},{h:"Minggu",n:28,av:4499}];

function analyzeBenchPatterns() {
  const ap = S.benchmarkActiveProfile || 'bangjie.id (bawaan)';
  const all = (S.benchmarks && S.benchmarks.length) ? S.benchmarks : [];
  const src = all.filter(b => b.profile === ap);
  if (!src.length) return { jam: BENCH_JAM, hari: BENCH_HARI };

  const jamMap = {};
  src.forEach(b => { 
    const j = (b.jam || '').substring(0, 5);
    if (j) jamMap[j] = (jamMap[j] || 0) + 1; 
  });
  const jam = Object.entries(jamMap).map(([j, n]) => ({ j, n })).sort((a, b) => a.j.localeCompare(b.j));

  const hariMap = {};
  src.forEach(b => { 
    const h = b.hari || '';
    if (h) {
      if (!hariMap[h]) hariMap[h] = { count: 0, totalViews: 0 };
      hariMap[h].count++;
      hariMap[h].totalViews += (b.views || 0);
    }
  });
  const hari = Object.entries(hariMap).map(([h, d]) => ({ h, n: d.count, av: Math.round(d.totalViews / d.count) }));

  BENCH_JAM = jam.length ? jam : BENCH_JAM;
  BENCH_HARI = hari.length ? hari : BENCH_HARI;
  return { jam: BENCH_JAM, hari: BENCH_HARI };
}

// ============================================================
// SLOT PATTERNS
// ============================================================
const PATS={'3':['10:00','14:00','18:00'],'5':['09:00','11:00','14:00','16:00','18:00'],'6':['08:00','10:00','12:00','14:00','16:00','18:00'],'10':['07:00','08:00','09:00','10:00','11:00','13:00','14:00','16:00','17:00','18:00']};
let PRIME_SLOTS=['18:00','17:00','16:00'];
let MID_SLOTS=['14:00','13:00','11:00','10:00','09:00'];
let currentSlotSource='Bawaan';

// ============================================================
// DUAL SCORING SYSTEM
// Benchmark mode  → Frequency-based (normalized SAW)
// Personal mode   → TOPSIS multi-criteria
// Auto-detects which to use based on available data
// ============================================================

// ── WEIGHTS ──────────────────────────────────────────────────
const W_BENCH={nVideo:.50,spreadDays:.25,hasPrestasi:.15,maxViews:.10};
const W_TOPSIS={avgCTOR:.35,avgCTR:.25,totalItemsSold:.20,totalGMV:.12,nVideo:.08};

// ── BENCHMARK SCORING (normalized SAW) ───────────────────────
function scoreBenchmark(ps){
  if(!ps.length)return ps;
  const maxN=Math.max(...ps.map(p=>p.nVideo||0),1);
  const maxSp=Math.max(...ps.map(p=>p.spreadDays||0),1);
  const maxV=Math.max(...ps.map(p=>p.maxViews||0),1);
  ps.forEach(p=>{
    p.benchScore=Math.round((
      ((p.nVideo||0)/maxN)*W_BENCH.nVideo*100+
      ((p.spreadDays||0)/maxSp)*W_BENCH.spreadDays*100+
      ((p.labelPrestasi&&p.labelPrestasi!=='-')?1:0)*W_BENCH.hasPrestasi*100+
      ((p.maxViews||0)/maxV)*W_BENCH.maxViews*100
    )*10)/10;
    p.topsisScore=null;p.scoreMode='benchmark';
  });
}

// ── TOPSIS ───────────────────────────────────────────────────
function scoreTOPSIS(ps){
  if(!ps.length)return;
  const keys=Object.keys(W_TOPSIS);
  const raw=ps.map(p=>({avgCTOR:p.avgCTOR||0,avgCTR:p.avgCTR||0,totalItemsSold:p.totalItemsSold||0,totalGMV:p.totalGMV||0,nVideo:p.nVideo||0}));
  const colNorm={};
  keys.forEach(k=>{colNorm[k]=Math.sqrt(raw.reduce((s,r)=>s+r[k]**2,0))||1;});
  const wn=raw.map(r=>{const row={};keys.forEach(k=>row[k]=(r[k]/colNorm[k])*W_TOPSIS[k]);return row;});
  const Ap={},Am={};
  keys.forEach(k=>{Ap[k]=Math.max(...wn.map(r=>r[k]));Am[k]=Math.min(...wn.map(r=>r[k]));});
  const dP=wn.map(r=>Math.sqrt(keys.reduce((s,k)=>s+(r[k]-Ap[k])**2,0)));
  const dM=wn.map(r=>Math.sqrt(keys.reduce((s,k)=>s+(r[k]-Am[k])**2,0)));
  ps.forEach((p,i)=>{
    const t=dP[i]+dM[i];
    p.topsisScore=t>0?Math.round((dM[i]/t)*1000)/1000:0;
    p.benchScore=Math.round(p.topsisScore*100);
    p.scoreMode='topsis';
  });
}

// ── CLASSIFY ─────────────────────────────────────────────────
function classifyP(p,mode){
  if ((p.nVideo || 0) === 0) return 'UJI COBA';
  const n=p.nVideo||0,sold=p.totalItemsSold||0,gmv=p.totalGMV||0;
  const mv=p.maxViews||0,ctr=p.avgCTR||0,ctor=p.avgCTOR||0;
  const ts=p.topsisScore||0;
  
  if(mode==='topsis'){
    if(ts>=0.55)return 'WINNING';
    if(sold>=2&&ts>=0.20)return 'WINNING';
    if(ctor>=0.5&&sold>=1)return 'WINNING';
    if(n>=3&&mv<2000&&ctr===0&&ctor===0&&sold===0)return 'DROP';
    if(ts>=0.20)return 'POTENTIAL';
    if(ctr>0.5&&n>=2)return 'POTENTIAL';
    if(sold>=1)return 'POTENTIAL';
    return 'MONITOR';
  }
  // benchmark (frequency-based)
  if(n>=5||(n>=3&&(sold>0||gmv>0)))return 'WINNING';
  if(n>=3&&mv<2000&&ctr===0&&sold===0)return 'DROP';
  if(n>=3||(n>=2&&ctr>0))return 'POTENTIAL';
  return 'MONITOR';
}
function slotR(k){return k==='WINNING'?'16:00/18:00':k==='POTENTIAL'?'10:00/14:00':k==='DROP'?'—':k==='UJI COBA'?'08:00/10:00':'08:00/12:00';}

// ── ANOMALY DETECTION ────────────────────────────────────────
function detectAnomalies(products){
  const al=[];
  // GMV Max signal: spike views + low CTOR + 1x upload
  products.forEach(p=>{
    if((p.maxViews||0)>10000&&(p.avgCTOR||0)<0.3&&(p.nVideo||1)===1)
      al.push({type:'gmvmax',msg:`<strong>${p.jenis||p.nama.substring(0,22)}</strong> — views ${fmt(p.maxViews||0)} tapi CTOR rendah & baru 1× upload. Kemungkinan kena GMV Max traffic seller. Cek seller apakah aktif iklan.`});
  });
  // Hidden winner: high CTOR but low uploads
  products.forEach(p=>{
    if((p.avgCTOR||0)>=1.0&&(p.nVideo||0)<=2)
      al.push({type:'hidden',msg:`<strong>${p.jenis||p.nama.substring(0,22)}</strong> — CTOR ${(p.avgCTOR||0).toFixed(1)}% tapi baru ${p.nVideo||0}× upload. Kandidat Winning tersembunyi — push lebih sering!`});
  });
  // Seller GMV cluster
  const gmvPs=products.filter(p=>p.gmvAktif);
  if(gmvPs.length>=3) al.push({type:'seller',msg:`<strong>${gmvPs.length} produk</strong> dari seller GMV Max aktif. Prioritaskan untuk jadwal minggu depan.`});
  // Winning without content
  const noContent=products.filter(p=>p.klasifikasi==='WINNING'&&!(p.descVariants||[]).length);
  if(noContent.length) al.push({type:'content',msg:`<strong>${noContent.length} Winning product</strong> belum punya isi konten. Buka Master Produk → Generate Isi Konten.`});
  return al;
}

// ── RECOMPUTE AGGREGATIONS ───────────────────────────────────
function parseDate(ds) {
  if(!ds) return 0;
  if(ds.includes('/')) {
    const p = ds.split('/');
    if(p.length===3) return new Date(`${p[2]}-${p[1]}-${p[0]}T00:00:00`).getTime();
  }
  return new Date(ds).getTime() || 0;
}

function recomputeProductStats() {
  const now = Date.now();
  S.products.forEach(p => {
    p.nVideo = 0; p.spreadDays = 0; p.maxViews = 0; p.avgViews = 0;
    p.totalItemsSold = 0; p.totalGMV = 0; p.avgCTR = 0; p.avgCTOR = 0;
    p.uploadDates = []; p.gmvAktif = false;
  });

  const byProd = {};
  S.contents.forEach(c => {
    const key = c.produk.toLowerCase();
    if (!byProd[key]) byProd[key] = [];
    byProd[key].push(c);
  });

  S.products.forEach(prod => {
    const rows = byProd[prod.nama.toLowerCase()] || [];
    if (!rows.length) return;

    rows.sort((a, b) => {
      const da = a.periodeEnd || (a.tanggal ? parseDate(a.tanggal) : 0) || a.ts;
      const db = b.periodeEnd || (b.tanggal ? parseDate(b.tanggal) : 0) || b.ts;
      return da - db;
    });

    let totalWeightedViews = 0, totalWeight = 0;

    rows.forEach(c => {
      const postDate = c.tanggal ? parseDate(c.tanggal) : c.ts;
      const ageContentDays = Math.max(0, (now - postDate) / 86400000);
      const decayContent = Math.pow(0.5, ageContentDays / 45); // Half-life 45 hari

      const transDate = c.periodeEnd || (c.tanggal ? parseDate(c.tanggal) : 0) || c.ts;
      const ageTransDays = Math.max(0, (now - transDate) / 86400000);
      const decayTrans = Math.pow(0.5, ageTransDays / 45); // Half-life 45 hari

      prod.nVideo++;
      const vTotal = c.viewsTotal || c.views || 0;
      prod.maxViews = Math.max(prod.maxViews, vTotal);
      if (c.tanggal && !prod.uploadDates.includes(c.tanggal))
        prod.uploadDates.push(c.tanggal);

      totalWeightedViews += (c.views || 0) * decayContent;
      totalWeight += decayContent;
      
      prod.totalItemsSold += (c.itemsSold || 0) * decayTrans;
      prod.totalGMV += (c.gmv || 0) * decayTrans;
      if ((c.gmv || 0) > 0) prod.gmvAktif = true;

      if ((c.ctr || 0) > 0) prod.avgCTR = prod.avgCTR > 0 ? (prod.avgCTR * 0.7 + c.ctr * 0.3) : c.ctr;
      if ((c.ctor || 0) > 0) prod.avgCTOR = prod.avgCTOR > 0 ? (prod.avgCTOR * 0.7 + c.ctor * 0.3) : c.ctor;
    });

    prod.spreadDays = prod.uploadDates.length;
    prod.avgViews = totalWeight > 0 ? totalWeightedViews / totalWeight : 0;
    prod.totalItemsSold = Math.round(prod.totalItemsSold);
    prod.totalGMV = Math.round(prod.totalGMV);
  });
}

// ── DYNAMIC SCHEDULING HELPERS ────────────────────────────────
function analyzePersonalPatterns() {
  const jamMap = {};
  const hariMap = {};
  let totalVideoWithHours = 0;

  S.contents.forEach(c => {
    let hStr = '';
    
    if (c.jam) {
      const m = c.jam.match(/^(\d{2}):\d{2}/);
      if (m) hStr = m[1] + ':00';
    }
    
    if (!hStr) {
      const ds = c.tanggal || c.periode || '';
      const m = ds.match(/\b(\d{2}):\d{2}\b/);
      if (m) hStr = m[1] + ':00';
    }

    if (hStr) {
      if (!jamMap[hStr]) jamMap[hStr] = { count: 0, views: 0 };
      jamMap[hStr].count++;
      jamMap[hStr].views += (c.views || 0);
      totalVideoWithHours++;
    }

    const ds = c.tanggal || c.periode || '';
    const ts = parseDate(ds) || c.ts;
    if (ts) {
      const dn = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'][new Date(ts).getDay()];
      if (!hariMap[dn]) hariMap[dn] = { count: 0, views: 0 };
      hariMap[dn].count++;
      hariMap[dn].views += (c.views || 0);
    }
  });

  const jam = Object.entries(jamMap).map(([j, d]) => ({ j, n: d.count, av: Math.round(d.views/d.count) })).sort((a,b) => b.n - a.n || b.av - a.av);
  const hari = Object.entries(hariMap).map(([h, d]) => ({ h, n: d.count, av: Math.round(d.views/d.count) }));
  
  return { jam, hari, totalVideoWithHours };
}

function computeDynamicSlots(useDynamic) {
  if (!useDynamic) {
    PRIME_SLOTS = ['18:00','17:00','16:00'];
    MID_SLOTS = ['14:00','13:00','11:00','10:00','09:00'];
    currentSlotSource = 'Bawaan';
    return;
  }

  const pData = analyzePersonalPatterns();
  let jamData = [];
  
  if (pData.totalVideoWithHours >= 10) {
    jamData = pData.jam;
    currentSlotSource = 'Analitik Akun';
  } else {
    analyzeBenchPatterns();
    jamData = BENCH_JAM.slice().sort((a,b) => b.n - a.n);
    currentSlotSource = 'Analitik Kompetitor';
  }

  if (jamData.length >= 3) {
    const primeCount = Math.max(2, Math.ceil(jamData.length * 0.3));
    const midCount = Math.max(3, Math.ceil(jamData.length * 0.4));
    
    PRIME_SLOTS = jamData.slice(0, primeCount).map(j => j.j);
    MID_SLOTS = jamData.slice(primeCount, primeCount + midCount).map(j => j.j);
  } else {
    PRIME_SLOTS = ['18:00','17:00','16:00'];
    MID_SLOTS = ['14:00','13:00','11:00','10:00','09:00'];
  }
}

function computeDayMultiplier(dayName, useAdaptive) {
  if (!useAdaptive) return 1.0;
  
  const pData = analyzePersonalPatterns();
  let hariData = [];
  
  if (pData.hari.length >= 4) {
    hariData = pData.hari;
  } else {
    analyzeBenchPatterns();
    hariData = BENCH_HARI;
  }
  
  if (!hariData || !hariData.length) return 1.0;
  
  const totalViews = hariData.reduce((s, h) => s + (h.av || 0), 0);
  const globalAvg = totalViews / hariData.length;
  if (globalAvg <= 0) return 1.0;
  
  const dayStats = hariData.find(h => h.h === dayName || h.h.includes(dayName) || dayName.includes(h.h));
  if (!dayStats) return 1.0;
  
  const multiplier = dayStats.av / globalAvg;
  return Math.max(0.5, Math.min(1.5, multiplier));
}

// ── MAIN REFRESH ─────────────────────────────────────────────
function refreshScores(){
  const ps=S.products;
  if(!ps.length){updateBadges();return;}
  recomputeProductStats();
  analyzeBenchPatterns();
  
  // determine scoring mode
  const hasCommerce=ps.filter(p=>(p.avgCTR||0)>0||(p.avgCTOR||0)>0||(p.totalItemsSold||0)>0).length;
  const useMode=hasCommerce>=3?'topsis':'benchmark';
  S.scoringMode=useMode;
  // score
  if(useMode==='topsis') scoreTOPSIS(ps);
  else scoreBenchmark(ps);
  // classify & sort
  ps.forEach(p=>{p.klasifikasi=classifyP(p,useMode);p.slotRek=slotR(p.klasifikasi);});
  const ord={WINNING:0,POTENTIAL:1,'UJI COBA':2,MONITOR:3,DROP:4};
  ps.sort((a,b)=>{const d=ord[a.klasifikasi]-ord[b.klasifikasi];return d!==0?d:(b.benchScore||0)-(a.benchScore||0);});
  updateBadges();save();
}

// ── BADGE HELPER ─────────────────────────────────────────────
function bH(k){
  const m={WINNING:'bw',POTENTIAL:'bp',MONITOR:'bm',DROP:'bd-c','UJI COBA':'bgv'};
  return `<span class="badge ${m[k]||'bm'}">${k}</span>`;
}

// ── UPDATE BADGES ─────────────────────────────────────────────
function updateBadges(){
  document.getElementById('nb-d').textContent=S.contents.filter(c=>(c.itemsSold||0)>0||(c.gmv||0)>0).length;
  document.getElementById('nb-p').textContent=S.products.length;
  const ap = S.benchmarkActiveProfile || 'bangjie.id (bawaan)';
  const benchCount = (S.benchmarks && S.benchmarks.length) ? S.benchmarks.filter(b => b.profile === ap).length : BENCH.length;
  document.getElementById('nb-b').textContent = benchCount || BENCH.length;
}
