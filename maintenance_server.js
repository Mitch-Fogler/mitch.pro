#!/usr/bin/env bun
import { join } from 'path';
import { readFileSync, existsSync } from 'fs';
import { spawnSync } from 'child_process';

const BASE = import.meta.dir;
const PASSPHRASE_FILE = join(BASE, 'data', 'admin_passphrase.json');
const PORT = 6800;

function loadJson(file, fallback) {
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function getMaintenanceHtml() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>mitch.pro — Scheduled Maintenance</title>
  <link rel="icon" type="image/png" href="/favicon.ico">
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;600;800&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg-color: #0b0f19;
      --accent-color: #3b82f6;
      --accent-glow: rgba(59, 130, 246, 0.4);
      --glass-bg: rgba(17, 24, 39, 0.7);
      --glass-border: rgba(255, 255, 255, 0.08);
      --text-main: #f3f4f6;
      --text-muted: #9ca3af;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: 'Plus Jakarta Sans', sans-serif;
      background: radial-gradient(circle at 50% 50%, #111827 0%, #030712 100%);
      color: var(--text-main);
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      position: relative;
    }
    body::before {
      content: '';
      position: absolute;
      width: 400px;
      height: 400px;
      background: var(--accent-color);
      filter: blur(150px);
      opacity: 0.15;
      top: 10%;
      left: 15%;
      border-radius: 50%;
      pointer-events: none;
    }
    body::after {
      content: '';
      position: absolute;
      width: 300px;
      height: 300px;
      background: #8b5cf6;
      filter: blur(150px);
      opacity: 0.1;
      bottom: 10%;
      right: 15%;
      border-radius: 50%;
      pointer-events: none;
    }
    .container {
      width: 90%;
      max-width: 520px;
      background: var(--glass-bg);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border: 1px solid var(--glass-border);
      border-radius: 24px;
      padding: 40px 30px;
      text-align: center;
      box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5);
      z-index: 10;
      animation: fadeInUp 0.8s ease-out;
    }
    @keyframes fadeInUp {
      from {
        opacity: 0;
        transform: translateY(20px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
    .icon-container {
      width: 80px;
      height: 80px;
      background: rgba(239, 68, 68, 0.1);
      border: 1px solid rgba(239, 68, 68, 0.2);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 24px;
      box-shadow: 0 0 20px rgba(239, 68, 68, 0.1);
      animation: pulse 2s infinite alternate;
    }
    @keyframes pulse {
      0% { transform: scale(1); box-shadow: 0 0 20px rgba(239, 68, 68, 0.1); }
      100% { transform: scale(1.05); box-shadow: 0 0 30px rgba(239, 68, 68, 0.3); }
    }
    .icon {
      font-size: 32px;
      color: #ef4444;
    }
    h1 {
      font-size: 28px;
      font-weight: 800;
      letter-spacing: -0.02em;
      margin-bottom: 12px;
      background: linear-gradient(135deg, #ffffff 0%, #cbd5e1 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    p {
      color: var(--text-muted);
      font-size: 15px;
      line-height: 1.6;
      margin-bottom: 30px;
    }
    .tag {
      display: inline-flex;
      align-items: center;
      background: rgba(239, 68, 68, 0.1);
      border: 1px solid rgba(239, 68, 68, 0.2);
      border-radius: 100px;
      padding: 6px 16px;
      font-size: 12px;
      font-weight: 600;
      color: #ef4444;
      margin-bottom: 20px;
      letter-spacing: 0.05em;
      text-transform: uppercase;
    }
    .tag-dot {
      width: 6px;
      height: 6px;
      background: #ef4444;
      border-radius: 50%;
      margin-right: 8px;
      box-shadow: 0 0 8px #ef4444;
      animation: blink 1.5s infinite;
    }
    @keyframes blink {
      0%, 100% { opacity: 0.4; }
      50% { opacity: 1; }
    }
    .footer {
      margin-top: 30px;
      font-size: 11px;
      color: rgba(255, 255, 255, 0.3);
      letter-spacing: 0.02em;
    }
    .portal-trigger {
      cursor: pointer;
      transition: color 0.2s;
    }
    .portal-trigger:hover {
      color: var(--text-muted);
    }
    /* Hidden Portal Styles */
    .portal-modal {
      display: none;
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(3, 7, 18, 0.85);
      backdrop-filter: blur(10px);
      z-index: 100;
      align-items: center;
      justify-content: center;
    }
    .modal-content {
      background: var(--glass-bg);
      border: 1px solid var(--glass-border);
      border-radius: 20px;
      width: 90%;
      max-width: 380px;
      padding: 30px;
      text-align: center;
    }
    .modal-content h3 {
      font-size: 18px;
      font-weight: 600;
      margin-bottom: 15px;
    }
    .modal-content input {
      width: 100%;
      background: rgba(0, 0, 0, 0.3);
      border: 1px solid var(--glass-border);
      border-radius: 8px;
      padding: 10px 12px;
      color: #fff;
      font-family: inherit;
      font-size: 14px;
      margin-bottom: 15px;
      outline: none;
      text-align: center;
    }
    .modal-content input:focus {
      border-color: var(--accent-color);
    }
    .modal-content button {
      background: var(--accent-color);
      color: #fff;
      border: none;
      border-radius: 8px;
      padding: 10px 20px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      width: 100%;
    }
    .modal-content button:hover {
      background: #2563eb;
    }
    .close-modal {
      margin-top: 10px;
      font-size: 12px;
      color: var(--text-muted);
      cursor: pointer;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="tag">
      <div class="tag-dot"></div>
      System Offline
    </div>
    <div class="icon-container">
      <span class="icon">🚨</span>
    </div>
    <h1>System Maintenance</h1>
    <p>mitch.pro is currently undergoing scheduled hardware or software maintenance. Please check back later.</p>
    <div class="footer">
      &copy; 2026 mitch.pro. All rights reserved. &bull; <span class="portal-trigger" onclick="showPortal()">Admin Portal</span>
    </div>
  </div>

  <div class="portal-modal" id="portalModal">
    <div class="modal-content">
      <h3>System Restoration</h3>
      <input type="password" id="restorePass" placeholder="Enter Admin Passphrase">
      <button onclick="restoreSystem()">Start System</button>
      <div class="close-modal" onclick="hidePortal()">Cancel</div>
    </div>
  </div>

  <script>
    function showPortal() {
      document.getElementById('portalModal').style.display = 'flex';
    }
    function hidePortal() {
      document.getElementById('portalModal').style.display = 'none';
    }
    async function restoreSystem() {
      const pass = document.getElementById('restorePass').value;
      if (!pass) return;
      try {
        const resp = await fetch('/api/restore-server', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ passphrase: pass })
        });
        const data = await resp.json();
        if (data.success) {
          alert('System start initiated. Reloading page...');
          setTimeout(() => location.reload(), 3000);
        } else {
          alert('Invalid passphrase.');
        }
      } catch (e) {
        alert('Restoration endpoint offline or failed.');
      }
    }
  </script>
</body>
</html>`;
}

Bun.serve({
  port: PORT,
  hostname: '0.0.0.0',
  async fetch(req) {
    const url = new URL(req.url);
    const path = url.pathname;

    if (path === '/api/restore-server' && req.method === 'POST') {
      try {
        const body = await req.json();
        const passphrase = body.passphrase || '';
        const config = loadJson(PASSPHRASE_FILE, {});
        let isValid = false;
        if (config.hash) {
          // Backward compatibility
          isValid = await Bun.password.verify(passphrase, config.hash);
        } else {
          for (const userConfig of Object.values(config)) {
            if (userConfig && userConfig.hash) {
              if (await Bun.password.verify(passphrase, userConfig.hash)) {
                isValid = true;
                break;
              }
            }
          }
        }
        if (!isValid) {
          return new Response(JSON.stringify({ success: false, error: 'invalid_passphrase' }), {
            headers: { 'Content-Type': 'application/json' },
            status: 401
          });
        }

        console.log('[maintenance] Restoration passphrase valid. Restarting bun.service...');
        setTimeout(() => {
          console.log('[maintenance] Launching bun.service...');
          spawnSync('systemctl', ['--user', 'start', 'bun']);
          console.log('[maintenance] Exiting maintenance server.');
          process.exit(0);
        }, 100);

        return new Response(JSON.stringify({ success: true }), {
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (e) {
        return new Response(JSON.stringify({ success: false, error: e.message }), {
          headers: { 'Content-Type': 'application/json' },
          status: 500
        });
      }
    }

    if (path.startsWith('/api/')) {
      return new Response(JSON.stringify({
        error: 'maintenance',
        message: 'System is currently undergoing offline maintenance.'
      }), {
        headers: { 'Content-Type': 'application/json' },
        status: 503
      });
    }

    return new Response(getMaintenanceHtml(), {
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    });
  }
});

console.log(`[maintenance] Standalone server active on http://0.0.0.0:${PORT}`);
