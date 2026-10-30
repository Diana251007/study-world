// Avatar kawaii original (gatita con lazo) dibujado en SVG y totalmente personalizable.

export const OPTS = {
  fur: ['#fff4e0', '#ffffff', '#d9d6e3', '#4a4458', '#ffd1e3', '#e6d9ff', '#ffc999', '#e0b88a'],
  bowColor: ['#ec4899', '#f43f5e', '#a855f7', '#3b82f6', '#22c55e', '#f59e0b', '#ffffff', '#111827'],
  shirt: ['#fbcfe8', '#bfdbfe', '#ddd6fe', '#bbf7d0', '#fde68a', '#fecaca', '#ffffff', '#1f2937'],
  bg: ['#ffe4f1', '#e0f2fe', '#ede9fe', '#dcfce7', '#fef9c3', '#ffedd5', '#fce7f3', '#1e1b4b'],
  eyes: [['round', 'Redondos'], ['happy', 'Felices'], ['sparkle', 'Brillantes'], ['sleepy', 'Dormilona']],
  bow: [['classic', 'Clásico'], ['round', 'Redondo'], ['none', 'Sin lazo']],
  bowPos: [['left', 'Izquierda'], ['center', 'Centro'], ['right', 'Derecha']],
  acc: [['none', 'Nada'], ['glasses', 'Lentes'], ['flower', 'Flor'], ['star', 'Estrella'], ['headphones', 'Audífonos']]
};

export function defaultAvatar() {
  return {
    name: 'Mi gatita',
    fur: '#fff4e0',
    eyes: 'round',
    bow: 'classic',
    bowColor: '#ec4899',
    bowPos: 'right',
    acc: 'none',
    shirt: '#fbcfe8',
    bg: '#ffe4f1',
    blush: true,
    whiskers: true
  };
}

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const pickV = (arr) => pick(arr)[0];

export function randomAvatar(prev = {}) {
  return {
    ...defaultAvatar(),
    name: prev.name || 'Mi gatita',
    fur: pick(OPTS.fur),
    eyes: pickV(OPTS.eyes),
    bow: pickV(OPTS.bow.slice(0, 2)),
    bowColor: pick(OPTS.bowColor),
    bowPos: pickV(OPTS.bowPos),
    acc: pickV(OPTS.acc),
    shirt: pick(OPTS.shirt),
    bg: pick(OPTS.bg),
    blush: Math.random() > 0.2,
    whiskers: Math.random() > 0.2
  };
}

const OUT = '#5b2a47';
let uid = 0;

function eyesSvg(style) {
  const y = 102, lx = 76, rx = 124;
  switch (style) {
    case 'happy':
      return `<path d="M${lx - 8} ${y + 3} Q${lx} ${y - 9} ${lx + 8} ${y + 3}" fill="none" stroke="${OUT}" stroke-width="3.5" stroke-linecap="round"/>` +
             `<path d="M${rx - 8} ${y + 3} Q${rx} ${y - 9} ${rx + 8} ${y + 3}" fill="none" stroke="${OUT}" stroke-width="3.5" stroke-linecap="round"/>`;
    case 'sparkle':
      return `<circle cx="${lx}" cy="${y}" r="9" fill="${OUT}"/><circle cx="${rx}" cy="${y}" r="9" fill="${OUT}"/>` +
             `<circle cx="${lx + 3}" cy="${y - 3.5}" r="3.2" fill="#fff"/><circle cx="${rx + 3}" cy="${y - 3.5}" r="3.2" fill="#fff"/>` +
             `<circle cx="${lx - 3}" cy="${y + 3}" r="1.5" fill="#fff"/><circle cx="${rx - 3}" cy="${y + 3}" r="1.5" fill="#fff"/>`;
    case 'sleepy':
      return `<path d="M${lx - 8} ${y} Q${lx} ${y + 8} ${lx + 8} ${y}" fill="none" stroke="${OUT}" stroke-width="3.5" stroke-linecap="round"/>` +
             `<path d="M${rx - 8} ${y} Q${rx} ${y + 8} ${rx + 8} ${y}" fill="none" stroke="${OUT}" stroke-width="3.5" stroke-linecap="round"/>`;
    default:
      return `<circle cx="${lx}" cy="${y}" r="7" fill="${OUT}"/><circle cx="${rx}" cy="${y}" r="7" fill="${OUT}"/>` +
             `<circle cx="${lx + 2.5}" cy="${y - 2.5}" r="2.4" fill="#fff"/><circle cx="${rx + 2.5}" cy="${y - 2.5}" r="2.4" fill="#fff"/>`;
  }
}

function bowSvg(c) {
  if (c.bow === 'none') return '';
  const [x, y] = { left: [66, 50], center: [100, 40], right: [134, 50] }[c.bowPos] || [134, 50];
  const rot = c.bowPos === 'left' ? -18 : c.bowPos === 'right' ? 18 : 0;
  const col = c.bowColor;
  const loops = c.bow === 'round'
    ? `<circle cx="-15" cy="0" r="12" fill="${col}" stroke="${OUT}" stroke-width="2.5"/><circle cx="15" cy="0" r="12" fill="${col}" stroke="${OUT}" stroke-width="2.5"/>`
    : `<polygon points="0,0 -27,-15 -27,15" fill="${col}" stroke="${OUT}" stroke-width="2.5" stroke-linejoin="round"/><polygon points="0,0 27,-15 27,15" fill="${col}" stroke="${OUT}" stroke-width="2.5" stroke-linejoin="round"/>`;
  return `<g transform="translate(${x} ${y}) rotate(${rot})">${loops}<circle r="7" fill="${col}" stroke="${OUT}" stroke-width="2.5"/><circle cx="-2" cy="-2" r="2" fill="#fff" opacity=".6"/></g>`;
}

function accSvg(c) {
  const y = 102, lx = 76, rx = 124;
  const opposite = c.bowPos === 'right' ? 66 : 134;
  switch (c.acc) {
    case 'glasses':
      return `<g fill="rgba(255,255,255,.28)" stroke="${OUT}" stroke-width="3"><circle cx="${lx}" cy="${y}" r="16"/><circle cx="${rx}" cy="${y}" r="16"/></g>` +
             `<path d="M${lx + 16} ${y} L${rx - 16} ${y}" stroke="${OUT}" stroke-width="3"/>`;
    case 'flower': {
      const petals = [0, 72, 144, 216, 288].map((a) => {
        const dx = Math.cos((a * Math.PI) / 180) * 9, dy = Math.sin((a * Math.PI) / 180) * 9;
        return `<circle cx="${(opposite + dx).toFixed(1)}" cy="${(50 + dy).toFixed(1)}" r="7" fill="#fff" stroke="${OUT}" stroke-width="2"/>`;
      }).join('');
      return `${petals}<circle cx="${opposite}" cy="50" r="5" fill="#fbbf24" stroke="${OUT}" stroke-width="2"/>`;
    }
    case 'star':
      return `<polygon transform="translate(${opposite} 50)" points="0,-14 4,-5 14,-4 6,3 9,13 0,8 -9,13 -6,3 -14,-4 -4,-5" fill="#fde047" stroke="${OUT}" stroke-width="2.5" stroke-linejoin="round"/>`;
    case 'headphones':
      return `<path d="M36 104 Q36 34 100 34 Q164 34 164 104" fill="none" stroke="#6b7280" stroke-width="9" stroke-linecap="round"/>` +
             `<rect x="24" y="90" width="20" height="34" rx="10" fill="#ec4899" stroke="${OUT}" stroke-width="2.5"/>` +
             `<rect x="156" y="90" width="20" height="34" rx="10" fill="#ec4899" stroke="${OUT}" stroke-width="2.5"/>`;
    default:
      return '';
  }
}

export function buildAvatar(cfg, size = 96) {
  const c = { ...defaultAvatar(), ...(cfg || {}) };
  const id = `avclip${++uid}`;
  const dim = typeof size === 'number' ? `${size}` : size;
  const whiskers = c.whiskers
    ? `<g stroke="${OUT}" stroke-width="2" stroke-linecap="round"><path d="M44 108 L20 102"/><path d="M44 116 L20 118"/><path d="M156 108 L180 102"/><path d="M156 116 L180 118"/></g>`
    : '';
  const blush = c.blush
    ? `<ellipse cx="58" cy="118" rx="11" ry="7" fill="#ff8fb3" opacity=".55"/><ellipse cx="142" cy="118" rx="11" ry="7" fill="#ff8fb3" opacity=".55"/>`
    : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="${dim}" height="${dim}" role="img" aria-label="Avatar de ${String(c.name).replace(/[<>&"]/g, '')}">` +
    `<defs><clipPath id="${id}"><circle cx="100" cy="100" r="100"/></clipPath></defs>` +
    `<g clip-path="url(#${id})">` +
    `<rect width="200" height="200" fill="${c.bg}"/>` +
    `<path d="M30 205 Q34 152 100 150 Q166 152 170 205Z" fill="${c.shirt}" stroke="${OUT}" stroke-width="3"/>` +
    `<polygon points="38,80 50,16 96,52" fill="${c.fur}" stroke="${OUT}" stroke-width="3" stroke-linejoin="round"/>` +
    `<polygon points="162,80 150,16 104,52" fill="${c.fur}" stroke="${OUT}" stroke-width="3" stroke-linejoin="round"/>` +
    `<polygon points="52,66 57,34 80,54" fill="#ffb3cf"/><polygon points="148,66 143,34 120,54" fill="#ffb3cf"/>` +
    `<ellipse cx="100" cy="106" rx="64" ry="52" fill="${c.fur}" stroke="${OUT}" stroke-width="3"/>` +
    `${blush}${eyesSvg(c.eyes)}` +
    `<ellipse cx="100" cy="113" rx="4.5" ry="3.2" fill="#ff7aa5" stroke="${OUT}" stroke-width="1.5"/>` +
    `<path d="M92 121 Q96 127 100 121 Q104 127 108 121" fill="none" stroke="${OUT}" stroke-width="2.6" stroke-linecap="round"/>` +
    `${whiskers}${accSvg(c)}${bowSvg(c)}` +
    `</g></svg>`;
}
