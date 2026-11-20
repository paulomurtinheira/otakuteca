// Estado da app: a lista (sincronizada) e as definições deste aparelho (não sincronizadas).
// Tudo é guardado em localStorage; o sync com o GitHub trata de espelhar a lista.

import { dayStr, clamp } from './util.js';

const DK = 'otk_data_v1';   // a tua lista
const CK = 'otk_cfg_v1';    // definições deste aparelho (inclui o token do GitHub)
const AK = 'otk_air_v1';    // cache dos próximos episódios (não sincroniza)
const RK = 'otk_rel_v1';    // cache das séries: que títulos são da mesma série (não sincroniza)

export const STATUSES = ['WATCHING', 'PLANNED', 'COMPLETED', 'PAUSED', 'DROPPED'];
const LABELS = {
  ANIME: { WATCHING: 'A ver', PLANNED: 'Planeado', COMPLETED: 'Concluído', PAUSED: 'Em pausa', DROPPED: 'Abandonado' },
  MANGA: { WATCHING: 'A ler', PLANNED: 'Planeado', COMPLETED: 'Concluído', PAUSED: 'Em pausa', DROPPED: 'Abandonado' },
};
export const statusLabel = (s, type) => LABELS[type === 'MANGA' ? 'MANGA' : 'ANIME'][s] || s;

function load(k, def) {
  try { const s = localStorage.getItem(k); return s ? JSON.parse(s) : def; } catch { return def; }
}
function save(k, v) {
  try { localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v)); }
  catch (e) { console.warn('Não consegui guardar', k, e); }
}

export function normalize(d) {
  const o = { v: 1, items: {}, deleted: {} };
  if (d && typeof d === 'object') {
    if (d.items && typeof d.items === 'object') o.items = d.items;
    if (d.deleted && typeof d.deleted === 'object') o.deleted = d.deleted;
  }
  return o;
}

export const state = {
  data: normalize(load(DK, null)),
  cfg: {
    repo: '', path: 'otakuteca.json', branch: '', token: '', autoSync: true,
    titleLang: 'romaji', theme: 'dark', lastSync: 0, lastAir: 0, sources: [],
    ...load(CK, {}),
  },
  air: load(AK, {}),
  rel: load(RK, {}),
};

// ---------- eventos ----------
const subs = new Set();
export function subscribe(fn) { subs.add(fn); return () => subs.delete(fn); }
function emit(kind) { for (const f of [...subs]) { try { f(kind); } catch (e) { console.error(e); } } }

/** Uma linha por entrada: os commits no GitHub ficam legíveis. */
export function serialize(data) {
  const keys = Object.keys(data.items).sort();
  const body = keys.map((k) => JSON.stringify(k) + ':' + JSON.stringify(data.items[k])).join(',\n');
  const del = {};
  for (const k of Object.keys(data.deleted).sort()) del[k] = data.deleted[k];
  return `{"v":1,"items":{\n${body}\n},"deleted":${JSON.stringify(del)}}\n`;
}

/** Junta duas listas: por entrada, ganha a alteração mais recente. Apagar também conta. */
export function merge(a, b) {
  const out = { v: 1, items: {}, deleted: {} };
  const keys = new Set([
    ...Object.keys(a.items), ...Object.keys(b.items),
    ...Object.keys(a.deleted || {}), ...Object.keys(b.deleted || {}),
  ]);
  for (const k of keys) {
    const x = a.items[k], y = b.items[k];
    const win = (x?.upd || 0) >= (y?.upd || 0) ? x : y;
    const del = Math.max(a.deleted?.[k] || 0, b.deleted?.[k] || 0);
    if (win && (win.upd || 0) > del) out.items[k] = win;
    else if (del) out.deleted[k] = del;
  }
  return out;
}

function commit() {
  save(DK, serialize(state.data));
  emit('data');
  emit('local');
}

/** Usado pelo sync e pelas importações: substitui tudo sem contar como "edição local". */
export function replaceData(d) {
  state.data = normalize(d);
  save(DK, serialize(state.data));
  emit('data');
}

export function setCfg(p) {
  Object.assign(state.cfg, p);
  save(CK, state.cfg);
  emit('cfg');
}

export function setAir(map) {
  state.air = map;
  save(AK, map);
  emit('data');
}

/** Guarda quais os títulos da mesma série de cada título (cache deste aparelho, não sincroniza). */
export function setRel(map) {
  state.rel = map;
  save(RK, map);
  emit('data');
}

// ---------- leitura ----------
export const keyOf = (type, id) => (type === 'MANGA' ? 'M' : 'A') + id;
export const get = (k) => state.data.items[k];
export const all = () => Object.values(state.data.items);
export const titleOf = (it) => (state.cfg.titleLang === 'english' && it.en ? it.en : it.title);

/** Quantos episódios já saíram (null = não sei). Vem da cache dos próximos episódios. */
export function airedCount(it) {
  if (it.type !== 'ANIME') return null;
  const a = state.air[it.id];
  if (!a) return null;
  if (a.ep) return a.ep - 1;
  if (a.st === 'FINISHED' && a.eps) return a.eps;
  return null;
}
/** Episódios disponíveis e ainda por ver. */
export function unseen(it) {
  if (it.status !== 'WATCHING') return 0;
  const n = airedCount(it);
  return n == null ? 0 : Math.max(0, n - (it.prog || 0));
}

// ---------- escrita ----------
/** Entrada nova (ainda não guardada) a partir dos dados do AniList. */
export function buildItem(media, status = 'PLANNED') {
  const now = Date.now();
  return {
    k: keyOf(media.type, media.id), id: media.id, type: media.type, mal: media.mal || null,
    title: media.title, en: media.en || null, cover: media.cover || null, color: media.color || null,
    banner: media.banner || null, fmt: media.fmt || null, eps: media.eps || 0, dur: media.dur || 0,
    year: media.year || null, genres: media.genres || [], studio: media.studio || null, avg: media.avg || 0,
    status, prog: 0, score: 0, fav: false, note: '', line: '', moods: [], tier: null, rew: 0,
    start: status === 'WATCHING' ? dayStr() : null, end: null, added: now, upd: now, log: {},
  };
}

export function addMedia(media, status = 'PLANNED') {
  const k = keyOf(media.type, media.id);
  if (get(k)) return get(k);
  const it = buildItem(media, status);
  state.data.items[k] = it;
  delete state.data.deleted[k];
  commit();
  return it;
}

export function patch(k, p) {
  const it = get(k);
  if (!it) return;
  Object.assign(it, p);
  it.upd = stamp(it.upd);
  delete state.data.deleted[k];
  commit();
}

/** Hora da alteração. Nunca fica atrás da versão anterior, mesmo que o relógio de outro aparelho esteja adiantado. */
const stamp = (prev = 0) => Math.max(Date.now(), prev + 1);

export function remove(k) {
  const old = state.data.items[k];
  delete state.data.items[k];
  state.data.deleted[k] = stamp(old?.upd);
  commit();
  return old;
}

/** Repõe uma entrada apagada (botão "Anular"). */
export function restore(it) {
  it.upd = stamp(Math.max(it.upd, state.data.deleted[it.k] || 0));
  state.data.items[it.k] = it;
  delete state.data.deleted[it.k];
  commit();
}

export function setStatus(k, s) {
  const it = get(k);
  if (!it) return;
  const p = { status: s };
  const today = dayStr();
  if (s === 'WATCHING' && !it.start) p.start = today;
  if (s === 'COMPLETED') {
    if (!it.start) p.start = today;
    p.end = today;
    if (it.eps && it.prog < it.eps) {
      logDelta(it, p, it.eps - it.prog);
      p.prog = it.eps;
    }
  } else if (it.status === 'COMPLETED') p.end = null;
  patch(k, p);
}

function logDelta(it, p, d) {
  const log = { ...(p.log || it.log || {}) };
  const day = dayStr();
  const v = (log[day] || 0) + d;
  if (v > 0) log[day] = v; else delete log[day];
  p.log = log;
}

/** Mexe no progresso e regista o dia (alimenta o calendário de atividade e a retrospetiva). */
export function setProgress(k, n) {
  const it = get(k);
  if (!it) return;
  const max = it.eps || Infinity;
  n = clamp(Math.round(n), 0, max);
  const d = n - it.prog;
  if (!d) return;
  const p = { prog: n };
  logDelta(it, p, d);
  const today = dayStr();
  if (it.eps && n >= it.eps) {
    p.status = 'COMPLETED';
    p.end = it.end || today;
    if (!it.start) p.start = today;
  } else if (n > 0 && it.status === 'PLANNED') {
    p.status = 'WATCHING';
    p.start = it.start || today;
  } else if (it.status === 'COMPLETED' && it.eps && n < it.eps) {
    p.status = 'WATCHING';
    p.end = null;
  }
  patch(k, p);
}

/** Importações: junta várias entradas de uma vez (uma única gravação). */
export function importItems(list, { overwrite = false } = {}) {
  let added = 0, updated = 0, kept = 0;
  for (const it of list) {
    const old = get(it.k);
    if (old && !overwrite) { kept++; continue; }
    state.data.items[it.k] = it;
    delete state.data.deleted[it.k];
    old ? updated++ : added++;
  }
  if (added || updated) commit();
  return { added, updated, kept };
}

/** Junta uma cópia de segurança à lista atual (não apaga nada do que já tens). */
export function mergeIn(d) {
  const before = Object.keys(state.data.items).length;
  state.data = merge(state.data, normalize(d));
  commit();
  return Object.keys(state.data.items).length - before;
}

export function wipeLocal() {
  state.data = normalize(null);
  save(DK, serialize(state.data));
  emit('data');
  emit('local');
}
