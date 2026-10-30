// Avisos de clase.
// - App nativa (Android/iOS vía Capacitor): notificaciones programadas por el sistema operativo.
//   Suenan aunque la app esté cerrada y aparecen en la pantalla de bloqueo.
// - Navegador / PWA: solo mientras la app esté abierta (limitación de los navegadores).
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { buildPlan, getSessions, DAYS, fmt, cleanTeacher } from './sessions.js';

export const isNative = Capacitor.isNativePlatform();
export const platform = Capacitor.getPlatform();
const CHANNEL = 'clases';

export async function init() {
  if (!isNative) return;
  if (platform === 'android') {
    try {
      await LocalNotifications.createChannel({
        id: CHANNEL,
        name: 'Avisos de clases',
        description: 'Te avisa antes de que empiece cada clase',
        importance: 5,   // máxima: suena y aparece como banner
        visibility: 1,   // visible en la pantalla de bloqueo
        vibration: true,
        lights: true
      });
    } catch (e) { /* el canal ya existe */ }
  }
}

export async function getPermission() {
  try {
    if (isNative) return (await LocalNotifications.checkPermissions()).display;
    if (!('Notification' in window)) return 'unsupported';
    return { granted: 'granted', denied: 'denied', default: 'prompt' }[Notification.permission];
  } catch (e) { return 'unsupported'; }
}

export async function askPermission() {
  try {
    if (isNative) return (await LocalNotifications.requestPermissions()).display;
    if (!('Notification' in window)) return 'unsupported';
    const p = await Notification.requestPermission();
    return p === 'granted' ? 'granted' : p === 'denied' ? 'denied' : 'prompt';
  } catch (e) { return 'unsupported'; }
}

// Android 12+: las alarmas exactas pueden requerir permiso especial.
export async function exactStatus() {
  if (!isNative || platform !== 'android') return 'granted';
  try { return (await LocalNotifications.checkExactNotificationSetting()).exact_alarm; }
  catch (e) { return 'granted'; }
}
export async function openExactSettings() {
  try { await LocalNotifications.changeExactNotificationSetting(); } catch (e) { /* ignorar */ }
}

/** Reprograma TODOS los avisos semanales. Devuelve cuántos quedaron programados. */
export async function rescheduleAll(state) {
  if (!isNative) return { count: 0, native: false };
  const s = state.settings;
  try {
    const pending = await LocalNotifications.getPending();
    if (pending.notifications.length) {
      await LocalNotifications.cancel({ notifications: pending.notifications.map((n) => ({ id: n.id })) });
    }
    if (!s.enabled) return { count: 0, native: true };
    if ((await getPermission()) !== 'granted') return { count: 0, native: true, needsPermission: true };

    const plan = buildPlan(state.schedule, { lead: s.lead, atStart: s.atStart });
    if (!plan.length) return { count: 0, native: true };

    await LocalNotifications.schedule({
      notifications: plan.map((p) => ({
        id: p.id,
        title: p.title,
        body: p.body,
        channelId: CHANNEL,
        smallIcon: 'ic_stat_icon',
        iconColor: '#EC4899',
        schedule: { on: { weekday: p.weekday, hour: p.hour, minute: p.minute }, allowWhileIdle: true }
      }))
    });
    return { count: plan.length, native: true };
  } catch (e) {
    return { count: 0, native: true, error: String(e && e.message || e) };
  }
}

/** Aviso de prueba en N segundos (para ver cómo se ve en la pantalla de bloqueo). */
export async function sendTest(seconds = 10) {
  const title = '🎀 Prueba: tu clase empieza en 15 min';
  const body = 'Así te llegará el aviso. ¡Bloquea la pantalla para verlo!';
  if (isNative) {
    await LocalNotifications.schedule({
      notifications: [{
        id: 999, title, body, channelId: CHANNEL, smallIcon: 'ic_stat_icon', iconColor: '#EC4899',
        schedule: { at: new Date(Date.now() + seconds * 1000), allowWhileIdle: true }
      }]
    });
  } else {
    setTimeout(() => fireWeb(title, body, 'test'), seconds * 1000);
  }
}

/* ---------------- Navegador: avisos mientras la app está abierta ---------------- */

let webHandler = null;
let soundOn = true;

function beep() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    const ctx = new Ctx();
    [880, 1100, 880, 1320].forEach((f, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine'; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, ctx.currentTime + i * 0.28);
      g.gain.exponentialRampToValueAtTime(0.35, ctx.currentTime + i * 0.28 + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + i * 0.28 + 0.25);
      o.connect(g); g.connect(ctx.destination);
      o.start(ctx.currentTime + i * 0.28); o.stop(ctx.currentTime + i * 0.28 + 0.27);
    });
  } catch (e) { /* sin audio */ }
}

async function fireWeb(title, body, tag) {
  if (webHandler) webHandler(title, body);
  if (soundOn) beep();
  try {
    if ('Notification' in window && Notification.permission === 'granted') {
      const opts = { body, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', tag, vibrate: [200, 100, 200, 100, 200], requireInteraction: true };
      const reg = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : null;
      if (reg) await reg.showNotification(title, opts); else new Notification(title, opts);
    }
  } catch (e) { /* ignorar */ }
}

export function startWebWatcher(getState, onFire) {
  if (isNative) return;
  webHandler = onFire;
  const fired = new Set();
  const tick = () => {
    const st = getState();
    const set = st.settings;
    soundOn = !!set.sound;
    if (!set.enabled) return;
    const now = new Date();
    const di = (now.getDay() + 6) % 7;
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const lead = Math.max(10, set.lead);
    getSessions(st.schedule)[DAYS[di]].forEach((x) => {
      const id = `${now.toDateString()}|${x.start}|${x.title}`;
      if (nowMin >= x.start - lead && nowMin < x.start && !fired.has(id)) {
        fired.add(id);
        const t = cleanTeacher(x.teacher);
        fireWeb(`🎀 ${x.title} empieza en ${x.start - nowMin} min`, `${fmt(x.start)} – ${fmt(x.end)}${t ? ' · ' + t : ''}`, id);
      }
    });
  };
  setInterval(tick, 15000);
  tick();
}
