(function () {
  'use strict';

  var state = {
    games: [],
    category: 'All',
    query: '',
    limit: 96,
    current: null,
    rewardTimer: null,
    rewardElapsed: 0,
    authenticated: false,
    dailyEarned: 0,
    dailyCap: 240,
    rewardPerMinute: 2
  };

  var byId = function (id) { return document.getElementById(id); };
  var grid = byId('game-grid');
  var search = byId('game-search');
  var player = byId('game-player');
  var frame = byId('game-frame');

  function plainText(value) {
    var doc = new DOMParser().parseFromString(String(value || ''), 'text/html');
    return (doc.body.textContent || '').replace(/\s+/g, ' ').trim();
  }

  function safeUrl(value) {
    try {
      var url = new URL(String(value || ''), 'https://calculated2.github.io/');
      return url.protocol === 'https:' ? url.toString() : '';
    } catch (_) { return ''; }
  }

  function iconUrl(value) {
    var raw = String(value || '');
    if (raw.indexOf('/img/games/') === 0) return '/game-portal/icons/' + raw.slice('/img/games/'.length);
    if (raw.indexOf('/img/gamems/') === 0) return '/game-portal/icons/' + raw.slice('/img/gamems/'.length);
    return safeUrl(raw);
  }

  function gameUrl(value) {
    var raw = String(value || '');
    if (raw.indexOf('/') === 0) return location.origin + '/proxy/calculated2' + raw;
    var safe = safeUrl(raw);
    if (!safe) return '';
    var parsed = new URL(safe);
    if (parsed.hostname === 'lumassets.pages.dev') {
      return location.origin + '/proxy/luma' + parsed.pathname + parsed.search + parsed.hash;
    }
    if (parsed.hostname === 'calculated2.github.io') {
      return location.origin + '/proxy/calculated2' + parsed.pathname + parsed.search + parsed.hash;
    }
    return safe;
  }

  function canEmbed(game) {
    if (game.external) return false;
    try {
      var url = new URL(game.url);
      return url.origin === location.origin && (url.pathname.indexOf('/proxy/luma/') === 0 || url.pathname.indexOf('/proxy/calculated2/') === 0);
    } catch (_) { return false; }
  }

  function formatCoins(value) {
    return Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 });
  }

  function card(game) {
    var button = document.createElement('button');
    button.type = 'button';
    button.className = 'game-card';
    button.dataset.gameId = game.id;
    button.setAttribute('aria-label', 'Play ' + game.title);

    var fallback = document.createElement('span');
    fallback.className = 'game-fallback';
    fallback.textContent = game.title.charAt(0).toUpperCase() || 'G';
    button.appendChild(fallback);

    if (game.icon) {
      var image = document.createElement('img');
      image.src = game.icon;
      image.alt = '';
      image.loading = 'lazy';
      image.decoding = 'async';
      image.addEventListener('error', function () { image.remove(); });
      button.appendChild(image);
    }

    var copy = document.createElement('span');
    copy.className = 'game-card-copy';
    var title = document.createElement('strong');
    title.textContent = game.title;
    var category = document.createElement('small');
    category.textContent = game.category;
    copy.append(title, category);
    button.appendChild(copy);
    button.addEventListener('click', function () { launch(game, button); });
    return button;
  }

  function filteredGames() {
    return state.games.filter(function (game) {
      var categoryMatch = state.category === 'All' || game.category === state.category;
      var queryMatch = !state.query || game.search.indexOf(state.query) !== -1;
      return categoryMatch && queryMatch;
    });
  }

  function render() {
    var matches = filteredGames();
    var visible = matches.slice(0, state.limit);
    grid.replaceChildren.apply(grid, visible.map(card));
    byId('portal-empty').hidden = matches.length !== 0;
    byId('load-more').hidden = matches.length <= state.limit;
    byId('results-label').textContent = matches.length === state.games.length ? '' : matches.length + ' found';
  }

  function renderCategories(categories) {
    var strip = byId('category-strip');
    strip.replaceChildren.apply(strip, ['All'].concat(categories).map(function (name) {
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'category-chip' + (name === state.category ? ' is-active' : '');
      button.textContent = name === 'Utility' ? 'Tools' : name;
      button.addEventListener('click', function () {
        state.category = name;
        state.limit = 96;
        Array.from(strip.children).forEach(function (item) { item.classList.toggle('is-active', item === button); });
        render();
      });
      return button;
    }));
  }

  function recentIds() {
    try { return JSON.parse(localStorage.getItem('mitch.gamePortal.recent') || '[]').filter(Number.isInteger).slice(0, 6); }
    catch (_) { return []; }
  }

  function remember(game) {
    var ids = recentIds().filter(function (id) { return id !== game.id; });
    ids.unshift(game.id);
    try { localStorage.setItem('mitch.gamePortal.recent', JSON.stringify(ids.slice(0, 6))); } catch (_) {}
    renderRecent();
  }

  function renderRecent() {
    var games = recentIds().map(function (id) { return state.games[id]; }).filter(Boolean);
    byId('recent-section').hidden = games.length === 0;
    byId('recent-games').replaceChildren.apply(byId('recent-games'), games.map(card));
  }

  function updateRewardUi(data) {
    if (!data) return;
    if (data.authenticated === false) {
      state.authenticated = false;
      byId('wallet-balance').textContent = 'Sign in';
      byId('reward-title').textContent = 'Sign in to earn';
      byId('reward-detail').textContent = 'Your playtime rewards save to your account';
      byId('portal-wallet').href = '/api/sso/bridge?back=' + encodeURIComponent(location.href);
      return;
    }
    state.authenticated = true;
    state.dailyEarned = Number(data.dailyEarned || 0);
    state.dailyCap = Number(data.dailyCap || 240);
    state.rewardPerMinute = Number(data.rewardPerMinute || 2);
    byId('wallet-balance').textContent = formatCoins(data.coins);
    byId('reward-title').textContent = 'Earn ' + state.rewardPerMinute + ' per minute';
    byId('reward-detail').textContent = state.dailyEarned + ' of ' + state.dailyCap + ' earned today';
    byId('reward-progress').style.width = Math.min(100, state.dailyEarned / state.dailyCap * 100) + '%';
    byId('player-reward').textContent = state.dailyEarned >= state.dailyCap ? 'Daily reward complete' : 'Earning ' + state.rewardPerMinute + '/min';
  }

  async function heartbeat(active) {
    var game = active && state.current ? state.current.title : '';
    try {
      var response = await fetch('/api/game-portal/heartbeat', {
        method: 'POST',
        credentials: 'include',
        cache: 'no-store',
        keepalive: !active,
        headers: { 'Content-Type': 'application/json', 'X-Mitch-Requested-With': '1' },
        body: JSON.stringify({ active: active, game: game })
      });
      var data = await response.json().catch(function () { return null; });
      if (response.status === 401) updateRewardUi({ authenticated: false });
      else if (response.ok && data) {
        updateRewardUi(data);
        if (data.earned > 0) showCoinToast(data.earned);
      }
    } catch (_) {
      byId('player-earning').classList.add('is-paused');
      byId('player-reward').textContent = 'Rewards reconnecting';
    }
  }

  function showCoinToast(amount) {
    var toast = byId('coin-toast');
    toast.textContent = '+' + formatCoins(amount) + ' MitchCoins';
    toast.classList.add('is-visible');
    clearTimeout(toast._timer);
    toast._timer = setTimeout(function () { toast.classList.remove('is-visible'); }, 2200);
  }

  function startRewardLoop() {
    stopRewardLoop(false);
    state.rewardElapsed = 0;
    heartbeat(document.visibilityState === 'visible');
    state.rewardTimer = setInterval(function () {
      var active = !player.hidden && document.visibilityState === 'visible';
      byId('player-earning').classList.toggle('is-paused', !active || !state.authenticated);
      if (active) state.rewardElapsed += 20;
      heartbeat(active);
    }, 20_000);
  }

  function stopRewardLoop(sendInactive) {
    if (state.rewardTimer) clearInterval(state.rewardTimer);
    state.rewardTimer = null;
    if (sendInactive) heartbeat(false);
  }

  function launch(game, trigger) {
    remember(game);
    if (!canEmbed(game)) {
      window.open(game.url, '_blank', 'noopener');
      return;
    }
    state.current = game;
    state.trigger = trigger;
    byId('player-title').textContent = game.title;
    byId('player-new-tab').href = game.url;
    byId('player-loading').classList.remove('is-hidden');
    frame.title = game.title;
    frame.src = game.url;
    player.hidden = false;
    document.body.style.overflow = 'hidden';
    history.replaceState(null, '', '?game=' + game.id);
    byId('player-close').focus();
    startRewardLoop();
  }

  function closePlayer() {
    if (player.hidden) return;
    stopRewardLoop(true);
    frame.src = 'about:blank';
    player.hidden = true;
    document.body.style.overflow = '';
    history.replaceState(null, '', location.pathname);
    var trigger = state.trigger;
    state.current = null;
    if (trigger && trigger.isConnected) trigger.focus();
  }

  frame.addEventListener('load', function () { byId('player-loading').classList.add('is-hidden'); });
  byId('player-close').addEventListener('click', closePlayer);
  byId('player-fullscreen').addEventListener('click', function () {
    var target = byId('player-stage');
    if (document.fullscreenElement) document.exitFullscreen().catch(function () {});
    else target.requestFullscreen().catch(function () {});
  });
  byId('load-more').addEventListener('click', function () { state.limit += 96; render(); });
  search.addEventListener('input', function () { state.query = search.value.trim().toLowerCase(); state.limit = 96; render(); });
  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && !player.hidden) closePlayer();
    else if (event.key === '/' && player.hidden && document.activeElement !== search) { event.preventDefault(); search.focus(); }
  });
  document.addEventListener('visibilitychange', function () {
    if (!player.hidden) heartbeat(document.visibilityState === 'visible');
  });
  window.addEventListener('pagehide', function () { if (!player.hidden) stopRewardLoop(true); });

  fetch('/api/game-portal/status', { credentials: 'include', cache: 'no-store' })
    .then(function (response) { return response.ok ? response.json() : { authenticated: false }; })
    .then(updateRewardUi)
    .catch(function () { byId('reward-detail').textContent = 'Rewards temporarily unavailable'; });

  fetch('/game-portal/games.json', { cache: 'force-cache' })
    .then(function (response) { if (!response.ok) throw new Error('catalog'); return response.json(); })
    .then(function (data) {
      var games = [];
      (data.links || []).forEach(function (section) {
        (section.games || []).forEach(function (entry) {
          var title = plainText(entry[0]) || 'Game';
          var url = gameUrl(entry[2]);
          if (!url) return;
          games.push({
            id: games.length,
            title: title,
            icon: iconUrl(entry[1]),
            url: url,
            description: plainText(entry[3]),
            category: plainText(section.title) || 'Games',
            external: entry[4] === 'IgnoreIframe',
            search: (title + ' ' + plainText(section.title) + ' ' + plainText(entry[3])).toLowerCase()
          });
        });
      });
      state.games = games;
      byId('game-count').textContent = games.length;
      renderCategories(Array.from(new Set(games.map(function (game) { return game.category; }))));
      renderRecent();
      render();
      var requested = Number(new URLSearchParams(location.search).get('game'));
      if (Number.isInteger(requested) && games[requested]) launch(games[requested]);
      heartbeat(false);
    })
    .catch(function () {
      grid.innerHTML = '<div class="portal-empty">The game library could not load. Refresh to try again.</div>';
    });
})();
