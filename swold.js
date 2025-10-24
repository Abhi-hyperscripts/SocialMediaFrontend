/**
 * Universal Service Worker with Android Update Fix
 * Automatically handles caching, updates, and permissions
 * Fixed: Android now updates immediately without manual refresh
 */

const CACHE_NAME = 'pwa-cache-v3';
const CACHE_VERSION = 3;

// Get base path
const BASE_PATH = self.location.pathname.substring(0, self.location.pathname.lastIndexOf('/') + 1);

// Files to cache (auto-detected or manually configured)
const STATIC_ASSETS = [
    BASE_PATH,
    BASE_PATH + 'index.html',
    BASE_PATH + 'styles.css',
    BASE_PATH + 'manifest.json'
];

// Patterns to never cache
const NEVER_CACHE_PATTERNS = [
    /\.db$/,
    /\.sqlite$/,
    /\.sqlite3$/,
    /\.db-wal$/,
    /\.db-shm$/,
    /\.db-journal$/,
    /\/api\//,
    /\/__/,
    /chrome-extension:/,
    /^https?:\/\/(?!.*?(localhost|127\.0\.0\.1))/  // External domains
];

const NETWORK_TIMEOUT = 8000;

// ============================================================================
// INSTALL - Take control immediately
// ============================================================================
self.addEventListener('install', (event) => {
    console.log('[SW v' + CACHE_VERSION + '] Installing...');
    
    // CRITICAL: Skip waiting immediately to activate ASAP
    self.skipWaiting();
    
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[SW v' + CACHE_VERSION + '] Caching static assets');
                return Promise.allSettled(
                    STATIC_ASSETS.map(url => 
                        cache.add(url)
                            .then(() => console.log('[SW v' + CACHE_VERSION + '] ✓ Cached:', url))
                            .catch(err => console.warn('[SW v' + CACHE_VERSION + '] ✗ Failed to cache:', url))
                    )
                );
            })
            .then(() => {
                console.log('[SW v' + CACHE_VERSION + '] Installation complete');
            })
    );
});

// ============================================================================
// ACTIVATE - Take control and notify clients IMMEDIATELY
// ============================================================================
self.addEventListener('activate', (event) => {
    console.log('[SW v' + CACHE_VERSION + '] Activating...');
    
    event.waitUntil(
        Promise.all([
            // Delete old caches
            caches.keys().then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((cacheName) => {
                        if (cacheName !== CACHE_NAME) {
                            console.log('[SW v' + CACHE_VERSION + '] Deleting old cache:', cacheName);
                            return caches.delete(cacheName);
                        }
                    })
                );
            }),
            
            // CRITICAL: Take control of all clients immediately (including Android)
            self.clients.claim()
        ])
        .then(() => {
            console.log('[SW v' + CACHE_VERSION + '] Activated and took control');
            
            // Get all open windows/tabs
            return self.clients.matchAll({ 
                includeUncontrolled: true,
                type: 'window'
            });
        })
        .then((clients) => {
            console.log('[SW v' + CACHE_VERSION + '] Found ' + clients.length + ' client(s)');
            
            // Force notify all clients to reload (especially Android)
            clients.forEach(client => {
                console.log('[SW v' + CACHE_VERSION + '] Sending reload message to client');
                client.postMessage({
                    type: 'SW_ACTIVATED',
                    version: CACHE_NAME,
                    versionNumber: CACHE_VERSION,
                    timestamp: Date.now(),
                    forceReload: true // Signal that reload is required
                });
            });
            
            console.log('[SW v' + CACHE_VERSION + '] All clients notified');
        })
    );
});

// ============================================================================
// FETCH - Handle requests
// ============================================================================
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Skip cross-origin and non-GET
    if (url.origin !== self.location.origin || request.method !== 'GET') {
        return;
    }

    // Never cache certain files
    if (shouldNeverCache(url.pathname)) {
        event.respondWith(fetch(request));
        return;
    }

    // Strategy based on request type
    if (isHTMLRequest(request, url)) {
        event.respondWith(networkFirstStrategy(request));
    } else {
        event.respondWith(cacheFirstStrategy(request));
    }
});

// ============================================================================
// HELPERS
// ============================================================================
function shouldNeverCache(pathname) {
    return NEVER_CACHE_PATTERNS.some(pattern => pattern.test(pathname));
}

function isHTMLRequest(request, url) {
    return (
        request.headers.get('accept')?.includes('text/html') ||
        url.pathname === BASE_PATH ||
        url.pathname.endsWith('.html') ||
        request.mode === 'navigate'
    );
}

async function networkFirstStrategy(request) {
    try {
        const networkPromise = fetch(request);
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('timeout')), NETWORK_TIMEOUT);
        });

        const response = await Promise.race([networkPromise, timeoutPromise]);

        if (response && response.status === 200) {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
                cache.put(request, responseToCache);
            });
        }

        return response;
    } catch (error) {
        const cachedResponse = await caches.match(request);
        if (cachedResponse) return cachedResponse;

        const fallback = await caches.match(BASE_PATH + 'index.html');
        if (fallback) return fallback;

        return new Response('Offline', { status: 503 });
    }
}

async function cacheFirstStrategy(request) {
    const cachedResponse = await caches.match(request);

    if (cachedResponse) {
        // Background update
        fetch(request).then((response) => {
            if (response && response.status === 200 && response.type === 'basic') {
                caches.open(CACHE_NAME).then((cache) => {
                    cache.put(request, response.clone());
                });
            }
        }).catch(() => {});

        return cachedResponse;
    }

    try {
        const response = await fetch(request);

        if (response && response.status === 200 && response.type === 'basic') {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
                cache.put(request, responseToCache);
            });
        }

        return response;
    } catch (error) {
        return new Response('Network error', { status: 503 });
    }
}

// ============================================================================
// MESSAGES - Handle commands from app
// ============================================================================
self.addEventListener('message', (event) => {
    const { data } = event;

    if (!data || !data.type) return;

    console.log('[SW v' + CACHE_VERSION + '] Received message:', data.type);

    switch (data.type) {
        case 'SKIP_WAITING':
            console.log('[SW v' + CACHE_VERSION + '] Skipping waiting...');
            self.skipWaiting();
            break;

        case 'GET_VERSION':
            event.ports[0]?.postMessage({
                version: CACHE_NAME,
                versionNumber: CACHE_VERSION
            });
            break;

        case 'CLEAR_CACHE':
            console.log('[SW v' + CACHE_VERSION + '] Clearing cache...');
            caches.delete(CACHE_NAME).then(() => {
                event.ports[0]?.postMessage({ success: true });
            });
            break;
            
        case 'CHECK_UPDATE':
            // Client is asking if update is available
            event.ports[0]?.postMessage({
                hasUpdate: false,
                currentVersion: CACHE_VERSION
            });
            break;
    }
});

// ============================================================================
// PUSH NOTIFICATIONS
// ============================================================================
self.addEventListener('push', (event) => {
    console.log('[SW v' + CACHE_VERSION + '] Push notification received');
    
    const options = {
        body: event.data?.text() || 'New notification',
        icon: BASE_PATH + 'icon-192.png',
        badge: BASE_PATH + 'icon-192.png',
        vibrate: [200, 100, 200],
        tag: 'pwa-notification'
    };

    event.waitUntil(
        self.registration.showNotification('PWA Notification', options)
    );
});

self.addEventListener('notificationclick', (event) => {
    console.log('[SW v' + CACHE_VERSION + '] Notification clicked');
    event.notification.close();

    event.waitUntil(
        clients.matchAll({ type: 'window' }).then((clientList) => {
            // Focus existing window if available
            for (const client of clientList) {
                if (client.url.includes(BASE_PATH) && 'focus' in client) {
                    return client.focus();
                }
            }
            // Open new window
            if (clients.openWindow) {
                return clients.openWindow(BASE_PATH);
            }
        })
    );
});

console.log('[SW v' + CACHE_VERSION + '] Service Worker loaded and ready');