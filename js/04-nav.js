/*
Tujuan: Sistem Navigasi dan Manajemen Modal
Caller: index.html (Event UI)
Dependensi: renderDash, refreshScores, dll (forward references dipanggil saat runtime)
*/

// ============================================================
// NAV & MODALS
// ============================================================
function goPage(id,el){
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('act'));
  document.querySelectorAll('.ni').forEach(n=>n.classList.remove('act'));
  document.getElementById('page-'+id).classList.add('act');
  if(el) el.classList.add('act');
  const T={dash:'Dashboard',produk:'Master Produk',jadwal:'Jadwal Konten',bank:'Hook · Proof · CTA',script:'Script Generator',import:'Import Analytics',bench:'Benchmark — ' + (S.benchmarkActiveProfile || 'bangjie.id (bawaan)'),guide:'Panduan'};
  document.getElementById('tbar-t').textContent=T[id]||id;
  
  // Forward-references yang dipanggil saat klik (aman karena saat itu file lain sudah di-load)
  const renders={
    dash: typeof renderDash === 'function' ? renderDash : null,
    produk: ()=>{if(typeof refreshScores==='function')refreshScores(); if(typeof renderProduk==='function')renderProduk();},
    jadwal: typeof renderSchedAvail === 'function' ? renderSchedAvail : null,
    bank: typeof renderBank === 'function' ? renderBank : null,
    script: ()=>{if(typeof fillSGDropdowns==='function')fillSGDropdowns();},
    import: typeof renderImpHist === 'function' ? renderImpHist : null,
    bench: typeof renderBench === 'function' ? renderBench : null
  };
  
  if(renders[id])renders[id]();
}

function tabSw(btn,tpId){
  const par=btn.closest('.page,.modal');
  par.querySelectorAll('.tb').forEach(b=>b.classList.remove('act'));
  par.querySelectorAll('.tp').forEach(p=>p.classList.remove('act'));
  btn.classList.add('act');document.getElementById(tpId).classList.add('act');
}

function setMode(m){
  document.getElementById('mb-mine').classList.toggle('act',m==='mine');
  document.getElementById('mb-bench').classList.toggle('act',m==='bench');
  const p=document.getElementById('mpill');
  p.textContent=m==='mine'?'Akunmu':'Benchmark';p.className='mpill '+(m==='mine'?'mine':'bench');
}

function openModal(id){document.getElementById(id).classList.add('open');}
function closeModal(id){document.getElementById(id).classList.remove('open');}
