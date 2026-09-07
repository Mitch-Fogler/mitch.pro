const CACHE_NAME = 'mitch-pro-cache-v30';
const ASSETS = [
  '/favicon.ico',
  '/manifest.json',
  '/apple-touch-icon.png',
  '/icon-192.png',
  '/icon-512.png',
  '/relaunch.css',
  '/portal-redesign.css?v=16',
  '/home-redesign.css?v=2',
  '/popup.js',
  '/pwa-install.js'
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
    const pathname = requestUrl.pathname;
    const isCode = /\.(css|js|mjs|json)(\?|$)/.test(pathname) || pathname === '/readability.css';
    if (isCode) {
      // Network-first for code assets: never serve stale CSS/JS when online,
      // fall back to the cache only when offline.
      e.respondWith(
        fetch(e.request).then((response) => {
          if (response && response.status === 200 && response.type === 'basic') {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone));
          }
          return response;
        }).catch(() => caches.match(e.request))
      );
    } else {
      // Cache-first for slow-changing assets (images, fonts, media)
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
  }
});

// Push notification listeners
// True when a window client on /encrypt/ is actually on screen right now —
// in that case the page shows its own in-app toast and a system
// notification would be redundant (and annoying mid-conversation).
async function isUserInEncryptChat() {
  try {
    const cs = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    return cs.some(c => {
      try {
        if (!c.url || !c.url.startsWith(self.location.origin)) return false;
        if (!new URL(c.url).pathname.startsWith('/encrypt')) return false;
        return c.visibilityState === 'visible';
      } catch { return false; }
    });
  } catch { return false; }
}

// The wolf logo on rjuhsd.school, the mitch mark everywhere else.
const notifyIcon = () => (self.location.hostname.endsWith('rjuhsd.school') ? '/rjuhsd-assets/icon-192.png' : '/icon-192.png');

self.addEventListener('push', e => {
  let data = { title: 'New message', body: '', url: '/encrypt/' };
  try { data = Object.assign(data, JSON.parse(e.data.text())); } catch {}
  e.waitUntil(isUserInEncryptChat().then(inChat => {
    // Already inside encrypted chat on this device — stay quiet.
    if (inChat) return;
    return self.registration.showNotification(data.title, {
      body: data.body,
      icon: notifyIcon(),
      badge: notifyIcon(),
      tag: data.tag || undefined,
      renotify: Boolean(data.tag),
      vibrate: [90, 45, 90],
      data: { url: data.url }
    });
  }));
});

// Keep notification clicks on the origin the PWA was installed from: resolve
// the payload URL against this SW's own scope, and if an old/absolute payload
// points at a different host (mitch.pro, mitchdog.com, …), strip it down to
// its path so we never navigate the rjuhsd.school PWA to a foreign origin
// that would demand a fresh login.
function notificationTargetUrl(raw) {
  let u = String(raw || '/encrypt/');
  try {
    const resolved = new URL(u, self.registration.scope);
    if (resolved.origin !== self.location.origin) {
      return resolved.pathname + resolved.search + resolved.hash || '/encrypt/';
    }
    return resolved.href;
  } catch {
    return '/encrypt/';
  }
}

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = notificationTargetUrl(e.notification.data?.url);
  e.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async cs => {
    // Hand the URL to an existing app window and let it present the target
    // in its in-app browser sheet (Apple-style), instead of navigating the
    // whole PWA window away from whatever the user had open.
    for (const c of cs) {
      if (!c.url.startsWith(self.location.origin) || !('focus' in c)) continue;
      try { await c.focus(); } catch {}
      c.postMessage({ type: 'open-in-app-browser', url });
      return c;
    }
    return clients.openWindow(url);
  }));
});
