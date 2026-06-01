(function () {
  var T = {
    void: {
      name: 'Void',
      bg: '#07070f', bg2: 'rgba(255,255,255,0.04)', bg3: 'rgba(255,255,255,0.025)',
      fg: '#e0e0f0', fg2: 'rgba(200,200,220,0.65)',
      ac: '#7c3aed', ac2: '#3b82f6', ac3: '#f472b6',
      bd: 'rgba(255,255,255,0.08)', bda: 'rgba(124,58,237,0.45)',
      gl: 'rgba(124,58,237,0.5)', gls: 'rgba(124,58,237,0.15)',
      gr: 'linear-gradient(135deg,#c084fc,#60a5fa,#f472b6)',
      bgr: 'radial-gradient(ellipse at 20% 20%,rgba(120,40,200,.15) 0%,transparent 60%),radial-gradient(ellipse at 80% 80%,rgba(0,180,255,.12) 0%,transparent 60%),radial-gradient(ellipse at 60% 10%,rgba(255,0,180,.08) 0%,transparent 50%)',
      bgImg: 'https://i.pinimg.com/originals/51/a3/73/51a373c8546364bf1aaaaa65d369e328.gif',
      sw: '#7c3aed',
    },
    cyber: {
      name: 'Cyber',
      bg: '#050008', bg2: 'rgba(255,0,255,0.05)', bg3: 'rgba(255,0,255,0.03)',
      fg: '#f0e0ff', fg2: 'rgba(220,180,255,0.65)',
      ac: '#ff0090', ac2: '#00f5ff', ac3: '#ff6600',
      bd: 'rgba(255,0,255,0.12)', bda: 'rgba(255,0,144,0.5)',
      gl: 'rgba(255,0,144,0.5)', gls: 'rgba(255,0,144,0.15)',
      gr: 'linear-gradient(135deg,#ff0090,#00f5ff)',
      bgr: 'radial-gradient(ellipse at 30% 30%,rgba(255,0,144,.12) 0%,transparent 60%),radial-gradient(ellipse at 70% 70%,rgba(0,245,255,.1) 0%,transparent 60%)',
      sw: '#ff0090',
    },
    matrix: {
      name: 'Matrix',
      bg: '#000300', bg2: 'rgba(0,255,65,0.05)', bg3: 'rgba(0,255,65,0.03)',
      fg: '#b3ffb3', fg2: 'rgba(100,200,100,0.75)',
      ac: '#00ff41', ac2: '#00cc33', ac3: '#66ff66',
      bd: 'rgba(0,255,65,0.15)', bda: 'rgba(0,255,65,0.5)',
      gl: 'rgba(0,255,65,0.5)', gls: 'rgba(0,255,65,0.12)',
      gr: 'linear-gradient(135deg,#00ff41,#00cc33)',
      bgr: 'radial-gradient(ellipse at 50% 30%,rgba(0,255,65,.08) 0%,transparent 70%)',
      bgImg: 'https://i.pinimg.com/originals/c5/9a/d2/c59ad2bd4ad2fbacd04017debc679ddb.gif',
      sw: '#00ff41',
    },
    synthwave: {
      name: 'Synthwave',
      bg: '#0d0021', bg2: 'rgba(255,60,255,0.06)', bg3: 'rgba(255,60,255,0.03)',
      fg: '#ffe0ff', fg2: 'rgba(220,160,255,0.75)',
      ac: '#ff2d78', ac2: '#f5a623', ac3: '#bf5fff',
      bd: 'rgba(255,60,200,0.15)', bda: 'rgba(255,45,120,0.5)',
      gl: 'rgba(255,45,120,0.5)', gls: 'rgba(255,45,120,0.15)',
      gr: 'linear-gradient(135deg,#ff2d78,#f5a623,#bf5fff)',
      bgr: 'radial-gradient(ellipse at 20% 80%,rgba(255,45,120,.15) 0%,transparent 60%),radial-gradient(ellipse at 80% 20%,rgba(245,166,35,.1) 0%,transparent 60%),radial-gradient(ellipse at 50% 50%,rgba(191,95,255,.08) 0%,transparent 70%)',
      sw: '#ff2d78',
    },
    abyss: {
      name: 'Abyss',
      bg: '#020c1b', bg2: 'rgba(0,200,220,0.05)', bg3: 'rgba(0,200,220,0.03)',
      fg: '#cee0f2', fg2: 'rgba(150,200,230,0.7)',
      ac: '#00b4d8', ac2: '#0077b6', ac3: '#48cae4',
      bd: 'rgba(0,200,220,0.12)', bda: 'rgba(0,180,216,0.45)',
      gl: 'rgba(0,180,216,0.45)', gls: 'rgba(0,180,216,0.12)',
      gr: 'linear-gradient(135deg,#48cae4,#0077b6)',
      bgr: 'radial-gradient(ellipse at 50% 50%,rgba(0,119,182,.18) 0%,transparent 70%)',
      bgImg: 'https://i.pinimg.com/736x/f1/43/81/f1438168fb34a2a62eacf985ba49c742.jpg',
      sw: '#00b4d8',
    },
    sakura: {
      name: 'Sakura',
      bg: '#100a10', bg2: 'rgba(255,130,180,0.06)', bg3: 'rgba(255,130,180,0.03)',
      fg: '#ffe0ec', fg2: 'rgba(255,180,210,0.7)',
      ac: '#ff6eb0', ac2: '#e91e8c', ac3: '#ffb3d1',
      bd: 'rgba(255,130,180,0.15)', bda: 'rgba(255,110,176,0.5)',
      gl: 'rgba(255,110,176,0.5)', gls: 'rgba(255,110,176,0.15)',
      gr: 'linear-gradient(135deg,#ffb3d1,#ff6eb0,#e91e8c)',
      bgr: 'radial-gradient(ellipse at 30% 50%,rgba(255,110,176,.1) 0%,transparent 70%)',
      bgImg: 'https://i.pinimg.com/originals/77/30/f1/7730f1dc01b225319269cbc655cc1998.gif',
      sw: '#ff6eb0',
    },
    'senpai-cafe': {
      name: 'Senpai Cafe',
      bg: '#120d08', bg2: 'rgba(255,180,100,0.06)', bg3: 'rgba(255,180,100,0.03)',
      fg: '#ffecd5', fg2: 'rgba(255,210,160,0.7)',
      ac: '#ff9a5c', ac2: '#e06c75', ac3: '#ffd3a0',
      bd: 'rgba(255,180,100,0.15)', bda: 'rgba(255,154,92,0.45)',
      gl: 'rgba(255,154,92,0.5)', gls: 'rgba(255,154,92,0.15)',
      gr: 'linear-gradient(135deg,#ffd3a0,#ff9a5c,#e06c75)',
      bgr: 'radial-gradient(ellipse at 50% 50%,rgba(255,100,50,.1) 0%,transparent 70%)',
      bgImg: '/senpai-cafe.webp',
      sw: '#ff9a5c',
    },
    youtube: {
      name: 'YouTube Dark',
      bg: '#0f0f0f', bg2: 'rgba(255,255,255,0.06)', bg3: 'rgba(255,255,255,0.04)',
      fg: '#f5f5f5', fg2: 'rgba(245,245,245,0.68)',
      ac: '#ff0033', ac2: '#ffffff', ac3: '#ff6b6b',
      bd: 'rgba(255,255,255,0.12)', bda: 'rgba(255,0,51,0.55)',
      gl: 'rgba(255,0,51,0.45)', gls: 'rgba(255,0,51,0.14)',
      gr: 'linear-gradient(135deg,#ff0033,#ff7a7a)',
      bgr: 'radial-gradient(circle at 15% 20%,rgba(255,0,51,.22),transparent 34%),linear-gradient(135deg,#0b0b0b,#181818 55%,#080808)',
      sw: '#ff0033',
    },
    discord: {
      name: 'Discord',
      bg: '#11131f', bg2: 'rgba(88,101,242,0.10)', bg3: 'rgba(88,101,242,0.06)',
      fg: '#f4f5ff', fg2: 'rgba(224,226,255,0.72)',
      ac: '#5865f2', ac2: '#9aa3ff', ac3: '#23a559',
      bd: 'rgba(154,163,255,0.16)', bda: 'rgba(88,101,242,0.58)',
      gl: 'rgba(88,101,242,0.52)', gls: 'rgba(88,101,242,0.16)',
      gr: 'linear-gradient(135deg,#5865f2,#23a559)',
      bgr: 'radial-gradient(circle at 80% 15%,rgba(88,101,242,.28),transparent 36%),radial-gradient(circle at 18% 85%,rgba(35,165,89,.16),transparent 34%),linear-gradient(135deg,#0e101a,#1d223b)',
      sw: '#5865f2',
    },
    spotify: {
      name: 'Spotify',
      bg: '#06160c', bg2: 'rgba(30,215,96,0.08)', bg3: 'rgba(30,215,96,0.045)',
      fg: '#effff4', fg2: 'rgba(205,245,218,0.72)',
      ac: '#1ed760', ac2: '#1db954', ac3: '#baffd0',
      bd: 'rgba(30,215,96,0.16)', bda: 'rgba(30,215,96,0.55)',
      gl: 'rgba(30,215,96,0.48)', gls: 'rgba(30,215,96,0.14)',
      gr: 'linear-gradient(135deg,#1ed760,#baffd0)',
      bgr: 'radial-gradient(circle at 18% 30%,rgba(30,215,96,.22),transparent 38%),linear-gradient(140deg,#06160c,#102a18 50%,#050805)',
      sw: '#1ed760',
    },
    netflix: {
      name: 'Netflix',
      bg: '#090405', bg2: 'rgba(229,9,20,0.08)', bg3: 'rgba(229,9,20,0.04)',
      fg: '#fff4f4', fg2: 'rgba(255,210,210,0.7)',
      ac: '#e50914', ac2: '#ff5f67', ac3: '#ffffff',
      bd: 'rgba(229,9,20,0.18)', bda: 'rgba(229,9,20,0.55)',
      gl: 'rgba(229,9,20,0.5)', gls: 'rgba(229,9,20,0.14)',
      gr: 'linear-gradient(135deg,#e50914,#2b0306)',
      bgr: 'radial-gradient(circle at 50% 0%,rgba(229,9,20,.25),transparent 38%),linear-gradient(160deg,#030303,#160305 65%,#080808)',
      sw: '#e50914',
    },
    twitch: {
      name: 'Twitch',
      bg: '#10071e', bg2: 'rgba(145,70,255,0.09)', bg3: 'rgba(145,70,255,0.05)',
      fg: '#f8f2ff', fg2: 'rgba(232,210,255,0.72)',
      ac: '#9146ff', ac2: '#bf94ff', ac3: '#00f0ff',
      bd: 'rgba(145,70,255,0.18)', bda: 'rgba(145,70,255,0.58)',
      gl: 'rgba(145,70,255,0.52)', gls: 'rgba(145,70,255,0.16)',
      gr: 'linear-gradient(135deg,#9146ff,#00f0ff)',
      bgr: 'radial-gradient(circle at 75% 22%,rgba(145,70,255,.26),transparent 38%),linear-gradient(135deg,#0b0316,#211039)',
      sw: '#9146ff',
    },
    roblox: {
      name: 'Roblox',
      bg: '#101114', bg2: 'rgba(255,255,255,0.07)', bg3: 'rgba(255,255,255,0.04)',
      fg: '#f7f7f8', fg2: 'rgba(218,220,225,0.72)',
      ac: '#d7d9df', ac2: '#ff4757', ac3: '#5dade2',
      bd: 'rgba(255,255,255,0.14)', bda: 'rgba(215,217,223,0.45)',
      gl: 'rgba(215,217,223,0.35)', gls: 'rgba(215,217,223,0.12)',
      gr: 'linear-gradient(135deg,#f7f7f8,#6b7280,#ff4757)',
      bgr: 'linear-gradient(45deg,rgba(255,255,255,.05) 25%,transparent 25%,transparent 50%,rgba(255,255,255,.05) 50%,rgba(255,255,255,.05) 75%,transparent 75%),linear-gradient(135deg,#0b0c0f,#1b1d24)',
      sw: '#d7d9df',
    },
    minecraft: {
      name: 'Minecraft',
      bg: '#071109', bg2: 'rgba(80,180,80,0.08)', bg3: 'rgba(130,92,52,0.06)',
      fg: '#ecffe9', fg2: 'rgba(205,235,200,0.72)',
      ac: '#55c65a', ac2: '#8b5a2b', ac3: '#7dd3fc',
      bd: 'rgba(85,198,90,0.16)', bda: 'rgba(85,198,90,0.55)',
      gl: 'rgba(85,198,90,0.42)', gls: 'rgba(85,198,90,0.14)',
      gr: 'linear-gradient(135deg,#55c65a,#8b5a2b,#7dd3fc)',
      bgr: 'linear-gradient(90deg,rgba(85,198,90,.11) 12px,transparent 12px),linear-gradient(0deg,rgba(139,90,43,.10) 12px,transparent 12px),linear-gradient(135deg,#071109,#132817)',
      sw: '#55c65a',
    },
    github: {
      name: 'GitHub',
      bg: '#0d1117', bg2: 'rgba(56,139,253,0.08)', bg3: 'rgba(48,54,61,0.7)',
      fg: '#f0f6fc', fg2: 'rgba(201,209,217,0.75)',
      ac: '#58a6ff', ac2: '#3fb950', ac3: '#bc8cff',
      bd: 'rgba(139,148,158,0.22)', bda: 'rgba(88,166,255,0.48)',
      gl: 'rgba(88,166,255,0.4)', gls: 'rgba(88,166,255,0.13)',
      gr: 'linear-gradient(135deg,#58a6ff,#3fb950,#bc8cff)',
      bgr: 'radial-gradient(circle at 70% 20%,rgba(88,166,255,.18),transparent 34%),linear-gradient(135deg,#0d1117,#161b22)',
      sw: '#58a6ff',
    },
    google: {
      name: 'Google',
      bg: '#0b1020', bg2: 'rgba(255,255,255,0.07)', bg3: 'rgba(255,255,255,0.04)',
      fg: '#f8fbff', fg2: 'rgba(220,230,245,0.74)',
      ac: '#4285f4', ac2: '#34a853', ac3: '#fbbc05',
      bd: 'rgba(255,255,255,0.13)', bda: 'rgba(66,133,244,0.55)',
      gl: 'rgba(66,133,244,0.42)', gls: 'rgba(66,133,244,0.14)',
      gr: 'linear-gradient(135deg,#4285f4,#34a853,#fbbc05,#ea4335)',
      bgr: 'radial-gradient(circle at 18% 25%,rgba(66,133,244,.23),transparent 35%),radial-gradient(circle at 84% 28%,rgba(234,67,53,.19),transparent 32%),radial-gradient(circle at 58% 88%,rgba(52,168,83,.18),transparent 34%),linear-gradient(135deg,#071022,#111827)',
      sw: '#4285f4',
    },
    classroom: {
      name: 'Classroom',
      bg: '#061311', bg2: 'rgba(30,142,62,0.08)', bg3: 'rgba(30,142,62,0.04)',
      fg: '#edfff6', fg2: 'rgba(200,235,218,0.72)',
      ac: '#1e8e3e', ac2: '#fbbc04', ac3: '#4285f4',
      bd: 'rgba(30,142,62,0.16)', bda: 'rgba(30,142,62,0.52)',
      gl: 'rgba(30,142,62,0.42)', gls: 'rgba(30,142,62,0.14)',
      gr: 'linear-gradient(135deg,#1e8e3e,#fbbc04,#4285f4)',
      bgr: 'linear-gradient(135deg,#061311,#10231b),radial-gradient(circle at 75% 20%,rgba(251,188,4,.18),transparent 34%)',
      sw: '#1e8e3e',
    },
    ocean: {
      name: 'Ocean',
      bg: '#061726', bg2: 'rgba(20,184,166,0.08)', bg3: 'rgba(14,165,233,0.05)',
      fg: '#e8fbff', fg2: 'rgba(190,230,240,0.72)',
      ac: '#14b8a6', ac2: '#0ea5e9', ac3: '#a7f3d0',
      bd: 'rgba(20,184,166,0.16)', bda: 'rgba(20,184,166,0.52)',
      gl: 'rgba(20,184,166,0.42)', gls: 'rgba(20,184,166,0.14)',
      gr: 'linear-gradient(135deg,#14b8a6,#0ea5e9,#a7f3d0)',
      bgr: 'radial-gradient(circle at 50% 0%,rgba(14,165,233,.22),transparent 38%),linear-gradient(160deg,#061726,#083344 60%,#031019)',
      sw: '#14b8a6',
    },
    sunset: {
      name: 'Sunset',
      bg: '#160911', bg2: 'rgba(251,113,133,0.08)', bg3: 'rgba(251,146,60,0.05)',
      fg: '#fff3ed', fg2: 'rgba(255,220,200,0.72)',
      ac: '#fb7185', ac2: '#fb923c', ac3: '#fde68a',
      bd: 'rgba(251,113,133,0.16)', bda: 'rgba(251,113,133,0.52)',
      gl: 'rgba(251,113,133,0.42)', gls: 'rgba(251,113,133,0.14)',
      gr: 'linear-gradient(135deg,#fb7185,#fb923c,#fde68a)',
      bgr: 'radial-gradient(circle at 50% 15%,rgba(251,146,60,.27),transparent 36%),linear-gradient(160deg,#160911,#35131e 62%,#1e0b13)',
      sw: '#fb7185',
    },
    'adrian-lopez': {
      name: 'Adrian Lopez',
      bg: '#0d0805',
      bg2: 'rgba(255,255,255,0.11)', bg3: 'rgba(255,255,255,0.06)',
      fg: '#ffffff', fg2: 'rgba(255,255,255,0.72)',
      ac: '#ff7b35', ac2: '#ffd166', ac3: '#ff9aa2',
      bd: 'rgba(255,255,255,0.14)', bda: 'rgba(255,123,53,0.55)',
      gl: 'rgba(255,123,53,0.55)', gls: 'rgba(255,123,53,0.2)',
      gr: 'linear-gradient(135deg,#ff9aa2,#ff7b35,#ffd166)',
      bgr: 'radial-gradient(ellipse at 50% 50%,rgba(255,100,30,.06) 0%,transparent 70%)',
      bgImg: '/adrian-lopez.webp',
      sw: '#ff7b35',
    },
    /* ── Light Themes ── */
    daylight: {
      name: '☀ Daylight',
      light: true,
      bg: '#f0f2f8', bg2: 'rgba(255,255,255,0.72)', bg3: 'rgba(255,255,255,0.55)',
      fg: '#0f1123', fg2: 'rgba(15,17,35,0.62)',
      ac: '#4f46e5', ac2: '#0891b2', ac3: '#db2777',
      bd: 'rgba(0,0,0,0.09)', bda: 'rgba(79,70,229,0.4)',
      gl: 'rgba(79,70,229,0.35)', gls: 'rgba(79,70,229,0.1)',
      gr: 'linear-gradient(135deg,#4f46e5,#0891b2,#db2777)',
      bgr: 'radial-gradient(ellipse at 20% 10%,rgba(79,70,229,0.12) 0%,transparent 55%),radial-gradient(ellipse at 85% 85%,rgba(8,145,178,0.08) 0%,transparent 55%),linear-gradient(160deg,#eef0f8,#f4f6fc)',
      sw: '#4f46e5',
    },
    paper: {
      name: '📄 Paper',
      light: true,
      bg: '#faf8f4', bg2: 'rgba(255,255,255,0.68)', bg3: 'rgba(255,255,255,0.52)',
      fg: '#1a1612', fg2: 'rgba(26,22,18,0.58)',
      ac: '#b45309', ac2: '#92400e', ac3: '#065f46',
      bd: 'rgba(0,0,0,0.08)', bda: 'rgba(180,83,9,0.38)',
      gl: 'rgba(180,83,9,0.32)', gls: 'rgba(180,83,9,0.1)',
      gr: 'linear-gradient(135deg,#b45309,#92400e,#065f46)',
      bgr: 'radial-gradient(ellipse at 70% 20%,rgba(180,83,9,0.08) 0%,transparent 55%),linear-gradient(160deg,#fdf9f3,#faf6ee)',
      sw: '#b45309',
    },
    arctic: {
      name: '❄ Arctic',
      light: true,
      bg: '#eff6ff', bg2: 'rgba(255,255,255,0.7)', bg3: 'rgba(255,255,255,0.55)',
      fg: '#0c1a2e', fg2: 'rgba(12,26,46,0.6)',
      ac: '#0ea5e9', ac2: '#0369a1', ac3: '#06b6d4',
      bd: 'rgba(0,0,0,0.08)', bda: 'rgba(14,165,233,0.4)',
      gl: 'rgba(14,165,233,0.3)', gls: 'rgba(14,165,233,0.1)',
      gr: 'linear-gradient(135deg,#0ea5e9,#0369a1,#06b6d4)',
      bgr: 'radial-gradient(ellipse at 30% 0%,rgba(14,165,233,0.14) 0%,transparent 55%),radial-gradient(ellipse at 80% 90%,rgba(6,182,212,0.08) 0%,transparent 50%),linear-gradient(160deg,#ecf5ff,#f0f8ff)',
      sw: '#0ea5e9',
    },
    blossom: {
      name: '🌸 Blossom',
      light: true,
      bg: '#fdf4f8', bg2: 'rgba(255,255,255,0.7)', bg3: 'rgba(255,255,255,0.55)',
      fg: '#2d0a1a', fg2: 'rgba(45,10,26,0.58)',
      ac: '#db2777', ac2: '#be185d', ac3: '#9333ea',
      bd: 'rgba(0,0,0,0.08)', bda: 'rgba(219,39,119,0.38)',
      gl: 'rgba(219,39,119,0.3)', gls: 'rgba(219,39,119,0.1)',
      gr: 'linear-gradient(135deg,#db2777,#9333ea)',
      bgr: 'radial-gradient(ellipse at 25% 15%,rgba(219,39,119,0.1) 0%,transparent 55%),radial-gradient(ellipse at 75% 80%,rgba(147,51,234,0.07) 0%,transparent 50%),linear-gradient(160deg,#fef0f5,#fdf4f8)',
      sw: '#db2777',
    },
  };

  function getCookie() {
    var m = document.cookie.match(/(?:^|; )theme=([^;]+)/);
    return m ? decodeURIComponent(m[1]) : 'void';
  }
  function setCookie(name) {
    document.cookie = 'theme=' + encodeURIComponent(name) + ';path=/;max-age=31536000';
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
    var densityMap = { compact: '.75', normal: '.85', comfy: '.95', huge: '1.10' };
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
  }

  function getEffectiveBgImg(themeName) {
    var custom = getBgImgCookie();
    if (custom) return custom;
    var t = T[themeName !== undefined ? themeName : getCookie()];
    return (t && t.bgImg) ? t.bgImg : '';
  }

  function applyBgImg(url) {
    var r = document.documentElement.style;
    if (url) {
      r.setProperty('--t-bg-img-layer',
        'linear-gradient(rgba(0,0,0,var(--t-bg-dim,0.5)),rgba(0,0,0,var(--t-bg-dim,0.5))),url(' + JSON.stringify(url) + ')');
    } else {
      r.setProperty('--t-bg-img-layer', 'var(--t-bgr, none)');
    }
    var inp = document.getElementById('theme-bg-input');
    if (inp) inp.value = getBgImgCookie();
  }

  function applyTheme(name) {
    var t = T[name] || T.void;
    var r = document.documentElement.style;
    // Toggle light class for glass page overrides
    document.documentElement.classList.toggle('theme-light', !!(t.light));
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
    applyCustomizationPrefs();
    applyBgImg(getEffectiveBgImg(name));
    var btn = document.getElementById('theme-btn');
    if (btn) {
      btn.style.background = t.sw;
      btn.style.boxShadow = '0 0 12px ' + t.sw + '99';
    }
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
    'button:not(#devtools-btn):not(#theme-btn):not(.tbg-btn){background:var(--t-bg2);color:var(--t-ac);' +
      'border:1px solid var(--t-bda);padding:7px 16px;border-radius:var(--t-radius,8px);cursor:pointer;' +
      'font-family:inherit;font-size:.88rem;font-weight:500;transition:all var(--t-motion,.15s)}' +
    'button:not(#devtools-btn):not(#theme-btn):not(.tbg-btn):hover{background:var(--t-bg3);box-shadow:0 0 8px var(--t-gls)}' +
    '.theme-no-motion *{animation-duration:0s!important;transition-duration:0s!important;scroll-behavior:auto!important}' +
    'hr{border:none;border-top:1px solid var(--t-bd)}' +
    'a{color:var(--t-ac)}a:hover{color:var(--t-ac2)}' +
    'label{color:var(--t-fg2)}';
    document.head.appendChild(baseStyle);

  var lightStyle = document.createElement('style');
  lightStyle.id = 'theme-light-overrides';
  lightStyle.textContent =
    '.theme-light .glass-card,.theme-light .card{background:rgba(255,255,255,0.55)!important;backdrop-filter:blur(28px) saturate(190%)!important;-webkit-backdrop-filter:blur(28px) saturate(190%)!important;border:1px solid rgba(0,0,0,0.09)!important;box-shadow:0 24px 64px rgba(0,0,0,0.07),inset 0 1px 0 rgba(255,255,255,0.85)!important;}' +
    '.theme-light #site-topbar #theme-btn{background:rgba(255,255,255,0.75)!important;border:1px solid rgba(0,0,0,0.14)!important;color:#1e1b4b!important;}' +
    '.theme-light #site-topbar #theme-clean-btn{background:rgba(255,255,255,0.7)!important;border:1px solid rgba(0,0,0,0.12)!important;color:#374151!important;}' +
    '.theme-light #site-topbar #_ab{background:rgba(255,255,255,0.75)!important;border:1px solid rgba(0,0,0,0.14)!important;color:#374151!important;}' +
    '.theme-light #sw-notif-btn{background:rgba(255,255,255,0.75)!important;border:1px solid rgba(0,0,0,0.14)!important;color:var(--t-ac)!important;}' +
    '.theme-light #sw-notif-panel{background:rgba(250,250,255,0.97)!important;border:1px solid rgba(0,0,0,0.1)!important;box-shadow:0 18px 60px rgba(0,0,0,0.12)!important;}' +
    '.theme-light .sw-notif-head{border-bottom:1px solid rgba(0,0,0,0.08)!important;}' +
    '.theme-light .sw-notif-head span,.theme-light .sw-notif-title{color:#0f1123!important;}' +
    '.theme-light .sw-notif-body,.theme-light .sw-notif-detail{color:rgba(15,17,35,0.65)!important;}' +
    '.theme-light .sw-notif-item{background:rgba(0,0,0,0.025)!important;border:1px solid rgba(0,0,0,0.07)!important;}' +
    '.theme-light .sw-notif-empty{color:rgba(15,17,35,0.45)!important;}' +
    '.theme-light .sw-notif-head button,.theme-light .sw-notif-actions button,.theme-light .sw-notif-open{background:rgba(0,0,0,0.04)!important;border:1px solid rgba(0,0,0,0.1)!important;color:var(--t-ac)!important;}' +
    '.theme-light #theme-panel{background:rgba(250,250,255,0.97)!important;border:1px solid rgba(0,0,0,0.1)!important;box-shadow:0 18px 60px rgba(0,0,0,0.12)!important;}' +
    '.theme-light #theme-panel [data-tk]{color:#0f1123!important;}' +
    '.theme-light #theme-panel .tbg-btn{background:rgba(0,0,0,0.05)!important;border:1px solid rgba(0,0,0,0.1)!important;color:#0f1123!important;}' +
    '.theme-light #theme-panel input[type=text],.theme-light #theme-panel select{background:rgba(0,0,0,0.04)!important;border:1px solid rgba(0,0,0,0.1)!important;color:#0f1123!important;}' +
    '.theme-light button:not(#devtools-btn):not(#theme-btn):not(.tbg-btn):not(#_ab):not(#theme-clean-btn):not(#sw-notif-btn){background:rgba(255,255,255,0.7)!important;border:1px solid rgba(0,0,0,0.12)!important;color:var(--t-ac)!important;}' +
    '.theme-light button:not(#devtools-btn):not(#theme-btn):not(.tbg-btn):not(#_ab):not(#theme-clean-btn):not(#sw-notif-btn):hover{background:rgba(255,255,255,0.9)!important;box-shadow:0 4px 16px rgba(0,0,0,0.08)!important;}' +
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
    '';
  document.head.appendChild(lightStyle);

  function activateCleanMode() {
    var ids = ['theme-btn', 'theme-panel', 'theme-clean-btn', 'devtools-btn', 'backbtn'];
    ids.forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.remove();
    });
    document.querySelectorAll('body > *').forEach(function (el) {
      var s = window.getComputedStyle(el);
      if ((s.position === 'fixed' || s.position === 'absolute') &&
          el.id !== 'mainpage' && el.id !== 'fullframe') {
        el.remove();
      }
    });
  }

  function buildPicker() {
    if (document.getElementById('theme-btn')) return;
    var cur = getCookie();
    var t = T[cur] || T.void;
    var bar = document.getElementById('site-topbar') || document.body;

    var btn = document.createElement('button');
    btn.id = 'theme-btn';
    btn.title = 'Theme';
    btn.innerHTML = '&#10022;';
    btn.style.cssText =
      'width:28px;height:28px;border-radius:50%;' +
      'border:1px solid rgba(255,255,255,0.1);' +
      'background:rgba(10,10,10,0.4);color:rgba(255,255,255,0.8);' +
      'font-size:11px;cursor:pointer;opacity:0.7;' +
      'transition:transform .15s,opacity .15s,background .15s;padding:0;' +
      'backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);' +
      'display:flex;align-items:center;justify-content:center;flex-shrink:0;' +
      'line-height:1;font-family:inherit;';
    btn.onmouseenter = function () { this.style.transform = 'scale(1.1)'; this.style.opacity = '1'; this.style.background = t.sw; };
    btn.onmouseleave = function () { this.style.transform = ''; this.style.opacity = '0.7'; this.style.background = 'rgba(10,10,10,0.4)'; };

    var panel = document.createElement('div');
    panel.id = 'theme-panel';
    panel.style.cssText =
      'display:none;position:fixed;right:12px;top:50px;z-index:999999;' +
      'background:rgba(6,4,14,0.95);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);' +
      'border:1px solid rgba(255,255,255,0.1);border-radius:14px;' +
      'padding:8px 6px 10px;min-width:248px;max-width:min(340px,calc(100vw - 24px));max-height:min(78vh,720px);overflow:auto;' +
      'box-shadow:0 8px 32px rgba(0,0,0,0.65);' +
      'font-family:"Segoe UI",system-ui,sans-serif;';

    Object.keys(T).forEach(function (key) {
      var theme = T[key];
      var item = document.createElement('div');
      item.setAttribute('data-tk', key);
      item.style.cssText =
        'display:flex;align-items:center;gap:9px;padding:7px 10px;' +
        'border-radius:8px;cursor:pointer;transition:background .12s;' +
        (key === cur ? 'background:rgba(255,255,255,0.09);' : '');

      var dot = document.createElement('span');
      dot.style.cssText =
        'width:13px;height:13px;border-radius:50%;flex-shrink:0;display:inline-block;' +
        'background:' + theme.sw + ';box-shadow:0 0 7px ' + theme.sw + ';';
      if (theme.bgImg) {
        dot.style.backgroundImage = 'url(' + JSON.stringify(theme.bgImg) + ')';
        dot.style.backgroundSize = 'cover';
        dot.style.backgroundPosition = 'center';
        dot.style.boxShadow = '0 0 7px ' + theme.sw + ',inset 0 0 0 1px rgba(255,255,255,0.2)';
      }

      var lbl = document.createElement('span');
      lbl.textContent = theme.name;
      lbl.style.cssText = 'font-size:0.82rem;color:#ddd;';

      item.appendChild(dot);
      item.appendChild(lbl);
      item.onmouseenter = function () { item.style.background = 'rgba(255,255,255,0.09)'; };
      item.onmouseleave = function () {
        item.style.background = item.getAttribute('data-tk') === getCookie() ? 'rgba(255,255,255,0.09)' : '';
      };
      item.onclick = function () {
        applyTheme(key);
        setCookie(key);
        panel.querySelectorAll('[data-tk]').forEach(function (el) {
          el.style.background = el.getAttribute('data-tk') === key ? 'rgba(255,255,255,0.09)' : '';
        });
        window.dispatchEvent(new CustomEvent('themechange', { detail: key }));
      };
      panel.appendChild(item);
    });

    var sep = document.createElement('div');
    sep.style.cssText = 'border-top:1px solid rgba(255,255,255,0.08);margin:8px 4px 8px;';
    panel.appendChild(sep);

    var bgLabel = document.createElement('div');
    bgLabel.style.cssText = 'font-size:0.72rem;color:rgba(200,200,220,0.5);padding:0 10px 5px;letter-spacing:.04em;';
    bgLabel.textContent = 'background image';
    panel.appendChild(bgLabel);

    var bgRow = document.createElement('div');
    bgRow.style.cssText = 'display:flex;align-items:center;gap:4px;padding:0 6px;';

    var bgInput = document.createElement('input');
    bgInput.id = 'theme-bg-input';
    bgInput.type = 'text';
    bgInput.placeholder = 'image url';
    bgInput.value = getBgImgCookie();
    bgInput.style.cssText =
      'flex:1;padding:5px 8px;border-radius:6px;font-size:0.78rem;' +
      'background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.12);' +
      'color:#ddd;outline:none;min-width:0;';
    bgInput.onfocus = function () { bgInput.style.borderColor = 'rgba(255,255,255,0.3)'; };
    bgInput.onblur  = function () { bgInput.style.borderColor = 'rgba(255,255,255,0.12)'; };
    bgInput.onkeydown = function (e) { if (e.key === 'Enter') { setBtn.click(); } };

    function mkBtn(label, title, onclick) {
      var b = document.createElement('button');
      b.className = 'tbg-btn';
      b.textContent = label;
      b.title = title;
      b.style.cssText =
        'padding:4px 8px;border-radius:6px;font-size:0.78rem;cursor:pointer;flex-shrink:0;' +
        'background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.14);' +
        'color:#ccc;transition:background .12s;';
      b.onmouseenter = function () { b.style.background = 'rgba(255,255,255,0.15)'; };
      b.onmouseleave = function () { b.style.background = 'rgba(255,255,255,0.08)'; };
      b.onclick = onclick;
      return b;
    }

    function mkControlLabel(text) {
      var el = document.createElement('div');
      el.textContent = text;
      el.style.cssText = 'font-size:0.68rem;color:rgba(210,210,230,0.55);letter-spacing:.04em;text-transform:uppercase;margin-bottom:4px;';
      return el;
    }

    function mkSelect(pref, options, title) {
      var wrap = document.createElement('div');
      wrap.style.cssText = 'padding:0 6px 7px;';
      wrap.appendChild(mkControlLabel(title));
      var sel = document.createElement('select');
      sel.className = 'tbg-select';
      sel.style.cssText =
        'width:100%;height:30px;background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.12);' +
        'color:#ddd;border-radius:7px;padding:4px 7px;font-size:0.76rem;outline:none;';
      options.forEach(function(opt) {
        var o = document.createElement('option');
        o.value = opt[0];
        o.textContent = opt[1];
        sel.appendChild(o);
      });
      sel.value = getPref(pref, options[0][0]);
      sel.onchange = function() {
        setPref(pref, sel.value);
        applyCustomizationPrefs();
        applyBgImg(getEffectiveBgImg(getCookie()));
        window.dispatchEvent(new CustomEvent('themecustomize', { detail: { pref: pref, value: sel.value } }));
      };
      wrap.appendChild(sel);
      return wrap;
    }

    function mkRange(pref, min, max, step, fallback, title) {
      var wrap = document.createElement('div');
      wrap.style.cssText = 'padding:0 6px 8px;';
      var row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:4px;';
      var lab = mkControlLabel(title);
      lab.style.marginBottom = '0';
      var val = document.createElement('span');
      val.style.cssText = 'font-size:0.68rem;color:#ddd;font-variant-numeric:tabular-nums;';
      var range = document.createElement('input');
      range.type = 'range';
      range.min = min;
      range.max = max;
      range.step = step;
      range.value = getPref(pref, fallback);
      range.style.cssText = 'width:100%;accent-color:var(--t-ac);';
      function update() {
        val.textContent = Math.round(Number(range.value) * 100) + '%';
        setPref(pref, range.value);
        applyCustomizationPrefs();
        applyBgImg(getEffectiveBgImg(getCookie()));
      }
      range.oninput = update;
      row.appendChild(lab);
      row.appendChild(val);
      wrap.appendChild(row);
      wrap.appendChild(range);
      update();
      return wrap;
    }

    function mkColor(pref, title) {
      var wrap = document.createElement('div');
      wrap.style.cssText = 'padding:0 6px 8px;';
      wrap.appendChild(mkControlLabel(title));
      var row = document.createElement('div');
      row.style.cssText = 'display:grid;grid-template-columns:38px 1fr auto;gap:6px;align-items:center;';
      var color = document.createElement('input');
      color.type = 'color';
      color.value = /^#[0-9a-f]{6}$/i.test(getPref(pref, '')) ? getPref(pref, '') : '#7c3aed';
      color.style.cssText = 'width:38px;height:30px;padding:2px;border-radius:7px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.12);';
      var text = document.createElement('input');
      text.type = 'text';
      text.placeholder = '#7c3aed';
      text.value = getPref(pref, '');
      text.style.cssText = 'min-width:0;height:30px;background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.12);color:#ddd;border-radius:7px;padding:4px 7px;font-size:0.76rem;';
      var clear = mkBtn('', 'Clear custom accent', function() {
      });
      function apply(v) {
        if (v && !/^#[0-9a-f]{6}$/i.test(v)) return;
        setPref(pref, v);
        if (v) color.value = v;
        applyTheme(getCookie());
      }
      color.oninput = function() { text.value = color.value; apply(color.value); };
      text.onchange = function() { apply(text.value.trim()); };
      row.appendChild(color);
      row.appendChild(text);
      row.appendChild(clear);
      wrap.appendChild(row);
      return wrap;
    }

    var setBtn = mkBtn('set', 'Set background image', function () {
      var url = bgInput.value.trim();
      setBgImgCookie(url);
      applyBgImg(url || getEffectiveBgImg(getCookie()));
    });
    var clrBtn = mkBtn('x', 'Clear background image', function () {
      bgInput.value = '';
      setBgImgCookie('');
      applyBgImg(getEffectiveBgImg(getCookie()));
    });

    bgRow.appendChild(bgInput);
    bgRow.appendChild(setBtn);
    bgRow.appendChild(clrBtn);
    panel.appendChild(bgRow);

    var presetLabel = document.createElement('div');
    presetLabel.style.cssText = 'font-size:0.72rem;color:rgba(200,200,220,0.5);padding:8px 10px 5px;letter-spacing:.04em;';
    presetLabel.textContent = 'quick backgrounds';
    panel.appendChild(presetLabel);

    var presetGrid = document.createElement('div');
    presetGrid.style.cssText = 'display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:5px;padding:0 6px;';
    [
      ['YouTube', 'youtube'],
      ['Discord', 'discord'],
      ['Spotify', 'spotify'],
      ['Netflix', 'netflix'],
      ['Twitch', 'twitch'],
      ['GitHub', 'github'],
      ['Classroom', 'classroom'],
      ['Roblox', 'roblox'],
      ['Minecraft', 'minecraft'],
      ['Google', 'google'],
      ['Ocean', 'ocean'],
      ['Sunset', 'sunset']
    ].forEach(function(pair) {
      var pbtn = mkBtn(pair[0], 'Use ' + pair[0] + ' background', function() {
        setBgImgCookie('');
        setCookie(pair[1]);
        applyTheme(pair[1]);
        panel.querySelectorAll('[data-tk]').forEach(function (el) {
          el.style.background = el.getAttribute('data-tk') === pair[1] ? 'rgba(255,255,255,0.09)' : '';
        });
        window.dispatchEvent(new CustomEvent('themechange', { detail: pair[1] }));
      });
      pbtn.style.cssText += 'width:100%;padding:5px 7px;font-size:0.72rem;';
      presetGrid.appendChild(pbtn);
    });
    panel.appendChild(presetGrid);

    var sepCustomize = document.createElement('div');
    sepCustomize.style.cssText = 'border-top:1px solid rgba(255,255,255,0.08);margin:9px 4px 8px;';
    panel.appendChild(sepCustomize);

    var customizeLabel = document.createElement('div');
    customizeLabel.style.cssText = 'font-size:0.72rem;color:rgba(200,200,220,0.5);padding:0 10px 7px;letter-spacing:.04em;';
    customizeLabel.textContent = 'customize';
    panel.appendChild(customizeLabel);

    panel.appendChild(mkColor('accent', 'custom accent'));
    panel.appendChild(mkRange('dim', 0, 0.85, 0.05, 0.50, 'background dim'));
    panel.appendChild(mkSelect('bgmode', [
      ['cover', 'Fill screen'],
      ['contain', 'Fit whole image'],
      ['tile', 'Tile image'],
      ['stretch', 'Stretch image']
    ], 'background style'));
    panel.appendChild(mkSelect('bgpos', [
      ['center', 'Center'],
      ['top', 'Top'],
      ['bottom', 'Bottom'],
      ['left center', 'Left'],
      ['right center', 'Right']
    ], 'background position'));
    panel.appendChild(mkSelect('density', [
      ['compact', 'Compact UI'],
      ['normal', 'Normal UI'],
      ['comfy', 'Comfy UI'],
      ['huge', 'Large UI']
    ], 'ui size'));
    panel.appendChild(mkSelect('radius', [
      ['sharp', 'Sharp corners'],
      ['soft', 'Soft corners'],
      ['round', 'Round corners'],
      ['bubble', 'Bubble corners']
    ], 'corner style'));
    panel.appendChild(mkSelect('font', [
      ['system', 'Clean system'],
      ['mono', 'Terminal mono'],
      ['rounded', 'Rounded'],
      ['serif', 'Serif'],
      ['futuristic', 'Futuristic']
    ], 'font style'));
    panel.appendChild(mkSelect('motion', [
      ['on', 'Animations on'],
      ['off', 'Animations off']
    ], 'motion'));

    var resetCustom = mkBtn('reset customization', 'Reset visual customization controls', function () {
      ['accent','dim','bgmode','bgpos','density','radius','font','motion'].forEach(function(k) {
        try { localStorage.removeItem('theme_' + k); } catch (_) {}
      });
      panel.remove();
      btn.remove();
      buildPicker();
      applyCustomizationPrefs();
      applyTheme(getCookie());
    });
    resetCustom.style.cssText += 'width:calc(100% - 12px);margin:0 6px 4px;text-align:center;box-sizing:border-box;';
    panel.appendChild(resetCustom);

    var sep2 = document.createElement('div');
    sep2.style.cssText = 'border-top:1px solid rgba(255,255,255,0.08);margin:8px 4px 6px;';
    panel.appendChild(sep2);

    var cleanBtn = mkBtn('clean mode', 'Hide all UI chrome', function () {
      activateCleanMode();
    });
    cleanBtn.style.cssText += 'width:calc(100% - 12px);margin:0 6px 4px;text-align:center;box-sizing:border-box;';
    panel.appendChild(cleanBtn);

    btn.onclick = function (e) {
      e.stopPropagation();
      panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
      if (panel.style.display !== 'none') bgInput.value = getBgImgCookie();
    };
    document.addEventListener('click', function () { panel.style.display = 'none'; });
    panel.addEventListener('click', function (e) { e.stopPropagation(); });

    var xBtn = document.createElement('button');
    xBtn.id = 'theme-clean-btn';
    xBtn.title = 'Clean mode';
    xBtn.innerHTML = '&#10005;';
    xBtn.style.cssText =
      'width:26px;height:26px;border-radius:50%;' +
      'border:1.5px solid rgba(160,160,160,0.45);' +
      'background:rgba(30,30,30,0.55);color:rgba(180,180,180,0.8);' +
      'font-size:11px;cursor:pointer;padding:0;flex-shrink:0;' +
      'display:flex;align-items:center;justify-content:center;' +
      'backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);' +
      'transition:opacity .15s;line-height:1;font-family:inherit;';
    xBtn.onmouseenter = function () { xBtn.style.opacity = '1'; xBtn.style.borderColor = 'rgba(200,200,200,0.7)'; };
    xBtn.onmouseleave = function () { xBtn.style.opacity = ''; xBtn.style.borderColor = 'rgba(160,160,160,0.45)'; };
    if (!location.pathname.startsWith('/encrypt')) {
      xBtn.onclick = activateCleanMode;
      var topbarX = document.getElementById('site-topbar');
      if (topbarX) topbarX.insertBefore(xBtn, topbarX.firstChild);
      else document.body.appendChild(xBtn);
    }

    var topbar = document.getElementById('site-topbar');
    if (topbar) topbar.insertBefore(btn, topbar.firstChild);
    else document.body.appendChild(btn);
    document.body.appendChild(panel);
  }

  function injectThemePicker() {
    var topbar = document.getElementById('site-topbar');
    if (topbar) {
      buildPicker();
    } else {
      // topbar not yet created (broadcast.js may not have run yet) — wait briefly
      setTimeout(function() {
        buildPicker();
      }, 50);
    }
  }

  if (document.body) { injectThemePicker(); }
  else { document.addEventListener('DOMContentLoaded', injectThemePicker); }

  function addWatermark() {
    if (location.pathname.endsWith('/encrypt.html')) return;
    if (location.pathname.startsWith('/encrypt')) return;
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
        'backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);display:block;';

      var discordPanel = document.createElement('div');
      discordPanel.id = 'discord-server-panel';
      discordPanel.style.cssText =
        'display:none;position:fixed;right:15px;bottom:56px;z-index:999999;' +
        'width:min(280px,calc(100vw - 30px));background:rgba(10,10,14,0.96);' +
        'border:1px solid rgba(88,101,242,0.35);border-radius:10px;padding:12px;' +
        'box-shadow:0 18px 50px rgba(0,0,0,0.55);color:var(--t-fg);' +
        'font-family:system-ui,-apple-system,sans-serif;font-size:13px;line-height:1.45;' +
        'backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);';
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

  window.__theme = { apply: applyTheme, get: getCookie, themes: T, setBg: function(url) { setBgImgCookie(url); applyBgImg(url); } };

  // ── Visual Effects ──────────────────────────────────────────────────────────
  function applyVFX() {
    var vfx = JSON.parse(localStorage.getItem('_prefVFX') || '{}');
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
      w = canvas.width = window.innerWidth;
      h = canvas.height = window.innerHeight;
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
      
      items.forEach(function(p) {
        if (p.type === 'snow') {
          ctx.fillStyle = '#fff';
          ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI*2); ctx.fill();
          p.y += p.v; p.x += Math.sin(p.y/30)*0.5;
          if (p.y > h) p.y = -10; if (p.x > w) p.x = 0; if (p.x < 0) p.x = w;
        } else if (p.type === 'star') {
          ctx.fillStyle = 'rgba(255,255,255,' + p.o + ')';
          ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI*2); ctx.fill();
          p.o += p.ov; if (p.o > 1 || p.o < 0) p.ov *= -1;
        } else if (p.type === 'rain') {
          ctx.strokeStyle = 'rgba(255,255,255,0.3)';
          ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + p.v/4, p.y + p.l); ctx.stroke();
          p.y += p.v; p.x += p.v/4;
          if (p.y > h) { p.y = -20; p.x = Math.random()*w; }
        } else if (p.type === 'part') {
          ctx.fillStyle = cachedAccent;
          ctx.globalAlpha = 0.2;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI*2); ctx.fill();
          ctx.globalAlpha = 1.0;
          p.x += p.vx; p.y += p.vy;
          if (p.x < 0 || p.x > w) p.vx *= -1;
          if (p.y < 0 || p.y > h) p.vy *= -1;
        }
      });
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
    bar.style.cssText = 'position:fixed;right:10px;top:50%;transform:translateY(-50%);z-index:10000;display:flex;flex-direction:column;gap:8px;padding:8px;background:rgba(10,10,10,0.4);backdrop-filter:blur(8px);border:1px solid rgba(255,255,255,0.1);border-radius:12px;box-shadow:0 8px 32px rgba(0,0,0,0.5);transition:opacity 0.2s;';
    
    var links = [
      { h:'/', i:'🏠', t:'Home' },
      { h:'/games/', i:'🎮', t:'Games' },
      { h:'/encrypt.html', i:'💬', t:'Chat' },
      { h:'/canvas/', i:'🎨', t:'Canvas' },
      { h:'/shop/', i:'🛒', t:'Market' },
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

    // ── Click Tracking (Heatmap) ────────────────────────────────────────────────
    function setupClickTracking() {
    return;
      window.addEventListener('click', function(e) {
        if (e.target.closest('button, a, input, select, textarea')) {
          // Track clicks on interactive elements
          var x = e.pageX / document.documentElement.scrollWidth;
          var y = e.pageY / document.documentElement.scrollHeight;

          fetch('/api/log-click', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              page: window.location.pathname,
              x: x,
              y: y
            })
          }).catch(function(){});
        }
      }, true);
    }

    if (document.body) { applyVFX(); applyCustomCSS(); applyQuickAccess(); setupClickTracking(); }
    else { document.addEventListener('DOMContentLoaded', function(){ applyVFX(); applyCustomCSS(); applyQuickAccess(); setupClickTracking(); }); }
    window.addEventListener('themecustomize', function() { applyVFX(); applyCustomCSS(); applyQuickAccess(); });
    })();

