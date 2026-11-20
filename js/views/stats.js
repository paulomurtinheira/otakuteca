// Estatísticas: números, calendário de atividade, gostos, "personalidade" e conquistas.

import { h, clear, dayStr, parseDay, pad } from '../util.js';
import { titleOf } from '../store.js';
import { stats, personality, achievements, activity, streaks } from '../insights.js';
import { card, seg, emptyState } from '../ui.js';

let type = 'ANIME';

const big = (n, label, sub) => h('div', { class: 'stat' }, h('div', { class: 'stat-n' }, n), h('div', { class: 'stat-l' }, label), sub ? h('div', { class: 'stat-s' }, sub) : null);

function bars(rows, { max, color = 'var(--accent)' } = {}) {
  const m = max || Math.max(1, ...rows.map((r) => r.value));
  return h('div', { class: 'bars' }, rows.map((r) =>
    h('div', { class: 'bar-row' },
      h('div', { class: 'bar-l' }, r.label),
      h('div', { class: 'bar-t' }, h('i', { style: { width: Math.max(2, (r.value / m) * 100) + '%', background: r.color || color } })),
      h('div', { class: 'bar-v' }, r.text ?? r.value))));
}

function heatmap() {
  const act = activity();
  const today = new Date();
  const dow = (today.getDay() + 6) % 7; // segunda = 0
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - dow - 52 * 7);
  const cells = [], months = [];
  let prevMonth = -1;
  for (let c = 0; c < 53; c++) {
    const first = new Date(start.getFullYear(), start.getMonth(), start.getDate() + c * 7);
    if (first.getMonth() !== prevMonth) {
      months.push(h('span', { style: { gridColumn: c + 1 } }, first.toLocaleDateString('pt-PT', { month: 'short' }).replace('.', '')));
      prevMonth = first.getMonth();
    }
    for (let r = 0; r < 7; r++) {
      const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + c * 7 + r);
      if (d > today) { cells.push(h('i', { class: 'hm hide' })); continue; }
      const n = act[dayStr(d)] || 0;
      const lvl = n === 0 ? 0 : n === 1 ? 1 : n <= 3 ? 2 : n <= 6 ? 3 : 4;
      cells.push(h('i', { class: 'hm l' + lvl, title: `${n} ${n === 1 ? 'episódio/capítulo' : 'episódios/capítulos'} · ${d.toLocaleDateString('pt-PT', { day: 'numeric', month: 'short', year: 'numeric' })}` }));
    }
  }
  const total = Object.values(act).reduce((a, b) => a + b, 0);
  const { cur, best } = streaks(act);
  const scroller = h('div', { class: 'hm-scroll' }, h('div', { class: 'hm-months' }, months), h('div', { class: 'hm-grid' }, cells));
  requestAnimationFrame(() => { scroller.scrollLeft = scroller.scrollWidth; }); // abre em "hoje"
  return h('div', { class: 'panel' },
    h('div', { class: 'panel-h' }, h('h3', null, 'Atividade'), h('span', { class: 'muted small' }, `${total} no total · sequência atual ${cur}d · recorde ${best}d`)),
    scroller,
    total === 0 ? h('p', { class: 'muted small' }, 'O calendário preenche-se à medida que fores marcando episódios como vistos.') : null);
}

export function mount(root) {
  const body = h('div', { class: 'stats' });
  root.append(h('div', { class: 'head' }, h('h1', null, 'Estatísticas'), seg([['ANIME', 'Anime'], ['MANGA', 'Manga']], type, (v) => { type = v; paint(); })), body);

  function paint() {
    clear(body);
    const s = stats(type);
    if (!s.total) {
      body.append(heatmap(), emptyState('📊', 'Ainda sem números', 'Adiciona alguns títulos e eu faço as contas.'));
      return;
    }
    const isAnime = type === 'ANIME';
    const hours = s.minutes / 60;
    const unit = isAnime ? 'episódios' : 'capítulos';

    // números grandes
    const head = [big(s.byStatus.COMPLETED, 'concluídos', `${s.total} na lista`), big(s.units.toLocaleString('pt-PT'), unit, isAnime ? 'vistos' : 'lidos')];
    if (isAnime) head.splice(1, 0, big((hours / 24).toFixed(1).replace('.', ','), 'dias a ver', `${Math.round(hours)} horas`));
    head.push(big(s.avg ? s.avg.toFixed(2).replace('.', ',') : '—', 'nota média', `${s.rated} avaliados`));
    body.append(h('div', { class: 'stat-grid' }, head));

    if (isAnime && hours >= 2) {
      body.append(h('div', { class: 'fun' },
        `🎬 Equivale a ${(hours / 11.43).toFixed(1).replace('.', ',')} maratonas d'O Senhor dos Anéis (versão alargada)`,
        h('br'), `✈️ ou ${(hours / 17).toFixed(1).replace('.', ',')} voos Lisboa–Tóquio sem escalas.`));
    }

    // personalidade
    const p = personality(type);
    if (p) {
      body.append(h('div', { class: 'persona' },
        h('div', { class: 'persona-e' }, p.main.emoji),
        h('div', null,
          h('small', null, 'O teu perfil'),
          h('h3', null, p.main.name),
          h('p', null, p.main.text),
          p.second ? h('small', { class: 'muted' }, `Com um toque de ${p.second.emoji} ${p.second.name}`) : null)));
    }

    body.append(heatmap());

    // gostos
    const left = h('div', { class: 'panel' }, h('h3', null, 'Géneros favoritos'),
      bars(s.genres.slice(0, 8).map((g) => ({ label: g.name, value: g.count, text: g.avg ? `${g.count} · ★${g.avg.toFixed(1).replace('.', ',')}` : g.count }))));
    const right = h('div', { class: 'panel' }, h('h3', null, 'As tuas notas'),
      s.rated ? h('div', { class: 'hist' }, s.dist.map((n, i) => h('div', { class: 'hist-c' }, h('div', { class: 'hist-b', style: { height: Math.max(3, (n / Math.max(...s.dist)) * 100) + '%' }, title: n + ' com nota ' + (i + 1) }), h('span', null, i + 1))))
        : h('p', { class: 'muted small' }, 'Ainda não deste notas.'),
      s.hipster != null ? h('p', { class: 'small hip' },
        Math.abs(s.hipster) < 0.15 ? '🤝 Pensas quase igual à comunidade.'
          : s.hipster > 0 ? `😇 És mais generoso que a comunidade (${s.hipster.toFixed(1).replace('.', ',')} pontos acima, em média).`
            : `🧐 És mais exigente que a comunidade (${Math.abs(s.hipster).toFixed(1).replace('.', ',')} pontos abaixo, em média).`) : null);
    body.append(h('div', { class: 'two' }, left, right));

    const dec = Object.entries(s.decades).sort(([a], [b]) => a - b).map(([d, n]) => ({ label: d + 's', value: n }));
    const two = [h('div', { class: 'panel' }, h('h3', null, 'Por década'), bars(dec, { color: 'var(--accent2)' }))];
    if (isAnime && s.studios.length) two.push(h('div', { class: 'panel' }, h('h3', null, 'Estúdios'), bars(s.studios.slice(0, 6).map((x) => ({ label: x.name, value: x.count, text: x.avg ? `${x.count} · ★${x.avg.toFixed(1).replace('.', ',')}` : x.count })), { color: 'var(--accent2)' })));
    body.append(h('div', { class: 'two' }, two));

    if (s.top.length) {
      body.append(h('div', { class: 'panel' }, h('h3', null, 'O teu top 5'),
        h('div', { class: 'podium' }, s.top.map((i, n) => h('div', { class: 'pod' }, h('div', { class: 'pod-n' }, n + 1), card(i, { plain: true, sub: [i.fmt && i.fmt.replace('_', ' '), i.year].filter(Boolean).join(' · ') }))))));
    }

    // conquistas
    const ach = achievements();
    const got = ach.filter((a) => a.have).length;
    body.append(h('div', { class: 'panel' },
      h('div', { class: 'panel-h' }, h('h3', null, 'Conquistas'), h('span', { class: 'muted small' }, `${got}/${ach.length}`)),
      h('div', { class: 'ach-grid' }, ach.map((a) =>
        h('div', { class: 'ach' + (a.have ? ' on' : '') },
          h('div', { class: 'ach-e' }, a.have ? a.emoji : '🔒'),
          h('div', { class: 'ach-t' }, a.name),
          h('div', { class: 'ach-d' }, a.desc),
          a.have ? null : h('div', { class: 'bar flat' }, h('i', { style: { width: (a.cur / a.max) * 100 + '%' } })),
          a.have ? null : h('div', { class: 'ach-p' }, `${Math.floor(a.cur)}/${a.max}`))))));
  }

  paint();
  return { update: paint };
}
