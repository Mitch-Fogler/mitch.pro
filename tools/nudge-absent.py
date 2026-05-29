#!/usr/bin/env python3
"""Send a check-in email to enrolled users who haven't visited in a while.

Usage:
  ./nudge-absent.py          — default: absent > 7 days
  ./nudge-absent.py 14       — absent > 14 days
  ./nudge-absent.py --dry    — print recipients, don't send
"""
import calendar, json, os, subprocess, sys, threading, time

BASE           = os.path.dirname(os.path.abspath(__file__))
LOG_FILE       = os.path.join(BASE, 'old', 'evil_log.json')
NAMES_FILE     = os.path.join(BASE, 'old', 'evil_names.json')
TOKENS_FILE    = os.path.join(BASE, 'data', 'tokens.json')
NOREPLY_SCRIPT = os.path.join(BASE, 'mail', 'noreply_send.js')
SEND_SCRIPT    = os.path.join(BASE, 'mail', 'send_email.js')

SUBJECT = "Haven't seen you on mitch.pro"
BODY = """\
Hey,

We noticed you haven't stopped by mitch.pro in a while, just wanted to make sure everything's good and you haven't lost access.

If you have any issues logging in, you can appeal at mitch.pro/appeal.html or email support@mitch.pro.

Otherwise, come check out what's new, there have been a few additions lately.

, mitch.pro"""

def email_script(to):
    domain = to.split('@')[-1].lower() if '@' in to else ''
    return SEND_SCRIPT if domain == 'student.rjuhsd.us' else NOREPLY_SCRIPT

args = sys.argv[1:]
dry  = '--dry' in args
days = 7
for a in args:
    if a.isdigit():
        days = int(a)

try:
    logs = json.load(open(LOG_FILE))
except Exception as e:
    print(f'Cannot read {LOG_FILE}: {e}'); raise SystemExit(1)

try:
    names = json.load(open(NAMES_FILE))
except Exception:
    names = {}

try:
    tokens = json.load(open(TOKENS_FILE))
except Exception:
    tokens = {}

# latest visit ts per email
latest_by_email = {}
latest_uid = {}
for entry in logs:
    uid    = str(entry.get('id', ''))
    ts_str = entry.get('timestamp', '')
    if not uid or not ts_str:
        continue
    try:
        ts = calendar.timegm(time.strptime(ts_str, '%Y-%m-%dT%H:%M:%SZ'))
    except ValueError:
        continue
    if uid not in latest_uid or ts > latest_uid[uid]:
        latest_uid[uid] = ts

for uid, ts in latest_uid.items():
    label = names.get(uid, '')
    if '@' in label:
        lower = label.lower()
        if lower not in latest_by_email or ts > latest_by_email[lower]:
            latest_by_email[lower] = ts

# find claimed tokens
threshold = time.time() - days * 86400
targets = []
for tok, d in tokens.items():
    if not (d.get('claimed_domains') or d.get('used')):
        continue
    email = d.get('email', '').strip()
    if not email:
        continue
    last = latest_by_email.get(email.lower())
    if last is None or last < threshold:
        label = f'{int((time.time()-last)/86400)}d ago' if last else 'never visited'
        targets.append((email, label))

targets.sort(key=lambda x: x[1])

if not targets:
    print(f'No enrolled users absent > {days} days. Nothing to send.')
    raise SystemExit(0)

print(f'{"DRY RUN, " if dry else ""}Sending to {len(targets)} user(s) absent > {days} days:')
for email, label in targets:
    print(f'  {email}  ({label})')

if dry:
    raise SystemExit(0)

print()
results = {}
lock = threading.Lock()

def send_one(email, label):
    result = subprocess.run(
        ['node', email_script(email), email, SUBJECT, BODY],
        capture_output=True, text=True, timeout=30
    )
    ok  = result.returncode == 0
    msg = (result.stderr.strip() or result.stdout.strip())[:80]
    with lock:
        results[email] = ok
        print(f'  {"✓" if ok else "✗"} {email}' + (f': {msg}' if not ok else ''))

threads = [threading.Thread(target=send_one, args=(e, l)) for e, l in targets]
for t in threads: t.start()
for t in threads: t.join()

ok  = sum(results.values())
print(f'\nDone: {ok} sent, {len(results)-ok} failed.')
