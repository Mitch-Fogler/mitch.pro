// popup.js - Reusable premium custom dialog confirmation/alert system

(function() {
  const styles = `
    .custom-popup-overlay {
      position: fixed;
      inset: 0;
      z-index: 99999;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(8, 10, 15, 0.76);
      backdrop-filter: blur(12px);
      opacity: 0;
      transition: opacity 0.2s ease;
    }
    .custom-popup-overlay.show {
      opacity: 1;
    }
    .custom-popup-box {
      width: min(420px, calc(100vw - 32px));
      background: linear-gradient(180deg, rgba(25, 30, 45, 0.92), rgba(15, 18, 28, 0.96));
      border: 1px solid rgba(148, 163, 184, 0.16);
      border-radius: 16px;
      box-shadow: 0 24px 60px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.03) inset;
      padding: 24px;
      transform: scale(0.92);
      transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, sans-serif;
      color: #e2e8f0;
    }
    .custom-popup-overlay.show .custom-popup-box {
      transform: scale(1);
    }
    .custom-popup-title {
      font-size: 16px;
      font-weight: 800;
      margin-bottom: 10px;
      background: linear-gradient(90deg, #2dd4bf, #60a5fa);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      letter-spacing: 0.5px;
    }
    .custom-popup-msg {
      font-size: 13px;
      line-height: 1.6;
      color: #94a3b8;
      margin-bottom: 24px;
    }
    .custom-popup-actions {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
    }
    .custom-popup-btn {
      padding: 8px 16px;
      font-size: 12px;
      font-weight: 600;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.15s ease;
      font-family: inherit;
    }
    .custom-popup-btn-cancel {
      background: rgba(148, 163, 184, 0.08);
      border: 1px solid rgba(148, 163, 184, 0.18);
      color: #cbd5e1;
    }
    .custom-popup-btn-cancel:hover {
      background: rgba(148, 163, 184, 0.15);
      color: #fff;
    }
    .custom-popup-btn-confirm {
      background: #2dd4bf;
      border: 1px solid #2dd4bf;
      color: #0f172a;
      box-shadow: 0 4px 12px rgba(45, 212, 191, 0.2);
    }
    .custom-popup-btn-confirm:hover {
      background: #22bfa9;
      border-color: #22bfa9;
      transform: translateY(-1px);
      box-shadow: 0 6px 16px rgba(45, 212, 191, 0.35);
    }
  `;

  // Inject styles if not already present
  if (!document.getElementById('custom-popup-styles')) {
    const styleEl = document.createElement('style');
    styleEl.id = 'custom-popup-styles';
    styleEl.textContent = styles;
    document.head.appendChild(styleEl);
  }

  // Define global confirmation dialog function
  window.customConfirm = function(title, message, confirmText = 'Confirm', cancelText = 'Cancel') {
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.className = 'custom-popup-overlay';
      
      overlay.innerHTML = `
        <div class="custom-popup-box">
          <div class="custom-popup-title">${title}</div>
          <div class="custom-popup-msg">${message}</div>
          <div class="custom-popup-actions">
            <button class="custom-popup-btn custom-popup-btn-cancel" id="popup-cancel-btn">${cancelText}</button>
            <button class="custom-popup-btn custom-popup-btn-confirm" id="popup-confirm-btn">${confirmText}</button>
          </div>
        </div>
      `;

      document.body.appendChild(overlay);
      
      // Trigger animations
      requestAnimationFrame(() => {
        overlay.classList.add('show');
      });

      const cleanup = (val) => {
        overlay.classList.remove('show');
        setTimeout(() => {
          overlay.remove();
        }, 200);
        resolve(val);
      };

      overlay.querySelector('#popup-cancel-btn').onclick = () => cleanup(false);
      overlay.querySelector('#popup-confirm-btn').onclick = () => cleanup(true);
      
      // Close on clicking outside the box
      overlay.onclick = (e) => {
        if (e.target === overlay) cleanup(false);
      };
    });
  };
})();
