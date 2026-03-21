const CACHE_NAME = 'noteai-v1';
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/manifest.json',
];

// Install: cache static assets
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
    );
    self.skipWaiting();
});

// Activate: clean up old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
        )
    );
    self.clients.claim();
});

// Fetch: network-first for API, cache-first for static
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Skip non-GET and API requests (always fresh)
    if (request.method !== 'GET' || url.pathname.startsWith('/api/')) return;

    event.respondWith(
        fetch(request)
            .then((response) => {
                // Cache fresh response for static assets
                if (response.ok && (url.pathname === '/' || url.pathname.endsWith('.js') || url.pathname.endsWith('.css'))) {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
                }
                return response;
            })
            .catch(() => {
                // Offline fallback: serve from cache
                return caches.match(request) || caches.match('/index.html');
            })
    );
});
