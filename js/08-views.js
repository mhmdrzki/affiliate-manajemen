/*
Tujuan: Modul Bank Teks, Script Generator (AI), Import Analytics (SheetJS/CSV), Benchmark, dan Inisialisasi Aplikasi
Caller: index.html, onload browser
Dependensi: Semua file sebelumnya (01 s/d 07)
*/

// ============================================================
// HOOK · PROOF · CTA BANK
// ============================================================
function renderBank(){
  renderHookList();renderProofList();renderCTAList();
}
function renderHookList(){
  document.getElementById('hk-ct').textContent=S.hooks.length;
  document.getElementById('hook-list').innerHTML=S.hooks.map(h=>`
    <div class="hk-item">
      <div class="hk-txt">${h.txt}</div>
      <button class="btn btn-g btn-xs" onclick="delHook('${h.id}')">✕</button>
    </div>`).join('');
}
function renderProofList(){
  document.getElementById('pf-ct').textContent=S.proofs.length;
  document.getElementById('proof-list').innerHTML=S.proofs.map(p=>`
    <div class="hk-item">
      <div class="hk-txt">${p.txt}</div>
      <button class="btn btn-g btn-xs" onclick="delProof('${p.id}')">✕</button>
    </div>`).join('');
}
function renderCTAList(){
  document.getElementById('cta-ct').textContent=S.ctas.length;
  document.getElementById('cta-list').innerHTML=S.ctas.map(c=>`
    <div class="hk-item">
      <div class="hk-txt">${c.txt}</div>
      <button class="btn btn-g btn-xs" onclick="delCTA('${c.id}')">✕</button>
    </div>`).join('');
}
function addHook(){const t=document.getElementById('hk-txt').value.trim();if(!t){toast('Kosong');return;}S.hooks.push({id:'h'+Date.now(),txt:t});save();renderHookList();document.getElementById('hk-txt').value='';toast('Hook disimpan');}
function addProof(){const t=document.getElementById('pf-txt').value.trim();if(!t){toast('Kosong');return;}S.proofs.push({id:'p'+Date.now(),txt:t});save();renderProofList();document.getElementById('pf-txt').value='';toast('Proof disimpan');}
function addCTA(){const t=document.getElementById('cta-txt').value.trim();if(!t){toast('Kosong');return;}S.ctas.push({id:'c'+Date.now(),txt:t});save();renderCTAList();document.getElementById('cta-txt').value='';toast('CTA disimpan');}
function delHook(id){S.hooks=S.hooks.filter(h=>h.id!==id);save();renderHookList();}
function delProof(id){S.proofs=S.proofs.filter(p=>p.id!==id);save();renderProofList();}
function delCTA(id){S.ctas=S.ctas.filter(c=>c.id!==id);save();renderCTAList();}

// ============================================================
// SCRIPT GENERATOR (standalone)
// ============================================================
function fillSGDropdowns(){
  document.getElementById('sg-prod').innerHTML='<option value="">— pilih atau isi manual —</option>'+S.products.map((p,i)=>`<option value="${i}">${p.jenis||p.nama.substring(0,40)}</option>`).join('');
  document.getElementById('sg-save-prod').innerHTML='<option value="">— jangan simpan —</option>'+S.products.map((p,i)=>`<option value="${i}">${p.jenis||p.nama.substring(0,40)}</option>`).join('');
}
function prefillSG(){
  const i=document.getElementById('sg-prod').value;if(i==='')return;
  const p=S.products[i];
  document.getElementById('sg-nama').value=p.jenis||p.nama.substring(0,40);
  const pts=[];
  if(p.harga)pts.push('Harga Rp'+fmt(p.harga));
  if(p.totalItemsSold>0)pts.push(p.totalItemsSold+' terjual');
  if(p.labelPrestasi&&p.labelPrestasi!=='-')pts.push(p.labelPrestasi);
  document.getElementById('sg-desc').value=pts.join(', ');
  document.getElementById('sg-save-prod').value=i;
}

async function genScript(){
  const nama=document.getElementById('sg-nama').value.trim();
  const desc=document.getElementById('sg-desc').value.trim();
  const dur=document.getElementById('sg-dur').value;
  const style=document.getElementById('sg-style').value;
  if(!nama){toast('Nama produk kosong');return;}

  const btn=document.getElementById('sg-btn');
  btn.disabled=true;btn.innerHTML='<span class="ai-spin"></span> Generating...';
  document.getElementById('sg-dur-b').textContent='~'+dur+'s';
  document.getElementById('sg-out').innerHTML='<div style="padding:20px;text-align:center;color:var(--tx3);font-size:11px"><span class="ai-spin" style="width:16px;height:16px;margin-right:8px"></span>AI sedang generate 3 variasi script...</div>';

  const styleDesc={onetake:'one take dengan kamera tetap dan background sudut ruangan yang natural',demo:'demo produk langsung dengan close-up detail',ootd:'lifestyle/OOTD dengan tampilan outfit',review:'review jujur dan conversational'};

  const prompt=`Kamu adalah asisten untuk affiliator TikTok Shop Indonesia. Buat 3 variasi script video singkat untuk produk berikut:

Produk: ${nama}
Keterangan: ${desc||'Produk berkualitas dengan harga terjangkau'}
Gaya: ${styleDesc[style]||styleDesc.onetake}
Durasi: ~${dur} detik

Format tiap variasi:
[HOOK] - 1 kalimat pembuka yang menarik, tidak clickbait, tidak overclaim
[ISI] - 2-3 kalimat deskripsi/manfaat produk yang jujur dan natural
[PROOF] - 1 kalimat social proof yang tidak berlebihan
[CTA] - 1 kalimat ajakan ke keranjang yang casual dan tidak memaksa

Ketentuan PENTING:
- Bahasa Indonesia casual, conversational, seperti teman ngobrol
- TIDAK menggunakan kata: terbaik, paling, luar biasa, sempurna, wajib punya, must have
- Tidak overclaim — semua klaim harus masuk akal dan believable
- Variasikan angle tiap variasi (fungsi/gaya/value)
- Format output JSON: [{"hook":"...","isi":"...","proof":"...","cta":"..."},...]`;

  try{
    const raw = await callGemini(prompt, 1500);
    const vars = JSON.parse(raw);

    const varColors=['var(--ac)','var(--gr)','var(--am)'];
    document.getElementById('sg-out').innerHTML=vars.map((v,i)=>`
      <div style="margin-bottom:12px;padding:11px;background:var(--bg3);border-radius:var(--r2);border-left:2px solid ${varColors[i]}">
        <div style="font-size:9.5px;font-family:var(--fm);color:var(--tx3);margin-bottom:7px">VARIASI ${i+1}</div>
        <div class="so" style="min-height:auto;padding:10px;font-size:10px">
<span class="s-hd">[HOOK]</span>
${v.hook}

<span class="s-hd">[ISI]</span>
${v.isi}

<span class="s-hd">[PROOF]</span>
${v.proof}

<span class="s-hd">[CTA]</span>
${v.cta}</div>
        <div style="display:flex;gap:4px;margin-top:6px">
          <button class="btn btn-g btn-xs" onclick="copyVar(${i})">⎘ Copy</button>
          <button class="btn btn-am btn-xs" onclick="saveVarToMaster(${i})">⬡ Simpan ke Master</button>
        </div>
      </div>`).join('');

    // Store for save
    window._lastGenVars=vars;
    window._lastGenNama=nama;

    // Auto-save to product if selected
    const saveProdIdx=document.getElementById('sg-save-prod').value;
    if(saveProdIdx!==''){
      const p=S.products[parseInt(saveProdIdx)];
      if(p){
        if(!p.descVariants)p.descVariants=[];
        vars.forEach(v=>{if(p.descVariants.length<3)p.descVariants.push(v.isi);});
        save();toast('Isi konten disimpan ke master produk');
      }
    }
  }catch(err){
    document.getElementById('sg-out').innerHTML=`<div class="al al-d" style="font-size:10px">Gagal: ${err.message}</div>`;
  }
  btn.disabled=false;btn.innerHTML='✦ Generate 3 Variasi (AI)';
}

function copyVar(i){
  const items=document.getElementById('sg-out').querySelectorAll('.so');
  if(items[i])navigator.clipboard.writeText(items[i].innerText).then(()=>toast('Variasi '+(i+1)+' disalin')).catch(()=>toast('Copy manual'));
}
function saveVarToMaster(i){
  const v=window._lastGenVars?.[i];if(!v)return;
  const sel=document.getElementById('sg-save-prod').value;
  if(sel===''){toast('Pilih produk dulu di dropdown "Simpan ke"');return;}
  const p=S.products[parseInt(sel)];if(!p)return;
  if(!p.descVariants)p.descVariants=[];
  if(p.descVariants.length>=3){toast('Sudah 3 variasi. Hapus salah satu dulu.');return;}
  p.descVariants.push(v.isi);save();toast('Disimpan ke '+(p.jenis||p.nama.substring(0,20)));
}

// ============================================================
// IMPORT
// ============================================================
function dov(e,id){e.preventDefault();document.getElementById(id).classList.add('dov');}
function dlv(id){document.getElementById(id).classList.remove('dov');}
function ddr(e){e.preventDefault();dlv('iz-m');const f=e.dataTransfer.files[0];if(f)processFile(f);}
function handleFile(inp){if(inp.files[0])processFile(inp.files[0]);}
function pv(v){if(!v&&v!==0)return 0;const s=String(v).replace(/[Rp%\s,]/g,'').replace(/\./g,'').trim();const n=parseFloat(s);return isNaN(n)?0:n;}
function fk(row,...keys){for(const k of keys){const f=Object.keys(row).find(rk=>rk.toLowerCase().replace(/[\s._]/g,'').includes(k.toLowerCase().replace(/[\s._]/g,'')));if(f!==undefined)return row[f];}return '';}

function processFile(file){
  if(file.name.match(/\.xlsx?$/i) && typeof XLSX === 'undefined') {
    toast('⚠️ SheetJS belum dimuat — pastikan koneksi internet aktif lalu refresh');
    return;
  }
  const r=new FileReader();
  r.onload=e=>{
    try{
      let rows=[];
      if(file.name.toLowerCase().endsWith('.csv')){
        rows=parseCSV(new TextDecoder().decode(e.target.result));
      }else{
        const wb=XLSX.read(e.target.result,{type:'array'});
        rows=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{defval:''});
      }
      importRows(rows,file.name);
    }catch(err){toast('Error: '+err.message);}
  };
  r.readAsArrayBuffer(file);
}

function parseCSV(text){
  const lines=text.split('\n').filter(l=>l.trim());
  if(!lines.length)return[];
  const headers=lines[0].split(',').map(h=>h.replace(/"/g,'').trim());
  return lines.slice(1).map(line=>{
    const vals=[];let cur='',inQ=false;
    for(const ch of line){if(ch==='"'){inQ=!inQ;}else if(ch===','&&!inQ){vals.push(cur.trim());cur='';}else cur+=ch;}
    vals.push(cur.trim());
    const row={};headers.forEach((h,i)=>row[h]=(vals[i]||'').replace(/^"|"$/g,'').trim());
    return row;
  });
}

function parsePeriodeDates(periodeStr, fallbackTs) {
  if (!periodeStr) return { start: fallbackTs, end: fallbackTs };
  const clean = periodeStr.replace(/"/g, '').trim();
  const parts = clean.split(/\s+[-–—~]\s+|\s+s\/d\s+|\s+to\s+|\s+s\.d\.\s+|\s+sampai\s+/i);
  if (parts.length >= 2) {
    const start = parseDate(parts[0].trim()) || fallbackTs;
    const end = parseDate(parts[parts.length - 1].trim()) || fallbackTs;
    return { start, end };
  }
  const d = parseDate(clean) || fallbackTs;
  return { start: d, end: d };
}

function importRows(rows,filename){
  let added=0,merged=0,skipped=0;
  rows.forEach(row=>{
    const produk=String(fk(row,'nama produk','namaproduk','produk','product')||'').trim();
    const desc=String(fk(row,'deskripsi','description','deskripsi video')||'').trim();
    if(!produk||produk.length<2||produk.toLowerCase().startsWith('nama')){skipped++;return;}
    const gmv=pv(fk(row,'attr. gmv','attr gmv','gmv'));
    const sold=pv(fk(row,'attr. items sold','items sold','itemssold','terjual','sold'));
    const ctr=pv(fk(row,'ctr'));
    const ctor=pv(fk(row,'ctor'));
    const aov=pv(fk(row,'aov'));
    const views=pv(fk(row,'views'));
    const link=String(fk(row,'link','url')||'').trim();
    const tanggal=String(fk(row,'tanggal posting','tanggal','date')||'').trim();
    const durasi=String(fk(row,'durasi','duration')||'').trim();
    const periode=String(fk(row,'periode data','periode')||'').trim();

    // Dedup
    const { start: pStart, end: pEnd } = parsePeriodeDates(periode, Date.now());
    const dupIdx=S.contents.findIndex(c=>c.produk.toLowerCase()===produk.toLowerCase()&&c.tanggal===tanggal&&tanggal!==''&&c.durasi===durasi);
    if(dupIdx>=0){
      S.contents[dupIdx].gmv=Math.max(S.contents[dupIdx].gmv||0,gmv);
      S.contents[dupIdx].itemsSold=Math.max(S.contents[dupIdx].itemsSold||0,sold);
      S.contents[dupIdx].ctr=Math.max(S.contents[dupIdx].ctr||0,ctr);
      S.contents[dupIdx].ctor=Math.max(S.contents[dupIdx].ctor||0,ctor);
      S.contents[dupIdx].views=Math.max(S.contents[dupIdx].views||0,views);
      if(pEnd>(S.contents[dupIdx].periodeEnd||0)){
        S.contents[dupIdx].periode=periode;
        S.contents[dupIdx].periodeStart=pStart;
        S.contents[dupIdx].periodeEnd=pEnd;
      }
      merged++;return;
    }

    // Find or create product
    let prod=S.products.find(p=>produk.toLowerCase()===p.nama.toLowerCase());
    if(!prod){
      const pn=produk.toLowerCase();
      let cat='umum',jenis='Produk';
      if(/celana|jogger|chinos|jeans|corduroy/.test(pn)){cat='fashion';jenis='Celana';}
      else if(/kaos|tee|t-shirt/.test(pn)){cat='fashion';jenis='Kaos';}
      else if(/jaket|hoodie|sweater|jumper/.test(pn)){cat='fashion';jenis='Jaket';}
      else if(/sepatu|sandal|slipper/.test(pn)){cat='fashion';jenis='Sepatu';}
      else if(/tas|backpack|dompet/.test(pn)){cat='fashion';jenis='Tas';}
      else if(/parfum|cologne|edp|edt|fragrance/.test(pn)){cat='parfum';jenis='Parfum';}
      else if(/serum|moisturizer|sunscreen|toner|essence|sabun muka/.test(pn)){cat='skincare';jenis='Skincare';}
      else if(/creatine|protein|suplemen|vitamin/.test(pn)){cat='olahraga';jenis='Suplemen';}
      else if(/kalung|gelang|cincin|aksesoris/.test(pn)){cat='fashion';jenis='Aksesoris';}
      else if(/baju|dress|rok|kemeja|polo/.test(pn)){cat='fashion';jenis='Baju';}
      prod={id:'p'+Date.now()+Math.random(),nama:produk,jenis,harga:0,komisi:0,kategori:cat,labelPrestasi:'-',gmvAktif:false,descVariants:[],nVideo:0,spreadDays:0,maxViews:0,avgViews:0,totalItemsSold:0,totalGMV:0,avgCTR:0,avgCTOR:0,uploadDates:[],score:0,klasifikasi:'MONITOR',slotRek:'08:00/12:00'};
      S.products.push(prod);
    }
    const estK=sold>0&&prod.komisi>0?sold*prod.komisi:0;
    S.contents.push({id:'c'+Date.now()+Math.random(),produk,desc,tanggal,durasi,periode,periodeStart:pStart,periodeEnd:pEnd,gmv,itemsSold:sold,ctr,ctor,aov,views,link,estK,ts:Date.now()});
    added++;
  });
  S.importHistory.push({filename,added,merged,skipped,ts:new Date().toLocaleString('id'),total:S.contents.length});
  refreshScores();save();renderDash();renderImpHist();updateBadges();
  document.getElementById('imp-status').innerHTML=`<div class="al al-s">✅ <strong>+${added}</strong> baris, ${merged} merge, ${skipped} skip. Total: ${S.contents.length} konten, ${S.products.length} produk.</div>`;
  toast(`+${added} konten diimport`);
}

function renderImpHist(){
  document.getElementById('imp-hist-ct').textContent=S.importHistory.length;
  document.getElementById('imp-hist').innerHTML=S.importHistory.length?S.importHistory.slice().reverse().map(h=>`
    <div style="display:flex;align-items:center;gap:7px;padding:6px 0;border-bottom:1px solid var(--bd);font-size:10.5px">
      <div style="flex:1"><div style="color:var(--tx2)">${h.filename}</div><div style="font-size:9px;color:var(--tx3)">${h.ts}</div></div>
      <div style="font-family:var(--fm);font-size:9.5px;color:var(--gr)">+${h.added}</div>
      <div style="font-family:var(--fm);font-size:9.5px;color:var(--am)">${h.merged} merge</div>
      <div style="font-family:var(--fm);font-size:9.5px;color:var(--tx3)">${h.total} total</div>
    </div>`).join(''):`<div style="font-size:10.5px;color:var(--tx3)">Belum ada riwayat.</div>`;
}

function clearAll(){
  if(confirm('Reset semua data? Hook, Proof, CTA tetap.')){
    S.products=[];S.contents=[];S.importHistory=[];schedData=[];
    save();updateBadges();renderDash();
    document.getElementById('imp-hist').innerHTML='';
    document.getElementById('imp-status').innerHTML='';
    toast('Data direset');
  }
}

// ============================================================
// IMPORT BENCHMARK
// ============================================================
function getBenchProfiles() {
  const set = new Set(['bangjie.id (bawaan)']);
  (S.benchmarks || []).forEach(b => { if (b.profile) set.add(b.profile); });
  return Array.from(set);
}
function renderBenchProfileDropdown() {
  const profiles = getBenchProfiles();
  const active = S.benchmarkActiveProfile || 'bangjie.id (bawaan)';
  const selH = document.getElementById('bench-profile-sel');
  if (selH) selH.innerHTML = profiles.map(p => `<option value="${p}" ${p === active ? 'selected' : ''}>${p}</option>`).join('');
  const selI = document.getElementById('bench-import-target');
  if (selI) selI.innerHTML = profiles.map(p => `<option value="${p}">${p}</option>`).join('') + '<option value="__new__">+ Buat Profil Baru</option>';
  const delBtn = document.getElementById('bench-del-btn');
  if (delBtn) delBtn.style.display = (active === 'bangjie.id (bawaan)') ? 'none' : '';
}
function changeBenchProfile(name) {
  S.benchmarkActiveProfile = name;
  save(); analyzeBenchPatterns(); renderBench(); updateBadges();
}
function deleteBenchProfile() {
  const ap = S.benchmarkActiveProfile;
  if (ap === 'bangjie.id (bawaan)') { toast('Profil bawaan tidak bisa dihapus'); return; }
  if (!confirm(`Hapus profil "${ap}" dan semua datanya?`)) return;
  S.benchmarks = (S.benchmarks || []).filter(b => b.profile !== ap);
  S.benchmarkActiveProfile = 'bangjie.id (bawaan)';
  save(); analyzeBenchPatterns(); renderBench(); updateBadges();
  toast(`Profil "${ap}" dihapus`);
}
function toggleNewProfileInput(val) {
  const wrap = document.getElementById('bench-new-name-wrap');
  if (wrap) wrap.style.display = (val === '__new__') ? '' : 'none';
}

function ddrBench(e){e.preventDefault();dlv('bz-m');const f=e.dataTransfer.files[0];if(f)processBenchmarkFile(f);}
function handleBenchmarkFile(inp){if(inp.files[0])processBenchmarkFile(inp.files[0]);}

function processBenchmarkFile(file){
  if(file.name.match(/\.xlsx?$/i) && typeof XLSX === 'undefined') {
    toast('⚠️ SheetJS belum dimuat'); return;
  }
  const r=new FileReader();
  r.onload=e=>{
    try{
      let rows=[];
      if(file.name.toLowerCase().endsWith('.csv')) rows=parseCSV(new TextDecoder().decode(e.target.result));
      else{
        const wb=XLSX.read(e.target.result,{type:'array'});
        rows=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{defval:''});
      }
      importBenchmark(rows, file.name);
    }catch(err){toast('Error: '+err.message);}
  };
  r.readAsArrayBuffer(file);
}

function importBenchmark(rows, filename) {
  if (!S.benchmarks) S.benchmarks = [];
  const targetSel = document.getElementById('bench-import-target');
  const modeSel = document.getElementById('bench-import-mode');
  let profileName = targetSel ? targetSel.value : (S.benchmarkActiveProfile || 'bangjie.id (bawaan)');
  const importMode = modeSel ? modeSel.value : 'merge';

  if (profileName === '__new__') {
    const nameInput = document.getElementById('bench-new-name');
    profileName = nameInput ? nameInput.value.trim() : '';
    if (!profileName || profileName.length < 2) { toast('Nama profil minimal 2 karakter'); return; }
    const existing = getBenchProfiles().map(p => p.toLowerCase());
    if (existing.includes(profileName.toLowerCase())) { toast('Nama profil sudah ada, pilih dari dropdown'); return; }
  }

  if (importMode === 'overwrite') {
    S.benchmarks = S.benchmarks.filter(b => b.profile !== profileName);
  }

  let added = 0;
  rows.forEach(row => {
    const nama = String(fk(row, 'nama produk', 'namaproduk', 'produk', 'product') || '').trim();
    if (!nama || nama.length < 2) return;

    const hari = String(fk(row, 'hari') || '').trim();
    const tanggal = String(fk(row, 'tanggal upload', 'tanggal', 'date') || '').trim();
    const jam = String(fk(row, 'jam upload', 'jam', 'waktu', 'time') || '').trim();
    const harga = pv(fk(row, 'harga jual', 'harga', 'price'));
    const rating = pv(fk(row, 'rating'));
    const terjual = pv(fk(row, 'total terjual', 'terjual', 'sold'));
    const label = String(fk(row, 'label prestasi', 'label') || '-').trim();
    const desc = String(fk(row, 'deskripsi', 'description') || '').trim();
    const durasi = String(fk(row, 'durasi', 'duration') || '').trim();
    const views = pv(fk(row, 'views'));
    const likes = pv(fk(row, 'likes'));
    const komentar = pv(fk(row, 'komentar'));
    const share = pv(fk(row, 'share'));
    const er = pv(fk(row, 'er', '_er'));
    const link = String(fk(row, 'link', 'link video') || '').trim();

    const dupIdx = S.benchmarks.findIndex(b =>
      b.profile === profileName &&
      b.nama.toLowerCase() === nama.toLowerCase() &&
      b.tanggal === tanggal && b.durasi === durasi);

    if (dupIdx >= 0) {
      Object.assign(S.benchmarks[dupIdx], {
        views: Math.max(S.benchmarks[dupIdx].views || 0, views),
        terjual: Math.max(S.benchmarks[dupIdx].terjual || 0, terjual)
      });
      return;
    }

    S.benchmarks.push({ profile: profileName, nama, hari, tanggal, jam, harga, rating, terjual, label, desc, durasi, views, likes, komentar, share, er, link });
    added++;
  });

  S.benchmarkActiveProfile = profileName;
  analyzeBenchPatterns();
  save();
  renderBench();
  updateBadges();

  const statusEl = document.getElementById('bench-import-status');
  if (statusEl) {
    statusEl.innerHTML = `<div class="al al-s">✅ <strong>+${added}</strong> data benchmark ke profil "${profileName}" (${importMode === 'overwrite' ? 'timpa' : 'merge'}).</div>`;
  }
  toast(`+${added} data benchmark diimpor`);
}

// ============================================================
// BENCHMARK
// ============================================================
let currentBenchData = BENCH;

function renderBench(){
  if(typeof renderBenchProfileDropdown === 'function') renderBenchProfileDropdown();
  const ap = S.benchmarkActiveProfile || 'bangjie.id (bawaan)';
  const all = (S.benchmarks && S.benchmarks.length) ? S.benchmarks : [];
  const src = all.filter(b => b.profile === ap);
  currentBenchData = BENCH;
  
  if (src.length) {
    const agg = {};
    src.forEach(b => {
      const key = b.nama.toLowerCase();
      if (!agg[key]) agg[key] = { nama: b.nama, jenis: (b.nama.split(' ')[0] || 'Produk'), harga: b.harga, komisi: Math.round((b.harga||0) * 0.1), nV: 0, uploadDates: [], maxV: 0, totalV: 0, label: b.label };
      agg[key].nV++;
      if (b.tanggal && !agg[key].uploadDates.includes(b.tanggal)) agg[key].uploadDates.push(b.tanggal);
      agg[key].maxV = Math.max(agg[key].maxV, b.views || 0);
      agg[key].totalV += (b.views || 0);
      if (b.label !== '-') agg[key].label = b.label;
    });
    currentBenchData = Object.values(agg).map(p => ({
      nama: p.nama, jenis: p.jenis, komisi: p.komisi, harga: p.harga, nV: p.nV, sp: p.uploadDates.length, maxV: p.maxV, avgV: Math.round(p.totalV / p.nV), label: p.label
    })).sort((a,b)=> b.nV - a.nV);
  }

  const titleEl = document.getElementById('bench-prod-title');
  if (titleEl) titleEl.textContent = `Produk ${ap} — urut frekuensi upload`;

  document.getElementById('tbody-bench').innerHTML=currentBenchData.map(p=>{
    const k=p.nV>=5?'WINNING':p.nV>=3?'POTENTIAL':'MONITOR';
    const sig=p.nV>=7?'🔥 Push intensif':p.nV>=5?'✅ Push kuat':p.nV>=3?'↑ Mulai push':p.maxV>10000?'⚡ GMV Max':'👀 Test';
    return`<tr>
      <td style="max-width:160px"><div style="font-size:11px;font-weight:600">${p.jenis}</div><div style="font-size:9.5px;color:var(--tx3)">${p.nama.substring(0,45)}</div></td>
      <td style="font-family:var(--fm);font-size:13px;font-weight:700;color:${k==='WINNING'?'var(--gr)':k==='POTENTIAL'?'var(--bl)':'var(--am)'}">${p.nV}×</td>
      <td style="font-family:var(--fm);font-size:9.5px;color:var(--tx3)">${p.sp}hr</td>
      <td style="font-family:var(--fm);font-size:9.5px">${fmt(p.maxV)}</td>
      <td style="font-family:var(--fm);font-size:9.5px;color:var(--tx3)">${fmt(p.avgV)}</td>
      <td style="font-family:var(--fm);font-size:9.5px;color:var(--gr)">Rp${fmt(p.komisi)}</td>
      <td style="font-size:9px;color:var(--tx3)">${p.label||'—'}</td>
      <td>${bH(k)} <span style="font-size:9px;color:var(--tx3);margin-left:3px">${sig}</span></td>
      <td><button class="btn btn-g btn-xs" onclick='copyOneBench(${JSON.stringify(p)})'>+</button></td>
    </tr>`;
  }).join('');

  const maxJ=Math.max(...BENCH_JAM.map(j=>j.n));
  document.getElementById('b-jam').innerHTML=BENCH_JAM.map(j=>`
    <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
      <div style="font-family:var(--fm);font-size:9.5px;color:var(--tx2);min-width:38px">${j.j}</div>
      <div style="flex:1;height:5px;background:var(--bg4);border-radius:3px;overflow:hidden"><div style="height:100%;width:${(j.n/maxJ*100).toFixed(0)}%;background:${j.n>=28?'var(--ac)':'var(--bd2)'};border-radius:3px;transition:width .4s"></div></div>
      <div style="font-family:var(--fm);font-size:9.5px;color:var(--tx3);min-width:22px">${j.n}×</div>
    </div>`).join('');

  const maxH=Math.max(...BENCH_HARI.map(h=>h.n));
  document.getElementById('b-hari').innerHTML=BENCH_HARI.map(h=>`
    <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
      <div style="font-size:9.5px;color:var(--tx2);min-width:44px">${h.h}</div>
      <div style="flex:1;height:5px;background:var(--bg4);border-radius:3px;overflow:hidden"><div style="height:100%;width:${(h.n/maxH*100).toFixed(0)}%;background:${h.av>=4000?'var(--gr)':'var(--bd2)'};border-radius:3px;transition:width .4s"></div></div>
      <div style="font-family:var(--fm);font-size:9.5px;color:var(--tx3)">${h.n}× · ${fmt(h.av)}v</div>
    </div>`).join('');

  document.getElementById('b-weekly').innerHTML=`
    <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:5px;margin-bottom:9px">
      ${['Sen','Sel','Rab','Kam','Jum','Sab','Min'].map((d,i)=>{const h=BENCH_HARI[i];return`<div style="background:var(--bg3);border-radius:var(--r);padding:7px;text-align:center;border:1px solid ${h.av>=4000?'var(--grd)':'var(--bd)'}"><div style="font-size:10px;font-weight:600;color:${h.av>=4000?'var(--gr)':'var(--tx2)'}">${d}</div><div style="font-size:8.5px;color:var(--tx3);margin-top:2px">${h.n}v · ${fmt(h.av)}</div></div>`;}).join('')}
    </div>
    <div class="al al-i" style="font-size:10px"><strong>Pola tipikal:</strong> 6 video/hari, 7 hari penuh. Winning dipush 2–3× per minggu, interval 3–4 hari, di slot 10–18.</div>`;

  const topProd = currentBenchData.length ? currentBenchData[0] : null;
  const totalUploads = currentBenchData.reduce((s, p) => s + p.nV, 0);
  const avgUploadsPerProduct = currentBenchData.length ? Math.round(totalUploads / currentBenchData.length) : 0;
  
  document.getElementById('b-ins').innerHTML=`
    <div style="display:grid;gap:7px">
      <div class="al al-s"><strong>🔑 Frekuensi = sinyal winning</strong><br>${topProd ? `${topProd.nama.substring(0,30)} ${topProd.nV}× upload (maxV ${fmt(topProd.maxV)}). Produk paling sering di-push.` : 'Belum ada data.'}</div>
      <div class="al al-w"><strong>⚡ Views spike 1× ≠ winning</strong><br>Jika views besar tapi hanya 1× upload = kemungkinan GMV Max traffic seller, bukan push sendiri.</div>
      <div class="al al-i"><strong>◷ Rata-rata ${avgUploadsPerProduct}× upload per produk</strong><br>${currentBenchData.length} produk terdeteksi. Amati frekuensi upload untuk temukan winning pattern.</div>
      <div class="al al-p"><strong>💡 Volume konten = peluang GMV Max</strong><br>Makin banyak video produk yang sama, makin besar peluang satu di antaranya dipilih seller sebagai Spark Ads.</div>
    </div>`;
}

function copyOneBench(p){
  if(S.products.find(pr=>pr.nama.toLowerCase()===p.nama.toLowerCase())){toast('Sudah ada di master');return;}
  S.products.push({id:'p'+Date.now(),nama:p.nama,jenis:p.jenis||'Produk',harga:p.harga,komisi:p.komisi,kategori:'fashion',labelPrestasi:p.label||'-',gmvAktif:false,descVariants:[],nVideo:0,spreadDays:0,maxViews:0,avgViews:0,totalItemsSold:0,totalGMV:0,avgCTR:0,avgCTOR:0,uploadDates:[],score:0,klasifikasi:'MONITOR',slotRek:'08:00/12:00'});
  refreshScores();save();toast('Disalin: '+p.jenis);
}
function copyAllBench(){
  let a=0;currentBenchData.forEach(p=>{if(!S.products.find(pr=>pr.nama.toLowerCase()===p.nama.toLowerCase())){copyOneBench(p);a++;}});
  toast(a+' produk disalin');
}
function adoptBench(){
  document.getElementById('sd-range').value='7';
  document.getElementById('sd-pat').value='6';
  document.getElementById('sd-date').value=new Date().toISOString().split('T')[0];
  goPage('jadwal',document.querySelectorAll('.ni')[2]);
  setTimeout(genSched,150);
  toast(`Pola ${S.benchmarkActiveProfile || 'benchmark'} diadopsi!`);
}

// ============================================================
// MODAL EVENT LISTENERS
// ============================================================
document.getElementById('modal-add').addEventListener('click',function(e){if(e.target===this)closeModal('modal-add');});
document.getElementById('modal-assign').addEventListener('click',function(e){if(e.target===this)closeModal('modal-assign');});

// ============================================================
// INIT APLIKASI
// ============================================================
refreshScores();
renderDash();
document.getElementById('sd-date').value=new Date().toISOString().split('T')[0];
gdUpdateUI();
initGeminiKey();

// Cek ketersediaan library CDN kritis
if (typeof XLSX === 'undefined') {
  toast('⚠️ SheetJS gagal dimuat — fitur import membutuhkan koneksi internet');
}
