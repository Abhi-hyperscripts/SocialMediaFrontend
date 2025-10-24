/**
 * PWA Helper - Simple, Reliable Updates
 * Works on both iOS and Android
 */

const PWAHelper = (function() {
    'use strict';

    // Config
    const config = {
        swPath: './sw.js',
        autoUpdate: true,
        updateInterval: 60000,
        showPrompt: true,
        debug: true,
        permissions: ['geolocation']
    };

    // State
    let registration = null;
    let refreshing = false;
    let deferredPrompt = null;

    // Device detection
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isAndroid = /Android/.test(navigator.userAgent);

    // ============================================================================
    // INIT
    // ============================================================================
    function init(options = {}) {
        Object.assign(config, options);
        log('Initializing...', { isIOS, isAndroid });

        if ('serviceWorker' in navigator) {
            registerSW();
            setupUpdateHandling();
            setupInstallPrompt();
        }

        return publicAPI;
    }

    // ============================================================================
    // SERVICE WORKER REGISTRATION
    // ============================================================================
    function registerSW() {
        window.addEventListener('load', async () => {
            try {
                registration = await navigator.serviceWorker.register(config.swPath);
                log('✓ Service Worker registered');

                // Check for updates immediately
                registration.update();

                // Check periodically
                if (config.autoUpdate) {
                    setInterval(() => {
                        log('Checking for updates...');
                        registration.update();
                    }, config.updateInterval);
                }

                // Listen for new service worker
                registration.addEventListener('updatefound', handleUpdateFound);

            } catch (err) {
                log('✗ Registration failed:', err);
            }
        });
    }

    // ============================================================================
    // UPDATE HANDLING
    // ============================================================================
    function handleUpdateFound() {
        const newWorker = registration.installing;
        log('New service worker found');

        newWorker.addEventListener('statechange', () => {
            log('New SW state:', newWorker.state);

            // New service worker installed
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                log('New version available!');
                
                // Tell new worker to skip waiting
                newWorker.postMessage({ type: 'SKIP_WAITING' });
            }
        });
    }

    function setupUpdateHandling() {
        if (!navigator.serviceWorker) return;

        // Listen for controller change (when new SW takes control)
        navigator.serviceWorker.addEventListener('controllerchange', () => {
            if (refreshing) return;
            
            log('Controller changed - new SW active');
            refreshing = true;
            
            // Show update message
            showUpdateMessage();
            
            // Reload after short delay
            setTimeout(() => {
                log('Reloading...');
                window.location.reload();
            }, 1500);
        });

        // Listen for messages from SW
        navigator.serviceWorker.addEventListener('message', (event) => {
            log('Message from SW:', event.data?.type);
            
            if (event.data?.type === 'SW_READY') {
                log('Service Worker ready, version:', event.data.version);
            }
        });
    }

    function showUpdateMessage() {
        // Create or show update notification
        let msg = document.getElementById('pwa-update-msg');
        
        if (!msg) {
            msg = document.createElement('div');
            msg.id = 'pwa-update-msg';
            msg.style.cssText = `
                position: fixed;
                top: 20px;
                left: 50%;
                transform: translateX(-50%);
                background: #4CAF50;
                color: white;
                padding: 15px 25px;
                border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.2);
                z-index: 10000;
                font-family: system-ui;
                animation: slideDown 0.3s ease;
            `;
            msg.textContent = '✨ Updating to latest version...';
            document.body.appendChild(msg);

            // Add animation
            const style = document.createElement('style');
            style.textContent = `
                @keyframes slideDown {
                    from { transform: translate(-50%, -100px); opacity: 0; }
                    to { transform: translate(-50%, 0); opacity: 1; }
                }
            `;
            document.head.appendChild(style);
        }
    }

    // ============================================================================
    // INSTALL PROMPT
    // ============================================================================
    function setupInstallPrompt() {
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            deferredPrompt = e;
            log('Install prompt ready');

            if (config.showPrompt) {
                showInstallBanner();
            }
        });

        window.addEventListener('appinstalled', () => {
            log('App installed');
            hideInstallBanner();
        });
    }

    function showInstallBanner() {
        let banner = document.getElementById('pwa-install-banner');
        
        if (!banner) {
            banner = document.createElement('div');
            banner.id = 'pwa-install-banner';
            banner.style.cssText = `
                position: fixed;
                bottom: 20px;
                left: 50%;
                transform: translateX(-50%);
                background: linear-gradient(135deg, #667eea, #764ba2);
                color: white;
                padding: 15px 20px;
                border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                z-index: 10000;
                display: flex;
                gap: 15px;
                align-items: center;
                max-width: 90%;
                font-family: system-ui;
            `;
            banner.innerHTML = `
                <span>📱 Install app for better experience</span>
                <button onclick="PWAHelper.install()" style="
                    background: white;
                    color: #667eea;
                    border: none;
                    padding: 8px 15px;
                    border-radius: 5px;
                    cursor: pointer;
                    font-weight: 600;
                ">Install</button>
                <button onclick="this.parentElement.remove()" style="
                    background: transparent;
                    color: white;
                    border: 1px solid white;
                    padding: 8px 15px;
                    border-radius: 5px;
                    cursor: pointer;
                ">Later</button>
            `;
            document.body.appendChild(banner);
        }
    }

    function hideInstallBanner() {
        const banner = document.getElementById('pwa-install-banner');
        if (banner) banner.remove();
    }

    function installPWA() {
        if (!deferredPrompt) {
            log('No install prompt available');
            return false;
        }

        deferredPrompt.prompt();
        deferredPrompt.userChoice.then((result) => {
            log('Install result:', result.outcome);
            deferredPrompt = null;
            hideInstallBanner();
        });

        return true;
    }

    // ============================================================================
    // PERMISSIONS
    // ============================================================================
    async function requestPermissions(list = config.permissions) {
        const results = {};

        for (const perm of list) {
            try {
                results[perm] = await requestPermission(perm);
                log(`Permission ${perm}:`, results[perm]);
            } catch (err) {
                log(`Error with ${perm}:`, err);
                results[perm] = 'error';
            }
        }

        return results;
    }

    async function requestPermission(name) {
        switch (name) {
            case 'geolocation':
                return new Promise((resolve) => {
                    navigator.geolocation.getCurrentPosition(
                        () => resolve('granted'),
                        (err) => resolve(err.code === 1 ? 'denied' : 'prompt'),
                        { enableHighAccuracy: true, timeout: 10000 }
                    );
                });

            case 'camera':
                try {
                    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
                    stream.getTracks().forEach(t => t.stop());
                    return 'granted';
                } catch (err) {
                    return err.name === 'NotAllowedError' ? 'denied' : 'prompt';
                }

            case 'microphone':
                try {
                    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                    stream.getTracks().forEach(t => t.stop());
                    return 'granted';
                } catch (err) {
                    return err.name === 'NotAllowedError' ? 'denied' : 'prompt';
                }

            case 'notifications':
                if (!('Notification' in window)) return 'unsupported';
                if (Notification.permission !== 'default') return Notification.permission;
                return await Notification.requestPermission();

            default:
                return 'unsupported';
        }
    }

    async function checkPermissionStatus(name) {
        return await requestPermission(name);
    }

    // ============================================================================
    // STORAGE
    // ============================================================================
    async function getStorageInfo() {
        if (!navigator.storage?.estimate) return null;

        const est = await navigator.storage.estimate();
        const used = est.usage || 0;
        const total = est.quota || 0;

        return {
            usage: used,
            quota: total,
            available: total - used,
            percentUsed: ((used / total) * 100).toFixed(2),
            usageMB: (used / 1024 / 1024).toFixed(2),
            quotaMB: (total / 1024 / 1024).toFixed(2)
        };
    }

    async function requestPersistentStorage() {
        if (!navigator.storage?.persist) return false;
        const result = await navigator.storage.persist();
        log('Persistent storage:', result);
        return result;
    }

    // ============================================================================
    // UTILITIES
    // ============================================================================
    function log(...args) {
        if (!config.debug) return;
        console.log('[PWA]', ...args);
    }

    function forceUpdate() {
        window.location.reload();
    }

    // ============================================================================
    // PUBLIC API
    // ============================================================================
    const publicAPI = {
        install: installPWA,
        update: forceUpdate,
        requestPermissions,
        checkPermissionStatus,
        getStorageInfo,
        isIOS: () => isIOS,
        isAndroid: () => isAndroid
    };

    return {
        init,
        ...publicAPI
    };
})();

// Auto-init
if (typeof PWA_AUTO_INIT !== 'undefined' && PWA_AUTO_INIT) {
    PWAHelper.init();
}