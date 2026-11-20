// Retrospetiva do ano, em "stories" (toca para avançar).

import { h, clear, $, dayStr, parseDay, pad } from '../util.js';
import { all, titleOf } from '../store.js';
import { activity, personality } from '../insights.js';
import { coverImg, icon, emptyState } from '../ui.js';

const MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
let year = new Date().getFullYear();

function yearsWithData() {
  const ys = new Set([new Date().getFullYear()]);
  for (const i of all()) {
    for (const d of Object.keys(i.log || {})) ys.add(+d.slice(0, 4));
    if (i.end) ys.add(+i.end.slice(0, 4));
  }
  return [...ys].sort((a, b) => b - a);
}

function build(y) {
  const ys = String(y);
  const act = activity(y);
  const days = Object.keys(act).sort();
  const items = all();
  const finished = items.filter((i) => (i.end || '').startsWith(ys));
  const touched = items.filter((i) => finished.includes(i) || Object.keys(i.log || {}).some((d) => d.startsWith(ys)));

  let units = Object.values(act).reduce((a, b) => a + b, 0);
  let minutes = 0;
  for (const i of items) {
    const n = Object.entries(i.log || {}).filter(([d]) => d.startsWith(ys)).reduce((s, [, v]) => s + v, 0);
    if (i.type === 'ANIME') minutes += n * (i.dur || 24);
  }
  let approx = false;
  if (!units && finished.length) { // listas importadas não têm registo diário: usamos o que foi concluído
    approx = true;
    for (const i of finished) { units += i.eps || 0; if (i.type === 'ANIME') minutes += (i.eps || 0) * (i.dur || 24); }
  }

  const months = Array(12).fill(0);
  for (const [d, n] of Object.entries(act)) months[+d.slice(5, 7) - 1] += n;
  let busiest = null;
  for (const [d, n] of Object.entries(act)) if (!busiest || n > busiest.n) busiest = { d, n };

  let streak = 0, run = 0, prev = null;
  for (const d of days) {
    const t = parseDay(d).getTime();
    run = prev !== null && Math.round((t - prev) / 864e5) === 1 ? run + 1 : 1;
    streak = Math.max(streak, run);
    prev = t;
  }

  const g = {};
  for (const i of touched) for (const n of i.genres || []) g[n] = (g[n] || 0) + 1;
  const genres = Object.entries(g).sort((a, b) => b[1] - a[1]);
  const best = touched.filter((i) => i.score > 0).sort((a, b) => b.score - a.score || b.upd - a.upd).slice(0, 3);

  return { y, units, minutes, approx, finished, touched, months, busiest, streak, genres, best, activeDays: days.length };
}

function countUp(el, to, ms = 1100) {
  const t0 = performance.now();
  const step = (t) => {
    const p = Math.min(1, (t - t0) / ms), e = 1 - Math.pow(1 - p, 3);
    el.textContent = Math.round(to * e).toLocaleString('pt-PT');
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function slides(d) {
  const S = [];
  const num = (n) => { const el = h('div', { class: 'big-num' }, '0'); requestAnimationFrame(() => countUp(el, n)); return el; };

  S.push({ cls: 's1', render: (el) => el.append(h('div', { class: 'wp-small' }, 'A tua retrospetiva'), h('div', { class: 'wp-year' }, d.y), h('div', { class: 'wp-sub' }, 'em anime e manga'), h('div', { class: 'wp-hint' }, 'Toca para avançar →')) });

  S.push({ cls: 's2', render: (el) => el.append(
    h('div', { class: 'wp-small' }, d.approx ? 'Concluíste' : 'Viste'), num(d.units),
    h('div', { class: 'wp-sub' }, 'episódios e capítulos'),
    d.minutes ? h('div', { class: 'wp-line' }, `${Math.round(d.minutes / 60)} horas de ecrã${d.minutes >= 1440 ? ` · ${(d.minutes / 1440).toFixed(1).replace('.', ',')} dias seguidos` : ''}`) : null,
    d.activeDays ? h('div', { class: 'wp-line' }, `em ${d.activeDays} dias diferentes`) : null) });

  if (d.finished.length) {
    S.push({ cls: 's3', render: (el) => el.append(
      h('div', { class: 'wp-small' }, 'Chegaste ao fim de'), num(d.finished.length),
      h('div', { class: 'wp-sub' }, d.finished.length === 1 ? 'título' : 'títulos'),
      h('div', { class: 'wp-posters' }, d.finished.slice(0, 8).map((i) => h('div', { class: 'wp-p' }, coverImg(i))))) });
  }

  if (d.genres.length) {
    const max = d.genres[0][1];
    S.push({ cls: 's4', render: (el) => el.append(
      h('div', { class: 'wp-small' }, 'O teu género do ano'), h('div', { class: 'wp-title' }, d.genres[0][0]),
      h('div', { class: 'wp-bars' }, d.genres.slice(0, 5).map(([n, c]) => h('div', { class: 'wp-bar' }, h('span', null, n), h('i', { style: { width: (c / max) * 100 + '%' } }), h('b', null, c))))) });
  }

  if (d.best.length) {
    S.push({ cls: 's5', render: (el) => el.append(
      h('div', { class: 'wp-small' }, 'O teu top do ano'),
      h('div', { class: 'wp-podium' }, d.best.map((i, n) => h('div', { class: 'wp-pod p' + (n + 1) },
        h('div', { class: 'wp-p' }, coverImg(i)), h('div', { class: 'wp-pn' }, n + 1), h('div', { class: 'wp-pt' }, titleOf(i)), h('div', { class: 'wp-ps' }, '★ ' + i.score))))) });
  }

  if (d.activeDays) {
    const max = Math.max(...d.months, 1);
    const bm = d.months.indexOf(Math.max(...d.months));
    S.push({ cls: 's6', render: (el) => el.append(
      h('div', { class: 'wp-small' }, 'O teu mês mais viciado'), h('div', { class: 'wp-title' }, ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'][bm]),
      h('div', { class: 'wp-months' }, d.months.map((n, i) => h('div', { class: 'wp-m' }, h('i', { style: { height: Math.max(3, (n / max) * 100) + '%' } }), h('span', null, MONTHS[i][0])))),
      d.busiest && d.busiest.n > 1 ? h('div', { class: 'wp-line' }, `Maior maratona: ${d.busiest.n} num só dia (${parseDay(d.busiest.d).toLocaleDateString('pt-PT', { day: 'numeric', month: 'long' })})`) : null,
      d.streak > 1 ? h('div', { class: 'wp-line' }, `Melhor sequência: ${d.streak} dias seguidos 🔥`) : null) });
  }

  const p = personality('ANIME');
  S.push({ cls: 's7', render: (el) => el.append(
    p ? [h('div', { class: 'wp-small' }, 'Este ano foste'), h('div', { class: 'wp-emoji' }, p.main.emoji), h('div', { class: 'wp-title' }, p.main.name), h('div', { class: 'wp-sub' }, p.main.text)]
      : [h('div', { class: 'wp-emoji' }, '🌟'), h('div', { class: 'wp-title' }, 'Até ao próximo ano!'), h('div', { class: 'wp-sub' }, 'Continua a marcar o que vês e esta retrospetiva fica cada vez melhor.')],
    h('div', { class: 'wp-hint' }, 'Fecha com ✕ · tira uma captura de ecrã para partilhar')) });
  return S;
}

function story(S) {
  let i = 0;
  const bars = h('div', { class: 'st-bars' }, S.map(() => h('i', null, h('b'))));
  const stage = h('div', { class: 'st-stage' });
  const close = () => { document.removeEventListener('keydown', onKey); ov.remove(); document.body.classList.remove('lock'); };
  const go = (n) => {
    if (n < 0) n = 0;
    if (n >= S.length) return close();
    i = n;
    [...bars.children].forEach((b, k) => b.firstChild.style.width = k <= i ? '100%' : '0');
    clear(stage); stage.className = 'st-stage ' + S[i].cls;
    S[i].render(stage);
  };
  const onKey = (e) => { if (e.key === 'ArrowRight' || e.key === ' ') go(i + 1); else if (e.key === 'ArrowLeft') go(i - 1); else if (e.key === 'Escape') close(); };
  const ov = h('div', { class: 'story' }, bars,
    h('button', { class: 'icon-btn glass st-x', onclick: close, 'aria-label': 'Fechar' }, icon('x')),
    stage,
    h('div', { class: 'st-tap l', onclick: () => go(i - 1) }), h('div', { class: 'st-tap r', onclick: () => go(i + 1) }));
  $('#layer').append(ov);
  document.body.classList.add('lock');
  document.addEventListener('keydown', onKey);
  go(0);
}

export function mount(root) {
  const body = h('div');
  const sel = h('select', { class: 'field sel', onchange(e) { year = +e.target.value; paint(); } },
    yearsWithData().map((y) => h('option', { value: y, selected: y === year }, y)));
  root.append(h('div', { class: 'head' }, h('h1', null, 'Retrospetiva'), sel), body);

  function paint() {
    clear(body);
    const d = build(year);
    if (!d.units && !d.finished.length) {
      body.append(emptyState('🎞️', `Sem dados de ${year}`, 'A retrospetiva alimenta-se dos episódios que marcares como vistos ao longo do ano e dos títulos que concluíres.'));
      return;
    }
    body.append(
      h('div', { class: 'wp-cta' },
        h('div', { class: 'wp-cta-t' }, `O teu ${year} em anime`),
        h('div', { class: 'wp-cta-s' }, `${d.units.toLocaleString('pt-PT')} episódios/capítulos · ${d.finished.length} concluídos` + (d.minutes ? ` · ${Math.round(d.minutes / 60)} h` : '')),
        h('button', { class: 'btn primary big', onclick: () => story(slides(d)) }, icon('play', 18), ' Ver retrospetiva')),
      d.approx ? h('p', { class: 'muted small' }, 'Nota: a lista foi importada sem registo diário, por isso os números vêm dos títulos que concluíste este ano.') : null);
  }
  paint();
  return { update: paint };
}
