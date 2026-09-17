(() => {
  if (window.__guestPreview || document.body?.classList.contains('sales-page') || document.querySelector('.sales-page') || /\/(enroll|claim|password|privacy|agreement|use-agreement|unsubscribe|admin|moderator|index-sales)(\/|\.html|$)/.test(location.pathname)) return;
  window.__guestPreview = true;
  let timer, dialog;
  async function start() {
    try {
      const response = await fetch('/api/guest-session', { credentials:'same-origin', cache:'no-store' });
      if (!response.ok) return;
      const state = await response.json();
      if (state.authenticated) return;
      document.documentElement.classList.add('guest-preview');
      const clock = document.createElement('div'); clock.className = 'guest-clock'; clock.setAttribute('aria-label','Guest preview time remaining'); document.body.append(clock);
      const deadline = performance.now() + Math.max(0,state.expiresAt-state.serverNow);
      function tick() {
        const seconds = Math.max(0,Math.ceil((deadline-performance.now())/1000));
        clock.textContent = `Guest preview · ${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`;
        if (seconds || dialog) return;
        clearInterval(timer); clock.remove();
        dialog = document.createElement('dialog'); dialog.className = 'guest-signup'; dialog.setAttribute('aria-labelledby','guest-signup-title');
        dialog.innerHTML = '<img src="/icon-192.png" alt=""><h2 id="guest-signup-title">Keep playing.</h2><p>Your guest minute is up. Create a free account to play games, add friends, and collect Mitch Coins.</p><a href="/enroll/?mode=signup">Create a free account</a><a href="/enroll/">I already have an account</a>';
        dialog.addEventListener('cancel', e => e.preventDefault()); document.body.append(dialog); dialog.showModal();
      }
      timer = setInterval(tick,250); tick();
      document.addEventListener('visibilitychange',tick);
      window.addEventListener('pagehide',() => clearInterval(timer),{once:true});
      window.addEventListener('pageshow',event => { if(event.persisted) location.reload(); });
    } catch {}
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',start,{once:true}); else start();
})();
