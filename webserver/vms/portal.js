(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const grid = $('computer-grid');
  document.title = `My Computer - ${location.hostname}`;
  const dialog = $('confirm-dialog');
  const provDialog = $('provision-dialog');
  const headers = { 'Content-Type': 'application/json', 'X-Mitch-Requested-With': '1' };
  const pending = new Map();
  let computers = [], loading = false, provisionMode = 'create';
  const esc = value => String(value ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const bytes = value => Number(value) ? `${(Number(value) / 1073741824).toLocaleString(undefined, { maximumFractionDigits: 1 })} GB` : '\u2014';
  const uptime = value => { const n = Number(value) || 0, d = Math.floor(n / 86400), h = Math.floor(n % 86400 / 3600), m = Math.floor(n % 3600 / 60); return !n ? '\u2014' : d ? `${d}d ${h}h` : h ? `${h}h ${m}m` : `${m}m`; };
  const percent = (used, total) => total > 0 ? Math.max(0, Math.min(100, Math.round(Number(used || 0) / Number(total) * 100))) : 0;
  function setState(name) { ['loading-state', 'empty-state', 'error-state', 'computer-grid'].forEach(id => $(id).classList.toggle('is-hidden', id !== name)); }
  function card(vm) {
    const running = vm.status === 'running';
    const operation = pending.get(vm.id);
    const busy = !!operation || ['starting', 'stopping', 'restarting'].includes(vm.status);
    const status = operation || ({ running: 'Running', stopped: 'Offline', starting: 'Starting...', stopping: 'Shutting down...', restarting: 'Restarting...', unavailable: 'Unavailable', unknown: 'Checking status' }[vm.status] || 'Offline');
    const distro = vm.operatingSystem || 'Linux desktop';
    const mark = /mint/i.test(distro) ? 'LM' : /ubuntu/i.test(distro) ? 'U' : 'PC';
    const open = running && !busy && vm.desktopAvailable !== false;
    const cpuLoad = Math.max(0, Math.min(100, Math.round(Number(vm.cpuUsage || 0) * 100)));
    const memoryLoad = percent(vm.memoryUsed, vm.memoryTotal);
    const diskLoad = percent(vm.diskUsed, vm.diskTotal);
    const remSeconds = vm.lease?.remainingSeconds != null ? vm.lease.remainingSeconds : null;
    const remDisplay = remSeconds != null ? uptime(remSeconds) : null;
    const dailyUsed = Boolean(vm.lease?.dailyExtensionUsed);
    const canExtend = running && !busy && vm.lease?.canExtend && !vm.lease?.extended && !dailyUsed;
    const inCooldown = !running && Number(vm.cooldownRemainingSeconds) > 0;
    const cooldownMins = inCooldown ? Math.ceil(Number(vm.cooldownRemainingSeconds) / 60) : 0;
    const previewTag = open ? 'a' : 'div';
    const previewLink = open ? ` href="/vms/desktop/?id=${encodeURIComponent(vm.id)}" aria-label="Open ${esc(vm.name || 'My Computer')}"` : '';
    return `<article class="computer-card" data-id="${esc(vm.id)}">
      <${previewTag} class="desktop-preview ${running ? 'is-running' : 'is-offline'}"${previewLink}>
        <span class="status-pill ${busy ? 'transitioning' : running ? 'running' : ''}">${esc(status)}</span>
        <div class="desktop-window" aria-hidden="true">
          <div class="window-bar"><span class="window-brand">${mark}</span><span class="window-clock">My Computer</span><span class="window-system"><i></i><i></i><i></i></span></div>
          <div class="window-content"><div class="desktop-emblem">${mark}</div><div class="desktop-dock"><i></i><i></i><i></i><i></i></div></div>
        </div>
        ${open ? '<span class="preview-action">Open desktop <b aria-hidden="true">↗</b></span>' : ''}
      </${previewTag}>
      <div class="computer-details">
        <div class="computer-title-row"><div><p class="machine-label">Personal desktop</p><h2>${esc(vm.name || 'My Computer')}</h2><p>${esc(distro)}</p></div>${open ? `<a class="primary-button" href="/vms/desktop/?id=${encodeURIComponent(vm.id)}"><span>Open Desktop</span><b aria-hidden="true">↗</b></a>` : '<button class="primary-button" disabled>Open Desktop</button>'}</div>
        <div class="machine-facts">
          <span><small>Address</small><strong title="${esc(vm.ipAddress)}">${esc(vm.ipAddress || (running ? 'Connecting…' : 'Not available'))}</strong></span>
          <span><small>Uptime</small><strong>${uptime(vm.uptime)}</strong></span>
          ${running && remDisplay ? `<span><small>Time Left</small><strong style="${remSeconds <= 600 ? 'color:#fde047' : ''}">${remDisplay}</strong></span>` : ''}
          ${inCooldown ? `<span><small>Cooldown</small><strong style="color:#f87171;">${cooldownMins}m left</strong></span>` : ''}
        </div>
        <div class="resource-grid">
          <div class="resource"><span><small>CPU</small><b>${esc(vm.cpuCores || '—')} cores</b></span><em>${cpuLoad}%</em><i><b style="width:${cpuLoad}%"></b></i></div>
          <div class="resource"><span><small>Memory</small><b>${bytes(vm.memoryTotal)}</b></span><em>${memoryLoad}%</em><i><b style="width:${memoryLoad}%"></b></i></div>
          <div class="resource"><span><small>Storage</small><b>${bytes(vm.diskTotal)}</b></span><em>${diskLoad}%</em><i><b style="width:${diskLoad}%"></b></i></div>
        </div>
        <div class="computer-actions">
          ${!running ? `<button class="primary-button" data-action="start" ${busy || inCooldown || vm.status !== 'stopped' ? 'disabled' : ''}>${inCooldown ? `Cooldown (${cooldownMins}m)` : (operation || 'Start Computer')}</button>` : ''}
          ${canExtend ? `<button class="control-button" data-action="extend" ${busy ? 'disabled' : ''}><span aria-hidden="true">+</span> Extend 30m</button>` : (running && dailyUsed ? `<button class="control-button" disabled title="Only 1 30-minute extension allowed per day"><span aria-hidden="true">+</span> Extend 30m (Used)</button>` : '')}
          <button class="control-button" data-action="restart" ${!running || busy ? 'disabled' : ''}><span aria-hidden="true">↻</span> Restart</button>
          <button class="control-button danger-control" data-action="shutdown" ${!running || busy ? 'disabled' : ''}><span aria-hidden="true">⏻</span> Shut Down</button>
          <button class="control-button danger-control" data-action="recreate" ${busy ? 'disabled' : ''} title="Delete this computer and create a fresh one"><span aria-hidden="true">⚠️</span> Delete &amp; Recreate Computer</button>
        </div>
      </div></article>`;
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
      if (data.isEligible === false) {
        $('empty-create-box')?.classList.add('is-hidden');
        $('empty-unauthorized-box')?.classList.remove('is-hidden');
      } else {
        $('empty-create-box')?.classList.remove('is-hidden');
        $('empty-unauthorized-box')?.classList.add('is-hidden');
      }
      $('refresh-status').textContent = ''; render();
    } catch (error) {
      if (computers.length) $('refresh-status').textContent = 'Status could not be refreshed. Try again shortly.';
      else { $('error-copy').textContent = error.message; setState('error-state'); }
    } finally { loading = false; $('refresh-button').disabled = false; }
  }
  function confirmPower(action, name) {
    if (action === 'start' || action === 'extend') return Promise.resolve(true);
    if (dialog.open) return Promise.resolve(false);
    $('confirm-title').textContent = action === 'restart' ? 'Restart computer?' : 'Shut down computer?';
    $('confirm-copy').textContent = `${action === 'restart' ? 'Restart' : 'Shut down'} ${name}? Save your work inside the desktop first.`;
    $('confirm-action').textContent = action === 'restart' ? 'Restart' : 'Shut Down';
    dialog.returnValue = ''; dialog.showModal();
    return new Promise(resolve => dialog.addEventListener('close', () => resolve(dialog.returnValue === 'confirm'), { once: true }));
  }
  async function power(id, action) {
    const vm = computers.find(item => item.id === id);
    if (!vm || pending.has(id)) return;
    if (action === 'recreate') {
      openProvisionModal('recreate');
      return;
    }
    if (!await confirmPower(action, vm.name || 'your computer') || pending.has(id)) return;
    if (action === 'extend') {
      pending.set(id, 'Extending...'); render();
      try {
        const response = await fetch(`/api/vm/computers/${encodeURIComponent(id)}/extend`, { method: 'POST', credentials: 'same-origin', headers, body: '{}' });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || 'Session could not be extended.');
        $('refresh-status').textContent = 'Session extended by 30 minutes.';
        setTimeout(() => { pending.delete(id); load(); }, 1200);
      } catch (error) { pending.delete(id); render(); $('refresh-status').textContent = error.message; }
      return;
    }
    pending.set(id, { start: 'Starting...', restart: 'Restarting...', shutdown: 'Shutting down...' }[action]); render();
    try {
      const response = await fetch(`/api/vm/computers/${encodeURIComponent(id)}/power`, { method: 'POST', credentials: 'same-origin', headers, body: JSON.stringify({ action }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Your computer could not be reached.');
      setTimeout(() => { pending.delete(id); load(); }, 6000);
    } catch (error) { pending.delete(id); render(); $('refresh-status').textContent = error.message; }
  }

  function openProvisionModal(mode) {
    if (!provDialog) return;
    provisionMode = mode;
    const isRecreate = mode === 'recreate';
    $('provision-eyebrow').textContent = isRecreate ? 'Recreate Computer' : 'New Computer';
    $('provision-title').textContent = isRecreate ? 'Delete & Recreate Computer' : 'Set Computer Password';
    $('recreate-warning').classList.toggle('is-hidden', !isRecreate);
    $('provision-submit').textContent = isRecreate ? 'Delete & Recreate (Erase All Data)' : 'Create Computer';
    $('provision-submit').className = isRecreate ? 'danger-button' : 'primary-button';
    $('provision-password').value = '';
    $('provision-confirm-password').value = '';
    $('provision-status').textContent = '';
    provDialog.showModal();
  }

  $('provision-cancel')?.addEventListener('click', () => provDialog?.close());
  $('create-vm-btn')?.addEventListener('click', () => openProvisionModal('create'));

  $('provision-form')?.addEventListener('submit', async event => {
    event.preventDefault();
    const pass = $('provision-password').value;
    const confirm = $('provision-confirm-password').value;
    const statusEl = $('provision-status');
    if (pass.length < 8) {
      statusEl.textContent = 'Password must be at least 8 characters long.';
      return;
    }
    if (pass !== confirm) {
      statusEl.textContent = 'Passwords do not match.';
      return;
    }
    statusEl.textContent = provisionMode === 'recreate' ? 'Deleting old computer and provisioning new one…' : 'Provisioning your computer…';
    $('provision-submit').disabled = true;
    try {
      const endpoint = provisionMode === 'recreate' ? '/api/vm/my-computer/recreate' : '/api/vm/my-computer/create';
      const res = await fetch(endpoint, {
        method: 'POST',
        credentials: 'same-origin',
        headers,
        body: JSON.stringify({ desktopPassword: pass }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to provision computer.');
      provDialog.close();
      $('refresh-status').textContent = 'Your computer is being prepared and will start shortly (approx 30s)...';
      setTimeout(load, 3000);
      setTimeout(load, 10000);
    } catch (err) {
      statusEl.textContent = err.message || 'An error occurred.';
    } finally {
      $('provision-submit').disabled = false;
    }
  });

  grid.addEventListener('click', event => { const button = event.target.closest('button[data-action]'); if (button && !button.disabled) power(button.closest('[data-id]').dataset.id, button.dataset.action); });
  $('refresh-button').addEventListener('click', load);
  load();
  const timer = setInterval(() => { if (!document.hidden && !dialog.open && !provDialog?.open && !pending.size) load(); }, 15000);
  window.addEventListener('pagehide', () => clearInterval(timer), { once: true });
})();
