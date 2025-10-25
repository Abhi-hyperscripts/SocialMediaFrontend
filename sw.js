/**
 * Service Worker - With Firebase Cloud Messaging V1 API
 * Works reliably on iOS and Android
 */

// ============================================================================
// FIREBASE - Import Firebase scripts first
// ============================================================================
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

// ============================================================================
// VERSION - INCREMENT THIS TO TRIGGER UPDATE
// ============================================================================
const CACHE_VERSION = 8; // Incremented for Firebase integration
const CACHE_NAME = 'pwa-v' + CACHE_VERSION;

// ============================================================================
// FIREBASE CONFIGURATION - UPDATE WITH YOUR VALUES
// ============================================================================
  const firebaseConfig = {
    apiKey: "AIzaSyC5tDbZVRUNpUxzAjZjcgkJo1KC-4pbRqk",
    authDomain: "socialmediawpa-57e1f.firebaseapp.com",
    projectId: "socialmediawpa-57e1f",
    storageBucket: "socialmediawpa-57e1f.firebasestorage.app",
    messagingSenderId: "494572933748",
    appId: "1:494572933748:web:87fba6e8f23479c7a6f721"
  };

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Initialize Firebase Messaging
const messaging = firebase.messaging();

// ============================================================================
// FIREBASE PUSH NOTIFICATIONS - Background handler
// ============================================================================
messaging.onBackgroundMessage((payload) => {
    console.log('[SW] Background push received:', payload);

    // Extract notification data
    const notificationTitle = payload.notification?.title || payload.data?.title || 'New Notification';
    
    const notificationOptions = {
        body: payload.notification?.body || payload.data?.body || 'You have a new message',
        icon: payload.notification?.icon || payload.data?.icon || BASE_PATH + 'icon-192.png',
        badge: BASE_PATH + 'badge-72.png',
        image: payload.notification?.image || payload.data?.image,
        vibrate: [200, 100, 200],
        tag: payload.data?.tag || 'notification-' + Date.now(),
        requireInteraction: payload.data?.requireInteraction === 'true',
        data: {
            url: payload.data?.click_action || payload.fcmOptions?.link || BASE_PATH,
            notificationId: payload.data?.notificationId,
            timestamp: Date.now(),
            ...payload.data
        },
        actions: [
            {
                action: 'open',
                title: 'Open',
            },
            {
                action: 'close',
                title: 'Dismiss',
            }
        ]
    };

    // Show notification
    return self.registration.showNotification(notificationTitle, notificationOptions);
});

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
    /\/api\//,
    /firebasestorage\.googleapis\.com/,
    /firebaseinstallations\.googleapis\.com/,
    /fcmtoken\.googleapis\.com/
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

    // Skip non-GET requests
    if (request.method !== 'GET') {
        return;
    }

    // Allow Firebase and Google domains (required for FCM)
    const isFirebaseRequest = url.origin.includes('firebase') || 
                             url.origin.includes('googleapis.com') ||
                             url.origin.includes('gstatic.com');
    
    // Skip cross-origin except Firebase
    if (url.origin !== self.location.origin && !isFirebaseRequest) {
        return;
    }

    // Never cache database files and Firebase API calls
    if (NEVER_CACHE.some(pattern => pattern.test(url.pathname) || pattern.test(url.origin))) {
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
// NOTIFICATION CLICK - Handle notification clicks
// ============================================================================
self.addEventListener('notificationclick', (event) => {
    console.log('[SW] Notification clicked:', event.action, event.notification.data);
    
    // Close the notification
    event.notification.close();

    // If user clicked "close" action, just close
    if (event.action === 'close') {
        return;
    }

    // Get the URL to open (from notification data)
    const urlToOpen = event.notification.data?.url || BASE_PATH;

    // Open or focus the app
    event.waitUntil(
        clients.matchAll({ 
            type: 'window', 
            includeUncontrolled: true 
        })
        .then(clientList => {
            // If app is already open, focus it
            for (let client of clientList) {
                if (client.url.includes(BASE_PATH) && 'focus' in client) {
                    console.log('[SW] Focusing existing window');
                    return client.focus();
                }
            }
            
            // Otherwise, open new window
            if (clients.openWindow) {
                console.log('[SW] Opening new window:', urlToOpen);
                return clients.openWindow(urlToOpen);
            }
        })
        .catch(err => {
            console.error('[SW] Error handling notification click:', err);
        })
    );
});

// ============================================================================
// NOTIFICATION CLOSE - Track when user dismisses notification
// ============================================================================
self.addEventListener('notificationclose', (event) => {
    console.log('[SW] Notification closed by user:', event.notification.tag);
    
    // Optional: Track notification dismissal analytics
    event.waitUntil(
        Promise.resolve() // Add analytics tracking here if needed
    );
});

// ============================================================================
// MESSAGES - Handle messages from clients
// ============================================================================
self.addEventListener('message', (event) => {
    console.log('[SW] Message received:', event.data?.type);
    
    if (event.data?.type === 'SKIP_WAITING') {
        console.log('[SW] Skipping waiting...');
        self.skipWaiting();
    }
    
    // Optional: Handle other message types
    if (event.data?.type === 'GET_VERSION') {
        event.ports[0].postMessage({ version: CACHE_VERSION });
    }
});

console.log('[SW] Firebase-enabled service worker loaded v' + CACHE_VERSION);