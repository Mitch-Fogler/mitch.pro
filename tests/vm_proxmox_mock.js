import { ProxmoxDesktopService, ProxmoxServiceError } from '../lib/proxmox_desktop.js';

if (process.env.NODE_ENV !== 'test') throw new Error('The Proxmox mock may only run in tests.');

// Loaded explicitly by the integration harness, never by the application.
// Exercise real HTTP/auth/storage handlers without contacting a hypervisor.
ProxmoxDesktopService.prototype.request = async function (method, apiPath) {
  const vmid = Number(apiPath.match(/\/qemu\/(\d+)\//)?.[1]);
  if (vmid === 305) throw new ProxmoxServiceError('UPSTREAM_REJECTED', 'The computer service rejected the request.', 502);
  if (apiPath.endsWith('/status/current')) return {
    status: vmid === 304 ? 'stopped' : 'running', cpus: 4, maxmem: 4 * 1024 ** 3,
    maxdisk: 40 * 1024 ** 3, mem: 1024 ** 3, cpu: 0.1, uptime: 120,
  };
  if (apiPath.endsWith('/agent/network-get-interfaces')) return { result: [{ 'ip-addresses': [{ 'ip-address-type': 'ipv4', 'ip-address': '10.0.0.23' }] }] };
  if (apiPath.endsWith('/agent/get-host-name')) return { result: { 'host-name': 'integration-computer' } };
  if (/\/status\/(start|shutdown|reboot|stop)$/.test(apiPath) && method === 'POST') {
    await Bun.sleep(100);
    return 'UPID:integration-test';
  }
  if (/\/tasks\/[^/]+\/status$/.test(apiPath) && method === 'GET') return { status: 'stopped', exitstatus: 'OK' };
  if (apiPath.endsWith('/vncproxy') && method === 'POST') return { port: 5900, ticket: 'temporary-rfb-test-password' };
  throw new Error(`Unexpected mocked Proxmox request: ${method} ${apiPath}`);
};
