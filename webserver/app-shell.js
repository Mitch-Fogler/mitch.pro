(function () {
  'use strict';

  var NAV = [
    { href: '/', label: 'Home', match: function (p) { return p === '/' || p === '/index.html'; } },
    { href: '/games/', label: 'Games', match: function (p) { return p.indexOf('/games') === 0; } },
    { href: '/public-chat/', label: 'Plaza', match: function (p) { return p.indexOf('/public-chat') === 0 || p.indexOf('/encrypt') === 0; } },
    { href: '/shop/', label: 'Market', match: function (p) { return p.indexOf('/shop') === 0 || p.indexOf('/marketplace') === 0; } },
    { href: '/casino/', label: 'Casino', match: function (p) { return p.indexOf('/casino') === 0; } },
    { href: '/leaderboard/', label: 'Ranks', match: function (p) { return p.indexOf('/leaderboard') === 0; } },
    { href: '/preferences/', label: 'Preferences', match: function (p) { return p.indexOf('/preferences') === 0; } }
  ];

  function ensureRelaunchStyles() {
    if (document.getElementById('mitch-relaunch') || document.querySelector('link[href="/relaunch.css"], link[href^="/relaunch.css?"]')) return;
    var link = document.createElement('link');
    link.id = 'mitch-relaunch';
    link.rel = 'stylesheet';
    link.href = '/relaunch.css';
    (document.head || document.getElementsByTagName('head')[0]).appendChild(link);
  }

  function ensureViewport() {
    if (document.querySelector('meta[name="viewport"]')) return;
    var meta = document.createElement('meta');
    meta.name = 'viewport';
    meta.content = 'width=device-width, initial-scale=1';
    var head = document.head || document.getElementsByTagName('head')[0];
    if (head) head.insertBefore(meta, head.firstChild);
  }

  function ensureFonts() {
    if (document.getElementById('app-fonts')) return;
    if (document.querySelector('link[href*="fonts.googleapis.com"][href*="Outfit"]')) return;
    var link = document.createElement('link');
    link.id = 'app-fonts';
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Outfit:wght@500;600;700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap';
    var head = document.head || document.getElementsByTagName('head')[0];
    if (head) head.appendChild(link);
  }

  function currentPath() {
    try {
      return (location.pathname || '/').replace(/\/+$/, '') || '/';
    } catch (e) {
      return '/';
    }
  }

  function buildTopbar() {
    var path = currentPath();
    var bar = document.createElement('header');
    bar.id = 'app-topbar';
    bar.className = 'app-topbar';
    bar.setAttribute('role', 'banner');

    var brand = document.createElement('a');
    brand.className = 'app-brand';
    brand.href = '/';
    brand.textContent = 'mitch.pro';
    brand.setAttribute('aria-label', 'mitch.pro home');

    var nav = document.createElement('nav');
    nav.className = 'app-nav';
    nav.setAttribute('aria-label', 'Primary');

    for (var i = 0; i < NAV.length; i++) {
      var item = NAV[i];
      var a = document.createElement('a');
      a.href = item.href;
      a.textContent = item.label;
      if (item.match(path)) a.setAttribute('aria-current', 'page');
      nav.appendChild(a);
    }

    bar.appendChild(brand);
    bar.appendChild(nav);
    return bar;
  }

  function bindScrollState(bar) {
    var ticking = false;
    function update() {
      ticking = false;
      if (window.scrollY > 8) bar.classList.add('is-scrolled');
      else bar.classList.remove('is-scrolled');
    }
    window.addEventListener('scroll', function () {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(update);
    }, { passive: true });
    update();
  }

  function shouldInject() {
    var body = document.body;
    if (!body) return false;
    if (body.dataset.shell === 'off') return false;
    if (document.getElementById('app-topbar')) return false;
    return true;
  }

  function inject() {
    ensureViewport();
    ensureFonts();
    ensureRelaunchStyles();
    if (!shouldInject()) {
      window.MitchShell = { ready: true, injected: false };
      return;
    }

    var bar = buildTopbar();
    var body = document.body;
    body.insertBefore(bar, body.firstChild);
    if (!body.classList.contains('app-shell')) {
      body.classList.add('app-shell');
    }
    bindScrollState(bar);
    window.MitchShell = { ready: true, injected: true };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inject);
  } else {
    inject();
  }
})();
