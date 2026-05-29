(function setupBroadcast() {
    var ws;
    function connect() {
      var protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
      ws = new WebSocket(protocol + '//' + location.host + '/ws');
      ws.onmessage = function(e) {
        try {
          var data = JSON.parse(e.data);
          if (data.type === 'admin_broadcast') {
            showBroadcast(data.message);
          } else if (data.type === 'admin_jumpscare') {
            showJumpscare(data.message);
          }
        } catch(ex) {}
      };
      ws.onclose = function() { setTimeout(connect, 5000); };
    }
    function showJumpscare(msg) {
      var el = document.createElement('div');
      el.style.cssText = 'position:fixed;inset:0;background:#000;color:#f00;z-index:2147483647;display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:serif;text-align:center;padding:2rem;animation:shake 0.1s infinite;';
      el.innerHTML = '<div style="font-size:8rem;margin-bottom:20px;">😱</div><div style="font-size:3rem;font-weight:900;text-transform:uppercase;letter-spacing:-0.05em;">' + (msg || 'WAKE UP') + '</div>';
      
      if (!document.getElementById('jumpscare-style')) {
        var style = document.createElement('style');
        style.id = 'jumpscare-style';
        style.textContent = '@keyframes shake { 0% { transform: translate(2px, 1px) rotate(0deg); } 10% { transform: translate(-1px, -2px) rotate(-1deg); } 20% { transform: translate(-3px, 0px) rotate(1deg); } 30% { transform: translate(3px, 2px) rotate(0deg); } 40% { transform: translate(1px, -1px) rotate(1deg); } 50% { transform: translate(-1px, 2px) rotate(-1deg); } 60% { transform: translate(-3px, 1px) rotate(0deg); } 70% { transform: translate(3px, 1px) rotate(-1deg); } 80% { transform: translate(-1px, -1px) rotate(1deg); } 90% { transform: translate(1px, 2px) rotate(0deg); } 100% { transform: translate(1px, -2px) rotate(-1deg); } }';
        document.head.appendChild(style);
      }
      
      document.body.appendChild(el);
      var audio = new Audio('https://www.myinstants.com/media/sounds/screamer.mp3');
      audio.play().catch(function(){});
      setTimeout(function() { el.remove(); }, 3000);
    }
    function showBroadcast(msg) {
      var el = document.createElement('div');
      el.style.cssText = 'position:fixed;top:0;left:0;right:0;background:#ef4444;color:#fff;padding:1.5rem;text-align:center;z-index:1000000;font-weight:900;box-shadow:0 10px 40px rgba(0,0,0,0.5);font-family:system-ui,sans-serif;font-size:1.1rem;animation:slideDown .4s ease-out;';
      el.innerHTML = '<div style="margin-bottom:10px;font-size:.8rem;opacity:.8;letter-spacing:.1em;text-transform:uppercase;">Global Broadcast</div>' + msg + '<div style="margin-top:15px;"><button id="close-broadcast" style="background:#fff;color:#000;border:none;border-radius:6px;padding:6px 15px;font-weight:800;cursor:pointer;">Dismiss</button></div>';
      
      if (!document.getElementById('broadcast-style')) {
        var style = document.createElement('style');
        style.id = 'broadcast-style';
        style.textContent = '@keyframes slideDown { from { transform: translateY(-100%); } to { transform: translateY(0); } }';
        document.head.appendChild(style);
      }
      
      document.body.appendChild(el);
      el.querySelector('#close-broadcast').onclick = function() { el.remove(); };
    }
    if (document.body) connect();
    else document.addEventListener('DOMContentLoaded', connect);
})();

// Site-wide Notifications
(function setupNotifications() {
  function escText(t) {
    var d = document.createElement('div');
    d.textContent = t == null ? '' : String(t);
    return d.innerHTML;
  }

  var _notifications = [];

  function injectNotifCSS() {
    if (document.getElementById('sw-notif-styles')) return;
    var s = document.createElement('style');
    s.id = 'sw-notif-styles';
    s.textContent = 
      '#sw-notif-wrap { position: fixed; top: 12px; right: 12px; z-index: 1000001; }' +
      '#sw-notif-btn {' +
      '  width: 36px; height: 36px; border-radius: 50%;' +
      '  display: flex; align-items: center; justify-content: center;' +
      '  background: rgba(30,30,34,0.85); color: #7c3aed; border: 1px solid rgba(124,58,237,0.4);' +
      '  cursor: pointer; box-shadow: 0 8px 28px rgba(0,0,0,0.35);' +
      '  font-size: 15px; position: relative; backdrop-filter: blur(10px);' +
      '}' +
      '#sw-notif-count {' +
      '  display: none; position: absolute; top: -5px; right: -5px;' +
      '  min-width: 17px; height: 17px; padding: 0 4px;' +
      '  border-radius: 99px; background: #ef4444; color: #fff;' +
      '  align-items: center; justify-content: center;' +
      '  font-size: 9px; font-weight: 800; line-height: 1;' +
      '}' +
      '#sw-notif-panel {' +
      '  display: none; position: absolute; top: 44px; right: 0;' +
      '  width: min(340px, calc(100vw - 24px)); max-height: min(430px, calc(100vh - 70px));' +
      '  background: rgba(10,10,14,0.96); border: 1px solid rgba(255,255,255,0.1);' +
      '  border-radius: 12px; box-shadow: 0 18px 60px rgba(0,0,0,0.65);' +
      '  overflow: hidden; backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);' +
      '}' +
      '#sw-notif-panel.show { display: block; }' +
      '.sw-notif-head {' +
      '  display: flex; align-items: center; gap: 8px;' +
      '  padding: 10px 12px; border-bottom: 1px solid rgba(255,255,255,0.08);' +
      '  font-size: .78rem; font-weight: 800; color: #fff;' +
      '}' +
      '.sw-notif-head span { flex: 1; }' +
      '.sw-notif-head button {' +
      '  background: transparent; border: 1px solid rgba(255,255,255,0.15);' +
      '  color: rgba(255,255,255,0.7); border-radius: 6px; padding: 3px 7px;' +
      '  font-size: .7rem; cursor: pointer;' +
      '}' +
      '#sw-notif-list { max-height: 335px; overflow-y: auto; padding: 8px; }' +
      '.sw-notif-empty { padding: 18px 10px; text-align: center; color: rgba(255,255,255,0.5); font-size: .8rem; opacity: .65; }' +
      '.sw-notif-item {' +
      '  padding: 9px 10px; border: 1px solid rgba(255,255,255,0.08);' +
      '  border-radius: 9px; background: rgba(255,255,255,0.03); margin-bottom: 7px;' +
      '}' +
      '.sw-notif-title { color: #fff; font-size: .82rem; font-weight: 800; margin-bottom: 3px; }' +
      '.sw-notif-body { color: rgba(255,255,255,0.7); font-size: .78rem; line-height: 1.35; }' +
      '.sw-notif-detail { color: rgba(255,255,255,0.5); opacity: .7; font-size: .72rem; line-height: 1.35; margin-top: 3px; }' +
      '.sw-notif-actions { display: flex; gap: 7px; margin-top: 8px; }' +
      '.sw-notif-actions button, .sw-notif-open {' +
      '  flex: 1; text-align: center; text-decoration: none;' +
      '  background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);' +
      '  color: #7c3aed; border-radius: 7px; padding: 4px 8px;' +
      '  font-size: .72rem; cursor: pointer;' +
      '}';
    document.head.appendChild(s);
  }

  function injectNotifHTML() {
    if (document.getElementById('sw-notif-wrap')) return;
    var wrap = document.createElement('div');
    wrap.id = 'sw-notif-wrap';
    wrap.innerHTML = 
      '<button id="sw-notif-btn" type="button" title="Notifications">&#128276;<span id="sw-notif-count" style="display: none;">0</span></button>' +
      '<div id="sw-notif-panel">' +
      '  <div class="sw-notif-head">' +
      '    <span>Notifications</span>' +
      '    <button id="sw-notif-read-all" type="button">Read all</button>' +
      '    <button id="sw-notif-close" type="button">Close</button>' +
      '  </div>' +
      '  <div id="sw-notif-list"><div class="sw-notif-empty">No unread notifications</div></div>' +
      '</div>';
    document.body.appendChild(wrap);
  }

  async function loadNotifications() {
    try {
      var r = await fetch('/api/me/notifications', { credentials: 'include' });
      if (!r.ok) return;
      var d = await r.json();
      _notifications = d.notifications || [];
      renderNotifications();
    } catch(e) {}
  }

  function renderNotifications() {
    var count = _notifications.length;
    var badge = document.getElementById('sw-notif-count');
    var list = document.getElementById('sw-notif-list');
    if (!badge || !list) return;
    badge.textContent = count > 99 ? '99+' : String(count);
    badge.style.display = count ? 'inline-flex' : 'none';
    if (!count) {
      list.innerHTML = '<div class="sw-notif-empty">No unread notifications</div>';
      return;
    }
    list.innerHTML = _notifications.map(function(n, i) {
      var url = n.url || '';
      if (url.startsWith('https://mitchdog.com/')) {
        url = url.replace('https://mitchdog.com', '');
      }
      var open = url ? '<a class="sw-notif-open" href="' + escText(url) + '">Open</a>' : '';
      return '<div class="sw-notif-item">' +
        '<div class="sw-notif-title">' + escText(n.title) + '</div>' +
        '<div class="sw-notif-body">' + escText(n.body) + '</div>' +
        (n.detail ? '<div class="sw-notif-detail">' + escText(n.detail) + '</div>' : '') +
        '<div class="sw-notif-actions">' + open + '<button type="button" data-i="' + i + '">Mark read</button></div>' +
      '</div>';
    }).join('');
    list.querySelectorAll('button[data-i]').forEach(function(btn) {
      btn.onclick = function() { markNotificationRead(_notifications[Number(btn.dataset.i)]); };
    });
  }

  async function markNotificationRead(n) {
    if (!n) return;
    var body = (n.type === 'coin_gift' || n.type === 'admin_notice')
      ? { coinGiftIds: [n.id] }
      : n.type === 'dm'
        ? { dmFroms: [n.from] }
        : {};
    _notifications = _notifications.filter(function(item) { return item !== n; });
    renderNotifications();
    await fetch('/api/me/notifications/read', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).catch(function(){});
    loadNotifications();
  }

  async function markAllNotificationsRead() {
    if (!_notifications.length) return;
    _notifications = [];
    renderNotifications();
    await fetch('/api/me/notifications/read', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ all: true }),
    }).catch(function(){});
  }

  function init() {
    // Don't show on appeal page
    if (location.pathname.endsWith('/appeal.html')) return;
    
    injectNotifCSS();
    injectNotifHTML();

    var btn = document.getElementById('sw-notif-btn');
    var panel = document.getElementById('sw-notif-panel');
    if (!btn || !panel) return;

    document.getElementById('sw-notif-close').onclick = function() {
      panel.classList.remove('show');
    };
    document.getElementById('sw-notif-read-all').onclick = markAllNotificationsRead;
    btn.onclick = function(e) {
      e.stopPropagation();
      panel.classList.toggle('show');
      if (panel.classList.contains('show')) loadNotifications();
    };
    panel.onclick = function(e) { e.stopPropagation(); };
    document.addEventListener('click', function() { panel.classList.remove('show'); });
    loadNotifications();
    setInterval(loadNotifications, 30000);
  }

  if (document.body) init();
  else document.addEventListener('DOMContentLoaded', init);
})();
