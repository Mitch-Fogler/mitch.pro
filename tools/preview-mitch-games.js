import { resolve, extname, sep } from 'node:path';

const root = resolve(import.meta.dir, '../webserver');
const server = Bun.serve({
  hostname: '127.0.0.1',
  port: Number(process.env.MITCH_GAMES_PREVIEW_PORT || 4318),
  async fetch(request) {
    const url = new URL(request.url);
    let pathname;
    try { pathname = decodeURIComponent(url.pathname); }
    catch { return new Response('Bad path', { status: 400 }); }
    if (pathname === '/') return Response.redirect('/game-portal/', 302);
    let target = resolve(root, '.' + pathname);
    if (target !== root && !target.startsWith(root + sep)) return new Response('Forbidden', { status: 403 });
    if (!extname(target)) target = resolve(target, 'index.html');
    const file = Bun.file(target);
    if (!(await file.exists())) return new Response('Not found', { status: 404 });
    return new Response(file, { headers: { 'Cache-Control': 'no-store' } });
  }
});

console.log(`mitch.games local preview: ${server.url}game-portal/`);
