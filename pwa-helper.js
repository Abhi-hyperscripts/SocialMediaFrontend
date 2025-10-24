/**
 * PWA Helper - Universal PWA functionality
 * Just include this file to add PWA features to any project
 * 
 * Usage:
 * <script src="pwa-helper.js"></script>
 * <script>
 *   PWAHelper.init({
 *     swPath: './sw.js',
 *     autoUpdate: true,
 *     showInstallPrompt: true,
 *     permissions: ['geolocation', 'camera', 'microphone'],
 *     onUpdate: () => console.log('App updated!'),
 *     onInstall: () => console.log('App installed!')
 *   });
 * </script>
 */

const PWAHelper = (function() {
    'use strict';

    // ============================================================================
    // CONFIGURATION
    // ============================================================================
    const config = {
        swPath: './sw.js',
        swScope: './',
        autoUpdate: true,
        updateCheckInterval: 60000, // 60 seconds
        showInstallPrompt: true,
        autoReload: true,
        debug: true,
        permissions: ['geolocation'],
        onUpdate: null,
        onInstall: null,
        onPermissionGranted: null,
        onPermissionDenied: null
    };

    // State
    let deferredPrompt = null;
    let registration = null;
    let refreshing = false;
    let updateAvailable = false;

    // Device detection
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    const isAndroid = /Android/.test(navigator.userAgent);
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || 
                         window.navigator.standalone || 
                         document.referrer.includes('android-app://');

    // ============================================================================
    // INITIALIZATION
    // ============================================================================
    function init(options = {}) {
        Object.assign(config, options);
        
        log('Initializing PWA Helper...');
        log('Device:', { isIOS, isAndroid, isStandalone });

        if ('serviceWorker' in navigator) {
            registerServiceWorker();
            setupUpdateHandling();
            setupInstallPrompt();
            requestPersistentStorage();
        } else {
            log('Service Workers not supported', 'warn');
        }

        return {
            requestPermissions,
            checkPermissionStatus,
            install: installPWA,
            update: updateApp,
            getStorageInfo,
            isInstalled: () => isStandalone,
            getVersion: getServiceWorkerVersion
        };
    }

    // ============================================================================
    // SERVICE WORKER REGISTRATION
    // ============================================================================
    function registerServiceWorker() {
        window.addEventListener('load', async () => {
            try {
                registration = await navigator.serviceWorker.register(config.swPath, {
                    scope: config.swScope
                });

                log('Service Worker registered:', registration.scope);

                // Check for updates on load
                if (config.autoUpdate) {
                    registration.update();
                    
                    // Periodic update checks
                    setInterval(() => {
                        registration.update();
                    }, config.updateCheckInterval);
                }

            } catch (error) {
                log('Service Worker registration failed:', error, 'error');
            }
        });
    }

    // ============================================================================
    // AUTO-UPDATE HANDLING
    // ============================================================================
    function setupUpdateHandling() {
        if (!navigator.serviceWorker) return;

        navigator.serviceWorker.addEventListener('controllerchange', () => {
            if (!refreshing && updateAvailable) {
                log('New service worker activated');
                refreshing = true;
                
                if (config.onUpdate) {
                    config.onUpdate();
                }

                if (config.autoReload) {
                    showUpdateNotification();
                    setTimeout(() => {
                        window.location.reload();
                    }, 3000);
                } else {
                    showUpdateNotification();
                }
            }
        });

        navigator.serviceWorker.addEventListener('message', (event) => {
            if (event.data && event.data.type === 'SW_UPDATED') {
                log('Service worker updated to version:', event.data.version);
            }
        });
    }

    // ============================================================================
    // INSTALL PROMPT HANDLING
    // ============================================================================
    function setupInstallPrompt() {
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            deferredPrompt = e;
            log('Install prompt available');

            if (config.showInstallPrompt) {
                showInstallBanner();
            }

            // Trigger custom event
            window.dispatchEvent(new CustomEvent('pwa-installable'));
        });

        window.addEventListener('appinstalled', () => {
            log('PWA installed successfully');
            deferredPrompt = null;
            hideInstallBanner();

            if (config.onInstall) {
                config.onInstall();
            }

            // Trigger custom event
            window.dispatchEvent(new CustomEvent('pwa-installed'));
        });
    }

    function installPWA() {
        if (!deferredPrompt) {
            log('Install prompt not available', 'warn');
            return false;
        }

        deferredPrompt.prompt();
        deferredPrompt.userChoice.then((choiceResult) => {
            if (choiceResult.outcome === 'accepted') {
                log('User accepted install');
            } else {
                log('User dismissed install');
            }
            deferredPrompt = null;
            hideInstallBanner();
        });

        return true;
    }

    // ============================================================================
    // PERMISSIONS MANAGEMENT
    // ============================================================================
    async function requestPermissions(permissionsList = config.permissions) {
        const results = {};

        for (const permission of permissionsList) {
            try {
                const result = await requestSinglePermission(permission);
                results[permission] = result;
                log(`Permission ${permission}:`, result);

                if (result === 'granted' && config.onPermissionGranted) {
                    config.onPermissionGranted(permission);
                } else if (result === 'denied' && config.onPermissionDenied) {
                    config.onPermissionDenied(permission);
                }
            } catch (error) {
                log(`Error requesting ${permission}:`, error, 'error');
                results[permission] = 'error';
            }
        }

        return results;
    }

    async function requestSinglePermission(permission) {
        switch (permission) {
            case 'geolocation':
                return requestGeolocation();
            
            case 'camera':
                return requestCamera();
            
            case 'microphone':
                return requestMicrophone();
            
            case 'notifications':
                return requestNotifications();
            
            case 'contacts':
                return requestContacts();
            
            default:
                return checkGenericPermission(permission);
        }
    }

    async function requestGeolocation() {
        return new Promise((resolve) => {
            navigator.geolocation.getCurrentPosition(
                () => resolve('granted'),
                (error) => {
                    if (error.code === 1) resolve('denied');
                    else resolve('prompt');
                },
                { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
            );
        });
    }

    async function requestCamera() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            stream.getTracks().forEach(track => track.stop());
            return 'granted';
        } catch (error) {
            return error.name === 'NotAllowedError' ? 'denied' : 'prompt';
        }
    }

    async function requestMicrophone() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            stream.getTracks().forEach(track => track.stop());
            return 'granted';
        } catch (error) {
            return error.name === 'NotAllowedError' ? 'denied' : 'prompt';
        }
    }

    async function requestNotifications() {
        if (!('Notification' in window)) return 'unsupported';
        
        if (Notification.permission === 'granted') return 'granted';
        if (Notification.permission === 'denied') return 'denied';
        
        const permission = await Notification.requestPermission();
        return permission;
    }

    async function requestContacts() {
        if (!('contacts' in navigator)) return 'unsupported';
        
        try {
            await navigator.contacts.select(['name'], { multiple: false });
            return 'granted';
        } catch (error) {
            return error.name === 'NotAllowedError' ? 'denied' : 'prompt';
        }
    }

    async function checkGenericPermission(name) {
        if (!('permissions' in navigator)) return 'unsupported';
        
        try {
            const result = await navigator.permissions.query({ name });
            return result.state;
        } catch (error) {
            return 'unsupported';
        }
    }

    async function checkPermissionStatus(permission) {
        return await requestSinglePermission(permission);
    }

    // ============================================================================
    // STORAGE MANAGEMENT
    // ============================================================================
    async function requestPersistentStorage() {
        if (navigator.storage && navigator.storage.persist) {
            const isPersisted = await navigator.storage.persist();
            log('Persistent storage:', isPersisted ? 'granted' : 'denied');
            return isPersisted;
        }
        return false;
    }

    async function getStorageInfo() {
        if (!navigator.storage || !navigator.storage.estimate) {
            return null;
        }

        const estimate = await navigator.storage.estimate();
        const usage = estimate.usage || 0;
        const quota = estimate.quota || 0;
        const percent = (usage / quota * 100).toFixed(2);

        return {
            usage,
            quota,
            available: quota - usage,
            percentUsed: parseFloat(percent),
            usageMB: (usage / 1024 / 1024).toFixed(2),
            quotaMB: (quota / 1024 / 1024).toFixed(2)
        };
    }

    // ============================================================================
    // UI HELPERS
    // ============================================================================
    function showInstallBanner() {
        let banner = document.getElementById('pwa-install-banner');
        
        if (!banner) {
            banner = document.createElement('div');
            banner.id = 'pwa-install-banner';
            banner.innerHTML = `
                <style>
                    #pwa-install-banner {
                        position: fixed;
                        bottom: 20px;
                        left: 50%;
                        transform: translateX(-50%);
                        background: linear-gradient(135deg, #667eea, #764ba2);
                        color: white;
                        padding: 16px 24px;
                        border-radius: 8px;
                        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                        z-index: 10000;
                        display: flex;
                        align-items: center;
                        gap: 16px;
                        max-width: 90%;
                        animation: slideUp 0.3s ease;
                    }
                    @keyframes slideUp {
                        from { transform: translate(-50%, 100px); opacity: 0; }
                        to { transform: translate(-50%, 0); opacity: 1; }
                    }
                    #pwa-install-banner button {
                        background: white;
                        color: #667eea;
                        border: none;
                        padding: 8px 16px;
                        border-radius: 4px;
                        cursor: pointer;
                        font-weight: 600;
                    }
                    #pwa-install-banner .close-btn {
                        background: transparent;
                        color: white;
                        border: 1px solid white;
                    }
                </style>
                <span>📱 Install this app for the best experience!</span>
                <button onclick="PWAHelper.install()">Install</button>
                <button class="close-btn" onclick="this.parentElement.remove()">Later</button>
            `;
            document.body.appendChild(banner);
        }
    }

    function hideInstallBanner() {
        const banner = document.getElementById('pwa-install-banner');
        if (banner) banner.remove();
    }

    function showUpdateNotification() {
        let notification = document.getElementById('pwa-update-notification');
        
        if (!notification) {
            notification = document.createElement('div');
            notification.id = 'pwa-update-notification';
            notification.innerHTML = `
                <style>
                    #pwa-update-notification {
                        position: fixed;
                        top: 20px;
                        left: 50%;
                        transform: translateX(-50%);
                        background: #667eea;
                        color: white;
                        padding: 16px 24px;
                        border-radius: 8px;
                        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                        z-index: 10000;
                        display: flex;
                        align-items: center;
                        gap: 12px;
                        animation: slideDown 0.3s ease;
                    }
                    @keyframes slideDown {
                        from { transform: translate(-50%, -100px); opacity: 0; }
                        to { transform: translate(-50%, 0); opacity: 1; }
                    }
                    #pwa-update-notification button {
                        background: white;
                        color: #667eea;
                        border: none;
                        padding: 8px 16px;
                        border-radius: 4px;
                        cursor: pointer;
                        font-weight: 600;
                    }
                </style>
                <span>✨ New version available!</span>
                <button onclick="PWAHelper.update()">Update Now</button>
            `;
            document.body.appendChild(notification);
        }
    }

    function updateApp() {
        window.location.reload();
    }

    async function getServiceWorkerVersion() {
        if (!registration) return null;
        
        const messageChannel = new MessageChannel();
        return new Promise((resolve) => {
            messageChannel.port1.onmessage = (event) => {
                resolve(event.data);
            };
            registration.active?.postMessage({ type: 'GET_VERSION' }, [messageChannel.port2]);
        });
    }

    // ============================================================================
    // UTILITIES
    // ============================================================================
    function log(message, ...args) {
        if (!config.debug) return;
        
        const level = args[args.length - 1];
        if (level === 'error') {
            console.error('[PWA Helper]', message, ...args.slice(0, -1));
        } else if (level === 'warn') {
            console.warn('[PWA Helper]', message, ...args.slice(0, -1));
        } else {
            console.log('[PWA Helper]', message, ...args);
        }
    }

    // ============================================================================
    // PUBLIC API
    // ============================================================================
    return {
        init,
        install: installPWA,
        update: updateApp,
        requestPermissions,
        checkPermissionStatus,
        getStorageInfo,
        isIOS: () => isIOS,
        isAndroid: () => isAndroid,
        isStandalone: () => isStandalone,
        getVersion: getServiceWorkerVersion
    };
})();

// Auto-initialize with defaults if PWA_AUTO_INIT is true
if (typeof PWA_AUTO_INIT !== 'undefined' && PWA_AUTO_INIT) {
    PWAHelper.init();
}