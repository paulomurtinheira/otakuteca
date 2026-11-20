// Service worker: deixa a app abrir offline. Rede primeiro (para receberes sempre a versão nova),
// e se não houver rede usa a cópia guardada. Não guarda imagens nem chamadas à API.
const V = 'otakuteca-v1';

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(V).then((c) => c.addAll(['./', 'index.html', 'css/style.css', 'js/app.js'])).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== V).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    fetch(req).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(V).then((c) => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req).then((r) => r || caches.match('index.html'))));
});
