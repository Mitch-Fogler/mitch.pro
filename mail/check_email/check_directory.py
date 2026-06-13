#!/usr/bin/env python3

import sys
import json
import os
from playwright.sync_api import sync_playwright
from playwright_stealth import Stealth

PROFILE_DIR = "./gmail_profile"
GOOGLE_EMAIL = "mitchell.fogler@student.rjuhsd.us"

BASE = os.path.dirname(os.path.abspath(__file__))

def load_env():
    # project root is two levels up from check_email
    env_path = os.path.join(os.path.dirname(os.path.dirname(BASE)), '.env')
    if os.path.exists(env_path):
        try:
            with open(env_path, encoding='utf-8') as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith('#') and '=' in line:
                        k, v = line.split('=', 1)
                        v = v.strip().strip("'").strip('"')
                        os.environ[k.strip()] = v
        except Exception:
            pass

load_env()
GOOGLE_PASSWORD = os.environ.get('GOOGLE_PASSWORD', '')
CACHE_FILE = os.path.join(BASE, "directory_cache.json")

def load_cache():
    if os.path.exists(CACHE_FILE):
        try:
            with open(CACHE_FILE, "r") as f:
                return json.load(f)
        except Exception:
            return {}
    return {}

def save_cache(cache):
    with open(CACHE_FILE, "w") as f:
        json.dump(cache, f, indent=2)

def ensure_signed_in(page):
    if "accounts.google.com" not in page.url:
        return

    print("Detected sign-in page, logging in automatically...")

    # Account chooser — click the account if listed
    account = page.query_selector(f'[data-identifier="{GOOGLE_EMAIL}"]') or \
              page.locator(f"text={GOOGLE_EMAIL}").first
    if account:
        account.click()
    else:
        # Account not listed, click "Use another account"
        page.locator("text=Use another account").click()
        page.wait_for_selector('input[type="email"]', timeout=8000)
        page.fill('input[type="email"]', GOOGLE_EMAIL)
        page.click("#identifierNext, [id*='Next']")

    # Enter password
    page.wait_for_selector('input[type="password"]', timeout=8000)
    page.fill('input[type="password"]', GOOGLE_PASSWORD)
    page.click("#passwordNext, [id*='Next']")

    # Wait to land back on contacts
    page.wait_for_url("**/contacts.google.com/**", timeout=15000)
    print("Signed in successfully.")

def check_email(email: str):
    cache = load_cache()
    if email.lower() in cache:
        if cache[email.lower()] == "EXISTS":
            print(f"EXISTS (cached): {email}")
            return True
        # If we wanted to cache NOT FOUND too, we'd check it here.
        # But the request was to "cache successes".

    with Stealth().use_sync(sync_playwright()) as p:
        ctx = p.chromium.launch_persistent_context(
            user_data_dir=PROFILE_DIR,
            headless=True,
            args=["--disable-blink-features=AutomationControlled"]
        )
        page = ctx.new_page()
        page.goto("https://contacts.google.com/directory")
        page.wait_for_load_state("networkidle")

        ensure_signed_in(page)

        page.wait_for_selector('input[type="text"]', timeout=10000)
        page.fill('input[type="text"]', email)
        page.keyboard.press("Enter")
        page.wait_for_timeout(2000)

        results = page.query_selector_all('[data-email]')
        found = any(
            email.lower() in (r.get_attribute("data-email") or "").lower()
            for r in results
        )

        if found:
            print(f"EXISTS: {email}")
            cache[email.lower()] = "EXISTS"
            save_cache(cache)
            ctx.close()
            return True
        else:
            no_results = page.query_selector('[data-no-results]') or \
                         "no results" in (page.inner_text("body") or "").lower()
            if no_results:
                print(f"NOT FOUND: {email}")
            else:
                print(f"NOT FOUND: {email} (or directory not accessible)")

        ctx.close()
        return False

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print(f"Usage: {sys.argv[0]} <email>")
        sys.exit(1)
    check_email(sys.argv[1])
