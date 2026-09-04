// popup.js - Reusable premium custom dialog system (alert / confirm / prompt).
// Injected site-wide except games. All dialogs return Promises and escape HTML.

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
      overflow-wrap: anywhere;
      white-space: pre-wrap;
    }
    .custom-popup-msg.no-margin {
      margin-bottom: 14px;
    }
    .custom-popup-input {
      width: 100%;
      box-sizing: border-box;
      padding: 10px 12px;
      font-size: 13px;
      font-family: inherit;
      color: #e2e8f0;
      background: rgba(8, 10, 15, 0.6);
      border: 1px solid rgba(148, 163, 184, 0.22);
      border-radius: 9px;
      outline: none;
      margin-bottom: 24px;
      transition: border-color 0.15s ease;
    }
    .custom-popup-input:focus {
      border-color: #2dd4bf;
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

  function injectStyles() {
    if (document.getElementById('custom-popup-styles')) return;
    const styleEl = document.createElement('style');
    styleEl.id = 'custom-popup-styles';
    styleEl.textContent = styles;
    document.head.appendChild(styleEl);
  }

  function esc(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // Shared overlay builder. rows is HTML the caller builds from escaped parts.
  function buildOverlay(rows, opts) {
    opts = opts || {};
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.className = 'custom-popup-overlay';

      overlay.innerHTML = `
        <div class="custom-popup-box">
          <div class="custom-popup-title">${esc(opts.title || 'Notice')}</div>
          ${rows}
          <div class="custom-popup-actions"></div>
        </div>
      `;

      const actions = overlay.querySelector('.custom-popup-actions');
      document.body.appendChild(overlay);

      requestAnimationFrame(() => overlay.classList.add('show'));

      const cleanup = (val) => {
        overlay.classList.remove('show');
        setTimeout(() => overlay.remove(), 200);
        document.removeEventListener('keydown', onKey, true);
        resolve(val);
      };

      function addBtn(text, cls, fn) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'custom-popup-btn ' + cls;
        b.textContent = text;
        b.onclick = fn;
        actions.appendChild(b);
        return b;
      }

      function onKey(e) {
        if (e.key === 'Escape') { e.stopPropagation(); cleanup(opts.escValue); }
        else if (e.key === 'Enter' && opts.enterConfirm) {
          const input = overlay.querySelector('.custom-popup-input');
          if (input && document.activeElement === input) {
            e.stopPropagation();
            cleanup(input.value);
          }
        }
      }
      document.addEventListener('keydown', onKey, true);

      if (opts.onOpen) opts.onOpen(overlay, addBtn, cleanup);

      // Close on clicking outside the box
      overlay.onclick = (e) => {
        if (e.target === overlay) cleanup(opts.escValue);
      };
    });
  }

  window.customAlert = function(title, message, okText) {
    injectStyles();
    return buildOverlay(`<div class="custom-popup-msg">${esc(message)}</div>`, {
      title,
      onOpen(overlay, addBtn, cleanup) {
        const ok = addBtn(okText || 'OK', 'custom-popup-btn-confirm', () => cleanup(true));
        setTimeout(() => ok.focus(), 60);
      }
    });
  };

  window.customConfirm = function(title, message, confirmText = 'Confirm', cancelText = 'Cancel') {
    injectStyles();
    return buildOverlay(`<div class="custom-popup-msg">${esc(message)}</div>`, {
      title,
      escValue: false,
      onOpen(overlay, addBtn, cleanup) {
        addBtn(cancelText, 'custom-popup-btn-cancel', () => cleanup(false));
        const ok = addBtn(confirmText, 'custom-popup-btn-confirm', () => cleanup(true));
        setTimeout(() => ok.focus(), 60);
      }
    });
  };

  window.customPrompt = function(title, message, defaultValue = '') {
    injectStyles();
    return buildOverlay(
      `<div class="custom-popup-msg no-margin">${esc(message)}</div>` +
      `<input type="text" class="custom-popup-input" autocomplete="off" spellcheck="false">`,
      {
        title,
        escValue: null,
        enterConfirm: true,
        onOpen(overlay, addBtn, cleanup) {
          const input = overlay.querySelector('.custom-popup-input');
          input.value = defaultValue == null ? '' : String(defaultValue);
          addBtn('Cancel', 'custom-popup-btn-cancel', () => cleanup(null));
          addBtn('OK', 'custom-popup-btn-confirm', () => cleanup(input.value));
          setTimeout(() => { input.focus(); input.select(); }, 60);
        }
      }
    );
  };

  // Native alert() has no useful return value anywhere, so it can be shimmed
  // globally. confirm()/prompt() are synchronous and stay native unless a page
  // has been converted to the custom*() equivalents.
  window.alert = function(msg) {
    return window.customAlert('Notice', String(msg == null ? '' : msg));
  };
})();