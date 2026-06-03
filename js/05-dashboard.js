/*
Tujuan: Modul Dashboard dan Formatter Utilitas
Caller: 04-nav.js, 08-views.js (Init)
Dependensi: S (dari 02-state), detectAnomalies (dari 03-scoring)
Main Functions: fmt, renderDash
Side Effects: DOM rendering
*/

// ============================================================
// UTILS
// ============================================================
function fmt(n){if(!n)return'0';n=Math.round(n);if(n>=1000000)return(n/1000000).toFixed(1)+'jt';if(n>=1000)return(n/1000).toFixed(0)+'rb';return n.toLocaleString('id');}

// ============================================================
// DASHBOARD
// ============================================================
function renderDash(){
  const cs=S.contents;
  const tG=cs.reduce((a,c)=>a+(c.gmv||0),0),tS=cs.reduce((a,c)=>a+(c.itemsSold||0),0),tK=cs.reduce((a,c)=>a+(c.estK||0),0);
  const vCTR=cs.filter(c=>(c.ctr||0)>0),vCTOR=cs.filter(c=>(c.ctor||0)>0);
  const aCTR=vCTR.length?vCTR.reduce((a,c)=>a+c.ctr,0)/vCTR.length:0;
  const aCTOR=vCTOR.length?vCTOR.reduce((a,c)=>a+c.ctor,0)/vCTOR.length:0;
  
  document.getElementById('dm-gmv').textContent=tG>0?'Rp'+fmt(tG):'Rp0';
  document.getElementById('dm-gmv-s').textContent=cs.filter(c=>(c.itemsSold||0)>0||(c.gmv||0)>0).length+' konten ber-GMV';
  document.getElementById('dm-sold').textContent=tS;
  document.getElementById('dm-kom').textContent=tK>0?'Rp'+fmt(tK):'Rp0';
  document.getElementById('dm-ctr').textContent=aCTR>0?aCTR.toFixed(1)+'%':'—';
  document.getElementById('dm-ctor').textContent=aCTOR>0?aCTOR.toFixed(1)+'%':'—';
  document.getElementById('dm-cnt').textContent=cs.length;
  document.getElementById('d-badge').textContent=cs.length;

  const srt=document.getElementById('dsort').value;
  const sf={
    gmv:(a,b)=>(b.gmv||0)-(a.gmv||0),
    ctor:(a,b)=>(b.ctor||0)-(a.ctor||0),
    ctr:(a,b)=>(b.ctr||0)-(a.ctr||0),
    sold:(a,b)=>(b.itemsSold||0)-(a.itemsSold||0),
    views:(a,b)=>(b.views||0)-(a.views||0),
    date:(a,b)=>b.ts-a.ts
  };
  const pMap = {};
  S.products.forEach(p => { pMap[p.nama.toLowerCase()] = p; });

  const sorted=[...cs].sort(sf[srt]||sf.gmv);
  
  document.getElementById('tbody-dash').innerHTML=sorted.length?sorted.map(c=>{
    const p = pMap[c.produk.toLowerCase()];
    const kategori = p ? (p.kategori || '—') : '—';
    return `<tr>
      <td style="max-width:140px;font-size:10.5px">${(c.desc||'—').substring(0,36)}</td>
      <td style="max-width:100px;font-size:10.5px">${kategori}</td>
      <td style="max-width:130px;font-size:10.5px">${(c.produk||'—').substring(0,32)}</td>
      <td style="font-size:9.5px;color:var(--tx3);white-space:nowrap">${c.tanggal||'—'}</td>
      <td style="font-family:var(--fm);font-size:9.5px">${fmt(c.views||0)}</td>
      <td style="font-family:var(--fm);font-size:9.5px;color:${(c.ctr||0)>1?'var(--gr)':'var(--tx2)'}">${(c.ctr||0).toFixed(1)}%</td>
      <td style="font-family:var(--fm);font-size:9.5px;color:${(c.ctor||0)>0.5?'var(--ac2)':'var(--tx2)'}">${(c.ctor||0).toFixed(1)}%</td>
      <td style="font-family:var(--fm);font-size:9.5px;font-weight:600;color:${(c.itemsSold||0)>0?'var(--gr)':'var(--tx3)'}">${c.itemsSold||0}</td>
      <td style="font-family:var(--fm);font-size:9.5px;color:${(c.gmv||0)>0?'var(--pu)':'var(--tx3)'}">${c.gmv>0?'Rp'+fmt(c.gmv):'Rp0'}</td>
    </tr>`;
  }).join(''):`<tr><td colspan="9"><div class="empty"><div class="empty-t">Belum ada data</div></div></td></tr>`;

  refreshScores();
  
  const winning=S.products.filter(p=>p.klasifikasi==='WINNING');
  const drop=S.products.filter(p=>p.klasifikasi==='DROP');
  const highCTOR=S.contents.filter(c=>(c.ctor||0)>=1.5);
  
  // Scoring mode indicator
  const modeLabel=S.scoringMode==='topsis'
    ?'<div class="al" style="background:var(--grb);border:1px solid var(--grd);color:#86EFAC;font-size:10px;margin-bottom:6px">✦ Scoring mode: <strong>TOPSIS multi-kriteria</strong> (data CTR/CTOR tersedia) — akurasi tinggi</div>'
    :'<div class="al" style="background:var(--pub);border:1px solid var(--pud);color:#C4B5FD;font-size:10px;margin-bottom:6px">◈ Scoring mode: <strong>Frekuensi-based</strong> (belum cukup data CTR/CTOR) — tambah ≥3 produk ber-data untuk aktifkan TOPSIS</div>';

  const als=[modeLabel];
  if(!cs.length)als.push(`<div class="al al-i">Import data analytics untuk mulai.</div>`);

  // Anomaly alerts from detector
  const anomalies=detectAnomalies(S.products);
  anomalies.forEach(a=>{
    const cls=a.type==='hidden'?'al-s':a.type==='gmvmax'?'al-w':a.type==='seller'?'al-p':'al-i';
    als.push(`<div class="al ${cls}">${a.type==='hidden'?'🔥':a.type==='gmvmax'?'⚡':a.type==='seller'?'💰':'📝'} ${a.msg}</div>`);
  });

  if(drop.length)als.push(`<div class="al al-d">⚠️ <strong>${drop.length} produk harus di-drop</strong>: ${drop.slice(0,3).map(p=>(p.jenis||p.nama).substring(0,20)).join(', ')}</div>`);
  if(winning.length)als.push(`<div class="al al-s">✅ <strong>${winning.length} Winning</strong> → prime slot: ${winning.slice(0,3).map(p=>`${(p.jenis||p.nama).substring(0,20)} (CS ${((p.salesConsistency||0)*100).toFixed(0)}%, CE ${(p.conversionEfficiency||0).toFixed(1)})`).join(', ')}</div>`);
  if(highCTOR.length)als.push(`<div class="al al-s">🔥 <strong>${highCTOR.length} konten CTOR≥1.5%</strong> — kandidat re-upload segera</div>`);
  const noGmv=winning.filter(p=>!p.gmvAktif);
  if(noGmv.length)als.push(`<div class="al al-w">💡 <strong>${noGmv.length} winning belum GMV Max</strong> — cek seller</div>`);
  
  document.getElementById('dash-al').innerHTML=als.length?als.join(''):'<div style="font-size:10.5px;color:var(--tx3)">Tidak ada alert.</div>';
}
