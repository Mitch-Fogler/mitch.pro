#!/usr/bin/env python3
"""Send a newsletter to all enrolled mitch.88chan.me users.
Usage:
  ./newsletter.py <subject> <body>
  ./newsletter.py <subject>         (reads body from stdin)
  ./newsletter.py -h <hours> <subject> <body>   (spread send over N hours, background)
  ./newsletter.py -h <hours> <subject>          (reads body from stdin)
  ./newsletter.py -a <email>        (add email to manual list)
  ./newsletter.py -r <email>        (remove email from manual list)
  ./newsletter.py -u <email>        (unsubscribe email)
  ./newsletter.py -l                (list all recipients)
"""
import json, os, subprocess, sys, time, threading

BASE          = os.path.dirname(os.path.abspath(__file__))
LOGS_DIR      = os.path.join(BASE, 'logs', 'newsletter_logs')
TOKENS_FILE   = os.path.join(BASE, 'data', 'tokens.json')
EXTRA_FILE    = os.path.join(BASE, 'data', 'newsletter_extra.json')
UNSUB_FILE    = os.path.join(BASE, 'data', 'newsletter_unsub.json')
SEND_SCRIPT    = os.path.join(BASE, 'mail', 'send_email.js')
NOREPLY_SCRIPT = os.path.join(BASE, 'mail', 'noreply_send.js')

def _email_script(to):
    domain = to.split('@')[-1].lower() if '@' in to else ''
    return SEND_SCRIPT if domain == 'student.rjuhsd.us' else NOREPLY_SCRIPT

def load_extra():
    try: return json.load(open(EXTRA_FILE))
    except: return []

def save_extra(lst):
    with open(EXTRA_FILE, 'w') as f: json.dump(sorted(set(lst)), f, indent=2)

def load_unsub():
    try: return {e.lower() for e in json.load(open(UNSUB_FILE))}
    except: return set()

def save_unsub(s):
    with open(UNSUB_FILE, 'w') as f: json.dump(sorted(s), f, indent=2)

def get_all_emails():
    unsub = load_unsub()
    emails = {e for e in load_extra() if e.lower() not in unsub}
    try:
        tokens = json.load(open(TOKENS_FILE))
        for data in tokens.values():
            email = data.get('email', '').strip()
            if email and email.lower() not in unsub:
                emails.add(email)
    except Exception as e:
        print(f'Warning: could not read tokens.json: {e}', file=sys.stderr)
    # Deduplicate case-insensitively, keeping the first seen form
    seen = {}
    for e in sorted(emails):
        seen.setdefault(e.lower(), e)
    return sorted(seen.values())

UNSUB_FOOTER = ''  # footer is now appended by the send scripts

def has_profanity(email):
    try:
        bad = json.load(open(os.path.join(BASE, 'data', 'bad_words.json')))
        local = email.split('@')[0].lower()
        return any(w.lower() in local for w in bad)
    except Exception:
        return False

def load_doppler_env():
    os.environ['DOPPLER_ENABLE_DNS_RESOLVER'] = 'true'
    if 'NOREPLY_USER' in os.environ or 'SUPPORT_USER' in os.environ:
        return
    try:
        res = subprocess.run(['doppler', 'secrets', 'download', '--format', 'json'], capture_output=True, text=True, timeout=5)
        if res.returncode == 0 and res.stdout:
            secrets = json.loads(res.stdout)
            for k, v in secrets.items():
                if k not in os.environ:
                    os.environ[k] = str(v)
            return
    except Exception:
        pass
    try:
        res = subprocess.run(['sudo', '-n', 'doppler', 'secrets', 'download', '--format', 'json'], capture_output=True, text=True, timeout=5)
        if res.returncode == 0 and res.stdout:
            secrets = json.loads(res.stdout)
            for k, v in secrets.items():
                if k not in os.environ:
                    os.environ[k] = str(v)
            return
    except Exception:
        pass
    env_file = os.path.join(BASE, '.env')
    if os.path.isfile(env_file):
        try:
            with open(env_file, 'r') as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith('#') and '=' in line:
                        k, v = line.split('=', 1)
                        k = k.replace('export ', '').strip()
                        v = v.strip(' "\'')
                        if k not in os.environ:
                            os.environ[k] = v
        except Exception:
            pass

def send(to, subject, body):
    if has_profanity(to):
        return True, 'silently dropped (profanity)'
    load_doppler_env()
    runner = 'bun' if os.path.exists('/usr/bin/bun') or subprocess.run(['which', 'bun'], capture_output=True).returncode == 0 else 'node'
    result = subprocess.run(
        [runner, _email_script(to), to, subject, body + UNSUB_FOOTER],
        capture_output=True, text=True, timeout=20, env=os.environ
    )
    return result.returncode == 0, result.stderr.strip() or result.stdout.strip()

class _Tee:
    def __init__(self, *streams): self.streams = streams
    def write(self, data):
        for s in self.streams: s.write(data)
    def flush(self):
        for s in self.streams: s.flush()

def main():
    args = sys.argv[1:]

    if not args:
        print(__doc__.strip())
        sys.exit(1)

    if args[0] == '-a':
        if len(args) < 2:
            print('Usage: ./newsletter.py -a <email>', file=sys.stderr)
            sys.exit(1)
        email = args[1].strip().lower()
        extra = load_extra()
        if email in extra:
            print(f'{email} is already in the manual list.')
        else:
            extra.append(email)
            save_extra(extra)
            print(f'Added {email} to manual list ({len(extra)} total).')
            ok, msg = send(email, 'Welcome to the mitch.pro newsletter',
                'You\'ve been signed up for the mitch.pro newsletter.')
            print(f'  {"✓" if ok else "✗"} Welcome email {"sent" if ok else "failed: " + msg}')
        return

    if args[0] == '-r':
        if len(args) < 2:
            print('Usage: ./newsletter.py -r <email>', file=sys.stderr)
            sys.exit(1)
        email = args[1].strip().lower()
        extra = load_extra()
        if email not in extra:
            print(f'{email} not in manual list.')
        else:
            extra.remove(email)
            save_extra(extra)
            print(f'Removed {email} from manual list.')
        return

    if args[0] == '-u':
        if len(args) < 2:
            print('Usage: ./newsletter.py -u <email>', file=sys.stderr)
            sys.exit(1)
        email = args[1].strip().lower()
        unsub = load_unsub()
        if email in unsub:
            print(f'{email} is already unsubscribed.')
        else:
            unsub.add(email)
            save_unsub(unsub)
            print(f'Unsubscribed {email}.')
        return

    if args[0] == '-l':
        emails = get_all_emails()
        extra = set(load_extra())
        print(f'{len(emails)} recipient(s):')
        for e in emails:
            tag = ' [manual]' if e in extra else ''
            print(f'  {e}{tag}')
        return

    if args[0] == '-h':
        if len(args) < 3:
            print('Usage: ./newsletter.py -h <hours> <subject> [body]', file=sys.stderr)
            sys.exit(1)
        try:
            hours = float(args[1])
        except ValueError:
            print('Error: hours must be a number', file=sys.stderr)
            sys.exit(1)
        subject = args[2]
        body = args[3] if len(args) >= 4 else None
        if body is None:
            print('Reading body from stdin (Ctrl+D when done):')
            body = sys.stdin.read().strip()
            if not body:
                print('Empty body, aborting.', file=sys.stderr)
                sys.exit(1)

        emails = get_all_emails()
        if not emails:
            print('No recipients found.')
            sys.exit(0)

        delay = (hours * 3600) / len(emails)
        os.makedirs(LOGS_DIR, exist_ok=True)
        log_name = time.strftime('%Y-%m-%d_%H-%M-%S') + '_background.log'
        log_path = os.path.join(LOGS_DIR, log_name)
        print(f'Queuing {len(emails)} recipients over {hours}h ({delay:.0f}s between each). Log: {log_path}')

        pid = os.fork()
        if pid > 0:
            sys.exit(0)

        # child: detach from terminal, log only to file
        os.setsid()
        with open('/dev/null', 'rb') as dn: os.dup2(dn.fileno(), sys.stdin.fileno())
        with open('/dev/null', 'wb') as dn:
            os.dup2(dn.fileno(), sys.stdout.fileno())
            os.dup2(dn.fileno(), sys.stderr.fileno())

        log_file = open(log_path, 'w', buffering=1)
        def log(msg):
            log_file.write(f'[{time.strftime("%Y-%m-%d %H:%M:%S")}] {msg}\n')
            log_file.flush()

        log(f'Background send started: {len(emails)} recipients over {hours}h ({delay:.0f}s/email)')
        log(f'Subject: {subject}')
        for i, email in enumerate(emails):
            if i > 0:
                time.sleep(delay)
            ok, msg = send(email, subject, body)
            log(f'{"✓" if ok else "✗"} {email}' + (f': {msg}' if not ok else ''))
        log('Done.')
        log_file.close()
        sys.exit(0)

    subject = args[0]
    body = args[1] if len(args) >= 2 else None

    if body is None:
        print('Reading body from stdin (Ctrl+D when done):')
        body = sys.stdin.read().strip()
        if not body:
            print('Empty body, aborting.', file=sys.stderr)
            sys.exit(1)

    emails = get_all_emails()
    if not emails:
        print('No recipients found.')
        sys.exit(0)

    os.makedirs(LOGS_DIR, exist_ok=True)
    log_name = time.strftime('%Y-%m-%d_%H-%M-%S') + '.log'
    log_path = os.path.join(LOGS_DIR, log_name)
    log_file = open(log_path, 'w', buffering=1)
    sys.stdout = _Tee(sys.__stdout__, log_file)
    sys.stderr = _Tee(sys.__stderr__, log_file)
    print(f'Log: {log_path}')
    print(f'Sending to {len(emails)} recipient(s):')
    for e in emails:
        print(f'  {e}')
    print(f'Subject: {subject}')
    print()

    results = {}
    lock = threading.Lock()
    sem = threading.Semaphore(5)

    def send_one(email):
        with sem:
            time.sleep(0.5)
            success, msg = send(email, subject, body)
        with lock:
            results[email] = (success, msg)
            if success:
                print(f'  ✓ {email}')
            else:
                print(f'  ✗ {email}: {msg}')

    threads = [threading.Thread(target=send_one, args=(e,)) for e in emails]
    for t in threads: t.start()
    for t in threads: t.join()

    ok_count  = sum(1 for s, _ in results.values() if s)
    fail_count = sum(1 for s, _ in results.values() if not s)
    print(f'\nDone: {ok_count} sent, {fail_count} failed.')

if __name__ == '__main__':
    main()
