/* Arabesco — Service Worker (offline-ready, updates always delivered) */
const CACHE = 'arabesco-v3';
const KEEP_PREFIX = ['arabesco-audio', 'arabesco-online'];
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
      Promise.all(
        keys.filter(k => k !== CACHE && !KEEP_PREFIX.some(p => k.startsWith(p)))
            .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  /* audio clips manage their own cache (arabesco-audio) — don't double-store */
  if (e.request.url.includes('/audio/')) return;
  /* network-first: visitors always get the latest version when online;
     offline (or a failed request) falls back to the cached copy. */
  e.respondWith((async () => {
    const hit = await caches.match(e.request);
    try {
      const res = await fetch(e.request);
      if (res.ok && e.request.url.startsWith(self.location.origin)) {
        const copy = res.clone();
        e.waitUntil(caches.open(CACHE).then(c => c.put(e.request, copy)));
      }
      return res;
    } catch (err) {
      if (hit) return hit;
      /* offline navigation → serve the app shell */
      if (e.request.mode === 'navigate') {
        const shell = await caches.match('./index.html');
        if (shell) return shell;
      }
      throw err;
    }
  })());
});
