// A minha lista

import { h, clear } from '../util.js';
import { all, STATUSES, statusLabel, titleOf, unseen } from '../store.js';
import { card, icon, emptyState, seg } from '../ui.js';
import { openDetail } from './detail.js';
import { groupLibrary, ensureRelations } from '../series.js';
import { coverImg } from '../ui.js';

const UK = 'otk_ui_lib';
const ui = { type: 'ANIME', status: 'ALL', q: '', sort: 'upd', mode: 'grid', group: true };
try { Object.assign(ui, JSON.parse(localStorage.getItem(UK) || '{}'), { q: '' }); } catch { /* sem prefs */ }
const saveUi = () => { try { localStorage.setItem(UK, JSON.stringify(ui)); } catch { /* ok */ } };

const SORTS = {
  upd: ['Atividade recente', (a, b) => b.upd - a.upd],
  score: ['Nota', (a, b) => b.score - a.score || b.upd - a.upd],
  title: ['Título', (a, b) => titleOf(a).localeCompare(titleOf(b))],
  prog: ['Progresso', (a, b) => (b.eps ? b.prog / b.eps : 0) - (a.eps ? a.prog / a.eps : 0)],
  year: ['Ano', (a, b) => (b.year || 0) - (a.year || 0)],
  added: ['Adicionado', (a, b) => b.added - a.added],
};

export function mount(root) {
  const grid = h('div');
  const tabs = h('div', { class: 'tabs' });
  const summary = h('div', { class: 'summary' });

  const search = h('input', {
    class: 'field search', type: 'search', placeholder: 'Procurar na tua lista…', value: ui.q,
    oninput(e) { ui.q = e.target.value; paint(); },
  });
  const sortSel = h('select', { class: 'field sel', onchange(e) { ui.sort = e.target.value; saveUi(); paint(); } },
    Object.entries(SORTS).map(([v, [l]]) => h('option', { value: v, selected: v === ui.sort }, l)));
  const groupChk = h('input', { type: 'checkbox', onchange(e) { ui.group = e.target.checked; saveUi(); paint(); } });
  const groupLbl = h('label', { class: 'check', title: 'Mostra as temporadas e filmes da mesma série como um só título' }, groupChk, ' Juntar temporadas');
  const modeBtn = h('button', { class: 'icon-btn', title: 'Mudar vista', onclick() { ui.mode = ui.mode === 'grid' ? 'list' : 'grid'; saveUi(); paint(); } });

  root.append(
    h('div', { class: 'head' },
      h('h1', null, 'A minha lista'),
      seg([['ANIME', 'Anime'], ['MANGA', 'Manga']], ui.type, (v) => { ui.type = v; ui.status = 'ALL'; saveUi(); paint(); })),
    summary,
    h('div', { class: 'toolbar' }, search, sortSel, modeBtn, groupLbl),
    tabs, grid);

  function paint() {
    const raw = all().filter((i) => i.type === ui.type);
    groupChk.checked = ui.group;
    // uma entrada por série (Naruto + Naruto Shippuden = 1); sem agrupar, uma por temporada
    const mine = ui.group ? groupLibrary(raw) : raw;
    const unit = ui.type === 'MANGA' ? 'capítulos' : 'episódios';

    // resumo
    const units = raw.reduce((s, i) => s + i.prog, 0);
    const mins = ui.type === 'ANIME' ? raw.reduce((s, i) => s + i.prog * (i.dur || 24), 0) : 0;
    summary.textContent = mine.length
      ? `${mine.length} ${ui.type === 'ANIME' ? 'anime' : 'manga'}` + (mine.length !== raw.length ? ` (${raw.length} temporadas e filmes)` : '') + ` · ${units} ${unit}` + (mins ? ` · ${(mins / 1440).toFixed(1).replace('.', ',')} dias` : '')
      : '';

    // separadores com contagens
    const count = (s) => (s === 'ALL' ? mine.length : s === 'FAV' ? mine.filter((i) => i.fav).length : mine.filter((i) => i.status === s).length);
    const defs = [['ALL', 'Tudo'], ...STATUSES.map((s) => [s, statusLabel(s, ui.type)]), ['FAV', '♥ Favoritos']];
    clear(tabs).append(...defs.map(([s, l]) =>
      h('button', { class: 'tab' + (ui.status === s ? ' on' : '') + (s !== 'ALL' && s !== 'FAV' ? ' st-' + s : ''), onclick() { ui.status = s; saveUi(); paint(); } },
        l, h('i', null, count(s)))));

    clear(modeBtn).append(icon(ui.mode === 'grid' ? 'list' : 'grid', 20));
    sortSel.value = ui.sort;

    // filtro
    let list = mine;
    if (ui.status === 'FAV') list = list.filter((i) => i.fav);
    else if (ui.status !== 'ALL') list = list.filter((i) => i.status === ui.status);
    if (ui.q.trim()) {
      const q = ui.q.trim().toLowerCase();
      list = list.filter((i) => `${i.title} ${i.en || ''}`.toLowerCase().includes(q));
    }
    list = list.slice().sort(SORTS[ui.sort][1]);

    clear(grid);
    grid.className = '';
    if (!mine.length) {
      grid.append(emptyState('📺', 'A tua lista está vazia', 'Procura um anime para começares, ou traz a tua lista do AniList / MyAnimeList.', [
        { label: 'Procurar anime', primary: true, onClick: () => (location.hash = '#/discover') },
        { label: 'Importar lista', onClick: () => (location.hash = '#/settings/data') },
      ]));
      return;
    }
    if (!list.length) { grid.append(emptyState('🔍', 'Nada aqui', 'Nenhum título com estes filtros.')); return; }

    if (ui.mode === 'grid') {
      grid.className = 'grid';
      grid.append(...list.map((i) => card(i, { lib: true })));
    } else {
      grid.className = 'rows';
      grid.append(...list.map(row));
    }
  }

  const refresh = () => ensureRelations().then((changed) => { if (changed && grid.isConnected) paint(); });
  paint();
  refresh();
  return { update() { paint(); refresh(); } };
}

function row(i) {
  const nu = i.parts ? i.parts.reduce((s, p) => s + unseen(p), 0) : unseen(i);
  return h('div', { class: 'row-item', style: { '--c': i.color || '#7c6cf0' }, onclick: () => openDetail(i.cur || i, i.parts) },
    h('div', { class: 'thumb' }, coverImg(i)),
    h('div', { class: 'ri-main' },
      h('div', { class: 'ri-t' }, titleOf(i), i.parts ? h('small', { class: 'muted' }, `  · ${i.parts.length} partes`) : null),
      h('div', { class: 'ri-s' },
        h('span', { class: 'dot st-' + i.status }), statusLabel(i.status, i.type),
        ' · ', i.eps ? `${i.prog}/${i.eps}` : `${i.prog}`,
        nu ? h('b', { class: 'new-t' }, `  +${nu} novo${nu > 1 ? 's' : ''}`) : null),
      i.eps ? h('div', { class: 'bar flat' }, h('i', { style: { width: Math.min(100, (i.prog / i.eps) * 100) + '%' } })) : null),
    i.score ? h('div', { class: 'ri-score' }, '★ ' + i.score) : null);
}
