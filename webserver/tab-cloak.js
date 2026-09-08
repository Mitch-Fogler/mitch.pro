// Adapted from Tyler's Tools tab-cloak-v20 for the mitch.pro shell.
(() => {
  'use strict';
  if (window.MitchCloak) return;
  const key = '_cloakMitch'; // Device-local, excluded by the existing sync system.
  const presets = {
    classroom: ['Google Classroom', 'Classes', '/cloak-google-classroom.svg'],
    drive: ['Google Drive', 'My Drive - Google Drive', '/cloak-google-drive.svg'],
    docs: ['Google Docs', 'Untitled document', '/cloak-google-docs.svg'],
    clever: ['Clever', 'Clever | Portal', '/cloak-clever.png']
  };
  const clean = value => String(value || '').replace(/[\x00-\x1f\x7f]/g, ' ').trim().slice(0, 80);
  function normalize(value) {
    const v = value || {};
    return { mode: Object.hasOwn(presets, v.mode) || v.mode === 'custom' ? v.mode : '',
      title: clean(v.title), icon: /^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(v.icon || '') && v.icon.length < 50000 ? v.icon : '',
      auto: v.auto === true, shortcut: v.shortcut === true };
  }
  function read() { try { return normalize(JSON.parse(localStorage.getItem(key))); } catch { return normalize(); } }
  let state = read(), normalTitle = document.title, appliedTitle = '', observer, dialog, shield;
  const originals = new Map();
  function setting() { return presets[state.mode] || (state.mode === 'custom' && state.title ? ['Custom', state.title, state.icon || '/favicon.ico'] : null); }
  function apply() {
    observer?.disconnect();
    const selected = state.auto && document.hidden ? presets.classroom : setting();
    if (document.title !== appliedTitle) normalTitle = document.title;
    if (selected) {
      appliedTitle = selected[1];
      document.title = appliedTitle;
      let links = [...document.querySelectorAll('link[rel~="icon"]')];
      if (!links.length) { const link = document.createElement('link'); link.rel = 'icon'; link.dataset.cloakCreated = '1'; document.head.append(link); links = [link]; }
      links.forEach(link => {
        if (!originals.has(link)) originals.set(link, ['href','type','sizes'].map(attr => link.getAttribute(attr)));
        link.href = selected[2]; link.removeAttribute('type'); link.removeAttribute('sizes');
      });
    } else {
      if (appliedTitle) document.title = normalTitle;
      appliedTitle = '';
      originals.forEach((attrs, link) => {
        if (link.dataset.cloakCreated) link.remove();
        else ['href','type','sizes'].forEach((attr, i) => attrs[i] === null ? link.removeAttribute(attr) : link.setAttribute(attr, attrs[i]));
      });
      originals.clear();
    }
    observer?.observe(document.head, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['href','rel','type','sizes'] });
    document.querySelectorAll('[data-cloak-mode]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.cloakMode === state.mode)));
    const preview = document.getElementById('cloak-preview');
    if (preview) { preview.replaceChildren(); const img = document.createElement('img'); img.src = selected?.[2] || '/favicon.ico'; img.alt = ''; preview.append(img, document.createTextNode(selected?.[1] || normalTitle)); }
  }
  function save(patch) {
    state = normalize({ ...state, ...patch }); apply();
    try { localStorage.setItem(key, JSON.stringify(state)); status('Saved on this device.'); }
    catch { status('Applied for this page. Browser storage is unavailable.'); }
  }
  function status(text) { const el = document.getElementById('cloak-status'); if (el) el.textContent = text; }
  function cover() {
    if (!shield) {
      shield = document.createElement('dialog'); shield.id = 'cloak-shield'; shield.setAttribute('aria-label', 'Screen shield');
      const button = document.createElement('button'); button.textContent = 'Return to website'; button.onclick = () => shield.close(); shield.append(button); document.body.append(shield);
    }
    dialog?.close(); if (!shield.open) shield.showModal();
  }
  function open() {
    if (!dialog) {
      dialog = document.createElement('dialog'); dialog.id = 'cloak-dialog'; dialog.setAttribute('aria-labelledby','cloak-heading');
      dialog.innerHTML = `<header><div><h2 id="cloak-heading">Tab cloak</h2><p>Choose how this tab looks.</p></div><button type="button" data-close aria-label="Close cloak settings">×</button></header><div id="cloak-preview"></div><div class="cloak-presets"></div><form id="cloak-custom"><label>Custom tab title<input name="title" maxlength="80" required></label><label>Custom icon<input name="icon" type="file" accept="image/png,image/jpeg,image/webp"></label><button type="submit">Apply custom cloak</button></form><div class="cloak-options"><label><input type="checkbox" id="cloak-auto"> Use Classroom when this tab is hidden</label><label><input type="checkbox" id="cloak-shortcut"> Enable Alt + Shift + C to toggle Classroom</label></div><p class="cloak-note">Changes the tab title and icon only. Your URL and browsing history stay the same.</p><p id="cloak-status" role="status"></p><footer><button type="button" data-reset>Restore normal tab</button><button type="button" data-shield>Screen shield</button></footer>`;
      for (const [mode, preset] of Object.entries(presets)) {
        const button = document.createElement('button'); button.type = 'button'; button.dataset.cloakMode = mode;
        const image = document.createElement('img'); image.src = preset[2]; image.alt = ''; button.append(image, document.createTextNode(preset[0])); button.onclick = () => save({ mode }); dialog.querySelector('.cloak-presets').append(button);
      }
      dialog.querySelector('[data-close]').onclick = () => dialog.close();
      dialog.querySelector('[data-reset]').onclick = () => { save({ mode: '', auto: false }); dialog.querySelector('#cloak-auto').checked = false; };
      dialog.querySelector('[data-shield]').onclick = cover;
      dialog.querySelector('#cloak-auto').onchange = event => save({ auto: event.target.checked });
      dialog.querySelector('#cloak-shortcut').onchange = event => save({ shortcut: event.target.checked });
      dialog.querySelector('form').onsubmit = async event => {
        event.preventDefault(); const form = event.currentTarget, button = form.querySelector('button'); button.disabled = true;
        try {
          let icon = state.icon; const file = form.elements.icon.files[0];
          if (file) {
            if (!/^image\/(png|jpeg|webp)$/.test(file.type) || file.size > 1024 * 1024) throw new Error('Choose a PNG, JPEG, or WebP under 1 MB.');
            const image = await createImageBitmap(file);
            try {
              if (image.width * image.height > 16000000) throw new Error('Image dimensions are too large.');
              const canvas = document.createElement('canvas'); canvas.width = canvas.height = 64;
              const scale = Math.min(64 / image.width, 64 / image.height), w = image.width * scale, h = image.height * scale;
              canvas.getContext('2d').drawImage(image, (64-w)/2, (64-h)/2, w, h); icon = canvas.toDataURL('image/png');
            } finally { image.close(); }
          }
          save({ mode: 'custom', title: form.elements.title.value, icon });
        } catch (error) { status(error.message); } finally { button.disabled = false; }
      };
      document.body.append(dialog);
    }
    dialog.querySelector('[name="title"]').value = state.title;
    dialog.querySelector('#cloak-auto').checked = state.auto;
    dialog.querySelector('#cloak-shortcut').checked = state.shortcut;
    apply(); if (!dialog.open) dialog.showModal();
  }
  observer = new MutationObserver(apply);
  window.MitchCloak = { open, reset: () => save({ mode: '', auto: false }), cover };
  apply();
  document.addEventListener('visibilitychange', apply);
  window.addEventListener('storage', event => { if (event.key === key || event.key === null) { state = read(); apply(); } });
  document.addEventListener('keydown', event => {
    if (!state.shortcut || event.repeat || !event.altKey || !event.shiftKey || event.code !== 'KeyC' || event.target.closest?.('input,textarea,[contenteditable="true"]')) return;
    event.preventDefault(); save({ mode: state.mode === 'classroom' ? '' : 'classroom' });
  });
  const css = document.createElement('link'); css.rel = 'stylesheet'; css.href = '/tab-cloak.css?v=1'; document.head.append(css);
  const bar = document.querySelector('.home-masthead, #app-topbar');
  if (bar) { const button = document.createElement('button'); button.id = 'cloak-launcher'; button.textContent = 'Cloak'; button.title = 'Tab cloak settings'; button.onclick = open; bar.append(button); }
  document.querySelectorAll('[data-open-cloak]').forEach(button => button.onclick = open);
})();
