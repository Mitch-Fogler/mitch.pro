import { resolve, extname, sep } from 'node:path';

const root = resolve(import.meta.dir, '../webserver');
const server = Bun.serve({
  hostname: '127.0.0.1',
  port: Number(process.env.UI_PORT || 4317),
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) return Response.json({ error: 'Local UI preview has no backend', members: [], groups: [], messages: [] }, { status: 401 });
    let pathname;
    try { pathname = decodeURIComponent(url.pathname); } catch { return new Response('Bad path', { status: 400 }); }
    let target = resolve(root, '.' + pathname);
    if (!target.startsWith(root + sep) && target !== root) return new Response('Forbidden', { status: 403 });
    if (!extname(target)) target = resolve(target, 'index.html');
    const file = Bun.file(target);
    if (!(await file.exists())) return new Response('Not found', { status: 404 });
    if (extname(target) !== '.html') return new Response(file);
    let html = await file.text();
    const embedded = pathname.startsWith('/games/') && !['/games/', '/games/index.html'].includes(pathname);
    if (!embedded && !pathname.startsWith('/rjuhsd/') && /<head[\s>]/i.test(html)) {
      let assets = '';
      for (const href of ['/relaunch.css', '/site-galaxy.css', '/portal-redesign.css?v=12']) {
        if (!html.includes(href.split('?')[0])) assets += `<link rel="stylesheet" href="${href}">`;
      }
      if (!html.includes('/app-shell.js')) assets += '<script src="/app-shell.js" defer></script>';
      html = html.replace(/<\/head>/i, assets + '</head>');
    }
    return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
  }
});
console.log(`Local UI preview: ${server.url}`);
