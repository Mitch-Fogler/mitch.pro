#!/usr/bin/env python3

import subprocess
import requests
import json
import base64
import re
import time
import os
import sys
from datetime import datetime

ADB_TARGET       = "mitch-desk:5555"
TOKEN_FILE       = "token.json"
POLL_INTERVAL    = 2
BASE             = "https://gmail.googleapis.com/gmail/v1/users/me"
SCRIPT_DIR       = os.path.dirname(os.path.abspath(__file__))
EMAILS_FILE      = os.path.join(SCRIPT_DIR, "emails.json")
AUTOREPLY_SCRIPT = os.path.join(SCRIPT_DIR, "gmail_autoreply.py")

# ---------- token ----------

def fetch_token_via_adb():
    subprocess.run(["adb", "-s", ADB_TARGET, "shell", "input swipe 300 250 300 700"])
    time.sleep(2)
    shell_cmd = "su -c 'sqlite3 /data/system_ce/0/accounts_ce.db \"SELECT at.authtoken FROM authtokens at JOIN accounts a ON at.accounts_id = a._id WHERE a.name=\\\"mitchell.fogler@student.rjuhsd.us\\\" AND INSTR(at.type, \\\"gmail.full_access\\\") > 0\"'"
    result = subprocess.run(["adb", "-s", ADB_TARGET, "shell", shell_cmd],
                            capture_output=True, text=True)
    for line in result.stdout.splitlines():
        token = line.strip()
        if token.startswith("ya29"):
            return token
    raise RuntimeError(f"No ya29 token found.\nstdout: {result.stdout[:500]}\nstderr: {result.stderr[:200]}")

def load_token():
    try:
        with open(TOKEN_FILE) as f:
            return json.load(f)["token"]
    except Exception:
        pass
    print("Fetching fresh token via ADB...")
    token = fetch_token_via_adb()
    with open(TOKEN_FILE, "w") as f:
        json.dump({"token": token}, f)
    print(f"Token cached ({token[:20]}...)")
    return token

def invalidate_token():
    try:
        os.remove(TOKEN_FILE)
    except Exception:
        pass

def auth_headers():
    return {"Authorization": f"Bearer {load_token()}"}

# ---------- gmail ----------

def decode_part(part):
    data = part.get("body", {}).get("data", "")
    return base64.urlsafe_b64decode(data).decode("utf-8", errors="replace") if data else ""

def find_part(payload, mime):
    if payload.get("mimeType") == mime:
        text = decode_part(payload)
        return text if text else None
    for part in payload.get("parts", []):
        result = find_part(part, mime)
        if result is not None:
            return result
    return None

def strip_html(html):
    html = re.sub(r'<blockquote[^>]*>.*?</blockquote>', '', html, flags=re.DOTALL | re.IGNORECASE)
    html = re.sub(r'<br\s*/?>', '\n', html, flags=re.IGNORECASE)
    html = re.sub(r'<div[^>]*>', '\n', html, flags=re.IGNORECASE)
    html = re.sub(r'<[^>]+>', '', html)
    html = html.replace('&lt;', '<').replace('&gt;', '>').replace('&amp;', '&') \
               .replace('&nbsp;', ' ').replace('&#39;', "'").replace('&quot;', '"')
    return re.sub(r'\n{3,}', '\n\n', html).strip()

def get_body(payload):
    text = find_part(payload, "text/plain")
    if text:
        return text
    html = find_part(payload, "text/html")
    if html:
        return strip_html(html)
    return ""

def fetch_email(msg_id):
    r = requests.get(f"{BASE}/messages/{msg_id}", headers=auth_headers(), params={"format": "full"})
    r.raise_for_status()
    m = r.json()
    hdrs = {h["name"]: h["value"] for h in m["payload"]["headers"]}
    return {
        "sender":    hdrs.get("From", ""),
        "subject":   hdrs.get("Subject", ""),
        "date":      hdrs.get("Date", ""),
        "body":      get_body(m["payload"]).strip(),
        "to":        hdrs.get("To", ""),
        "messageId": hdrs.get("Message-ID", "").strip("<>"),
        "inReplyTo": hdrs.get("In-Reply-To", "").strip("<>"),
        "threadId":  m.get("threadId", ""),
    }

def get_history(since_id):
    r = requests.get(f"{BASE}/history", headers=auth_headers(), params={
        "startHistoryId": since_id,
        "historyTypes": "messageAdded",
        "labelId": "INBOX",
    })
    if not r.ok:
        invalidate_token()
        return None, None
    data = r.json()
    ids = [
        added["message"]["id"]
        for record in data.get("history", [])
        for added in record.get("messagesAdded", [])
    ]
    return ids, data.get("historyId")

# ---------- main ----------

def main():
    print("Starting Gmail watch daemon (History API)...")

    # Seed the current historyId from the latest message
    r = requests.get(f"{BASE}/messages", headers=auth_headers(),
                     params={"maxResults": 1, "labelIds": "INBOX"})
    r.raise_for_status()
    msgs = r.json().get("messages", [])
    if not msgs:
        raise RuntimeError("No messages found in inbox to seed historyId")

    r = requests.get(f"{BASE}/messages/{msgs[0]['id']}", headers=auth_headers(),
                     params={"format": "minimal"})
    r.raise_for_status()
    history_id = r.json()["historyId"]
    print(f"Watching inbox from historyId={history_id}. Polling every {POLL_INTERVAL}s...\n")

    while True:
        time.sleep(POLL_INTERVAL)
        try:
            msg_ids, new_history_id = get_history(history_id)

            if msg_ids is None:
                # 401 — token was invalidated, retry next tick
                continue

            if new_history_id:
                history_id = new_history_id

            if not msg_ids:
                continue

            ts = datetime.now().strftime("%H:%M:%S")
            print(f"[{ts}] {len(msg_ids)} new email(s)!")

            emails = []
            for msg_id in msg_ids:
                try:
                    email = fetch_email(msg_id)
                    emails.append(email)
                    print(f"  - {email['sender']} | {email['subject']}")
                except Exception as e:
                    print(f"  - Error fetching {msg_id}: {e}")

            filename = f"new_emails_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
            with open(filename, "w", encoding="utf-8") as f:
                json.dump(emails, f, indent=2, ensure_ascii=False)
            print(f"  Saved to {filename}")

            # Merge into emails.json and run autoreply check
            try:
                existing = json.load(open(EMAILS_FILE, encoding="utf-8")) if os.path.exists(EMAILS_FILE) else []
            except Exception:
                existing = []
            existing_keys = {(e.get("sender",""), e.get("subject","")) for e in existing}
            new_only = [e for e in emails if (e.get("sender",""), e.get("subject","")) not in existing_keys]
            if new_only:
                with open(EMAILS_FILE, "w", encoding="utf-8") as f:
                    json.dump(new_only + existing, f, indent=2, ensure_ascii=False)
            print()

        except Exception as e:
            print(f"[{datetime.now().strftime('%H:%M:%S')}] Error: {e}")

main()
