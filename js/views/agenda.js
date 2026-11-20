// Agenda: o que tens por ver agora e quando sai o próximo episódio de cada série.

import { h, clear, fmtCountdown } from '../util.js';
import { all, state, setProgress, titleOf, airedCount, unseen } from '../store.js';
import { icon, emptyState, coverImg } from '../ui.js';
import { openDetail } from './detail.js';
import { refreshAiring } from '../airing.js';

function dayLabel(ts) {
  const d = new Date(ts), now = new Date();
  const a = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const b = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const diff = Math.round((a - b) / 864e5);
  if (diff === 0) return 'Hoje';
  if (diff === 1) return 'Amanhã';
  const s = d.toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function mount(root) {
  const body = h('div');
  const status = h('span', { class: 'muted small' });
  const refreshBtn = h('button', {
    class: 'btn small', async onclick() {
      refreshBtn.disabled = true;
      status.textContent = 'A atualizar…';
      await refreshAiring(true);
      refreshBtn.disabled = false;
      paint();
    },
  }, icon('refresh', 16), ' Atualizar');

  root.append(h('div', { class: 'head' }, h('h1', null, 'Agenda'), h('div', { class: 'row gap center-y' }, status, refreshBtn)), body);

  function paint() {
    clear(body);
    const watching = all().filter((i) => i.type === 'ANIME' && i.status === 'WATCHING');
    const ready = watching.filter((i) => unseen(i) > 0).sort((a, b) => unseen(b) - unseen(a));
    const upcoming = all()
      .filter((i) => i.type === 'ANIME' && ['WATCHING', 'PLANNED'].includes(i.status) && state.air[i.id]?.at > Date.now() - 36e5)
      .sort((a, b) => state.air[a.id].at - state.air[b.id].at);

    status.textContent = state.cfg.lastAir ? 'Atualizado às ' + new Date(state.cfg.lastAir).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' }) : '';

    if (!watching.length && !upcoming.length) {
      body.append(emptyState('📅', 'Nada na agenda', 'Quando estiveres a ver uma série que ainda está a ser emitida, vês aqui quando sai o próximo episódio.',
        [{ label: 'Ver o que está a dar', primary: true, onClick: () => (location.hash = '#/discover') }]));
      return;
    }

    if (ready.length) {
      body.append(h('h3', { class: 'sec' }, '🍿 Para ver agora'),
        h('div', { class: 'list' }, ready.map((i) => {
          const n = unseen(i);
          return h('div', { class: 'agenda-row', style: { '--c': i.color || '#7c6cf0' }, onclick: () => openDetail(i) },
            h('div', { class: 'thumb' }, coverImg(i)),
            h('div', { class: 'ri-main' },
              h('div', { class: 'ri-t' }, titleOf(i)),
              h('div', { class: 'ri-s' }, `Ep. ${i.prog + 1}`, n > 1 ? ` e mais ${n - 1}` : '', ' disponível', n > 1 ? 's' : '')),
            h('button', { class: 'btn small primary', onclick(e) { e.stopPropagation(); setProgress(i.k, i.prog + 1); } }, 'Vi'));
        })));
    }

    if (upcoming.length) {
      body.append(h('h3', { class: 'sec' }, '⏳ Próximos episódios'));
      let last = '';
      for (const i of upcoming) {
        const a = state.air[i.id];
        const lab = dayLabel(a.at);
        if (lab !== last) { body.append(h('div', { class: 'day' }, lab)); last = lab; }
        body.append(h('div', { class: 'agenda-row', style: { '--c': i.color || '#7c6cf0' }, onclick: () => openDetail(i) },
          h('div', { class: 'thumb' }, coverImg(i)),
          h('div', { class: 'ri-main' },
            h('div', { class: 'ri-t' }, titleOf(i)),
            h('div', { class: 'ri-s' }, `Ep. ${a.ep} · ${new Date(a.at).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}`)),
          h('div', { class: 'count' }, fmtCountdown(a.at - Date.now()))));
      }
    }
    if (!ready.length && !upcoming.length) {
      body.append(emptyState('🎉', 'Estás em dia!', 'Não tens episódios por ver e nenhuma das tuas séries tem data de emissão marcada.'));
    }
  }

  paint();
  refreshAiring(false).then((did) => { if (did) paint(); });
  const tick = setInterval(paint, 60e3); // contagens decrescentes
  return { update: paint, destroy() { clearInterval(tick); } };
}
