#!/usr/bin/env python3
"""mitch.pro dashboard — run once or: watch -n 10 ./dashboard.py"""
import json, os, time, collections
from datetime import datetime, timezone, timedelta

BASE = os.path.dirname(os.path.abspath(__file__))

def load(f):
    try: return json.load(open(os.path.join(BASE, f)))
    except: return None

# ── ANSI ──────────────────────────────────────────────────────────────────────
R='\033[0m'; B='\033[1m'; DIM='\033[2m'
CY='\033[96m'; GR='\033[92m'; YL='\033[93m'; RD='\033[91m'; MG='\033[95m'

def hdr(title):
    print(f'\n{B}{CY}── {title} {R}')

def row(label, value, color=GR):
    print(f'  {DIM}{label:<26}{R}{color}{value}{R}')

LA = timezone(timedelta(hours=-7))
now = time.time()

def ago(ts):
    s = now - ts
    if s < 60:   return f'{int(s)}s ago'
    if s < 3600: return f'{int(s/60)}m ago'
    if s < 86400:return f'{int(s/3600)}h ago'
    return f'{int(s/86400)}d ago'

def la(ts):
    return datetime.fromtimestamp(ts, tz=LA).strftime('%m/%d %I:%M %p')

def today_start():
    t = datetime.now(tz=LA).replace(hour=0, minute=0, second=0, microsecond=0)
    return t.timestamp()

# ── Header ────────────────────────────────────────────────────────────────────
print(f'\n{B}{MG}  mitch.pro dashboard{R}  {DIM}{datetime.now(tz=LA).strftime("%a %b %d %I:%M %p")}{R}')
print(f'  {DIM}{"─"*44}{R}')

# ── Active users ──────────────────────────────────────────────────────────────
evil_log = load('evil_log.json') or []
names    = load('evil_names.json') or {}

# latest entry per uid
latest_by_uid = {}
for e in evil_log:
    uid = str(e.get('id',''))
    ts_str = e.get('timestamp','')
    try:
        ts = datetime.fromisoformat(ts_str.replace('Z','+00:00')).timestamp()
    except: continue
    if uid not in latest_by_uid or ts > latest_by_uid[uid][0]:
        latest_by_uid[uid] = (ts, e.get('page',''))

active_5m  = [(uid, ts, pg) for uid,(ts,pg) in latest_by_uid.items() if now-ts < 300]
active_1h  = [(uid, ts, pg) for uid,(ts,pg) in latest_by_uid.items() if now-ts < 3600]
total_seen = len(latest_by_uid)

hdr('Active Users')
row('Online now (5 min)',  f'{len(active_5m)}',  GR if active_5m else DIM)
row('Active last hour',   str(len(active_1h)),   YL)
row('Total unique users', str(total_seen),        CY)

if active_5m:
    print(f'  {B}Now:{R}')
    for uid, ts, pg in sorted(active_5m, key=lambda x: -x[1])[:8]:
        name = names.get(uid, uid[:16])
        page = pg.replace('https://mitch.88chan.me','').replace('https://mitch.pro','') or '/'
        print(f'    {GR}●{R} {B}{name:<20}{R} {DIM}{page[:40]:<40}{R} {DIM}{ago(ts)}{R}')

# ── Signups ───────────────────────────────────────────────────────────────────
tokens = load('tokens.json') or {}
today0 = today_start()
week0  = today0 - 6*86400

signups_today = sum(1 for d in tokens.values() if d.get('created_at',0) >= today0)
signups_week  = sum(1 for d in tokens.values() if d.get('created_at',0) >= week0)
pending       = sum(1 for d in tokens.values() if not d.get('used') and not d.get('claimed_domains') and not d.get('infinite'))
total_tokens  = sum(1 for d in tokens.values() if not d.get('infinite'))

newsletter_extra = load('newsletter_extra.json') or []
newsletter_unsub = load('newsletter_unsub.json') or []
subscribers = total_tokens + len(newsletter_extra)

hdr('Signups & Subscribers')
row('Signups today',       str(signups_today),  GR)
row('Signups this week',   str(signups_week),   YL)
row('Total accounts',      str(total_tokens),   CY)
row('Pending approval',    str(pending),        RD if pending else DIM+'0')
row('Newsletter subs',     str(subscribers),    MG)
row('Unsub requests',      str(len(load('unsubscribe_requests.json') or [])), YL)

# ── Top pages / games ─────────────────────────────────────────────────────────
page_counts = collections.Counter()
for e in evil_log:
    pg = e.get('page','').replace('https://mitch.88chan.me','').replace('https://mitch.pro','')
    if pg: page_counts[pg] += 1

game_counts = collections.Counter()
for pg, cnt in page_counts.items():
    if '/games/' in pg and pg not in ('/games/', '/games/index.html'):
        parts = [p for p in pg.split('/') if p and p not in ('games','many','index.html','index.htm')]
        name = parts[0] if parts else None
        if name: game_counts[name] += cnt

hdr('Top Pages (all time)')
for pg, cnt in page_counts.most_common(6):
    bar = '█' * min(20, int(cnt / max(page_counts.values()) * 20)) if page_counts else ''
    print(f'  {YL}{cnt:>5}{R}  {pg[:45]:<45}  {DIM}{bar}{R}')

if game_counts:
    hdr('Top Games')
    for name, cnt in game_counts.most_common(5):
        print(f'  {YL}{cnt:>5}{R}  {name[:45]}')

# ── Top users ─────────────────────────────────────────────────────────────────
uid_counts = collections.Counter(str(e.get('id','')) for e in evil_log if e.get('id'))
hdr('Most Active Users (all time)')
for uid, cnt in uid_counts.most_common(5):
    name = names.get(uid, uid[:20])
    last = ago(latest_by_uid[uid][0]) if uid in latest_by_uid else '?'
    print(f'  {CY}{cnt:>5}{R}  {B}{name:<24}{R}  {DIM}last seen {last}{R}')

# ── Other ─────────────────────────────────────────────────────────────────────
sugs       = load('suggestions.json') or []
blacklist  = load('blacklist.json') or {}
vpn_ips    = load('known_vpn_ips.json') or []
appeals    = load('appeals.json') or []

hdr('Misc')
row('Suggestions',         str(len(sugs)),        CY)
row('Appeals',             str(len(appeals)),     YL if appeals else DIM+'0')
row('Blacklisted',         str(len(blacklist)),   RD if blacklist else DIM+'0')
row('Known VPN IPs',       str(len(vpn_ips)),     YL)

print()
