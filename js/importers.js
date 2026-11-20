// Trazer listas de fora: AniList (por nome de utilizador) e MyAnimeList (ficheiro XML de exportação).

import { buildItem, importItems, keyOf } from './store.js';
import { toItem, userList, byMalIds } from './anilist.js';

const ymd = (d) => (d && d.year ? `${d.year}-${String(d.month || 1).padStart(2, '0')}-${String(d.day || 1).padStart(2, '0')}` : null);

function finish(it) {
  if (it.status === 'COMPLETED' && it.eps && it.prog < it.eps) it.prog = it.eps;
  return it;
}

export async function importAniList(name, onStatus = () => {}) {
  const map = { CURRENT: 'WATCHING', REPEATING: 'WATCHING', PLANNING: 'PLANNED', COMPLETED: 'COMPLETED', PAUSED: 'PAUSED', DROPPED: 'DROPPED' };
  const out = [];
  for (const type of ['ANIME', 'MANGA']) {
    onStatus(`A ler a lista de ${type === 'ANIME' ? 'anime' : 'manga'} de ${name}…`);
    let entries;
    try { entries = await userList(name, type); }
    catch (e) {
      if (/not found/i.test(e.message) || e.status === 404) throw new Error(`Não encontrei o utilizador "${name}" no AniList (ou a lista é privada).`);
      throw e;
    }
    for (const e of entries) {
      const it = buildItem(toItem(e.media), map[e.status] || 'PLANNED');
      Object.assign(it, {
        prog: e.progress || 0, score: e.score || 0, rew: e.repeat || 0, note: e.notes || '',
        start: ymd(e.startedAt), end: ymd(e.completedAt),
      });
      out.push(finish(it));
    }
  }
  return importItems(out);
}

const MAL_STATUS = (s, type) => {
  s = String(s).toLowerCase();
  if (s === '1' || s.startsWith('watching') || s.startsWith('reading')) return 'WATCHING';
  if (s === '2' || s.startsWith('completed')) return 'COMPLETED';
  if (s === '3' || s.startsWith('on-hold') || s.startsWith('on hold')) return 'PAUSED';
  if (s === '4' || s.startsWith('dropped')) return 'DROPPED';
  return 'PLANNED';
};
const malDate = (s) => (s && !s.startsWith('0000') ? s.replace(/-00/g, '-01') : null);

export async function importMal(file, onStatus = () => {}) {
  let text;
  if (file.name.endsWith('.gz')) {
    if (!('DecompressionStream' in window)) throw new Error('Este browser não consegue abrir .gz. Descomprime o ficheiro e escolhe o .xml.');
    text = await new Response(file.stream().pipeThrough(new DecompressionStream('gzip'))).text();
  } else text = await file.text();

  const doc = new DOMParser().parseFromString(text, 'text/xml');
  if (doc.querySelector('parsererror')) throw new Error('Isto não parece um ficheiro de exportação do MyAnimeList.');
  const animeNodes = [...doc.querySelectorAll('myanimelist > anime')];
  const mangaNodes = [...doc.querySelectorAll('myanimelist > manga')];
  if (!animeNodes.length && !mangaNodes.length) throw new Error('Não encontrei anime nem manga neste ficheiro.');

  const out = [];
  for (const [type, nodes] of [['ANIME', animeNodes], ['MANGA', mangaNodes]]) {
    if (!nodes.length) continue;
    const idTag = type === 'ANIME' ? 'series_animedb_id' : 'manga_mangadb_id';
    const get = (n, tag) => n.getElementsByTagName(tag)[0]?.textContent?.trim() || '';
    const rows = nodes.map((n) => ({
      id: +get(n, idTag),
      status: MAL_STATUS(get(n, 'my_status'), type),
      prog: +get(n, type === 'ANIME' ? 'my_watched_episodes' : 'my_read_chapters') || 0,
      score: +get(n, 'my_score') || 0,
      start: malDate(get(n, 'my_start_date')), end: malDate(get(n, 'my_finish_date')),
      rew: +get(n, type === 'ANIME' ? 'my_times_watched' : 'my_times_read') || 0,
      note: get(n, 'my_comments'),
    })).filter((r) => r.id);
    onStatus(`A procurar ${rows.length} ${type === 'ANIME' ? 'anime' : 'manga'} no AniList…`);
    const media = new Map((await byMalIds(rows.map((r) => r.id), type)).map((m) => [m.idMal, m]));
    for (const r of rows) {
      const m = media.get(r.id);
      if (!m) continue;
      const it = buildItem(toItem(m), r.status);
      Object.assign(it, { prog: r.prog, score: r.score, rew: r.rew, note: r.note, start: r.start, end: r.end });
      out.push(finish(it));
    }
  }
  const res = importItems(out);
  return { ...res, skipped: animeNodes.length + mangaNodes.length - out.length };
}
