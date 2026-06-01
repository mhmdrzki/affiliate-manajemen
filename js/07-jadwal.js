/*
Tujuan: Modul Jadwal Konten (Render, Generator, Pengacak Hook/Proof/CTA)
Caller: 04-nav.js, 08-views.js (Init), UI Events
Dependensi: S (02-state); PATS, PRIME_SLOTS, MID_SLOTS, bH (03-scoring); fmt (05-dashboard); openModal, closeModal (04-nav); toast (02-state)
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
}

function getRandHook(){return S.hooks[Math.floor(Math.random()*Math.max(S.hooks.length,1))]?.txt||DEF_HOOKS[0].txt;}
function getRandProof(){return S.proofs[Math.floor(Math.random()*Math.max(S.proofs.length,1))]?.txt||DEF_PROOFS[0].txt;}
function getRandCTA(){return S.ctas[Math.floor(Math.random()*Math.max(S.ctas.length,1))]?.txt||DEF_CTAS[0].txt;}

function buildSlotScript(prod,hIdx,pfIdx,ctaIdx,descIdx){
  if(!prod) return '<span class="sn">Pilih produk untuk script.</span>';
  const hook=S.hooks[hIdx]?.txt.replace('[PRODUK]',(prod.jenis||prod.nama.split(' ').slice(0,3).join(' ')))||getRandHook();
  const proof=S.proofs[pfIdx]?.txt||getRandProof();
  const cta=S.ctas[ctaIdx]?.txt||getRandCTA();
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

  function pickWithCooldown(chains, cooldownMap, slotIdx) {
    for (const poolW of chains) {
      if (!poolW.length) continue;
      let validPool = poolW;
      if (cbCooldown) {
        validPool = poolW.filter(item => {
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
        prod=pickWithCooldown([winW, potW, ujiW, monW], cooldownMap, si);
        type='prime'; typeLabel=`PRIME (${currentSlotSource})`;
      } else if(MID_SLOTS.includes(time)){
        prod=pickWithCooldown([potW, winW, ujiW, monW], cooldownMap, si);
        type='pot'; typeLabel=`POTENSIAL (${currentSlotSource})`;
      } else {
        prod=pickWithCooldown([ujiW, monW, potW, winW], cooldownMap, si);
        type='test'; typeLabel=`TEST (${currentSlotSource})`;
      }
      return{time,prod,type,typeLabel,hIdx:Math.floor(Math.random()*Math.max(S.hooks.length,1)),pfIdx:Math.floor(Math.random()*Math.max(S.proofs.length,1)),ctaIdx:Math.floor(Math.random()*Math.max(S.ctas.length,1)),descIdx:0,sopen:false};
    });
    
    let volDiff = daySlotsTimes.length - slots.length;
    let volLabel = volDiff > 0 ? `📈 +${volDiff} slot (Panen Trafik)` : volDiff < 0 ? `📉 ${volDiff} slot (Hemat Trafik)` : '';

    schedData.push({dt,dn,slots:daySlots,open:true,volLabel,multiplier});
  }
  renderSchedOutput();
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
        ${day.slots.map((sl,si)=>`
          <div class="srow ${sl.sopen?'sopen':''}" id="sr-${di}-${si}">
            <div class="srow-time">
              <div class="srow-tv">${sl.time}</div>
              <div class="slbl slbl-${sl.type==='prime'?'prime':sl.type==='pot'?'pot':'test'}">${sl.typeLabel || sl.type}</div>
            </div>
            <div class="srow-prod">
              ${sl.prod
                ?`<div class="spn">${sl.prod.nama.substring(0,55)}</div>
                   <div class="sps">${sl.prod.jenis||'—'} · Score: ${sl.prod.score} · ${(sl.prod.descVariants||[]).length} isi konten</div>`
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
                ${S.hooks.map((h,hi)=>`<option value="${hi}" ${hi===sl.hIdx?'selected':''}>${h.txt.substring(0,40)}...</option>`).join('')}
              </select>
              <span style="font-size:9px;color:var(--tx3);font-family:var(--fm)">Proof:</span>
              <select class="mini-sel" onchange="updSlot(${di},${si},'pfIdx',+this.value)">
                ${S.proofs.map((p,pi)=>`<option value="${pi}" ${pi===sl.pfIdx?'selected':''}>${p.txt.substring(0,35)}...</option>`).join('')}
              </select>
              <span style="font-size:9px;color:var(--tx3);font-family:var(--fm)">CTA:</span>
              <select class="mini-sel" onchange="updSlot(${di},${si},'ctaIdx',+this.value)">
                ${S.ctas.map((c,ci)=>`<option value="${ci}" ${ci===sl.ctaIdx?'selected':''}>${c.txt.substring(0,30)}...</option>`).join('')}
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
        `).join('')}
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
  sl.hIdx=(sl.hIdx+1)%Math.max(S.hooks.length,1);
  sl.pfIdx=(sl.pfIdx+1)%Math.max(S.proofs.length,1);
  sl.ctaIdx=(sl.ctaIdx+1)%Math.max(S.ctas.length,1);
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
  document.getElementById('assign-list').innerHTML=ps.map(p=>`
    <div class="hk-item" style="cursor:pointer" onclick="doAssign('${p.id}')">
      ${bH(p.klasifikasi)}
      <div class="hk-txt"><div style="font-weight:600;font-size:11.5px">${p.nama.substring(0,45)}</div><div style="font-size:9.5px;color:var(--tx3)">${p.jenis||'—'} · Score: ${p.score} · komisi Rp${fmt(p.komisi||0)}</div></div>
    </div>`).join('')+`<div class="hk-item" style="cursor:pointer" onclick="doAssignEmpty()"><div class="hk-txt" style="color:var(--tx3)">— Kosongkan slot —</div></div>`;
  openModal('modal-assign');
}
function doAssign(pid){
  const p=S.products.find(pr=>pr.id==pid);
  if(p){schedData[assignTarget.di].slots[assignTarget.si].prod=p;}
  closeModal('modal-assign');renderSchedOutput();toast('Di-assign');
}
function doAssignEmpty(){schedData[assignTarget.di].slots[assignTarget.si].prod=null;closeModal('modal-assign');renderSchedOutput();}
