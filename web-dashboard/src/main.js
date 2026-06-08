import './input.css';
import { io } from 'socket.io-client';

/* ═══════════════════════════════════════════════════════
   STATE
═══════════════════════════════════════════════════════ */
let logs        = [];
let stats       = { total: 0, allowed: 0, denied: 0 };
let startTime   = Date.now();
let gateTimer   = null;
let waBadgeTimer= null;
let toastTimer  = null;
let demoMode    = false;
let demoTimeout = null;
let demoCounter = 1;

const chartData = Array.from({ length: 24 }, (_, i) => ({ hour: i, allowed: 0, denied: 0 }));

/* ═══════════════════════════════════════════════════════
   SOCKET.IO  — same-origin, tidak perlu IP
═══════════════════════════════════════════════════════ */
const socket = io();   // ← otomatis connect ke server yang serve halaman ini

socket.on('connect', () => {
  setSocketStatus('connected');
  console.log('[SmartGate] Connected:', socket.id);
});

socket.on('disconnect', () => {
  setSocketStatus('disconnected');
  console.log('[SmartGate] Disconnected');
});

socket.on('connect_error', () => {
  setSocketStatus('disconnected');
});

// Data masuk dari ESP32 (via server emit)
socket.on('gate:log', (entry) => {
  if (demoMode) return;
  handleIncomingLog(entry);
});

// History saat pertama konek (server kirim sekali)
socket.on('gate:history', (arr) => {
  if (!arr?.length || logs.length > 0) return;
  arr.forEach(log => {
    logs.push(log);
    const ok = log.status === 'BERHASIL';
    stats.total++;
    if (ok) stats.allowed++; else stats.denied++;
    const h = new Date(log.created_at || Date.now()).getHours();
    if (ok) chartData[h].allowed++; else chartData[h].denied++;
  });
  renderLog(); updateStats(); renderChart();
});

/* ═══════════════════════════════════════════════════════
   SOCKET STATUS PILL
═══════════════════════════════════════════════════════ */
function setSocketStatus(state) {
  if (demoMode && state !== 'demo') return;
  const pill  = document.getElementById('socketPill');
  const dot   = document.getElementById('socketDot');
  const label = document.getElementById('socketLabel');

  pill.classList.remove('pill-connected', 'pill-connecting', 'pill-disconnected', 'pill-demo');

  const configs = {
    connected:    { cls: 'pill-connected',    dotColor: '#10B981', ping: false, text: 'Terhubung' },
    connecting:   { cls: 'pill-connecting',   dotColor: '#F59E0B', ping: true,  text: 'Menghubungkan...' },
    disconnected: { cls: 'pill-disconnected', dotColor: '#F43F5E', ping: false, text: 'Terputus' },
    demo:         { cls: 'pill-demo',         dotColor: '#F59E0B', ping: true,  text: 'Mode Demo' },
  };

  const cfg = configs[state] ?? configs.connecting;
  pill.classList.add(cfg.cls);
  dot.innerHTML = `
    ${cfg.ping ? `<span class="absolute inset-0 rounded-full animate-ping opacity-60" style="background:${cfg.dotColor}"></span>` : ''}
    <span class="relative w-2 h-2 rounded-full block" style="background:${cfg.dotColor}"></span>`;
  label.textContent = cfg.text;
}

/* ═══════════════════════════════════════════════════════
   CLOCK + UPTIME
═══════════════════════════════════════════════════════ */
setInterval(() => {
  document.getElementById('clockDisplay').textContent =
    new Date().toLocaleTimeString('id-ID', { hour12: false });

  const e  = Math.floor((Date.now() - startTime) / 1000);
  const hh = String(Math.floor(e / 3600)).padStart(2, '0');
  const mm = String(Math.floor((e % 3600) / 60)).padStart(2, '0');
  const ss = String(e % 60).padStart(2, '0');
  document.getElementById('uptimeDisplay').textContent = `${hh}:${mm}:${ss}`;
}, 1000);

/* ═══════════════════════════════════════════════════════
   CHART
═══════════════════════════════════════════════════════ */
export function renderChart() {
  const wrap = document.getElementById('chartWrap');
  const now  = new Date().getHours();
  const maxV = Math.max(...chartData.map(d => d.allowed + d.denied), 1);

  wrap.innerHTML = chartData.map((d, i) => {
    const pA     = ((d.allowed / maxV) * 120).toFixed(1);
    const pD     = ((d.denied  / maxV) * 120).toFixed(1);
    const isNow  = i === now;
    const totalH = parseFloat(pA) + parseFloat(pD);

    return `
      <div class="flex-1 flex flex-col justify-end gap-px cursor-default relative"
           title="${d.hour}:00 — ${d.allowed} berhasil, ${d.denied} gagal">
        ${d.denied  > 0 ? `<div style="height:${pD}px;background:${isNow ? '#F43F5E' : 'rgba(244,63,94,0.35)'};border-radius:3px 3px 0 0;transition:height .4s ease"></div>` : ''}
        ${d.allowed > 0 ? `<div style="height:${pA}px;background:${isNow ? '#10B981' : 'rgba(16,185,129,0.3)'};border-radius:3px 3px 0 0;transition:height .4s ease"></div>` : ''}
        ${totalH === 0  ? `<div style="height:2px;background:rgba(255,255,255,0.04);border-radius:2px"></div>` : ''}
      </div>`;
  }).join('');

  const n = new Date();
  document.getElementById('chartNow').textContent =
    String(n.getHours()).padStart(2, '0') + ':' + String(n.getMinutes()).padStart(2, '0');

  const peak = chartData.reduce((a, b) =>
    (a.allowed + a.denied) > (b.allowed + b.denied) ? a : b);
  const hoursActive = chartData.filter(d => d.allowed + d.denied > 0).length || 1;

  document.getElementById('peakHour').textContent =
    (peak.allowed + peak.denied > 0) ? `${String(peak.hour).padStart(2, '0')}:00` : '—';
  document.getElementById('avgPerHour').textContent =
    stats.total > 0 ? (stats.total / hoursActive).toFixed(1) : '—';
}

/* ═══════════════════════════════════════════════════════
   GATE STATUS
═══════════════════════════════════════════════════════ */
export function setGateStatus(open) {
  const card  = document.getElementById('gateCard');
  const ring  = document.getElementById('gateRing');
  const inner = document.getElementById('gateInner');
  const icon  = document.getElementById('lockIcon');
  const text  = document.getElementById('statusText');
  const sub   = document.getElementById('statusSub');
  const arc   = document.getElementById('gateArc');
  const pulse = document.getElementById('pulseRing');
  const servo = document.getElementById('servoAngle');

  if (open) {
    card.classList.replace('card-closed', 'card-open');
    ring.classList.replace('ring-closed', 'ring-open');
    inner.style.background = 'rgba(16,185,129,0.1)';
    icon.setAttribute('stroke', '#10B981');
    icon.innerHTML = '<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/>';
    text.textContent = 'TERBUKA';  text.style.color = '#34D399';
    sub.textContent  = 'akses diberikan — relay ON';
    arc.style.opacity = '1';
    pulse.classList.remove('hidden');
    servo.textContent = '90°'; servo.style.color = '#34D399';
  } else {
    card.classList.replace('card-open', 'card-closed');
    ring.classList.replace('ring-open', 'ring-closed');
    inner.style.background = 'rgba(244,63,94,0.08)';
    icon.setAttribute('stroke', '#F43F5E');
    icon.innerHTML = '<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>';
    text.textContent = 'TERKUNCI'; text.style.color = '#FB7185';
    sub.textContent  = 'menunggu scan fingerprint';
    arc.style.opacity = '0';
    pulse.classList.add('hidden');
    servo.textContent = '0°'; servo.style.color = '#4A6380';
  }
}

/* ═══════════════════════════════════════════════════════
   TOAST NOTIFICATION
═══════════════════════════════════════════════════════ */
function showToast(title, sub, isOk = true) {
  const toast = document.getElementById('toast');
  document.getElementById('toastTitle').textContent = title;
  document.getElementById('toastSub').textContent   = sub;
  document.getElementById('toastTitle').style.color = isOk ? '#34D399' : '#FB7185';
  toast.style.borderColor = isOk ? 'rgba(16,185,129,0.3)' : 'rgba(244,63,94,0.3)';

  const svg = toast.querySelector('svg');
  svg.setAttribute('stroke', isOk ? '#10B981' : '#F43F5E');
  svg.innerHTML = isOk
    ? '<polyline points="20 6 9 17 4 12"/>'
    : '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>';

  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 4000);
}

/* ═══════════════════════════════════════════════════════
   WA BADGE
═══════════════════════════════════════════════════════ */
function showWaBadge() {
  const el = document.getElementById('waBadge');
  el.classList.remove('hidden');
  clearTimeout(waBadgeTimer);
  waBadgeTimer = setTimeout(() => el.classList.add('hidden'), 5000);
}

/* ═══════════════════════════════════════════════════════
   HANDLE INCOMING LOG
═══════════════════════════════════════════════════════ */
function handleIncomingLog(log) {
  const existingIds = new Set(logs.map(l => l.id));
  if (existingIds.has(log.id)) return;

  logs.unshift(log);
  const ok = log.status === 'BERHASIL';
  stats.total++;
  if (ok) stats.allowed++; else stats.denied++;

  const h = new Date(log.created_at || Date.now()).getHours();
  if (ok) chartData[h].allowed++; else chartData[h].denied++;

  const dt      = new Date(log.created_at || Date.now());
  const isUnknown = !log.user_id || log.user_id === 0;
  const fpLabel = isUnknown ? 'TIDAK DIKENAL' : `FP-${String(log.user_id).padStart(3, '0')}`;

  document.getElementById('lastFpId').textContent     = fpLabel;
  document.getElementById('lastFpId').style.color     = isUnknown ? '#FB7185' : '#67E8F9';
  document.getElementById('lastFpStatus').textContent = log.status;
  document.getElementById('lastFpStatus').style.color = ok ? '#34D399' : '#FB7185';
  document.getElementById('lastFpTime').textContent   = dt.toLocaleTimeString('id-ID', { hour12: false });
  document.getElementById('lastEventTime').textContent= dt.toLocaleTimeString('id-ID', { hour12: false });

  setGateStatus(ok);
  showToast(ok ? '✓ Akses Diberikan' : '✗ Akses Ditolak', fpLabel, ok);
  if (ok) showWaBadge();

  clearTimeout(gateTimer);
  if (ok) gateTimer = setTimeout(() => setGateStatus(false), 5000);

  renderChart();
  renderLog();
  updateStats();
}

/* ═══════════════════════════════════════════════════════
   LOG TABLE
═══════════════════════════════════════════════════════ */
function statusBadge(s) {
  const ok  = s === 'BERHASIL';
  const cls = ok ? 'badge-ok' : 'badge-fail';
  const dot = ok ? '#34D399' : '#FB7185';
  return `
    <span class="${cls} inline-flex items-center gap-1.5 text-xs font-mono px-2.5 py-1 rounded-lg">
      <span style="width:5px;height:5px;border-radius:50%;background:${dot};display:inline-block;flex-shrink:0"></span>
      ${s}
    </span>`;
}

function renderLog() {
  const tb  = document.getElementById('logTable');
  const em  = document.getElementById('emptyState');
  const cnt = document.getElementById('logCount');

  cnt.textContent = `${logs.length} entri`;

  if (!logs.length) {
    tb.innerHTML = '';
    em.classList.remove('hidden');
    return;
  }
  em.classList.add('hidden');

  tb.innerHTML = logs.slice(0, 100).map((log, i) => {
    const dt  = new Date(log.created_at || Date.now());
    const unk = !log.user_id || log.user_id === 0;
    const fpD = unk
      ? `<span style="color:#FB7185" class="font-mono text-sm">TIDAK DIKENAL</span>`
      : `<span style="color:#67E8F9" class="font-mono text-sm">FP-${String(log.user_id).padStart(3, '0')}</span>`;

    return `
      <tr class="${i === 0 ? 'row-in' : ''}">
        <td class="px-6 py-3.5 text-xs font-mono text-slate-700">${Math.abs(log.id) || (logs.length - i)}</td>
        <td class="px-6 py-3.5">${fpD}</td>
        <td class="px-6 py-3.5">${statusBadge(log.status)}</td>
        <td class="px-6 py-3.5">
          <span class="badge-fp text-xs font-mono px-2.5 py-1 rounded-lg">${log.metode || 'Fingerprint'}</span>
        </td>
        <td class="px-6 py-3.5 text-right">
          <div class="text-xs font-mono text-slate-300">${dt.toLocaleTimeString('id-ID', { hour12: false })}</div>
          <div class="text-xs font-mono text-slate-600">${dt.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
        </td>
      </tr>`;
  }).join('');
}

function updateStats() {
  document.getElementById('totalCount').textContent   = stats.total;
  document.getElementById('allowedCount').textContent = stats.allowed;
  document.getElementById('deniedCount').textContent  = stats.denied;
  const rate = stats.total > 0 ? Math.round((stats.allowed / stats.total) * 100) : null;
  document.getElementById('successRate').textContent  = rate !== null ? `${rate}%` : '—%';
}

/* ═══════════════════════════════════════════════════════
   CLEAR LOG
═══════════════════════════════════════════════════════ */
export function clearLog() {
  logs  = [];
  stats = { total: 0, allowed: 0, denied: 0 };
  chartData.forEach(d => { d.allowed = 0; d.denied = 0; });
  ['lastFpId', 'lastFpStatus', 'lastFpTime'].forEach(id => {
    document.getElementById(id).textContent = '—';
    document.getElementById(id).style.color = '';
  });
  setGateStatus(false);
  renderLog();
  updateStats();
  renderChart();
}

/* ═══════════════════════════════════════════════════════
   DEMO MODE
═══════════════════════════════════════════════════════ */
export function toggleDemo() {
  demoMode = !demoMode;
  const btn    = document.getElementById('demoBtn');
  const banner = document.getElementById('demoBanner');

  if (demoMode) {
    btn.textContent = '⬡ Demo ON';
    btn.style.cssText = 'background:rgba(245,158,11,0.2);border-color:rgba(245,158,11,0.5);color:#FCD34D';
    banner.classList.remove('hidden');
    setSocketStatus('demo');
    clearLog();

    // Seed historical data
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const h   = Math.max(0, now.getHours() - Math.floor(Math.random() * 6));
      const ok  = Math.random() > 0.28;
      const uid = ok ? (Math.floor(Math.random() * 5) + 1) : 0;
      const dt  = new Date();
      dt.setHours(h, Math.floor(Math.random() * 60), Math.floor(Math.random() * 60));
      const log = {
        id: -(demoCounter++), user_id: uid,
        status: ok ? 'BERHASIL' : 'GAGAL',
        metode: 'Fingerprint',
        created_at: dt.toISOString(),
      };
      logs.push(log);
      stats.total++; if (ok) stats.allowed++; else stats.denied++;
      chartData[h][ok ? 'allowed' : 'denied']++;
    }
    logs.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    renderLog(); updateStats(); renderChart();
    scheduleDemoEvent();

  } else {
    btn.textContent = 'Demo';
    btn.style.cssText = 'background:rgba(245,158,11,0.08);border-color:rgba(245,158,11,0.2);color:#FCD34D';
    banner.classList.add('hidden');
    clearTimeout(demoTimeout);
    setSocketStatus(socket.connected ? 'connected' : 'disconnected');
    clearLog();
  }
}

function scheduleDemoEvent() {
  if (!demoMode) return;
  demoTimeout = setTimeout(() => {
    if (!demoMode) return;
    const ok  = Math.random() > 0.25;
    const uid = ok ? (Math.floor(Math.random() * 5) + 1) : 0;
    handleIncomingLog({
      id: -(demoCounter++), user_id: uid,
      status: ok ? 'BERHASIL' : 'GAGAL',
      metode: 'Fingerprint',
      created_at: new Date().toISOString(),
    });
    scheduleDemoEvent();
  }, 3500 + Math.random() * 4000);
}

/* ═══════════════════════════════════════════════════════
   INIT — expose ke window untuk onclick di HTML
═══════════════════════════════════════════════════════ */
window.clearLog   = clearLog;
window.toggleDemo = toggleDemo;

renderChart();
setSocketStatus('connecting');