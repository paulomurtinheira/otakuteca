// Descobrir: pesquisa, em alta, temporada e recomendações feitas com base nos teus favoritos.

import { h, clear, debounce } from '../util.js';
import { all, get, keyOf, titleOf } from '../store.js';
import { browse, GENRES, currentSeason, recommendFrom } from '../anilist.js';
import { card, emptyState, seg, skeletons } from '../ui.js';

const st = { mode: 'trending', type: 'ANIME', q: '', genre: '' };
let forYouCache = null;

const SEASON_PT = { WINTER: 'Inverno', SPRING: 'Primavera', SUMMER: 'Verão', FALL: 'Outono' };

export function mount(root) {
  const results = h('div');
  const more = h('div', { class: 'row center' });
  const chips = h('div', { class: 'tabs' });
  let items = [], page = 1, hasMore = false, ticket = 0;

  const sea = currentSeason();
  const modes = () => [
    ['foryou', '✨ Para ti'],
    ['trending', '🔥 Em alta'],
    ...(st.type === 'ANIME' ? [['season', `🌸 ${SEASON_PT[sea.season]} ${sea.year}`]] : []),
    ['popular', '👥 Populares'],
    ['top', '🏆 Melhor avaliados'],
  ];

  const input = h('input', {
    class: 'field search', type: 'search', placeholder: 'Procurar anime ou manga…', value: st.q,
    oninput: debounce((e) => { st.q = e.target.value.trim(); load(true); paintChips(); }, 400),
    onkeydown(e) { if (e.key === 'Enter') { st.q = e.target.value.trim(); load(true); paintChips(); } },
  });
  const genreSel = h('select', { class: 'field sel', onchange(e) { st.genre = e.target.value; load(true); } },
    h('option', { value: '' }, 'Todos os géneros'),
    GENRES.map((g) => h('option', { value: g, selected: g === st.genre }, g)));

  root.append(
    h('div', { class: 'head' }, h('h1', null, 'Descobrir'),
      seg([['ANIME', 'Anime'], ['MANGA', 'Manga']], st.type, (v) => {
        st.type = v;
        if (v === 'MANGA' && st.mode === 'season') st.mode = 'trending';
        forYouCache = null;
        paintChips(); load(true);
      })),
    h('div', { class: 'toolbar' }, input, genreSel),
    chips, results, more);

  function paintChips() {
    clear(chips);
    if (st.q) { chips.append(h('span', { class: 'muted small' }, `Resultados para "${st.q}"`)); return; }
    chips.append(...modes().map(([m, l]) => h('button', { class: 'tab' + (st.mode === m ? ' on' : ''), onclick() { st.mode = m; paintChips(); load(true); } }, l)));
  }

  async function load(reset) {
    const my = ++ticket;
    if (reset) { page = 1; items = []; clear(results).append(skeletons(10)); clear(more); }
    genreSel.style.display = !st.q && st.mode === 'foryou' ? 'none' : '';

    try {
      if (!st.q && st.mode === 'foryou') { await forYou(my); return; }
      const args = { type: st.type, search: st.q, genre: st.genre, page };
      if (!st.q) {
        if (st.mode === 'season') Object.assign(args, { season: sea.season, year: sea.year, sort: 'POPULARITY_DESC' });
        else args.sort = { trending: 'TRENDING_DESC', popular: 'POPULARITY_DESC', top: 'SCORE_DESC' }[st.mode];
      }
      const r = await browse(args);
      if (my !== ticket) return;
      items = items.concat(r.items);
      hasMore = r.more;
      paint();
    } catch (e) {
      if (my !== ticket) return;
      clear(results).append(emptyState('📡', 'Não consegui carregar', e.message, [{ label: 'Tentar outra vez', primary: true, onClick: () => load(true) }]));
    }
  }

  function paint() {
    clear(results);
    if (!items.length) { results.append(emptyState('🤷', 'Sem resultados', 'Experimenta outra pesquisa ou género.')); clear(more); return; }
    results.append(h('div', { class: 'grid' }, items.map((i) => card(i))));
    clear(more);
    if (hasMore) more.append(h('button', { class: 'btn', onclick() { page++; load(false); } }, 'Carregar mais'));
  }

  async function forYou(my) {
    const seeds = all().filter((i) => i.type === st.type && i.score >= 8).sort((a, b) => b.score - a.score || b.upd - a.upd).slice(0, 6);
    if (seeds.length < 2) {
      clear(results).append(emptyState('✨', 'Ainda te estou a conhecer',
        'Dá nota (8 ou mais) a pelo menos 2 títulos que adoraste e eu descubro o que vais gostar a seguir.',
        [{ label: 'Ver o que está em alta', primary: true, onClick: () => { st.mode = 'trending'; paintChips(); load(true); } }]));
      return;
    }
    if (!forYouCache || forYouCache.type !== st.type || forYouCache.n !== all().length) {
      const owned = new Set(all().map((i) => i.k));
      forYouCache = { type: st.type, n: all().length, list: await recommendFrom(seeds, owned) };
    }
    if (my !== ticket) return;
    clear(results);
    if (!forYouCache.list.length) { results.append(emptyState('🤷', 'Sem sugestões novas', 'Já tens quase tudo o que eu sugeriria!')); return; }
    results.append(
      h('p', { class: 'muted small' }, 'Baseado nos títulos a que deste nota alta. O motivo vem por baixo de cada um.'),
      h('div', { class: 'grid' }, forYouCache.list.map(({ item, from }) =>
        card(item, { sub: 'Porque gostaste de ' + titleOf(from[0]) }))));
  }

  paintChips();
  load(true);
  return { update() { /* os cartões atualizam-se sozinhos; não refazemos a pesquisa */ } };
}
