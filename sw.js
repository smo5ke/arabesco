/* Arabesco — Service Worker (offline-ready) */
const CACHE = 'arabesco-v1';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/design-system.css',
  './js/app.js', './js/ui.js', './js/store.js', './js/data.js', './js/tts.js', './js/gamify.js',
  './js/views/dash.js', './js/views/cards.js', './js/views/alphabet.js', './js/views/quiz.js',
  './js/views/dict.js', './js/views/verbs.js', './js/views/phrases.js', './js/views/games.js',
  './js/views/progress.js',
  './data/dictionary.json', './data/phrases.json', './data/dialogues.json',
  './data/alphabet.json', './data/verbs.json', './data/verbs_top.json',
  './icons/icon-192.png', './icons/icon-512.png',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then(hit => {
      const net = fetch(e.request).then(res => {
        if (res.ok && e.request.url.startsWith(self.location.origin)) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, copy));
        }
        return res;
      }).catch(() => hit);
      return hit || net;
    })
  );
});
