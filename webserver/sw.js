const CACHE_NAME = 'mitch-pro-cache-v5';
const ASSETS = [
  '/favicon.ico',
  '/manifest.json',
  '/apple-touch-icon.png',
  '/icon-192.png',
  '/icon-512.png',
  '/relaunch.css'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

function isHtmlRequest(request) {
  const url = request.url;
  const accept = request.headers.get('accept') || '';
  // Navigation requests or accept: text/html
  if (request.mode === 'navigate') return true;
  if (accept.includes('text/html')) return true;
  // URLs ending with / or .html
  const pathname = new URL(url).pathname;
  if (pathname.endsWith('/') || pathname.endsWith('.html')) return true;
  return false;
}

self.addEventListener('fetch', (e) => {
  // Never intercept API or WebSocket requests
  if (e.request.url.includes('/api/') || e.request.url.startsWith('ws')) {
    return;
  }

  const requestUrl = new URL(e.request.url);
  const isThemeJs = requestUrl.pathname === '/theme.js';

  if (isThemeJs) {
    // Force a fresh fetch by using cache: 'no-store' and a timestamp parameter
    e.respondWith(
      fetch(e.request.url + '?t=' + Date.now(), { cache: 'no-store' }).then((response) => {
        if (response && response.status === 200) {
          // Store under the original request URL so caches.match(e.request) still resolves offline
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone));
        }
        return response;
      }).catch(() => {
        return caches.match(e.request);
      })
    );
  } else if (isHtmlRequest(e.request)) {
    // Network-first for HTML pages — always get fresh content
    e.respondWith(
      fetch(e.request).then((response) => {
        if (response && response.status === 200 && response.type === 'basic') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone));
        }
        return response;
      }).catch(() => {
        // Offline fallback: serve cached version if available
        return caches.match(e.request);
      })
    );
  } else {
    // Cache-first for static assets (CSS, JS, images, fonts)
    e.respondWith(
      caches.match(e.request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(e.request).then((response) => {
          if (response && response.status === 200 && response.type === 'basic') {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(e.request, responseToCache);
            });
          }
          return response;
        });
      })
    );
  }
});

// Push notification listeners
self.addEventListener('push', e => {
  let data = { title: 'New message', body: '', url: 'https://mitch.pro/encrypt/' };
  try { data = Object.assign(data, JSON.parse(e.data.text())); } catch {}
  e.waitUntil(self.registration.showNotification(data.title, {
    body: data.body,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    data: { url: data.url }
  }));
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = e.notification.data?.url || 'https://mitch.pro/encrypt/';
  e.waitUntil(clients.matchAll({ type: 'window' }).then(cs => {
    for (const c of cs) {
      if ((c.url.includes('/encrypt/') || c.url.includes('/encrypt.html')) && 'focus' in c) return c.focus();
    }
    return clients.openWindow(url);
  }));
});
