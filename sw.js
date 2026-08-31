const CACHE = "op-cache-v2";
const PRECACHE_URLS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./css/styles.css",
  "./js/app.js",
  "./js/config.js",
  "./js/financeCategories.js",
  "./js/firebase.js",
  "./js/frentes.js",
  "./js/googleCalendar.js",
  "./js/icons.js",
  "./js/idb.js",
  "./js/quickCommand.js",
  "./js/router.js",
  "./js/speechToText.js",
  "./js/state.js",
  "./js/store.js",
  "./js/utils.js",
  "./js/components/card.js",
  "./js/components/filters.js",
  "./js/components/modal.js",
  "./js/components/nav.js",
  "./js/components/quickCapture.js",
  "./js/components/templates.js",
  "./js/components/timer.js",
  "./js/components/toast.js",
  "./js/components/voiceRecorder.js",
  "./js/views/agenda.js",
  "./js/views/dashboard.js",
  "./js/views/financeiro.js",
  "./js/views/frenteGeneric.js",
  "./js/views/hub.js",
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

// Rede primeiro, cache só como reserva pra quando estiver offline. Antes
// era o contrário (cache primeiro, atualiza em segundo plano) — isso fazia
// qualquer deploy novo (CSS, JS, o que for) só aparecer depois de DOIS
// carregamentos da página, porque o primeiro sempre servia a versão velha
// guardada e só atualizava o cache pro próximo carregar.
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return; // deixa Firebase/Google seguirem direto pela rede
  if (event.request.method !== "GET") return;

  event.respondWith(
    fetch(event.request)
      .then((resp) => {
        if (resp && resp.ok) {
          const clone = resp.clone();
          caches.open(CACHE).then((cache) => cache.put(event.request, clone));
        }
        return resp;
      })
      .catch(() => caches.match(event.request))
  );
});
