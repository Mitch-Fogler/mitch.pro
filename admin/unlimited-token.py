#!/usr/bin/env python3
import json, secrets, time, os, sys, re

BASE        = os.path.dirname(os.path.abspath(__file__))
TOKENS_FILE = os.path.join(BASE, 'tokens.json')

default_email = 'admin@mitch.pro'

if len(sys.argv) > 1:
    email = sys.argv[1].strip()
else:
    raw = input(f'Email [{default_email}]: ').strip()
    email = raw if raw else default_email

if not re.match(r'^[^@\s]+@[^@\s]+\.[^@\s]+$', email):
    print('Invalid email.')
    sys.exit(1)

try:
    tokens = json.load(open(TOKENS_FILE))
except:
    tokens = {}

token = secrets.token_hex(24)
tokens[token] = {
    'email':       email,
    'norm_email':  email,
    'gen':         0,
    'created_at':  time.time(),
    'used':        False,
    'infinite':    True,
    'claim_count': 0,
}

tmp = TOKENS_FILE + '.tmp'
with open(tmp, 'w') as f:
    json.dump(tokens, f, indent=2)
os.replace(tmp, TOKENS_FILE)

print(f'Email: {email}')
print('https://mitch.88chan.me/claim.html?token=' + token)
