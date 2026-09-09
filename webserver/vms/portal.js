(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const grid = $('computer-grid');
  const dialog = $('confirm-dialog');
  const headers = { 'Content-Type': 'application/json', 'X-Mitch-Requested-With': '1' };
  const pending = new Map();
  let computers = [], loading = false;
  const esc = value => String(value ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const bytes = value => Number(value) ? `${(Number(value) / 1073741824).toLocaleString(undefined, { maximumFractionDigits: 1 })} GB` : '\u2014';
  const uptime = value => { const n = Number(value) || 0, d = Math.floor(n / 86400), h = Math.floor(n % 86400 / 3600), m = Math.floor(n % 3600 / 60); return !n ? '\u2014' : d ? `${d}d ${h}h` : h ? `${h}h ${m}m` : `${m}m`; };
  function setState(name) { ['loading-state', 'empty-state', 'error-state', 'computer-grid'].forEach(id => $(id).classList.toggle('is-hidden', id !== name)); }
  function card(vm) {
    const running = vm.status === 'running';
    const operation = pending.get(vm.id);
    const busy = !!operation || ['starting', 'stopping', 'restarting'].includes(vm.status);
    const status = operation || ({ running: 'Running', stopped: 'Offline', starting: 'Starting...', stopping: 'Shutting down...', restarting: 'Restarting...', unavailable: 'Unavailable', unknown: 'Checking status' }[vm.status] || 'Offline');
    const distro = vm.operatingSystem || 'Linux desktop';
    const mark = /mint/i.test(distro) ? 'LM' : /ubuntu/i.test(distro) ? 'U' : 'PC';
    const open = running && !busy && vm.desktopAvailable !== false;
    return `<article class="computer-card" data-id="${esc(vm.id)}">
      <div class="desktop-preview"><span class="status-pill ${busy ? 'transitioning' : running ? 'running' : ''}">${esc(status)}</span><div class="desktop-window" aria-hidden="true"><div class="window-bar"><i></i><i></i><i></i></div><div class="window-content"><div class="mint-mark">${mark}</div><p>${esc(distro)}</p></div></div></div>
      <div class="computer-details"><div class="computer-title-row"><div><h2>${esc(vm.name || 'My Computer')}</h2><p>${esc(distro)}</p></div>${open ? `<a class="primary-button" href="/vms/desktop/?id=${encodeURIComponent(vm.id)}">Open Desktop <span aria-hidden="true">&#8599;</span></a>` : '<button class="primary-button" disabled>Open Desktop</button>'}</div>
      <div class="spec-grid"><div class="spec"><span>CPU</span><strong>${esc(vm.cpuCores || '\u2014')} cores</strong></div><div class="spec"><span>Memory</span><strong>${bytes(vm.memoryTotal)}</strong></div><div class="spec"><span>Disk</span><strong>${bytes(vm.diskTotal)}</strong></div><div class="spec"><span>Address</span><strong title="${esc(vm.ipAddress)}">${esc(vm.ipAddress || (running ? 'Connecting...' : '\u2014'))}</strong></div><div class="spec"><span>Uptime</span><strong>${uptime(vm.uptime)}</strong></div></div>
      <div class="computer-actions">${!running ? `<button class="primary-button" data-action="start" ${busy || vm.status !== 'stopped' ? 'disabled' : ''}>${operation || 'Start Computer'}</button>` : ''}<button class="control-button" data-action="restart" ${!running || busy ? 'disabled' : ''}>Restart</button><button class="control-button" data-action="shutdown" ${!running || busy ? 'disabled' : ''}>Shut Down</button></div></div></article>`;
  }
  function render() { grid.innerHTML = computers.map(card).join(''); setState(computers.length ? 'computer-grid' : 'empty-state'); }
  async function load() {
    if (loading) return;
    loading = true; $('refresh-button').disabled = true;
    if (!computers.length) setState('loading-state');
    try {
      const response = await fetch('/api/vm/computers', { credentials: 'same-origin', cache: 'no-store' });
      if (response.status === 401) { location.href = '/enroll/?next=' + encodeURIComponent(location.pathname); return; }
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Your computers could not be reached.');
      computers = Array.isArray(data.computers) ? data.computers : [];
      $('refresh-status').textContent = ''; render();
    } catch (error) {
      if (computers.length) $('refresh-status').textContent = 'Status could not be refreshed. Try again shortly.';
      else { $('error-copy').textContent = error.message; setState('error-state'); }
    } finally { loading = false; $('refresh-button').disabled = false; }
  }
  function confirmPower(action, name) {
    if (action === 'start') return Promise.resolve(true);
    if (dialog.open) return Promise.resolve(false);
    $('confirm-title').textContent = action === 'restart' ? 'Restart computer?' : 'Shut down computer?';
    $('confirm-copy').textContent = `${action === 'restart' ? 'Restart' : 'Shut down'} ${name}? Save your work inside the desktop first.`;
    $('confirm-action').textContent = action === 'restart' ? 'Restart' : 'Shut Down';
    dialog.returnValue = ''; dialog.showModal();
    return new Promise(resolve => dialog.addEventListener('close', () => resolve(dialog.returnValue === 'confirm'), { once: true }));
  }
  async function power(id, action) {
    const vm = computers.find(item => item.id === id);
    if (!vm || pending.has(id) || !await confirmPower(action, vm.name || 'your computer') || pending.has(id)) return;
    pending.set(id, { start: 'Starting...', restart: 'Restarting...', shutdown: 'Shutting down...' }[action]); render();
    try {
      const response = await fetch(`/api/vm/computers/${encodeURIComponent(id)}/power`, { method: 'POST', credentials: 'same-origin', headers, body: JSON.stringify({ action }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Your computer could not be reached.');
      setTimeout(() => { pending.delete(id); load(); }, 6000);
    } catch (error) { pending.delete(id); render(); $('refresh-status').textContent = error.message; }
  }
  grid.addEventListener('click', event => { const button = event.target.closest('button[data-action]'); if (button && !button.disabled) power(button.closest('[data-id]').dataset.id, button.dataset.action); });
  $('refresh-button').addEventListener('click', load);
  load();
  const timer = setInterval(() => { if (!document.hidden && !dialog.open && !pending.size) load(); }, 15000);
  window.addEventListener('pagehide', () => clearInterval(timer), { once: true });
})();
