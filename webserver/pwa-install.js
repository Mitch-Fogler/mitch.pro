// pwa-install.js — PWA install promotion. Injected site-wide (except games).
// Captures the browser's beforeinstallprompt and offers a dismissible banner;
// on iOS (no beforeinstallprompt) explains the Share → Add to Home Screen flow.

(function () {
  'use strict';

  var DISMISS_KEY = 'mitch_pwa_install_dismissed';
  var deferredPrompt = null;
  var bannerShown = false;

  function isStandalone() {
    try {
      return window.matchMedia('(display-mode: standalone)').matches ||
             window.navigator.standalone === true;
    } catch (e) { return false; }
  }

  function isIos() {
    return /iphone|ipad|ipod/i.test(navigator.userAgent) ||
           (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  }

  function dismissedBefore() {
    try { return localStorage.getItem(DISMISS_KEY) === '1'; } catch (e) { return false; }
  }

  function rememberDismissal() {
    try { localStorage.setItem(DISMISS_KEY, '1'); } catch (e) {}
  }

  // Only surface the banner on real pages, not inside embedded game frames.
  function allowedHere() {
    try {
      if (window.top !== window.self) return false;
      return !window.location.pathname.startsWith('/games/');
    } catch (e) { return false; }
  }

  function injectStyles() {
    if (document.getElementById('mitch-pwa-styles')) return;
    var s = document.createElement('style');
    s.id = 'mitch-pwa-styles';
    s.textContent =
      '#mitchPwaBanner{position:fixed;left:50%;bottom:18px;transform:translate(-50%,20px);opacity:0;' +
      'z-index:99990;display:flex;align-items:center;gap:12px;width:min(440px,calc(100vw - 24px));' +
      'padding:14px 16px;border-radius:16px;border:1px solid rgba(148,163,184,0.2);' +
      'background:linear-gradient(180deg,rgba(25,30,45,0.96),rgba(15,18,28,0.98));color:#e2e8f0;' +
      'box-shadow:0 18px 48px rgba(0,0,0,0.5);font-family:Inter,ui-sans-serif,system-ui,-apple-system,sans-serif;' +
      'transition:opacity .25s ease,transform .25s ease}' +
      '#mitchPwaBanner.show{opacity:1;transform:translate(-50%,0)}' +
      '#mitchPwaBanner .mitch-pwa-ico{font-size:26px;line-height:1}' +
      '#mitchPwaBanner .mitch-pwa-copy{flex:1;min-width:0}' +
      '#mitchPwaBanner .mitch-pwa-copy b{display:block;font-size:13px;font-weight:800;letter-spacing:.3px}' +
      '#mitchPwaBanner .mitch-pwa-copy span{display:block;font-size:11.5px;color:#94a3b8;margin-top:2px}' +
      '#mitchPwaBanner button{cursor:pointer;font-family:inherit;font-size:12px;font-weight:700;' +
      'border-radius:9px;padding:8px 14px;border:1px solid rgba(148,163,184,0.18);' +
      'background:rgba(148,163,184,0.08);color:#cbd5e1}' +
      '#mitchPwaBanner #mitchPwaInstall{background:#2dd4bf;border-color:#2dd4bf;color:#0f172a;' +
      'box-shadow:0 4px 12px rgba(45,212,191,0.25)}' +
      '#mitchPwaBanner #mitchPwaInstall:hover{background:#22bfa9}' +
      '@media(max-width:560px){#mitchPwaBanner{bottom:10px;padding:12px}}';
    document.head.appendChild(s);
  }

  function showBanner(canAutoInstall) {
    if (bannerShown || isStandalone() || dismissedBefore() || !allowedHere()) return;
    if (!document.body) { document.addEventListener('DOMContentLoaded', function () { showBanner(canAutoInstall); }); return; }
    bannerShown = true;
    injectStyles();

    var copy = canAutoInstall
      ? 'Add Mitch.pro to your home screen — full screen, offline, and message alerts.'
      : 'On iPhone: tap Share, then "Add to Home Screen" to install Mitch.pro with alerts.';

    var banner = document.createElement('div');
    banner.id = 'mitchPwaBanner';
    banner.setAttribute('role', 'dialog');
    banner.setAttribute('aria-label', 'Install Mitch.pro app');
    banner.innerHTML =
      '<span class="mitch-pwa-ico" aria-hidden="true">📲</span>' +
      '<span class="mitch-pwa-copy"><b>Install the app</b><span></span></span>' +
      '<button id="mitchPwaLater" type="button">Later</button>' +
      '<button id="mitchPwaInstall" type="button">Install</button>';
    banner.querySelector('.mitch-pwa-copy span').textContent = copy;
    document.body.appendChild(banner);
    requestAnimationFrame(function () { banner.classList.add('show'); });

    function close(remember) {
      if (remember) rememberDismissal();
      banner.classList.remove('show');
      setTimeout(function () { if (banner.parentNode) banner.remove(); }, 260);
    }

    banner.querySelector('#mitchPwaLater').onclick = function () { close(true); };
    banner.querySelector('#mitchPwaInstall').onclick = function () {
      if (deferredPrompt) {
        deferredPrompt.prompt();
        deferredPrompt.userChoice.finally(function () { deferredPrompt = null; close(false); });
      } else {
        // iOS / unsupported: send the user to the encrypt page where the
        // install flow matters most, and remember they engaged with it.
        close(true);
        window.location.href = '/encrypt/';
      }
    };
  }

  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    deferredPrompt = e;
    if (!isStandalone() && !dismissedBefore() && allowedHere()) {
      // Give the page a moment to settle before offering.
      setTimeout(function () { showBanner(true); }, 2500);
    }
  });

  window.addEventListener('appinstalled', function () {
    rememberDismissal();
  });

  // iOS never fires beforeinstallprompt — offer the manual flow instead,
  // but only once and never inside the installed app.
  if (isIos() && !isStandalone() && !dismissedBefore() && allowedHere()) {
    setTimeout(function () { showBanner(false); }, 4000);
  }
})();