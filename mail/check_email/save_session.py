#!/usr/bin/env python3

from playwright.sync_api import sync_playwright
from playwright_stealth import Stealth

PROFILE_DIR = "./gmail_profile"

with Stealth().use_sync(sync_playwright()) as p:
    ctx = p.chromium.launch_persistent_context(
        user_data_dir=PROFILE_DIR,
        headless=False,
        args=["--disable-blink-features=AutomationControlled"]
    )
    page = ctx.new_page()
    page.goto("https://mail.google.com")
    input("Sign in to Gmail, then press Enter here...")
    print("Visiting contacts to capture those cookies too...")
    page.goto("https://contacts.google.com/directory")
    print("Contacts URL:", page.url)
    input("Make sure the contacts directory loaded, then press Enter...")
    ctx.close()
    print(f"Profile saved to {PROFILE_DIR}")
