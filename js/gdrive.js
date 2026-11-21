// Entrar com Google: a lista fica num ficheiro escondido na Google Drive de quem entra
// (pasta "appDataFolder": só esta app lê e escreve lá, nem aparece na Drive da pessoa).
// Não há servidor nem contas nossas: o "login" é a própria conta Gmail.

import { state, setCfg, normalize } from './store.js';
import { GOOGLE_CLIENT_ID } from './config.js';

const SCOPE = 'https://www.googleapis.com/auth/drive.appdata openid email profile';
const FILE = 'otakuteca.json';

let tok = { value: '', exp: 0 };
let gisP = null;

export const clientId = () => (state.cfg.gclient || GOOGLE_CLIENT_ID || '').trim();
export const hasToken = () => !!tok.value && Date.now() < tok.exp - 60e3;

function loginError(msg) { const e = new Error(msg); e.login = true; return e; }

/** Carrega o script de login da Google (só quando é preciso). */
export function loadGis() {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  if (gisP) return gisP;
  gisP = new Promise((ok, bad) => {
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.onload = ok;
    s.onerror = () => { gisP = null; bad(new Error('Não consegui carregar o login da Google. Estás online?')); };
    document.head.append(s);
  });
  return gisP;
}

/**
 * Devolve um token de acesso (dura ~1 hora e só fica em memória).
 * interactive=true mostra a janela de login; false tenta renovar sem perguntar nada.
 * Quando o GIS já está carregado não há nenhum "await" antes de abrir a janela: assim
 * ela abre dentro do toque do utilizador, que é o que o Safari exige.
 */
export function getToken(interactive) {
  if (hasToken()) return Promise.resolve(tok.value);
  const id = clientId();
  if (!id) return Promise.reject(new Error('Falta o ID de cliente da Google (ver Definições).'));
  const ask = () => new Promise((ok, bad) => {
    // se a janela nunca responder (bloqueada, esquecida), não deixa a sincronização presa para sempre
    const timer = setTimeout(() => bad(loginError('A janela de login não respondeu. Toca para tentar outra vez.')), interactive ? 120e3 : 25e3);
    const done = (f, v) => { clearTimeout(timer); f(v); };
    const c = window.google.accounts.oauth2.initTokenClient({
      client_id: id,
      scope: SCOPE,
      hint: state.cfg.gEmail || undefined,
      callback: (r) => {
        if (r.error) return done(bad, loginError(r.error_description || r.error));
        tok = { value: r.access_token, exp: Date.now() + (+r.expires_in || 3600) * 1000 };
        done(ok, tok.value);
      },
      error_callback: (e) => done(bad, loginError(e?.type === 'popup_closed'
        ? 'Fechaste a janela de login.'
        : 'A janela de login não abriu. Permite janelas pop-up para este site e toca outra vez. Se continuar, em Conta toca em "Terminar sessão" e entra de novo.')),
    });
    c.requestAccessToken({ prompt: interactive ? 'select_account' : '' });
  });
  return window.google?.accounts?.oauth2 ? ask() : loadGis().then(ask);
}

/** Entra (ou volta a entrar) e guarda o email. Chamar a partir de um toque/clique. */
export async function signIn() {
  const t = await getToken(true);
  const r = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', { headers: { Authorization: 'Bearer ' + t } });
  if (!r.ok) throw new Error('Não consegui ler a conta Google.');
  const u = await r.json();
  setCfg({ provider: 'google', gEmail: u.email || 'conta Google' });
  return u.email;
}

export function signOut() {
  try { if (tok.value) window.google?.accounts?.oauth2?.revoke?.(tok.value, () => {}); } catch { /* ok */ }
  tok = { value: '', exp: 0 };
  setCfg({ provider: '', gEmail: '' });
}

async function drive(path, opts = {}, upload = false) {
  const t = await getToken(false);
  const base = (upload ? 'https://www.googleapis.com/upload/drive/v3' : 'https://www.googleapis.com/drive/v3');
  const r = await fetch(base + path, {
    ...opts,
    cache: 'no-store',
    headers: { Authorization: 'Bearer ' + t, ...(opts.headers || {}) },
  });
  if (r.status === 401) { tok = { value: '', exp: 0 }; throw loginError('A sessão da Google expirou. Toca em qualquer sítio para renovar.'); }
  if (r.status === 403) throw new Error('A Google recusou o acesso. Sai e volta a entrar, e aceita o acesso à pasta da app.');
  if (!r.ok) throw new Error(`A Google Drive respondeu ${r.status}.`);
  return r;
}

export async function pull() {
  const q = encodeURIComponent(`name='${FILE}' and 'appDataFolder' in parents and trashed=false`);
  const r = await drive(`/files?spaces=appDataFolder&q=${q}&orderBy=createdTime&pageSize=1&fields=files(id)`);
  const f = (await r.json()).files?.[0];
  if (!f) return { data: null, sha: null };
  const rr = await drive(`/files/${f.id}?alt=media`);
  return { data: normalize(JSON.parse(await rr.text())), sha: f.id };
}

export async function put(text, id) {
  if (id) {
    await drive(`/files/${id}?uploadType=media`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: text }, true);
    return 'ok';
  }
  const b = 'otk' + Date.now().toString(36);
  const meta = JSON.stringify({ name: FILE, parents: ['appDataFolder'] });
  const body = `--${b}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n--${b}\r\nContent-Type: application/json\r\n\r\n${text}\r\n--${b}--`;
  await drive('/files?uploadType=multipart', { method: 'POST', headers: { 'Content-Type': `multipart/related; boundary=${b}` }, body }, true);
  return 'ok';
}
