const { chromium } = require('playwright-core');
const { spawn } = require('child_process');
const { join } = require('path');
const fs = require('fs');
const fetch = require('node-fetch');
const http = require('http');
const WebSocket = require('ws');

const PORT = 8081;
const CHROME_PATH = '/usr/bin/chromium';
const SCREEN_WIDTH = 1280;
const SCREEN_HEIGHT = 720;

const userStates = new Map();

function findFreeDisplay() {
    for (let i = 100; i < 200; i++) {
        if (!fs.existsSync(`/tmp/.X${i}-lock`)) return i;
    }
    return Math.floor(Math.random() * 100) + 200;
}

function clampMousePoint(x, y) {
    const safeX = Number.isFinite(Number(x)) ? Number(x) : 0;
    const safeY = Number.isFinite(Number(y)) ? Number(y) : 0;
    return {
        x: Math.max(0, Math.min(SCREEN_WIDTH - 1, Math.round(safeX))),
        y: Math.max(0, Math.min(SCREEN_HEIGHT - 1, Math.round(safeY)))
    };
}

function startCursorMover(display) {
    const mover = spawn('/usr/bin/python3', ['-u', '-c', `
import ctypes
import os
import sys

lib = ctypes.cdll.LoadLibrary("libX11.so.6")
libtest = ctypes.cdll.LoadLibrary("libXtst.so.6")
lib.XOpenDisplay.argtypes = [ctypes.c_char_p]
lib.XOpenDisplay.restype = ctypes.c_void_p
lib.XDefaultRootWindow.argtypes = [ctypes.c_void_p]
lib.XDefaultRootWindow.restype = ctypes.c_ulong
lib.XWarpPointer.argtypes = [ctypes.c_void_p, ctypes.c_ulong, ctypes.c_ulong, ctypes.c_int, ctypes.c_int, ctypes.c_uint, ctypes.c_uint, ctypes.c_int, ctypes.c_int]
lib.XFlush.argtypes = [ctypes.c_void_p]

libtest.XTestFakeButtonEvent.argtypes = [ctypes.c_void_p, ctypes.c_uint, ctypes.c_int, ctypes.c_ulong]
libtest.XTestFakeButtonEvent.restype = ctypes.c_int

name = os.environ.get("DISPLAY")
display = lib.XOpenDisplay(name.encode() if name else None)
if not display:
    sys.stderr.write("[cursor] could not open display\\\\n")
    sys.stderr.flush()
    sys.exit(1)

root = lib.XDefaultRootWindow(display)
last = (-1, -1)
for line in sys.stdin:
    parts = line.strip().split(",")
    if len(parts) < 2:
        continue
    cmd = parts[0]
    if cmd == "move" and len(parts) == 3:
        try:
            x = max(0, min(${SCREEN_WIDTH - 1}, int(round(float(parts[1])))))
            y = max(0, min(${SCREEN_HEIGHT - 1}, int(round(float(parts[2])))))
        except ValueError:
            continue
        if (x, y) == last:
            continue
        lib.XWarpPointer(display, 0, root, 0, 0, 0, 0, x, y)
        lib.XFlush(display)
        last = (x, y)
    elif cmd == "mousedown":
        button = int(parts[1])
        libtest.XTestFakeButtonEvent(display, button, 1, 0)
        lib.XFlush(display)
    elif cmd == "mouseup":
        button = int(parts[1])
        libtest.XTestFakeButtonEvent(display, button, 0, 0)
        lib.XFlush(display)
`], { env: { ...process.env, DISPLAY: display }, stdio: ['pipe', 'ignore', 'pipe'] });

    mover.stderr.on('data', (data) => {
        data.toString().split(/\r?\n/).forEach((line) => {
            const text = line.trim();
            if (text) console.error('[cursor]', text);
        });
    });
    mover.on('exit', (code, signal) => {
        console.error(`[cursor] exited code=${code} signal=${signal || ''}`);
    });
    return mover;
}

const server = http.createServer(async (req, res) => {
    const url = req.url;
    if (url === '/') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(fs.readFileSync(join(__dirname, 'stream_client.html')));
    } else if (url === '/api/sessions') {
        const sessions = [];
        for (const [id, state] of userStates.entries()) {
            sessions.push({ 
                id, 
                display: state.display,
                user: state.email || 'unknown',
                target: state.page ? state.page.url() : 'about:blank',
                bytes: 0
            });
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ sessions }));
    } else if (url === '/jsmpeg.min.js') {
        res.writeHead(200, { 'Content-Type': 'application/javascript' });
        res.end(fs.readFileSync(join(__dirname, 'jsmpeg/jsmpeg.min.js')));
    } else if (url === '/scripts') {
        const scriptsDir = join(__dirname, 'scripts');
        try {
            const files = fs.readdirSync(scriptsDir).filter(f => f.endsWith('.js'));
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ scripts: files }));
        } catch (e) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ scripts: [] }));
        }
    } else if (
        url.startsWith('/bare/') || 
        url.startsWith('/scram/') || 
        url.startsWith('/assets/') || 
        url.startsWith('/baremux/') || 
        url.startsWith('/epoxy/') || 
        url.startsWith('/libcurl/') || 
        url.startsWith('/baremod/') ||
        url.startsWith('/trad/') ||
        url.endsWith('.js') ||
        url.endsWith('.wasm') ||
        url.endsWith('.webp')
    ) {
        // Forward to Scramjet on port 1337
        let targetPath = url;
        if (url.startsWith('/trad/')) {
            targetPath = '/' + url.slice(6);
            if (targetPath === '/') targetPath = '/index.html';
        }
        
        const target = 'http://127.0.0.1:1337' + targetPath;
        try {
            const response = await fetch(target, {
                method: req.method,
                headers: req.headers,
                redirect: 'manual'
            });

            const headers = {};
            response.headers.forEach((v, k) => {
                if (k !== 'content-encoding' && k !== 'transfer-encoding') {
                    headers[k] = v;
                }
            });

            res.writeHead(response.status, headers);
            const buffer = await response.arrayBuffer();
            res.end(Buffer.from(buffer));
        } catch (e) {
            res.writeHead(500);
            res.end('Proxy Error: ' + e.message);
        }
    } else {
        res.writeHead(404);
        res.end();
    }
});

const wss = new WebSocket.Server({ server });

server.on('error', (err) => {
    console.error('[stream] server error:', err);
});

wss.on('connection', async (ws, req) => {
    let email = 'unknown';
    try {
        const parsedUrl = new URL(req.url, 'http://127.0.0.1');
        email = parsedUrl.searchParams.get('email') || 'unknown';
    } catch (e) {}
    const id = Math.random().toString(36).slice(2);
    const displayNum = findFreeDisplay();
    const display = `:${displayNum}`;

    console.log(`[stream] client ${id} connected. using display ${display}`);

    const userDataDir = `/tmp/proxy_profile_${id}`;
    let xvfb, browser, page, ffmpeg, context, mouseMover;

    try {
        // 1. Start private Xvfb
        xvfb = spawn('Xvfb', [display, '-screen', '0', '1280x720x24', '-ac', '+extension', 'GLX', '+render', '-noreset']);

        // Wait for Xvfb to be ready
        await new Promise(r => setTimeout(r, 1500));
        mouseMover = startCursorMover(display);

        // 2. Start FFmpeg capture with low latency tuning.
        ffmpeg = spawn('ffmpeg', [
            '-f', 'x11grab',
            '-draw_mouse', '1',
            '-video_size', '1280x720',
            '-framerate', '25',
            '-i', `${display}.0`,
            '-f', 'mpegts',
            '-codec:v', 'mpeg1video',
            '-s', '1280x720',
            '-b:v', '1500k',
            '-r', '25',
            '-bf', '0',
            '-g', '25',
            '-fflags', 'nobuffer',
            '-probesize', '32',
            '-analyzeduration', '0',
            'pipe:1'
        ], { env: { ...process.env, DISPLAY: display } });

        ffmpeg.stdout.on('data', (data) => {
            if (ws.readyState === WebSocket.OPEN) ws.send(data);
        });
        ffmpeg.stderr.on('data', (data) => {
            data.toString().split(/\r?\n/).forEach((line) => {
                const text = line.trim();
                if (text && !text.startsWith('frame=')) console.error('[ffmpeg]', text);
            });
        });
        ffmpeg.on('exit', (code, signal) => {
            console.error(`[ffmpeg] exited code=${code} signal=${signal || ''}`);
            if (ws.readyState === WebSocket.OPEN) ws.close();
        });


        // 3. Start Browser with Sandboxed Home
        context = await chromium.launchPersistentContext(userDataDir, {            executablePath: CHROME_PATH,
            headless: false,
            viewport: null, // Allow it to fill the window
            permissions: ["clipboard-read", "clipboard-write", "notifications"],
            ignoreDefaultArgs: ["--enable-automation"],
            args: [
                `--display=${display}`,
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--window-size=1280,720',
                '--window-position=0,0',
                '--app=https://www.google.com', // Launches in a minimal window with NO toolbars
                '--force-device-scale-factor=1',
                '--no-first-run',
                '--autoplay-policy=no-user-gesture-required'
            ],
            env: { 
                ...process.env, 
                DISPLAY: display, 
                HOME: '/home/mitch/server/bun/proxy/jail',
                XDG_CONFIG_HOME: '/home/mitch/server/bun/proxy/jail/.config',
                XDG_DATA_HOME: '/home/mitch/server/bun/proxy/jail/.local/share'
            }
        });
browser = context.browser();
page = context.pages()[0] || await context.newPage();
        await page.addInitScript(() => {
            Object.defineProperty(navigator, "webdriver", { get: () => undefined });
        });

await page.goto('https://www.google.com');

        let latestMouse = { x: Math.floor(SCREEN_WIDTH / 2), y: Math.floor(SCREEN_HEIGHT / 2) };
        let pendingMouseMove = null;
        let mouseMoveRunning = false;

        function moveVisibleCursor(point) {
            if (mouseMover?.stdin?.writable) {
                mouseMover.stdin.write(`move,${point.x},${point.y}\n`);
            }
        }

        async function flushMouseMove() {
            if (mouseMoveRunning || !pendingMouseMove) return;
            mouseMoveRunning = true;
            try {
                while (pendingMouseMove) {
                    const point = pendingMouseMove;
                    pendingMouseMove = null;
                    await page.mouse.move(point.x, point.y).catch(() => {});
                }
            } finally {
                mouseMoveRunning = false;
                if (pendingMouseMove) void flushMouseMove();
            }
        }

        async function syncMouseForAction(data = {}) {
            if (data.x !== undefined || data.y !== undefined) {
                latestMouse = clampMousePoint(data.x, data.y);
                pendingMouseMove = latestMouse;
            }
            const point = pendingMouseMove || latestMouse;
            pendingMouseMove = null;
            moveVisibleCursor(point);
            await page.mouse.move(point.x, point.y).catch(() => {});
        }

userStates.set(id, { xvfb, context, page, ffmpeg, display, mouseMover, email });
        ws.on('message', async (message) => {
            try {
                const data = JSON.parse(message);
                if (data.type === 'mousemove') {
                    latestMouse = clampMousePoint(data.x, data.y);
                    pendingMouseMove = latestMouse;
                    moveVisibleCursor(latestMouse);
                    void flushMouseMove();
                }
                else if (data.type === 'mousedown') {
                    await syncMouseForAction(data);
                    if (mouseMover?.stdin?.writable) {
                        mouseMover.stdin.write(`mousedown,1\n`);
                    }
                }
                else if (data.type === 'mouseup') {
                    await syncMouseForAction(data);
                    if (mouseMover?.stdin?.writable) {
                        mouseMover.stdin.write(`mouseup,1\n`);
                    }
                }
                else if (data.type === 'keydown') await page.keyboard.down(data.key);
                else if (data.type === 'keyup') await page.keyboard.up(data.key);
                else if (data.type === 'scroll') await page.mouse.wheel(0, data.deltaY);
                else if (data.type === 'goto') {
                    const url = data.url;
                    if (url.includes('google.com/search?q=')) {
                        try {
                            const q = new URL(url).searchParams.get('q');
                            if (q) {
                                const logPath = join(__dirname, '..', 'data', 'search_intent.json');
                                const logs = fs.existsSync(logPath) ? JSON.parse(fs.readFileSync(logPath, 'utf8')) : [];
                                logs.unshift({ query: q, user: id, ts: Date.now() });
                                fs.writeFileSync(logPath, JSON.stringify(logs.slice(0, 1000), null, 2));
                            }
                        } catch (e) {}
                    }
                    await page.goto(url).catch(() => {});
                }
                else if (data.type === 'back') await page.goBack().catch(() => {});
                else if (data.type === 'forward') await page.goForward().catch(() => {});
                else if (data.type === 'reload') await page.reload().catch(() => {});
                else if (data.type === 'run_script') {
                    const scriptsDir = join(__dirname, 'scripts');
                    const scriptPath = join(scriptsDir, data.name);
                    if (fs.existsSync(scriptPath) && scriptPath.startsWith(scriptsDir)) {
                        const code = fs.readFileSync(scriptPath, 'utf8');
                        await page.evaluate(code).catch(e => console.error('[proxy] script error:', e));
                    }
                }
                else if (data.type === 'clipboard') {
                    if (data.text) {
                        await page.evaluate((t) => {
                            navigator.clipboard.writeText(t).catch(() => {});
                        }, data.text);
                    }
                }
            } catch (e) {}
        });

        ws.on('close', async () => {
            console.log('[stream] client disconnected:', id);
            if (ffmpeg) ffmpeg.kill();
            if (mouseMover) mouseMover.kill();
            if (context) await context.close().catch(() => {});
            if (xvfb) xvfb.kill();
            // Clean up Xvfb locks
            try { 
                fs.unlinkSync(`/tmp/.X${displayNum}-lock`);
                fs.rmSync(`/tmp/.X11-unix/X${displayNum}`, { force: true });
            } catch (e) {}
            try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (e) {}
            userStates.delete(id);
        });

    } catch (e) {
        console.error('[stream] error:', e);
        if (ffmpeg) ffmpeg.kill();
        if (mouseMover) mouseMover.kill();
        if (context) await context.close().catch(() => {});
        if (xvfb) xvfb.kill();
        ws.close();
    }
});

server.listen(PORT, '127.0.0.1', () => {
    console.log(`[stream] mitch.prox running on http://localhost:${PORT}`);
});
