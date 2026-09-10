import RFB from '/novnc/core/rfb.js';

const $ = id => document.getElementById(id);
const id = new URLSearchParams(location.search).get('id') || '';
const screen = $('screen'), frame = $('display-frame'), cover = $('connection-cover');
const headers = { 'Content-Type': 'application/json', 'X-Mitch-Requested-With': '1' };
const MAX_RETRIES = 3;
let rfb = null, generation = 0, controller = null, reconnectTimer = null, connectTimer = null;
let reconnectAttempts = 0, connected = false, connecting = false, disposed = false, powerBusy = false;

function connectionState(label, type = '') {
  $('machine-state').className = type;
  $('machine-state').replaceChildren(Object.assign(document.createElement('i'), { ariaHidden: 'true' }), document.createTextNode(' ' + label));
  document.querySelectorAll('[data-connected]').forEach(button => { button.disabled = !connected; });
}
function showCover(heading, message, canRetry = false, busy = false) {
  cover.classList.remove('is-hidden');
  $('connection-title').textContent = heading; $('connection-copy').textContent = message;
  $('retry-button').hidden = !canRetry; $('connection-spinner').hidden = !busy;
}
function closeConnection() {
  generation++; controller?.abort(); controller = null;
  clearTimeout(reconnectTimer); clearTimeout(connectTimer);
  const old = rfb; rfb = null; connected = false; connecting = false;
  if (old) { try { old.disconnect(); } catch {} }
}
function friendlyError(status, data) {
  if (status === 401) return 'Your session expired. Go back to My Computer to sign in again.';
  if (status === 403) return 'You do not have permission to access this computer.';
  if (status === 404) return 'This computer could not be found.';
  if (status === 429) return 'Please wait a minute before opening another desktop connection.';
  return data?.error || 'Your computer could not be reached.';
}
async function request(url, options = {}) {
  const response = await fetch(url, { credentials: 'same-origin', cache: 'no-store', ...options });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) { const error = new Error(friendlyError(response.status, data)); error.status = response.status; throw error; }
  return data;
}
function interrupted(token, clean = false) {
  if (disposed || token !== generation) return;
  closeConnection(); connectionState('Disconnected', 'disconnected');
  if (clean || reconnectAttempts >= MAX_RETRIES || document.hidden) {
    showCover('Desktop disconnected', clean ? 'The remote desktop connection ended.' : 'Check your connection, then reconnect to your computer.', true);
    return;
  }
  reconnectAttempts++;
  showCover('Reconnecting to your desktop', `Connection interrupted. Trying again (${reconnectAttempts} of ${MAX_RETRIES})...`, false, true);
  reconnectTimer = setTimeout(connect, 1500 * reconnectAttempts);
}
async function connect() {
  if (disposed || powerBusy) return;
  closeConnection(); const token = generation;
  controller = new AbortController(); const signal = controller.signal; connecting = true;
  showCover(reconnectAttempts ? 'Reconnecting to your desktop' : 'Opening your desktop', 'Connecting securely...', false, true);
  connectionState('Connecting');
  try {
    if (!/^[a-zA-Z0-9_-]{1,80}$/.test(id)) throw new Error('Go back to My Computer and choose a desktop.');
    const data = await request(`/api/vm/computers/${encodeURIComponent(id)}`, { signal });
    if (token !== generation) return;
    const computer = data.computer;
    $('machine-name').textContent = computer?.name || 'My Computer';
    document.title = `${computer?.name || 'My Computer'} - ${location.hostname}`;
    if (computer?.status !== 'running') throw new Error('Your computer is offline. Start it from My Computer, then reconnect.');
    const session = await request(`/api/vm/computers/${encodeURIComponent(id)}/desktop-session`, { method: 'POST', headers, body: '{}', signal });
    if (token !== generation) return;
    if (typeof session.socketPath !== 'string' || !session.socketPath.startsWith('/api/vm/desktop/ws?session=')) throw new Error('The desktop connection could not be opened.');
    const url = new URL(session.socketPath, location.origin); url.protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const client = new RFB(screen, url.href, { shared: true, credentials: session.credentials });
    session.credentials = null;
    rfb = client;
    client.scaleViewport = true; client.resizeSession = true; client.clipViewport = false;
    client.showDotCursor = true; client.background = '#050607'; client.qualityLevel = 6; client.compressionLevel = 3;
    client.addEventListener('connect', () => {
      if (token !== generation) return;
      clearTimeout(connectTimer); connected = true; connecting = false;
      connectionState('Connected', 'connected'); cover.classList.add('is-hidden'); client.focus();
    });
    client.addEventListener('disconnect', event => interrupted(token, event.detail.clean));
    client.addEventListener('securityfailure', () => {
      if (token !== generation) return;
      closeConnection(); connectionState('Disconnected', 'disconnected');
      showCover('Desktop connection expired', 'Reconnect to open a fresh secure connection.', true);
    });
    client.addEventListener('credentialsrequired', () => {
      if (token !== generation) return;
      closeConnection(); connectionState('Disconnected', 'disconnected');
      showCover('Desktop connection expired', 'Reconnect to open a fresh secure connection.', true);
    });
    connectTimer = setTimeout(() => interrupted(token), 20000);
  } catch (error) {
    if (token !== generation || error.name === 'AbortError') return;
    closeConnection(); connectionState('Disconnected', 'disconnected');
    showCover('Desktop unavailable', error.message, ![401, 403, 404].includes(error.status));
  }
}
async function power(action) {
  if (powerBusy) return;
  const labels = { restart: 'Restart this computer? Save your work first.', shutdown: 'Shut down this computer? Save your work first.', 'force-stop': 'Force stop this computer? Unsaved work may be lost and files could be damaged.' };
  if (!confirm(labels[action])) return;
  powerBusy = true; document.querySelectorAll('[data-power]').forEach(button => { button.disabled = true; });
  try {
    await request(`/api/vm/computers/${encodeURIComponent(id)}/power`, { method: 'POST', headers, body: JSON.stringify({ action }) });
    closeConnection();
    connectionState(action === 'restart' ? 'Restarting' : 'Shutting down');
    showCover(action === 'restart' ? 'Restarting your computer' : 'Shutting down your computer', action === 'restart' ? 'Reconnect in a moment when your desktop is ready.' : 'You can safely return to My Computer.', action === 'restart');
  } catch (error) { alert(error.message); }
  finally { powerBusy = false; document.querySelectorAll('[data-power]').forEach(button => { button.disabled = false; }); }
}

$('cad-button').addEventListener('click', () => rfb?.sendCtrlAltDel());
$('mobile-cad').addEventListener('click', () => { rfb?.sendCtrlAltDel(); $('power-menu').hidden = true; });
async function fullscreen() { try { if (document.fullscreenElement) await document.exitFullscreen(); else await frame.requestFullscreen(); } catch { showNotice('Fullscreen is not available in this browser.'); } }
function showNotice(message) { $('desktop-notice').textContent = message; setTimeout(() => { $('desktop-notice').textContent = ''; }, 5000); }
$('fullscreen-button').addEventListener('click', fullscreen); $('mobile-fullscreen').addEventListener('click', fullscreen);
const menu = $('power-menu'), more = $('more-button');
function hideMenu() { menu.hidden = true; more.setAttribute('aria-expanded', 'false'); }
more.addEventListener('click', () => { menu.hidden = !menu.hidden; more.setAttribute('aria-expanded', String(!menu.hidden)); });
menu.addEventListener('click', event => { const button = event.target.closest('[data-power]'); if (button) { hideMenu(); power(button.dataset.power); } });
document.addEventListener('click', event => { if (!menu.contains(event.target) && !more.contains(event.target)) hideMenu(); });
document.addEventListener('keydown', event => { if (event.key === 'Escape') hideMenu(); });
const clipboard = $('clipboard-dialog'), clipboardText = $('clipboard-text');
function openClipboard() { hideMenu(); clipboard.returnValue = ''; clipboard.showModal(); }
$('clipboard-button').addEventListener('click', openClipboard); $('mobile-clipboard').addEventListener('click', openClipboard);
clipboard.addEventListener('close', () => { if (clipboard.returnValue === 'send' && connected) rfb?.clipboardPasteFrom(clipboardText.value); clipboardText.value = ''; if (connected) rfb?.focus(); });
const keyboard = $('mobile-keyboard');
const sentinel = '\u200b';
function resetKeyboard() { keyboard.value = sentinel; keyboard.setSelectionRange(1, 1); }
function sendText(value) { for (const ch of value) { const cp = ch.codePointAt(0); rfb?.sendKey(cp === 10 ? 0xff0d : cp > 255 ? 0x01000000 | cp : cp); } }
$('keyboard-button').addEventListener('click', () => { resetKeyboard(); keyboard.focus({ preventScroll: true }); });
keyboard.addEventListener('beforeinput', event => {
  if (!connected || event.isComposing) return;
  if (event.inputType === 'deleteContentBackward' || event.inputType === 'deleteContentForward') {
    event.preventDefault(); rfb.sendKey(event.inputType === 'deleteContentBackward' ? 0xff08 : 0xffff); resetKeyboard();
  } else if (event.inputType === 'insertLineBreak' || event.inputType === 'insertParagraph') { event.preventDefault(); rfb.sendKey(0xff0d); resetKeyboard(); }
});
keyboard.addEventListener('input', event => { if (!connected || event.isComposing) return; sendText(keyboard.value.replaceAll(sentinel, '')); resetKeyboard(); });
keyboard.addEventListener('compositionend', () => { if (connected) sendText(keyboard.value.replaceAll(sentinel, '')); resetKeyboard(); });
$('mobile-enter').addEventListener('click', () => rfb?.sendKey(0xff0d));
$('mobile-escape').addEventListener('click', () => rfb?.sendKey(0xff1b));
$('retry-button').addEventListener('click', () => { reconnectAttempts = 0; connect(); });
window.addEventListener('pagehide', () => { disposed = true; closeConnection(); });
window.addEventListener('pageshow', event => { if (event.persisted) { disposed = false; reconnectAttempts = 0; connect(); } });
window.addEventListener('offline', () => { closeConnection(); connectionState('Offline', 'disconnected'); showCover('You are offline', 'Check your internet connection, then reconnect.', true); });
connect();
