// Tema de cada anime: a cor da capa (AniList) dá o tom da folha de detalhe, em escuro e em claro.

import { state } from './store.js';

/** A app está agora em modo escuro? (tem em conta o "Automático") */
export function isDark() {
  const t = state.cfg.theme;
  return t === 'dark' || (t === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
}

function hueSat(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  if (!m) return null;
  const n = parseInt(m[1], 16);
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  if (!d) return { h: 262, s: 0.5 }; // capas cinzentas: roxo da app
  let hue = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  hue = (hue * 60 + 360) % 360;
  const l = (mx + mn) / 2;
  return { h: hue, s: d / (1 - Math.abs(2 * l - 1)) };
}

const hsl = (h, s, l) => `hsl(${Math.round(((h % 360) + 360) % 360)} ${Math.round(s)}% ${Math.round(l)}%)`;

/** As variáveis CSS do tema de um anime ({} se não tiver cor). `dark` escolhe a versão escura ou clara. */
export function animeTheme(color, dark) {
  const c = hueSat(color);
  if (!c) return {};
  const { h } = c;
  const s = Math.max(45, Math.min(88, c.s * 100)); // cor viva, mas nunca fluorescente nem cinzenta
  const accent = dark ? hsl(h, s, 64) : hsl(h, s, 40);
  const accent2 = dark ? hsl(h + 38, s, 66) : hsl(h + 38, s, 44);
  const v = dark ? {
    '--bg': hsl(h, 32, 8), '--bg2': hsl(h, 30, 11), '--panel': hsl(h, 27, 14), '--panel2': hsl(h, 25, 19), '--line': hsl(h, 22, 26),
    '--text': hsl(h, 25, 95), '--muted': hsl(h, 14, 68),
  } : {
    '--bg': hsl(h, 55, 96), '--bg2': hsl(h, 45, 93), '--panel': hsl(h, 40, 99), '--panel2': hsl(h, 45, 94), '--line': hsl(h, 32, 85),
    '--text': hsl(h, 40, 12), '--muted': hsl(h, 14, 38),
  };
  return {
    ...v, '--accent': accent, '--accent2': accent2,
    '--grad': `linear-gradient(135deg, ${accent}, ${accent2})`,
    'color-scheme': dark ? 'dark' : 'light',
  };
}

/** Aplica (ou tira) o tema de um anime a um elemento. */
export function paintTheme(el, color, dark) {
  const old = el.dataset.themed ? el.dataset.themed.split(',') : [];
  for (const k of old) el.style.removeProperty(k);
  el.dataset.themed = '';
  if (state.cfg.animeTheme === false) return;
  const vars = animeTheme(color || '#8b5cf6', dark); // sem cor na capa: o roxo da app
  for (const [k, v] of Object.entries(vars)) el.style.setProperty(k, v);
  el.dataset.themed = Object.keys(vars).join(',');
}
