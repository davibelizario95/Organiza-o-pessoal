const CACHE = "op-cache-v1";
const PRECACHE_URLS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./css/styles.css",
  "./js/app.js",
  "./js/config.js",
  "./js/firebase.js",
  "./js/frentes.js",
  "./js/googleCalendar.js",
  "./js/icons.js",
  "./js/idb.js",
  "./js/router.js",
  "./js/state.js",
  "./js/store.js",
  "./js/utils.js",
  "./js/components/card.js",
  "./js/components/modal.js",
  "./js/components/nav.js",
  "./js/components/quickCapture.js",
  "./js/components/templates.js",
  "./js/components/timer.js",
  "./js/components/toast.js",
  "./js/components/voiceRecorder.js",
  "./js/views/agenda.js",
  "./js/views/dashboard.js",
  "./js/views/frenteGeneric.js",
  "./js/views/profileSelect.js",
  "./js/views/settings.js",
  "./js/views/trabalho.js",
  "./js/views/weeklyReview.js",
  "./assets/icons/icon-192.png",
  "./assets/icons/icon-512.png",
  "./assets/icons/icon-maskable-512.png",
  "./assets/icons/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE_URLS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return; // deixa Firebase/Google seguirem direto pela rede
  if (event.request.method !== "GET") return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const network = fetch(event.request)
        .then((resp) => {
          if (resp && resp.ok) {
            const clone = resp.clone();
            caches.open(CACHE).then((cache) => cache.put(event.request, clone));
          }
          return resp;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
