#!/usr/bin/env python3
"""
Add fake play counts to a game in evil_log.json.

Usage:
  ./add_plays.py <game_path> <count>

Examples:
  ./add_plays.py many/slope/ 500
  ./add_plays.py chess-bot/ 100
  ./add_plays.py "https://kartbros.io/" 200
"""

import sys, os, json, random, string
from datetime import datetime, timedelta, timezone

BASE       = os.path.dirname(os.path.abspath(__file__))
LOG_FILE   = os.path.join(BASE, 'old', 'evil_log.json')
BASE_URL   = 'https://mitch.pro'
GAMES_BASE = '/games/'

def rand_id():
    h = '0123456789abcdef'
    return ''.join(random.choices(h, k=25)) + '.' + ''.join(random.choices(h, k=16))

def rand_ip():
    return '.'.join(str(random.randint(1, 254)) for _ in range(4))

def rand_ts(days_back=90):
    delta = timedelta(seconds=random.randint(0, days_back * 86400))
    dt = datetime.now(timezone.utc) - delta
    return dt.strftime('%Y-%m-%dT%H:%M:%SZ')

def main():
    if len(sys.argv) < 3 or sys.argv[1] in ('-h', '--help'):
        print(__doc__)
        sys.exit(0 if '--help' in sys.argv else 1)

    game_path = sys.argv[1]
    try:
        count = int(sys.argv[2])
    except ValueError:
        print(f'Error: count must be an integer, got {sys.argv[2]!r}')
        sys.exit(1)

    # Build full page URL
    if game_path.startswith('http'):
        page = game_path
    elif game_path.startswith('/games/'):
        page = BASE_URL + game_path
    else:
        page = BASE_URL + GAMES_BASE + game_path.lstrip('/')

    try:
        logs = json.load(open(LOG_FILE))
    except (FileNotFoundError, json.JSONDecodeError):
        logs = []

    new_entries = [
        {'id': rand_id(), 'ip': rand_ip(), 'page': page, 'timestamp': rand_ts()}
        for _ in range(count)
    ]
    logs.extend(new_entries)

    with open(LOG_FILE, 'w') as f:
        json.dump(logs, f)

    print(f'Added {count} plays to {page}')

if __name__ == '__main__':
    main()
