// "Os meus sites": ligações que tu configuras para abrires um título (ou o próximo
// episódio) no serviço onde o vês. A app não traz nenhum site de origem: a lista
// começa vazia e é o que cada pessoa acrescenta no seu aparelho.

import { state, setCfg, titleOf } from './store.js';

/** Como se escreve um endereço: {titulo} {slug} {ep} {ano} são trocados ao abrir. */
export const TAGS = {
  titulo: 'o título, já pronto para um endereço (ex.: Sousou%20no%20Frieren)',
  slug: 'o título em minúsculas com hífens (ex.: sousou-no-frieren)',
  ep: 'o número do próximo episódio',
  ano: 'o ano de estreia',
};

const MAX = 30;

export function slugify(s) {
  return String(s || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

export function list() {
  return Array.isArray(state.cfg.sources) ? state.cfg.sources : [];
}

/** Devolve uma mensagem de erro, ou '' se estiver tudo bem. */
function checkUrl(url, label) {
  const tags = url.match(/\{[^}]*\}/g) || [];
  for (const t of tags) {
    if (!(t.slice(1, -1) in TAGS)) return `"${t}" não existe. Usa {titulo}, {slug}, {ep} ou {ano}.`;
  }
  let u;
  try { u = new URL(url.replace(/\{[^}]*\}/g, 'x')); } catch { return `${label} não é válido.`; }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return `${label} tem de começar por https://`;
  return '';
}

/** Devolve uma mensagem de erro, ou '' se estiver tudo bem. `url2` (página do anime) é opcional. */
export function check(name, url, url2 = '') {
  name = (name || '').trim();
  url = (url || '').trim();
  url2 = (url2 || '').trim();
  if (!name) return 'Dá um nome ao site.';
  if (name.length > MAX) return `O nome pode ter até ${MAX} letras.`;
  if (!url) return 'Falta o endereço.';
  return checkUrl(url, 'O endereço') || (url2 ? checkUrl(url2, 'O endereço da página do anime') : '');
}

export function add(name, url, url2 = '') {
  const err = check(name, url, url2);
  if (err) return err;
  const all = list();
  if (all.length >= MAX) return `Podes ter até ${MAX} sites.`;
  const id = 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
  const s = { id, name: name.trim(), url: url.trim() };
  if (url2.trim()) s.url2 = url2.trim();
  setCfg({ sources: [...all, s] });
  return '';
}

export function removeSource(id) {
  setCfg({ sources: list().filter((s) => s.id !== id) });
}

/** Um endereço sem etiquetas (ex.: um link copiado do site) não dá para montar sozinho: a app pesquisa dentro do site. */
export const isSearch = (tpl) => !/\{[a-z]+\}/.test(tpl || '');

/** "https://www.exemplo.com/..." -> "exemplo.com" */
export function hostOf(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; }
}

/** Nome sugerido a partir do endereço: "https://www.meu-site.com/x" -> "Meu-site". */
export function nameFromUrl(url) {
  const h = hostOf(url).split('.')[0];
  return h ? h[0].toUpperCase() + h.slice(1) : '';
}

/**
 * Constrói o endereço final para um título e um episódio.
 * `kind` 'ep' = página do episódio, 'anime' = página do anime (só muda a pesquisa dentro do site).
 */
export function buildUrl(tpl, item, ep, kind = 'ep') {
  if (isSearch(tpl)) {
    const host = hostOf(tpl);
    const q = `site:${host} ${titleOf(item)}` + (kind === 'ep' && item.type !== 'MANGA' ? ` episódio ${ep}` : '');
    return 'https://www.google.com/search?q=' + encodeURIComponent(q);
  }
  return tpl.replace(/\{([a-z]+)\}/g, (_, t) => {
    if (t === 'titulo') return encodeURIComponent(titleOf(item));
    if (t === 'slug') return slugify(item.title || item.en);
    if (t === 'ep') return String(ep);
    if (t === 'ano') return item.year ? String(item.year) : '';
    return '';
  });
}
