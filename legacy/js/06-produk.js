/*
Tujuan: Modul Master Produk & Kategori (Render list dengan metrik komposit baru, metrik AI-Emulator, Deskripsi AI, Quick Add/Save, Kategori Dinamis).
Caller: 04-nav.js, 08-views.js, UI Events
Dependensi: S, save, callGemini (02-state.js); bH, refreshScores (03-scoring.js); fmt (05-dashboard.js); toast (02-state.js); openModal, closeModal (04-nav.js)
Main Functions: renderProduk, renderPList, delProd, openAddProd, openGenDesc, doGenDesc, saveNewProd, renderCatOptions, addNewCategory, removeCategory, renderCatManager
Side Effects: Menyimpan data global S ke LocalStorage via save(), memanggil Gemini API, merender DOM
*/

// ============================================================
// MASTER PRODUK
// ============================================================
function renderProduk(){
  const all=S.products;
  const groups={all,w:all.filter(p=>p.klasifikasi==='WINNING'),p:all.filter(p=>p.klasifikasi==='POTENTIAL'),m:all.filter(p=>p.klasifikasi==='MONITOR'),u:all.filter(p=>p.klasifikasi==='UJI COBA'),d:all.filter(p=>p.klasifikasi==='DROP')};
  Object.entries(groups).forEach(([k,ps])=>renderPList(`prod-${k}-list`,ps));
}

function renderPList(elId,ps){
  const el=document.getElementById(elId);if(!el)return;
  if(!ps.length){el.innerHTML=`<div class="empty"><div class="empty-t">Kosong</div></div>`;return;}
  el.innerHTML=ps.map((p,i)=>{
    const badges = [];
    badges.push(bH(p.klasifikasi));
    const status = p.status || 'aktif';
    if (status === 'habis') badges.push(`<span class="badge bd-c" style="background:var(--rd);color:white;font-weight:bold">STOK HABIS</span>`);
    if (status === 'jeda') badges.push(`<span class="badge bm" style="background:var(--am);color:white;font-weight:bold">JEDA</span>`);
    if (p.brand) badges.push(`<span class="badge bg-b" style="background:var(--bg3);color:var(--tx2);font-weight:600;border:1px solid var(--bd)">${p.brand}</span>`);
    if (p.kategori) badges.push(`<span class="badge bp">${p.kategori}</span>`);
    if (p.gmvAktif) badges.push('<span class="gdot on"></span>');
    
    const subtitleParts = [];
    if (p.jenis && p.jenis !== 'Produk') subtitleParts.push(p.jenis);
    if (p.harga) subtitleParts.push('Rp' + fmt(p.harga));
    const subtitle = subtitleParts.join(' · ');
 
    return `
    <div class="prod-card" data-prodstatus="${status}" style="opacity: ${status === 'aktif' ? 1 : 0.75}">
      <div class="prod-card-hdr">
        <div style="flex:1;min-width:0">
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;flex-wrap:wrap">
            ${badges.join('')}
          </div>
          <div style="font-size:12px;font-weight:700;color:var(--tx);overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${p.nama}">${p.nama.substring(0,60)}</div>
          ${subtitle ? `<div style="font-size:10px;color:var(--tx2);margin-top:2px">${subtitle}</div>` : ''}
          <div class="prod-name-full" style="font-size:9px;color:var(--tx3);margin-top:1px">${p.nama}</div>
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px">
          <div class="sb-w" style="width:70px"><div class="sb-b"><div class="sf" style="width:${Math.min(100,p.benchScore||0)}%;background:${p.klasifikasi==='WINNING'?'var(--gr)':p.klasifikasi==='POTENTIAL'?'var(--bl)':p.klasifikasi==='DROP'?'var(--rd)':'var(--am)'}"></div></div><div class="sn" title="${p.scoreMode==='topsis'?'TOPSIS: '+(p.topsisScore||0).toFixed(3):''}">${p.benchScore||0}</div></div>
          <div style="font-size:9px;color:var(--am);font-family:var(--fm)">${p.slotRek}</div>
        </div>
      </div>
      <div class="prod-stats">
        <div class="pstat">Upload <span>${p.nVideo||0}×</span></div>
        <div class="pstat">Spread <span>${p.spreadDays||0}hr</span></div>
        <div class="pstat">MaxViews <span>${fmt(p.maxViews||0)}</span></div>
        ${p.totalItemsSold>0?`<div class="pstat" title="Total raw sold (Effective weighted sold)">Sold <span style="color:var(--gr)">${p.totalItemsSold} (${(p.effectiveSold||0).toFixed(1)})</span></div>`:''}
        ${p.totalGMV>0?`<div class="pstat">GMV <span style="color:var(--pu)">Rp${fmt(p.totalGMV)}</span></div>`:''}
        <div class="pstat" title="Sales Consistency: Persentase video pecah telur">CS <span style="color:#6EE7B7">${((p.salesConsistency||0)*100).toFixed(0)}%</span></div>
        <div class="pstat" title="Conversion Efficiency: Penjualan per 10.000 views">CE <span style="color:#93C5FD">${(p.conversionEfficiency||0).toFixed(1)}/10k v</span></div>
        
        ${p.totalItemsSold>0?`
          <div class="pstat" title="Jumlah periode import dengan penjualan">P.Sold <span style="color:var(--bl)">${p.periodsWithSale||0}</span></div>
          <div class="pstat" title="Kapan terakhir ada penjualan">Last Sale <span style="color:#C084FC">${p.daysSinceLastSale === 999 ? '—' : p.daysSinceLastSale.toFixed(0) + ' hr lalu'}</span></div>
        `:''}
        
        <div class="pstat" title="Kapan terakhir upload konten">Last Upload <span>${p.daysSinceLastContent === 999 ? '—' : p.daysSinceLastContent.toFixed(0) + ' hr lalu'}</span></div>
        
        ${p.scoreMode==='topsis'?`
          <div class="pstat" title="Momentum penjualan antar-periode (Terbaru vs Sebelumnya)">Momentum <span style="color:${p.momentumMult >= 1.2 ? 'var(--gr)' : p.momentumMult > 1.0 ? '#6EE7B7' : p.momentumMult === 1.0 ? 'var(--tx2)' : p.momentumMult >= 0.6 ? 'var(--am)' : 'var(--rd)'};font-weight:bold">${p.momentumMult >= 1.2 ? '↑' : p.momentumMult > 1.0 ? '↗' : p.momentumMult === 1.0 ? '→' : p.momentumMult >= 0.6 ? '↘' : '↓'} (${(p.momentumMult||1.0).toFixed(2)})</span></div>
        `:''}
        
        ${p.bestDays && p.bestDays.length?`<div class="pstat" title="Hari Upload Terbaik">Hari <span style="color:var(--ac2)">${p.bestDays.join(',')}</span></div>`:''}
        ${p.bestHours && p.bestHours.length?`<div class="pstat" title="Jam Upload Terbaik">Jam <span style="color:var(--ac2)">${p.bestHours.join(',')}</span></div>`:''}
        ${p.harga?`<div class="pstat">Harga <span>Rp${fmt(p.harga)}</span></div>`:''}
        ${p.komisi?`<div class="pstat">Komisi <span>Rp${fmt(p.komisi)}/unit</span></div>`:''}
        ${p.labelPrestasi&&p.labelPrestasi!=='-'?`<div class="pstat">Label <span>${p.labelPrestasi}</span></div>`:''}
      </div>
      <div class="prod-desc-list">
        ${(p.descVariants||[]).map((d,vi)=>`
          <div class="desc-item var${vi+1}">
            <div class="desc-item-lbl">Variasi ${vi+1}</div>
            <div>${d}</div>
            <div class="desc-acts">
              <button class="btn btn-g btn-xs" onclick="editDesc(${S.products.indexOf(p)},${vi})">✎ Edit</button>
              <button class="btn btn-d btn-xs" onclick="delDesc(${S.products.indexOf(p)},${vi})">✕</button>
            </div>
          </div>`).join('')}
        ${(p.descVariants||[]).length<3?`
          <button class="btn btn-am btn-xs" style="align-self:start;margin-top:3px" onclick="openGenDesc(${S.products.indexOf(p)})">
            ✦ Generate Isi Konten (AI) ${(p.descVariants||[]).length>0?'+ Variasi':''}
          </button>`:''}
      </div>
      <div style="display:flex;gap:4px;margin-top:8px">
        <button class="btn btn-g btn-xs" onclick="editProd(${S.products.indexOf(p)})">✎ Edit</button>
        ${status === 'aktif'
          ? `<button class="btn btn-am btn-xs" onclick="setStatusProd(${S.products.indexOf(p)}, 'jeda')">⏸ Jeda</button>
             <button class="btn btn-d btn-xs" onclick="setStatusProd(${S.products.indexOf(p)}, 'habis')">✕ Habis</button>`
          : `<button class="btn btn-s btn-xs" onclick="setStatusProd(${S.products.indexOf(p)}, 'aktif')">✓ Aktifkan</button>`
        }
        <button class="btn btn-d btn-xs" onclick="delProd(${S.products.indexOf(p)})">✕ Hapus</button>
      </div>
    </div>`;
  }).join('');
}

function setStatusProd(pi, newStatus) {
  const p = S.products[pi];
  if (!p) return;
  p.status = newStatus;
  p.stokHabis = (newStatus === 'habis'); // Legacy compatibility
  save();
  refreshScores();
  renderProduk();
  const statusLabels = { aktif: 'Aktif', jeda: 'Dijeda', habis: 'Stok Habis' };
  toast(p.nama.substring(0, 20) + ' diset ke ' + statusLabels[newStatus]);
}

function delProd(i){if(confirm('Hapus?')){S.products.splice(i,1);refreshScores();renderProduk();toast('Dihapus');}}
function openAddProd(){
  renderCatOptions('add-cat', 'Umum');
  openModal('modal-add');
}

// Generate desc modal
let genDescTarget=-1;
function openGenDesc(pi){
  genDescTarget=pi;
  const p=S.products[pi];
  const existing=(p.descVariants||[]).length;
  const need=3-existing;
  const modal=document.createElement('div');
  modal.className='overlay open';modal.id='modal-gendesc';
  modal.innerHTML=`<div class="modal">
    <div class="modal-t">✦ Generate Isi Konten — ${p.jenis||p.nama.substring(0,25)}</div>
    <div class="al al-i gap-sm" style="font-size:10px">AI akan generate <strong>${need} variasi</strong> isi konten. Tiap variasi berisi deskripsi/penjelasan produk yang bisa dipakai di bagian tengah script.</div>
    <div class="fg"><label class="fl">Deskripsi / Arahan <span style="color:var(--tx3)">(keunggulan, harga, angle, persona)</span></label>
      <textarea class="fi" id="gd-desc" placeholder="ex: Bahan corduroy tebal, model baggy unisex, harga 130rb, sudah 10k+ terjual, cocok casual dan semi-formal. Variasi: fokus ke bahan, fokus ke gaya, fokus ke harga." style="min-height:80px">${p.harga?'Harga Rp'+fmt(p.harga)+'. ':''} ${p.komisi?'Komisi Rp'+fmt(p.komisi)+'/unit. ':''}${p.labelPrestasi&&p.labelPrestasi!=='-'?p.labelPrestasi+'. ':''}</textarea>
    </div>
    <div style="display:flex;gap:6px;justify-content:flex-end">
      <button class="btn btn-g" onclick="document.getElementById('modal-gendesc').remove()">Batal</button>
      <button class="btn btn-am" id="gd-btn" onclick="doGenDesc()">✦ Generate (AI)</button>
    </div>
    <div id="gd-status" style="margin-top:8px"></div>
  </div>`;
  document.body.appendChild(modal);
  modal.addEventListener('click',e=>{if(e.target===modal)modal.remove();});
}

async function doGenDesc(){
  const p=S.products[genDescTarget];if(!p)return;
  const desc=document.getElementById('gd-desc').value.trim();
  const existing=(p.descVariants||[]).length;
  const need=3-existing;
  const btn=document.getElementById('gd-btn');
  btn.disabled=true;btn.innerHTML='<span class="ai-spin"></span> Generating...';
  document.getElementById('gd-status').innerHTML='<div class="al al-i" style="font-size:10px">Menghubungi AI...</div>';

  const prompt=`Kamu adalah asisten untuk affiliator TikTok Shop. Buat ${need} variasi isi konten video singkat (bagian tengah script, bukan hook dan bukan CTA) untuk produk berikut:

Produk: ${p.jenis||p.nama}
Nama lengkap: ${p.nama}
Kategori: ${p.kategori||'umum'}
Keterangan: ${desc||'Produk berkualitas dengan harga terjangkau'}

Ketentuan:
- Tiap variasi 2-3 kalimat saja, untuk durasi 10-20 detik
- Gaya bahasa natural, conversational, tidak kaku
- TIDAK overclaim (hindari kata "terbaik", "paling", "sempurna", "luar biasa")
- Fokus pada manfaat nyata dan pengalaman pengguna
- Variasikan angle: misal var1 fokus ke fungsi, var2 ke gaya/tampilan, var3 ke value/harga
- Format output HANYA JSON array of strings, contoh: ["variasi1","variasi2","variasi3"]
- Tidak ada teks lain di luar JSON`;

  try{
    const raw = await callGemini(prompt, 1000);
    const vars = JSON.parse(raw);
    if(!p.descVariants)p.descVariants=[];
    vars.slice(0,need).forEach(v=>p.descVariants.push(v));
    save();refreshScores();renderProduk();
    document.getElementById('modal-gendesc')?.remove();
    toast('✅ '+vars.length+' variasi isi konten disimpan');
  }catch(err){
    document.getElementById('gd-status').innerHTML=`<div class="al al-d" style="font-size:10px">Gagal: ${err.message}. Pastikan API key aktif.</div>`;
    btn.disabled=false;btn.innerHTML='✦ Coba Lagi';
  }
}

function editDesc(pi,vi){
  const p=S.products[pi];
  const newVal=prompt('Edit variasi isi konten:',p.descVariants[vi]);
  if(newVal!==null){p.descVariants[vi]=newVal;save();renderProduk();}
}
function delDesc(pi,vi){S.products[pi].descVariants.splice(vi,1);save();renderProduk();toast('Variasi dihapus');}

function editProd(pi){
  const p=S.products[pi];
  document.getElementById('add-nama').value=p.nama;
  document.getElementById('add-jenis').value=p.jenis||'';
  document.getElementById('add-h').value=p.harga||'';
  document.getElementById('add-k').value=p.komisi||'';
  renderCatOptions('add-cat', p.kategori || 'Umum');
  document.getElementById('add-g').value=p.gmvAktif?'1':'0';
  document.getElementById('add-stok').value=p.status||'aktif';
  document.getElementById('add-l').value=p.labelPrestasi||'-';
  document.getElementById('add-brand').value=p.brand||'';
  document.getElementById('modal-add').dataset.editIdx=pi;
  openModal('modal-add');
}

// ============================================================
// QUICK ADD / SAVE PRODUCT
// ============================================================
function quickAddProd(){
  const n=document.getElementById('qp-nama').value.trim();if(!n){toast('Nama wajib');return;}
  const statusVal = document.getElementById('qp-stok')?.value || 'aktif';
  const brandVal = document.getElementById('qp-brand')?.value.trim() || '';
  S.products.push({id:'p'+Date.now(),nama:n,brand:brandVal,jenis:document.getElementById('qp-jenis').value.trim()||'',harga:parseInt(document.getElementById('qp-h').value)||0,komisi:parseInt(document.getElementById('qp-k').value)||0,kategori:document.getElementById('qp-cat').value,labelPrestasi:document.getElementById('qp-l').value||'-',gmvAktif:document.getElementById('qp-g').value==='1',status:statusVal,stokHabis:(statusVal==='habis'),descVariants:[],nVideo:0,spreadDays:0,maxViews:0,avgViews:0,totalItemsSold:0,totalGMV:0,conversionRate:0,avgCTR:0,avgCTOR:0,uploadDates:[],score:0,klasifikasi:'MONITOR',slotRek:'08:00/12:00'});
  refreshScores();save();toast('Produk ditambahkan');
  ['qp-nama','qp-jenis','qp-brand','qp-h','qp-k','qp-l'].forEach(id=>document.getElementById(id).value='');
  if(document.getElementById('qp-stok')) document.getElementById('qp-stok').value='aktif';
}

function saveNewProd(){
  const n=document.getElementById('add-nama').value.trim();if(!n){toast('Nama wajib');return;}
  const editIdx=document.getElementById('modal-add').dataset.editIdx;
  const statusVal = document.getElementById('add-stok')?.value || 'aktif';
  const brandVal = document.getElementById('add-brand')?.value.trim() || '';
  const prodData={nama:n,brand:brandVal,jenis:document.getElementById('add-jenis').value.trim()||'',harga:parseInt(document.getElementById('add-h').value)||0,komisi:parseInt(document.getElementById('add-k').value)||0,kategori:document.getElementById('add-cat').value,labelPrestasi:document.getElementById('add-l').value||'-',gmvAktif:document.getElementById('add-g').value==='1',status:statusVal,stokHabis:(statusVal==='habis')};
  if(editIdx!==undefined&&editIdx!==''){
    Object.assign(S.products[parseInt(editIdx)],prodData);
    delete document.getElementById('modal-add').dataset.editIdx;
  }else{
    S.products.push({id:'p'+Date.now(),...prodData,descVariants:[],nVideo:0,spreadDays:0,maxViews:0,avgViews:0,totalItemsSold:0,totalGMV:0,conversionRate:0,avgCTR:0,avgCTOR:0,uploadDates:[],score:0,klasifikasi:'MONITOR',slotRek:'08:00/12:00'});
  }
  refreshScores();save();closeModal('modal-add');renderProduk();toast('Disimpan');
  ['add-nama','add-jenis','add-brand','add-h','add-k','add-l'].forEach(id=>document.getElementById(id).value='');
  if(document.getElementById('add-stok')) document.getElementById('add-stok').value='aktif';
}

// ============================================================
// DYNAMIC CATEGORIES HELPERS
// ============================================================
function renderCatOptions(selId, selected) {
  const sel = document.getElementById(selId);
  if (!sel) return;
  let cats = S.categories || [];
  if (selected && !cats.includes(selected)) {
    cats = [...cats, selected];
  }
  sel.innerHTML = cats.map(c => `<option value="${c}" ${c === selected ? 'selected' : ''}>${c}</option>`).join('');
}

function addNewCategory() {
  const input = document.getElementById('new-cat-name');
  if (!input) return;
  const val = input.value.trim();
  if (!val) { toast('Nama kategori kosong'); return; }
  
  if (!S.categories) S.categories = [];
  if (S.categories.map(c=>c.toLowerCase()).includes(val.toLowerCase())) {
    toast('Kategori sudah ada');
    return;
  }
  
  S.categories.push(val);
  save();
  input.value = '';
  renderCatManager();
  // Update all dropdowns
  renderCatOptions('qp-cat', 'Umum');
  renderCatOptions('add-cat', 'Umum');
  if (typeof renderBankCatDropdowns === 'function') renderBankCatDropdowns();
  toast('Kategori "' + val + '" ditambahkan');
}

function removeCategory(name) {
  if (name === 'Umum') { toast('Kategori "Umum" tidak bisa dihapus'); return; }
  if (!confirm(`Hapus kategori "${name}"? Kategori produk yang memakai ini akan tetap ada, tapi disarankan disesuaikan.`)) return;
  
  S.categories = (S.categories || []).filter(c => c !== name);
  save();
  renderCatManager();
  renderCatOptions('qp-cat', 'Umum');
  renderCatOptions('add-cat', 'Umum');
  if (typeof renderBankCatDropdowns === 'function') renderBankCatDropdowns();
  toast('Kategori "' + name + '" dihapus');
}

function renderCatManager() {
  const wrap = document.getElementById('cat-list-wrap');
  if (!wrap) return;
  
  const cats = S.categories || [];
  wrap.innerHTML = cats.map(c => `
    <span class="badge bp" style="padding:4px 8px;font-size:10px;display:inline-flex;align-items:center;gap:6px">
      ${c}
      ${c !== 'Umum' ? `<span style="cursor:pointer;color:var(--rd);font-weight:bold" onclick="removeCategory('${c}')">✕</span>` : ''}
    </span>
  `).join('');
}

// ============================================================
// SEARCH MASTER PRODUK
// ============================================================
function filterMaster() {
  const q = document.getElementById('search-master').value.toLowerCase();
  const statusFilter = document.getElementById('filter-status-master')?.value || 'all';
  
  document.querySelectorAll('#page-produk .prod-card').forEach(card => {
    const text = card.textContent.toLowerCase();
    const prodStatus = card.dataset.prodstatus || 'aktif';
    
    const matchSearch = text.includes(q);
    const matchStatus = (statusFilter === 'all' || prodStatus === statusFilter);
    
    card.style.display = (matchSearch && matchStatus) ? '' : 'none';
  });
}
