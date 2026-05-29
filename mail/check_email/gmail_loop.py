#!/usr/bin/env python3
# Runs scrape_gmail1.py in a loop, waiting between runs.

import subprocess, time, os, sys

BASE             = os.path.dirname(os.path.abspath(__file__))
AUTOREPLY_SCRIPT = os.path.join(BASE, 'gmail_autoreply.py')
PAUSE_FILE       = os.path.join(BASE, 'gmail_paused')
INTERVAL         = 5   # seconds between scrapes
RETRY_INTERVAL   = 30  # seconds to wait after a failed scrape

while True:
    if os.path.exists(PAUSE_FILE):
        print(f"[gmail_loop] Paused. Checking again in 10s...", flush=True)
        time.sleep(10)
        continue
    print(f"[gmail_loop] Starting scrape...", flush=True)
    r = subprocess.run([sys.executable, os.path.join(BASE, "scrape_gmail_api.py")], cwd=BASE)
    if r.returncode != 0:
        print(f"[gmail_loop] scrape failed (exit {r.returncode}), retrying in {RETRY_INTERVAL}s", flush=True)
        time.sleep(RETRY_INTERVAL)
    else:
        print(f"[gmail_loop] Done. Next scrape in {INTERVAL}s.", flush=True)
        time.sleep(INTERVAL)
