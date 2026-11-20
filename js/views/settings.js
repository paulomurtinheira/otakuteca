// "Mais" (menu dos extras) e Definições (sync com o GitHub, importar/exportar, preferências).

import { h, clear, dayStr, download } from '../util.js';
import { state, setCfg, serialize, mergeIn, normalize, wipeLocal, all } from '../store.js';
import { sync, syncNow, testConnection, onSyncChange, configured } from '../sync.js';
import { importAniList, importMal } from '../importers.js';
import { icon, toast, confirmSheet } from '../ui.js';

const ago = (t) => {
  if (!t) return 'nunca';
  const s = Math.round((Date.now() - t) / 1000);
  if (s < 60) return 'agora mesmo';
  if (s < 3600) return `há ${Math.round(s / 60)} min`;
  if (s < 86400) return `há ${Math.round(s / 3600)} h`;
  return new Date(t).toLocaleDateString('pt-PT');
};

export function syncChip() {
  const el = h('span', { class: 'sync-chip' });
  const paint = () => {
    const c = configured();
    const s = !c ? 'off' : sync.status;
    el.className = 'sync-chip ' + s;
    el.title = sync.msg || '';
    el.replaceChildren(icon('cloud', 15), ({
      off: 'Só neste aparelho', idle: 'GitHub ligado', syncing: 'A sincronizar…', ok: 'Sincronizado', error: 'Erro de sync', offline: 'Offline',
    })[s]);
  };
  paint();
  onSyncChange(paint);
  return el;
}

// ---------- menu "Mais" ----------
export function mountMore(root) {
  const tile = (hash, ic, title, text) => h('a', { class: 'tile', href: '#/' + hash }, h('div', { class: 'tile-i' }, icon(ic, 24)), h('div', null, h('b', null, title), h('small', null, text)));
  root.append(h('div', { class: 'head' }, h('h1', null, 'Mais'), syncChip()),
    h('div', { class: 'tiles' },
      tile('wrapped', 'sparkle', 'Retrospetiva', 'O teu ano em anime, em stories'),
      tile('roulette', 'dice', 'Roleta', 'Não sabes o que ver? Gira'),
      tile('tiers', 'tiers', 'Tier list', 'Classifica os teus favoritos'),
      tile('settings', 'sliders', 'Definições', 'Sync, importar, aparência')));
  return {};
}

// ---------- definições ----------
export function mount(root) {
  const body = h('div', { class: 'settings' });
  root.append(h('div', { class: 'head' }, h('h1', null, 'Definições')), body);

  // --- GitHub ---
  const f = {
    repo: h('input', { class: 'field', placeholder: 'o-teu-nome/otakuteca-dados', value: state.cfg.repo, autocapitalize: 'off', autocomplete: 'off', spellcheck: false }),
    path: h('input', { class: 'field', value: state.cfg.path, autocapitalize: 'off', spellcheck: false }),
    branch: h('input', { class: 'field', placeholder: 'predefinido', value: state.cfg.branch, autocapitalize: 'off', spellcheck: false }),
    token: h('input', { class: 'field', type: 'password', placeholder: 'github_pat_…', value: state.cfg.token, autocomplete: 'off' }),
  };
  const msg = h('div', { class: 'msg' });
  const statusLine = h('div', { class: 'muted small' });
  const paintStatus = () => {
    statusLine.textContent = configured() ? `Último sync: ${ago(state.cfg.lastSync)}${sync.msg && sync.status === 'error' ? ' · ' + sync.msg : ''}` : '';
    if (sync.status === 'error') { msg.className = 'msg bad'; msg.textContent = sync.msg; }
  };
  onSyncChange(paintStatus);

  const connect = h('div', { class: 'panel' },
    h('div', { class: 'panel-h' }, h('h3', null, '☁️ Guardar no GitHub'), syncChip()),
    h('p', { class: 'muted small' }, 'A tua lista fica num ficheiro dentro de um repositório teu (privado). Cada alteração é um commit: nunca perdes nada e vês o histórico. Funciona igual no PC e no iPhone.'),
    h('label', { class: 'lbl' }, 'Repositório', f.repo),
    h('div', { class: 'row gap' }, h('label', { class: 'lbl grow' }, 'Ficheiro', f.path), h('label', { class: 'lbl grow' }, 'Branch (opcional)', f.branch)),
    h('label', { class: 'lbl' }, 'Token de acesso', f.token),
    h('div', { class: 'row gap wrap' },
      h('button', {
        class: 'btn primary',
        async onclick(e) {
          const cfg = { repo: f.repo.value.trim().replace(/^https?:\/\/github\.com\//, '').replace(/\.git$/, ''), path: f.path.value.trim() || 'otakuteca.json', branch: f.branch.value.trim(), token: f.token.value.trim() };
          e.target.disabled = true;
          msg.className = 'msg'; msg.textContent = 'A testar…';
          const r = await testConnection(cfg);
          e.target.disabled = false;
          if (!r.ok) { msg.className = 'msg bad'; msg.textContent = r.msg; return; }
          setCfg(cfg);
          msg.className = 'msg ' + (r.isPrivate ? 'good' : 'warn');
          msg.textContent = r.isPrivate ? `Ligado a ${r.name} ✔` : `⚠️ ${r.name} é PÚBLICO: qualquer pessoa pode ver a tua lista. Cria um repositório privado.`;
          syncNow().then(() => { paintStatus(); toast('Sincronizado'); });
        },
      }, 'Testar e guardar'),
      h('button', { class: 'btn', async onclick() { if (!configured()) { toast('Liga primeiro o GitHub'); return; } await syncNow(); paintStatus(); } }, icon('refresh', 16), ' Sincronizar agora'),
      configured() ? h('button', { class: 'btn danger-ghost', onclick() { setCfg({ token: '', repo: '', lastSync: 0 }); f.token.value = ''; f.repo.value = ''; msg.textContent = 'Desligado. A lista continua neste aparelho.'; } }, 'Desligar') : null),
    msg, statusLine,
    h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: state.cfg.autoSync, onchange(e) { setCfg({ autoSync: e.target.checked }); } }), ' Sincronizar automaticamente'),
    h('details', { class: 'how' }, h('summary', null, 'Como configurar (2 minutos)'),
      h('ol', null,
        h('li', null, 'Em ', h('a', { href: 'https://github.com/new', target: '_blank', rel: 'noopener' }, 'github.com/new'), ' cria um repositório chamado ', h('b', null, 'otakuteca-dados'), ', marca ', h('b', null, 'Private'), ' e "Add a README".'),
        h('li', null, 'Abre ', h('a', { href: 'https://github.com/settings/personal-access-tokens/new', target: '_blank', rel: 'noopener' }, 'github.com/settings/personal-access-tokens/new'),
          ': escolhe "Only select repositories" → o teu repositório; em "Repository permissions" põe ', h('b', null, 'Contents: Read and write'), '. Gera e copia o token.'),
        h('li', null, 'Cola aqui o nome (', h('code', null, 'teu-nome/otakuteca-dados'), ') e o token e carrega em "Testar e guardar".'),
        h('li', null, 'No outro aparelho (iPhone ou PC) repete só este último passo com os mesmos dados. A lista aparece sozinha.')),
      h('p', { class: 'muted small' }, 'O token fica guardado apenas neste aparelho. Nunca vai para o repositório.')));

  // --- importar / exportar ---
  const imp = h('div', { class: 'msg' });
  const alName = h('input', { class: 'field', placeholder: 'o-teu-utilizador-anilist', autocapitalize: 'off', spellcheck: false });
  const jsonIn = h('input', { type: 'file', accept: '.json,application/json', hidden: true });
  const malIn = h('input', { type: 'file', accept: '.xml,.gz,application/xml,application/gzip', hidden: true });
  const say = (t, cls = '') => { imp.className = 'msg ' + cls; imp.textContent = t; };

  jsonIn.onchange = async () => {
    try {
      const n = mergeIn(JSON.parse(await jsonIn.files[0].text()));
      say(`Importado. ${n} títulos novos.`, 'good');
    } catch { say('Esse ficheiro não é uma cópia de segurança válida.', 'bad'); }
    jsonIn.value = '';
  };
  malIn.onchange = async () => {
    try {
      const r = await importMal(malIn.files[0], say);
      say(`MyAnimeList: ${r.added} novos` + (r.kept ? `, ${r.kept} já estavam na lista` : '') + (r.skipped ? `, ${r.skipped} não encontrados no AniList` : '') + '.', 'good');
    } catch (e) { say(e.message, 'bad'); }
    malIn.value = '';
  };

  const io = h('div', { class: 'panel' }, h('h3', null, '📥 Importar e exportar'),
    h('label', { class: 'lbl' }, 'Do AniList (lista pública)',
      h('div', { class: 'row gap' }, alName, h('button', {
        class: 'btn', async onclick(e) {
          if (!alName.value.trim()) return;
          e.target.disabled = true;
          try { const r = await importAniList(alName.value.trim(), say); say(`AniList: ${r.added} novos` + (r.kept ? `, ${r.kept} já estavam na lista` : '') + '.', 'good'); }
          catch (err) { say(err.message, 'bad'); }
          e.target.disabled = false;
        },
      }, 'Importar'))),
    h('div', { class: 'row gap wrap' },
      h('button', { class: 'btn', onclick: () => malIn.click() }, icon('upload', 16), ' Do MyAnimeList (.xml)'),
      h('button', { class: 'btn', onclick: () => jsonIn.click() }, icon('upload', 16), ' Cópia de segurança (.json)'),
      h('button', { class: 'btn', onclick: () => download(`otakuteca-${dayStr()}.json`, serialize(state.data)) }, icon('download', 16), ' Exportar cópia')),
    h('p', { class: 'muted small' }, 'MyAnimeList: em myanimelist.net/panel/export descarrega o ficheiro e escolhe-o aqui. Importar nunca apaga o que já tens.'),
    imp, jsonIn, malIn);

  // --- aparência ---
  const prefs = h('div', { class: 'panel' }, h('h3', null, '🎨 Preferências'),
    h('div', { class: 'row gap wrap' },
      h('label', { class: 'lbl grow' }, 'Títulos',
        h('select', { class: 'field', onchange(e) { setCfg({ titleLang: e.target.value }); } },
          [['romaji', 'Romaji (Shingeki no Kyojin)'], ['english', 'Inglês (Attack on Titan)']].map(([v, l]) => h('option', { value: v, selected: v === state.cfg.titleLang }, l)))),
      h('label', { class: 'lbl grow' }, 'Tema',
        h('select', { class: 'field', onchange(e) { setCfg({ theme: e.target.value }); } },
          [['dark', 'Escuro'], ['light', 'Claro'], ['auto', 'Automático']].map(([v, l]) => h('option', { value: v, selected: v === state.cfg.theme }, l))))));

  const ios = h('div', { class: 'panel' }, h('h3', null, '📱 Instalar como app'),
    h('p', { class: 'small' }, h('b', null, 'iPhone: '), 'abre esta página no Safari → botão Partilhar → "Adicionar ao ecrã principal". Passa a abrir como uma app a sério, sem barra do browser.'),
    h('p', { class: 'small muted' }, 'Importante: a app instalada tem o seu próprio armazenamento, separado do Safari. Liga o GitHub (acima) já dentro da app do ecrã principal, e a lista aparece sozinha.'),
    h('p', { class: 'small' }, h('b', null, 'PC: '), 'no Chrome/Edge, ícone de instalar na barra de endereços.'));

  const danger = h('div', { class: 'panel' }, h('h3', null, 'Zona perigosa'),
    h('p', { class: 'muted small' }, 'Apaga a lista guardada neste aparelho. Se o GitHub estiver ligado, a lista volta no próximo sync (e isso é uma boa forma de a recuperar).'),
    h('button', { class: 'btn danger-ghost', onclick() { confirmSheet({ title: 'Apagar a lista deste aparelho?', text: `${all().length} títulos serão removidos daqui.`, ok: 'Apagar', danger: true, onOk() { wipeLocal(); toast('Lista local apagada'); } }); } }, icon('trash', 16), ' Apagar lista local'));

  body.append(connect, io, prefs, ios, danger, h('p', { class: 'muted small center' }, 'Otakuteca · dados dos títulos: AniList'));
  paintStatus();
  return {};
}
