// service-worker.js - Complete rewrite with auto-update and SQLite support

const CACHE_NAME = 'location-tracker-v7'; // Increment this for each update!
const CACHE_VERSION = 7; // Numeric version for easier tracking

// Get the base path from the service worker's location
const BASE_PATH = self.location.pathname.substring(0, self.location.pathname.lastIndexOf('/') + 1);

// Files to cache on install
const STATIC_ASSETS = [
  BASE_PATH,
  BASE_PATH + 'index.html',
  BASE_PATH + 'manifest.json',
  BASE_PATH + 'icon-192.png',
  BASE_PATH + 'icon-512.png'
];

// Patterns to never cache (SQLite and dynamic files)
const NEVER_CACHE_PATTERNS = [
  /\.db$/,           // SQLite database files
  /\.sqlite$/,       // SQLite files
  /\.sqlite3$/,      // SQLite3 files
  /\.db-wal$/,       // Write-Ahead Log files
  /\.db-shm$/,       // Shared memory files
  /\.db-journal$/,   // Journal files
  /\/api\//,         // API endpoints
  /\/__/,            // Special paths
];

// Network timeout for HTML requests (longer for iOS)
const NETWORK_TIMEOUT = 8000;

// ============================================================================
// INSTALL EVENT - Cache static assets and activate immediately
// ============================================================================
self.addEventListener('install', (event) => {
  console.log(`[SW v${CACHE_VERSION}] Installing...`);
  
  // Skip waiting to activate immediately
  self.skipWaiting();
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log(`[SW v${CACHE_VERSION}] Caching static assets`);
        
        // Cache each file individually to handle errors gracefully
        return Promise.allSettled(
          STATIC_ASSETS.map(url => {
            return cache.add(url)
              .then(() => console.log(`[SW v${CACHE_VERSION}] ✓ Cached: ${url}`))
              .catch(err => console.warn(`[SW v${CACHE_VERSION}] ✗ Failed to cache: ${url}`, err));
          })
        );
      })
      .then(() => {
        console.log(`[SW v${CACHE_VERSION}] Installation complete`);
      })
      .catch((error) => {
        console.error(`[SW v${CACHE_VERSION}] Installation failed:`, error);
      })
  );
});

// ============================================================================
// ACTIVATE EVENT - Clean up old caches and take control
// ============================================================================
self.addEventListener('activate', (event) => {
  console.log(`[SW v${CACHE_VERSION}] Activating...`);
  
  event.waitUntil(
    Promise.all([
      // Delete old caches
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME) {
              console.log(`[SW v${CACHE_VERSION}] Deleting old cache: ${cacheName}`);
              return caches.delete(cacheName);
            }
          })
        );
      }),
      
      // Take control of all pages immediately
      self.clients.claim()
    ])
    .then(() => {
      console.log(`[SW v${CACHE_VERSION}] Activated and controlling all pages`);
      
      // Notify all clients about the update
      return self.clients.matchAll({ includeUncontrolled: true });
    })
    .then((clients) => {
      console.log(`[SW v${CACHE_VERSION}] Notifying ${clients.length} client(s)`);
      
      clients.forEach(client => {
        client.postMessage({
          type: 'SW_UPDATED',
          version: CACHE_NAME,
          versionNumber: CACHE_VERSION,
          timestamp: Date.now()
        });
      });
    })
    .catch((error) => {
      console.error(`[SW v${CACHE_VERSION}] Activation error:`, error);
    })
  );
});

// ============================================================================
// FETCH EVENT - Smart caching strategies
// ============================================================================
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip cross-origin requests
  if (url.origin !== self.location.origin) {
    return;
  }

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Never cache SQLite files and API requests
  if (shouldNeverCache(url.pathname)) {
    console.log(`[SW v${CACHE_VERSION}] Bypassing cache for: ${url.pathname}`);
    event.respondWith(fetch(request));
    return;
  }

  // Determine caching strategy based on request type
  if (isHTMLRequest(request, url)) {
    event.respondWith(networkFirstStrategy(request));
  } else {
    event.respondWith(cacheFirstStrategy(request));
  }
});

// ============================================================================
// HELPER: Check if file should never be cached
// ============================================================================
function shouldNeverCache(pathname) {
  return NEVER_CACHE_PATTERNS.some(pattern => pattern.test(pathname));
}

// ============================================================================
// HELPER: Check if request is for HTML
// ============================================================================
function isHTMLRequest(request, url) {
  return (
    request.headers.get('accept')?.includes('text/html') ||
    url.pathname === BASE_PATH ||
    url.pathname.endsWith('.html') ||
    request.mode === 'navigate'
  );
}

// ============================================================================
// STRATEGY: Network-first with timeout (for HTML)
// ============================================================================
async function networkFirstStrategy(request) {
  try {
    // Race between network fetch and timeout
    const networkPromise = fetch(request);
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Network timeout')), NETWORK_TIMEOUT);
    });

    const response = await Promise.race([networkPromise, timeoutPromise]);

    // Cache the successful response
    if (response && response.status === 200) {
      const responseToCache = response.clone();
      caches.open(CACHE_NAME).then((cache) => {
        cache.put(request, responseToCache);
      });
    }

    return response;
  } catch (error) {
    // Network failed or timed out - try cache
    console.log(`[SW v${CACHE_VERSION}] Network failed for ${request.url}, trying cache`);
    
    const cachedResponse = await caches.match(request);
    
    if (cachedResponse) {
      console.log(`[SW v${CACHE_VERSION}] Serving from cache (offline)`);
      return cachedResponse;
    }

    // No cache available - try fallback
    const fallback = await caches.match(BASE_PATH + 'index.html');
    if (fallback) {
      return fallback;
    }

    // Nothing available - return error
    return new Response('Offline - No cached version available', {
      status: 503,
      statusText: 'Service Unavailable',
      headers: new Headers({
        'Content-Type': 'text/plain'
      })
    });
  }
}

// ============================================================================
// STRATEGY: Cache-first with background update (for assets)
// ============================================================================
async function cacheFirstStrategy(request) {
  const cachedResponse = await caches.match(request);

  if (cachedResponse) {
    // Return cached version immediately
    
    // Update cache in background (stale-while-revalidate)
    fetch(request)
      .then((response) => {
        if (response && response.status === 200 && response.type === 'basic') {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseToCache);
          });
        }
      })
      .catch(() => {
        // Fail silently for background updates
      });

    return cachedResponse;
  }

  // Not in cache - fetch from network
  try {
    const response = await fetch(request);

    // Cache successful responses
    if (response && response.status === 200 && response.type === 'basic') {
      const responseToCache = response.clone();
      caches.open(CACHE_NAME).then((cache) => {
        cache.put(request, responseToCache);
      });
    }

    return response;
  } catch (error) {
    console.error(`[SW v${CACHE_VERSION}] Fetch failed for ${request.url}:`, error);

    // Return offline fallback for navigation
    if (request.mode === 'navigate') {
      const fallback = await caches.match(BASE_PATH + 'index.html');
      if (fallback) {
        return fallback;
      }
    }

    // Return error response
    return new Response('Network error', {
      status: 503,
      statusText: 'Service Unavailable'
    });
  }
}

// ============================================================================
// MESSAGE EVENT - Handle commands from the app
// ============================================================================
self.addEventListener('message', (event) => {
  const { data } = event;

  if (!data || !data.type) {
    return;
  }

  switch (data.type) {
    case 'SKIP_WAITING':
      console.log(`[SW v${CACHE_VERSION}] Received SKIP_WAITING command`);
      self.skipWaiting();
      break;

    case 'GET_VERSION':
      event.ports[0]?.postMessage({
        version: CACHE_NAME,
        versionNumber: CACHE_VERSION
      });
      break;

    case 'CLEAR_CACHE':
      console.log(`[SW v${CACHE_VERSION}] Clearing cache...`);
      caches.delete(CACHE_NAME).then(() => {
        event.ports[0]?.postMessage({ success: true });
      });
      break;

    default:
      console.warn(`[SW v${CACHE_VERSION}] Unknown message type: ${data.type}`);
  }
});

// ============================================================================
// PUSH EVENT - Handle push notifications (optional)
// ============================================================================
self.addEventListener('push', (event) => {
  console.log(`[SW v${CACHE_VERSION}] Push notification received`);
  
  const options = {
    body: event.data?.text() || 'New location update',
    icon: BASE_PATH + 'icon-192.png',
    badge: BASE_PATH + 'icon-192.png',
    vibrate: [200, 100, 200],
    tag: 'location-update'
  };

  event.waitUntil(
    self.registration.showNotification('Location Tracker', options)
  );
});

// ============================================================================
// NOTIFICATION CLICK EVENT - Handle notification clicks (optional)
// ============================================================================
self.addEventListener('notificationclick', (event) => {
  console.log(`[SW v${CACHE_VERSION}] Notification clicked`);
  
  event.notification.close();

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Focus existing window if available
        for (const client of clientList) {
          if (client.url.includes(BASE_PATH) && 'focus' in client) {
            return client.focus();
          }
        }
        
        // Open new window if no existing window
        if (clients.openWindow) {
          return clients.openWindow(BASE_PATH);
        }
      })
  );
});

// ============================================================================
// SYNC EVENT - Background sync (optional)
// ============================================================================
self.addEventListener('sync', (event) => {
  console.log(`[SW v${CACHE_VERSION}] Background sync: ${event.tag}`);
  
  if (event.tag === 'sync-locations') {
    event.waitUntil(syncLocations());
  }
});

async function syncLocations() {
  // Implement your sync logic here
  console.log(`[SW v${CACHE_VERSION}] Syncing location data...`);
  // This would sync pending location data to your server
}

// ============================================================================
// Log version on load
// ============================================================================
console.log(`[SW v${CACHE_VERSION}] Service Worker loaded`);