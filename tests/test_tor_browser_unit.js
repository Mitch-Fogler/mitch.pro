import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const compose = readFileSync('docker-compose.yml', 'utf8');
const entrypoint = readFileSync('tor-service/entrypoint.sh', 'utf8');
const torManager = readFileSync('tor-service/tor_manager.py', 'utf8');
const torHtml = readFileSync('webserver/tor/index.html', 'utf8');
const torRoute = readFileSync('rust/crates/mitch-server/src/routes/tor.rs', 'utf8');
const handler = readFileSync('rust/crates/mitch-server/src/handler.rs', 'utf8');

// 1. Verify Tor container in docker-compose.yml
assert(compose.includes('tor-browser:'), 'docker-compose.yml must define tor-browser service');
assert(compose.includes('TOR_INTERFACE=${TOR_INTERFACE:-eth1}'), 'docker-compose.yml must default TOR_INTERFACE to eth1');
assert(compose.includes('container_name: mitch-tor-browser'), 'Container must be named mitch-tor-browser');
assert(compose.includes('cap_add:\n      - NET_ADMIN'), 'tor-browser container must have NET_ADMIN for interface routing');
assert(compose.includes('TOR_SERVICE_URL=http://tor-browser:6840'), 'Webservers must configure TOR_SERVICE_URL');

// 2. Verify Tor entrypoint routes through eth1 by default
assert(entrypoint.includes('TOR_IFACE="${TOR_INTERFACE:-eth1}"'), 'entrypoint.sh must default TOR_INTERFACE to eth1');
assert(entrypoint.includes('TOR_OUTBOUND_BIND_IP'), 'entrypoint.sh must export TOR_OUTBOUND_BIND_IP for outbound interface routing');
assert(entrypoint.includes('ip link show "${TOR_IFACE}"'), 'entrypoint.sh must verify interface exists');

// 3. Verify per-user Tor process isolation in tor_manager.py
assert(torManager.includes('class TorProcessPool'), 'tor_manager.py must manage a pool of user processes');
assert(torManager.includes('BASE_SOCKS_PORT'), 'tor_manager.py must assign unique SOCKS ports per user');
assert(torManager.includes('BASE_CONTROL_PORT'), 'tor_manager.py must assign unique Control ports per user');
assert(torManager.includes('DataDirectory'), 'Each user must have an isolated DataDirectory');
assert(torManager.includes('OutboundBindAddress'), 'torrc must support OutboundBindAddress for interface routing');
assert(torManager.includes('dreadytofatroptsdj6io7l3xptbet6onnhkg2wvd7bp5rlxgtioyd.onion'), 'tor_manager.py must configure Dread onion address');
assert(torManager.includes('new_identity'), 'tor_manager.py must support new circuit/identity rotation');
assert(torManager.includes('rewrite_html_content'), 'tor_manager.py must rewrite links and resources for .onion browsing');

// 4. Verify web UI in webserver/tor/index.html
assert(torHtml.includes('dreadytofatroptsdj6io7l3xptbet6onnhkg2wvd7bp5rlxgtioyd.onion'), 'UI must have button/link for Dread');
assert(torHtml.includes('Dread Forum'), 'UI must label Dread button');
assert(torHtml.includes('Ahmia Search'), 'UI must offer Ahmia dark web search');
assert(torHtml.includes('Torch'), 'UI must offer Torch dark web search');
assert(torHtml.includes('Haystak'), 'UI must offer Haystak dark web search');
assert(torHtml.includes('DuckDuckGo Onion'), 'UI must offer DuckDuckGo Onion');
assert(torHtml.includes('id="urlInput"'), 'UI must provide URL / search bar');
assert(torHtml.includes('id="btnNewIdentity"'), 'UI must provide New Identity / Circuit button');
assert(torHtml.includes('browserFrame'), 'UI must display the browsed content');

// 5. Verify Rust server routing
assert(handler.includes('"/tor"'), 'handler.rs HTML_OPEN must include /tor');
assert(handler.includes('"/tor/view"'), 'handler.rs must route /tor/view');
assert(handler.includes('/api/tor/'), 'handler.rs must route /api/tor/');
assert(torRoute.includes('tor_service_url'), 'tor.rs must compute tor_service_url');
assert(torRoute.includes('"tor-browser"') && torRoute.includes('6840'), 'tor.rs must default to tor-browser:6840 in docker');

console.log('ALL TOR BROWSER & ONION GATEWAY UNIT TESTS PASSED SUCCESSFULLY!');
