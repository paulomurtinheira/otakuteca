// Tier list: arrasta (PC) ou toca (telemóvel) para classificar. Dá para guardar como imagem.

import { h, clear } from '../util.js';
import { all, patch, titleOf } from '../store.js';
import { coverImg, icon, openSheet, seg, toast, emptyState } from '../ui.js';
import { openDetail } from './detail.js';

const TIERS = [
  ['S', '#ff5d6c', 'Lendário'], ['A', '#ff9f43', 'Excelente'], ['B', '#ffd93d', 'Muito bom'],
  ['C', '#6bd968', 'Bom'], ['D', '#4cc9f0', 'Fraco'], ['F', '#8d8da8', 'Nunca mais'],
];
const auto = (s) => (s >= 9.5 ? 'S' : s >= 8.5 ? 'A' : s >= 7.5 ? 'B' : s >= 6.5 ? 'C' : s >= 5 ? 'D' : 'F');

let type = 'ANIME';

export function mount(root) {
  const body = h('div', { class: 'tiers' });
  root.append(
    h('div', { class: 'head' }, h('h1', null, 'Tier list'),
      seg([['ANIME', 'Anime'], ['MANGA', 'Manga']], type, (v) => { type = v; paint(); })),
    h('p', { class: 'muted small' }, 'Toca num título para o pôr num nível (no PC também podes arrastar). Dentro de cada nível ficam ordenados pela tua nota.'),
    h('div', { class: 'row gap wrap' },
      h('button', { class: 'btn small', onclick: autoFill }, icon('sparkle', 16), ' Preencher pela nota'),
      h('button', { class: 'btn small', onclick: () => exportPng(type) }, icon('share', 16), ' Guardar como imagem')),
    body);

  function candidates() {
    return all().filter((i) => i.type === type && (i.status === 'COMPLETED' || i.score > 0 || i.tier));
  }

  function autoFill() {
    let n = 0;
    for (const i of candidates()) if (!i.tier && i.score > 0) { patch(i.k, { tier: auto(i.score) }); n++; }
    toast(n ? `${n} títulos colocados pela nota` : 'Nada para preencher (precisas de títulos com nota)');
  }

  function poster(i) {
    const el = h('div', {
      class: 'tpost', draggable: true, title: titleOf(i), style: { '--c': i.color || '#7c6cf0' },
      onclick() { pick(i); },
      ondragstart(e) { e.dataTransfer.setData('text/plain', i.k); e.dataTransfer.effectAllowed = 'move'; el.classList.add('drag'); },
      ondragend() { el.classList.remove('drag'); },
    }, coverImg(i), i.score ? h('span', { class: 'chip score' }, i.score) : null);
    return el;
  }

  function pick(i) {
    const sh = openSheet({ small: true });
    sh.body.append(h('div', { class: 'pad' },
      h('h3', null, titleOf(i)),
      h('p', { class: 'muted small' }, 'Em que nível fica?'),
      h('div', { class: 'tier-pick' }, TIERS.map(([t, c, l]) =>
        h('button', { class: 'tier-btn' + (i.tier === t ? ' on' : ''), style: { '--tc': c }, onclick() { patch(i.k, { tier: t }); sh.close(); } }, h('b', null, t), h('small', null, l)))),
      h('div', { class: 'row gap end' },
        i.tier ? h('button', { class: 'btn small', onclick() { patch(i.k, { tier: null }); sh.close(); } }, 'Tirar da tier list') : null,
        h('button', { class: 'btn small', onclick() { sh.close(); openDetail(i); } }, 'Ver detalhe'))));
  }

  function drop(tier) {
    return {
      ondragover(e) { e.preventDefault(); e.currentTarget.classList.add('over'); },
      ondragleave(e) { e.currentTarget.classList.remove('over'); },
      ondrop(e) {
        e.preventDefault();
        e.currentTarget.classList.remove('over');
        const k = e.dataTransfer.getData('text/plain');
        if (k) patch(k, { tier });
      },
    };
  }

  function paint() {
    clear(body);
    const list = candidates();
    if (!list.length) {
      body.append(emptyState('🏅', 'Nada para classificar', 'Conclui alguns títulos ou dá-lhes nota e eles aparecem aqui.'));
      return;
    }
    const byScore = (a, b) => b.score - a.score || a.title.localeCompare(b.title);
    for (const [t, c, l] of TIERS) {
      const here = list.filter((i) => i.tier === t).sort(byScore);
      body.append(h('div', { class: 'tier-row' },
        h('div', { class: 'tier-l', style: { background: c } }, h('b', null, t), h('small', null, l)),
        h('div', { class: 'tier-c', ...drop(t) }, here.map(poster))));
    }
    const pool = list.filter((i) => !i.tier).sort(byScore);
    body.append(h('h3', { class: 'sec' }, `Por classificar (${pool.length})`),
      h('div', { class: 'tier-pool', ...drop(null) }, pool.length ? pool.map(poster) : h('span', { class: 'muted small' }, 'Tudo classificado 🎉')));
  }

  paint();
  return { update: paint };
}

// ---------- exportar como imagem ----------
function loadImg(src) {
  return new Promise((res) => {
    if (!src) return res(null);
    const im = new Image();
    im.crossOrigin = 'anonymous';
    im.onload = () => res(im);
    im.onerror = () => res(null);
    im.src = src;
  });
}

async function exportPng(t) {
  const list = all().filter((i) => i.type === t && i.tier);
  if (!list.length) { toast('Põe primeiro alguns títulos na tier list'); return; }
  toast('A criar a imagem…', { ms: 1500 });
  const W = 1200, PW = 104, PH = 148, GAP = 6, LABEL = 150, PAD = 16, perRow = Math.floor((W - LABEL - PAD) / (PW + GAP));
  const rows = TIERS.map(([k, c, l]) => ({ k, c, l, items: list.filter((i) => i.tier === k).sort((a, b) => b.score - a.score) }));
  const heights = rows.map((r) => Math.max(1, Math.ceil(r.items.length / perRow)) * (PH + GAP) + GAP);
  const H = 90 + heights.reduce((a, b) => a + b, 0) + 40;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const g = cv.getContext('2d');
  g.fillStyle = '#0b0b14'; g.fillRect(0, 0, W, H);
  g.fillStyle = '#fff'; g.font = '700 34px system-ui, sans-serif';
  g.fillText(`A minha tier list de ${t === 'ANIME' ? 'anime' : 'manga'}`, 24, 56);

  const imgs = new Map(await Promise.all(list.map(async (i) => [i.k, await loadImg(i.cover)])));
  let y = 80, tainted = false;
  rows.forEach((r, idx) => {
    g.fillStyle = '#161624'; g.fillRect(0, y, W, heights[idx]);
    g.fillStyle = r.c; g.fillRect(0, y, LABEL, heights[idx]);
    g.fillStyle = '#10101a'; g.textAlign = 'center';
    g.font = '800 56px system-ui, sans-serif'; g.fillText(r.k, LABEL / 2, y + heights[idx] / 2 + 14);
    g.textAlign = 'left';
    r.items.forEach((i, n) => {
      const x = LABEL + PAD / 2 + (n % perRow) * (PW + GAP), yy = y + GAP + Math.floor(n / perRow) * (PH + GAP);
      const im = imgs.get(i.k);
      if (im) g.drawImage(im, x, yy, PW, PH);
      else {
        g.fillStyle = i.color || '#3a3a55'; g.fillRect(x, yy, PW, PH);
        g.fillStyle = '#fff'; g.font = '600 12px system-ui, sans-serif';
        i.title.slice(0, 40).match(/.{1,14}/g)?.slice(0, 5).forEach((ln, q) => g.fillText(ln, x + 6, yy + 20 + q * 15));
      }
    });
    y += heights[idx];
  });
  g.fillStyle = '#9494b3'; g.font = '500 16px system-ui, sans-serif';
  g.fillText('Otakuteca', 24, H - 14);

  let blob;
  try { blob = await new Promise((res) => cv.toBlob(res, 'image/png')); } catch { tainted = true; }
  if (!blob || tainted) { toast('Não consegui gerar a imagem (as capas bloquearam). Faz uma captura de ecrã.'); return; }
  const file = new File([blob], 'tier-list.png', { type: 'image/png' });
  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: 'A minha tier list' }); return; } catch { /* cancelou: cai para download */ }
  }
  const url = URL.createObjectURL(blob);
  const a = h('a', { href: url, download: 'tier-list.png' });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}
