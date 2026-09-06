(function () {
  'use strict';
  window.MitchBackgroundEffects = window.MitchBackgroundEffects || {};
  window.MitchBackgroundEffects.starfield = function (host) {
    var canvas = document.createElement('canvas');
    canvas.id = 'mitch-bg-starfield';
    canvas.setAttribute('aria-hidden', 'true');
    canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;z-index:-1;pointer-events:none;background:#050b1b;';
    host.appendChild(canvas);
    var ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return { update: function () {}, destroy: function () { canvas.remove(); } };
    var media = matchMedia('(prefers-reduced-motion: reduce)');
    var fine = matchMedia('(pointer: fine)');
    var width = 0, height = 0, stars = [], sky, frame = 0, last = 0, elapsed = 0;
    var dead = false, reduced = false, dim = .5, px = 0, py = 0, tx = 0, ty = 0;
    function paint(dt) {
      elapsed += dt;
      px += (tx - px) * Math.min(1, dt * 2);
      py += (ty - py) * Math.min(1, dt * 2);
      ctx.globalAlpha = 1;
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, width, height);
      stars.forEach(function (s) {
        var x = ((s.x * width + elapsed * s.depth * 1.8 + px * s.depth * 8) % (width + 24) + width + 24) % (width + 24) - 12;
        var y = ((s.y * height + elapsed * s.depth * .45 + py * s.depth * 6) % (height + 24) + height + 24) % (height + 24) - 12;
        ctx.globalAlpha = s.brightness * (1 - dim * .65) * (.9 + .1 * Math.sin(elapsed * .35 + s.phase));
        ctx.fillStyle = s.color;
        ctx.beginPath();
        ctx.arc(x, y, s.radius, 0, Math.PI * 2);
        ctx.fill();
        if (s.radius > 1.25) {
          ctx.globalAlpha *= .07;
          ctx.beginPath(); ctx.arc(x, y, s.radius * 3.2, 0, Math.PI * 2); ctx.fill();
        }
      });
      ctx.globalAlpha = 1;
    }
    function tickStarfield(now) {
      frame = 0;
      if (dead || reduced || document.hidden) return;
      // Cap drawing at 30fps, including on high-refresh displays.
      if (!last || now - last >= 32) {
        paint(last ? Math.min((now - last) / 1000, .08) : 0);
        last = now;
      }
      frame = requestAnimationFrame(tickStarfield);
    }
    function update() {
      if (dead) return;
      reduced = media.matches || host.classList.contains('theme-no-motion');
      dim = parseFloat(getComputedStyle(host).getPropertyValue('--t-bg-dim')) || 0;
      cancelAnimationFrame(frame); frame = 0; last = 0;
      if (reduced) { px = py = tx = ty = 0; }
      if (!document.hidden) {
        paint(0);
        if (!reduced) frame = requestAnimationFrame(tickStarfield);
      }
    }
    function resize() {
      width = innerWidth; height = innerHeight;
      var dpr = Math.min(devicePixelRatio || 1, 1.5, Math.sqrt(3500000 / Math.max(1, width * height)));
      canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      sky = ctx.createRadialGradient(width * .7, height * .25, 0, width * .5, height * .4, Math.max(width, height));
      sky.addColorStop(0, '#10162f'); sky.addColorStop(.45, '#080e20'); sky.addColorStop(1, '#030713');
      var count = Math.min(420, Math.max(65, Math.round(width * height / 5200)));
      while (stars.length < count) {
        var depth = .2 + Math.random() * .8;
        stars.push({ x: Math.random(), y: Math.random(), depth: depth, radius: .3 + depth * 1.1,
          brightness: .3 + Math.random() * .65, phase: Math.random() * Math.PI * 2,
          color: Math.random() > .85 ? '#c5bcff' : '#d8e8ff' });
      }
      stars.length = count;
      update();
    }
    function pointer(event) {
      if (reduced || !fine.matches || event.pointerType === 'touch') return;
      tx = event.clientX / width - .5; ty = event.clientY / height - .5;
    }
    function leave() { tx = ty = 0; }
    window.addEventListener('resize', resize, { passive: true });
    window.addEventListener('pointermove', pointer, { passive: true });
    document.addEventListener('pointerleave', leave);
    document.addEventListener('visibilitychange', update);
    window.addEventListener('themecustomize', update);
    media.addEventListener('change', update);
    resize();
    return {
      update: update,
      destroy: function () {
        dead = true; cancelAnimationFrame(frame); frame = 0;
        window.removeEventListener('resize', resize);
        window.removeEventListener('pointermove', pointer);
        document.removeEventListener('pointerleave', leave);
        document.removeEventListener('visibilitychange', update);
        window.removeEventListener('themecustomize', update);
        media.removeEventListener('change', update);
        canvas.remove(); canvas.width = canvas.height = 0; stars = []; sky = null;
      }
    };
  };
})();
