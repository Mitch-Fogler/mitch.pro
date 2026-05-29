(function() {
  const CONSENT_KEY = '_mitch_cookie_consent';
  if (localStorage.getItem(CONSENT_KEY)) return;

  const style = document.createElement('style');
  style.textContent = `
    #mitch-cookie-banner {
      position: fixed;
      bottom: 20px;
      left: 20px;
      right: 20px;
      z-index: 2147483647;
      background: rgba(10, 10, 18, 0.85);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 16px;
      padding: 20px;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 20px;
      animation: mitch-banner-fade-in 0.5s ease-out both;
    }
    @keyframes mitch-banner-fade-in { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
    .mitch-banner-content { flex: 1; }
    .mitch-banner-title { font: 800 15px Syne, sans-serif; color: #fff; margin-bottom: 4px; display: flex; align-items: center; gap: 8px; }
    .mitch-banner-text { font-size: 13px; color: rgba(255, 255, 255, 0.6); line-height: 1.5; }
    .mitch-banner-text a { color: var(--ac, #00ff88); text-decoration: none; font-weight: 600; }
    .mitch-banner-btns { display: flex; gap: 10px; }
    .mitch-banner-btn {
      padding: 10px 20px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 700;
      cursor: pointer;
      transition: all 0.2s;
      border: 1px solid transparent;
      font-family: inherit;
    }
    .mitch-banner-btn.accept { background: var(--ac, #00ff88); color: #000; }
    .mitch-banner-btn.accept:hover { filter: brightness(1.1); transform: scale(1.02); }
    .mitch-banner-btn.decline { background: rgba(255, 255, 255, 0.05); color: #fff; border-color: rgba(255, 255, 255, 0.1); }
    .mitch-banner-btn.decline:hover { background: rgba(255, 255, 255, 0.1); }
    @media (max-width: 700px) {
      #mitch-cookie-banner { flex-direction: column; text-align: center; bottom: 10px; left: 10px; right: 10px; padding: 16px; }
      .mitch-banner-title { justify-content: center; }
      .mitch-banner-btns { width: 100%; }
      .mitch-banner-btn { flex: 1; }
    }
  `;
  document.head.appendChild(style);

  const banner = document.createElement('div');
  banner.id = 'mitch-cookie-banner';
  banner.innerHTML = `
    <div class="mitch-banner-content">
      <div class="mitch-banner-title">🍪 Cookie Notice</div>
      <div class="mitch-banner-text">We use strictly necessary cookies to manage your session and keep you logged in. No tracking ads, just essential bits. Read our <a href="/privacy/">Privacy Policy</a>.</div>
    </div>
    <div class="mitch-banner-btns">
      <button class="mitch-banner-btn decline" id="mitch-cookie-decline">Close</button>
      <button class="mitch-banner-btn accept" id="mitch-cookie-accept">Accept All</button>
    </div>
  `;
  document.body.appendChild(banner);

  document.getElementById('mitch-cookie-accept').onclick = function() {
    localStorage.setItem(CONSENT_KEY, 'true');
    banner.style.opacity = '0';
    banner.style.transform = 'translateY(10px)';
    banner.style.transition = 'all 0.3s';
    setTimeout(() => banner.remove(), 300);
  };
  document.getElementById('mitch-cookie-decline').onclick = function() {
    banner.style.opacity = '0';
    banner.style.transform = 'translateY(10px)';
    banner.style.transition = 'all 0.3s';
    setTimeout(() => banner.remove(), 300);
  };
})();
