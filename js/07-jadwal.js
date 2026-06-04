/*
Tujuan: Modul Jadwal Konten (Render, Affinity-Based Generator, Pengacak Hook/Proof/CTA per Kategori, Riwayat, Unduh CSV/TXT)
Caller: 04-nav.js, 08-views.js (Init), UI Events
Dependensi: S (02-state); PATS, PRIME_SLOTS, MID_SLOTS, bH (03-scoring); fmt (05-dashboard); openModal, closeModal (04-nav); toast (02-state)
Main Functions: genSched, pickWithCooldown, buildSlotScript, renderSchedOutput, loadSchedHistory, deleteSchedHistory, downloadScheduleCSV, downloadScheduleTXT, renderSchedHistory
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

function computeWeights(pool) {
  return pool.map(p => {
    const score = p.benchScore || 0;
    const komisi = p.komisi || 0;
    const weight = (score / 100) * (1 + Math.log10(komisi + 1));
    return { p, weight };
  });
}

function weightedPick(poolWithWeights) {
  if (!poolWithWeights.length) return null;
  const totalW = poolWithWeights.reduce((s, x) => s + x.weight, 0);
  if (totalW <= 0) return poolWithWeights[Math.floor(Math.random() * poolWithWeights.length)].p;
  let r = Math.random() * totalW;
  for (const item of poolWithWeights) {
    r -= item.weight;
    if (r <= 0) return item.p;
  }
  return poolWithWeights[poolWithWeights.length - 1].p;
}

let schedData=[];
function genSched(){
  const start=document.getElementById('sd-date').value;
  const range=parseInt(document.getElementById('sd-range').value);
  const pat=document.getElementById('sd-pat').value;
  
  const cbDynJam = document.getElementById('cb-dyn-jam')?.checked ?? false;
  const cbDynVol = document.getElementById('cb-dyn-vol')?.checked ?? false;
  const cbCooldown = document.getElementById('cb-cooldown')?.checked ?? false;
  
  if(!start){toast('Pilih tanggal');return;}

  computeDynamicSlots(cbDynJam);

  const slots=PATS[pat]||PATS['6'];
  const winning=S.products.filter(p=>p.klasifikasi==='WINNING').sort((a,b)=>(b.benchScore||0)-(a.benchScore||0));
  const potential=S.products.filter(p=>p.klasifikasi==='POTENTIAL').sort((a,b)=>(b.benchScore||0)-(a.benchScore||0));
  const monitor=S.products.filter(p=>p.klasifikasi==='MONITOR').sort((a,b)=>(b.benchScore||0)-(a.benchScore||0));
  const ujiCoba=S.products.filter(p=>p.klasifikasi==='UJI COBA').sort((a,b)=>(b.benchScore||0)-(a.benchScore||0));
  const active=S.products.filter(p=>p.klasifikasi!=='DROP').sort((a,b)=>(b.benchScore||0)-(a.benchScore||0));

  const winW = computeWeights(winning);
  const potW = computeWeights(potential);
  const monW = computeWeights(monitor);
  const ujiW = computeWeights(ujiCoba);

  function pickWithCooldown(chains, cooldownMap, slotIdx, dName, hStr) {
    for (const poolW of chains) {
      if (!poolW.length) continue;
      
      const dynPool = poolW.map(item => {
        const p = item.p;
        let affinityBonus = 1.0;
        if (p.bestDays && p.bestDays.includes(dName)) {
          affinityBonus += 0.4;
        }
        if (p.bestHours && p.bestHours.includes(hStr)) {
          affinityBonus += 0.6;
        }
        return { p, weight: item.weight * affinityBonus };
      });

      let validPool = dynPool;
      if (cbCooldown) {
        validPool = dynPool.filter(item => {
          const lastIdx = cooldownMap[item.p.id];
          if (lastIdx === undefined) return true;
          return (slotIdx - lastIdx) >= 2;
        });
      }
      if (validPool.length > 0) {
        const picked = weightedPick(validPool);
        cooldownMap[picked.id] = slotIdx;
        return picked;
      }
    }
    if (active.length > 0) return active[0];
    return null;
  }

  schedData=[];
  for(let d=0;d<range;d++){
    const dt=new Date(start);dt.setDate(dt.getDate()+d);
    const dn=['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'][dt.getDay()];
    
    let multiplier = computeDayMultiplier(dn, cbDynVol);
    let targetSlotCount = Math.max(1, Math.round(slots.length * multiplier));
    let daySlotsTimes = [...slots];
    
    if (targetSlotCount > slots.length) {
      const allTimes = PATS['10'];
      const toAdd = allTimes.filter(t => !daySlotsTimes.includes(t));
      for(let i=0; i < (targetSlotCount - slots.length) && i < toAdd.length; i++){
        daySlotsTimes.push(toAdd[i]);
      }
    } else if (targetSlotCount < slots.length) {
      daySlotsTimes.sort((a,b) => {
        const pA = PRIME_SLOTS.includes(a) ? 3 : MID_SLOTS.includes(a) ? 2 : 1;
        const pB = PRIME_SLOTS.includes(b) ? 3 : MID_SLOTS.includes(b) ? 2 : 1;
        return pA - pB;
      });
      daySlotsTimes = daySlotsTimes.slice(slots.length - targetSlotCount);
    }
    daySlotsTimes.sort();

    let cooldownMap = {};
    const daySlots=daySlotsTimes.map((time, si)=>{
      let prod, type, typeLabel;
      if(PRIME_SLOTS.includes(time)){
        prod=pickWithCooldown([winW, potW, ujiW, monW], cooldownMap, si, dn, time);
        type='prime'; typeLabel=`PRIME (${currentSlotSource})`;
      } else if(MID_SLOTS.includes(time)){
        prod=pickWithCooldown([potW, winW, ujiW, monW], cooldownMap, si, dn, time);
        type='pot'; typeLabel=`POTENSIAL (${currentSlotSource})`;
      } else {
        prod=pickWithCooldown([ujiW, monW, potW, winW], cooldownMap, si, dn, time);
        type='test'; typeLabel=`TEST (${currentSlotSource})`;
      }
      
      const cat = prod ? (prod.kategori || 'Umum') : 'Umum';
      const fHooksLen = getFilteredHooks(cat).length || 1;
      const fProofsLen = getFilteredProofs(cat).length || 1;
      const fCTAsLen = getFilteredCTAs(cat).length || 1;

      return{time,prod,type,typeLabel,hIdx:Math.floor(Math.random()*fHooksLen),pfIdx:Math.floor(Math.random()*fProofsLen),ctaIdx:Math.floor(Math.random()*fCTAsLen),descIdx:0,sopen:false};
    });
    
    let volDiff = daySlotsTimes.length - slots.length;
    let volLabel = volDiff > 0 ? `📈 +${volDiff} slot (Panen Trafik)` : volDiff < 0 ? `📉 ${volDiff} slot (Hemat Trafik)` : '';

    schedData.push({dt,dn,slots:daySlots,open:true,volLabel,multiplier});
  }
  
  // Save to history
  const entry = {
    id: 'sh' + Date.now(),
    label: `Jadwal ${range} hari — ` + new Date(start).toLocaleDateString('id', {day:'numeric', month:'short', year:'numeric'}),
    createdAt: new Date().toLocaleString('id'),
    range: range,
    slotPerDay: slots.length,
    totalSlots: schedData.reduce((acc, day) => acc + day.slots.length, 0),
    data: JSON.parse(JSON.stringify(schedData.map(day => ({
      dt: day.dt,
      dn: day.dn,
      volLabel: day.volLabel,
      multiplier: day.multiplier,
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
          ${day.volLabel ? `<span style="color:${day.multiplier>1?'var(--gr)':'var(--tx3)'};font-weight:600">${day.volLabel}</span>` : ''}
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
              <div class="slbl slbl-${sl.type==='prime'?'prime':sl.type==='pot'?'pot':'test'}">${sl.typeLabel || sl.type}</div>
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
    <div class="hk-item" style="cursor:pointer" onclick="doAssign('${p.id}')">
      ${bH(p.klasifikasi)}
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
      volLabel: day.volLabel,
      multiplier: day.multiplier,
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
