// Lógica pura del horario (sin dependencias): sesiones, estado actual y plan de avisos.

export const DAYS = ['l', 'm', 'x', 'j', 'v', 's', 'd'];
export const DAY_NAMES = { l: 'Lunes', m: 'Martes', x: 'Miércoles', j: 'Jueves', v: 'Viernes', s: 'Sábado', d: 'Domingo' };

// Capacitor: 1 = domingo ... 7 = sábado
const CAP_WEEKDAY = { l: 2, m: 3, x: 4, j: 5, v: 6, s: 7, d: 1 };

export const toMin = (s) => {
  const [h, m] = String(s).trim().split(':').map(Number);
  return h * 60 + m;
};

export const fmt = (min) => {
  const t = ((min % 1440) + 1440) % 1440;
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
};

export const cleanTeacher = (t) => String(t || '').replace(/\s*\(\d{1,2}:\d{2}\)/, '').trim();

/**
 * Devuelve, por día, la lista de clases ordenadas. Bloques seguidos de la misma
 * materia se unen en una sola clase (08:00-08:50 + 08:50-09:40 => 08:00-09:40).
 * Si el campo "teacher" trae una hora entre paréntesis, p. ej. "(18:00)", esa es
 * la hora real de inicio.
 */
export function getSessions(schedule) {
  const out = {};
  DAYS.forEach((d) => (out[d] = []));

  schedule.forEach((row, ri) => {
    if (row.rest || !row.time) return;
    const [a, b] = row.time.split('-');
    DAYS.forEach((d) => {
      const cell = row[d];
      if (!cell) return;
      let start = toMin(a);
      const end = toMin(b);
      const m = (cell.teacher || '').match(/\((\d{1,2}:\d{2})\)/);
      if (m) {
        const o = toMin(m[1]);
        if (o >= start && o < end) start = o;
      }
      out[d].push({ title: cell.title, teacher: cell.teacher || '', start, end, type: row.type, row: ri });
    });
  });

  DAYS.forEach((d) => {
    out[d].sort((x, y) => x.start - y.start);
    const merged = [];
    for (const s of out[d]) {
      const p = merged[merged.length - 1];
      if (p && p.title === s.title && s.start <= p.end) p.end = Math.max(p.end, s.end);
      else merged.push({ ...s });
    }
    out[d] = merged;
  });
  return out;
}

/** Estado en vivo: clase activa, próxima de hoy, o la siguiente en los próximos 7 días. */
export function currentStatus(schedule, now = new Date()) {
  const sessions = getSessions(schedule);
  const di = (now.getDay() + 6) % 7;
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const today = sessions[DAYS[di]];

  const active = today.find((s) => nowMin >= s.start && nowMin < s.end);
  if (active) return { kind: 'active', s: active, day: DAYS[di], offset: 0, mins: active.end - nowMin, todayCount: today.length };

  const next = today.find((s) => s.start > nowMin);
  if (next) return { kind: 'next', s: next, day: DAYS[di], offset: 0, mins: next.start - nowMin, todayCount: today.length };

  for (let o = 1; o <= 7; o++) {
    const d = DAYS[(di + o) % 7];
    if (sessions[d].length) {
      return { kind: 'later', s: sessions[d][0], day: d, offset: o, mins: o * 1440 - nowMin + sessions[d][0].start, todayCount: today.length };
    }
  }
  return { kind: 'none', todayCount: 0 };
}

/**
 * Plan semanal de avisos. Cada elemento se repite cada semana.
 * lead = minutos de anticipación (mínimo 10). atStart = aviso extra al empezar.
 */
export function buildPlan(schedule, { lead = 15, atStart = false } = {}) {
  const leadMin = Math.max(10, Math.round(lead));
  const sessions = getSessions(schedule);
  const week = 7 * 1440;
  const plan = [];

  DAYS.forEach((d, di) => {
    sessions[d].forEach((s, si) => {
      const teacher = cleanTeacher(s.teacher);
      const body = `${fmt(s.start)} – ${fmt(s.end)}${teacher ? ' · ' + teacher : ''}`;
      const add = (offset, kind, title) => {
        const total = (((di * 1440 + s.start - offset) % week) + week) % week;
        const dd = Math.floor(total / 1440);
        const mm = total % 1440;
        plan.push({
          id: 2000 + di * 100 + si * 2 + (kind === 'start' ? 1 : 0),
          weekday: CAP_WEEKDAY[DAYS[dd]],
          hour: Math.floor(mm / 60),
          minute: mm % 60,
          kind,
          title,
          body
        });
      };
      add(leadMin, 'lead', `🎀 ${s.title} empieza en ${leadMin} min`);
      if (atStart) add(0, 'start', `📚 ¡${s.title} empieza ahora!`);
    });
  });
  return plan;
}
