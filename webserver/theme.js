(function () {
  /* ── Two-mode theme engine ────────────────────────────────────────────────
     Dark (default) and light. Everything on the site rides the --t-* tokens
     set here, so switching modes re-colors every page. A sun/moon toggle
     button (#theme-btn) flips the mode and remembers it in the `theme`
     cookie. Legacy multi-theme cookie values (void, daylight, github, …)
     normalize to dark or light. */

  var DARK = {
    name: 'Dark',
    bg: '#171918', bg2: '#202321', bg3: '#2b2f2c',
    fg: '#f1f0e9', fg2: '#adafa6',
    ac: '#f29b85', ac2: '#ffc1ae', ac3: '#c87862',
    bd: '#383c37', bda: '#b87563',
    gl: 'rgba(242,155,133,0.2)', gls: 'rgba(242,155,133,0.10)',
    gr: 'linear-gradient(135deg,#f29b85,#e7ac8c)',
    bgr: 'none',
    bgImg: '',
    sw: '#f29b85',
  };
  var LIGHT = {
    name: 'Light',
    light: true,
    bg: '#f3f1e9', bg2: '#fffef9', bg3: '#e8e7dd',
    fg: '#252b26', fg2: '#626a5e',
    ac: '#a34330', ac2: '#813523', ac3: '#ba634d',
    bd: '#d6d8cb', bda: '#b97460',
    gl: 'rgba(163,67,48,0.2)', gls: 'rgba(163,67,48,0.10)',
    // Light mode keeps gradients in one indigo family — the old indigo→cyan→pink
    // sweep read as confetti. Page backdrop is a plain neutral wash.
    gr: 'linear-gradient(135deg,#a34330,#ba634d)',
    bgr: 'none',
    bgImg: '',
    sw: '#a34330',
  };
  var T = { dark: DARK, light: LIGHT };
  var LEGACY_LIGHT = { daylight: 1, paper: 1, arctic: 1, blossom: 1 };

  function normalize(name) {
    if (name === 'light' || LEGACY_LIGHT[name]) return 'light';
    return 'dark';
  }

  function getCookie() {
    var m = document.cookie.match(/(?:^|; )theme=([^;]+)/);
    return m ? normalize(decodeURIComponent(m[1])) : 'dark';
  }
  function setCookie(mode) {
    document.cookie = 'theme=' + encodeURIComponent(mode) + ';path=/;max-age=31536000';
  }

  function getBgImgCookie() {
    var m = document.cookie.match(/(?:^|; )bgimg=([^;]*)/);
    return m ? decodeURIComponent(m[1]) : '';
  }
  function setBgImgCookie(url) {
    document.cookie = 'bgimg=' + encodeURIComponent(url || '') + ';path=/;max-age=31536000';
  }

  function getPref(key, fallback) {
    try {
      var v = localStorage.getItem('theme_' + key);
      return v === null ? fallback : v;
    } catch (_) { return fallback; }
  }
  function setPref(key, value) {
    try { localStorage.setItem('theme_' + key, String(value)); } catch (_) {}
  }
  function clamp(n, min, max) {
    n = Number(n);
    return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : min;
  }
  function hexToRgba(hex, alpha) {
    var m = /^#?([0-9a-f]{6})$/i.exec(String(hex || ''));
    if (!m) return '';
    var n = parseInt(m[1], 16);
    return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + alpha + ')';
  }
  function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    var max = Math.max(r, g, b), min = Math.min(r, g, b), h = 0, s = 0;
    var l = (max + min) / 2;
    if (max !== min) {
      var d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      if (max === r) h = ((g - b) / d + (g < b ? 6 : 0));
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h *= 60;
    }
    return [h, s, l];
  }
  function hslToHex(h, s, l) {
    h = ((h % 360) + 360) % 360;
    s = clamp(s, 0, 1); l = clamp(l, 0, 1);
    var c = (1 - Math.abs(2 * l - 1)) * s;
    var x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    var m = l - c / 2;
    var rgb;
    if (h < 60) rgb = [c, x, 0];
    else if (h < 120) rgb = [x, c, 0];
    else if (h < 180) rgb = [0, c, x];
    else if (h < 240) rgb = [0, x, c];
    else if (h < 300) rgb = [x, 0, c];
    else rgb = [c, 0, x];
    var to = function (v) {
      var n = Math.round((v + m) * 255);
      return ('0' + clamp(n, 0, 255).toString(16)).slice(-2);
    };
    return '#' + to(rgb[0]) + to(rgb[1]) + to(rgb[2]);
  }
  function applyCustomizationPrefs() {
    var r = document.documentElement.style;
    var dim = clamp(getPref('dim', '0.50'), 0, 0.85);
    var bgMode = getPref('bgmode', 'cover');
    var bgSize = bgMode === 'contain' ? 'contain' : bgMode === 'tile' ? 'auto' : bgMode === 'stretch' ? '100% 100%' : 'cover';
    var bgRepeat = bgMode === 'tile' ? 'repeat' : 'no-repeat';
    var bgPos = getPref('bgpos', 'center');
    var defaultDensity = navigator.userAgent.includes('CrOS') ? 'compact' : 'normal';
    var density = getPref('density', defaultDensity);
    var radius = getPref('radius', 'soft');
    var font = getPref('font', 'system');
    var motion = getPref('motion', 'on');
    var fontMap = {
      system: '"Segoe UI",system-ui,-apple-system,sans-serif',
      mono: '"DM Mono","SFMono-Regular",Consolas,monospace',
      rounded: 'ui-rounded,"Nunito","Segoe UI",system-ui,sans-serif',
      serif: 'Georgia,"Times New Roman",serif',
      futuristic: '"Trebuchet MS","Segoe UI",system-ui,sans-serif'
    };
    var radiusMap = { sharp: '3px', soft: '8px', round: '14px', bubble: '22px' };
    var densityMap = { compact: '.9', normal: '1', comfy: '1.05', huge: '1.10' };
    r.setProperty('--t-bg-dim', dim.toFixed(2));
    r.setProperty('--t-bg-size', bgSize);
    r.setProperty('--t-bg-repeat', bgRepeat);
    r.setProperty('--t-bg-pos', bgPos);
    r.setProperty('--t-font', fontMap[font] || fontMap.system);
    r.setProperty('--t-radius', radiusMap[radius] || radiusMap.soft);
    r.setProperty('--t-ui-scale', densityMap[density] || '1');
    r.setProperty('--t-motion', motion === 'off' ? '0s' : '.15s');
    var accent = getPref('accent', '');
    if (/^#[0-9a-f]{6}$/i.test(accent)) {
      r.setProperty('--t-ac', accent);
      r.setProperty('--t-ac2', accent);
      r.setProperty('--t-bda', hexToRgba(accent, 0.55));
      r.setProperty('--t-gl', hexToRgba(accent, 0.48));
      r.setProperty('--t-gls', hexToRgba(accent, 0.15));
      r.setProperty('--t-gr', 'linear-gradient(135deg,' + accent + ',var(--t-ac3,#60a5fa))');
    }
    document.documentElement.classList.toggle('theme-no-motion', motion === 'off');
    applyMaterialMode();
  }

  function canUseGlass() {
    try {
      return !!(window.CSS && CSS.supports && (
        CSS.supports('backdrop-filter', 'blur(8px)') ||
        CSS.supports('-webkit-backdrop-filter', 'blur(8px)')
      ));
    } catch (_) {
      return false;
    }
  }

  function applyMaterialMode() {
    var pref = getPref('material', 'auto');
    if (pref !== 'glass' && pref !== 'solid' && pref !== 'auto') pref = 'auto';
    // Auto always solid. Explicit glass works wherever backdrop-filter is supported (incl. Firefox).
    var useGlass = pref === 'glass' ? canUseGlass() : false;
    document.documentElement.classList.toggle('theme-glass', useGlass);
    document.documentElement.classList.toggle('theme-solid', !useGlass);
    document.documentElement.setAttribute('data-material', useGlass ? 'glass' : 'solid');
    document.documentElement.setAttribute('data-material-pref', pref);
  }

  function getEffectiveBgImg() {
    var custom = getBgImgCookie();
    if (custom) return custom;
    return '';
  }

  function applyBgImg(url) {
    var r = document.documentElement.style;
    if (url) {
      r.setProperty('--t-bg-img-layer',
        'linear-gradient(rgba(0,0,0,var(--t-bg-dim,0.5)),rgba(0,0,0,var(--t-bg-dim,0.5))),url(' + JSON.stringify(url) + ')');
    } else {
      r.setProperty('--t-bg-img-layer', 'var(--t-bgr, none)');
    }
    scheduleAdaptive();
  }

  /* ── Background-adaptive accent (dark mode) ────────────────────────────────
     Samples the active wallpaper (the url() inside --t-bg-img-layer / --t-bgr)
     on a tiny canvas, finds its dominant saturated hue, and tints the accent
     tokens to match — so the UI picks up the background's color. Skipped in
     light mode, when the user set a manual accent, or when theme_adapt=off. */

  var ADAPT_CACHE = {};
  var adaptTimer = null;
  // Tokens this feature owns — applyTheme only resets --t-*, so clearAdaptive
  // must remove ALL of them (including the bg2/bg3 nudges and --ui-* writes)
  // or they'd survive a dark → light → dark round trip.
  var ADAPT_TOKENS = ['--t-ac', '--t-ac2', '--t-ac3', '--t-bda', '--t-gl', '--t-gls', '--t-gr', '--t-bg2', '--t-bg3', '--ui-blue', '--ui-blue-2'];

  function scheduleAdaptive() {
    clearTimeout(adaptTimer);
    adaptTimer = setTimeout(applyAdaptiveTheme, 250);
  }

  function clearAdaptive() {
    var r = document.documentElement.style;
    for (var i = 0; i < ADAPT_TOKENS.length; i++) r.removeProperty(ADAPT_TOKENS[i]);
    document.documentElement.removeAttribute('data-adapt');
  }

  function adaptiveImageUrl() {
    try {
      var style = getComputedStyle(document.documentElement);
      var cands = [style.getPropertyValue('--t-bg-img-layer'), style.getPropertyValue('--t-bgr')];
      for (var i = 0; i < cands.length; i++) {
        var m = /url\((['"]?)([^'")]+)\1\)/.exec(cands[i] || '');
        if (m && m[2]) return m[2].trim();
      }
    } catch (_) {}
    return '';
  }

  function applyAdaptiveTheme(force) {
    var root = document.documentElement;
    if (getPref('adapt', 'on') === 'off' && !force) { clearAdaptive(); return; }
    if (root.classList.contains('theme-light')) { clearAdaptive(); return; }
    // A manual accent is the user's explicit choice — never override it.
    if (/^#[0-9a-f]{6}$/i.test(getPref('accent', ''))) { clearAdaptive(); return; }

    var url = adaptiveImageUrl();
    if (!url) { clearAdaptive(); return; }
    var mode = root.classList.contains('theme-light') ? 'light' : 'dark';
    var cacheKey = mode + '|' + url;

    var cached = ADAPT_CACHE[cacheKey];
    if (cached) {
      if (cached.failed) { clearAdaptive(); return; }
      writeAdaptiveTokens(cached.tokens);
      return;
    }

    // Cross-origin wallpapers taint the canvas — pre-reject instead of trying.
    var abs = null;
    try { abs = new URL(url, location.href); } catch (_) {}
    if (!abs || abs.origin !== location.origin) {
      ADAPT_CACHE[cacheKey] = { failed: true };
      clearAdaptive();
      return;
    }

    var img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = function () {
      try {
        var tokens = sampleImagePalette(img);
        ADAPT_CACHE[cacheKey] = { tokens: tokens };
        writeAdaptiveTokens(tokens);
      } catch (_) {
        ADAPT_CACHE[cacheKey] = { failed: true };
        clearAdaptive();
      }
    };
    img.onerror = function () {
      ADAPT_CACHE[cacheKey] = { failed: true };
      clearAdaptive();
    };
    img.src = abs.href;
  }

  function sampleImagePalette(img) {
    var SIZE = 32;
    var canvas = document.createElement('canvas');
    canvas.width = SIZE; canvas.height = SIZE;
    var ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw Error('no 2d context');
    ctx.drawImage(img, 0, 0, SIZE, SIZE);
    var data = ctx.getImageData(0, 0, SIZE, SIZE).data;

    // 24 hue bins, weighted toward saturated mid-luminance pixels — this
    // ignores the dark overlay gradient that sits on top of the wallpaper.
    var BINS = 24, BIN = 360 / BINS;
    var bins = [];
    for (var i = 0; i < BINS; i++) bins.push({ w: 0, sinSum: 0, cosSum: 0, chroma: 0 });
    var meanL = 0, meanN = 0;
    for (var p = 0; p < data.length; p += 4) {
      var hsl = rgbToHsl(data[p], data[p + 1], data[p + 2]);
      var h = hsl[0], s = hsl[1], l = hsl[2];
      meanL += l; meanN++;
      if (s < 0.14 || l < 0.05 || l > 0.95) continue;
      var w = s * (1 - Math.abs(l - 0.42) * 1.6);
      if (w <= 0) continue;
      var rad = h * Math.PI / 180;
      var bin = bins[Math.min(BINS - 1, Math.floor(h / BIN))];
      bin.w += w;
      bin.sinSum += Math.sin(rad) * w;
      bin.cosSum += Math.cos(rad) * w;
      bin.chroma += s * w;
    }
    if (!meanN) throw Error('empty sample');
    meanL /= meanN;

    var best = null;
    for (var b = 0; b < BINS; b++) {
      if (bins[b].w <= 0) continue;
      if (!best || bins[b].w > best.w) best = bins[b];
    }
    if (!best) throw Error('no usable color');
    var H = Math.atan2(best.sinSum, best.cosSum) * 180 / Math.PI;
    var S = clamp(best.chroma / best.w * 1.15, 0.5, 0.86);
    var Lac = clamp(0.66 - (meanL - 0.30) * 0.25, 0.52, 0.72);

    var ac = hslToHex(H, S, Lac);
    var ac2 = hslToHex(H + 14, Math.min(S + 0.06, 0.9), Lac + 0.09);
    var ac3 = hslToHex(H + 320, S * 0.92, Lac - 0.06);
    return { ac: ac, ac2: ac2, ac3: ac3 };
  }

  function writeAdaptiveTokens(tokens) {
    var r = document.documentElement.style;
    // Same alphas as the manual-accent block in applyCustomizationPrefs(), so
    // adaptive and hand-picked accents are visually interchangeable.
    r.setProperty('--t-ac', tokens.ac);
    r.setProperty('--t-ac2', tokens.ac2);
    r.setProperty('--t-ac3', tokens.ac3);
    r.setProperty('--t-bda', hexToRgba(tokens.ac, 0.55));
    r.setProperty('--t-gl', hexToRgba(tokens.ac, 0.48));
    r.setProperty('--t-gls', hexToRgba(tokens.ac, 0.15));
    r.setProperty('--t-gr', 'linear-gradient(135deg,' + tokens.ac + ',' + tokens.ac3 + ')');

    // Nudge the translucent surfaces 12% toward the accent (never the opaque
    // page base or the wallpaper itself).
    blendSurface('--t-bg2', tokens.ac);
    blendSurface('--t-bg3', tokens.ac);

    // portal-redesign.css keeps its own --ui-* palette that never reads --t-*;
    // an inline style on <html> beats both its :root and .theme-light blocks.
    r.setProperty('--ui-blue', tokens.ac);
    r.setProperty('--ui-blue-2', tokens.ac2);
    document.documentElement.setAttribute('data-adapt', '1');
  }

  function blendSurface(prop, accentHex) {
    var cur = document.documentElement.style.getPropertyValue(prop) ||
      getComputedStyle(document.documentElement).getPropertyValue(prop) || '';
    var m = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)/.exec(cur);
    if (!m) return;
    var a = parseInt(accentHex.slice(1, 3), 16);
    var g = parseInt(accentHex.slice(3, 5), 16);
    var b = parseInt(accentHex.slice(5, 7), 16);
    var mix = function (cStr, ac) { return Math.round(Number(cStr) * 0.88 + ac * 0.12); };
    var out = 'rgba(' + mix(m[1], a) + ',' + mix(m[2], g) + ',' + mix(m[3], b) +
      (m[4] !== undefined ? ',' + m[4] : '') + ')';
    document.documentElement.style.setProperty(prop, out);
  }

  var SUN_SVG =
    '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<circle cx="12" cy="12" r="4.1"/>' +
    '<path d="M12 2.6v2.3M12 19.1v2.3M2.6 12h2.3M19.1 12h2.3M5.2 5.2l1.7 1.7M17.1 17.1l1.7 1.7M18.8 5.2l-1.7 1.7M6.9 17.1l-1.7 1.7"/>' +
    '</svg>';
  var MOON_SVG =
    '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M20.6 14.6A8.6 8.6 0 0 1 9.4 3.4a8.6 8.6 0 1 0 11.2 11.2Z"/>' +
    '</svg>';

  function syncToggleBtn() {
    var btn = document.getElementById('theme-btn');
    if (!btn) return;
    var light = getCookie() === 'light';
    btn.innerHTML = light ? MOON_SVG : SUN_SVG;
    btn.title = light ? 'Switch to dark theme' : 'Switch to light theme';
    btn.setAttribute('aria-label', btn.title);
    if (light) {
      btn.style.background = 'rgba(15,17,35,0.06)';
      btn.style.borderColor = 'rgba(15,17,35,0.18)';
      btn.style.color = '#1e1b4b';
    } else {
      btn.style.background = 'rgba(255,255,255,0.06)';
      btn.style.borderColor = 'rgba(255,255,255,0.16)';
      btn.style.color = 'rgba(255,255,255,0.85)';
    }
  }

  function applyTheme(name) {
    var t = T[normalize(name)];
    var r = document.documentElement.style;
    document.documentElement.classList.toggle('theme-light', !!(t.light));
    document.documentElement.style.colorScheme = t.light ? 'light' : 'dark';
    applyCustomizationPrefs();
    r.setProperty('--t-bg',  t.bg);
    r.setProperty('--t-bg2', t.bg2);
    r.setProperty('--t-bg3', t.bg3);
    r.setProperty('--t-fg',  t.fg);
    r.setProperty('--t-fg2', t.fg2);
    r.setProperty('--t-ac',  t.ac);
    r.setProperty('--t-ac2', t.ac2);
    r.setProperty('--t-ac3', t.ac3);
    r.setProperty('--t-bd',  t.bd);
    r.setProperty('--t-bda', t.bda);
    r.setProperty('--t-gl',  t.gl);
    r.setProperty('--t-gls', t.gls);
    r.setProperty('--t-gr',  t.gr);
    r.setProperty('--t-bgr', t.bgr);
    r.setProperty('--t-display', "'Figtree', system-ui, sans-serif");
    applyCustomizationPrefs();
    applyBgImg(getEffectiveBgImg());
    applyAdaptiveTheme();
    syncToggleBtn();
  }

  applyTheme(getCookie());

  var baseStyle = document.createElement('style');
  baseStyle.textContent =
    'html { font-size: calc(16px * var(--t-ui-scale, 1)); }' +
    'body{background-color:var(--t-bg);color:var(--t-fg);font-family:var(--t-font,"Segoe UI",system-ui,-apple-system,sans-serif);' +
      'background-image:var(--t-bg-img-layer,none)!important;' +
      'background-size:var(--t-bg-size,cover)!important;background-position:var(--t-bg-pos,center)!important;' +
      'background-repeat:var(--t-bg-repeat,no-repeat)!important;background-attachment:fixed!important;}' +
    'input,textarea,select{background:var(--t-bg2);color:var(--t-fg);border:1px solid var(--t-bd);' +
      'padding:7px 11px;border-radius:var(--t-radius,8px);font-family:inherit;font-size:.9rem;transition:border-color var(--t-motion,.15s),box-shadow var(--t-motion,.15s)}' +
    'input:focus,textarea:focus,select:focus{outline:none;border-color:var(--t-ac);box-shadow:0 0 0 3px var(--t-gls)}' +
    'body:not(.mitch-design) button:not(#devtools-btn):not(#theme-btn):not(.tbg-btn):not(#sw-notif-btn):not(.msg-more):not(.msg-action){background:var(--t-bg2);color:var(--t-ac);' +
      'border:1px solid var(--t-bda);padding:7px 16px;border-radius:var(--t-radius,8px);cursor:pointer;' +
      'font-family:inherit;font-size:.88rem;font-weight:500;transition:all var(--t-motion,.15s)}' +
    'body:not(.mitch-design) button:not(#devtools-btn):not(#theme-btn):not(.tbg-btn):not(#sw-notif-btn):not(.msg-more):not(.msg-action):hover{background:var(--t-bg3);box-shadow:0 0 8px var(--t-gls)}' +
    '.theme-no-motion *{animation-duration:0s!important;transition-duration:0s!important;scroll-behavior:auto!important}' +
    'hr{border:none;border-top:1px solid var(--t-bd)}' +
    'a{color:var(--t-ac)}a:hover{color:var(--t-ac2)}' +
    'label{color:var(--t-fg2)}' +
    // Installed PWA (iOS Dynamic Island / home indicator): let the themed
    // background extend edge-to-edge, but keep content clear of the cutouts.
    '@supports (padding: env(safe-area-inset-top)) {' +
      '@media (display-mode: standalone) {' +
        'body{padding-top:env(safe-area-inset-top)!important;padding-right:env(safe-area-inset-right)!important;' +
          'padding-bottom:env(safe-area-inset-bottom)!important;padding-left:env(safe-area-inset-left)!important}' +
        'html{background:var(--t-bg)}' +
        'body.home-galaxy .hud-topbar{top:calc(14px + env(safe-area-inset-top))!important}' +
      '}' +
    '}';
  document.head.appendChild(baseStyle);

  var lightStyle = document.createElement('style');
  lightStyle.id = 'theme-light-overrides';
  lightStyle.textContent =
    '.theme-light .glass-card,.theme-light .card,' +
    '.theme-light .hud-topbar,.theme-light .hud-hero-card,.theme-light .category-group,.theme-light .hud-widget-card,.theme-light .hud-nudge-card,.theme-light #hud-terminal-overlay{' +
      'background:rgba(255,255,255,0.72)!important;backdrop-filter:blur(24px) saturate(180%)!important;-webkit-backdrop-filter:blur(24px) saturate(180%)!important;' +
      'border:1px solid rgba(0,0,0,0.08)!important;box-shadow:0 12px 32px rgba(0,0,0,0.04),inset 0 1px 0 rgba(255,255,255,0.8)!important;color:#0f1123!important;}' +
    '.theme-light #sw-notif-btn{background:rgba(255,255,255,0.75)!important;border:1px solid rgba(0,0,0,0.14)!important;color:var(--t-ac)!important;}' +
    '.theme-light #sw-notif-panel{background:rgba(250,250,255,0.97)!important;border:1px solid rgba(0,0,0,0.1)!important;box-shadow:0 18px 60px rgba(0,0,0,0.12)!important;}' +
    '.theme-light .sw-notif-head{border-bottom:1px solid rgba(0,0,0,0.08)!important;}' +
    '.theme-light .sw-notif-head span,.theme-light .sw-notif-title{color:#0f1123!important;}' +
    '.theme-light .sw-notif-body,.theme-light .sw-notif-detail{color:rgba(15,17,35,0.65)!important;}' +
    '.theme-light .sw-notif-item{background:rgba(0,0,0,0.025)!important;border:1px solid rgba(0,0,0,0.07)!important;}' +
    '.theme-light .sw-notif-empty{color:rgba(15,17,35,0.45)!important;}' +
    '.theme-light .sw-notif-head button,.theme-light .sw-notif-head a.sw-notif-settings,.theme-light .sw-notif-actions button,.theme-light .sw-notif-open{background:rgba(0,0,0,0.04)!important;border:1px solid rgba(0,0,0,0.1)!important;color:var(--t-ac)!important;}' +
    '.theme-light button:not(#devtools-btn):not(#theme-btn):not(.tbg-btn):not(#sw-notif-btn):not(.btn-primary):not(.auth-tab-btn):not(.msg-more):not(.msg-action){background:rgba(255,255,255,0.7)!important;border:1px solid rgba(0,0,0,0.12)!important;color:var(--t-ac)!important;}' +
    '.theme-light button:not(#devtools-btn):not(#theme-btn):not(.tbg-btn):not(#sw-notif-btn):not(.btn-primary):not(.auth-tab-btn):not(.msg-more):not(.msg-action):hover{background:rgba(255,255,255,0.9)!important;box-shadow:0 4px 16px rgba(0,0,0,0.08)!important;}' +
    '.theme-light input:not([type=range]):not([type=color]),.theme-light textarea,.theme-light select{background:rgba(255,255,255,0.7)!important;color:#0f1123!important;border:1px solid rgba(0,0,0,0.12)!important;}' +
    '.theme-light input::placeholder,.theme-light textarea::placeholder{color:rgba(15,17,35,0.4)!important;}' +
    '.theme-light .back-btn{color:var(--t-ac)!important;}' +
    '.theme-light #mitch-watermark{opacity:0.5!important;}' +
    '.theme-light #_ap{background:rgba(250,250,255,0.97)!important;border:1px solid rgba(0,0,0,0.1)!important;box-shadow:0 8px 40px rgba(0,0,0,0.12)!important;}' +
    '.theme-light #_ah{border-bottom:1px solid rgba(0,0,0,0.08)!important;color:#0f1123!important;}' +
    '.theme-light ._mu{background:rgba(0,0,0,0.06)!important;color:#0f1123!important;}' +
    '.theme-light ._ma{background:rgba(0,0,0,0.04)!important;color:rgba(15,17,35,0.85)!important;}' +
    '.theme-light #_at{background:rgba(0,0,0,0.05)!important;color:#0f1123!important;border:1px solid rgba(0,0,0,0.1)!important;}' +
    '.theme-light #_as{background:var(--t-ac)!important;color:#fff!important;}' +
    '.theme-light #home-games-mega,.theme-light #home-prox-mega,.theme-light .mega-game-copy strong{color:var(--t-fg)!important;}' +
    '.theme-light .mega-game-copy small{color:var(--t-fg2)!important;}' +
    '.theme-light #home-games-mega .mega-game-arrow,.theme-light #home-prox-mega .mega-game-arrow{color:var(--t-fg)!important;background:rgba(0,0,0,0.06)!important;}' +
    '.theme-light #happy-hour-nudge.inactive{background:rgba(0,0,0,0.03)!important;border-color:rgba(0,0,0,0.08)!important;color:var(--t-fg2)!important;}' +
    '.theme-light #happy-hour-text{color:var(--t-fg2)!important;}' +
    '.theme-light #happy-hour-nudge.active{background:rgba(34,211,238,0.12)!important;border:1px solid rgba(34,211,238,0.5)!important;color:#0f766e!important;box-shadow:0 0 12px rgba(34,211,238,0.1)!important;}' +
    '.theme-light #achievement-nudge{background:rgba(245,158,11,0.1)!important;border:1px solid rgba(245,158,11,0.4)!important;color:#b45309!important;}' +
    '.theme-light #admin-dashboard-card strong{color:var(--t-fg)!important;}' +
    '.theme-light #admin-dashboard-card small{color:var(--t-fg2)!important;opacity:0.8!important;}' +
    '.theme-light .wallet strong,.theme-light .fs-wallet strong,.theme-light .hist strong{color:var(--t-fg)!important;}' +
    '.theme-light .listing-title{color:var(--t-fg)!important;}' +
    '.theme-light .btn.sec{color:var(--t-fg)!important;background:rgba(0,0,0,0.05)!important;border-color:rgba(0,0,0,0.1)!important;}' +
    '.theme-light h1,.theme-light h2,.theme-light h3,.theme-light h4,.theme-light h5,.theme-light h6{color:var(--t-fg)!important;}' +
    '.theme-light .brand{color:var(--t-fg)!important;}' +
    '.theme-light .opt-btn:hover{color:var(--t-fg)!important;background:rgba(0,0,0,0.08)!important;}' +
    '.theme-light .choice.active{color:var(--t-fg)!important;background:rgba(56,189,248,0.18)!important;}' +
    '.theme-light .glass-card strong,.theme-light .card strong{color:var(--t-fg)!important;}' +
    '.theme-light .glass-card small,.theme-light .card small{color:var(--t-fg2)!important;}' +
    '.theme-light #greeting-email,.theme-light .hud-brand,.theme-light #greeting-clock,.theme-light .widget-title,.theme-light .links-heading h3,.theme-light .category-title,.theme-light .category-title small,.theme-light #preferences-card span,.theme-light #abToggleBar span{color:#0f1123!important;text-shadow:none!important;}' +
    '.theme-light .category-title{border-bottom:1px solid rgba(0,0,0,0.08)!important;}' +
    '.theme-light .hero-subtitle,.theme-light .links-heading p,.theme-light #greeting-text,.theme-light .hud-kicker,.theme-light .status-user-view{color:rgba(15,17,35,0.7)!important;}' +
    '.theme-light a.site-link{background:rgba(0,0,0,0.02)!important;border:1px solid rgba(0,0,0,0.05)!important;color:#0f1123!important;}' +
    '.theme-light a.site-link:hover{background:rgba(0,0,0,0.04)!important;border-color:var(--t-ac)!important;color:var(--t-ac)!important;}' +
    '.theme-light a.site-link .lbl{color:#0f1123!important;}' +
    '.theme-light a.site-link:hover .lbl{color:var(--t-ac)!important;}' +
    '.theme-light .hud-search-area .home-search-box{background:rgba(255,255,255,0.6)!important;border:1px solid rgba(0,0,0,0.08)!important;}' +
    '.theme-light .hud-search-area #home-search{color:#0f1123!important;}' +
    '.theme-light .progress-bar-bg{background:rgba(0,0,0,0.05)!important;}' +
    '.theme-light .status-pill{background:rgba(34,197,94,0.1)!important;border:1px solid rgba(34,197,94,0.2)!important;}' +
    '.theme-light .hud-terminal-toggle-btn{background:rgba(0,0,0,0.03)!important;border:1px solid rgba(0,0,0,0.08)!important;color:#0f1123!important;}' +
    '.theme-light .hud-terminal-toggle-btn:hover{background:rgba(0,0,0,0.06)!important;border-color:var(--t-ac)!important;}' +
    // Neon-gold name colors are unreadable on the light background — swap to
    // a dark amber and drop the glow so usernames stay legible.
    '.theme-light .name.gold_glow,.theme-light .entry-name.gold_glow,.theme-light .display-name.gold_glow,.theme-light .author.gold_glow{color:#b45309!important;text-shadow:none!important;}' +
    '.theme-light .badge-premium,.theme-light .badge-shop,.theme-light .premium-label{color:#b45309!important;}';
  lightStyle.textContent = lightStyle.textContent.replaceAll('.theme-light button:not', '.theme-light body:not(.mitch-design) button:not');
  document.head.appendChild(lightStyle);

  function buildToggle() {
    if (document.getElementById('theme-btn')) return syncToggleBtn();
    var btn = document.createElement('button');
    btn.id = 'theme-btn';
    btn.type = 'button';
    btn.style.cssText =
      'width:30px;height:30px;border-radius:50%;padding:0;margin:0;' +
      'display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;' +
      'cursor:pointer;line-height:1;font-family:inherit;font-size:0;' +
      'border:1px solid rgba(255,255,255,0.16);background:rgba(255,255,255,0.06);' +
      'color:rgba(255,255,255,0.85);opacity:0.85;' +
      'transition:transform var(--t-motion,.15s),opacity var(--t-motion,.15s),background var(--t-motion,.15s);';
    btn.onmouseenter = function () { btn.style.transform = 'scale(1.08)'; btn.style.opacity = '1'; };
    btn.onmouseleave = function () { btn.style.transform = ''; btn.style.opacity = '0.85'; };
    btn.onclick = function (e) {
      e.stopPropagation();
      var next = getCookie() === 'light' ? 'dark' : 'light';
      setCookie(next);
      applyTheme(next);
      window.dispatchEvent(new CustomEvent('themechange', { detail: next }));
    };

    var mounted = mountToggle(btn);
    if (!mounted) {
      btn.style.position = 'fixed';
      btn.style.right = '20px';
      btn.style.top = '20px';
      btn.style.zIndex = '999999';
      document.body.appendChild(btn);
      // The shared topbar may be injected after this script runs; re-mount when it shows up.
      var retry = function () { if (mountToggle(btn)) { obs.disconnect(); } };
      var obs = null;
      if (window.MutationObserver) {
        obs = new MutationObserver(retry);
        obs.observe(document.documentElement, { childList: true, subtree: true });
      }
      document.addEventListener('DOMContentLoaded', retry);
      window.addEventListener('load', retry);
    }
    syncToggleBtn();
  }

  function mountToggle(btn) {
    var topbar = document.getElementById('site-topbar') || document.getElementById('app-topbar');
    if (!topbar) return false;
    btn.style.position = '';
    btn.style.right = '';
    btn.style.top = '';
    btn.style.zIndex = '';
    if (btn.parentNode !== topbar) topbar.appendChild(btn);
    return true;
  }

  function injectThemeToggle() {
    if (document.body) { buildToggle(); }
    else { document.addEventListener('DOMContentLoaded', buildToggle); }
  }
  injectThemeToggle();

  function addWatermark() {
    if (location.pathname.endsWith('/encrypt.html')) return;
    if (location.pathname.startsWith('/encrypt')) return;
    // rjuhsd.school is a clean school-branded hub — no mitch watermark or Discord button there.
    if (location.hostname === 'rjuhsd.school' || location.hostname.endsWith('.rjuhsd.school')) return;
    if (location.pathname.startsWith('/rjuhsd')) return;
    if (!document.getElementById('mitch-watermark')) {
      var wm = document.createElement('img');
      wm.id = 'mitch-watermark';
      wm.src = '/favicon.ico';
      wm.style.cssText = 'position:fixed;right:15px;bottom:15px;width:32px;height:32px;opacity:0.7;pointer-events:none;z-index:999998;';
      document.body.appendChild(wm);
    }

    if (document.getElementById('discord-server-btn')) return;
    var isHome = window.location.pathname === '/' || window.location.pathname.endsWith('/index.html');

    if (isHome) {
      var discordBtn = document.createElement('button');
      discordBtn.id = 'discord-server-btn';
      discordBtn.type = 'button';
      discordBtn.title = 'Discord server';
      discordBtn.textContent = 'Discord';
      discordBtn.style.cssText =
        'position:fixed;right:55px;bottom:15px;z-index:999999;' +
        'height:32px;border-radius:8px;border:1px solid rgba(88,101,242,0.45);' +
        'background:rgba(88,101,242,0.92)!important;color:#fff!important;font-size:11px;' +
        'font-weight:900;letter-spacing:.02em;padding:0 10px!important;cursor:pointer;' +
        'box-shadow:0 8px 24px rgba(0,0,0,0.35);' +
        'display:block;';

      var discordPanel = document.createElement('div');
      discordPanel.id = 'discord-server-panel';
      discordPanel.style.cssText =
        'display:none;position:fixed;right:15px;bottom:56px;z-index:999999;' +
        'width:min(280px,calc(100vw - 30px));background:rgba(10,10,14,0.96);' +
        'border:1px solid rgba(88,101,242,0.35);border-radius:10px;padding:12px;' +
        'box-shadow:0 18px 50px rgba(0,0,0,0.55);color:var(--t-fg);' +
        'font-family:system-ui,-apple-system,sans-serif;font-size:13px;line-height:1.45;' +
        '';
      discordPanel.innerHTML =
        '<div style="font-size:12px;font-weight:900;text-transform:uppercase;letter-spacing:.08em;color:#cfd4ff;margin-bottom:6px;">Discord Server</div>' +
        '<div style="color:var(--t-fg2);margin-bottom:10px;">Join here through a different device if you are using your chromebook.</div>' +
        '<a href="https://discord.gg/nrBCnK7KM5" target="_blank" rel="noopener noreferrer" style="display:block;text-align:center;text-decoration:none;background:rgba(88,101,242,0.22);border:1px solid rgba(88,101,242,0.45);border-radius:8px;padding:8px 10px;color:#fff;font-weight:900;">https://discord.gg/nrBCnK7KM5</a>';

      discordBtn.onclick = function(e) {
        e.stopPropagation();
        discordPanel.style.display = discordPanel.style.display === 'none' ? 'block' : 'none';
      };
      discordPanel.onclick = function(e) { e.stopPropagation(); };
      document.addEventListener('click', function() { discordPanel.style.display = 'none'; });

      document.body.appendChild(discordBtn);
      document.body.appendChild(discordPanel);
    } else {
      var discordLink = document.createElement('a');
      discordLink.id = 'discord-server-btn';
      discordLink.href = 'https://discord.gg/nrBCnK7KM5';
      discordLink.target = '_blank';
      discordLink.rel = 'noopener noreferrer';
      discordLink.textContent = 'Discord';
      discordLink.style.cssText = 'position:fixed;right:55px;bottom:18px;z-index:999999;font-size:10px;font-weight:800;color:#fff;text-decoration:none;opacity:0.7;transition:opacity 0.2s;';
      discordLink.onmouseenter = function() { this.style.opacity = '1'; };
      discordLink.onmouseleave = function() { this.style.opacity = '0.7'; };
      document.body.appendChild(discordLink);
    }
  }
  if (document.body) { addWatermark(); }
  else { document.addEventListener('DOMContentLoaded', addWatermark); }

  window.__theme = {
    apply: function (name) { applyTheme(normalize(name)); },
    get: getCookie,
    themes: T,
    setBg: function(url) { setBgImgCookie(url); applyBgImg(url); },
    applyMaterial: applyMaterialMode,
    adapt: function () { applyAdaptiveTheme(); },
    canUseGlass: canUseGlass
  };

  // Pointer-follow tilt on liquid-glass pages
  (function ensureLiquidGlassJs() {
    if (document.getElementById('liquid-glass-js')) return;
    var s = document.createElement('script');
    s.id = 'liquid-glass-js';
    s.src = '/liquid-glass.js';
    s.defer = true;
    (document.head || document.documentElement).appendChild(s);
  })();

  // ── Visual Effects ──────────────────────────────────────────────────────────
  function applyVFX() {
    var vfx = {};
    try { vfx = JSON.parse(localStorage.getItem('_prefVFX') || '{}') || {}; } catch (_) {}
    var existing = document.getElementById('mitch-vfx-canvas');
    if (existing) existing.remove();

    var any = vfx.snow || vfx.stars || vfx.rain || vfx.particles;
    if (!any) return;

    var canvas = document.createElement('canvas');
    canvas.id = 'mitch-vfx-canvas';
    canvas.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:-1;opacity:0.6;';
    document.body.appendChild(canvas);

    var ctx = canvas.getContext('2d');
    var w, h;
    function resize() {
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = canvas.width = Math.floor(window.innerWidth * dpr);
      h = canvas.height = Math.floor(window.innerHeight * dpr);
      canvas.style.width = window.innerWidth + 'px';
      canvas.style.height = window.innerHeight + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      w = window.innerWidth;
      h = window.innerHeight;
    }
    window.addEventListener('resize', resize);
    resize();

    var items = [];
    if (vfx.snow) {
      for (var i=0; i<100; i++) items.push({ type:'snow', x:Math.random()*w, y:Math.random()*h, r:Math.random()*3+1, v:Math.random()*1+0.5 });
    }
    if (vfx.stars) {
      for (var i=0; i<150; i++) items.push({ type:'star', x:Math.random()*w, y:Math.random()*h, r:Math.random()*1.5, o:Math.random(), ov:Math.random()*0.02 });
    }
    if (vfx.rain) {
      for (var i=0; i<80; i++) items.push({ type:'rain', x:Math.random()*w, y:Math.random()*h, l:Math.random()*20+10, v:Math.random()*10+10 });
    }
    if (vfx.particles) {
      for (var i=0; i<50; i++) items.push({ type:'part', x:Math.random()*w, y:Math.random()*h, r:Math.random()*4+2, vx:(Math.random()-0.5)*0.5, vy:(Math.random()-0.5)*0.5 });
    }

    var cachedAccent = '#7c3aed';
    function updateCachedAccent() {
      cachedAccent = getComputedStyle(document.documentElement).getPropertyValue('--t-ac').trim() || '#7c3aed';
    }
    updateCachedAccent();
    window.addEventListener('themecustomize', updateCachedAccent);

    function animate() {
      if (!document.getElementById('mitch-vfx-canvas')) return;
      ctx.clearRect(0, 0, w, h);

      // 1. Batch Snow
      var hasSnow = items.some(function(p) { return p.type === 'snow'; });
      if (hasSnow) {
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        items.forEach(function(p) {
          if (p.type === 'snow') {
            ctx.moveTo(p.x + p.r, p.y);
            ctx.arc(p.x, p.y, p.r, 0, Math.PI*2);
            p.y += p.v; p.x += Math.sin(p.y/30)*0.5;
            if (p.y > h) p.y = -10; if (p.x > w) p.x = 0; if (p.x < 0) p.x = w;
          }
        });
        ctx.fill();
      }

      // 2. Stars (using fast fillRect instead of arc)
      items.forEach(function(p) {
        if (p.type === 'star') {
          ctx.fillStyle = 'rgba(255,255,255,' + p.o + ')';
          ctx.fillRect(p.x - p.r, p.y - p.r, p.r * 2, p.r * 2);
          p.o += p.ov; if (p.o > 1 || p.o < 0) p.ov *= -1;
        }
      });

      // 3. Batch Rain
      var hasRain = items.some(function(p) { return p.type === 'rain'; });
      if (hasRain) {
        ctx.strokeStyle = 'rgba(255,255,255,0.3)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        items.forEach(function(p) {
          if (p.type === 'rain') {
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p.x + p.v/4, p.y + p.l);
            p.y += p.v; p.x += p.v/4;
            if (p.y > h) { p.y = -20; p.x = Math.random()*w; }
          }
        });
        ctx.stroke();
      }

      // 4. Batch Particles
      var hasPart = items.some(function(p) { return p.type === 'part'; });
      if (hasPart) {
        ctx.fillStyle = cachedAccent;
        ctx.globalAlpha = 0.2;
        ctx.beginPath();
        items.forEach(function(p) {
          if (p.type === 'part') {
            ctx.moveTo(p.x + p.r, p.y);
            ctx.arc(p.x, p.y, p.r, 0, Math.PI*2);
            p.x += p.vx; p.y += p.vy;
            if (p.x < 0 || p.x > w) p.vx *= -1;
            if (p.y < 0 || p.y > h) p.vy *= -1;
          }
        });
        ctx.fill();
        ctx.globalAlpha = 1.0;
      }

      requestAnimationFrame(animate);
    }
    animate();
  }

  function applyCustomCSS() {
    var display = JSON.parse(localStorage.getItem('_prefDisplay') || '{}');
    var existing = document.getElementById('mitch-custom-css');
    if (existing) existing.remove();
    if (display.customCSS) {
      var style = document.createElement('style');
      style.id = 'mitch-custom-css';
      style.textContent = display.customCSS;
      document.head.appendChild(style);
    }
  }

  function applyQuickAccess() {
    var tc = JSON.parse(localStorage.getItem('_prefTools') || '{}');
    var existing = document.getElementById('mitch-quick-access');
    if (existing) existing.remove();
    if (!tc.quickAccess) return;

    var bar = document.createElement('div');
    bar.id = 'mitch-quick-access';
    bar.style.cssText = 'position:fixed;right:10px;top:50%;transform:translateY(-50%);z-index:10000;display:flex;flex-direction:column;gap:8px;padding:8px;background:rgba(10,10,10,0.4);border:1px solid rgba(255,255,255,0.1);border-radius:12px;box-shadow:0 8px 32px rgba(0,0,0,0.5);transition:opacity 0.2s;';

    var links = [
      { h:'/', i:'🏠', t:'Home' },
      { h:'/games/', i:'🎮', t:'Games' },
      { h:'/preferences/#account', i:'👤', t:'Account' },
      { h:'/encrypt.html', i:'💬', t:'Chat' },
      { h:'/canvas/', i:'🎨', t:'Canvas' },
      { h:'/shop/', i:'🛒', t:'Market' },
      { h:'/inventory/', i:'🎒', t:'Inventory' },
      { h:'/preferences/', i:'⚙️', t:'Settings' }
    ];

    links.forEach(function(l) {
      var a = document.createElement('a');
      a.href = l.h; a.title = l.t;
      a.style.cssText = 'width:34px;height:34px;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,0.05);border-radius:8px;text-decoration:none;font-size:18px;transition:all 0.2s;';
      a.innerHTML = l.i;
      a.onmouseover = function() { this.style.background = 'rgba(255,255,255,0.1)'; this.style.transform = 'scale(1.1)'; };
      a.onmouseout = function() { this.style.background = 'rgba(255,255,255,0.05)'; this.style.transform = 'scale(1)'; };
      bar.appendChild(a);
    });

    document.body.appendChild(bar);
  }

  if (document.body) { applyVFX(); applyCustomCSS(); applyQuickAccess(); }
  else { document.addEventListener('DOMContentLoaded', function(){ applyVFX(); applyCustomCSS(); applyQuickAccess(); }); }
  window.addEventListener('themecustomize', function() { applyAdaptiveTheme(); applyVFX(); applyCustomCSS(); applyQuickAccess(); });
})();
