#!/usr/bin/env python3
# Usage: python3 send_gmail.py <to> <subject> <body>
# Sends email from mitchell.fogler@student.rjuhsd.us via Gmail web UI.

import sys, asyncio, os
from playwright.async_api import async_playwright

BASE = os.path.dirname(os.path.abspath(__file__))

async def send_gmail(to, subject, body):
    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True,
            args=["--disable-blink-features=AutomationControlled"]
        )
        ctx = await browser.new_context(storage_state=os.path.join(BASE, "google_auth.json"))
        page = await ctx.new_page()

        await page.goto("https://mail.google.com/mail/u/0/#inbox")
        await page.wait_for_selector("div[gh='cm'], .T-I.T-I-KE", timeout=15000)

        # Click Compose
        compose_btn = await page.query_selector("div[gh='cm']") or \
                      await page.query_selector(".T-I.T-I-KE")
        await compose_btn.click()

        # Wait for compose window
        await page.wait_for_selector("div[name='to']", timeout=10000)

        # To
        to_field = await page.query_selector("div[name='to']")
        await to_field.click()
        await to_field.type(to)
        await page.keyboard.press("Tab")

        # Subject
        subj_field = await page.query_selector("input[name='subjectbox']")
        await subj_field.click()
        await subj_field.fill(subject)

        # Body
        body_field = await page.query_selector("div[role='textbox'][aria-label='Message Body']")
        await body_field.click()
        await body_field.type(body)

        # Send (Ctrl+Enter)
        await page.keyboard.press("Control+Enter")
        await page.wait_for_timeout(2500)
        await browser.close()
        print(f"Sent to {to}")

if __name__ == "__main__":
    if len(sys.argv) < 4:
        print("Usage: send_gmail.py <to> <subject> <body>")
        sys.exit(1)
    asyncio.run(send_gmail(sys.argv[1], sys.argv[2], sys.argv[3]))
