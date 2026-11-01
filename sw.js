/* Mise en cache de l'appli pour un usage sans réseau. Changer VERSION à chaque mise à jour. */
var VERSION = 'delco-v4';
var FILES = ['./', 'index.html', 'app.js', 'jsQR.js', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/insigne.png'];
self.addEventListener('install', function (e) { e.waitUntil(caches.open(VERSION).then(function (c) { return c.addAll(FILES); }).then(function () { return self.skipWaiting(); })); });
self.addEventListener('activate', function (e) { e.waitUntil(caches.keys().then(function (ks) { return Promise.all(ks.filter(function (k) { return k !== VERSION; }).map(function (k) { return caches.delete(k); })); }).then(function () { return self.clients.claim(); })); });
self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(function (r) { return r || fetch(e.request); }));
});
