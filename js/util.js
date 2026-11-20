// Pequenas ferramentas partilhadas por toda a app.

export const $ = (s, r = document) => r.querySelector(s);

/** Cria um elemento: h('div', {class:'x', onclick(){}}, 'texto', outroElemento) */
export function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (v == null || (v === false && k !== 'spellcheck')) continue;
      if (k === 'spellcheck') el.setAttribute('spellcheck', String(v));
      else if (k === 'class') el.className = v;
      else if (k === 'style') {
        if (typeof v === 'string') el.style.cssText = v;
        else for (const [p, val] of Object.entries(v)) {
          if (p.startsWith('--')) el.style.setProperty(p, val);
          else el.style[p] = val;
        }
      } else if (k === 'dataset') Object.assign(el.dataset, v);
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
      else if (k in el && k !== 'list' && k !== 'form') el[k] = v;
      else el.setAttribute(k, v === true ? '' : v);
    }
  }
  add(el, kids);
  return el;
}

function add(el, kids) {
  for (const k of kids) {
    if (k == null || k === false || k === true) continue;
    if (Array.isArray(k)) add(el, k);
    else el.append(k.nodeType ? k : document.createTextNode(String(k)));
  }
}

export const clear = (el) => { while (el.firstChild) el.removeChild(el.firstChild); return el; };
export const pad = (n) => String(n).padStart(2, '0');
export const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
export const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
export const plural = (n, s, p) => (n === 1 ? s : p);

/** Data local no formato AAAA-MM-DD (é assim que guardamos os dias). */
export function dayStr(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
export function parseDay(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}
export function fmtDay(s) {
  if (!s) return '';
  return parseDay(s).toLocaleDateString('pt-PT', { day: 'numeric', month: 'short', year: 'numeric' });
}
export function fmtCountdown(ms) {
  if (ms <= 0) return 'agora';
  const m = Math.floor(ms / 60000);
  const d = Math.floor(m / 1440), hh = Math.floor((m % 1440) / 60), mm = m % 60;
  return d ? `${d}d ${hh}h` : hh ? `${hh}h ${mm}m` : `${mm}m`;
}

export function debounce(fn, ms) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

/** Texto limpo a partir do HTML do AniList (descrições). Não executa nada. */
export function stripHtml(s) {
  if (!s) return '';
  const withBreaks = s.replace(/<br\s*\/?>/gi, '\n');
  const doc = new DOMParser().parseFromString(withBreaks, 'text/html');
  return (doc.body.textContent || '').replace(/\n{3,}/g, '\n\n').trim();
}

export function shuffle(a) {
  a = a.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function download(name, text, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = h('a', { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
