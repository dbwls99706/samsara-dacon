// SAMSARA · 윤회 — 서비스 워커 (오프라인 캐시)
//
// 전략: 정적 자산은 cache-first, HTML 은 network-first, API 호출은 항상 네트워크.

const CACHE = 'samsara-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/character/tiger.svg',
  '/manifest.webmanifest',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(STATIC_ASSETS).catch(() => {}))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  // Supabase / 외부 API 는 네트워크 그대로
  if (url.hostname.endsWith('supabase.co') || url.hostname.endsWith('supabase.in')) return;
  if (e.request.method !== 'GET') return;

  // HTML — network-first
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          const clone = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, clone));
          return res;
        })
        .catch(() => caches.match(e.request).then((r) => r || caches.match('/')))
    );
    return;
  }

  // 정적 자산 — cache-first
  e.respondWith(
    caches.match(e.request).then((cached) => {
      if (cached) return cached;
      return fetch(e.request).then((res) => {
        if (res.ok && (url.origin === location.origin)) {
          const clone = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, clone));
        }
        return res;
      });
    })
  );
});
