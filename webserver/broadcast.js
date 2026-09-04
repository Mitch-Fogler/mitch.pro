(function setupBroadcast() {
    var ws;
    var presenceTimer;
    function stopPresencePing() {
      if (presenceTimer) clearInterval(presenceTimer);
      presenceTimer = null;
    }
    function sendPresencePing() {
      if (ws && ws.readyState === WebSocket.OPEN) {
        try { ws.send(JSON.stringify({ type: 'presence_ping' })); } catch(ex) {}
      }
    }
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
          } else if (data.type === 'refresh_notifications') {
            if (typeof window.__refreshNotifications === 'function') {
              window.__refreshNotifications();
            }
          } else if (data.type === 'new_dm') {
            if (typeof window.__handleIncomingDm === 'function') {
              window.__handleIncomingDm(data.message || null);
            }
          }
          window.dispatchEvent(new CustomEvent('ws-broadcast-message', { detail: data }));
        } catch(ex) {}
      };
      ws.onopen = function() {
        stopPresencePing();
        sendPresencePing();
        presenceTimer = setInterval(sendPresencePing, 20000);
        window.dispatchEvent(new CustomEvent('ws-broadcast-status', { detail: { connected: true } }));
      };
      ws.onclose = function() {
        stopPresencePing();
        window.dispatchEvent(new CustomEvent('ws-broadcast-status', { detail: { connected: false } }));
        setTimeout(connect, 1800);
      };
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
// ── In-app browser sheet ─────────────────────────────────────────────────
// Push notification clicks land here (the SW postMessages the URL): the
// target opens inside an Apple-style sheet with its own address bar and a
// Done button, instead of navigating the whole PWA window.
(function setupInAppBrowser() {
  function hostOf(url) {
    try { return new URL(url, location.href).host; } catch (e) { return ''; }
  }
  function openInAppBrowser(rawUrl) {
    if (!rawUrl) return;
    var target;
    try { target = new URL(rawUrl, location.href); } catch (e) { return; }
    // Only same-origin pages can be framed; anything else opens normally.
    if (target.origin !== location.origin) { location.assign(target.href); return; }
    var existing = document.getElementById('mitch-iab');
    if (existing) existing.remove();
    var wrap = document.createElement('div');
    wrap.id = 'mitch-iab';
    wrap.setAttribute('role', 'dialog');
    wrap.setAttribute('aria-label', 'In-app browser');
    wrap.innerHTML =
      '<div class="mitch-iab-bar">' +
      '  <span class="mitch-iab-lock" aria-hidden="true">&#128274;</span>' +
      '  <b></b>' +
      '  <button id="mitch-iab-done" type="button">Done</button>' +
      '</div>' +
      '<iframe class="mitch-iab-frame" title="In-app browser" src="' + target.href + '"></iframe>';
    wrap.querySelector('.mitch-iab-bar b').textContent = hostOf(target.href);
    document.body.appendChild(wrap);
    requestAnimationFrame(function () { wrap.classList.add('show'); });
    wrap.querySelector('#mitch-iab-done').onclick = function () {
      wrap.classList.remove('show');
      var frame = wrap.querySelector('iframe');
      if (frame) frame.src = 'about:blank';
      setTimeout(function () { if (wrap.parentNode) wrap.remove(); }, 240);
    };
  }
  if ('serviceWorker' in navigator) {
    try {
      navigator.serviceWorker.addEventListener('message', function (ev) {
        if (ev.data && ev.data.type === 'open-in-app-browser' && ev.data.url) {
          openInAppBrowser(ev.data.url);
        }
      });
    } catch (e) {}
  }
  var css = document.createElement('style');
  css.id = 'mitch-iab-style';
  css.textContent =
    '#mitch-iab{position:fixed;inset:0;z-index:2147483640;display:flex;flex-direction:column;' +
    'background:var(--t-bg,#0a0817);opacity:0;transition:opacity .22s ease,transform .22s ease;transform:translateY(14px);' +
    'padding-top:env(safe-area-inset-top,0px)}' +
    '#mitch-iab.show{opacity:1;transform:none}' +
    '#mitch-iab .mitch-iab-bar{flex:0 0 auto;display:flex;align-items:center;gap:8px;padding:10px 12px;' +
    'padding-left:max(12px,env(safe-area-inset-left,0px));padding-right:max(12px,env(safe-area-inset-right,0px));' +
    'border-bottom:1px solid var(--t-bd,rgba(255,255,255,.14));background:var(--t-bg2,rgba(20,16,40,.96))}' +
    '#mitch-iab .mitch-iab-lock{font-size:12px;opacity:.7}' +
    '#mitch-iab .mitch-iab-bar b{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;' +
    'font:800 .82rem/1.2 var(--t-font,system-ui,sans-serif);color:var(--t-fg,#fff)}' +
    '#mitch-iab .mitch-iab-bar button{flex:0 0 auto;padding:7px 14px;border-radius:10px;cursor:pointer;' +
    'border:1px solid var(--t-bd,rgba(255,255,255,.16));background:var(--t-bg3,rgba(255,255,255,.08));' +
    'color:var(--t-ac,#c9a5ff);font:800 .78rem/1 system-ui,sans-serif}' +
    '#mitch-iab .mitch-iab-frame{flex:1;width:100%;border:0;background:#fff}';
  document.head.appendChild(css);
  window.__openInAppBrowser = openInAppBrowser;
})();

(function setupNotifications() {
  function escText(t) {
    var d = document.createElement('div');
    d.textContent = t == null ? '' : String(t);
    return d.innerHTML;
  }

  var _notifications = [];
  var _identityPromise = null;

  function loadIdentity() {
    if (!_identityPromise) {
      _identityPromise = fetch('/api/me', { credentials: 'include', cache: 'no-store' })
        .then(function(r) { return r.ok ? r.json() : null; })
        .catch(function() { return null; });
    }
    return _identityPromise;
  }

  function b64ToUint8(b64) {
    var pad = '='.repeat((4 - b64.length % 4) % 4);
    var raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
    return Uint8Array.from(Array.prototype.map.call(raw, function(c) { return c.charCodeAt(0); }));
  }

  async function ensurePushSubscription(askPermission) {
    if (!window.isSecureContext || !('Notification' in window) ||
        !('serviceWorker' in navigator) || !('PushManager' in window)) return false;
    var permission = Notification.permission;
    if (permission === 'default' && askPermission) permission = await Notification.requestPermission();
    if (permission !== 'granted') return false;

    var keyResponse = await fetch('/api/push/vapid-key', { credentials: 'include', cache: 'no-store' });
    if (!keyResponse.ok) throw new Error('Notification service unavailable');
    var keyData = await keyResponse.json();
    if (!keyData.publicKey) throw new Error('Notification service is not configured');

    var registration = await navigator.serviceWorker.getRegistration('/');
    if (!registration) registration = await navigator.serviceWorker.register('/sw.js?v=12', { scope: '/', updateViaCache: 'none' });
    await navigator.serviceWorker.ready;
    var subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: b64ToUint8(keyData.publicKey)
      });
    }
    var saveResponse = await fetch('/api/push/subscribe', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'X-Mitch-Requested-With': '1' },
      body: JSON.stringify(subscription)
    });
    if (!saveResponse.ok) throw new Error('Could not save notification settings');
    var bell = document.getElementById('sw-notif-btn');
    if (bell) {
      bell.classList.add('push-enabled');
      bell.title = 'Notifications enabled';
      bell.setAttribute('aria-label', 'Notifications enabled');
    }
    return true;
  }

  function removePushPrompt() {
    var prompt = document.getElementById('sw-push-prompt');
    if (!prompt) return;
    prompt.classList.remove('show');
    setTimeout(function() { if (prompt.parentNode) prompt.remove(); }, 230);
  }

  function showPushPrompt() {
    if (document.getElementById('sw-push-prompt')) return;
    var prompt = document.createElement('div');
    prompt.id = 'sw-push-prompt';
    prompt.setAttribute('role', 'dialog');
    prompt.setAttribute('aria-label', 'Enable Mitch.pro notifications');
    prompt.innerHTML =
      '<span class="sw-push-mark" aria-hidden="true">&#128276;</span>' +
      '<span class="sw-push-copy"><b>Stay in the loop</b><span>Enable alerts for encrypted messages, friends, rewards, and site updates.</span></span>' +
      '<span class="sw-push-actions"><button id="sw-push-later" type="button">Not now</button><button id="sw-push-enable" type="button">Enable alerts</button></span>';
    document.body.appendChild(prompt);
    requestAnimationFrame(function() { prompt.classList.add('show'); });
    document.getElementById('sw-push-later').onclick = function() {
      try { sessionStorage.setItem('_mitchPushPromptLater', '1'); } catch(e) {}
      removePushPrompt();
    };
    document.getElementById('sw-push-enable').onclick = async function() {
      var button = this;
      button.disabled = true;
      button.textContent = 'Enabling...';
      try {
        var enabled = await ensurePushSubscription(true);
        if (enabled) removePushPrompt();
        else {
          button.textContent = Notification.permission === 'denied' ? 'Blocked in browser' : 'Try again';
          button.disabled = Notification.permission === 'denied';
        }
      } catch(e) {
        button.disabled = false;
        button.textContent = 'Try again';
        var copy = prompt.querySelector('.sw-push-copy span');
        if (copy) copy.textContent = e.message || 'Could not enable alerts. Please try again.';
      }
    };
  }

  async function setupPushEnrollment() {
    if (!window.isSecureContext || !('Notification' in window) ||
        !('serviceWorker' in navigator) || !('PushManager' in window)) return;
    var identity = await loadIdentity();
    if (!identity || !identity.email) return;
    if (Notification.permission === 'granted') {
      ensurePushSubscription(false).catch(function(){});
      return;
    }
    if (Notification.permission !== 'default') return;
    try { if (sessionStorage.getItem('_mitchPushPromptLater') === '1') return; } catch(e) {}
    setTimeout(showPushPrompt, 900);
  }

  function showMessageToast(message) {
    if (!message || location.pathname.startsWith('/encrypt')) return;
    removePushPrompt();
    var stack = document.getElementById('sw-message-toasts');
    if (!stack) {
      stack = document.createElement('div');
      stack.id = 'sw-message-toasts';
      stack.setAttribute('aria-live', 'polite');
      document.body.appendChild(stack);
    }
    var sender = message.from || 'Someone';
    var title = message.kind === 'group' && message.groupName
      ? sender + ' in ' + message.groupName
      : 'Message from ' + sender;
    var toast = document.createElement('div');
    toast.className = 'sw-message-toast';
    toast.innerHTML = '<span class="sw-message-toast-icon" aria-hidden="true">&#10022;</span>' +
      '<span class="sw-message-toast-copy"><b>' + escText(title) + '</b><span>New encrypted message</span></span>' +
      '<a href="/encrypt/">Open</a>';
    stack.prepend(toast);
    while (stack.children.length > 3) stack.lastElementChild.remove();
    setTimeout(function() { if (toast.parentNode) toast.remove(); }, 9000);
    var originalTitle = document.title.replace(/^\u2022\s*/, '');
    document.title = '\u2022 ' + originalTitle;
    setTimeout(function() { if (document.title === '\u2022 ' + originalTitle) document.title = originalTitle; }, 9000);
  }

  window.__handleIncomingDm = async function(message) {
    loadNotifications();
    if (!message) return;
    var identity = await loadIdentity();
    var mine = String(identity && identity.email || '').toLowerCase();
    var sender = String(message.from || '').toLowerCase();
    if (!mine || !sender || sender === mine) return;
    showMessageToast(message);
  };

  window.__enableSiteNotifications = function() {
    return ensurePushSubscription(true);
  };

  function injectNotifCSS() {
    if (document.getElementById('sw-notif-styles')) return;
    var s = document.createElement('style');
    s.id = 'sw-notif-styles';
    s.textContent = 
      /* shared top-right toolbar */
      '#site-topbar { position: fixed; top: 10px; right: 12px; z-index: 1000001; display: flex; align-items: center; gap: 6px; overflow: visible; }' +
      '#sw-notif-wrap { position: relative; display: inline-flex; align-items: center; overflow: visible; isolation: isolate; }' +
      '#sw-notif-btn {' +
      '  width: 36px !important; height: 36px !important; min-width: 36px !important; min-height: 36px !important;' +
      '  padding: 0 !important; margin: 0; border-radius: 13px !important;' +
      '  display: flex !important; align-items: center; justify-content: center;' +
      '  background: linear-gradient(145deg,rgba(157,82,246,.28),rgba(22,12,47,.9)); color: #e2b4ff; border: 1px solid rgba(205,143,255,.38);' +
      '  cursor: pointer; box-shadow: inset 0 1px rgba(255,255,255,.13),0 8px 28px rgba(0,0,0,0.35);' +
      '  font-size: 15px; line-height: 1; position: relative; overflow: visible !important;' +
      '  backdrop-filter: blur(10px); flex-shrink: 0; box-sizing: border-box;' +
      '}' +
      '#sw-notif-count {' +
      '  display: none !important; position: absolute !important; top: -2px !important; right: -2px !important;' +
      '  z-index: 2; min-width: 16px !important; width: auto; height: 16px !important; padding: 0 4px !important;' +
      '  margin: 0 !important; border: 2px solid var(--t-bg, #10140c); border-radius: 99px !important;' +
      '  background: #ef4444 !important; color: #fff !important;' +
      '  align-items: center; justify-content: center;' +
      '  font-size: 9px !important; font-weight: 800 !important; line-height: 1 !important;' +
      '  pointer-events: none; box-sizing: border-box; overflow: visible;' +
      '}' +
      '#sw-notif-count.is-visible { display: inline-flex !important; }' +
      '#sw-notif-panel {' +
      '  display: none; position: absolute; top: 44px; right: 0;' +
      '  width: min(370px, calc(100vw - 24px)); max-height: min(470px, calc(100vh - 70px));' +
      '  background: radial-gradient(circle at 90% 0,rgba(183,83,255,.2),transparent 36%),rgba(10,7,25,.97); border: 1px solid rgba(214,173,255,.2);' +
      '  border-radius: 18px; box-shadow: 0 22px 70px rgba(0,0,0,0.65),inset 0 1px rgba(255,255,255,.09);' +
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
      '  border-radius: 13px; background: linear-gradient(145deg,rgba(255,255,255,.055),rgba(255,255,255,.02)); margin-bottom: 7px;' +
      '}' +
      '.sw-notif-title { color: #fff; font-size: .82rem; font-weight: 800; margin-bottom: 3px; }' +
      '.sw-notif-body { color: rgba(255,255,255,0.7); font-size: .78rem; line-height: 1.35; }' +
      '.sw-notif-detail { color: rgba(255,255,255,0.5); opacity: .7; font-size: .72rem; line-height: 1.35; margin-top: 3px; }' +
      '.sw-notif-actions { display: flex; gap: 7px; margin-top: 8px; }' +
      '.sw-notif-actions button, .sw-notif-open {' +
      '  flex: 1; text-align: center; text-decoration: none;' +
      '  background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);' +
      '  color: #dda4ff; border-radius: 9px; padding: 6px 8px;' +
      '  font-size: .72rem; cursor: pointer;' +
      '}' +
      '#sw-push-prompt {' +
      '  position: fixed; left: 50%; bottom: max(18px, env(safe-area-inset-bottom)); z-index: 2147483000;' +
      '  width: min(520px, calc(100vw - 24px)); box-sizing: border-box; padding: 14px;' +
      '  display: grid; grid-template-columns: 42px minmax(0,1fr) auto; align-items: center; gap: 12px;' +
      '  border: 1px solid rgba(218,178,255,.26); border-radius: 18px;' +
      '  color: #fff; background: linear-gradient(145deg,rgba(34,18,66,.94),rgba(10,7,27,.96));' +
      '  box-shadow: 0 24px 70px rgba(0,0,0,.55), inset 0 1px rgba(255,255,255,.12);' +
      '  backdrop-filter: blur(24px) saturate(145%); -webkit-backdrop-filter: blur(24px) saturate(145%);' +
      '  transform: translate(-50%, 18px); opacity: 0; transition: opacity .22s ease, transform .22s ease;' +
      '}' +
      '#sw-push-prompt.show { opacity: 1; transform: translate(-50%, 0); }' +
      '.sw-push-mark { width:42px; height:42px; display:grid; place-items:center; border-radius:14px;' +
      '  background:linear-gradient(145deg,#985cff,#ef58bd); box-shadow:0 9px 25px rgba(184,75,241,.35); font-size:19px; }' +
      '.sw-push-copy { min-width:0; }' +
      '.sw-push-copy b { display:block; margin-bottom:3px; font:800 .84rem/1.2 system-ui,sans-serif; }' +
      '.sw-push-copy span { display:block; color:rgba(240,230,255,.68); font:500 .73rem/1.35 system-ui,sans-serif; }' +
      '.sw-push-actions { display:flex; gap:7px; }' +
      '.sw-push-actions button { min-height:34px; padding:0 11px !important; border-radius:10px !important;' +
      '  border:1px solid rgba(255,255,255,.15) !important; color:#fff !important; font:700 .7rem/1 system-ui,sans-serif !important; }' +
      '#sw-push-enable { background:linear-gradient(135deg,#8b5cf6,#d946ef) !important; }' +
      '#sw-push-later { background:rgba(255,255,255,.055) !important; }' +
      '#sw-message-toasts { position:fixed; right:14px; bottom:14px; z-index:2147482999; display:grid; gap:8px;' +
      '  width:min(360px,calc(100vw - 28px)); pointer-events:none; }' +
      '.sw-message-toast { pointer-events:auto; display:grid; grid-template-columns:38px minmax(0,1fr) auto; gap:10px; align-items:center;' +
      '  padding:11px; border:1px solid rgba(219,181,255,.24); border-radius:16px; color:#fff;' +
      '  background:linear-gradient(145deg,rgba(35,18,69,.95),rgba(9,6,25,.96)); box-shadow:0 18px 52px rgba(0,0,0,.5);' +
      '  backdrop-filter:blur(22px); -webkit-backdrop-filter:blur(22px); animation:swToastIn .22s ease both; }' +
      '.sw-message-toast-icon { width:38px;height:38px;display:grid;place-items:center;border-radius:13px;background:linear-gradient(145deg,#d946ef,#7657ff);font-size:17px; }' +
      '.sw-message-toast-copy { min-width:0; } .sw-message-toast-copy b,.sw-message-toast-copy span { display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap; }' +
      '.sw-message-toast-copy b { font:800 .8rem/1.2 system-ui,sans-serif; } .sw-message-toast-copy span { margin-top:3px;color:rgba(237,225,255,.68);font:500 .71rem/1.2 system-ui,sans-serif; }' +
      '.sw-message-toast a { padding:8px 10px;border-radius:10px;color:#fff;background:rgba(170,91,255,.18);border:1px solid rgba(210,157,255,.22);text-decoration:none;font:750 .68rem/1 system-ui,sans-serif; }' +
      '@keyframes swToastIn { from { opacity:0; transform:translateY(10px); } }' +
      '@media(max-width:620px){#sw-push-prompt{grid-template-columns:38px minmax(0,1fr);padding:12px;gap:9px}.sw-push-mark{width:38px;height:38px}.sw-push-actions{grid-column:1/-1}.sw-push-actions button{flex:1}#sw-message-toasts{left:10px;right:10px;bottom:10px;width:auto}.sw-message-toast{grid-template-columns:36px minmax(0,1fr) auto}}' +
      '@media(prefers-reduced-motion:reduce){#sw-push-prompt,.sw-message-toast{transition:none;animation:none}}';
    document.head.appendChild(s);
  }

  function injectNotifHTML() {
    if (document.getElementById('sw-notif-wrap')) return;
    // Create shared topbar if not already present
    var topbar = document.getElementById('site-topbar');
    if (!topbar) {
      topbar = document.createElement('div');
      topbar.id = 'site-topbar';
      document.body.appendChild(topbar);
    }
    var wrap = document.createElement('div');
    wrap.id = 'sw-notif-wrap';
    wrap.innerHTML = 
      '<button id="sw-notif-btn" type="button" title="Notifications">&#128276;<span id="sw-notif-count">0</span></button>' +
      '<div id="sw-notif-panel">' +
      '  <div class="sw-notif-head">' +
      '    <span>Notifications</span>' +
      '    <button id="sw-notif-manage" type="button" title="Turn message alerts on or off">Alerts: …</button>' +
      '    <button id="sw-notif-read-all" type="button">Read all</button>' +
      '    <button id="sw-notif-close" type="button">Close</button>' +
      '  </div>' +
      '  <div id="sw-notif-list"><div class="sw-notif-empty">No unread notifications</div></div>' +
      '</div>';
    topbar.appendChild(wrap);
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
    badge.classList.toggle('is-visible', count > 0);
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
      : n.type === 'group_dm'
        ? { groupIds: [n.groupId] }
      : n.type === 'dm'
        ? { dmFroms: [n.from] }
        : {};
    _notifications = _notifications.filter(function(item) { return item !== n; });
    renderNotifications();
    await fetch('/api/me/notifications/read', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'X-Mitch-Requested-With': '1' },
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
      headers: { 'Content-Type': 'application/json', 'X-Mitch-Requested-With': '1' },
      body: JSON.stringify({ all: true }),
    }).catch(function(){});
  }

  // ── Alerts manager: one button to turn push alerts on/off ───────────────
  async function refreshAlertsButton() {
    var btn = document.getElementById('sw-notif-manage');
    if (!btn) return;
    var on = false;
    try {
      var reg = await navigator.serviceWorker.getRegistration('/');
      var sub = reg && await reg.pushManager.getSubscription();
      on = !!sub;
    } catch (e) {}
    btn.textContent = on ? 'Alerts: on' : 'Alerts: off';
    btn.dataset.state = on ? 'on' : 'off';
    if (!('Notification' in window) || !window.isSecureContext) {
      btn.disabled = true;
      btn.textContent = 'Alerts: n/a';
    }
  }
  async function toggleAlerts() {
    var btn = document.getElementById('sw-notif-manage');
    if (!btn) return;
    btn.disabled = true;
    try {
      var reg = await navigator.serviceWorker.getRegistration('/');
      var sub = reg && await reg.pushManager.getSubscription();
      if (sub) {
        // Off: drop the browser subscription and the server copy of it.
        await fetch('/api/push/unsubscribe', {
          method: 'POST', credentials: 'include',
          headers: { 'Content-Type': 'application/json', 'X-Mitch-Requested-With': '1' },
        }).catch(function () {});
        try { await sub.unsubscribe(); } catch (e) {}
      } else {
        var enabled = await window.__enableSiteNotifications();
        if (!enabled) { btn.textContent = 'Alerts: blocked'; btn.dataset.state = 'off'; btn.disabled = false; return; }
      }
      await refreshAlertsButton();
    } catch (e) {}
    btn.disabled = false;
  }

  function init() {
    // Don't show on appeal page
    if (location.pathname.endsWith('/appeal.html')) return;
    
    injectNotifCSS();
    injectNotifHTML();

    // On encrypt page: move topbar into the sidebar-top bar to avoid covering chat tools
    if (window.location.pathname.startsWith('/encrypt')) {
      function relocateToSidebar() {
        var sidebarTop = document.getElementById('sidebar-top');
        var topbar = document.getElementById('site-topbar');
        if (sidebarTop && topbar) {
          topbar.style.cssText = 'position:relative;top:auto;right:auto;z-index:100;display:inline-flex;align-items:center;gap:6px;';
          sidebarTop.appendChild(topbar);
          // Keep the notification panel fixed so it opens without clipping
          var panel = document.getElementById('sw-notif-panel');
          if (panel) {
            panel.style.position = 'fixed';
            panel.style.top = '50px';
            panel.style.left = '8px';
            panel.style.right = 'auto';
          }
        }
      }
      // sidebar-top may not exist yet if app hasn't rendered; try now and after short delay
      relocateToSidebar();
      setTimeout(relocateToSidebar, 500);
    }

    var btn = document.getElementById('sw-notif-btn');
    var panel = document.getElementById('sw-notif-panel');
    if (!btn || !panel) return;

    document.getElementById('sw-notif-close').onclick = function() {
      panel.classList.remove('show');
    };
    document.getElementById('sw-notif-manage').onclick = toggleAlerts;
    refreshAlertsButton();
    document.getElementById('sw-notif-read-all').onclick = markAllNotificationsRead;
    btn.onclick = function(e) {
      e.stopPropagation();
      panel.classList.toggle('show');
      if (panel.classList.contains('show')) { loadNotifications(); refreshAlertsButton(); }
    };
    panel.onclick = function(e) { e.stopPropagation(); };
    document.addEventListener('click', function() { panel.classList.remove('show'); });
    loadNotifications();
    setupPushEnrollment();
    window.__refreshNotifications = loadNotifications;
    setInterval(loadNotifications, 30000);
  }

  if (document.body) init();
  else document.addEventListener('DOMContentLoaded', init);
})();
