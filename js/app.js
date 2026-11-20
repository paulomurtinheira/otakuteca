// Arranque, navegação e ligação de tudo.

import { h, $, clear } from './util.js';
import { state, subscribe, all, unseen } from './store.js';
import { initSync } from './sync.js';
import { refreshAiring } from './airing.js';
import { icon } from './ui.js';
import * as library from './views/library.js';
import * as discover from './views/discover.js';
import * as agenda from './views/agenda.js';
import * as stats from './views/stats.js';
import * as tiers from './views/tiers.js';
import * as roulette from './views/roulette.js';
import * as wrapped from './views/wrapped.js';
import * as settings from './views/settings.js';
import { mountWelcome, mountGate } from './views/welcome.js';
import { access, LOCKED } from './account.js';

const ROUTES = {
  library: { label: 'Lista', icon: 'grid', view: library },
  discover: { label: 'Descobrir', icon: 'compass', view: discover },
  agenda: { label: 'Agenda', icon: 'calendar', view: agenda },
  stats: { label: 'Stats', icon: 'chart', view: stats },
  more: { label: 'Mais', icon: 'more', view: { mount: settings.mountMore } },
  tiers: { label: 'Tier list', icon: 'tiers', view: tiers, hidden: true },
  roulette: { label: 'Roleta', icon: 'dice', view: roulette, hidden: true },
  wrapped: { label: 'Retrospetiva', icon: 'sparkle', view: wrapped, hidden: true },
  settings: { label: 'Definições', icon: 'sliders', view: settings, hidden: true },
};
const TABS = ['library', 'discover', 'agenda', 'stats', 'more'];
const SIDE = [['library', 'discover', 'agenda', 'stats'], ['wrapped', 'roulette', 'tiers'], ['settings']];
const TAB_FOR = { tiers: 'more', roulette: 'more', wrapped: 'more', settings: 'more' };

const main = $('#main');
let current = null, view = null, name = '';

function applyTheme() {
  document.documentElement.dataset.theme = state.cfg.theme;
  const dark = state.cfg.theme === 'dark' || (state.cfg.theme === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  $('meta[name=theme-color]')?.setAttribute('content', dark ? '#0a0a12' : '#f4f4fb');
}

function badge() {
  const n = all().reduce((s, i) => s + (unseen(i) > 0 ? 1 : 0), 0);
  document.querySelectorAll('.nav-badge').forEach((b) => { b.textContent = n; b.hidden = !n; });
}

function buildNav() {
  const side = clear($('#side'));
  side.append(h('a', { class: 'logo', href: '#/library' }, h('img', { src: 'icons/icon.svg', alt: '' }), h('span', null, 'Otakuteca')));
  SIDE.forEach((group) => {
    side.append(h('div', { class: 'side-group' }, group.map((r) =>
      h('a', { class: 'side-link', 'data-r': r, href: '#/' + r }, icon(ROUTES[r].icon, 20), h('span', null, ROUTES[r].label),
        r === 'agenda' ? h('i', { class: 'nav-badge', hidden: true }) : null))));
  });
  const bar = clear($('#tabbar'));
  TABS.forEach((r) => bar.append(h('a', { class: 'tab-link', 'data-r': r, href: '#/' + r }, h('span', { class: 'ti' }, icon(ROUTES[r].icon, 24), r === 'agenda' ? h('i', { class: 'nav-badge', hidden: true }) : null), h('small', null, ROUTES[r].label))));
}

function markActive() {
  document.querySelectorAll('.side-link').forEach((a) => a.classList.toggle('on', a.dataset.r === name));
  document.querySelectorAll('.tab-link').forEach((a) => a.classList.toggle('on', a.dataset.r === (TAB_FOR[name] || name)));
}

function route() {
  const mode = access();
  document.body.classList.toggle('welcome-mode', mode === 'welcome');
  const hash = location.hash.replace(/^#\/?/, '') || (mode === 'account' ? 'library' : 'discover');
  name = ROUTES[hash] ? hash : (mode === 'account' ? 'library' : 'discover');
  if (view?.destroy) view.destroy();
  clear(main);
  main.scrollTop = 0;
  window.scrollTo(0, 0);
  const page = h('div', { class: 'page' });
  main.append(page);
  if (mode === 'welcome') {
    view = mountWelcome(page);
    document.title = 'Otakuteca';
  } else if (mode === 'guest' && LOCKED.has(name)) {
    view = mountGate(page, 'A ' + ROUTES[name].label.toLowerCase());
    document.title = ROUTES[name].label + ' · Otakuteca';
  } else {
    view = ROUTES[name].view.mount(page) || {};
    document.title = ROUTES[name].label + ' · Otakuteca';
  }
  markActive();
}

let raf = 0, lang = state.cfg.titleLang, seen = access();
subscribe((kind) => {
  if (kind === 'cfg') {
    applyTheme();
    // só refazemos o ecrã se mudou o idioma dos títulos ou o tipo de acesso (o resto, como a hora do último sync, não interessa)
    const now = access();
    if (state.cfg.titleLang !== lang || now !== seen) { lang = state.cfg.titleLang; seen = now; route(); }
    return;
  }
  if (kind !== 'data') return;
  cancelAnimationFrame(raf);
  raf = requestAnimationFrame(() => { badge(); view?.update?.(); });
});

window.addEventListener('hashchange', route);
applyTheme();
buildNav();
route();
badge();
initSync();
refreshAiring(false).then(badge);
setInterval(() => refreshAiring(false).then(badge), 30 * 60e3);

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').catch((e) => console.warn('SW:', e));
}
