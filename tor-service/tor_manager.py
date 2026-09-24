#!/usr/bin/env python3
"""
Mitch.pro Dedicated Tor Process Manager & Onion Browser Gateway
Provides isolated per-user Tor processes with unique circuits/IPs,
and proxies .onion / dark web traffic.
"""

import os
import sys
import time
import socket
import asyncio
import hashlib
import logging
import urllib.parse
from typing import Dict, Optional, Tuple
import subprocess

from aiohttp import web, ClientSession, ClientTimeout
import aiohttp_socks
import httpx
from httpx_socks import AsyncProxyTransport
from bs4 import BeautifulSoup

logging.basicConfig(level=logging.INFO, format='[%(asctime)s] [%(levelname)s] %(message)s')
logger = logging.getLogger("tor_manager")

TOR_INTERFACE = os.environ.get("TOR_INTERFACE", "eth1")
TOR_OUTBOUND_BIND_IP = os.environ.get("TOR_OUTBOUND_BIND_IP", "")
PORT = int(os.environ.get("PORT", "6840"))
TOR_BASE_DIR = "/var/lib/tor_users"

os.makedirs(TOR_BASE_DIR, exist_ok=True)

# Port allocation ranges
BASE_SOCKS_PORT = 9100
BASE_CONTROL_PORT = 19100
MAX_USER_INSTANCES = 500

# Search Engines & Well-Known Darknet Sites
ONION_DREAD = "http://dreadytofatroptsdj6io7l3xptbet6onoyno2yv7jicoxknyazubrad.onion/"
ONION_AHMIA_SEARCH = "http://juhanurmihxlp77nkq76byazcldy2hlmovfu2epvl5ankdibsot4csyd.onion/search/?q="
ONION_TORCH_SEARCH = "http://xmh57jrknzkhv6y3ls3ubitzfqnkrwxhopf5aygthi7d6rfdvdmeny.onion/sub/search.php?q="
ONION_DUCKDUCKGO = "http://duckduckgogg42xjoc72x3sjasowoarfbgcmvfimaftt6twagswzczad.onion"

TOR_USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; rv:128.0) Gecko/20100101 Firefox/128.0"


class UserTorInstance:
    def __init__(self, user_id: str, socks_port: int, control_port: int, proc: subprocess.Popen):
        self.user_id = user_id
        self.socks_port = socks_port
        self.control_port = control_port
        self.proc = proc
        self.created_at = time.time()
        self.last_used = time.time()
        self.bootstrapped = False


class TorProcessPool:
    def __init__(self):
        self.instances: Dict[str, UserTorInstance] = {}
        self.used_ports = set()
        self.lock = asyncio.Lock()

    def _get_free_port_pair(self) -> Tuple[int, int]:
        for i in range(MAX_USER_INSTANCES):
            socks = BASE_SOCKS_PORT + (i * 2)
            ctrl = BASE_CONTROL_PORT + (i * 2)
            if socks not in self.used_ports and ctrl not in self.used_ports:
                # Double check socket availability on host
                with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                    if s.connect_ex(('127.0.0.1', socks)) != 0:
                        self.used_ports.add(socks)
                        self.used_ports.add(ctrl)
                        return socks, ctrl
        raise RuntimeError("No available Tor port pairs in pool")

    def _release_ports(self, socks_port: int, control_port: int):
        self.used_ports.discard(socks_port)
        self.used_ports.discard(control_port)

    async def get_instance(self, user_id: str) -> UserTorInstance:
        async with self.lock:
            safe_id = hashlib.sha256(user_id.encode('utf-8')).hexdigest()[:16]
            inst = self.instances.get(safe_id)

            if inst:
                if inst.proc.poll() is None:
                    inst.last_used = time.time()
                    return inst
                else:
                    logger.warning(f"Tor process for user {safe_id} died. Restarting...")
                    self._release_ports(inst.socks_port, inst.control_port)
                    del self.instances[safe_id]

            # Spawn new dedicated Tor instance for this user
            socks_port, control_port = self._get_free_port_pair()
            user_data_dir = os.path.join(TOR_BASE_DIR, f"user_{safe_id}")
            os.makedirs(user_data_dir, exist_ok=True)

            torrc_path = os.path.join(user_data_dir, "torrc")
            tor_log = os.path.join(user_data_dir, "tor.log")
            torrc_lines = [
                f"DataDirectory {user_data_dir}",
                f"SocksPort 127.0.0.1:{socks_port}",
                f"ControlPort 127.0.0.1:{control_port}",
                "CookieAuthentication 0",
                "ClientUseIPv6 0",
                "ClientPreferIPv6ORPort 0",
                f"Log notice file {tor_log}",
            ]

            if TOR_OUTBOUND_BIND_IP:
                torrc_lines.append(f"OutboundBindAddress {TOR_OUTBOUND_BIND_IP}")

            with open(torrc_path, "w") as f:
                f.write("\n".join(torrc_lines) + "\n")

            logger.info(f"Spawning Tor instance for user {safe_id} on SOCKS port {socks_port}")
            proc = subprocess.Popen(
                ["tor", "-f", torrc_path],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL
            )

            inst = UserTorInstance(safe_id, socks_port, control_port, proc)
            self.instances[safe_id] = inst

            # Wait for SOCKS port and bootstrap
            ready = False
            for _ in range(60):  # up to 30 seconds
                await asyncio.sleep(0.5)
                if proc.poll() is not None:
                    logger.error(f"Tor process for user {safe_id} exited immediately with code {proc.returncode}")
                    break
                try:
                    reader, writer = await asyncio.open_connection('127.0.0.1', control_port)
                    writer.write(b'AUTHENTICATE ""\r\nGETINFO status/bootstrap-phase\r\nQUIT\r\n')
                    await writer.drain()
                    data = await reader.read(512)
                    writer.close()
                    await writer.wait_closed()
                    if b"PROGRESS=100" in data:
                        ready = True
                        break
                except Exception:
                    pass
                try:
                    reader, writer = await asyncio.open_connection('127.0.0.1', socks_port)
                    writer.close()
                    await writer.wait_closed()
                    ready = True
                except Exception:
                    pass

            if not ready:
                logger.error(f"Tor instance for user {safe_id} failed to bind SOCKS port {socks_port}")
            else:
                inst.bootstrapped = True
                logger.info(f"Tor instance for user {safe_id} is READY on SOCKS port {socks_port}")

            return inst

    async def new_identity(self, user_id: str) -> bool:
        safe_id = hashlib.sha256(user_id.encode('utf-8')).hexdigest()[:16]
        inst = self.instances.get(safe_id)
        if not inst or inst.proc.poll() is not None:
            return False

        try:
            reader, writer = await asyncio.open_connection('127.0.0.1', inst.control_port)
            writer.write(b'AUTHENTICATE ""\r\nSIGNAL NEWNYM\r\nQUIT\r\n')
            await writer.drain()
            writer.close()
            await writer.wait_closed()
            inst.last_used = time.time()
            logger.info(f"Sent SIGNAL NEWNYM to Tor instance for user {safe_id}")
            return True
        except Exception as e:
            logger.warning(f"Failed to send NEWNYM to user {safe_id}: {e}")
            return False

    async def reap_idle(self, idle_seconds: int = 1800):
        while True:
            await asyncio.sleep(60)
            now = time.time()
            async with self.lock:
                to_delete = []
                for user_id, inst in self.instances.items():
                    if now - inst.last_used > idle_seconds or inst.proc.poll() is not None:
                        logger.info(f"Reaping inactive Tor instance for user {user_id}")
                        try:
                            inst.proc.terminate()
                            inst.proc.wait(timeout=2)
                        except Exception:
                            try:
                                inst.proc.kill()
                            except Exception:
                                pass
                        self._release_ports(inst.socks_port, inst.control_port)
                        to_delete.append(user_id)

                for uid in to_delete:
                    del self.instances[uid]


pool = TorProcessPool()


def get_user_id(request: web.Request) -> str:
    # Check headers / cookies / query
    uid = (
        request.headers.get("X-Tor-User")
        or request.cookies.get("studentId")
        or request.cookies.get("id")
        or request.cookies.get("tor_session")
        or request.query.get("user")
        or request.remote
        or "anonymous_user"
    )
    return uid.strip()


def normalize_target_url(raw_url: str) -> str:
    target = raw_url.strip().strip('"').strip("'")
    if not target:
        return ONION_AHMIA_SEARCH

    # Check for shortcuts
    if target.lower() == "dread":
        return ONION_DREAD
    if target.lower() in ("ahmia", "search"):
        return ONION_AHMIA_SEARCH
    if target.lower() == "torch":
        return "http://xmh57jrknzkhv6y3ls3ubitzfqnkrwxhopf5aygthi7d6rfdvdmeny.onion/"
    if target.lower() == "duckduckgo":
        return ONION_DUCKDUCKGO

    # If already a valid URL
    if target.startswith("http://") or target.startswith("https://"):
        target_res = target
    elif ".onion" in target:
        target_res = f"http://{target}"
    elif "." in target and not " " in target and not target.endswith("."):
        target_res = f"http://{target}"
    else:
        return f"{ONION_AHMIA_SEARCH}{urllib.parse.quote_plus(target)}"

    parsed = urllib.parse.urlparse(target_res)
    if not parsed.path:
        target_res = f"{target_res}/"
    return target_res


def rewrite_html_content(html: str, base_url: str, user_id: str) -> str:
    try:
        soup = BeautifulSoup(html, "html.parser")
    except Exception:
        return html

    parsed_base = urllib.parse.urlparse(base_url)

    # Rewrite <a> links
    for a in soup.find_all("a", href=True):
        href = a["href"].strip()
        if href.startswith("javascript:") or href.startswith("mailto:") or href.startswith("#"):
            continue
        full_url = urllib.parse.urljoin(base_url, href)
        a["href"] = f"/tor/view?url={urllib.parse.quote(full_url)}"

    # Rewrite <form> actions
    for form in soup.find_all("form"):
        action = form.get("action", "")
        full_action = urllib.parse.urljoin(base_url, action) if action else base_url
        form["action"] = "/api/tor/browse"
        # Insert hidden input with target url
        target_input = soup.new_tag("input", type="hidden", attrs={"name": "__tor_target", "value": full_action})
        form.append(target_input)

    # Rewrite subresources: <img>, <script>, <link rel="stylesheet">
    for img in soup.find_all("img", src=True):
        src = img["src"].strip()
        if not src.startswith("data:"):
            full_src = urllib.parse.urljoin(base_url, src)
            img["src"] = f"/api/tor/resource?url={urllib.parse.quote(full_src)}"

    for script in soup.find_all("script", src=True):
        src = script["src"].strip()
        if not src.startswith("data:"):
            full_src = urllib.parse.urljoin(base_url, src)
            script["src"] = f"/api/tor/resource?url={urllib.parse.quote(full_src)}"

    for link in soup.find_all("link", href=True):
        rel = link.get("rel", [])
        if any(r in rel for r in ["stylesheet", "icon", "shortcut icon", "apple-touch-icon"]):
            href = link["href"].strip()
            if not href.startswith("data:"):
                full_href = urllib.parse.urljoin(base_url, href)
                link["href"] = f"/api/tor/resource?url={urllib.parse.quote(full_href)}"

    # Add a base tag if none exists
    if not soup.find("base"):
        head = soup.find("head")
        if head:
            base_tag = soup.new_tag("base", href=base_url)
            head.insert(0, base_tag)

    return str(soup)


async def browse_handler(request: web.Request) -> web.Response:
    try:
        user_id = get_user_id(request)

        if request.method == "POST":
            post_data = await request.post()
            target_url = post_data.get("__tor_target") or post_data.get("url") or request.query.get("url", "")
        else:
            target_url = request.query.get("url", "")

        if not target_url:
            return web.json_response({"ok": False, "error": "Missing URL parameter"}, status=400)

        target_url = normalize_target_url(target_url)
        parsed_target = urllib.parse.urlparse(target_url)

        try:
            inst = await pool.get_instance(user_id)
        except Exception as e:
            logger.error(f"Failed to get Tor instance: {e}")
            return web.Response(
                text=f"<h3>Error initializing Tor circuit</h3><p>{str(e)}</p>",
                content_type="text/html",
                status=502
            )

        transport = AsyncProxyTransport.from_url(f"socks5://127.0.0.1:{inst.socks_port}", rdns=True, verify=False)
        timeout = httpx.Timeout(60.0, connect=30.0)

        headers = {
            "Host": parsed_target.netloc,
            "User-Agent": TOR_USER_AGENT,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.5",
            "Accept-Encoding": "gzip, deflate, br",
        }

        try:
            async with httpx.AsyncClient(transport=transport, timeout=timeout, http2=True, verify=False) as client:
                if request.method == "POST":
                    form_data = {k: v for k, v in (await request.post()).items() if k != "__tor_target"}
                    resp = await client.post(target_url, headers=headers, data=form_data, follow_redirects=True)
                else:
                    resp = await client.get(target_url, headers=headers, follow_redirects=True)

                status = resp.status_code
                content_type = resp.headers.get("content-type", "text/html")
                body = resp.content
                final_url = str(resp.url)

                # Check if HTML
                if "text/html" in content_type.lower():
                    try:
                        encoding = resp.encoding or "utf-8"
                        html_text = body.decode(encoding, errors="replace")
                        rewritten = rewrite_html_content(html_text, final_url, user_id)
                        body = rewritten.encode("utf-8")
                        content_type = "text/html; charset=utf-8"
                    except Exception as e:
                        logger.warning(f"HTML rewrite error for {final_url}: {e}")

                resp_headers = {
                    "Content-Type": content_type,
                    "X-Tor-User": inst.user_id,
                    "X-Tor-Socks-Port": str(inst.socks_port),
                    "Access-Control-Allow-Origin": "*",
                }

                return web.Response(body=body, status=status, headers=resp_headers)

        except (httpx.TimeoutException, asyncio.TimeoutError):
            return web.Response(
                text=f"""<div style="font-family:system-ui,sans-serif;background:#0d1117;color:#f85149;padding:32px;text-align:center;">
                    <h2>🧅 Tor Connection Timed Out</h2>
                    <p style="color:#8b949e;">The .onion service at <code>{target_url}</code> took too long to respond. The site may be offline, under heavy load, or its Tor descriptor might be propagating.</p>
                    <button onclick="window.location.reload()" style="background:#238636;color:#fff;border:none;padding:10px 20px;border-radius:6px;cursor:pointer;font-weight:600;margin-top:16px;">Try Again</button>
                </div>""",
                content_type="text/html",
                status=504
            )
        except Exception as e:
            logger.error(f"Tor browse error for {target_url}: {e}")
            return web.Response(
                text=f"""<div style="font-family:system-ui,sans-serif;background:#0d1117;color:#f85149;padding:32px;text-align:center;">
                    <h2>🧅 Tor Routing Error</h2>
                    <p style="color:#8b949e;">Could not reach <code>{target_url}</code>: {str(e)}</p>
                </div>""",
                content_type="text/html",
                status=502
            )
    except Exception as e:
        logger.error(f"Unhandled error in browse_handler: {e}")
        return web.Response(
            text=f"""<div style="font-family:system-ui,sans-serif;background:#0d1117;color:#f85149;padding:32px;text-align:center;">
                <h2>🧅 Tor Gateway Error</h2>
                <p style="color:#8b949e;">{str(e)}</p>
            </div>""",
            content_type="text/html",
            status=500
        )


async def resource_handler(request: web.Request) -> web.Response:
    try:
        user_id = get_user_id(request)
        raw_url = request.query.get("url", "")
        if not raw_url:
            return web.Response(status=404)

        target_url = normalize_target_url(raw_url)
        parsed_target = urllib.parse.urlparse(target_url)

        inst = await pool.get_instance(user_id)
        transport = AsyncProxyTransport.from_url(f"socks5://127.0.0.1:{inst.socks_port}", rdns=True, verify=False)
        timeout = httpx.Timeout(45.0, connect=20.0)

        headers = {
            "Host": parsed_target.netloc,
            "User-Agent": TOR_USER_AGENT,
        }

        async with httpx.AsyncClient(transport=transport, timeout=timeout, http2=True, verify=False) as client:
            resp = await client.get(target_url, headers=headers, follow_redirects=True)
            body = resp.content
            content_type = resp.headers.get("content-type", "application/octet-stream")
            return web.Response(
                body=body,
                status=resp.status_code,
                headers={
                    "Content-Type": content_type,
                    "Cache-Control": "public, max-age=3600",
                    "Access-Control-Allow-Origin": "*"
                }
            )
    except Exception as e:
        logger.debug(f"Resource fetch failed: {e}")
        return web.Response(status=502)


async def status_handler(request: web.Request) -> web.Response:
    user_id = get_user_id(request)
    try:
        inst = await pool.get_instance(user_id)
        log_lines = []
        tor_log_path = os.path.join(TOR_BASE_DIR, f"user_{inst.user_id}", "tor.log")
        if os.path.exists(tor_log_path):
            try:
                with open(tor_log_path, "r", errors="ignore") as f:
                    log_lines = [line.strip() for line in f.readlines()[-40:]]
            except Exception:
                pass
        return web.json_response({
            "ok": True,
            "user_id": inst.user_id,
            "socks_port": inst.socks_port,
            "control_port": inst.control_port,
            "bootstrapped": inst.bootstrapped,
            "interface": TOR_INTERFACE,
            "outbound_bind_ip": TOR_OUTBOUND_BIND_IP or "default",
            "active_tor_processes": len(pool.instances),
            "uptime_seconds": int(time.time() - inst.created_at),
            "tor_log": log_lines
        })
    except Exception as e:
        return web.json_response({"ok": False, "error": str(e)}, status=500)


async def new_identity_handler(request: web.Request) -> web.Response:
    user_id = get_user_id(request)
    success = await pool.new_identity(user_id)
    return web.json_response({
        "ok": success,
        "message": "New Tor identity and circuit requested" if success else "Failed to rotate Tor circuit"
    })


def create_app() -> web.Application:
    app = web.Application()
    for route in ["/api/tor/status", "/api/tor/status/"]:
        app.router.add_get(route, status_handler)
    for route in ["/api/tor/session", "/api/tor/session/"]:
        app.router.add_get(route, status_handler)
        app.router.add_post(route, status_handler)
    for route in ["/api/tor/new-identity", "/api/tor/new-identity/"]:
        app.router.add_post(route, new_identity_handler)
    for route in ["/api/tor/browse", "/api/tor/browse/"]:
        app.router.add_get(route, browse_handler)
        app.router.add_post(route, browse_handler)
    for route in ["/api/tor/resource", "/api/tor/resource/"]:
        app.router.add_get(route, resource_handler)

    # Health check
    app.router.add_get("/healthz", lambda _: web.Response(text="OK"))

    return app


async def main():
    asyncio.create_task(pool.reap_idle())
    app = create_app()
    runner = web.AppRunner(app)
    await runner.setup()
    site = web.TCPSite(runner, "0.0.0.0", PORT)
    logger.info(f"Tor Gateway Service listening on 0.0.0.0:{PORT}")
    await site.start()
    while True:
        await asyncio.sleep(3600)


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        pass
