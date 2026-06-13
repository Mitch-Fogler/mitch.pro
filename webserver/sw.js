const CACHE_NAME = 'mitch-pro-cache-v1';
const ASSETS = [
  '/',
  '/favicon.ico',
  '/manifest.json'
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

self.addEventListener('fetch', (e) => {
  if (e.request.url.includes('/api/') || e.request.url.startsWith('ws')) {
    return;
  }
  
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
      }).catch(() => {});
    })
  );
});

// Push notification listeners
self.addEventListener('push', e => {
  let data = { title: 'New message', body: '', url: 'https://mitchdog.com/encrypt.html' };
  try { data = Object.assign(data, JSON.parse(e.data.text())); } catch {}
  e.waitUntil(self.registration.showNotification(data.title, {
    body: data.body,
    icon: '/favicon.ico',
    data: { url: data.url }
  }));
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = e.notification.data?.url || 'https://mitchdog.com/encrypt.html';
  e.waitUntil(clients.matchAll({ type: 'window' }).then(cs => {
    for (const c of cs) {
      if (c.url.includes('/encrypt.html') && 'focus' in c) return c.focus();
    }
    return clients.openWindow(url);
  }));
});
