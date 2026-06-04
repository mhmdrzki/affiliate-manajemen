/*
Tujuan: Modul Jadwal Konten (Render, Quota-Based Round-Robin Generator, Pengacak Hook/Proof/CTA per Kategori, Riwayat, Unduh CSV/TXT)
Caller: 04-nav.js, 08-views.js (Init), UI Events
Dependensi: S (02-state); PATS, PRIME_SLOTS, MID_SLOTS, bH (03-scoring); fmt (05-dashboard); openModal, closeModal (04-nav); toast (02-state)
Main Functions: genSched, allocateQuotas, roundRobinPick, buildSlotScript, renderSchedOutput, loadSchedHistory, deleteSchedHistory, downloadScheduleCSV, downloadScheduleTXT, renderSchedHistory
Side Effects: LocalStorage write (via save()), File Download I/O
*/

// ============================================================
// JADWAL
// ============================================================
function renderSchedAvail(){
  const ps=S.products.filter(p=>p.klasifikasi!=='DROP');
  document.getElementById('avail-ct').textContent=ps.length;
  document.getElementById('avail-list').innerHTML=ps.length?ps.map(p=>`
    <div style="display:flex;align-items:center;gap:6px;padding:5px 0;border-bottom:1px solid var(--bd)">
      ${bH(p.klasifikasi)}
      <div style="flex:1;min-width:0">
        <div style="font-size:10.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${p.nama.substring(0,45)}</div>
        <div style="font-size:8.5px;color:var(--tx3);font-family:var(--fm)">${p.jenis||'—'}</div>
        <div style="font-size:9px;color:var(--tx3)">${p.scoreMode==='topsis'?'TOPSIS: '+(p.topsisScore||0).toFixed(2):'Score: '+(p.benchScore||0)} · ${p.slotRek}</div>
      </div>
    </div>`).join(''):`<div class="empty" style="padding:14px"><div class="empty-t">Belum ada produk</div></div>`;
  document.getElementById('sd-date').value=new Date().toISOString().split('T')[0];
  renderSchedHistory();
}

function getFilteredPool(pool, kategori) {
  const cat = (kategori || 'Umum').toLowerCase();
  let filtered = pool.filter(item => {
    const c = (item.kategori || 'Umum').toLowerCase();
    return c === cat || c === 'umum' || c === '';
  });
  if (!filtered.length) filtered = pool;
  return filtered;
}
function getFilteredHooks(kategori) { return getFilteredPool(S.hooks, kategori); }
function getFilteredProofs(kategori) { return getFilteredPool(S.proofs, kategori); }
function getFilteredCTAs(kategori) { return getFilteredPool(S.ctas, kategori); }

function getRandHook(kategori){
  const pool = getFilteredHooks(kategori);
  return pool[Math.floor(Math.random()*pool.length)]?.txt || DEF_HOOKS[0].txt;
}
function getRandProof(kategori){
  const pool = getFilteredProofs(kategori);
  return pool[Math.floor(Math.random()*pool.length)]?.txt || DEF_PROOFS[0].txt;
}
function getRandCTA(kategori){
  const pool = getFilteredCTAs(kategori);
  return pool[Math.floor(Math.random()*pool.length)]?.txt || DEF_CTAS[0].txt;
}

function buildSlotScript(prod,hIdx,pfIdx,ctaIdx,descIdx){
  if(!prod) return '<span class="sn">Pilih produk untuk script.</span>';
  const cat = prod.kategori || 'Umum';
  const fHooks = getFilteredHooks(cat);
  const fProofs = getFilteredProofs(cat);
  const fCTAs = getFilteredCTAs(cat);
  const hook=(fHooks[hIdx] || fHooks[0])?.txt.replace('[PRODUK]',(prod.jenis||prod.nama.split(' ').slice(0,3).join(' ')))||getRandHook(cat);
  const proof=(fProofs[pfIdx] || fProofs[0])?.txt||getRandProof(cat);
  const cta=(fCTAs[ctaIdx] || fCTAs[0])?.txt||getRandCTA(cat);
  const desc=(prod.descVariants||[])[descIdx]||`[Belum ada isi konten. Buka Master Produk → ${prod.jenis||'produk ini'} → Generate Isi Konten]`;
  return `<span class="sh">[HOOK]</span>\n${hook}\n\n<span class="sh">[ISI]</span>\n${desc}\n\n<span class="sh">[PROOF]</span>\n${proof}\n\n<span class="sh">[CTA]</span>\n${cta}`;
}

/**
 * Hitung kuota slot per tier berdasarkan total slot dan porsi winning.
 * Returns: { win: N, pot: N, test: N }
 */
function allocateQuotas(totalSlots, winPct) {
  const winSlots = Math.max(1, Math.round(totalSlots * winPct / 100));
  const remaining = totalSlots - winSlots;
  const potSlots = Math.max(0, Math.round(remaining * 0.5));
  const testSlots = Math.max(0, remaining - potSlots);
  return { win: winSlots, pot: potSlots, test: testSlots };
}

/**
 * Round-robin pick dari pool produk.
 * dayIdx: index hari (0-based) untuk rotasi offset.
 * cursor: objek { idx: N } untuk melacak posisi round-robin dalam pool.
 * cooldownMap: objek { prodId: lastSlotIdx } untuk anti-spam.
 * slotIdx: index slot saat ini dalam hari.
 * Returns: produk atau null.
 */
function roundRobinPick(pool, cursor, cooldownMap, slotIdx, cbCooldown) {
  if (!pool.length) return null;
  const startIdx = cursor.idx;
  for (let attempt = 0; attempt < pool.length; attempt++) {
    const idx = (startIdx + attempt) % pool.length;
    const p = pool[idx];
    if (cbCooldown) {
      const lastIdx = cooldownMap[p.id];
      if (lastIdx !== undefined && (slotIdx - lastIdx) < 2) continue;
    }
    cursor.idx = (idx + 1) % pool.length;
    cooldownMap[p.id] = slotIdx;
    return p;
  }
  // Semua kena cooldown, ambil yang pertama tersedia
  const p = pool[cursor.idx % pool.length];
  cursor.idx = (cursor.idx + 1) % pool.length;
  cooldownMap[p.id] = slotIdx;
  return p;
}

let schedData=[];
function genSched(){
  const start=document.getElementById('sd-date').value;
  const range=parseInt(document.getElementById('sd-range').value);
  const pat=document.getElementById('sd-pat').value;
  const winPct=parseInt(document.getElementById('sd-win-pct')?.value || '40');
  
  const cbDynJam = document.getElementById('cb-dyn-jam')?.checked ?? false;
  const cbCooldown = document.getElementById('cb-cooldown')?.checked ?? false;
  
  if(!start){toast('Pilih tanggal');return;}

  computeDynamicSlots(cbDynJam);

  const slots=PATS[pat]||PATS['6'];
  const winning=S.products.filter(p=>p.klasifikasi==='WINNING'&&p.status==='aktif').sort((a,b)=>(b.benchScore||0)-(a.benchScore||0));
  const potential=S.products.filter(p=>p.klasifikasi==='POTENTIAL'&&p.status==='aktif').sort((a,b)=>(b.benchScore||0)-(a.benchScore||0));
  const testing=S.products.filter(p=>(p.klasifikasi==='UJI COBA'||p.klasifikasi==='MONITOR')&&p.status==='aktif').sort((a,b)=>(b.benchScore||0)-(a.benchScore||0));
  const active=S.products.filter(p=>p.klasifikasi!=='DROP'&&p.status==='aktif').sort((a,b)=>(b.benchScore||0)-(a.benchScore||0));

  // Hitung kuota per tier
  const quotas = allocateQuotas(slots.length, winPct);

  // Kursor round-robin per tier, diinisialisasi secara acak agar hasil generate bervariasi tiap klik
  const winCursor = { idx: Math.floor(Math.random() * Math.max(winning.length, 1)) };
  const potCursor = { idx: Math.floor(Math.random() * Math.max(potential.length, 1)) };
  const testCursor = { idx: Math.floor(Math.random() * Math.max(testing.length, 1)) };

  schedData=[];
  for(let d=0;d<range;d++){
    const dt=new Date(start);dt.setDate(dt.getDate()+d);
    const dn=['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'][dt.getDay()];
    
    const daySlotsTimes = [...slots].sort();

    // Klasifikasi slot: jam besar (PRIME) → WINNING, sisanya → TESTING
    const primeSlots = daySlotsTimes.filter(t => PRIME_SLOTS.includes(t));
    const midSlots = daySlotsTimes.filter(t => MID_SLOTS.includes(t));
    const otherSlots = daySlotsTimes.filter(t => !PRIME_SLOTS.includes(t) && !MID_SLOTS.includes(t));
    
    // Susun urutan slot: prime dulu (diisi winning), lalu mid, lalu other
    const orderedSlots = [...primeSlots, ...midSlots, ...otherSlots];
    // Kembalikan ke urutan waktu untuk tampilan, tapi catat assignment
    const slotAssignment = new Map();
    let winCount = 0, potCount = 0;

    orderedSlots.forEach(time => {
      if (winCount < quotas.win) {
        slotAssignment.set(time, 'win');
        winCount++;
      } else if (potCount < quotas.pot) {
        slotAssignment.set(time, 'pot');
        potCount++;
      } else {
        slotAssignment.set(time, 'test');
      }
    });

    let cooldownMap = {};
    const daySlots=daySlotsTimes.map((time, si)=>{
      const assignment = slotAssignment.get(time) || 'test';
      let prod, type, typeLabel;

      if (assignment === 'win') {
        // Prioritas: Winning → Potential → Testing → fallback
        prod = roundRobinPick(winning, winCursor, cooldownMap, si, cbCooldown)
            || roundRobinPick(potential, potCursor, cooldownMap, si, cbCooldown)
            || roundRobinPick(testing, testCursor, cooldownMap, si, cbCooldown);
        type='win'; typeLabel='🟢 WINNING';
      } else if (assignment === 'pot') {
        prod = roundRobinPick(potential, potCursor, cooldownMap, si, cbCooldown)
            || roundRobinPick(winning, winCursor, cooldownMap, si, cbCooldown)
            || roundRobinPick(testing, testCursor, cooldownMap, si, cbCooldown);
        type='pot'; typeLabel='🔵 POTENTIAL';
      } else {
        prod = roundRobinPick(testing, testCursor, cooldownMap, si, cbCooldown)
            || roundRobinPick(potential, potCursor, cooldownMap, si, cbCooldown)
            || roundRobinPick(winning, winCursor, cooldownMap, si, cbCooldown);
        type='test'; typeLabel='🧪 TESTING';
      }

      if (!prod && active.length > 0) prod = active[0];
      
      const cat = prod ? (prod.kategori || 'Umum') : 'Umum';
      const fHooksLen = getFilteredHooks(cat).length || 1;
      const fProofsLen = getFilteredProofs(cat).length || 1;
      const fCTAsLen = getFilteredCTAs(cat).length || 1;

      return{time,prod,type,typeLabel,hIdx:Math.floor(Math.random()*fHooksLen),pfIdx:Math.floor(Math.random()*fProofsLen),ctaIdx:Math.floor(Math.random()*fCTAsLen),descIdx:0,sopen:false};
    });

    schedData.push({dt,dn,slots:daySlots,open:true});
  }
  
  // Save to history
  const entry = {
    id: 'sh' + Date.now(),
    label: `Jadwal ${range} hari — ` + new Date(start).toLocaleDateString('id', {day:'numeric', month:'short', year:'numeric'}),
    createdAt: new Date().toLocaleString('id'),
    range: range,
    slotPerDay: slots.length,
    winPct: winPct,
    totalSlots: schedData.reduce((acc, day) => acc + day.slots.length, 0),
    data: JSON.parse(JSON.stringify(schedData.map(day => ({
      dt: day.dt,
      dn: day.dn,
      slots: day.slots.map(s => ({
        time: s.time,
        type: s.type,
        typeLabel: s.typeLabel,
        hIdx: s.hIdx,
        pfIdx: s.pfIdx,
        ctaIdx: s.ctaIdx,
        descIdx: s.descIdx,
        prodId: s.prod ? s.prod.id : null
      }))
    }))))
  };
  if (!S.scheduleHistory) S.scheduleHistory = [];
  S.scheduleHistory.unshift(entry);
  if (S.scheduleHistory.length > 20) S.scheduleHistory.pop();

  save();
  renderSchedOutput();
  renderSchedHistory();
  toast('Jadwal '+range+' hari dibuat!');
}

function renderSchedOutput(){
  if(!schedData.length)return;
  document.getElementById('sched-out').innerHTML=schedData.map((day,di)=>`
    <div class="sday ${day.open?'open':''}">
      <div class="sday-hdr" onclick="toggleDay(${di})">
        <div class="sday-name">${day.dn}, ${day.dt.getDate()}/${day.dt.getMonth()+1}/${day.dt.getFullYear()}</div>
        <div class="sday-stat">
          <span>${day.slots.length} slot</span>
          <span>${day.slots.filter(s=>s.prod).length} produk</span>
          <span>${day.open?'▾':'▸'}</span>
        </div>
      </div>
      <div class="sday-body">
        ${day.slots.map((sl,si)=>{
          const cat = sl.prod ? (sl.prod.kategori || 'Umum') : 'Umum';
          const fHooks = getFilteredHooks(cat);
          const fProofs = getFilteredProofs(cat);
          const fCTAs = getFilteredCTAs(cat);
          return `
          <div class="srow ${sl.sopen?'sopen':''}" id="sr-${di}-${si}">
            <div class="srow-time">
              <div class="srow-tv">${sl.time}</div>
              <div class="slbl slbl-${sl.type==='win'?'prime':sl.type==='pot'?'pot':'test'}">${sl.typeLabel || sl.type}</div>
            </div>
            <div class="srow-prod">
              ${sl.prod
                ?`<div class="spn">${sl.prod.nama.substring(0,55)}</div>
                   <div class="sps">${sl.prod.jenis||'—'} · Score: ${sl.prod.benchScore} · ${(sl.prod.descVariants||[]).length} isi konten</div>`
                :`<div class="spn" style="color:var(--tx3)">— Slot kosong —</div><div class="sps">Klik Ganti untuk assign</div>`}
            </div>
            <div class="srow-acts">
              ${sl.prod?`<button class="btn btn-am btn-xs" onclick="toggleSlotScript(${di},${si})">✦ Script</button>`:''}
              <button class="btn btn-g btn-xs" onclick="openAssign(${di},${si})">⬡</button>
            </div>
          </div>
          <div class="screxp" id="se-${di}-${si}">
            <div class="screxp-hdr">
              <span style="font-size:9px;color:var(--tx3);font-family:var(--fm)">Hook:</span>
              <select class="mini-sel" onchange="updSlot(${di},${si},'hIdx',+this.value)">
                ${fHooks.map((h,hi)=>`<option value="${hi}" ${hi===sl.hIdx?'selected':''}>${h.txt.substring(0,40)}...</option>`).join('')}
              </select>
              <span style="font-size:9px;color:var(--tx3);font-family:var(--fm)">Proof:</span>
              <select class="mini-sel" onchange="updSlot(${di},${si},'pfIdx',+this.value)">
                ${fProofs.map((p,pi)=>`<option value="${pi}" ${pi===sl.pfIdx?'selected':''}>${p.txt.substring(0,35)}...</option>`).join('')}
              </select>
              <span style="font-size:9px;color:var(--tx3);font-family:var(--fm)">CTA:</span>
              <select class="mini-sel" onchange="updSlot(${di},${si},'ctaIdx',+this.value)">
                ${fCTAs.map((c,ci)=>`<option value="${ci}" ${ci===sl.ctaIdx?'selected':''}>${c.txt.substring(0,30)}...</option>`).join('')}
              </select>
              ${sl.prod&&(sl.prod.descVariants||[]).length>1?`<span style="font-size:9px;color:var(--tx3);font-family:var(--fm)">Isi:</span>
              <select class="mini-sel" onchange="updSlot(${di},${si},'descIdx',+this.value)">
                ${(sl.prod.descVariants||[]).map((d,di2)=>`<option value="${di2}" ${di2===sl.descIdx?'selected':''}>${d.substring(0,30)}...</option>`).join('')}
              </select>`:''}
              <button class="btn btn-g btn-xs" onclick="rotateSlot(${di},${si})">↻</button>
              <button class="btn btn-g btn-xs" onclick="copySlot(${di},${si})">⎘</button>
            </div>
            <div class="scr-body" id="sb-${di}-${si}">${buildSlotScript(sl.prod,sl.hIdx,sl.pfIdx,sl.ctaIdx,sl.descIdx)}</div>
          </div>
        `;}).join('')}
      </div>
    </div>`).join('');
}

function toggleDay(di){schedData[di].open=!schedData[di].open;renderSchedOutput();}
function toggleSlotScript(di,si){schedData[di].slots[si].sopen=!schedData[di].slots[si].sopen;renderSchedOutput();}
function updSlot(di,si,key,val){
  schedData[di].slots[si][key]=val;
  const el=document.getElementById(`sb-${di}-${si}`);
  const sl=schedData[di].slots[si];
  if(el)el.innerHTML=buildSlotScript(sl.prod,sl.hIdx,sl.pfIdx,sl.ctaIdx,sl.descIdx);
}
function rotateSlot(di,si){
  const sl=schedData[di].slots[si];
  const cat = sl.prod ? (sl.prod.kategori || 'Umum') : 'Umum';
  sl.hIdx=(sl.hIdx+1)%Math.max(getFilteredHooks(cat).length,1);
  sl.pfIdx=(sl.pfIdx+1)%Math.max(getFilteredProofs(cat).length,1);
  sl.ctaIdx=(sl.ctaIdx+1)%Math.max(getFilteredCTAs(cat).length,1);
  if(sl.prod&&(sl.prod.descVariants||[]).length>1) sl.descIdx=(sl.descIdx+1)%sl.prod.descVariants.length;
  renderSchedOutput();toast('Rotasi hook/proof/CTA');
}
function copySlot(di,si){
  const el=document.getElementById(`sb-${di}-${si}`);
  if(el)navigator.clipboard.writeText(el.innerText).then(()=>toast('Disalin!')).catch(()=>toast('Copy manual'));
}

let assignTarget={di:0,si:0};
function openAssign(di,si){
  assignTarget={di,si};
  const ps=S.products.filter(p=>p.klasifikasi!=='DROP');
  document.getElementById('assign-title').textContent=`Assign ke ${schedData[di].slots[si].time} — ${schedData[di].dn}`;
  const searchEl = document.getElementById('search-assign');
  if(searchEl) searchEl.value = '';
  document.getElementById('assign-list').innerHTML=ps.map(p=>`
    <div class="hk-item" style="cursor:pointer; opacity: ${p.status !== 'aktif' ? 0.6 : 1}" onclick="doAssign('${p.id}')">
      ${bH(p.klasifikasi)}
      ${p.status === 'habis' ? `<span class="badge bd-c" style="background:var(--rd);color:white;font-weight:bold;margin-right:4px">HABIS</span>` : ''}
      ${p.status === 'jeda' ? `<span class="badge bm" style="background:var(--am);color:white;font-weight:bold;margin-right:4px">JEDA</span>` : ''}
      <div class="hk-txt"><div style="font-weight:600;font-size:11.5px">${p.nama.substring(0,45)}</div><div style="font-size:9.5px;color:var(--tx3)">${p.jenis||'—'} · Score: ${p.benchScore} · komisi Rp${fmt(p.komisi||0)}</div></div>
    </div>`).join('')+`<div class="hk-item" style="cursor:pointer" onclick="doAssignEmpty()"><div class="hk-txt" style="color:var(--tx3)">— Kosongkan slot —</div></div>`;
  openModal('modal-assign');
}
function doAssign(pid){
  const p=S.products.find(pr=>pr.id==pid);
  if(p){
    const sl = schedData[assignTarget.di].slots[assignTarget.si];
    sl.prod=p;
    const cat = p.kategori || 'Umum';
    sl.hIdx = Math.floor(Math.random() * Math.max(getFilteredHooks(cat).length, 1));
    sl.pfIdx = Math.floor(Math.random() * Math.max(getFilteredProofs(cat).length, 1));
    sl.ctaIdx = Math.floor(Math.random() * Math.max(getFilteredCTAs(cat).length, 1));
    sl.descIdx = 0;
  }
  closeModal('modal-assign');renderSchedOutput();toast('Di-assign');
}
function doAssignEmpty(){schedData[assignTarget.di].slots[assignTarget.si].prod=null;closeModal('modal-assign');renderSchedOutput();}

// ============================================================
// HISTORY & DOWNLOAD HELPERS
// ============================================================
function loadSchedHistory(id) {
  const entry = S.scheduleHistory.find(h => h.id === id);
  if (!entry) { toast('Riwayat tidak ditemukan'); return; }
  
  schedData = entry.data.map(day => {
    return {
      dt: new Date(day.dt),
      dn: day.dn,
      open: true,
      slots: day.slots.map(s => {
        const prod = S.products.find(p => p.id === s.prodId);
        return {
          time: s.time,
          prod: prod || null,
          type: s.type,
          typeLabel: s.typeLabel,
          hIdx: s.hIdx,
          pfIdx: s.pfIdx,
          ctaIdx: s.ctaIdx,
          descIdx: s.descIdx,
          sopen: false
        };
      })
    };
  });
  renderSchedOutput();
  toast('Jadwal loaded dari riwayat');
}

function deleteSchedHistory(id) {
  if (!confirm('Hapus entry riwayat ini?')) return;
  if (!S.scheduleHistory) { S.scheduleHistory = []; save(); renderSchedHistory(); return; }
  const before = S.scheduleHistory.length;
  S.scheduleHistory = S.scheduleHistory.filter(h => h.id !== id);
  save();
  renderSchedHistory();
  toast(S.scheduleHistory.length < before ? 'Riwayat dihapus' : 'Entry tidak ditemukan');
}

function downloadScheduleCSV(id) {
  const entry = S.scheduleHistory.find(h => h.id === id);
  if (!entry) return;
  
  let csvContent = '\uFEFF';
  csvContent += 'Tanggal,Hari,Jam,Produk,Klasifikasi,Hook,Isi Konten,Proof,CTA\n';
  
  entry.data.forEach(day => {
    const dtStr = new Date(day.dt).toLocaleDateString('id');
    day.slots.forEach(s => {
      const prod = S.products.find(p => p.id === s.prodId);
      const pName = prod ? prod.nama : '—';
      const pKlas = prod ? prod.klasifikasi : '—';
      
      let hook = '—', proof = '—', cta = '—', desc = '—';
      if (prod) {
        const cat = prod.kategori || 'Umum';
        const fHooks = getFilteredHooks(cat);
        const fProofs = getFilteredProofs(cat);
        const fCTAs = getFilteredCTAs(cat);
        hook = (fHooks[s.hIdx] || fHooks[0])?.txt.replace('[PRODUK]', (prod.jenis||prod.nama.split(' ').slice(0,3).join(' '))) || '';
        proof = (fProofs[s.pfIdx] || fProofs[0])?.txt || '';
        cta = (fCTAs[s.ctaIdx] || fCTAs[0])?.txt || '';
        desc = (prod.descVariants||[])[s.descIdx] || '';
      }
      
      const escape = (txt) => '"' + String(txt || '').replace(/"/g, '""') + '"';
      csvContent += `${escape(dtStr)},${escape(day.dn)},${escape(s.time)},${escape(pName)},${escape(pKlas)},${escape(hook)},${escape(desc)},${escape(proof)},${escape(cta)}\n`;
    });
  });
  
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `Jadwal_${entry.label.replace(/\s+/g, '_')}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function downloadScheduleTXT(id) {
  const entry = S.scheduleHistory.find(h => h.id === id);
  if (!entry) return;
  
  let txtContent = `=== JADWAL KONTEN SCRIPT ===\n`;
  txtContent += `Label: ${entry.label}\n`;
  txtContent += `Dibuat pada: ${entry.createdAt}\n`;
  txtContent += `Total Slot: ${entry.totalSlots}\n\n`;
  
  entry.data.forEach(day => {
    const dtStr = new Date(day.dt).toLocaleDateString('id', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    txtContent += `==================================================\n`;
    txtContent += `${dtStr.toUpperCase()}\n`;
    txtContent += `==================================================\n\n`;
    
    day.slots.forEach(s => {
      const prod = S.products.find(p => p.id === s.prodId);
      txtContent += `[${s.time}] - ${s.typeLabel || s.type}\n`;
      if (prod) {
        txtContent += `Produk: ${prod.nama}\n`;
        txtContent += `Klasifikasi: ${prod.klasifikasi} (Score: ${prod.benchScore})\n`;
        
        const cat = prod.kategori || 'Umum';
        const fHooks = getFilteredHooks(cat);
        const fProofs = getFilteredProofs(cat);
        const fCTAs = getFilteredCTAs(cat);
        const hook = (fHooks[s.hIdx] || fHooks[0])?.txt.replace('[PRODUK]', (prod.jenis||prod.nama.split(' ').slice(0,3).join(' '))) || '';
        const proof = (fProofs[s.pfIdx] || fProofs[0])?.txt || '';
        const cta = (fCTAs[s.ctaIdx] || fCTAs[0])?.txt || '';
        const desc = (prod.descVariants||[])[s.descIdx] || '[Belum ada isi konten]';
        
        txtContent += `\n[HOOK]\n${hook}\n`;
        txtContent += `\n[ISI]\n${desc}\n`;
        txtContent += `\n[PROOF]\n${proof}\n`;
        txtContent += `\n[CTA]\n${cta}\n`;
      } else {
        txtContent += `— Slot Kosong —\n`;
      }
      txtContent += `--------------------------------------------------\n\n`;
    });
  });
  
  const blob = new Blob([txtContent], { type: 'text/plain;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `Jadwal_${entry.label.replace(/\s+/g, '_')}.txt`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function renderSchedHistory() {
  const wrap = document.getElementById('sched-history-list');
  if (!wrap) return;
  
  const hist = S.scheduleHistory || [];
  wrap.innerHTML = hist.length ? hist.map(h => `
    <div class="sh-entry" data-shid="${h.id}" style="padding:10px; background:var(--bg2); border:1px solid var(--bd); border-radius:var(--r2); margin-bottom:8px; display:flex; flex-direction:column; gap:6px">
      <div style="display:flex; justify-content:space-between; align-items:center">
        <div style="font-weight:600; font-size:11.5px; color:var(--tx)">${h.label}</div>
        <div style="font-size:9.5px; color:var(--tx3); margin-left:auto">${h.createdAt}</div>
      </div>
      <div style="font-size:10px; color:var(--tx2)">
        Rentang: <strong>${h.range} hari</strong> · ${h.totalSlots} slot total (${h.slotPerDay} slot/hari)
      </div>
      <div style="display:flex; gap:4px; margin-top:2px">
        <button class="btn btn-p btn-xs sh-act-load">Load</button>
        <button class="btn btn-g btn-xs sh-act-csv">⬇ CSV</button>
        <button class="btn btn-g btn-xs sh-act-txt">⬇ TXT</button>
        <button class="btn btn-d btn-xs sh-act-del" style="margin-left:auto">✕ Hapus</button>
      </div>
    </div>
  `).join('') : `<div style="font-size:10.5px; color:var(--tx3); text-align:center; padding:16px 0">Belum ada riwayat jadwal.</div>`;

  // Single event delegation — aman dari masalah escaping
  wrap.onclick = function(e) {
    const entry = e.target.closest('.sh-entry');
    if (!entry) return;
    const id = entry.dataset.shid;
    if (e.target.closest('.sh-act-load')) loadSchedHistory(id);
    if (e.target.closest('.sh-act-csv'))  downloadScheduleCSV(id);
    if (e.target.closest('.sh-act-txt'))  downloadScheduleTXT(id);
    if (e.target.closest('.sh-act-del'))  deleteSchedHistory(id);
  };
}

// ============================================================
// SEARCH ASSIGN PRODUK
// ============================================================
function filterAssign() {
  const q = document.getElementById('search-assign').value.toLowerCase();
  document.querySelectorAll('#assign-list .hk-item').forEach(item => {
    const text = item.textContent.toLowerCase();
    item.style.display = text.includes(q) ? '' : 'none';
  });
}
