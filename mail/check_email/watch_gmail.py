#!/usr/bin/env python3

import json
import asyncio
from datetime import datetime
from playwright.async_api import async_playwright
from playwright_stealth import Stealth

POLL_INTERVAL = 5  # seconds between inbox checks

def get_urls_js(limit=None):
    slice_call = f".slice(0, {limit})" if limit else ""
    return f"""
        () => [...document.querySelectorAll('tr.zA')]{slice_call}
            .map(row => {{
                const jslog = row.getAttribute('jslog') || '';
                const match = jslog.match(/1:([A-Za-z0-9+\\/]+)/);
                if (!match) return null;
                try {{
                    let b64 = match[1];
                    while (b64.length % 4) b64 += '=';
                    const data = JSON.parse(atob(b64));
                    const threadId = (data[0] || '').replace('#', '');
                    return threadId ? `https://mail.google.com/mail/u/0/#inbox/${{threadId}}` : null;
                }} catch(e) {{ return null; }}
            }})
            .filter(Boolean)
    """

async def scrape_thread(ctx, url):
    page = await ctx.new_page()
    try:
        await page.goto(url)
        await page.wait_for_selector("div.a3s, h2.hP", timeout=15000)

        subject_el = await page.query_selector("h2.hP")
        subject = (await subject_el.inner_text()).strip() if subject_el else \
                  (await page.title()).replace(" - Gmail", "").strip()

        sender_el = await page.query_selector("span[email]")
        sender_name = (await sender_el.inner_text()).strip() if sender_el else ""
        sender_email = (await sender_el.get_attribute("email") or "").strip() if sender_el else ""

        date_el = await page.query_selector("span.g3")
        date = ""
        if date_el:
            date = (await date_el.get_attribute("title") or await date_el.inner_text() or "").strip()

        body_els = await page.query_selector_all("div.a3s")
        body = (await body_els[-1].inner_text()).strip() if body_els else ""

        return {"sender": f"{sender_name} <{sender_email}>", "subject": subject, "date": date, "body": body}
    except Exception:
        return None
    finally:
        await page.close()

async def main():
    async with Stealth().use_async(async_playwright()) as p:
        ctx = await p.chromium.launch_persistent_context(
            user_data_dir="./gmail_profile",
            headless=True,
            args=["--disable-blink-features=AutomationControlled"]
        )
        inbox = await ctx.new_page()

        print("Loading inbox...")
        await inbox.goto("https://mail.google.com/mail/u/0/#inbox", wait_until="networkidle")
        await inbox.wait_for_selector("tr.zA", timeout=30000)

        seen = set(await inbox.evaluate(get_urls_js()))
        print(f"Watching inbox ({len(seen)} existing emails). Checking every {POLL_INTERVAL}s...\n")

        while True:
            await asyncio.sleep(POLL_INTERVAL)

            await inbox.goto("https://mail.google.com/mail/u/0/#inbox", wait_until="networkidle")
            await inbox.wait_for_selector("tr.zA", timeout=30000)

            current_urls = await inbox.evaluate(get_urls_js())
            new_urls = [u for u in current_urls if u not in seen]

            if new_urls:
                print(f"[{datetime.now().strftime('%H:%M:%S')}] {len(new_urls)} new email(s)! Fetching 5 newest...")
                seen.update(new_urls)

                top5 = await inbox.evaluate(get_urls_js(limit=5))
                results = await asyncio.gather(*[scrape_thread(ctx, url) for url in top5])
                emails = [r for r in results if r is not None]

                timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                filename = f"new_emails_{timestamp}.json"
                with open(filename, "w", encoding="utf-8") as f:
                    json.dump(emails, f, indent=2, ensure_ascii=False)

                for e in emails:
                    print(f"  - {e['sender']} | {e['subject']}")
                print(f"  Saved to {filename}\n")

asyncio.run(main())
