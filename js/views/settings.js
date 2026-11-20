// "Mais" (menu dos extras) e Definições, organizadas como numa app: lista de secções e uma página para cada.

import { h, clear, dayStr, download } from '../util.js';
import { state, setCfg, serialize, mergeIn, wipeLocal, all } from '../store.js';
import { sync, syncNow, testConnection, onSyncChange, configured, provider } from '../sync.js';
import { signIn, signOut, clientId } from '../gdrive.js';
import { importAniList, importMal } from '../importers.js';
import { icon, toast, confirmSheet } from '../ui.js';
import { list as mySources, add as addSource, removeSource, check, buildUrl, isSearch, hostOf, nameFromUrl } from '../sources.js';
import { animeTheme } from '../theme.js';
import { access } from '../account.js';

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

// Modo avançado: mostra o que só interessa a quem publica a app (sync por GitHub, ID de cliente da Google).
// Quem já tinha o GitHub ligado continua a vê-lo.
const devMode = () => !!state.cfg.dev || provider() === 'github';
const route = () => window.dispatchEvent(new HashChangeEvent('hashchange'));

// ---------- menu "Mais" ----------
export function mountMore(root) {
  const tile = (hash, ic, title, text) => h('a', { class: 'tile', href: '#/' + hash }, h('div', { class: 'tile-i' }, icon(ic, 24)), h('div', null, h('b', null, title), h('small', null, text)));
  root.append(h('div', { class: 'head' }, h('h1', null, 'Mais'), syncChip()),
    h('div', { class: 'tiles' },
      tile('wrapped', 'sparkle', 'Retrospetiva', 'O teu ano em anime, em stories'),
      tile('roulette', 'dice', 'Roleta', 'Não sabes o que ver? Gira'),
      tile('tiers', 'tiers', 'Tier list', 'Classifica os teus favoritos'),
      tile('settings', 'sliders', 'Definições', 'Conta, aparência, sites, dados')));
  return {};
}

// ---------- peças das definições ----------
/** Uma linha da lista (como nas Definições do telemóvel): ícone colorido, título, valor e seta. */
function row({ ic, color, title, sub, value, href, onclick, target }) {
  return h(href ? 'a' : 'button', { class: 'set-row', href, target, rel: target ? 'noopener' : null, onclick },
    ic ? h('span', { class: 'set-ic', style: { background: color || 'var(--accent)' } }, icon(ic, 18)) : null,
    h('span', { class: 'set-t' }, title, sub ? h('small', { class: 'set-sub' }, sub) : null),
    value ? h('span', { class: 'set-v' }, value) : null,
    icon('chevron', 16));
}
function switchRow(title, sub, checked, onChange) {
  return h('label', { class: 'set-row' },
    h('span', { class: 'set-t' }, title, sub ? h('small', { class: 'set-sub' }, sub) : null),
    h('input', { type: 'checkbox', class: 'switch', checked, onchange: (e) => onChange(e.target.checked) }));
}
const group = (title, kids, foot) => h('section', { class: 'set-group' },
  title ? h('h5', null, title) : null,
  h('div', { class: 'set-card' }, kids),
  foot ? h('p', { class: 'set-foot' }, foot) : null);

const THEME_NAME = { dark: 'Escuro', light: 'Claro', auto: 'Automático' };

// ---------- definições ----------
export function mount(root, sub) {
  const body = h('div', { class: 'settings' });
  root.append(body);
  const page = { account, look, sites, data, install, advanced }[sub];
  if (page && (sub !== 'advanced' || devMode())) page(body);
  else home(body);
  return {};
}

/** Cabeçalho de uma sub-página, com o botão de voltar. */
function pageHead(body, title) {
  body.append(h('div', { class: 'set-head' },
    h('a', { class: 'set-back', href: '#/settings' }, icon('back', 20), h('span', null, 'Definições')),
    h('h1', null, title)));
}

// ----- ecrã principal -----
function home(body) {
  const mode = access();
  const email = provider() === 'google' ? state.cfg.gEmail : provider() === 'github' ? state.cfg.repo : '';
  const nsites = mySources().length;
  const initial = (email || '?').trim()[0].toUpperCase();

  body.append(
    h('div', { class: 'head' }, h('h1', null, 'Definições')),
    h('a', { class: 'profile', href: '#/settings/account' },
      h('span', { class: 'avatar' }, email ? initial : icon('user', 26)),
      h('span', { class: 'profile-t' },
        h('b', null, email || (mode === 'guest' ? 'Convidado' : 'Sem conta')),
        h('small', null, email ? 'A tua lista está guardada na tua conta' : 'Cria conta para guardar a tua lista')),
      icon('chevron', 16)),
    group('A tua app', [
      row({ ic: 'palette', color: '#ec4899', title: 'Aparência', sub: 'Tema, idioma dos títulos, cores dos animes', value: THEME_NAME[state.cfg.theme], href: '#/settings/look' }),
      row({ ic: 'link', color: '#3b82f6', title: 'Os meus sites', sub: 'Botões para ver os episódios', value: nsites ? String(nsites) : 'nenhum', href: '#/settings/sites' }),
      row({ ic: 'download', color: '#10b981', title: 'Dados e cópias', sub: 'Importar do AniList / MyAnimeList, exportar', value: all().length + ' títulos', href: '#/settings/data' }),
    ]),
    group('Ajuda', [
      row({ ic: 'phone', color: '#f59e0b', title: 'Instalar como app', sub: 'iPhone e PC', href: '#/settings/install' }),
      row({ ic: 'shield', color: '#64748b', title: 'Privacidade', href: 'privacidade.html', target: '_blank' }),
    ]),
    ...(devMode() ? [group('Avançado', [row({ ic: 'sliders', color: '#8b5cf6', title: 'Modo avançado', sub: 'Sync por GitHub, ID de cliente da Google', href: '#/settings/advanced' })])] : []));

  // Tocar 5 vezes no rodapé liga o modo avançado (GitHub, ID de cliente da Google). Os clientes não precisam disto.
  let taps = 0;
  body.append(h('p', {
    class: 'set-foot center',
    onclick() {
      if (devMode()) return;
      if (++taps >= 5) { setCfg({ dev: true }); toast('Modo avançado ativado'); route(); }
    },
  }, 'Otakuteca · dados dos títulos: AniList'));
}

// ----- Conta -----
function account(body) {
  pageHead(body, 'Conta');
  const box = h('div');
  const msg = h('div', { class: 'msg' });
  const say = (t, cls = '') => { msg.className = 'msg ' + cls; msg.textContent = t; };
  const mode = () => access();

  function paint() {
    clear(box);
    const on = provider() === 'google';
    if (on) {
      box.append(
        h('div', { class: 'profile static' },
          h('span', { class: 'avatar' }, (state.cfg.gEmail || '?')[0].toUpperCase()),
          h('span', { class: 'profile-t' }, h('b', null, state.cfg.gEmail), h('small', null, 'Google')), syncChip()),
        group(null, [
          row({ ic: 'refresh', color: '#3b82f6', title: 'Sincronizar agora', sub: 'Último sync: ' + ago(state.cfg.lastSync), onclick: async () => { await syncNow(); say('Sincronizado.', 'good'); paint(); } }),
        ], 'A lista fica numa pasta escondida da tua Google Drive que só esta app vê. A Google pede a renovação do login de hora a hora: quando aparecer "Toca para renovar login", toca em qualquer sítio da app.'),
        group(null, [
          h('button', { class: 'set-row danger', onclick() { signOut(); paint(); say('Sessão terminada. A lista continua neste aparelho.'); } }, h('span', { class: 'set-t' }, 'Terminar sessão')),
        ]));
    } else if (provider() === 'github') {
      box.append(group(null, [row({ ic: 'sliders', color: '#8b5cf6', title: 'Ligado pelo GitHub', sub: state.cfg.repo, href: '#/settings/advanced' })]));
    } else {
      box.append(h('div', { class: 'set-hero' },
        h('span', { class: 'avatar big' }, icon('user', 34)),
        h('h3', null, mode() === 'guest' ? 'Estás como convidado' : 'Entra para guardar a tua lista'),
        h('p', { class: 'muted small' }, 'Com conta crias listas, agenda e estatísticas, e tudo fica guardado no teu Gmail (numa pasta escondida da tua Google Drive). Funciona igual no PC e no iPhone, sem criar palavras-passe.')));
      if (!clientId() && !devMode()) {
        box.append(h('p', { class: 'msg warn' }, 'O login com Google ainda não está disponível nesta app.'));
      } else if (!clientId()) {
        const idIn = h('input', { class: 'field', placeholder: '123456789-abc….apps.googleusercontent.com', autocapitalize: 'off', autocomplete: 'off', spellcheck: false });
        box.append(h('p', { class: 'msg warn' }, 'Falta configurar o login da Google (é feito uma vez por quem publica a app).'),
          h('label', { class: 'lbl' }, 'ID de cliente da Google', idIn),
          h('button', { class: 'btn', onclick() { const v = idIn.value.trim(); if (!/\.apps\.googleusercontent\.com$/.test(v)) { say('Esse ID não parece válido. Termina em .apps.googleusercontent.com', 'bad'); return; } setCfg({ gclient: v }); paint(); } }, 'Guardar'),
          h('details', { class: 'how' }, h('summary', null, 'Como obter o ID (5 minutos)'),
            h('ol', null,
              h('li', null, 'Em ', h('a', { href: 'https://console.cloud.google.com/projectcreate', target: '_blank', rel: 'noopener' }, 'console.cloud.google.com'), ' cria um projeto (qualquer nome).'),
              h('li', null, 'Em "APIs e serviços → Biblioteca" ativa a ', h('b', null, 'Google Drive API'), '.'),
              h('li', null, 'Em "Ecrã de consentimento OAuth" escolhe "Externo", preenche o nome da app, o teu email, o endereço da página inicial e o da política de privacidade, e no fim carrega em ', h('b', null, 'Publicar app'), '.'),
              h('li', null, 'Em "Credenciais → Criar credenciais → ID de cliente OAuth" escolhe "Aplicação Web" e em "Origens JavaScript autorizadas" põe ', h('code', null, location.origin), '.'),
              h('li', null, 'Copia o ID que acaba em .apps.googleusercontent.com e cola acima.'))));
      } else {
        box.append(h('button', {
          class: 'btn primary big',
          async onclick(e) {
            e.target.disabled = true;
            say('A abrir o login da Google…');
            try {
              const email = await signIn();
              say('Ligado como ' + email + ' ✔', 'good');
              paint();
              syncNow().then(() => toast('Sincronizado'));
            } catch (err) { say(err.message, 'bad'); }
            e.target.disabled = false;
          },
        }, 'Entrar com Google'));
      }
    }
    box.append(msg);
  }
  onSyncChange(() => { if (box.isConnected) paint(); });
  paint();
  body.append(box);
}

// ----- Aparência -----
function look(body) {
  pageHead(body, 'Aparência');

  // tema da app
  const tiles = [];
  const mark = () => tiles.forEach(([v, el]) => el.classList.toggle('on', state.cfg.theme === v));
  const tile = (v) => {
    const el = h('button', { class: 'theme-tile', onclick() { setCfg({ theme: v }); mark(); paintDemo(); } },
      h('span', { class: 'tt-prev tt-' + v }, h('i'), h('i'), h('i')),
      h('span', null, THEME_NAME[v]));
    tiles.push([v, el]);
    return el;
  };
  body.append(group('Tema da app', [h('div', { class: 'theme-pick' }, tile('dark'), tile('light'), tile('auto'))]));
  mark();

  // títulos
  const langs = [['romaji', 'Romaji', 'Shingeki no Kyojin'], ['english', 'Inglês', 'Attack on Titan']];
  body.append(group('Títulos dos animes', langs.map(([v, l, ex]) =>
    h('button', { class: 'set-row', onclick() { setCfg({ titleLang: v }); } },
      h('span', { class: 'set-t' }, l, h('small', { class: 'set-sub' }, ex)),
      state.cfg.titleLang === v ? h('span', { class: 'set-check' }, icon('check', 18)) : null))));

  // cores de cada anime
  const demo = h('div', { class: 'theme-demo' });
  const HUES = [['#e4a15d', 'Quente'], ['#5d9be4', 'Azul'], ['#e45d7a', 'Rosa'], ['#5dc98b', 'Verde']];
  const paintDemo = () => {
    clear(demo);
    demo.hidden = state.cfg.animeTheme === false;
    for (const dark of [true, false]) {
      for (const [c, name] of HUES) {
        const el = h('div', { class: 'td-card' }, h('i', { class: 'td-bar' }), h('i', { class: 'td-l' }), h('i', { class: 'td-l short' }), h('span', { class: 'td-b' }));
        for (const [k, v] of Object.entries(animeTheme(c, dark))) el.style.setProperty(k, v);
        el.title = name + (dark ? ' · escuro' : ' · claro');
        demo.append(el);
      }
    }
  };
  paintDemo();
  body.append(group('Cores de cada anime', [
    switchRow('Tema de cada anime', 'A página de cada anime ganha as cores da capa. Lá dentro, o botão da lua/sol troca entre escuro e claro.', state.cfg.animeTheme !== false, (v) => { setCfg({ animeTheme: v }); paintDemo(); }),
  ], null), demo);
}

// ----- Os meus sites -----
function sites(body) {
  pageHead(body, 'Os meus sites');
  const srcList = h('div', { class: 'src-list' });
  const srcMsg = h('div', { class: 'msg' });
  let nameAuto = true; // enquanto não escreveres o nome, a app sugere um a partir do endereço
  const srcName = h('input', { class: 'field', placeholder: 'O nome que queres ver no botão', maxLength: 30, autocomplete: 'off', oninput() { nameAuto = !srcName.value; } });
  const srcHint = h('p', { class: 'muted small' });
  const paintHint = () => {
    const v = srcUrl.value.trim();
    if (nameAuto) srcName.value = nameFromUrl(v);
    if (!v) { srcHint.textContent = 'Cola um link do site. Qualquer página serve, até a inicial.'; return; }
    srcHint.textContent = isSearch(v)
      ? `Sem etiquetas: o botão vai pesquisar o título e o episódio dentro de ${hostOf(v) || 'este site'}. É o mais prático e funciona em quase todos os sites.`
      : 'Com etiquetas: o botão abre diretamente o endereço montado.';
  };
  const srcUrl = h('input', { class: 'field', type: 'url', placeholder: 'https://… (cola aqui um link do site)', autocapitalize: 'off', autocomplete: 'off', spellcheck: false, oninput: paintHint });
  const srcUrl2 = h('input', { class: 'field', type: 'url', placeholder: 'https://…/{slug}  ou  https://…/search?q={titulo}', autocapitalize: 'off', autocomplete: 'off', spellcheck: false });
  const sayS = (t, cls = '') => { srcMsg.className = 'msg ' + cls; srcMsg.textContent = t; };
  const SAMPLE = { type: 'ANIME', title: 'Sousou no Frieren', en: "Frieren: Beyond Journey's End", year: 2023 };
  const testSource = () => {
    const err = check(srcName.value || 'teste', srcUrl.value, srcUrl2.value);
    if (err) { sayS(err, 'bad'); return; }
    window.open(buildUrl(srcUrl.value.trim(), SAMPLE, 1), '_blank', 'noopener,noreferrer');
    sayS('Abri o link para "Sousou no Frieren", episódio 1. Se for o certo, carrega em Adicionar.', '');
  };
  const paintSources = () => {
    clear(srcList);
    const mine = mySources();
    if (!mine.length) srcList.append(h('p', { class: 'muted small' }, 'Ainda não tens nenhum site.'));
    for (const s of mine) {
      srcList.append(h('div', { class: 'src-row' },
        h('div', { class: 'src-main' }, h('b', null, s.name), h('small', { class: 'muted' }, isSearch(s.url) ? '🔎 pesquisa em ' + hostOf(s.url) : s.url), s.url2 ? h('small', { class: 'muted' }, 'anime: ' + s.url2) : null),
        h('button', { class: 'icon-btn', 'aria-label': 'Remover ' + s.name, onclick() { removeSource(s.id); paintSources(); } }, icon('trash', 16))));
    }
  };
  const submitSource = () => {
    const err = addSource(srcName.value, srcUrl.value, srcUrl2.value);
    if (err) { sayS(err, 'bad'); return; }
    srcName.value = ''; srcUrl.value = ''; srcUrl2.value = ''; nameAuto = true; paintHint();
    sayS('Adicionado ✔', 'good');
    paintSources();
  };
  body.append(
    h('p', { class: 'set-foot first' }, 'A app não traz nenhum site. Acrescenta os que quiseres e em cada anime aparece um botão por site, já com o título e o próximo episódio. Fica guardado só neste aparelho.'),
    group('Os teus sites', [h('div', { class: 'set-pad' }, srcList)]),
    group('Adicionar um site', [h('div', { class: 'set-pad' },
      h('label', { class: 'lbl first' }, 'Link do site', srcUrl),
      srcHint,
      h('label', { class: 'lbl' }, 'Nome do site', srcName),
      h('details', { class: 'how' }, h('summary', null, 'Opções avançadas (página do anime)'),
        h('label', { class: 'lbl' }, 'Página do anime (opcional)', srcUrl2),
        h('p', { class: 'muted small' }, 'Se o episódio der erro, o botão "anime" ao lado leva-te a esta página.')),
      h('div', { class: 'row gap wrap sp' },
        h('button', { class: 'btn primary', onclick: submitSource }, 'Adicionar'),
        h('button', { class: 'btn', onclick: testSource }, 'Testar')),
      srcMsg)]),
    h('details', { class: 'how set-how' }, h('summary', null, 'Como escrever o endereço (avançado)'),
      h('p', { class: 'small' }, 'Se o site tem links previsíveis, copia o endereço de um episódio e troca as partes variáveis por estas etiquetas. Se os links têm códigos que não dá para adivinhar (como ?view=68747470…), deixa o link sem etiquetas e a app pesquisa dentro do site.'),
      h('ul', null,
        h('li', null, h('code', null, '{titulo}'), ' o título, pronto para pesquisa'),
        h('li', null, h('code', null, '{slug}'), ' o título em minúsculas com hífens (sousou-no-frieren)'),
        h('li', null, h('code', null, '{ep}'), ' o número do próximo episódio'),
        h('li', null, h('code', null, '{ano}'), ' o ano de estreia')),
      h('p', { class: 'small muted' }, 'Exemplo: https://exemplo.com/anime/{slug}/episodio-{ep}. Se não souberes o formato do site, usa a pesquisa: https://exemplo.com/search?q={titulo}.')));
  paintSources();
  paintHint();
}

// ----- Dados e cópias -----
function data(body) {
  pageHead(body, 'Dados e cópias');
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

  body.append(
    group('Importar', [
      h('div', { class: 'set-pad' },
        h('label', { class: 'lbl first' }, 'Do AniList (lista pública)',
          h('div', { class: 'row gap' }, alName, h('button', {
            class: 'btn', async onclick(e) {
              if (!alName.value.trim()) return;
              e.target.disabled = true;
              try { const r = await importAniList(alName.value.trim(), say); say(`AniList: ${r.added} novos` + (r.kept ? `, ${r.kept} já estavam na lista` : '') + '.', 'good'); }
              catch (err) { say(err.message, 'bad'); }
              e.target.disabled = false;
            },
          }, 'Importar')))),
      row({ ic: 'upload', color: '#3b82f6', title: 'Do MyAnimeList (.xml)', sub: 'Em myanimelist.net/panel/export descarrega o ficheiro', onclick: () => malIn.click() }),
      row({ ic: 'upload', color: '#8b5cf6', title: 'Cópia de segurança (.json)', onclick: () => jsonIn.click() }),
    ], 'Importar nunca apaga o que já tens.'),
    group('Exportar', [
      row({ ic: 'download', color: '#10b981', title: 'Exportar cópia', sub: 'Descarrega a tua lista num ficheiro', onclick: () => download(`otakuteca-${dayStr()}.json`, serialize(state.data)) }),
    ]),
    h('div', { class: 'set-pad' }, imp),
    group(null, [
      h('button', {
        class: 'set-row danger',
        onclick() { confirmSheet({ title: 'Apagar a lista deste aparelho?', text: `${all().length} títulos serão removidos daqui. Se tens conta, a cópia guardada na Google Drive volta no próximo sync.`, ok: 'Apagar', danger: true, onOk() { wipeLocal(); toast('Lista local apagada'); } }); },
      }, h('span', { class: 'set-t' }, 'Apagar lista deste aparelho')),
    ]), jsonIn, malIn);
}

// ----- Instalar como app -----
function install(body) {
  pageHead(body, 'Instalar como app');
  body.append(
    group('iPhone', [h('div', { class: 'set-pad' },
      h('ol', { class: 'steps' },
        h('li', null, 'Abre esta página no ', h('b', null, 'Safari'), '.'),
        h('li', null, 'Toca no botão ', h('b', null, 'Partilhar'), ' (o quadrado com a seta).'),
        h('li', null, 'Escolhe ', h('b', null, '"Adicionar ao ecrã principal"'), '.')),
      h('p', { class: 'muted small' }, 'Passa a abrir como uma app a sério, sem barra do browser. A app instalada tem o seu próprio armazenamento, separado do Safari: entra com Google já dentro dela e a lista aparece sozinha.'))]),
    group('PC', [h('div', { class: 'set-pad' },
      h('p', { class: 'small' }, 'No Chrome ou no Edge, toca no ícone de instalar na barra de endereços.'))]));
}

// ----- Avançado (só para quem publica a app) -----
function advanced(body) {
  pageHead(body, 'Modo avançado');
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

  body.append(
    group('Guardar no GitHub', [h('div', { class: 'set-pad' },
      h('div', { class: 'panel-h' }, h('span', { class: 'muted small' }, 'Em vez da conta Google'), syncChip()),
      h('p', { class: 'muted small' }, 'A tua lista fica num ficheiro dentro de um repositório teu (privado). Cada alteração é um commit: nunca perdes nada e vês o histórico.'),
      h('label', { class: 'lbl' }, 'Repositório', f.repo),
      h('div', { class: 'row gap' }, h('label', { class: 'lbl grow' }, 'Ficheiro', f.path), h('label', { class: 'lbl grow' }, 'Branch (opcional)', f.branch)),
      h('label', { class: 'lbl' }, 'Token de acesso', f.token),
      h('div', { class: 'row gap wrap sp' },
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
            msg.className = 'msg ' + (r.isPrivate ? 'good' : 'warn');
            msg.textContent = r.isPrivate ? `Ligado a ${r.name} ✔` : `⚠️ ${r.name} é PÚBLICO: qualquer pessoa pode ver a tua lista. Cria um repositório privado.`;
            syncNow().then(() => { paintStatus(); toast('Sincronizado'); });
          },
        }, 'Testar e guardar'),
        h('button', { class: 'btn', async onclick() { if (!configured()) { toast('Liga primeiro o GitHub'); return; } await syncNow(); paintStatus(); } }, icon('refresh', 16), ' Sincronizar agora'),
        configured() ? h('button', { class: 'btn danger-ghost', onclick() { setCfg({ token: '', repo: '', lastSync: 0 }); f.token.value = ''; f.repo.value = ''; msg.textContent = 'Desligado. A lista continua neste aparelho.'; } }, 'Desligar') : null),
      msg, statusLine,
      h('label', { class: 'check sp' }, h('input', { type: 'checkbox', checked: state.cfg.autoSync, onchange(e) { setCfg({ autoSync: e.target.checked }); } }), ' Sincronizar automaticamente'),
      h('details', { class: 'how' }, h('summary', null, 'Como configurar (2 minutos)'),
        h('ol', null,
          h('li', null, 'Em ', h('a', { href: 'https://github.com/new', target: '_blank', rel: 'noopener' }, 'github.com/new'), ' cria um repositório chamado ', h('b', null, 'otakuteca-dados'), ', marca ', h('b', null, 'Private'), ' e "Add a README".'),
          h('li', null, 'Abre ', h('a', { href: 'https://github.com/settings/personal-access-tokens/new', target: '_blank', rel: 'noopener' }, 'github.com/settings/personal-access-tokens/new'),
            ': escolhe "Only select repositories" → o teu repositório; em "Repository permissions" põe ', h('b', null, 'Contents: Read and write'), '. Gera e copia o token.'),
          h('li', null, 'Cola aqui o nome (', h('code', null, 'teu-nome/otakuteca-dados'), ') e o token e carrega em "Testar e guardar".')),
        h('p', { class: 'muted small' }, 'O token fica guardado apenas neste aparelho. Nunca vai para o repositório.')))]),
    ...(state.cfg.dev && provider() !== 'github' ? [group(null, [
      h('button', { class: 'set-row', onclick() { setCfg({ dev: false }); toast('Modo avançado desligado'); location.hash = '#/settings'; } }, h('span', { class: 'set-t' }, 'Desligar o modo avançado')),
    ])] : []));
  paintStatus();
}
