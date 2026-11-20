// Sincronização com um repositório privado do GitHub: a lista fica num ficheiro JSON
// e cada alteração é um commit (tens histórico completo e podes voltar atrás).

import { state, subscribe, replaceData, setCfg, serialize, merge, normalize } from './store.js';

export const sync = { status: 'off', msg: '', at: 0 };
const listeners = new Set();
export const onSyncChange = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
function set(status, msg = '') {
  sync.status = status; sync.msg = msg;
  if (status === 'ok') { sync.at = Date.now(); setCfg({ lastSync: sync.at }); }
  listeners.forEach((f) => f(sync));
}

export const configured = () => !!(state.cfg.repo && state.cfg.token);

function api(path, opts = {}, cfg = state.cfg) {
  return fetch('https://api.github.com' + path, {
    ...opts,
    cache: 'no-store', // a API do GitHub devolve respostas em cache por 60s; não queremos isso
    headers: {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      Authorization: 'Bearer ' + cfg.token,
      ...(opts.headers || {}),
    },
  });
}

const enc = (s) => {
  const b = new TextEncoder().encode(s);
  let bin = '';
  for (let i = 0; i < b.length; i += 0x8000) bin += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000));
  return btoa(bin);
};
const dec = (b64) => {
  const bin = atob(b64.replace(/\s/g, ''));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
};

function fileUrl(cfg) {
  const path = cfg.path.split('/').map(encodeURIComponent).join('/');
  return `/repos/${cfg.repo}/contents/${path}`;
}
const refQuery = (cfg) => (cfg.branch ? `?ref=${encodeURIComponent(cfg.branch)}` : '');

async function explain(r) {
  let m = '';
  try { m = (await r.json()).message || ''; } catch { /* sem corpo */ }
  if (r.status === 401) return 'Token inválido ou expirado. Cria um novo em github.com/settings/tokens.';
  if (r.status === 403) return 'O token não tem permissão (precisa de "Contents: Read and write" neste repositório). ' + m;
  if (r.status === 404) return 'Repositório não encontrado, ou o token não tem acesso a ele.';
  return `GitHub respondeu ${r.status}. ${m}`;
}

async function pull() {
  const cfg = state.cfg;
  const url = fileUrl(cfg) + refQuery(cfg);
  const r = await api(url);
  if (r.status === 404) {
    // ficheiro ainda não existe (normal na primeira vez) — mas confirma que o repo é acessível
    const rr = await api(`/repos/${cfg.repo}`);
    if (!rr.ok) throw new Error(await explain(rr));
    return { data: null, sha: null };
  }
  if (!r.ok) throw new Error(await explain(r));
  const j = await r.json();
  let text;
  if (j.content && j.encoding === 'base64') text = dec(j.content);
  else {
    const r2 = await api(url, { headers: { Accept: 'application/vnd.github.raw+json' } });
    text = await r2.text();
  }
  return { data: normalize(JSON.parse(text)), sha: j.sha };
}

async function put(text, sha) {
  const cfg = state.cfg;
  const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ');
  const body = { message: `Otakuteca ${stamp}`, content: enc(text) };
  if (sha) body.sha = sha;
  if (cfg.branch) body.branch = cfg.branch;
  const r = await api(fileUrl(cfg), { method: 'PUT', body: JSON.stringify(body) });
  if (r.status === 409 || r.status === 422) return 'conflict'; // alguém (outro aparelho) escreveu entretanto
  if (!r.ok) throw new Error(await explain(r));
  return 'ok';
}

let busy = false, again = false, timer = 0;

export async function syncNow() {
  if (!configured()) return;
  if (busy) { again = true; return; }
  busy = true;
  set('syncing');
  try {
    for (let i = 0; i < 3; i++) {
      const { data: remote, sha } = await pull();
      const local = state.data;
      const merged = remote ? merge(local, remote) : local;
      const text = serialize(merged);
      if (serialize(local) !== text) replaceData(merged);   // veio coisa nova de outro aparelho
      if (remote && serialize(remote) === text) { set('ok'); return; }
      if ((await put(text, sha)) === 'ok') { set('ok'); return; }
    }
    throw new Error('Conflitos repetidos. Tenta outra vez daqui a pouco.');
  } catch (e) {
    set(navigator.onLine ? 'error' : 'offline', navigator.onLine ? e.message : 'Sem ligação. Fica guardado neste aparelho e sincroniza quando voltares online.');
  } finally {
    busy = false;
    if (again) { again = false; schedule(1500); }
  }
}

export function schedule(ms = 2500) {
  if (!configured() || !state.cfg.autoSync) return;
  clearTimeout(timer);
  timer = setTimeout(syncNow, ms);
}

/** Verifica o repositório/token antes de guardar as definições. */
export async function testConnection(cfg) {
  if (!/^[\w.-]+\/[\w.-]+$/.test(cfg.repo)) return { ok: false, msg: 'O repositório tem de ser no formato dono/nome (ex.: paulo/otakuteca-dados).' };
  if (!cfg.token) return { ok: false, msg: 'Falta o token.' };
  try {
    const r = await api(`/repos/${cfg.repo}`, {}, cfg);
    if (!r.ok) return { ok: false, msg: await explain(r) };
    const j = await r.json();
    if (j.permissions && j.permissions.push === false) return { ok: false, msg: 'O token só consegue ler. Precisa de permissão de escrita (Contents: Read and write).' };
    return { ok: true, isPrivate: !!j.private, name: j.full_name };
  } catch {
    return { ok: false, msg: 'Não consegui contactar o GitHub. Estás online?' };
  }
}

export function initSync() {
  subscribe((k) => { if (k === 'local') schedule(); });
  const wake = () => {
    if (configured() && state.cfg.autoSync && Date.now() - (sync.at || 0) > 45e3) syncNow();
  };
  document.addEventListener('visibilitychange', () => { if (!document.hidden) wake(); });
  window.addEventListener('online', () => syncNow());
  if (configured()) { set('idle'); syncNow(); }
}
