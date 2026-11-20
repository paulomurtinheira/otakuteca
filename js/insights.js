// Estatísticas, "personalidade" e conquistas calculadas a partir da tua lista.

import { all, STATUSES } from './store.js';
import { mean, dayStr, parseDay } from './util.js';

/** Dia -> episódios/capítulos vistos nesse dia (todos os tipos). */
export function activity(year = null) {
  const map = {};
  for (const it of all()) {
    for (const [d, n] of Object.entries(it.log || {})) {
      if (year && !d.startsWith(String(year))) continue;
      map[d] = (map[d] || 0) + n;
    }
  }
  return map;
}

export function streaks(map = activity()) {
  const days = Object.keys(map).sort();
  let best = 0, run = 0, prev = null;
  for (const d of days) {
    const t = parseDay(d).getTime();
    run = prev !== null && Math.round((t - prev) / 864e5) === 1 ? run + 1 : 1;
    best = Math.max(best, run);
    prev = t;
  }
  // sequência atual: conta para trás a partir de hoje (ou de ontem, se hoje ainda não viste nada)
  let cur = 0;
  const d = new Date();
  if (!map[dayStr(d)]) d.setDate(d.getDate() - 1);
  while (map[dayStr(d)]) { cur++; d.setDate(d.getDate() - 1); }
  return { cur, best };
}

export function stats(type = 'ANIME') {
  const list = all().filter((i) => i.type === type);
  const byStatus = Object.fromEntries(STATUSES.map((s) => [s, 0]));
  list.forEach((i) => byStatus[i.status]++);

  let units = 0, minutes = 0;
  for (const i of list) {
    const n = i.prog + (i.rew || 0) * (i.eps || 0);
    units += n;
    if (type === 'ANIME') minutes += n * (i.dur || 24);
  }
  const rated = list.filter((i) => i.score > 0);
  const started = list.filter((i) => i.status !== 'PLANNED');

  const g = {};
  for (const i of started) {
    for (const n of i.genres || []) {
      const e = (g[n] ||= { count: 0, sum: 0, rated: 0 });
      e.count++;
      if (i.score > 0) { e.sum += i.score; e.rated++; }
    }
  }
  const genres = Object.entries(g)
    .map(([name, v]) => ({ name, count: v.count, avg: v.rated ? v.sum / v.rated : 0 }))
    .sort((a, b) => b.count - a.count);

  const dist = Array(10).fill(0);
  rated.forEach((i) => dist[Math.min(10, Math.max(1, Math.ceil(i.score))) - 1]++);

  const decades = {};
  started.filter((i) => i.year).forEach((i) => {
    const d = Math.floor(i.year / 10) * 10;
    decades[d] = (decades[d] || 0) + 1;
  });

  const st = {};
  started.filter((i) => i.studio).forEach((i) => {
    const e = (st[i.studio] ||= { count: 0, sum: 0, rated: 0 });
    e.count++;
    if (i.score > 0) { e.sum += i.score; e.rated++; }
  });
  const studios = Object.entries(st)
    .map(([name, v]) => ({ name, count: v.count, avg: v.rated ? v.sum / v.rated : 0 }))
    .sort((a, b) => b.count - a.count || b.avg - a.avg);

  const withAvg = rated.filter((i) => i.avg > 0);
  const hipster = withAvg.length >= 3 ? mean(withAvg.map((i) => i.score - i.avg / 10)) : null;

  return {
    total: list.length, byStatus, units, minutes, rated: rated.length,
    avg: mean(rated.map((i) => i.score)), genres, dist, decades, studios, hipster,
    favs: list.filter((i) => i.fav),
    top: rated.slice().sort((a, b) => b.score - a.score || b.upd - a.upd).slice(0, 5),
  };
}

// ---------- personalidade ----------
const ARCH = [
  { id: 'hero', emoji: '🔥', name: 'O Herói de Shounen', genres: ['Action', 'Adventure'], text: 'Vives para o arco de treino, o grito de poder e o amigo que volta no último episódio.' },
  { id: 'detective', emoji: '🕵️', name: 'O Detetive Paranóico', genres: ['Mystery', 'Psychological', 'Thriller'], text: 'Desconfias de toda a gente, incluindo do narrador. Adoras uma reviravolta que te deixa a olhar para o teto.' },
  { id: 'cozy', emoji: '🍵', name: 'Alma Cozy', genres: ['Slice of Life', 'Comedy'], text: 'Preferes uma tarde calma, chá quente e personagens fofas a uma batalha final.' },
  { id: 'romantic', emoji: '💘', name: 'Romântico Incurável', genres: ['Romance', 'Drama'], text: 'Ficas a torcer pelo "confessa-te de uma vez" e não tens vergonha de chorar à frente do ecrã.' },
  { id: 'pilot', emoji: '🚀', name: 'O Piloto Visionário', genres: ['Sci-Fi', 'Mecha'], text: 'Futuros distantes, robôs gigantes e grandes ideias. O espaço é o teu habitat.' },
  { id: 'night', emoji: '🌙', name: 'Insone Sombrio', genres: ['Horror', 'Supernatural'], text: 'Vês anime às 3 da manhã com as luzes apagadas, de propósito.' },
  { id: 'captain', emoji: '🏆', name: 'Capitão da Equipa', genres: ['Sports'], text: 'Esforço, rivais e o ponto decisivo no último segundo. Já te sentes parte do clube.' },
  { id: 'dreamer', emoji: '🧙', name: 'O Sonhador Épico', genres: ['Fantasy', 'Adventure', 'Drama'], text: 'Mundos inventados, magia e jornadas longas. Quanto mais mapa, melhor.' },
  { id: 'bard', emoji: '🎤', name: 'Coração de Banda', genres: ['Music', 'Mahou Shoujo'], text: 'Para ti uma boa banda sonora vale tanto como a história.' },
];

export function personality(type = 'ANIME') {
  const s = stats(type);
  if (s.genres.length < 2) return null;
  const by = Object.fromEntries(s.genres.map((g) => [g.name, g]));
  const scored = ARCH.map((a) => {
    let v = 0;
    for (const n of a.genres) {
      const g = by[n];
      if (g) v += g.count * (1 + (g.avg ? Math.max(-0.4, (g.avg - 6) / 10) : 0));
    }
    return { ...a, v: v / Math.sqrt(a.genres.length) };
  }).sort((a, b) => b.v - a.v);
  return scored[0].v > 0 ? { main: scored[0], second: scored[1].v > 0 ? scored[1] : null } : null;
}

// ---------- conquistas ----------
export function achievements() {
  const items = all();
  const done = items.filter((i) => i.status === 'COMPLETED');
  const act = activity();
  const best = Math.max(0, ...Object.values(act));
  const { best: streak } = streaks(act);
  const hours = Math.round(stats('ANIME').minutes / 60);
  const genresDone = new Set(done.flatMap((i) => i.genres || []));
  const A = (id, emoji, name, desc, cur, max) => ({ id, emoji, name, desc, cur: Math.min(cur, max), max, have: cur >= max });
  return [
    A('first', '🌱', 'Primeiro passo', 'Conclui o teu primeiro título', done.length, 1),
    A('ten', '🔟', 'Dez de ouro', 'Conclui 10 títulos', done.length, 10),
    A('hundred', '💯', 'Centurião', 'Conclui 100 títulos', done.length, 100),
    A('binge', '🍿', 'Maratonista', 'Vê 12 episódios num só dia', best, 12),
    A('streak', '🔥', 'Fiel ao ecrã', 'Vê algo 7 dias seguidos', streak, 7),
    A('critic', '✍️', 'Crítico', 'Dá nota a 25 títulos', items.filter((i) => i.score > 0).length, 25),
    A('long', '🐉', 'Sem medo', 'Conclui algo com 100+ episódios', done.filter((i) => i.eps >= 100).length, 1),
    A('classic', '📼', 'Cinéfilo de VHS', 'Conclui algo anterior a 2000', done.filter((i) => i.year && i.year < 2000).length, 1),
    A('eclectic', '🎭', 'Eclético', 'Conclui títulos de 12 géneros diferentes', genresDone.size, 12),
    A('hearts', '💖', 'Coração mole', 'Marca 5 favoritos', items.filter((i) => i.fav).length, 5),
    A('writer', '📝', 'Cronista', 'Escreve notas em 10 títulos', items.filter((i) => i.note || i.line).length, 10),
    A('tier', '🏅', 'Juiz supremo', 'Põe 20 títulos na tier list', items.filter((i) => i.tier).length, 20),
    A('h100', '⏱️', 'Cem horas', 'Passa 100 horas a ver anime', hours, 100),
    A('h500', '🛋️', 'Residente do sofá', 'Passa 500 horas a ver anime', hours, 500),
    A('manga', '📚', 'Rato de manga', 'Conclui 5 mangas', done.filter((i) => i.type === 'MANGA').length, 5),
  ];
}
