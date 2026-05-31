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
const BENCH_JAM=[{j:"08:00",n:18},{j:"10:00",n:37},{j:"12:00",n:28},{j:"14:00",n:30},{j:"16:00",n:23},{j:"18:00",n:18}];
const BENCH_HARI=[{h:"Senin",n:28,av:4190},{h:"Selasa",n:24,av:3434},{h:"Rabu",n:26,av:3888},{h:"Kamis",n:20,av:2149},{h:"Jumat",n:22,av:1875},{h:"Sabtu",n:29,av:4843},{h:"Minggu",n:28,av:4499}];

// ============================================================
// SLOT PATTERNS
// ============================================================
const PATS={'3':['10:00','14:00','18:00'],'5':['09:00','11:00','14:00','16:00','18:00'],'6':['08:00','10:00','12:00','14:00','16:00','18:00'],'10':['07:00','08:00','09:00','10:00','11:00','13:00','14:00','16:00','17:00','18:00']};
const PRIME_SLOTS=['18:00','17:00','16:00'];
const MID_SLOTS=['14:00','13:00','11:00','10:00','09:00'];

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
  const n=p.nVideo||0,sold=p.totalItemsSold||0,gmv=p.totalGMV||0;
  const mv=p.maxViews||0,ctr=p.avgCTR||0,ctor=p.avgCTOR||0;
  const ts=p.topsisScore||0;
  if(mode==='topsis'){
    if(ts>=0.65)return 'WINNING';
    if(sold>=3&&ts>=0.30)return 'WINNING';
    if(n>=3&&mv<2000&&ctr===0&&ctor===0&&sold===0)return 'DROP';
    if(ts>=0.30)return 'POTENTIAL';
    if(ctr>0.5&&n>=2)return 'POTENTIAL';
    if(sold>=1&&ts>=0.15)return 'POTENTIAL';
    return 'MONITOR';
  }
  // benchmark (frequency-based)
  if(n>=5||(n>=3&&(sold>0||gmv>0)))return 'WINNING';
  if(n>=3&&mv<2000&&ctr===0&&sold===0)return 'DROP';
  if(n>=3||(n>=2&&ctr>0))return 'POTENTIAL';
  return 'MONITOR';
}
function slotR(k){return k==='WINNING'?'16:00/18:00':k==='POTENTIAL'?'10:00/14:00':k==='DROP'?'—':'08:00/12:00';}

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

// ── MAIN REFRESH ─────────────────────────────────────────────
function refreshScores(){
  const ps=S.products;
  if(!ps.length){updateBadges();return;}
  // determine scoring mode
  const hasCommerce=ps.filter(p=>(p.avgCTR||0)>0||(p.avgCTOR||0)>0||(p.totalItemsSold||0)>0).length;
  const useMode=hasCommerce>=3?'topsis':'benchmark';
  S.scoringMode=useMode;
  // score
  if(useMode==='topsis') scoreTOPSIS(ps);
  else scoreBenchmark(ps);
  // classify & sort
  ps.forEach(p=>{p.klasifikasi=classifyP(p,useMode);p.slotRek=slotR(p.klasifikasi);});
  const ord={WINNING:0,POTENTIAL:1,MONITOR:2,DROP:3};
  ps.sort((a,b)=>{const d=ord[a.klasifikasi]-ord[b.klasifikasi];return d!==0?d:(b.benchScore||0)-(a.benchScore||0);});
  updateBadges();save();
}

// ── BADGE HELPER ─────────────────────────────────────────────
function bH(k){
  const m={WINNING:'bw',POTENTIAL:'bp',MONITOR:'bm',DROP:'bd-c'};
  return `<span class="badge ${m[k]||'bm'}">${k}</span>`;
}

// ── UPDATE BADGES ─────────────────────────────────────────────
function updateBadges(){
  document.getElementById('nb-d').textContent=S.contents.filter(c=>(c.itemsSold||0)>0||(c.gmv||0)>0).length;
  document.getElementById('nb-p').textContent=S.products.length;
  document.getElementById('nb-b').textContent=BENCH.length;
}
