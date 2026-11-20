// Séries: juntar na lista as temporadas, filmes e especiais da mesma série (ex.: Naruto + Naruto Shippuden).
// Cada temporada continua a ter o seu estado, progresso e nota; só a vista da Lista as mostra como um só cartão.

import { state, all, setRel } from './store.js';
import { seriesLinks } from './anilist.js';

let busy = false, failedAt = 0;

/** Vai buscar ao AniList as ligações dos títulos da lista que ainda não conhecemos. Devolve true se guardou algo. */
export async function ensureRelations() {
  if (busy || Date.now() - failedAt < 5 * 60e3) return false;
  const missing = all().map((i) => i.id).filter((id) => !(id in state.rel));
  if (!missing.length) return false;
  busy = true;
  try {
    const got = await seriesLinks([...new Set(missing)]);
    setRel({ ...state.rel, ...got });
    return true;
  } catch (e) {
    failedAt = Date.now();
    console.warn('Não consegui juntar as séries:', e.message);
    return false;
  } finally {
    busy = false;
  }
}

const PRIORITY = ['WATCHING', 'PAUSED', 'PLANNED', 'COMPLETED', 'DROPPED'];
const chrono = (a, b) => (a.year || 9999) - (b.year || 9999) || a.id - b.id;

/**
 * Devolve uma entrada por série. Um título sozinho continua a ser o próprio item.
 * Uma série com várias partes é um item "virtual": aspeto do primeiro título (Naruto),
 * `cur` = a parte que estás a ver, e estado, progresso e atividade somados.
 */
export function groupLibrary(items) {
  const up = new Map();
  const find = (x) => {
    if (!up.has(x)) up.set(x, x);
    while (up.get(x) !== x) { up.set(x, up.get(up.get(x))); x = up.get(x); }
    return x;
  };
  for (const i of items) {
    for (const r of state.rel[i.id] || []) up.set(find(i.id), find(r));
  }
  const groups = new Map();
  for (const i of items) {
    const r = find(i.id);
    if (!groups.has(r)) groups.set(r, []);
    groups.get(r).push(i);
  }

  const out = [];
  const done = new Set();
  for (const i of items) {
    const r = find(i.id);
    if (done.has(r)) continue;
    done.add(r);
    const parts = groups.get(r).slice().sort(chrono);
    if (parts.length === 1) { out.push(parts[0]); continue; }

    const status = PRIORITY.find((s) => parts.some((p) => p.status === s));
    const cur = parts.find((p) => p.status === 'WATCHING') || parts.find((p) => p.status === 'PAUSED')
      || parts.find((p) => p.status === 'PLANNED') || parts[parts.length - 1];
    const rated = parts.filter((p) => p.score > 0);
    out.push({
      ...parts[0],
      parts, cur, status,
      upd: Math.max(...parts.map((p) => p.upd)),
      added: Math.min(...parts.map((p) => p.added)),
      fav: parts.some((p) => p.fav),
      score: rated.length ? Math.round((rated.reduce((s, p) => s + p.score, 0) / rated.length) * 10) / 10 : 0,
      prog: parts.reduce((s, p) => s + p.prog, 0),
      eps: parts.every((p) => p.eps) ? parts.reduce((s, p) => s + p.eps, 0) : 0,
    });
  }
  return out;
}
