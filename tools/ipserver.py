#!/usr/bin/env python3
import http.server, ssl, json, os, threading
from urllib.parse import urlparse, parse_qs

PORT    = 6809
CERT    = os.path.expanduser('~/tailscale/fullchain.pem')
KEY     = os.path.expanduser('~/tailscale/privkey.pem')
BASE    = os.path.expanduser('~/tailscale/chatroom/')
IP_FILE = os.path.join(BASE, 'data', 'ip_log.json')
lock    = threading.Lock()

def save_ip(uid, ip):
    with lock:
        try:
            data = json.load(open(IP_FILE))
        except Exception:
            data = {}
        data[str(uid)] = ip
        json.dump(data, open(IP_FILE, 'w'))

class Handler(http.server.BaseHTTPRequestHandler):
    def log_message(self, fmt, *args): pass

    def send_cors(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, OPTIONS')

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_cors()
        self.end_headers()

    def do_GET(self):
        ip  = self.client_address[0]
        qs  = parse_qs(urlparse(self.path).query)
        uid = qs.get('id', [''])[0]
        if uid:
            save_ip(uid, ip)
        body = json.dumps({'ip': ip}).encode()
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(body)))
        self.send_cors()
        self.end_headers()
        self.wfile.write(body)

ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
ctx.load_cert_chain(CERT, KEY)

with http.server.HTTPServer(('0.0.0.0', PORT), Handler) as httpd:
    httpd.socket = ctx.wrap_socket(httpd.socket, server_side=True)
    print(f'IP server listening on :{PORT}')
    httpd.serve_forever()
