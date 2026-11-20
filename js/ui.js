// Componentes reutilizáveis: ícones, avisos, folhas (modais), cartões de poster.

import { h, $ } from './util.js';
import { get, keyOf, titleOf, addMedia, remove, setProgress, unseen, statusLabel, restore } from './store.js';
import { openDetail } from './views/detail.js';
import { addRestOfSeries } from './series.js';

const NS = 'http://www.w3.org/2000/svg';
const P = {
  grid: '<rect x="3.5" y="3.5" width="7" height="7" rx="2"/><rect x="13.5" y="3.5" width="7" height="7" rx="2"/><rect x="3.5" y="13.5" width="7" height="7" rx="2"/><rect x="13.5" y="13.5" width="7" height="7" rx="2"/>',
  compass: '<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  chart: '<path d="M5 20V11M12 20V4M19 20v-6"/>',
  more: '<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>',
  tiers: '<rect x="3" y="4" width="18" height="4" rx="1.2"/><rect x="3" y="10" width="13" height="4" rx="1.2"/><rect x="3" y="16" width="8" height="4" rx="1.2"/>',
  sparkle: '<path d="M12 3l2.2 5.8L20 11l-5.8 2.2L12 19l-2.2-5.8L4 11l5.8-2.2z"/>',
  dice: '<rect x="4" y="4" width="16" height="16" rx="4"/><circle cx="9" cy="9" r="1"/><circle cx="15" cy="15" r="1"/><circle cx="15" cy="9" r="1"/><circle cx="9" cy="15" r="1"/>',
  sliders: '<path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/>',
  cloud: '<path d="M7 18a4 4 0 010-8 5.5 5.5 0 0110.6 1.5A3.3 3.3 0 0117 18z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  heart: '<path d="M12 20s-7-4.4-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.6-7 10-7 10z"/>',
  star: '<path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 16.9 6.8 19.7l1-5.9L3.5 9.7l5.9-.8z"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
  play: '<path d="M8 5l11 7-11 7z"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
  link: '<path d="M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
  refresh: '<path d="M20 12a8 8 0 11-2.3-5.7M20 4v5h-5"/>',
  download: '<path d="M12 4v11M7 11l5 5 5-5M5 20h14"/>',
  upload: '<path d="M12 16V5M7 9l5-5 5 5M5 20h14"/>',
  trophy: '<path d="M8 4h8v5a4 4 0 01-8 0zM8 6H4v1a4 4 0 004 4M16 6h4v1a4 4 0 01-4 4M12 13v4M8 20h8M10 17h4"/>',
  list: '<path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"/>',
  share: '<path d="M12 4v11M8 8l4-4 4 4M5 13v6h14v-6"/>',
  chevron: '<path d="M9 5l7 7-7 7"/>',
};
export function icon(name, size = 22) {
  const s = document.createElementNS(NS, 'svg');
  s.setAttribute('viewBox', '0 0 24 24');
  s.setAttribute('width', size);
  s.setAttribute('height', size);
  s.setAttribute('fill', 'none');
  s.setAttribute('stroke', 'currentColor');
  s.setAttribute('stroke-width', '2');
  s.setAttribute('stroke-linecap', 'round');
  s.setAttribute('stroke-linejoin', 'round');
  s.setAttribute('aria-hidden', 'true');
  s.innerHTML = P[name] || '';
  return s;
}

export function toast(msg, opt = {}) {
  const box = $('#toasts');
  const rm = () => { t.classList.add('out'); setTimeout(() => t.remove(), 250); };
  const t = h('div', { class: 'toast' },
    h('span', null, msg),
    opt.undo ? h('button', { onclick() { opt.undo(); rm(); } }, 'Anular') : null);
  box.append(t);
  setTimeout(rm, opt.ms || 3800);
}

export function coverImg(it, cls = '') {
  const im = h('img', { src: it.cover || '', alt: '', loading: 'lazy', decoding: 'async', referrerPolicy: 'no-referrer', class: cls });
  im.onerror = () => { im.style.visibility = 'hidden'; };
  return im;
}

/** Folha deslizante (ecrã inteiro no telemóvel, janela no PC). */
export function openSheet({ small = false } = {}) {
  const layer = $('#layer');
  const back = h('div', { class: 'backdrop' });
  const panel = h('div', { class: 'sheet' + (small ? ' small' : ''), role: 'dialog', 'aria-modal': 'true' });
  const body = h('div', { class: 'sheet-body' });
  panel.append(body);
  layer.append(back, panel);
  document.body.classList.add('lock');
  requestAnimationFrame(() => requestAnimationFrame(() => { back.classList.add('in'); panel.classList.add('in'); }));
  let closed = false;
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  function close() {
    if (closed) return;
    closed = true;
    document.removeEventListener('keydown', onKey);
    back.classList.remove('in');
    panel.classList.remove('in');
    setTimeout(() => {
      back.remove();
      panel.remove();
      if (!layer.querySelector('.sheet')) document.body.classList.remove('lock');
    }, 240);
  }
  back.onclick = close;
  return { panel, body, close };
}

function quickAdd(it) {
  const k = keyOf(it.type, it.id);
  const wrap = h('span', { class: 'qa' });
  const paint = () => {
    wrap.replaceChildren();
    const mine = get(k);
    if (mine) {
      wrap.append(h('button', { class: 'qbtn done st-' + mine.status, title: statusLabel(mine.status, mine.type), onclick: (e) => { e.stopPropagation(); openDetail(mine); } }, icon('check', 15)));
    } else {
      wrap.append(h('button', {
        class: 'qbtn', title: 'Adicionar a Planeado',
        onclick(e) {
          e.stopPropagation();
          addMedia(it, 'PLANNED');
          toast('Adicionado a Planeado', { undo() { remove(k); paint(); } });
          paint();
          // e as outras temporadas e filmes da série, para depois marcares o que já viste
          addRestOfSeries(it).then((keys) => { if (keys.length) toast(`+${keys.length} temporadas e filmes da série`, { undo() { keys.forEach(remove); } }); });
        },
      }, icon('plus', 16)));
    }
  };
  paint();
  return wrap;
}

/**
 * Cartão de poster.
 *  lib: modo "a minha lista" (progresso, +1, novos episódios)
 *  sub: texto por baixo do título (senão mostra formato/ano)
 */
export function card(it, { lib = false, sub = null, plain = false } = {}) {
  // Numa série agrupada (só na Lista), `it` junta as temporadas e `it.cur` é a que estás a ver.
  const group = !!it.cur;
  const k = keyOf(it.type, it.id);
  const mine = it.cur || get(k);
  const src = group ? it : (mine || it);
  const cov = h('div', { class: 'cover' }, coverImg(src));

  const score = group ? it.score : mine?.score;
  if (score > 0) cov.append(h('span', { class: 'chip score' }, '★ ' + score));
  if (it.parts) cov.append(h('span', { class: 'chip parts' }, it.parts.length + ' partes'));
  if (lib) {
    const nu = group ? it.parts.reduce((s, p) => s + unseen(p), 0) : unseen(mine);
    if (nu > 0) cov.append(h('span', { class: 'chip new' }, '+' + nu));
    if (group ? it.fav : mine.fav) cov.append(h('span', { class: 'fav' }, icon('heart', 14)));
    if (mine.eps && ['WATCHING', 'PAUSED'].includes(mine.status))
      cov.append(h('div', { class: 'bar' }, h('i', { style: { width: Math.min(100, (mine.prog / mine.eps) * 100) + '%' } })));
    if (mine.status === 'WATCHING' && (!mine.eps || mine.prog < mine.eps)) {
      cov.append(h('button', {
        class: 'plus1', title: 'Vi mais um',
        onclick(e) {
          e.stopPropagation();
          setProgress(mine.k, mine.prog + 1);
        },
      }, '+1'));
    }
  } else if (!plain) {
    cov.append(quickAdd(it));
  }

  let subtitle = sub;
  if (subtitle == null) {
    if (lib) {
      const t = group ? it : mine;
      subtitle = t.eps ? `${t.prog}/${t.eps}` : `${t.prog} ${mine.type === 'MANGA' ? 'cap.' : 'ep.'}`;
    } else {
      subtitle = [it.fmt && it.fmt.replace('_', ' '), it.year, it.avg ? '★ ' + (it.avg / 10).toFixed(1) : null].filter(Boolean).join(' · ');
    }
  }
  return h('div', { class: 'card', style: { '--c': src.color || '#7c6cf0' }, onclick: () => openDetail(mine && group ? mine : src, it.parts) },
    cov,
    h('div', { class: 'ct' }, titleOf(src)),
    h('div', { class: 'cs' }, subtitle));
}

export function emptyState(emoji, title, text, actions = []) {
  return h('div', { class: 'empty' },
    h('div', { class: 'empty-e' }, emoji),
    h('h3', null, title),
    h('p', null, text),
    h('div', { class: 'row center' }, actions.map((a) => h('button', { class: 'btn ' + (a.primary ? 'primary' : ''), onclick: a.onClick }, a.label))));
}

export function seg(options, value, onChange, cls = '') {
  const el = h('div', { class: 'seg ' + cls });
  const paint = (v) => {
    el.replaceChildren(...options.map(([val, label]) =>
      h('button', { class: val === v ? 'on' : '', onclick: () => { paint(val); onChange(val); } }, label)));
  };
  paint(value);
  return el;
}

export function skeletons(n = 8) {
  return h('div', { class: 'grid' }, Array.from({ length: n }, () => h('div', { class: 'card sk' }, h('div', { class: 'cover' }), h('div', { class: 'ct' }, ' '))));
}

export function confirmSheet({ title, text, ok = 'Confirmar', danger = false, onOk }) {
  const sh = openSheet({ small: true });
  sh.body.append(
    h('div', { class: 'pad' },
      h('h3', null, title),
      h('p', { class: 'muted' }, text),
      h('div', { class: 'row end gap' },
        h('button', { class: 'btn', onclick: sh.close }, 'Cancelar'),
        h('button', { class: 'btn ' + (danger ? 'danger' : 'primary'), onclick() { sh.close(); onOk(); } }, ok))));
}
export { restore };
