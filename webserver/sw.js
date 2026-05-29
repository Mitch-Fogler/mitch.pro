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
