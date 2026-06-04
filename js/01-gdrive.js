/*
Tujuan: Google Drive Sync Module dengan Token Expiry & Auto-Load Lintas Perangkat
Caller: index.html, 08-views.js (init)
Dependensi: toast (dari 02-state), S dan save (dari 02-state)
*/
const GD_CLIENT_ID = '486908118665-jikf3m2l1mombrbmh3mqujmergsqfigc.apps.googleusercontent.com';
const GD_SCOPE = 'https://www.googleapis.com/auth/drive.appdata';
const GD_FILE_NAME = 'affiliateos_data.json';
const GD_FILE_MIME = 'application/json';

let gdToken = null;
let gdFileId = null;
let gdSyncing = false;
let gdConnected = false;
let gdSaveTimer = null;
let gdTokenExpiry = null;
let gdExpiryTimer = null;
let gdExpiryTimerDead = null;
let gdExpiredFlag = false;

// Load token dari localStorage
try {
  const stored = JSON.parse(localStorage.getItem('affos_gd') || '{}');
  gdToken = stored.token || null;
  gdFileId = stored.fileId || null;
  gdTokenExpiry = stored.expiry || null;
  if (gdToken && gdTokenExpiry) {
    const remainingMs = gdTokenExpiry - Date.now();
    if (remainingMs > 0) {
      gdConnected = true;
      clearTimeout(gdExpiryTimer);
      clearTimeout(gdExpiryTimerDead);
      gdExpiryTimer = setTimeout(() => {
        toast('⚠️ Sesi Drive akan berakhir dalam 5 menit — backup otomatis disimpan');
        gdSaveNow();
      }, Math.max(remainingMs - 300000, 0));
      gdExpiryTimerDead = setTimeout(() => {
        gdHandleExpired();
      }, remainingMs);
    } else {
      gdToken = null; gdFileId = null; gdTokenExpiry = null;
      gdExpiredFlag = true;
      localStorage.removeItem('affos_gd');
    }
  } else if (gdToken) {
    gdConnected = true;
  }
} catch(e) {}

function gdSaveLocal() {
  try { 
    localStorage.setItem('affos_gd', JSON.stringify({
      token: gdToken, fileId: gdFileId, expiry: gdTokenExpiry
    })); 
  } catch(e) {}
}

function gdUpdateUI() {
  const dot = document.getElementById('gd-dot');
  const lbl = document.getElementById('gd-lbl');
  const btn = document.getElementById('gd-btn');
  if (!dot || !lbl || !btn) return;

  if (gdSyncing) {
    dot.className = 'gd-dot syncing';
    lbl.innerHTML = 'Menyimpan...';
    btn.textContent = '↺ Syncing';
    btn.className = 'btn-gd';
  } else if (gdConnected) {
    dot.className = 'gd-dot connected';
    lbl.innerHTML = 'Drive <em>✓ terhubung</em>';
    btn.textContent = '↓ Backup Manual';
    btn.className = 'btn-gd';
    btn.onclick = () => { gdSaveNow(); };
    // Tambah tombol disconnect
    if (!document.getElementById('gd-disc')) {
      const d = document.createElement('button');
      d.id = 'gd-disc';
      d.className = 'btn-gd danger';
      d.textContent = '✕ Disconnect';
      d.onclick = gdDisconnect;
      btn.parentNode.appendChild(d);
    }
  } else if (gdExpiredFlag) {
    dot.className = 'gd-dot expired';
    lbl.innerHTML = '⚠️ Sesi habis';
    btn.textContent = '↑ Sambungkan Ulang';
    btn.className = 'btn-gd primary';
    btn.onclick = gdConnect;
    const d = document.getElementById('gd-disc');
    if (d) d.remove();
  } else {
    dot.className = 'gd-dot';
    lbl.textContent = 'Google Drive';
    btn.textContent = '↑ Connect Drive';
    btn.className = 'btn-gd primary';
    btn.onclick = gdAction;
    const d = document.getElementById('gd-disc');
    if (d) d.remove();
  }
}

function gdAction() {
  if (gdConnected) { gdSaveNow(); return; }
  gdConnect();
}

function gdConnect() {
  if (!window.google) { toast('⚠️ Google library gagal dimuat — pastikan koneksi internet aktif'); return; }
  const client = google.accounts.oauth2.initTokenClient({
    client_id: GD_CLIENT_ID,
    scope: GD_SCOPE,
    callback: async (resp) => {
      if (resp.error) { toast('Login Google gagal: ' + resp.error); return; }
      gdToken = resp.access_token;
      gdConnected = true;
      gdExpiredFlag = false;

      const expiresIn = resp.expires_in || 3600;
      gdTokenExpiry = Date.now() + expiresIn * 1000;
      clearTimeout(gdExpiryTimer);
      clearTimeout(gdExpiryTimerDead);
      gdExpiryTimer = setTimeout(() => {
        toast('⚠️ Sesi Drive akan berakhir dalam 5 menit — backup otomatis disimpan');
        gdSaveNow();
      }, Math.max((expiresIn - 300) * 1000, 0));
      gdExpiryTimerDead = setTimeout(() => {
        gdHandleExpired();
      }, expiresIn * 1000);

      gdSaveLocal();
      gdUpdateUI();
      toast('✓ Terhubung ke Google Drive');
      // Coba load data dari Drive dulu
      await gdLoadFromDrive();
    }
  });
  client.requestAccessToken();
}

function gdDisconnect() {
  if (!confirm('Disconnect Google Drive? Data lokal tetap aman.')) return;
  gdToken = null;
  gdFileId = null;
  gdConnected = false;
  gdTokenExpiry = null;
  clearTimeout(gdExpiryTimer);
  localStorage.removeItem('affos_gd');
  gdUpdateUI();
  toast('Drive disconnected');
}

async function gdFindFile() {
  if (!gdToken) return null;
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=name='${GD_FILE_NAME}'&fields=files(id,name,modifiedTime)`,
    { headers: { Authorization: 'Bearer ' + gdToken } }
  );
  if (!res.ok) { if (res.status === 401) gdHandleExpired(); return null; }
  const data = await res.json();
  return data.files && data.files.length > 0 ? data.files[0].id : null;
}

async function gdLoadFromDrive() {
  if (!gdToken) return;
  gdSyncing = true; gdUpdateUI();
  try {
    const fid = await gdFindFile();
    if (!fid) {
      // File belum ada di Drive — upload data lokal sekarang
      gdSyncing = false; gdUpdateUI();
      await gdSaveNow();
      return;
    }
    gdFileId = fid; gdSaveLocal();
    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fid}?alt=media`,
      { headers: { Authorization: 'Bearer ' + gdToken } }
    );
    if (!res.ok) { gdSyncing = false; gdUpdateUI(); return; }
    const driveData = await res.json();
    // Merge: Validasi timestamp untuk cegah overwrite offline data
    if (driveData && driveData.products !== undefined) {
      const driveTs = driveData.lastModified || 0;
      const localTs = S.lastModified || 0;
      
      if (localTs > driveTs) {
        // Lokal lebih baru — konfirmasi user
        const useLocal = confirm(
          'Data lokal lebih baru dari Google Drive.\n' +
          'Lokal: ' + new Date(localTs).toLocaleString('id') + '\n' +
          'Drive: ' + (driveTs ? new Date(driveTs).toLocaleString('id') : 'belum ada') + '\n\n' +
          'OK = Pakai data lokal (upload ke Drive)\n' +
          'Cancel = Pakai data Drive (timpa lokal)'
        );
        if (useLocal) {
          await gdSaveNow();
          toast('✓ Data lokal diupload ke Drive');
          return;
        }
      }
      
      // Drive lebih baru atau sama atau disetujui — timpa lokal
      S = { ...JSON.parse(JSON.stringify(INIT_S)), ...driveData };
      if (!S.proofs || !S.proofs.length) S.proofs = [...DEF_PROOFS];
      localStorage.setItem('affos4', JSON.stringify(S));
      refreshScores();
      renderDash();
      toast('✓ Data dimuat dari Google Drive');
    }
  } catch(e) {
    toast('Gagal load dari Drive');
  }
  gdSyncing = false; gdUpdateUI();
}

async function gdSaveNow() {
  if (!gdToken) return;
  gdSyncing = true; gdUpdateUI();
  try {
    const body = JSON.stringify(S);
    if (!gdFileId) { gdFileId = await gdFindFile(); gdSaveLocal(); }

    if (gdFileId) {
      // Update file yang sudah ada
      await fetch(
        `https://www.googleapis.com/upload/drive/v3/files/${gdFileId}?uploadType=media`,
        { method: 'PATCH', headers: { Authorization: 'Bearer ' + gdToken, 'Content-Type': GD_FILE_MIME }, body }
      );
    } else {
      // Buat file baru di appDataFolder
      const meta = { name: GD_FILE_NAME, parents: ['appDataFolder'] };
      const form = new FormData();
      form.append('metadata', new Blob([JSON.stringify(meta)], { type: 'application/json' }));
      form.append('file', new Blob([body], { type: GD_FILE_MIME }));
      const res = await fetch(
        'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id',
        { method: 'POST', headers: { Authorization: 'Bearer ' + gdToken }, body: form }
      );
      const d = await res.json();
      gdFileId = d.id; gdSaveLocal();
    }
  } catch(e) {
    toast('Gagal simpan ke Drive');
  }
  gdSyncing = false; gdUpdateUI();
}

async function gdInitOnLoad() {
  if (!gdToken) return;
  try {
    const res = await fetch(
      'https://www.googleapis.com/drive/v3/about?fields=user',
      { headers: { Authorization: 'Bearer ' + gdToken } }
    );
    if (res.ok) {
      gdConnected = true;
      gdUpdateUI();
      await gdLoadFromDrive();
    } else if (res.status === 401) {
      gdHandleExpired();
    }
  } catch(e) {
    // Offline — gunakan data lokal
    gdUpdateUI();
  }
}

function gdHandleExpired() {
  gdToken = null; gdConnected = false; gdFileId = null;
  gdTokenExpiry = null; clearTimeout(gdExpiryTimer); clearTimeout(gdExpiryTimerDead);
  gdExpiredFlag = true;
  localStorage.removeItem('affos_gd');
  gdUpdateUI();
  toast('Sesi Drive berakhir — silakan connect ulang');
}

// Auto-sync dengan debounce 3 detik setelah save
function gdScheduleSync() {
  if (!gdConnected || !gdToken) return;
  clearTimeout(gdSaveTimer);
  gdSaveTimer = setTimeout(gdSaveNow, 3000);
}
