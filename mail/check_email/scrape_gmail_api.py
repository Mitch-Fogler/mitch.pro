#!/usr/bin/env python3

import subprocess
import requests
import json
import base64
import re
import sys
import time

# LDPlayer ADB target — change to <WINDOWS_IP>:5554 if running this from Linux
ADB_TARGET = "mitch-desk:5555"
TOKEN_FILE = "token.json"
BASE = "https://gmail.googleapis.com/gmail/v1/users/me"

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
            data = json.load(f)
        if time.time() < data.get("expires_at", 0):
            return data["token"]
    except Exception:
        pass
    print("Fetching fresh token via ADB...")
    token = fetch_token_via_adb()
    with open(TOKEN_FILE, "w") as f:
        json.dump({"token": token, "expires_at": time.time() + 55 * 60}, f)
    print(f"Token cached ({token[:20]}...)")
    return token

def invalidate_token():
    try:
        with open(TOKEN_FILE) as f:
            data = json.load(f)
        data["expires_at"] = 0
        with open(TOKEN_FILE, "w") as f:
            json.dump(data, f)
    except Exception:
        pass

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

def main():
    headers = {"Authorization": f"Bearer {load_token()}"}

    r = requests.get(f"{BASE}/messages", headers=headers, params={"maxResults": 50, "labelIds": "INBOX"})
    if not r.ok:
        print(f"Request failed ({r.status_code}), invalidating token and retrying...")
        invalidate_token()
        headers = {"Authorization": f"Bearer {load_token()}"}
        r = requests.get(f"{BASE}/messages", headers=headers, params={"maxResults": 50, "labelIds": "INBOX"})
    r.raise_for_status()
    messages = r.json().get("messages", [])
    print(f"Fetching {len(messages)} emails...")

    emails = []
    for i, msg in enumerate(messages):
        r = requests.get(f"{BASE}/messages/{msg['id']}", headers=headers, params={"format": "full"})
        if not r.ok:
            invalidate_token()
            raise RuntimeError(f"Request failed ({r.status_code}) mid-scrape, will retry next run")
        m = r.json()
        hdrs = {h["name"]: h["value"] for h in m["payload"]["headers"]}
        body = get_body(m["payload"]).strip()
        emails.append({
            "sender":    hdrs.get("From", ""),
            "subject":   hdrs.get("Subject", ""),
            "date":      hdrs.get("Date", ""),
            "body":      body,
            "messageId": hdrs.get("Message-ID", "").strip("<>"),
            "inReplyTo": hdrs.get("In-Reply-To", "").strip("<>"),
            "threadId":  m.get("threadId", ""),
        })
        print(f"  [{i+1}] {emails[-1]['subject'][:70]}")

    with open("emails.json", "w", encoding="utf-8") as f:
        json.dump(emails, f, indent=2, ensure_ascii=False)
    print(f"\nSaved {len(emails)} emails to emails.json")

main()
