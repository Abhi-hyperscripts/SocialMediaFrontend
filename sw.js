/**
 * Service Worker - Proven Update Mechanism
 * Works reliably on iOS and Android
 */

// ============================================================================
// VERSION - INCREMENT THIS TO TRIGGER UPDATE
// ============================================================================
const CACHE_VERSION = 6;
const CACHE_NAME = 'pwa-v' + CACHE_VERSION;

// ============================================================================
// CONFIGURATION
// ============================================================================
const BASE_PATH = self.location.pathname.substring(0, self.location.pathname.lastIndexOf('/') + 1) || '/';

const STATIC_ASSETS = [
    BASE_PATH,
    BASE_PATH + 'index.html',
    BASE_PATH + 'styles.css',
    BASE_PATH + 'manifest.json'
];

const NEVER_CACHE = [
    /\.db$/,
    /\.sqlite$/,
    /\.sqlite3$/,
    /\.db-wal$/,
    /\.db-shm$/,
    /\.db-journal$/,
    /\/api\//
];

// ============================================================================
// INSTALL - Cache assets immediately
// ============================================================================
self.addEventListener('install', (event) => {
    console.log('[SW] Installing v' + CACHE_VERSION);
    
    // Take control immediately
    self.skipWaiting();
    
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('[SW] Caching assets');
                return cache.addAll(STATIC_ASSETS).catch(err => {
                    console.warn('[SW] Some assets failed to cache:', err);
                });
            })
            .then(() => {
                console.log('[SW] Install complete v' + CACHE_VERSION);
            })
    );
});

// ============================================================================
// ACTIVATE - Clean old caches and take control
// ============================================================================
self.addEventListener('activate', (event) => {
    console.log('[SW] Activating v' + CACHE_VERSION);
    
    event.waitUntil(
        Promise.all([
            // Delete old caches
            caches.keys().then(keys => {
                return Promise.all(
                    keys.map(key => {
                        if (key !== CACHE_NAME) {
                            console.log('[SW] Deleting old cache:', key);
                            return caches.delete(key);
                        }
                    })
                );
            }),
            
            // Take control of all clients
            self.clients.claim()
        ])
        .then(() => {
            console.log('[SW] Activated v' + CACHE_VERSION);
            
            // Notify all clients
            return self.clients.matchAll({ type: 'window' });
        })
        .then(clients => {
            console.log('[SW] Notifying ' + clients.length + ' clients');
            
            clients.forEach(client => {
                client.postMessage({
                    type: 'SW_READY',
                    version: CACHE_VERSION
                });
            });
        })
    );
});



// ============================================================================
// FETCH - Serve from cache, fallback to network
// ============================================================================
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Skip non-GET and cross-origin
    if (request.method !== 'GET' || url.origin !== self.location.origin) {
        return;
    }

    // Never cache database files
    if (NEVER_CACHE.some(pattern => pattern.test(url.pathname))) {
        return;
    }

    // Network first for HTML, CSS, JS, and images
    const accept = request.headers.get('accept') || '';
    const isHTML = accept.includes('text/html');
    const isCSS = accept.includes('text/css') || url.pathname.endsWith('.css');
    const isJS = accept.includes('javascript') || url.pathname.endsWith('.js');
    const isImage = accept.includes('image/') || /\.(jpg|jpeg|png|gif|webp|svg|ico)$/i.test(url.pathname);
    
    if (isHTML || isCSS || isJS || isImage) {
        event.respondWith(
            fetch(request)
                .then(response => {
                    if (response.ok) {
                        const clone = response.clone();
                        caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
                    }
                    return response;
                })
                .catch(() => caches.match(request))
        );
        return;
    }

    // Cache first for other assets (if any)
    event.respondWith(
        caches.match(request)
            .then(cached => cached || fetch(request))
    );
});




// ============================================================================
// MESSAGES
// ============================================================================
self.addEventListener('message', (event) => {
    console.log('[SW] Message received:', event.data?.type);
    
    if (event.data?.type === 'SKIP_WAITING') {
        console.log('[SW] Skipping waiting...');
        self.skipWaiting();
    }
});

console.log('[SW] Loaded v' + CACHE_VERSION);