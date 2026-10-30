// Construye la carpeta www/ (lo que va dentro de la app y lo que se sube a un hosting web).
import { execSync } from 'node:child_process';
import { cpSync, mkdirSync, rmSync, readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const www = join(root, 'www');
const run = (cmd) => execSync(cmd, { cwd: root, stdio: 'inherit' });

rmSync(www, { recursive: true, force: true });
mkdirSync(join(www, 'fonts'), { recursive: true });

// 1) JavaScript (incluye Firebase, Capacitor y los íconos Lucide)
run(`npx esbuild src/app.js --bundle --minify --format=iife --target=es2020 --outfile=www/app.js --log-level=warning`);

// 2) CSS (Tailwind)
run(`npx tailwindcss -c tailwind.config.cjs -i src/styles.css -o www/app.css --minify`);

// 3) HTML + archivos públicos (manifest, íconos, sw.js)
cpSync(join(root, 'src/index.html'), join(www, 'index.html'));
cpSync(join(root, 'public'), www, { recursive: true });

// 4) Tipografías locales (la app funciona sin internet)
function copyFont(pkg, outName) {
  const dir = join(root, 'node_modules', pkg, 'files');
  if (!existsSync(dir)) { console.warn(`! No encontré la fuente ${pkg}; se usará una tipografía del sistema.`); return; }
  const f = readdirSync(dir).find((n) => /latin-wght-normal\.woff2$/.test(n));
  if (f) cpSync(join(dir, f), join(www, 'fonts', outName));
  else console.warn(`! Archivo de fuente no encontrado en ${pkg}`);
}
copyFont('@fontsource-variable/fredoka', 'fredoka.woff2');
copyFont('@fontsource-variable/inter', 'inter.woff2');

// 5) Service worker con la lista real de archivos
const assets = ['./', './index.html', './app.js', './app.css', './manifest.webmanifest'];
const walk = (d, base = '') => readdirSync(join(www, d), { withFileTypes: true }).forEach((e) => {
  const rel = join(base, e.name);
  if (e.isDirectory()) walk(join(d, e.name), rel);
  else assets.push('./' + join(d, e.name).replace(/\\/g, '/'));
});
['icons', 'fonts'].forEach((d) => existsSync(join(www, d)) && walk(d));
const sw = readFileSync(join(www, 'sw.js'), 'utf8')
  .replace('__VERSION__', Date.now().toString(36))
  .replace('__ASSETS__', JSON.stringify(assets));
writeFileSync(join(www, 'sw.js'), sw);

console.log('\n✔ Listo: carpeta www/ generada');
