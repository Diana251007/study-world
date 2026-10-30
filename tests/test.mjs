// Pruebas de la lógica pura (sin dependencias). Ejecutar: npm test
import assert from 'node:assert/strict';
import { defaultSchedule } from '../src/schedule-data.js';
import { DAYS, getSessions, currentStatus, buildPlan, fmt } from '../src/sessions.js';
import { buildAvatar, defaultAvatar, randomAvatar, OPTS } from '../src/avatar.js';

let n = 0;
const ok = (name, fn) => { fn(); n++; console.log('  ✔', name); };
const sched = JSON.parse(JSON.stringify(defaultSchedule));

ok('une bloques seguidos de la misma materia', () => {
  const s = getSessions(sched);
  const j = s.j[0];
  assert.equal(j.title, 'Raz. Matemático');
  assert.equal(fmt(j.start), '08:00');
  assert.equal(fmt(j.end), '10:30');
  assert.equal(s.l[0].title, 'Aritmética');
  assert.equal(fmt(s.l[0].end), '09:40');
});

ok('respeta la hora real entre paréntesis (18:00 / 19:45)', () => {
  const s = getSessions(sched);
  const geo = s.l.find((x) => x.title === 'Geometría');
  const eco = s.l.find((x) => x.title === 'Economía');
  assert.equal(fmt(geo.start), '18:00');
  assert.equal(fmt(eco.start), '19:45');
});

ok('estado en vivo: jueves 08:20 = clase activa', () => {
  const st = currentStatus(sched, new Date(2026, 9, 29, 8, 20)); // jueves
  assert.equal(st.kind, 'active');
  assert.equal(st.s.title, 'Raz. Matemático');
  assert.equal(st.mins, 130);
});

ok('estado en vivo: jueves 14:00 = siguiente es Álgebra 17:15', () => {
  const st = currentStatus(sched, new Date(2026, 9, 29, 14, 0));
  assert.equal(st.kind, 'next');
  assert.equal(st.s.title, 'Álgebra');
  assert.equal(st.mins, 195);
});

ok('estado en vivo: sábado 23:50 apunta al domingo (simulacro)', () => {
  const st = currentStatus(sched, new Date(2026, 9, 31, 23, 50));
  assert.equal(st.kind, 'later');
  assert.equal(st.day, 'd');
});

ok('plan de avisos: cada aviso es de al menos 10 min antes', () => {
  for (const lead of [5, 10, 15, 30]) {
    const sessions = getSessions(sched);
    const plan = buildPlan(sched, { lead, atStart: false });
    assert.equal(plan.length, DAYS.reduce((a, d) => a + sessions[d].length, 0));
    plan.forEach((p) => assert.equal(p.kind, 'lead'));
  }
  // lead=5 se corrige a 10 => jueves 08:00 -> 07:50
  const p = buildPlan(sched, { lead: 5 }).find((x) => x.title.includes('Raz. Matemático'));
  assert.equal(p.title, '🎀 Raz. Matemático empieza en 10 min');
  assert.deepEqual([p.weekday, p.hour, p.minute], [5, 7, 50]);
});

ok('plan de avisos: lunes 08:00 con 15 min => lunes 07:45 (weekday 2)', () => {
  const p = buildPlan(sched, { lead: 15 }).find((x) => x.title.includes('Aritmética') && x.weekday === 2 && x.hour === 7);
  assert.ok(p);
  assert.equal(p.minute, 45);
});

ok('plan de avisos: domingo 10:00 con 60 min => domingo 09:00 (weekday 1)', () => {
  const p = buildPlan(sched, { lead: 60 }).find((x) => x.title.includes('SIMULACRO'));
  assert.deepEqual([p.weekday, p.hour, p.minute], [1, 9, 0]);
});

ok('plan de avisos: cruce de medianoche', () => {
  const s2 = [{ time: '00:05 - 01:00', l: { title: 'Madrugada', teacher: '' }, type: 'morning' }];
  const p = buildPlan(s2, { lead: 15 })[0];
  assert.deepEqual([p.weekday, p.hour, p.minute], [1, 23, 50]); // domingo 23:50
});

ok('aviso extra al empezar y IDs únicos', () => {
  const plan = buildPlan(sched, { lead: 15, atStart: true });
  const ids = new Set(plan.map((p) => p.id));
  assert.equal(ids.size, plan.length);
  assert.ok(plan.some((p) => p.kind === 'start'));
});

ok('avatar: SVG válido para opciones por defecto, todas las combinaciones básicas y aleatorias', () => {
  const base = defaultAvatar();
  assert.ok(buildAvatar(base, 100).startsWith('<svg'));
  for (const [eyes] of OPTS.eyes) for (const [bow] of OPTS.bow) for (const [acc] of OPTS.acc) for (const [bowPos] of OPTS.bowPos) {
    const svg = buildAvatar({ ...base, eyes, bow, acc, bowPos }, '100%');
    assert.ok(svg.endsWith('</svg>'));
    assert.equal((svg.match(/<svg/g) || []).length, 1);
    assert.equal((svg.match(/<g[ >]/g) || []).length, (svg.match(/<\/g>/g) || []).length);
  }
  for (let i = 0; i < 50; i++) assert.ok(buildAvatar(randomAvatar(base), 64).includes('clipPath'));
});

ok('avatar: el nombre no puede inyectar HTML', () => {
  const svg = buildAvatar({ ...defaultAvatar(), name: '"><script>alert(1)</script>' }, 50);
  assert.ok(!svg.includes('<script'));
});

console.log(`\n${n} pruebas OK`);
