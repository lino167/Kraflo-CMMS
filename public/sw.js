// Service worker do Kraflo: deixa o app abrir sem internet depois da primeira visita.
// Estratégia:
// - No build, a lista de todos os arquivos (JS/CSS de cada tela) é injetada em PRECACHE:
//   assim qualquer aba abre offline, mesmo que nunca tenha sido visitada.
// - Navegação (páginas): rede primeiro; sem rede, devolve a casca do app (index.html).
// - Arquivos estáticos do mesmo domínio: devolve o cache na hora e atualiza em segundo plano.
// - Chamadas ao Supabase e outras origens nunca são guardadas: os dados vêm sempre do banco ou da fila local.
const VERSION = 'kraflo-shell-__BUILD_VERSION__';
const SHELL = ['/', '/index.html'];
// ignoreVary: o servidor pode responder com 'Vary: Origin'; sem isso o cache não casa com os módulos JS
const MATCH = { ignoreVary: true };
const PRECACHE = '__PRECACHE__';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(VERSION).then(async (cache) => {
      await cache.addAll(SHELL);
      // Um arquivo que falhe não pode impedir a instalação
      const lista = Array.isArray(PRECACHE) ? PRECACHE : [];
      await Promise.allSettled(lista.map((u) => cache.add(u)));
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/functions/')) return;

  if (req.mode === 'navigate') {
    event.respondWith(networkFirst(req));
    return;
  }
  event.respondWith(staleWhileRevalidate(req));
});

async function networkFirst(req) {
  const cache = await caches.open(VERSION);
  try {
    const res = await fetch(req);
    // Guarda só a casca: o app é uma SPA, qualquer rota usa o mesmo index.html
    if (res.ok) cache.put('/index.html', res.clone());
    return res;
  } catch {
    return (await cache.match('/index.html', MATCH)) || (await cache.match('/', MATCH)) || Response.error();
  }
}

async function staleWhileRevalidate(req) {
  const cache = await caches.open(VERSION);
  const cached = await cache.match(req, MATCH);
  if (cached) {
    // Atualiza em segundo plano, sem esperar
    fetch(req).then((res) => { if (res.ok) cache.put(req, res); }).catch(() => {});
    return cached;
  }
  try {
    const res = await fetch(req);
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch {
    return Response.error();
  }
}
