// Folha de detalhe: tudo sobre um título + o teu registo pessoal.

import { h, clear, debounce, fmtCountdown, stripHtml, dayStr } from '../util.js';
import {
  state, get, keyOf, addMedia, patch, remove, restore, setStatus, setProgress,
  STATUSES, statusLabel, titleOf, airedCount,
} from '../store.js';
import { detail as fetchDetail } from '../anilist.js';
import { icon, openSheet, toast, coverImg, confirmSheet } from '../ui.js';
import { list as mySources, buildUrl, isSearch } from '../sources.js';
import { hasAccount } from '../account.js';

export const MOODS = [
  ['cry', '😭', 'Chorei'], ['hype', '🔥', 'Hype'], ['mind', '🤯', 'Mind-blown'], ['lol', '😂', 'Muito engraçado'],
  ['cute', '💕', 'Fofo'], ['slow', '😴', 'Arrastado'], ['friends', '👀', 'Para ver com alguém'], ['ost', '🎵', 'OST incrível'],
  ['art', '🎨', 'Visual lindo'], ['think', '🧠', 'Faz pensar'], ['night', '🌙', 'Para a noite'], ['cheer', '☀️', 'Para animar'],
];

export function scoreLabel(s) {
  if (!s) return 'Sem nota';
  if (s >= 10) return 'Obra-prima';
  if (s >= 9) return 'Excelente';
  if (s >= 8) return 'Muito bom';
  if (s >= 7) return 'Bom';
  if (s >= 6) return 'Razoável';
  if (s >= 5) return 'Fraco';
  if (s >= 3) return 'Mau';
  return 'Horrível';
}

const REL = {
  SEQUEL: 'Sequela', PREQUEL: 'Prequela', PARENT: 'Original', SIDE_STORY: 'História paralela', SPIN_OFF: 'Spin-off',
  ADAPTATION: 'Adaptação', ALTERNATIVE: 'Alternativa', SUMMARY: 'Resumo', CONTAINS: 'Contém', SOURCE: 'Fonte', COMPILATION: 'Compilação',
};

export function openDetail(base, parts = null) {
  const sh = openSheet();
  const series = parts && parts.length > 1 ? parts : null; // temporadas e filmes da mesma série, vindos da pesquisa
  const stack = [];
  let cur = base, extra = null, ticket = 0;
  let root = sh.body;
  let trackBox, watchBox, extraBox, dateStart, dateEnd;

  const keyNow = () => keyOf(cur.type, cur.id);

  function show(b, push = true) {
    if (push) stack.push(cur);
    cur = b; extra = null;
    sh.panel.scrollTop = 0;
    render();
    load();
  }
  function back() { if (stack.length) show(stack.pop(), false); }

  async function load() {
    const mine = ++ticket;
    try {
      const d = await fetchDetail(cur.id);
      if (mine !== ticket) return;
      extra = d;
    } catch (e) {
      if (mine !== ticket) return;
      extra = { error: e.message };
    }
    renderExtra();
  }

  function render() {
    const k = keyNow();
    const mine = get(k);
    const it = mine || cur;
    clear(root);

    const bannerSrc = it.banner || it.cover;
    const hero = h('div', { class: 'hero', style: { '--c': it.color || '#6d5bd0' } },
      bannerSrc ? h('img', { class: 'hero-bg' + (it.banner ? '' : ' blur'), src: bannerSrc, alt: '', referrerPolicy: 'no-referrer' }) : null,
      h('div', { class: 'hero-fade' }),
      h('div', { class: 'hero-top' },
        stack.length ? h('button', { class: 'icon-btn glass', onclick: back, 'aria-label': 'Voltar' }, icon('back')) : h('span'),
        h('button', { class: 'icon-btn glass', onclick: sh.close, 'aria-label': 'Fechar' }, icon('x'))),
      h('div', { class: 'hero-in' },
        h('div', { class: 'hero-cover' }, coverImg(it)),
        h('div', { class: 'hero-info' },
          h('h2', null, titleOf(it)),
          it.en && it.en !== it.title && titleOf(it) === it.title ? h('div', { class: 'alt' }, it.en) : null,
          h('div', { class: 'meta' },
            [it.fmt && it.fmt.replace('_', ' '), it.year, it.eps ? `${it.eps} ${it.type === 'MANGA' ? 'cap.' : 'ep.'}` : null,
              it.type === 'ANIME' && it.dur ? it.dur + ' min' : null, it.studio]
              .filter(Boolean).map((t) => h('span', null, t))),
          it.avg ? h('div', { class: 'comm' }, '★ ' + (it.avg / 10).toFixed(1), h('small', null, ' comunidade')) : null)));

    trackBox = h('div', { class: 'box' });
    watchBox = h('div', { class: 'box' });
    extraBox = h('div', { class: 'extra' });
    root.append(hero, h('div', { class: 'sheet-content' }, trackBox, seriesBox(), watchBox, mine ? personal(mine) : null, extraBox));
    renderTrack();
    renderExtra();
  }

  // ---------- ver o próximo episódio nos sites que tu escolheste ----------
  function renderWatch() {
    clear(watchBox);
    if (cur.type !== 'ANIME') { watchBox.hidden = true; return; }
    watchBox.hidden = false;
    const mine = get(keyNow());
    const it = mine || cur;
    let ep = mine ? mine.prog + 1 : 1;
    if (it.eps && ep > it.eps) ep = it.eps;
    const mySites = mySources();
    watchBox.append(h('h4', null, `Ver episódio ${ep}`));
    if (!mySites.length) {
      watchBox.append(h('p', { class: 'muted small' }, 'Escolhe os sites onde costumas ver e aparecem aqui como botões, já com o título e o episódio.'),
        h('a', { class: 'btn small', href: '#/settings', onclick: sh.close }, icon('sliders', 15), ' Configurar os meus sites'));
      return;
    }
    const open = (url, kind, cls, ...kids) => h('a', { class: cls, href: buildUrl(url, it, ep, kind), target: '_blank', rel: 'noopener noreferrer', referrerPolicy: 'no-referrer' }, ...kids);
    watchBox.append(h('div', { class: 'chips' }, mySites.map((s) =>
      h('span', { class: 'src-pair' },
        open(s.url, 'ep', 'btn small', icon(isSearch(s.url) ? 'search' : 'play', 15), ' ' + s.name),
        s.url2 ? open(s.url2, 'anime', 'btn small ghost', 'anime') : null))));
    if (mySites.some((s) => isSearch(s.url))) {
      watchBox.append(h('p', { class: 'muted small' }, 'A lupa quer dizer que o site não deixa montar o link do episódio: abre uma pesquisa dentro dele, e o resultado costuma ser o episódio.'));
    }
  }

  // ---------- estado, progresso, nota ----------
  function renderTrack() {
    const k = keyNow();
    const mine = get(k);
    clear(trackBox);
    renderWatch();

    if (!hasAccount()) {
      trackBox.append(h('div', { class: 'gate-mini' },
        h('p', { class: 'small' }, 'Para adicionares isto a uma lista, marcares o progresso e dares nota precisas de conta.'),
        h('a', { class: 'btn primary small', href: '#/settings', onclick: sh.close }, 'Criar conta / entrar')));
      return;
    }

    trackBox.append(h('div', { class: 'seg wrap' }, STATUSES.map((s) =>
      h('button', {
        class: (mine && mine.status === s ? 'on ' : '') + 'st-' + s,
        onclick() {
          if (!mine) {
            addMedia(cur, 'PLANNED');
            if (s !== 'PLANNED') setStatus(k, s);
            toast('Adicionado: ' + statusLabel(s, cur.type));
            render();
          } else {
            setStatus(k, s);
            renderTrack();
            syncDates();
          }
        },
      }, statusLabel(s, cur.type)))));

    if (!mine) {
      trackBox.append(h('p', { class: 'muted small center' }, 'Escolhe um estado para adicionares à tua lista.'));
      return;
    }

    const unit = mine.type === 'MANGA' ? 'capítulos' : 'episódios';
    const max = mine.eps || 0;
    const num = h('input', {
      class: 'num', type: 'number', inputMode: 'numeric', min: 0, max: max || undefined, value: mine.prog,
      'aria-label': 'Progresso',
      onchange(e) { setProgress(k, +e.target.value || 0); renderTrack(); syncDates(); },
    });
    const prog = h('div', { class: 'prog' },
      h('button', { class: 'round', onclick() { setProgress(k, mine.prog - 1); renderTrack(); syncDates(); }, 'aria-label': 'Menos um' }, icon('minus')),
      h('div', { class: 'prog-n' }, num, h('span', null, max ? `/ ${max} ${unit}` : unit)),
      h('button', { class: 'round big', onclick() { setProgress(k, mine.prog + 1); renderTrack(); syncDates(); }, 'aria-label': 'Mais um' }, icon('plus')));
    trackBox.append(prog);

    if (max) {
      trackBox.append(h('input', {
        class: 'range', type: 'range', min: 0, max, value: mine.prog,
        oninput(e) { num.value = e.target.value; },
        onchange(e) { setProgress(k, +e.target.value); renderTrack(); syncDates(); },
      }));
    }

    // próximo episódio
    const a = state.air[mine.id];
    const aired = airedCount(mine);
    if (mine.type === 'ANIME' && a?.ep && a.at) {
      trackBox.append(h('div', { class: 'air' }, icon('calendar', 16),
        `Ep. ${a.ep} sai em ${fmtCountdown(a.at - Date.now())}`,
        aired != null && aired > mine.prog ? h('b', null, ` · já tens ${aired - mine.prog} por ver`) : null));
    }
    if (max && mine.prog < max) {
      trackBox.append(h('button', { class: 'btn small ghost', onclick() { setStatus(k, 'COMPLETED'); renderTrack(); syncDates(); } }, icon('check', 16), ' Marcar como concluído'));
    }

    // nota
    const val = h('b', null, mine.score ? mine.score.toFixed(1).replace('.0', '') : '?');
    const lab = h('span', null, scoreLabel(mine.score));
    const diff = h('small', { class: 'muted' });
    const paintDiff = (s) => {
      diff.textContent = s && mine.avg ? `Comunidade ${(mine.avg / 10).toFixed(1)} · ${s - mine.avg / 10 >= 0 ? '+' : ''}${(s - mine.avg / 10).toFixed(1)}` : (mine.avg ? `Comunidade ${(mine.avg / 10).toFixed(1)}` : '');
    };
    paintDiff(mine.score);
    trackBox.append(h('div', { class: 'score-box' },
      h('div', { class: 'score-top' }, h('div', { class: 'score-n' }, val, h('i', null, '/10')), lab),
      h('input', {
        class: 'range score', type: 'range', min: 0, max: 10, step: 0.5, value: mine.score,
        oninput(e) { const s = +e.target.value; val.textContent = s ? String(s) : '?'; lab.textContent = scoreLabel(s); paintDiff(s); },
        onchange(e) { patch(k, { score: +e.target.value }); },
      }),
      diff));
  }

  // ---------- parte pessoal ----------
  function personal(mine) {
    const k = mine.k;
    const heart = h('button', { class: 'btn small ' + (mine.fav ? 'on-fav' : ''), onclick() { const v = !get(k).fav; patch(k, { fav: v }); heart.classList.toggle('on-fav', v); } },
      icon('heart', 16), ' Favorito');
    const rew = h('span', { class: 'rew' }, mine.rew || 0);
    const rewBox = h('div', { class: 'row gap center-y' },
      h('span', { class: 'muted small' }, mine.type === 'MANGA' ? 'Releituras' : 'Revisões'),
      h('button', { class: 'round sm', onclick() { const v = Math.max(0, (get(k).rew || 0) - 1); patch(k, { rew: v }); rew.textContent = v; } }, icon('minus', 14)),
      rew,
      h('button', { class: 'round sm', onclick() { const v = (get(k).rew || 0) + 1; patch(k, { rew: v }); rew.textContent = v; } }, icon('plus', 14)));

    const line = h('input', {
      type: 'text', class: 'field', maxLength: 140, placeholder: 'A tua opinião numa frase…', value: mine.line || '',
      oninput: debounce((e) => patch(k, { line: e.target.value.trim() }), 400),
    });
    const note = h('textarea', {
      class: 'field', rows: 4, placeholder: 'Notas, momentos favoritos, onde ficaste, o que sentiste…', value: mine.note || '',
      oninput: debounce((e) => patch(k, { note: e.target.value }), 500),
    });
    const moods = h('div', { class: 'chips' }, MOODS.map(([id, em, label]) => {
      const b = h('button', {
        class: 'chip-btn' + ((mine.moods || []).includes(id) ? ' on' : ''),
        onclick() {
          const cur = new Set(get(k).moods || []);
          cur.has(id) ? cur.delete(id) : cur.add(id);
          patch(k, { moods: [...cur] });
          b.classList.toggle('on', cur.has(id));
        },
      }, em + ' ' + label);
      return b;
    }));
    dateStart = h('input', { type: 'date', class: 'field date', value: mine.start || '', onchange(e) { patch(k, { start: e.target.value || null }); } });
    dateEnd = h('input', { type: 'date', class: 'field date', value: mine.end || '', onchange(e) { patch(k, { end: e.target.value || null }); } });

    return h('div', { class: 'box' },
      h('h4', null, 'O teu registo'),
      h('div', { class: 'row gap wrap center-y' }, heart, rewBox),
      h('label', { class: 'lbl' }, 'Em uma frase', line),
      h('div', { class: 'lbl' }, 'Como foi?', moods),
      h('label', { class: 'lbl' }, 'Notas', note),
      h('div', { class: 'row gap' },
        h('label', { class: 'lbl grow' }, 'Comecei', dateStart),
        h('label', { class: 'lbl grow' }, 'Acabei', dateEnd)),
      h('button', {
        class: 'btn small danger-ghost',
        onclick() {
          confirmSheet({
            title: 'Remover da lista?', text: `"${titleOf(mine)}" sai da tua lista (o progresso e as notas perdem-se).`,
            ok: 'Remover', danger: true,
            onOk() {
              const old = remove(k);
              sh.close();
              toast('Removido', { undo() { restore(old); } });
            },
          });
        },
      }, icon('trash', 16), ' Remover da lista'));
  }

  function syncDates() {
    const m = get(keyNow());
    if (!m || !dateStart) return;
    dateStart.value = m.start || '';
    dateEnd.value = m.end || '';
  }

  // faixa horizontal de títulos clicáveis
  const rail = (title, list) => list.length ? h('div', { class: 'box nopad' },
    h('h4', { class: 'pad-x' }, title),
    h('div', { class: 'rail' }, list.map(({ item, label }) =>
      h('button', { class: 'mini', onclick: () => show(item) },
        h('div', { class: 'mini-c', style: { '--c': item.color || '#6d5bd0' } }, coverImg(item), get(keyOf(item.type, item.id)) ? h('span', { class: 'mini-tick' }, icon('check', 12)) : null),
        h('div', { class: 'mini-t' }, titleOf(item)),
        label ? h('div', { class: 'mini-l' }, label) : null)))) : null;

  // as outras temporadas, filmes e especiais (só quando se chega a partir da pesquisa)
  function seriesBox() {
    if (!series) return null;
    const others = series.filter((p) => p.id !== cur.id);
    return rail(`Temporadas e filmes (${series.length})`, others.map((item) => ({ item, label: [item.fmt && item.fmt.replace('_', ' '), item.year].filter(Boolean).join(' · ') })));
  }

  // ---------- informação extra (vem do AniList) ----------
  function renderExtra() {
    if (!extraBox) return;
    clear(extraBox);
    if (!extra) { extraBox.append(h('p', { class: 'muted small center' }, 'A carregar detalhes…')); return; }
    if (extra.error) { extraBox.append(h('p', { class: 'muted small center' }, 'Sem detalhes extra (' + extra.error + ')')); return; }

    const d = extra;
    const desc = stripHtml(d.description);
    if (desc) {
      const p = h('p', { class: 'desc clamp' }, desc);
      extraBox.append(h('div', { class: 'box' }, h('h4', null, 'Sinopse'), p,
        desc.length > 260 ? h('button', { class: 'linkish', onclick(e) { p.classList.toggle('clamp'); e.target.textContent = p.classList.contains('clamp') ? 'Ler mais' : 'Ler menos'; } }, 'Ler mais') : null));
    }
    const chips = [...(d.genres || []), ...(d.tags || []).filter((t) => !(d.genres || []).includes(t))];
    if (chips.length) extraBox.append(h('div', { class: 'chips pad-x' }, chips.map((g, i) => h('span', { class: 'chip-s' + (i < (d.genres || []).length ? ' g' : '') }, g))));

    const links = [];
    if (d.trailer?.site === 'youtube' && d.trailer.id) links.push(['Trailer', 'https://www.youtube.com/watch?v=' + encodeURIComponent(d.trailer.id), 'play']);
    for (const l of d.links || []) links.push([l.site, l.url, 'link']);
    if (d.siteUrl) links.push(['AniList', d.siteUrl, 'link']);
    if (links.length) {
      extraBox.append(h('div', { class: 'box' }, h('h4', null, 'Ver / saber mais'),
        h('div', { class: 'chips' }, links.map(([t, u, ic]) => h('a', { class: 'btn small', href: u, target: '_blank', rel: 'noopener' }, icon(ic, 15), ' ' + t)))));
    }

    const rels = (d.relations || []).map((r) => ({ item: r.item, label: REL[r.rel] || r.rel }));
    extraBox.append(rail('Relacionados', rels), rail('Quem gostou também gostou de', (d.recs || []).map((item) => ({ item }))));
  }

  render();
  load();
}
