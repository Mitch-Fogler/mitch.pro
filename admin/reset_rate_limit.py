#!/usr/bin/env python3
"""Reset rate limits for enroll and newsletter endpoints."""
import os, sys, urllib.request, urllib.parse, json

BASE    = os.path.dirname(os.path.abspath(__file__))
KEY     = open(os.path.join(BASE, 'admin.key')).read().strip()
PORT    = 6800
ENDPOINTS = '/api/request-access,/api/newsletter-signup'

url = f'http://127.0.0.1:{PORT}/api/admin/reset-ratelimit?key={urllib.parse.quote(KEY)}&endpoints={urllib.parse.quote(ENDPOINTS)}'
try:
    with urllib.request.urlopen(url, timeout=5) as r:
        data = json.loads(r.read())
    print(f"Cleared {data['cleared']} rate-limit bucket(s) for: {', '.join(data['endpoints'])}")
except Exception as e:
    print(f'Error: {e}', file=sys.stderr)
    sys.exit(1)
