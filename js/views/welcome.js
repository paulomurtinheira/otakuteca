// Ecrã de entrada (criar conta ou seguir como convidado) e aviso para quem tenta abrir
// uma área que precisa de conta.

import { h } from '../util.js';
import { state, setCfg } from '../store.js';
import { syncNow } from '../sync.js';
import { signIn, clientId } from '../gdrive.js';
import { icon, toast } from '../ui.js';

/** Botão "Entrar com Google" com mensagem de erro por baixo. */
function googleButton(label, onDone) {
  const msg = h('div', { class: 'msg' });
  const btn = h('button', {
    class: 'btn primary big',
    async onclick() {
      if (!clientId()) { msg.className = 'msg warn'; msg.textContent = 'O login com Google ainda não está disponível nesta app.'; return; }
      btn.disabled = true;
      msg.className = 'msg'; msg.textContent = 'A abrir o login da Google…';
      try {
        await signIn();
        msg.textContent = '';
        syncNow().then(() => toast('Sincronizado'));
        onDone();
      } catch (err) { msg.className = 'msg bad'; msg.textContent = err.message; }
      btn.disabled = false;
    },
  }, label);
  return h('div', { class: 'stack' }, btn, msg);
}

export function mountWelcome(root) {
  root.append(h('div', { class: 'welcome' },
    h('img', { class: 'welcome-logo', src: 'icons/icon.svg', alt: '' }),
    h('h1', null, 'Otakuteca'),
    h('p', { class: 'welcome-sub' }, 'A tua lista de anime e manga, a tua agenda de episódios e as tuas estatísticas. Tudo num só sítio.'),
    h('div', { class: 'welcome-card' },
      h('h3', null, 'Criar conta ou entrar'),
      h('p', { class: 'muted small' }, 'Usa o teu Gmail. A lista fica guardada na tua Google Drive e aparece igual no PC e no iPhone. Não há palavra-passe para criar.'),
      googleButton('Continuar com Google', () => { location.hash = '#/library'; })),
    h('button', {
      class: 'btn ghost',
      onclick() { setCfg({ guest: true }); location.hash = '#/discover'; },
    }, 'Seguir como convidado'),
    h('p', { class: 'muted small' }, 'Como convidado podes pesquisar e descobrir animes e mangas. Para criar listas, ter a agenda e as estatísticas precisas de conta.'),
    // quem saiu da conta admin (GitHub) volta a ela com um toque
    state.cfg.ghStash ? h('button', { class: 'btn ghost small', onclick() { setCfg({ ...state.cfg.ghStash, ghStash: null, provider: '', gEmail: '' }); syncNow(true); location.hash = '#/library'; } }, 'Voltar à conta admin') : null,
    h('p', { class: 'muted small' }, h('a', { href: 'privacidade.html', target: '_blank', rel: 'noopener' }, 'Política de privacidade'))));
  return {};
}

/** Mostrado a convidados no lugar da lista, agenda, stats… */
export function mountGate(root, what) {
  root.append(h('div', { class: 'empty gate' },
    h('div', { class: 'empty-e' }, icon('heart', 44)),
    h('h3', null, 'Precisas de conta'),
    h('p', null, `${what} só está disponível com conta. Entra com o teu Gmail (é grátis e demora uns segundos) e a tua lista passa a ficar guardada.`),
    googleButton('Entrar com Google', () => { location.hash = '#/library'; })));
  return {};
}
