// sw.js — BookMyLook Service Worker
// Network-first strategy: always tries the network first, falls back to cache.
// This ensures dev changes always show up while still providing offline support.

const CACHE_NAME = 'bookmylook-v1';
const STATIC_ASSETS = [
  '/',
  '/logo.png',
];

// Install — cache essential static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Caching static assets');
      return cache.addAll(STATIC_ASSETS);
    })
  );
  // Activate immediately without waiting for old SW to finish
  self.skipWaiting();
});

// Activate — clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  // Take control of all pages immediately
  self.clients.claim();
});

// Fetch — network-first strategy
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests and Chrome extension requests
  if (event.request.method !== 'GET') return;
  if (event.request.url.startsWith('chrome-extension://')) return;

  // Skip API calls to Firebase and AI service — these should never be cached
  if (
    event.request.url.includes('firestore.googleapis.com') ||
    event.request.url.includes('firebase') ||
    event.request.url.includes('localhost:8000') ||
    event.request.url.includes('googleapis.com')
  ) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Clone the response and cache it
        const responseClone = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseClone);
        });
        return response;
      })
      .catch(() => {
        // Network failed — try cache
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          // If it's a navigation request, return the cached index page
          if (event.request.mode === 'navigate') {
            return caches.match('/');
          }
        });
      })
  );
});
