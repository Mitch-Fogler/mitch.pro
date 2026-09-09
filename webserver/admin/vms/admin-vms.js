(function () {
  'use strict';
  const headers = { 'Content-Type': 'application/json', 'X-Mitch-Requested-With': '1' };
  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const bytes = value => Number(value) ? `${(Number(value) / 1073741824).toLocaleString(undefined, { maximumFractionDigits: 1 })} GB` : '\u2014';
  const pct = (used, total) => total ? Math.max(0, Math.min(100, Math.round(used / total * 100))) : 0;
  const pending = new Set();
  let overview = null, loading = false, creating = false, assigning = false;
  async function api(url, body) {
    const response = await fetch(url, { credentials: 'same-origin', cache: 'no-store', ...(body ? { method: 'POST', headers, body: JSON.stringify(body) } : {}) });
    const data = await response.json().catch(() => ({}));
    if (response.status === 401) { location.href = '/enroll/?next=' + encodeURIComponent(location.pathname); throw new Error('Sign in to continue.'); }
    if (!response.ok) throw new Error(response.status === 403 ? 'Administrator access is required.' : data.error || 'The computer service could not be reached.');
    return data;
  }
  function options(id, rows, value, label, empty) {
    const select = $(id), previous = select.value;
    select.innerHTML = rows.map(row => `<option value="${esc(value(row))}">${esc(label(row))}</option>`).join('') || `<option value="">${empty}</option>`;
    if ([...select.options].some(option => option.value === previous)) select.value = previous;
  }
  function renderCapacity() {
    const c = overview.capacity || {};
    $('cpu-capacity').textContent = c.cpuCores ? `${pct(c.cpuUsage, 1)}% of ${c.cpuCores} cores` : '\u2014';
    $('cpu-bar').style.width = `${pct(c.cpuUsage, 1)}%`;
    $('memory-capacity').textContent = c.memoryTotal ? `${bytes(c.memoryUsed)} / ${bytes(c.memoryTotal)}` : '\u2014';
    $('memory-bar').style.width = `${pct(c.memoryUsed, c.memoryTotal)}%`;
    $('storage-capacity').textContent = c.storageTotal ? `${bytes(c.storageUsed)} / ${bytes(c.storageTotal)}` : '\u2014';
    $('storage-bar').style.width = `${pct(c.storageUsed, c.storageTotal)}%`;
    $('assigned-capacity').textContent = (overview.computers || []).filter(vm => vm.assignmentStatus !== 'unassigned').length;
  }
  function renderForms() {
    for (const id of ['create-user', 'assign-user']) options(id, overview.users || [], user => user.email, user => `${user.name || user.email} - ${user.email}`, 'No users found');
    options('create-template', overview.templates || [], vm => vm.vmid, vm => vm.name, 'No desktop template available');
    options('assign-vm', overview.availableGuests || [], vm => vm.vmid, vm => `${vm.name} - ${vm.status}`, 'No unassigned computers');
    if (!$('create-hostname').value && $('create-user').value) setHostname();
    $('create-button').disabled = creating || !overview.serviceAvailable || !$('create-user').value || !$('create-template').value;
    $('assign-button').disabled = assigning || !overview.serviceAvailable || !$('assign-vm').value || !$('assign-user').value;
  }
  function renderFleet() {
    const rows = (overview.computers || []).filter(vm => vm.assignmentStatus !== 'unassigned');
    $('fleet-list').innerHTML = rows.length ? rows.map(vm => {
      const running = vm.status === 'running', busy = pending.has(vm.id), stopped = vm.status === 'stopped';
      return `<article class="fleet-item" data-id="${esc(vm.id)}"><div class="fleet-identity"><strong>${esc(vm.name)}</strong><small>${esc(vm.operatingSystem || 'Linux desktop')}</small></div><div class="fleet-owner"><strong title="${esc(vm.ownerEmail)}">${esc(vm.ownerEmail)}</strong><small>${esc(vm.hostname || 'No hostname')}</small></div><span class="fleet-state ${running ? 'running' : ''}">${busy ? 'Updating...' : running ? 'Running' : stopped ? 'Offline' : esc(vm.status)}</span><span class="fleet-resources">${esc(vm.cpuCores)} CPU &middot; ${bytes(vm.memoryTotal)}<small>${bytes(vm.diskTotal)} disk</small></span><span class="fleet-address">${esc(vm.ipAddress || 'No IP yet')}</span><div class="fleet-actions">${running && vm.desktopAvailable !== false ? `<a href="/vms/desktop/?id=${encodeURIComponent(vm.id)}">Open Desktop</a>` : `<button data-power="start" ${busy || !stopped ? 'disabled' : ''}>Start</button>`}<button data-power="restart" ${busy || !running ? 'disabled' : ''}>Restart</button><button data-power="shutdown" ${busy || !running ? 'disabled' : ''}>Shut Down</button><button data-power="force-stop" class="danger" ${busy || !running ? 'disabled' : ''}>Force Stop</button><button data-unassign class="unassign" ${busy ? 'disabled' : ''}>Unassign</button></div></article>`;
    }).join('') : '<p class="empty">No customer computers are assigned.</p>';
  }
  function renderAudit() {
    const rows = overview.audit || [];
    $('audit-list').innerHTML = rows.length ? rows.map(row => `<div class="audit-row"><time>${esc(new Date(row.ts).toLocaleString('en-US', { dateStyle: 'short', timeStyle: 'short' }))}</time><strong>${esc(String(row.action || '').replaceAll('_', ' '))}</strong><span>${esc(row.actorEmail)}${row.ownerEmail ? ` &rarr; ${esc(row.ownerEmail)}` : ''}</span><span class="${row.success ? '' : 'failed'}">${row.success ? 'Success' : 'Failed'}</span></div>`).join('') : '<p class="empty">No activity yet.</p>';
  }
  async function load() {
    if (loading) return;
    loading = true; $('refresh-button').disabled = true;
    try {
      overview = await api('/api/admin/vms/overview');
      $('service-state').className = `service-state ${overview.serviceAvailable ? 'online' : 'offline'}`;
      $('service-state').querySelector('span').textContent = overview.serviceAvailable ? 'Computer service online' : 'Computer service unavailable';
      renderCapacity(); renderForms(); renderFleet(); renderAudit();
    } catch (error) { $('service-state').className = 'service-state offline'; $('service-state').querySelector('span').textContent = error.message; }
    finally { loading = false; $('refresh-button').disabled = false; }
  }
  function status(id, message, type = '') { $(id).textContent = message; $(id).className = `form-status ${type}`; }
  function setHostname() { $('create-hostname').value = ('computer-' + $('create-user').value.split('@')[0]).toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 48).replace(/-+$/, ''); }
  $('create-user').addEventListener('change', setHostname);
  $('create-form').addEventListener('submit', async event => {
    event.preventDefault(); if (creating) return;
    if (!confirm('Create and start this desktop? Make sure you have securely saved the desktop login details for the user.')) return;
    creating = true; const button = $('create-button'); button.disabled = true; button.textContent = 'Creating computer...';
    status('create-status', 'Cloning the desktop. Keep this page open; this can take a few minutes.');
    const body = { ownerEmail: $('create-user').value, friendlyName: $('create-name').value.trim(), hostname: $('create-hostname').value.trim(), templateVmid: Number($('create-template').value), cpuCores: Number($('create-cpu').value), memoryMb: Number($('create-memory').value), diskGb: Number($('create-disk').value), desktopUsername: $('create-username').value.trim(), desktopPassword: $('create-password').value };
    $('create-password').value = '';
    try { await api('/api/admin/vms/create', body); status('create-status', 'Computer created. The desktop may take a minute to finish starting.', 'success'); await load(); }
    catch (error) { status('create-status', error.message + ' Re-enter the desktop password before trying again.', 'error'); }
    finally { body.desktopPassword = ''; creating = false; button.textContent = 'Create & start computer'; if (overview) renderForms(); }
  });
  $('assign-form').addEventListener('submit', async event => {
    event.preventDefault(); if (assigning) return;
    assigning = true; $('assign-button').disabled = true; status('assign-status', 'Assigning...');
    try { await api('/api/admin/vms/assign', { vmid: Number($('assign-vm').value), ownerEmail: $('assign-user').value, friendlyName: $('assign-name').value.trim(), operatingSystem: $('assign-os').value }); status('assign-status', 'Computer assigned.', 'success'); await load(); }
    catch (error) { status('assign-status', error.message, 'error'); }
    finally { assigning = false; if (overview) renderForms(); }
  });
  $('fleet-list').addEventListener('click', async event => {
    const button = event.target.closest('button'), item = button?.closest('[data-id]');
    if (!item || button.disabled || pending.has(item.dataset.id)) return;
    const vm = overview?.computers.find(row => row.id === item.dataset.id); if (!vm) return;
    let url, body;
    if (button.hasAttribute('data-unassign')) {
      if (!confirm(`Unassign ${vm.name} from ${vm.ownerEmail}? Their open desktop will disconnect. The computer and its files will remain on the server.`)) return;
      url = '/api/admin/vms/unassign'; body = { id: vm.id };
    } else {
      const action = button.dataset.power;
      const labels = { restart: 'Restart', shutdown: 'Shut down', 'force-stop': 'Force stop' };
      if (action !== 'start' && !confirm(`${labels[action]} ${vm.name}? ${action === 'force-stop' ? 'This immediately cuts power and may damage unsaved files.' : 'Save any open work first.'}`)) return;
      url = `/api/vm/computers/${encodeURIComponent(vm.id)}/power`; body = { action };
    }
    pending.add(vm.id); renderFleet(); status('fleet-status', 'Updating computer...');
    try { await api(url, body); status('fleet-status', 'Request accepted.', 'success'); setTimeout(() => { pending.delete(vm.id); load(); }, 6000); }
    catch (error) { pending.delete(vm.id); renderFleet(); status('fleet-status', error.message, 'error'); }
  });
  $('refresh-button').addEventListener('click', load);
  load();
  const timer = setInterval(() => { if (!document.hidden && !creating && !assigning && !pending.size) load(); }, 20000);
  window.addEventListener('pagehide', () => { clearInterval(timer); $('create-password').value = ''; }, { once: true });
})();
