// Roleta: não sabes o que ver? Gira.

import { h, clear, shuffle } from '../util.js';
import { all, titleOf, setStatus } from '../store.js';
import { coverImg, icon, seg, emptyState } from '../ui.js';
import { openDetail } from './detail.js';

const f = { type: 'ANIME', len: 'any', genre: '', paused: false };
const CELL = 124; // largura de cada poster + espaço

export function mount(root) {
  const filters = h('div', { class: 'roul-filters' });
  const stage = h('div', { class: 'roul-stage' });
  let spinning = false;

  root.append(h('div', { class: 'head' }, h('h1', null, 'Roleta')),
    h('p', { class: 'muted small' }, 'Escolhe entre o que tens planeado. Filtra pelo género ou pelo tempo que tens e deixa a sorte decidir.'),
    filters, stage);

  function pool() {
    return all().filter((i) => {
      if (i.type !== f.type) return false;
      if (!(i.status === 'PLANNED' || (f.paused && i.status === 'PAUSED'))) return false;
      if (f.genre && !(i.genres || []).includes(f.genre)) return false;
      const e = i.eps || 0;
      if (f.len === 'short') return e > 0 && e <= 13;
      if (f.len === 'mid') return e >= 14 && e <= 26;
      if (f.len === 'long') return e >= 27;
      if (f.len === 'movie') return i.fmt === 'MOVIE';
      return true;
    });
  }

  function paintFilters() {
    const genres = [...new Set(all().filter((i) => i.type === f.type && i.status === 'PLANNED').flatMap((i) => i.genres || []))].sort();
    clear(filters).append(
      seg([['ANIME', 'Anime'], ['MANGA', 'Manga']], f.type, (v) => { f.type = v; f.genre = ''; f.len = 'any'; paintFilters(); showIdle(); }),
      h('div', { class: 'row gap wrap' },
        h('select', { class: 'field sel', onchange(e) { f.len = e.target.value; showIdle(); } },
          [['any', 'Qualquer duração'], ['movie', 'Filme'], ['short', 'Curto (até 13 ep.)'], ['mid', 'Médio (14–26 ep.)'], ['long', 'Longo (27+ ep.)']]
            .filter(([v]) => f.type === 'ANIME' || v === 'any' || v === 'long')
            .map(([v, l]) => h('option', { value: v, selected: v === f.len }, l))),
        h('select', { class: 'field sel', onchange(e) { f.genre = e.target.value; showIdle(); } },
          h('option', { value: '' }, 'Qualquer género'), genres.map((g) => h('option', { value: g, selected: g === f.genre }, g))),
        h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: f.paused, onchange(e) { f.paused = e.target.checked; showIdle(); } }), ' incluir em pausa')));
  }

  function showIdle() {
    clear(stage);
    const p = pool();
    if (!p.length) {
      stage.append(emptyState('🎲', 'Não há nada para sortear', 'Adiciona títulos como "Planeado" (ou afrouxa os filtros).',
        [{ label: 'Descobrir', primary: true, onClick: () => (location.hash = '#/discover') }]));
      return;
    }
    stage.append(h('div', { class: 'roul-idle' },
      h('div', { class: 'roul-n' }, p.length), h('div', { class: 'muted' }, p.length === 1 ? 'título no sorteio' : 'títulos no sorteio'),
      h('button', { class: 'btn primary big', onclick: spin }, icon('dice', 20), ' Girar!')));
  }

  function spin() {
    if (spinning) return;
    const p = pool();
    if (!p.length) return;
    spinning = true;
    const winner = p[Math.floor(Math.random() * p.length)];
    const N = 46, WIN = 38;
    const cells = [];
    let bag = [];
    for (let i = 0; i < N; i++) {
      if (!bag.length) bag = shuffle(p);
      cells.push(i === WIN ? winner : bag.pop());
    }
    const track = h('div', { class: 'reel-track' }, cells.map((i) => h('div', { class: 'reel-c', style: { '--c': i.color || '#7c6cf0' } }, coverImg(i))));
    const reel = h('div', { class: 'reel' }, track, h('div', { class: 'reel-mark' }));
    clear(stage).append(reel);
    const half = reel.clientWidth / 2;
    const target = WIN * CELL + CELL / 2 - half + (Math.random() - 0.5) * 60;
    track.style.transform = 'translateX(0)';
    requestAnimationFrame(() => requestAnimationFrame(() => {
      track.style.transition = 'transform 4.6s cubic-bezier(.12,.62,.1,1)';
      track.style.transform = `translateX(${-target}px)`;
    }));
    let done = false;
    const end = () => { if (done) return; done = true; spinning = false; result(winner); };
    track.addEventListener('transitionend', end);
    setTimeout(end, 5200);
  }

  function result(i) {
    clear(stage).append(h('div', { class: 'roul-win', style: { '--c': i.color || '#7c6cf0' } },
      h('div', { class: 'win-cover' }, coverImg(i)),
      h('div', { class: 'win-t' }, titleOf(i)),
      h('div', { class: 'meta center' }, [i.fmt && i.fmt.replace('_', ' '), i.year, i.eps ? `${i.eps} ${i.type === 'MANGA' ? 'cap.' : 'ep.'}` : null, i.avg ? '★ ' + (i.avg / 10).toFixed(1) : null].filter(Boolean).map((t) => h('span', null, t))),
      h('div', { class: 'chips center' }, (i.genres || []).slice(0, 4).map((g) => h('span', { class: 'chip-s g' }, g))),
      h('div', { class: 'row gap center wrap' },
        h('button', { class: 'btn primary', onclick() { setStatus(i.k, 'WATCHING'); openDetail(i); } }, icon('play', 16), i.type === 'MANGA' ? ' Começar a ler' : ' Começar a ver'),
        h('button', { class: 'btn', onclick: spin }, icon('refresh', 16), ' Outra vez'),
        h('button', { class: 'btn ghost', onclick: () => openDetail(i) }, 'Detalhe'))));
  }

  paintFilters();
  showIdle();
  return { update() { if (!spinning && stage.querySelector('.roul-idle, .empty')) showIdle(); } };
}
