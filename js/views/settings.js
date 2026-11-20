// "Mais" (menu dos extras) e Definições (sync com o GitHub, importar/exportar, preferências).

import { h, clear, dayStr, download } from '../util.js';
import { state, setCfg, serialize, mergeIn, normalize, wipeLocal, all } from '../store.js';
import { sync, syncNow, testConnection, onSyncChange, configured, provider } from '../sync.js';
import { signIn, signOut, clientId } from '../gdrive.js';
import { importAniList, importMal } from '../importers.js';
import { icon, toast, confirmSheet } from '../ui.js';
import { list as mySources, add as addSource, removeSource } from '../sources.js';

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
      off: 'Só neste aparelho', idle: provider() === 'google' ? 'Google ligado' : 'GitHub ligado', syncing: 'A sincronizar…', ok: 'Sincronizado', error: 'Erro de sync', offline: 'Offline', login: 'Toca para renovar login',
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

  // --- Entrar com Google ---
  const gBox = h('div', { class: 'panel' });
  const gMsg = h('div', { class: 'msg' });
  const gChip = syncChip();
  const sayG = (t, cls = '') => { gMsg.className = 'msg ' + cls; gMsg.textContent = t; };
  function paintGoogle() {
    clear(gBox);
    const on = provider() === 'google';
    gBox.append(h('div', { class: 'panel-h' }, h('h3', null, '👤 Entrar com Google'), gChip),
      h('p', { class: 'muted small' }, 'Entra com o teu Gmail e a lista fica guardada numa pasta escondida da tua Google Drive, que só esta app vê. Sem criar contas, sem tokens, e funciona igual no PC e no iPhone.'));
    if (on) {
      gBox.append(h('p', null, 'Ligado como ', h('b', null, state.cfg.gEmail)),
        h('div', { class: 'row gap wrap' },
          h('button', { class: 'btn', async onclick() { await syncNow(); sayG('Sincronizado.', 'good'); } }, icon('refresh', 16), ' Sincronizar agora'),
          h('button', { class: 'btn danger-ghost', onclick() { signOut(); paintGoogle(); paintStatus(); sayG('Sessão terminada. A lista continua neste aparelho.'); } }, 'Terminar sessão')),
        h('p', { class: 'muted small' }, 'A Google pede a renovação do login de hora a hora. Quando aparecer "Toca para renovar login", basta tocares em qualquer sítio da app.'));
    } else if (!clientId()) {
      const idIn = h('input', { class: 'field', placeholder: '123456789-abc….apps.googleusercontent.com', autocapitalize: 'off', autocomplete: 'off', spellcheck: false });
      gBox.append(h('p', { class: 'msg warn' }, 'Falta configurar o login da Google (é feito uma vez por quem publica a app).'),
        h('label', { class: 'lbl' }, 'ID de cliente da Google', idIn),
        h('button', { class: 'btn', onclick() { const v = idIn.value.trim(); if (!/\.apps\.googleusercontent\.com$/.test(v)) { sayG('Esse ID não parece válido. Termina em .apps.googleusercontent.com', 'bad'); return; } setCfg({ gclient: v }); paintGoogle(); } }, 'Guardar'),
        h('details', { class: 'how' }, h('summary', null, 'Como obter o ID (5 minutos)'),
          h('ol', null,
            h('li', null, 'Em ', h('a', { href: 'https://console.cloud.google.com/projectcreate', target: '_blank', rel: 'noopener' }, 'console.cloud.google.com'), ' cria um projeto (qualquer nome).'),
            h('li', null, 'Em "APIs e serviços → Biblioteca" ativa a ', h('b', null, 'Google Drive API'), '.'),
            h('li', null, 'Em "Ecrã de consentimento OAuth" escolhe "Externo", preenche o nome da app e o teu email, e no fim carrega em ', h('b', null, 'Publicar app'), ' (o acesso pedido é só a pasta da própria app, não precisa de verificação).'),
            h('li', null, 'Em "Credenciais → Criar credenciais → ID de cliente OAuth" escolhe "Aplicação Web" e em "Origens JavaScript autorizadas" põe o endereço desta app (', h('code', null, location.origin), ').'),
            h('li', null, 'Copia o ID que acaba em .apps.googleusercontent.com e cola acima.'))));
    } else {
      gBox.append(h('button', {
        class: 'btn primary',
        async onclick(e) {
          e.target.disabled = true;
          sayG('A abrir o login da Google…');
          try {
            const email = await signIn();
            sayG('Ligado como ' + email + ' ✔', 'good');
            paintGoogle(); paintStatus();
            syncNow().then(() => { paintStatus(); toast('Sincronizado'); });
          } catch (err) { sayG(err.message, 'bad'); }
          e.target.disabled = false;
        },
      }, 'Entrar com Google'));
    }
    gBox.append(gMsg);
  }
  onSyncChange(() => { if (gBox.isConnected) paintGoogle(); });
  paintGoogle();

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
          setCfg({ ...cfg, provider: 'github' });
          paintGoogle();
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

  // --- os meus sites ---
  const srcList = h('div', { class: 'src-list' });
  const srcMsg = h('div', { class: 'msg' });
  const srcName = h('input', { class: 'field', placeholder: 'O nome que queres ver no botão', maxLength: 30, autocomplete: 'off' });
  const srcUrl = h('input', { class: 'field', type: 'url', placeholder: 'https://…/{slug}/episodio-{ep}', autocapitalize: 'off', autocomplete: 'off', spellcheck: false });
  const srcUrl2 = h('input', { class: 'field', type: 'url', placeholder: 'https://…/{slug}  ou  https://…/search?q={titulo}', autocapitalize: 'off', autocomplete: 'off', spellcheck: false });
  const sayS = (t, cls = '') => { srcMsg.className = 'msg ' + cls; srcMsg.textContent = t; };
  const paintSources = () => {
    clear(srcList);
    const mine = mySources();
    if (!mine.length) srcList.append(h('p', { class: 'muted small' }, 'Ainda não tens nenhum site.'));
    for (const s of mine) {
      srcList.append(h('div', { class: 'src-row' },
        h('div', { class: 'src-main' }, h('b', null, s.name), h('small', { class: 'muted' }, s.url), s.url2 ? h('small', { class: 'muted' }, 'anime: ' + s.url2) : null),
        h('button', { class: 'icon-btn', 'aria-label': 'Remover ' + s.name, onclick() { removeSource(s.id); paintSources(); } }, icon('trash', 16))));
    }
  };
  const submitSource = () => {
    const err = addSource(srcName.value, srcUrl.value, srcUrl2.value);
    if (err) { sayS(err, 'bad'); return; }
    srcName.value = ''; srcUrl.value = ''; srcUrl2.value = '';
    sayS('Adicionado ✔', 'good');
    paintSources();
  };
  const sites = h('div', { class: 'panel' }, h('h3', null, '🔗 Os meus sites'),
    h('p', { class: 'muted small' }, 'A app não traz nenhum site. Acrescenta tu os que quiseres e em cada anime aparece um botão por site, já com o título e o próximo episódio. Fica guardado só neste aparelho.'),
    srcList,
    h('label', { class: 'lbl' }, 'Nome do site', srcName),
    h('label', { class: 'lbl' }, 'Endereço do episódio', srcUrl),
    h('label', { class: 'lbl' }, 'Página do anime (opcional)', srcUrl2),
    h('p', { class: 'muted small' }, 'Se o episódio der erro, o botão "anime" ao lado leva-te a esta página.'),
    h('button', { class: 'btn primary', onclick: submitSource }, 'Adicionar'),
    srcMsg,
    h('details', { class: 'how' }, h('summary', null, 'Como escrever o endereço'),
      h('p', { class: 'small' }, 'Copia o endereço de um episódio do site e troca as partes variáveis por estas etiquetas:'),
      h('ul', null,
        h('li', null, h('code', null, '{titulo}'), ' o título, pronto para pesquisa'),
        h('li', null, h('code', null, '{slug}'), ' o título em minúsculas com hífens (sousou-no-frieren)'),
        h('li', null, h('code', null, '{ep}'), ' o número do próximo episódio'),
        h('li', null, h('code', null, '{ano}'), ' o ano de estreia')),
      h('p', { class: 'small muted' }, 'Exemplo: https://exemplo.com/anime/{slug}/episodio-{ep}. Se não souberes o formato do site, usa a pesquisa: https://exemplo.com/search?q={titulo}.')));
  paintSources();

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

  body.append(gBox, connect, sites, io, prefs, ios, danger, h('p', { class: 'muted small center' }, 'Otakuteca · dados dos títulos: AniList · ', h('a', { href: 'privacidade.html', target: '_blank', rel: 'noopener' }, 'Privacidade')));
  paintStatus();
  return {};
}
