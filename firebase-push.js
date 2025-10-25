/**
 * Firebase Push Notifications - Client Side
 */

const firebaseConfig = {
    apiKey: "AIzaSyC5tDbZVRUNpUxzAjZjcgkJo1KC-4pbRqk",
    authDomain: "socialmediawpa-57e1f.firebaseapp.com",
    projectId: "socialmediawpa-57e1f",
    storageBucket: "socialmediawpa-57e1f.firebasestorage.app",
    messagingSenderId: "494572933748",
    appId: "1:494572933748:web:87fba6e8f23479c7a6f721"
};

// REPLACE THIS WITH YOUR VAPID KEY FROM FIREBASE CONSOLE
const VAPID_PUBLIC_KEY = "BBS-cK3h5TrA3jWzkXwo5qW1pr3LKaF-c_MTgg5XlGqf7r1BXMJI2TQptjKflV7lpsWPZRFLwOi5NRzcRE7I_HI";

class FirebasePushNotifications {
    constructor() {
        this.app = null;
        this.messaging = null;
        this.currentToken = null;
    }

    async init() {
        try {
            if (!('serviceWorker' in navigator)) {
                console.warn('Service Workers not supported');
                return false;
            }

            if (!('PushManager' in window)) {
                console.warn('Push notifications not supported');
                return false;
            }

            // Import Firebase modules
            const { initializeApp } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js');
            const { getMessaging, isSupported } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging.js');

            // Check if messaging is supported
            const messagingSupported = await isSupported();
            if (!messagingSupported) {
                console.warn('Firebase Messaging not supported on this browser');
                return false;
            }

            // Initialize Firebase
            this.app = initializeApp(firebaseConfig);
            this.messaging = getMessaging(this.app);

            console.log('[Firebase] Initialized successfully');
            return true;
        } catch (error) {
            console.error('[Firebase] Initialization error:', error);
            return false;
        }
    }

    async requestPermission() {
        try {
            const permission = await Notification.requestPermission();
            console.log('[Firebase] Notification permission:', permission);

            if (permission === 'granted') {
                return await this.getToken();
            } else {
                console.warn('[Firebase] Notification permission denied');
                return null;
            }
        } catch (error) {
            console.error('[Firebase] Permission error:', error);
            return null;
        }
    }

    async getToken() {
        try {
            const { getToken } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging.js');

            // Wait for service worker to be ready
            const registration = await navigator.serviceWorker.ready;

            // Get FCM token
            const token = await getToken(this.messaging, {
                vapidKey: VAPID_PUBLIC_KEY,
                serviceWorkerRegistration: registration
            });

            if (token) {
                console.log('[Firebase] FCM Token received:', token);
                this.currentToken = token;

                // Send token to your backend
                await this.sendTokenToBackend(token);

                return token;
            } else {
                console.log('[Firebase] No registration token available');
                return null;
            }
        } catch (error) {
            console.error('[Firebase] Error getting token:', error);
            return null;
        }
    }

    async onForegroundMessage(callback) {
        try {
            const { onMessage } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging.js');

            // Listen for foreground messages (when app is open)
            onMessage(this.messaging, (payload) => {
                console.log('[Firebase] Foreground message received:', payload);
                
                // Show notification even when app is open
                if (Notification.permission === 'granted') {
                    new Notification(payload.notification.title, {
                        body: payload.notification.body,
                        icon: payload.notification.icon || '/icon-192.png',
                        image: payload.notification.image,
                        data: payload.data
                    });
                }

                // Call custom callback if provided
                if (callback) {
                    callback(payload);
                }
            });
        } catch (error) {
            console.error('[Firebase] Foreground message listener error:', error);
        }
    }

    async deleteToken() {
        try {
            const { deleteToken } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging.js');

            await deleteToken(this.messaging);
            await this.removeTokenFromBackend(this.currentToken);
            
            this.currentToken = null;
            console.log('[Firebase] Token deleted successfully');
            return true;
        } catch (error) {
            console.error('[Firebase] Error deleting token:', error);
            return false;
        }
    }

    async sendTokenToBackend(token) {
        try {
            const response = await fetch('/api/fcm/subscribe', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ 
                    token: token,
                    timestamp: Date.now(),
                    userAgent: navigator.userAgent
                })
            });

            if (!response.ok) {
                throw new Error('Failed to send token to backend');
            }

            console.log('[Firebase] Token sent to backend');
        } catch (error) {
            console.error('[Firebase] Backend error:', error);
        }
    }

    async removeTokenFromBackend(token) {
        try {
            await fetch('/api/fcm/unsubscribe', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ token })
            });
            console.log('[Firebase] Token removed from backend');
        } catch (error) {
            console.error('[Firebase] Backend removal error:', error);
        }
    }

    getCurrentToken() {
        return this.currentToken;
    }

    isPermissionGranted() {
        return Notification.permission === 'granted';
    }
}

// Create global instance
const firebasePush = new FirebasePushNotifications();