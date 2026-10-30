import * as L from 'lucide';
import { defaultSchedule } from './schedule-data.js';
import { DAYS, DAY_NAMES, currentStatus, fmt, cleanTeacher } from './sessions.js';
import { buildAvatar, defaultAvatar, randomAvatar, OPTS } from './avatar.js';
import * as cloud from './cloud.js';
import * as notify from './notify.js';

/* ============================== Utilidades ============================== */
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clone = (o) => JSON.parse(JSON.stringify(o));

const ICONS = {
  Clock: L.Clock, CalendarRange: L.CalendarRange, Sparkles: L.Sparkles, User: L.User, Bell: L.Bell,
  Send: L.Send, Mic: L.Mic, Volume2: L.Volume2, VolumeX: L.VolumeX, Save: L.Save, X: L.X,
  Image: L.Image, Download: L.Download, Smartphone: L.Smartphone, Cloud: L.Cloud, Palette: L.Palette,
  Shuffle: L.Shuffle
};
const refreshIcons = () => { try { L.createIcons({ icons: ICONS }); } catch (e) { /* sin íconos */ } };

/* ============================== Estado ============================== */
const LS_STATE = 'sw_state_v1';
const LS_FILES = 'sw_files_v1';

const quotesList = [
  { q: 'La constancia y el esfuerzo diario son las llaves que abren las puertas de la UNAC.', a: 'Study World' },
  { q: 'El éxito es la suma de pequeños esfuerzos repetidos día tras día.', a: 'Robert Collier' },
  { q: 'No importa lo lento que avances, lo importante es que nunca te detengas.', a: 'Confucio' },
  { q: 'Cada fórmula aprendida hoy es un paso más hacia tu futuro profesional.', a: 'Ingeniería Study' },
  { q: 'Cree en ti misma; eres más capaz de lo que imaginas.', a: 'Motivación Kawaii' }
];

function defaults() {
  return {
    schedule: clone(defaultSchedule),
    notes: {},
    avatar: defaultAvatar(),
    theme: 'kitty',
    settings: { enabled: true, lead: 15, atStart: false, sound: true },
    updatedAt: 0
  };
}

function normalize(s) {
  const d = defaults();
  const out = { ...d, ...(s || {}) };
  out.avatar = { ...d.avatar, ...((s && s.avatar) || {}) };
  out.settings = { ...d.settings, ...((s && s.settings) || {}) };
  out.settings.lead = Math.max(10, Number(out.settings.lead) || 15);
  out.notes = (s && s.notes) || {};
  out.schedule = s && Array.isArray(s.schedule) && s.schedule.length ? s.schedule : d.schedule;
  out.theme = out.theme === 'dark' ? 'dark' : 'kitty';
  return out;
}

let state = defaults();
let files = {}; // adjuntos: solo en este dispositivo

function loadState() {
  try {
    const raw = localStorage.getItem(LS_STATE);
    if (raw) state = normalize(JSON.parse(raw));
    else migrateLegacy();
  } catch (e) { state = defaults(); }
  try { files = JSON.parse(localStorage.getItem(LS_FILES) || '{}') || {}; } catch (e) { files = {}; }
}

function migrateLegacy() {
  try {
    const old = localStorage.getItem('hk_schedule_custom_v3');
    if (old) state.schedule = JSON.parse(old);
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      const m = k && k.match(/^notes_(\d+)_([a-z])$/);
      if (m) {
        const n = JSON.parse(localStorage.getItem(k));
        const key = `${m[1]}_${m[2]}`;
        if (n && n.text) state.notes[key] = { text: n.text };
        if (n && n.files && n.files.length) files[key] = n.files;
      }
    }
  } catch (e) { /* ignorar */ }
}

function persistLocal() {
  try { localStorage.setItem(LS_STATE, JSON.stringify(state)); } catch (e) { toast('Sin espacio', 'No se pudo guardar en el dispositivo.'); }
}
function persistFiles() {
  try { localStorage.setItem(LS_FILES, JSON.stringify(files)); return true; } catch (e) { return false; }
}

/** Todo cambio del usuario pasa por aquí: guarda, sincroniza y reprograma avisos. */
function commit() {
  state.updatedAt = Date.now();
  persistLocal();
  scheduleCloudPush();
  scheduleReminders();
}

/* ============================== Toast ============================== */
let toastTimer = null;
function toast(title, body, ms = 6000) {
  $('toast-title').textContent = title;
  $('toast-body').textContent = body || '';
  $('toast').classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $('toast').classList.add('hidden'), ms);
}

/* ============================== Tema ============================== */
function applyTheme() {
  document.body.classList.remove('theme-kitty', 'theme-dark');
  document.body.classList.add(`theme-${state.theme}`);
}

/* ============================== Pestañas ============================== */
function switchTab(targetId) {
  document.querySelectorAll('.view-panel').forEach((p) => p.classList.add('hidden'));
  document.querySelectorAll('.nav-tab').forEach((t) => {
    const on = t.dataset.target === targetId;
    t.classList.toggle('bg-pink-500', on);
    t.classList.toggle('text-white', on);
    t.classList.toggle('text-pink-600', !on);
  });
  $(targetId).classList.remove('hidden');
  if (targetId === 'view-settings') renderSettings();
  window.scrollTo({ top: 0 });
  refreshIcons();
}

/* ============================== Reloj y panel en vivo ============================== */
let hourIdx = -1;
function updateQuote(hour) {
  if (hour === hourIdx) return;
  hourIdx = hour;
  const q = quotesList[hour % quotesList.length];
  $('quote-text').textContent = `"${q.q}"`;
  $('quote-author').textContent = `— ${q.a}`;
}

const dur = (mins) => {
  const d = Math.floor(mins / 1440), h = Math.floor((mins % 1440) / 60), m = mins % 60;
  if (d > 0) return `${d} d ${h} h`;
  return h > 0 ? `${h} h ${m} min` : `${m} min`;
};

function updateDashboard(now = new Date()) {
  const st = currentStatus(state.schedule, now);
  const set = (id, v) => { const el = $(id); if (el.textContent !== v) el.textContent = v; };
  const cd = $('dash-countdown');
  const green = 'text-base font-black font-mono text-emerald-600';
  const amber = 'text-base font-black font-mono text-amber-600';
  const pink = 'text-base font-black font-mono text-pink-600';

  if (st.kind === 'active') {
    set('dash-label', 'Clase activa'); set('dash-day-badge', 'Hoy');
    set('dash-active-title', st.s.title); set('dash-active-detail', cleanTeacher(st.s.teacher));
    set('dash-active-time', `${fmt(st.s.start)} - ${fmt(st.s.end)}`);
    set('dash-countdown', `Termina en ${dur(st.mins)}`); cd.className = green;
    set('hk-status-badge', 'En clase');
  } else if (st.kind === 'next') {
    set('dash-label', 'Próxima clase'); set('dash-day-badge', 'Hoy');
    set('dash-active-title', st.s.title); set('dash-active-detail', cleanTeacher(st.s.teacher));
    set('dash-active-time', `${fmt(st.s.start)} - ${fmt(st.s.end)}`);
    set('dash-countdown', `Empieza en ${dur(st.mins)}`); cd.className = amber;
    set('hk-status-badge', st.mins <= state.settings.lead ? '¡Ya casi!' : 'Descanso');
  } else if (st.kind === 'later') {
    const when = st.offset === 1 ? 'Mañana' : DAY_NAMES[st.day];
    set('dash-label', 'Siguiente clase'); set('dash-day-badge', when);
    set('dash-active-title', st.todayCount ? '¡Terminaste por hoy! 🎉' : 'Hoy no tienes clases 🌸');
    set('dash-active-detail', `Siguiente: ${st.s.title} · ${when} ${fmt(st.s.start)}`);
    set('dash-active-time', `${fmt(st.s.start)} - ${fmt(st.s.end)}`);
    set('dash-countdown', `En ${dur(st.mins)}`); cd.className = pink;
    set('hk-status-badge', 'Libre');
  } else {
    set('dash-label', 'Sin clases'); set('dash-day-badge', 'Hoy');
    set('dash-active-title', 'No hay clases en el horario'); set('dash-active-detail', '');
    set('dash-active-time', '--:-- - --:--'); set('dash-countdown', 'Libre'); cd.className = pink;
    set('hk-status-badge', 'Libre');
  }
}

function startClock() {
  const tick = () => {
    const now = new Date();
    $('live-time').textContent = now.toLocaleTimeString('es-PE');
    $('live-date').textContent = now.toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'short' });
    updateQuote(now.getHours());
    updateDashboard(now);
  };
  tick();
  setInterval(tick, 1000);
}

/* ============================== Horario ============================== */
let filter = 'all';
const todayKey = () => DAYS[(new Date().getDay() + 6) % 7];

function renderSchedule() {
  const tbody = $('schedule-tbody');
  const tk = todayKey();
  let html = '';
  state.schedule.forEach((row, ri) => {
    if (filter !== 'all' && row.type && row.type !== filter) return;
    if (row.rest) {
      html += `<tr><td class="p-2 text-center font-bold bg-pink-100 text-pink-800" colspan="8">${esc(row.time)} — ${esc(row.rest)}</td></tr>`;
      return;
    }
    const cls = row.type === 'unac' ? 'card-unac' : 'card-morning';
    html += `<tr><td class="p-2.5 font-mono font-bold text-center bg-pink-50/50 text-pink-900">${esc(row.time)}</td>`;
    DAYS.forEach((d) => {
      const cell = row[d];
      const today = d === tk ? 'today-col' : '';
      if (cell) {
        const has = state.notes[`${ri}_${d}`] && state.notes[`${ri}_${d}`].text ? ' 📝' : '';
        html += `<td class="p-1.5 ${today}" data-act="cell" data-row="${ri}" data-day="${d}"><div class="${cls}"><strong class="block">${esc(cell.title)}${has}</strong><small class="opacity-80">${esc(cell.teacher)}</small></div></td>`;
      } else html += `<td class="p-1.5 ${today}"></td>`;
    });
    html += '</tr>';
  });
  tbody.innerHTML = html;
}

/* ============================== Apuntes ============================== */
let cellRef = null;
let tempFiles = [];

function openCell(ri, d) {
  cellRef = { ri, d, key: `${ri}_${d}` };
  const cell = state.schedule[ri][d];
  $('modal-course-title').textContent = `Apuntes de ${cell.title}`;
  $('modal-course-sub').textContent = `${DAY_NAMES[d]} · ${state.schedule[ri].time}`;
  $('modal-teacher-input').value = cell.teacher || '';
  $('modal-notes-textarea').value = (state.notes[cellRef.key] && state.notes[cellRef.key].text) || '';
  tempFiles = clone(files[cellRef.key] || []);
  renderAttachments();
  const m = $('notes-modal');
  m.classList.remove('hidden'); m.classList.add('flex');
  refreshIcons();
}
function closeNotes() { const m = $('notes-modal'); m.classList.add('hidden'); m.classList.remove('flex'); }

function saveNotes() {
  if (!cellRef) return;
  const { ri, d, key } = cellRef;
  state.schedule[ri][d].teacher = $('modal-teacher-input').value;
  const text = $('modal-notes-textarea').value;
  if (text.trim()) state.notes[key] = { text }; else delete state.notes[key];
  if (tempFiles.length) files[key] = tempFiles; else delete files[key];
  if (!persistFiles()) { toast('Sin espacio', 'Los adjuntos no caben. Prueba con archivos más pequeños.'); return; }
  commit();
  renderSchedule();
  closeNotes();
}

function handleFile(e) {
  const f = e.target.files[0];
  e.target.value = '';
  if (!f) return;
  if (f.size > 2 * 1024 * 1024) { toast('Archivo muy grande', 'El máximo es 2 MB.'); return; }
  const r = new FileReader();
  r.onload = (ev) => { tempFiles.push({ name: f.name, type: f.type, data: ev.target.result }); renderAttachments(); };
  r.readAsDataURL(f);
}

function renderAttachments() {
  const box = $('attachments-preview');
  box.innerHTML = '';
  tempFiles.forEach((it, i) => {
    const div = document.createElement('div');
    div.className = 'p-2 bg-pink-100 rounded-xl text-[10px] font-bold flex items-center gap-1.5 text-pink-800';
    const a = document.createElement('a');
    a.href = it.data; a.download = it.name; a.textContent = `📎 ${it.name}`;
    const x = document.createElement('button');
    x.textContent = '×'; x.className = 'text-pink-500 font-bold ml-1';
    x.addEventListener('click', () => { tempFiles.splice(i, 1); renderAttachments(); });
    div.append(a, x);
    box.appendChild(div);
  });
}

/* ============================== Avatar ============================== */
function renderAvatars() {
  const svg = buildAvatar(state.avatar, '100%');
  document.querySelectorAll('[data-avatar]').forEach((el) => { el.innerHTML = svg; });
  $('dash-name').textContent = state.avatar.name || 'Mi gatita';
}

function renderAvatarEditor() {
  const a = state.avatar;
  const swatches = (k) => OPTS[k].map((c) =>
    `<button data-act="av" data-k="${k}" data-v="${c}" aria-label="${c}" class="w-8 h-8 rounded-full border-2 ${a[k] === c ? 'border-pink-600 ring-2 ring-pink-300' : 'border-white shadow'}" style="background:${c}"></button>`).join('');
  const chips = (k) => OPTS[k].map(([v, label]) =>
    `<button data-act="av" data-k="${k}" data-v="${v}" class="px-3 py-1.5 rounded-xl text-xs font-bold border ${a[k] === v ? 'bg-pink-500 text-white border-pink-500' : 'bg-pink-50 text-pink-700 border-pink-200'}">${label}</button>`).join('');
  const toggle = (k, label) =>
    `<button data-act="avToggle" data-k="${k}" class="px-3 py-1.5 rounded-xl text-xs font-bold border ${a[k] ? 'bg-pink-500 text-white border-pink-500' : 'bg-pink-50 text-pink-700 border-pink-200'}">${label}: ${a[k] ? 'Sí' : 'No'}</button>`;
  const group = (title, inner) => `<div><div class="font-bold text-pink-700 mb-1.5">${title}</div><div class="flex flex-wrap gap-2">${inner}</div></div>`;

  $('avatar-editor').innerHTML = `
    <div class="flex items-center gap-4">
      <div class="w-28 h-28 rounded-full overflow-hidden border-4 border-pink-200 bg-white shrink-0" data-avatar></div>
      <div class="flex-1">
        <label class="font-bold text-pink-700 block mb-1">Nombre de tu avatar</label>
        <input id="av-name" type="text" maxlength="20" value="${esc(a.name || '')}" class="w-full bg-pink-50 text-pink-900 border border-pink-200 rounded-xl p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-pink-400">
      </div>
    </div>
    ${group('Color de pelito', swatches('fur'))}
    ${group('Ojitos', chips('eyes'))}
    ${group('Lazo', chips('bow'))}
    ${group('Color del lazo', swatches('bowColor'))}
    ${group('Posición del lazo', chips('bowPos'))}
    ${group('Accesorio', chips('acc'))}
    ${group('Ropa', swatches('shirt'))}
    ${group('Fondo', swatches('bg'))}
    ${group('Detalles', toggle('blush', 'Cachetitos') + toggle('whiskers', 'Bigotes'))}`;
  document.querySelectorAll('#avatar-editor [data-avatar]').forEach((el) => { el.innerHTML = buildAvatar(state.avatar, '100%'); });
}

function setAvatar(patch) {
  state.avatar = { ...state.avatar, ...patch };
  commit();
  renderAvatars();
  renderAvatarEditor();
}

/* ============================== Cuenta y sincronización ============================== */
let user = null;
let pushTimer = null;
let chipKind = 'local';

const CHIPS = {
  local: '📱 Solo en este dispositivo',
  out: '☁️ Inicia sesión para sincronizar',
  syncing: '🔄 Sincronizando…',
  synced: '✅ Sincronizado',
  offline: '⚠️ Sin conexión (pendiente)'
};
function setChip(kind) {
  chipKind = kind;
  $('sync-chip').textContent = CHIPS[kind];
  if ($('sync-line')) $('sync-line').textContent = CHIPS[kind];
}

function payload() {
  return {
    data: JSON.stringify({ schedule: state.schedule, notes: state.notes, avatar: state.avatar, theme: state.theme, settings: state.settings }),
    updatedAt: state.updatedAt,
    email: user ? user.email : ''
  };
}

function scheduleCloudPush() {
  if (!user) return;
  setChip(navigator.onLine ? 'syncing' : 'offline');
  clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    cloud.pushState(payload()).then(() => setChip('synced')).catch(() => setChip('offline'));
  }, 1200);
}

function onUser(u) {
  user = u;
  setChip(u ? (navigator.onLine ? 'syncing' : 'offline') : 'out');
  renderAcct();
}

function onRemote(data, pending) {
  if (!data) { // primera vez con esta cuenta: subimos lo que hay en el dispositivo
    state.updatedAt = state.updatedAt || Date.now();
    persistLocal();
    cloud.pushState(payload()).then(() => setChip('synced')).catch(() => setChip('offline'));
    return;
  }
  if (pending) return;
  const remoteAt = Number(data.updatedAt) || 0;
  if (remoteAt > state.updatedAt) {
    try {
      const parsed = JSON.parse(data.data);
      state = normalize({ ...parsed, updatedAt: remoteAt });
      persistLocal();
      renderAll();
      scheduleReminders();
      toast('☁️ Datos actualizados', 'Se cargaron los cambios de tu cuenta.', 3500);
    } catch (e) { /* documento inválido */ }
  } else if (remoteAt < state.updatedAt) {
    scheduleCloudPush();
    return;
  }
  setChip('synced');
}

function renderAcct() {
  const box = $('acct-body');
  if (!cloud.cloudConfigured) {
    box.innerHTML = `
      <div class="bg-amber-50 border border-amber-300 rounded-2xl p-3 text-amber-900">
        La sincronización todavía no está activada. Todo se guarda en este dispositivo.
        Para activar las cuentas hay que pegar los datos de Firebase en <b>src/firebase-config.js</b> (paso a paso en <b>LEEME.md</b>, toma 10 minutos).
      </div>
      <div id="sync-line" class="font-bold">${CHIPS[chipKind]}</div>`;
    return;
  }
  if (!user) {
    box.innerHTML = `
      <p class="opacity-80">Crea una cuenta o entra para tener tu horario, apuntes y avatar en todos tus dispositivos.</p>
      <input id="auth-email" type="email" autocomplete="email" placeholder="Correo" class="w-full bg-pink-50 text-pink-900 border border-pink-200 rounded-xl p-3 text-xs focus:outline-none focus:ring-2 focus:ring-pink-400">
      <input id="auth-pass" type="password" autocomplete="current-password" placeholder="Contraseña (mín. 6 caracteres)" class="w-full bg-pink-50 text-pink-900 border border-pink-200 rounded-xl p-3 text-xs focus:outline-none focus:ring-2 focus:ring-pink-400">
      <div id="auth-msg" class="text-rose-600 font-bold min-h-[1rem]"></div>
      <div class="flex flex-wrap gap-2 font-bold">
        <button data-act="authIn" class="bg-pink-500 text-white px-4 py-2 rounded-2xl">Entrar</button>
        <button data-act="authUp" class="bg-pink-100 text-pink-700 border border-pink-300 px-4 py-2 rounded-2xl">Crear cuenta</button>
        <button data-act="authReset" class="text-pink-600 underline px-2 py-2">Olvidé mi contraseña</button>
      </div>`;
    return;
  }
  box.innerHTML = `
    <div class="bg-emerald-50 border border-emerald-200 rounded-2xl p-3 text-emerald-900">Sesión iniciada como <b>${esc(user.email)}</b></div>
    <div id="sync-line" class="font-bold">${CHIPS[chipKind]}</div>
    <p class="opacity-80">Se sincronizan: horario, apuntes de texto, avatar, tema y ajustes de avisos. Gana siempre el cambio más reciente. Las fotos y audios se quedan en cada dispositivo.</p>
    <button data-act="authOut" class="bg-pink-100 text-pink-700 border border-pink-300 font-bold px-4 py-2 rounded-2xl">Cerrar sesión</button>`;
}

async function doAuth(kind) {
  const email = ($('auth-email').value || '').trim();
  const pass = $('auth-pass').value || '';
  const msg = $('auth-msg');
  msg.textContent = '';
  if (!email || !pass) { msg.textContent = 'Escribe tu correo y contraseña.'; return; }
  try { kind === 'in' ? await cloud.signIn(email, pass) : await cloud.signUp(email, pass); }
  catch (e) { msg.textContent = cloud.friendlyError(e); }
}
async function doReset() {
  const email = ($('auth-email').value || '').trim();
  const msg = $('auth-msg');
  if (!email) { msg.textContent = 'Escribe tu correo arriba y vuelve a tocar.'; return; }
  try { await cloud.resetPassword(email); msg.className = 'text-emerald-600 font-bold min-h-[1rem]'; msg.textContent = 'Te enviamos un correo para cambiar la contraseña.'; }
  catch (e) { msg.textContent = cloud.friendlyError(e); }
}

/* ============================== Avisos ============================== */
let remTimer = null;
let lastCount = null;
function scheduleReminders() {
  clearTimeout(remTimer);
  remTimer = setTimeout(async () => {
    const r = await notify.rescheduleAll(state);
    lastCount = r;
    if ($('view-settings') && !$('view-settings').classList.contains('hidden')) renderSettings();
  }, 800);
}

async function refreshNotifBanner() {
  const perm = await notify.getPermission();
  $('notif-banner').classList.toggle('hidden', !(state.settings.enabled && perm === 'prompt'));
}

async function renderSettings() {
  const s = state.settings;
  $('set-enabled').checked = s.enabled;
  $('set-lead').value = String(s.lead);
  if (![...$('set-lead').options].some((o) => o.value === String(s.lead))) {
    const o = document.createElement('option'); o.value = String(s.lead); o.textContent = `${s.lead} min`; $('set-lead').appendChild(o);
    $('set-lead').value = String(s.lead);
  }
  $('set-start').checked = s.atStart;
  $('set-sound').checked = s.sound;

  const perm = await notify.getPermission();
  let line;
  if (!s.enabled) line = '🔕 Avisos desactivados.';
  else if (perm === 'unsupported') line = '⚠️ Este navegador no admite notificaciones.';
  else if (perm === 'denied') line = '🚫 Las notificaciones están bloqueadas. Actívalas en los ajustes del teléfono para esta app.';
  else if (perm === 'prompt') line = '🔔 Falta permiso: toca “Permitir notificaciones”.';
  else if (notify.isNative) {
    const n = lastCount && lastCount.count ? ` ${lastCount.count} avisos programados cada semana.` : '';
    line = `✅ Listo. Sonará ${s.lead} min antes de cada clase, también con el teléfono bloqueado o la app cerrada.${n}`;
  } else line = `✅ Permiso concedido. En el navegador solo suena mientras la app está abierta (para avisos con la app cerrada usa el APK de Android).`;
  $('notif-status').textContent = line;
  $('exact-box').classList.toggle('hidden', (await notify.exactStatus()) !== 'denied');
  refreshNotifBanner();
}

/* ============================== Tutor ============================== */
let voiceActive = true;

function tutorReply(userText) {
  const t = userText.toLowerCase().trim();
  if (/^(hola|buenas|buenos dias|buenas tardes|buenas noches|hello|kitty)/.test(t)) return '¡Hola! 🌸 Cuéntame, ¿en qué materia o tema necesitas orientación hoy?';
  if (/gracias|entendido|perfecto|chevere/.test(t)) return '¡De nada! 🎀 Recuerda repasar con calma. ¡Mucho éxito!';
  if (t.includes('física') || t.includes('mru') || t.includes('fuerza')) return '🎀 Física:\n1. MRU: d = v × t.\n2. MRUV: d = v₀t ± ½at².\n3. Newton: ΣF = m · a.';
  if (t.includes('aritmética') || t.includes('porcentaje') || t.includes('mcd')) return '🌸 Aritmética:\n- Porcentajes: P% de N = (P/100) × N.\n- MCM/MCD: descomposición simultánea en factores primos.';
  if (t.includes('álgebra') || t.includes('ecuación') || t.includes('factor')) return '🎀 Álgebra:\n(a+b)² = a² + 2ab + b²\na² − b² = (a+b)(a−b)';
  return `🌸 Sobre "${userText}", te sugiero:\n1. Revisar los datos del problema y la teoría principal.\n2. Aplicar la fórmula paso a paso.\n¿Profundizamos en algo en especial?`;
}

function sendAi() {
  const input = $('ai-input');
  const text = input.value.trim();
  if (!text) return;
  const box = $('chat-box');
  const u = document.createElement('div');
  u.className = 'bg-pink-500 text-white p-3 rounded-2xl max-w-md ml-auto text-xs font-sans';
  u.textContent = text;
  box.appendChild(u);
  input.value = '';
  box.scrollTop = box.scrollHeight;
  setTimeout(() => {
    const reply = tutorReply(text);
    const b = document.createElement('div');
    b.className = 'bg-white p-3 rounded-2xl max-w-md border border-pink-200 text-pink-900 text-xs font-sans whitespace-pre-line';
    b.textContent = reply;
    box.appendChild(b);
    box.scrollTop = box.scrollHeight;
    if (voiceActive && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const synth = new SpeechSynthesisUtterance(reply.replace(/[\n\r]/g, ' '));
      const v = window.speechSynthesis.getVoices().find((x) => x.lang.includes('es') && /Sabina|Monica|Paulina|Google español|Female/i.test(x.name));
      if (v) synth.voice = v;
      synth.lang = 'es-PE'; synth.pitch = 1.2;
      window.speechSynthesis.speak(synth);
    }
  }, 500);
}

function startMic() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { toast('Micrófono no disponible', 'Prueba en Chrome o Edge, o escribe tu pregunta.'); return; }
  const rec = new SR();
  rec.lang = 'es-PE'; rec.interimResults = false;
  const btn = $('mic-btn'), label = $('mic-status');
  const reset = () => { btn.className = 'bg-pink-100 hover:bg-pink-200 text-pink-700 p-3 rounded-2xl text-xs font-bold transition flex items-center gap-1'; label.textContent = 'Hablar'; };
  rec.onstart = () => { btn.className = 'bg-rose-500 text-white p-3 rounded-2xl text-xs font-bold transition flex items-center gap-1 animate-pulse'; label.textContent = 'Escuchando...'; };
  rec.onresult = (ev) => { $('ai-input').value = ev.results[0][0].transcript; sendAi(); };
  rec.onerror = reset; rec.onend = reset;
  rec.start();
}

/* ============================== Respaldo ============================== */
function backup() {
  const blob = new Blob([JSON.stringify({ app: 'study-world', version: 2, state, files })], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'respaldo_study_world.json';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function restore(e) {
  const f = e.target.files[0];
  e.target.value = '';
  if (!f) return;
  const r = new FileReader();
  r.onload = (ev) => {
    try {
      const j = JSON.parse(ev.target.result);
      if (j.app !== 'study-world') throw new Error('formato');
      state = normalize(j.state);
      files = j.files || {};
      persistFiles();
      commit();
      renderAll();
      toast('Respaldo restaurado', 'Listo 🌸');
    } catch (err) { toast('No se pudo restaurar', 'El archivo no es un respaldo de Study World.'); }
  };
  r.readAsText(f);
}

/* ============================== Instalar (navegador) ============================== */
let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferredPrompt = e; });
window.addEventListener('appinstalled', () => { deferredPrompt = null; $('install-btn').classList.add('hidden'); });
const showModal = (id, on) => { const m = $(id); m.classList.toggle('hidden', !on); m.classList.toggle('flex', on); };

/* ============================== Eventos ============================== */
const actions = {
  tab: (el) => switchTab(el.dataset.target),
  filter: (el) => { filter = el.dataset.v; renderSchedule(); },
  cell: (el) => openCell(Number(el.dataset.row), el.dataset.day),
  closeNotes, saveNotes,
  installOpen: () => showModal('pwa-modal', true),
  installClose: () => showModal('pwa-modal', false),
  installNative: () => {
    if (deferredPrompt) { deferredPrompt.prompt(); deferredPrompt.userChoice.then(() => { deferredPrompt = null; showModal('pwa-modal', false); }); }
    else toast('Instalación manual', 'Sigue los pasos que aparecen en la ventana.');
  },
  toggleVoice: () => {
    voiceActive = !voiceActive;
    if (!voiceActive && 'speechSynthesis' in window) window.speechSynthesis.cancel();
    $('voice-status-text').textContent = voiceActive ? 'Voz: Activada' : 'Voz: Silenciada';
  },
  mic: startMic,
  send: sendAi,
  theme: (el) => { state.theme = el.dataset.v; applyTheme(); commit(); },
  av: (el) => setAvatar({ [el.dataset.k]: el.dataset.v }),
  avToggle: (el) => setAvatar({ [el.dataset.k]: !state.avatar[el.dataset.k] }),
  avRandom: () => setAvatar(randomAvatar(state.avatar)),
  authIn: () => doAuth('in'),
  authUp: () => doAuth('up'),
  authReset: doReset,
  authOut: () => cloud.signOut(),
  notifAllow: async () => { await notify.askPermission(); await notify.init(); scheduleReminders(); renderSettings(); },
  notifTest: async () => {
    if ((await notify.getPermission()) !== 'granted') await notify.askPermission();
    if ((await notify.getPermission()) !== 'granted') { toast('Falta permiso', 'Permite las notificaciones para probar.'); return; }
    await notify.sendTest(10);
    toast('Prueba en camino', 'En 10 segundos llegará un aviso. ¡Bloquea la pantalla para verlo!');
  },
  exactOpen: () => notify.openExactSettings(),
  backup
};

function bindEvents() {
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-act]');
    if (!el) return;
    const fn = actions[el.dataset.act];
    if (fn) fn(el);
  });
  $('ai-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') sendAi(); });
  $('file-input').addEventListener('change', handleFile);
  $('restore-input').addEventListener('change', restore);
  document.addEventListener('input', (e) => {
    if (e.target && e.target.id === 'av-name') {
      state.avatar.name = e.target.value.slice(0, 20);
      commit();
      $('dash-name').textContent = state.avatar.name || 'Mi gatita';
    }
  });
  const setting = (id, key, conv) => $(id).addEventListener('change', (e) => {
    state.settings[key] = conv(e.target);
    commit();
    renderSettings();
  });
  setting('set-enabled', 'enabled', (t) => t.checked);
  setting('set-lead', 'lead', (t) => Math.max(10, Number(t.value)));
  setting('set-start', 'atStart', (t) => t.checked);
  setting('set-sound', 'sound', (t) => t.checked);

  window.addEventListener('online', () => { if (user) scheduleCloudPush(); });
  window.addEventListener('offline', () => { if (user) setChip('offline'); });
}

function renderAll() {
  applyTheme();
  renderSchedule();
  renderAvatars();
  renderAvatarEditor();
  renderAcct();
  updateDashboard();
  refreshIcons();
}

/* ============================== Inicio ============================== */
async function start() {
  loadState();
  renderAll();
  bindEvents();
  startClock();
  setChip('local');

  const standalone = (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || navigator.standalone;
  if (notify.isNative || standalone) $('install-btn').classList.add('hidden');

  try {
    const ok = cloud.initCloud({ onUser, onRemote, onError: () => setChip('offline') });
    if (ok) setChip('out');
  } catch (e) { setChip('local'); }

  await notify.init();
  if (notify.isNative && (await notify.getPermission()) === 'prompt') await notify.askPermission();
  await notify.rescheduleAll(state).then((r) => { lastCount = r; });
  notify.startWebWatcher(() => state, (t, b) => toast(t, b, 15000));
  refreshNotifBanner();

  if (!notify.isNative && 'serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
  if ('speechSynthesis' in window) window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
else start();
