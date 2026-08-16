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
    var current = document.querySelector('meta[name="viewport"]');
    if (current) {
      if (current.content.indexOf('viewport-fit=cover') === -1) current.content += ', viewport-fit=cover';
      return;
    }
    var meta = document.createElement('meta');
    meta.name = 'viewport';
    meta.content = 'width=device-width, initial-scale=1, viewport-fit=cover';
    var head = document.head || document.getElementsByTagName('head')[0];
    if (head) head.insertBefore(meta, head.firstChild);
  }

  function ensureInstallMetadata() {
    var metas = {
      'theme-color': '#05070d',
      'mobile-web-app-capable': 'yes',
      'apple-mobile-web-app-capable': 'yes',
      'apple-mobile-web-app-status-bar-style': 'black-translucent',
      'apple-mobile-web-app-title': 'mitch.pro'
    };
    Object.keys(metas).forEach(function (name) {
      if (document.querySelector('meta[name="' + name + '"]')) return;
      var meta = document.createElement('meta');
      meta.name = name;
      meta.content = metas[name];
      document.head.appendChild(meta);
    });
    if (!document.querySelector('link[rel="manifest"]')) {
      var manifest = document.createElement('link');
      manifest.rel = 'manifest';
      manifest.href = '/manifest.json';
      document.head.appendChild(manifest);
    }
    if (!document.querySelector('link[rel="apple-touch-icon"]')) {
      var touchIcon = document.createElement('link');
      touchIcon.rel = 'apple-touch-icon';
      touchIcon.sizes = '180x180';
      touchIcon.href = '/apple-touch-icon.png';
      document.head.appendChild(touchIcon);
    }
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

  function enhanceRelaunchMotion() {
    if (!document.body) return;
    document.body.classList.add('relaunch-ready');
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    var items = document.querySelectorAll('.page-head, .panel, .card, .category-group, .listing-item, .rank-row, .admin-day-card');
    if (!('IntersectionObserver' in window)) {
      for (var fallbackIndex = 0; fallbackIndex < items.length; fallbackIndex++) items[fallbackIndex].classList.add('is-visible');
      return;
    }
    var observer = new IntersectionObserver(function (entries) {
      for (var i = 0; i < entries.length; i++) {
        if (!entries[i].isIntersecting) continue;
        entries[i].target.classList.add('is-visible');
        window.setTimeout(function (node) {
          node.classList.remove('relaunch-reveal', 'is-visible');
          node.style.removeProperty('--reveal-order');
        }, 1100, entries[i].target);
        observer.unobserve(entries[i].target);
      }
    }, { rootMargin: '0px 0px -5% 0px', threshold: 0.06 });
    for (var itemIndex = 0; itemIndex < items.length; itemIndex++) {
      items[itemIndex].classList.add('relaunch-reveal');
      items[itemIndex].style.setProperty('--reveal-order', String(itemIndex % 8));
      observer.observe(items[itemIndex]);
    }
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
    ensureInstallMetadata();
    ensureFonts();
    ensureRelaunchStyles();
    enhanceRelaunchMotion();
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
