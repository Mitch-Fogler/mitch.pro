#!/usr/bin/env python3

import json
import asyncio
from playwright.async_api import async_playwright

CONCURRENCY = 10

async def scrape_thread(ctx, url, index, sem):
    async with sem:
        page = await ctx.new_page()
        try:
            await page.goto(url)

            # Wait for the email container rather than a specific element
            await page.wait_for_selector("div.a3s, h2.hP", timeout=15000)

            # Subject: try h2.hP first, fall back to page title
            subject_el = await page.query_selector("h2.hP")
            if subject_el:
                subject = (await subject_el.inner_text()).strip()
            else:
                subject = (await page.title()).replace(" - Gmail", "").strip()

            sender_el = await page.query_selector("span[email]")
            sender_name = (await sender_el.inner_text()).strip() if sender_el else ""
            sender_email = (await sender_el.get_attribute("email") or "").strip() if sender_el else ""

            date_el = await page.query_selector("span.g3")
            date = ""
            if date_el:
                date = (await date_el.get_attribute("title") or await date_el.inner_text() or "").strip()

            body_els = await page.query_selector_all("div.a3s")
            body = (await body_els[-1].inner_text()).strip() if body_els else ""

            print(f"  [{index}] {subject[:70]}")
            return {"sender": f"{sender_name} <{sender_email}>", "subject": subject, "date": date, "body": body}
        except Exception as e:
            print(f"  [{index}] ERROR: {e}")
            return None
        finally:
            await page.close()

async def main():
    async with async_playwright() as p:
        ctx = await p.chromium.launch_persistent_context(
            user_data_dir="./gmail_profile",
            headless=True,
            args=["--disable-blink-features=AutomationControlled"]
        )
        page = await ctx.new_page()

        print("Loading inbox...")
        await page.goto("https://mail.google.com/mail/u/0/#inbox")
        await page.wait_for_selector("tr.zA", timeout=15000)

        urls = await page.evaluate("""
            () => [...document.querySelectorAll('tr.zA')]
                .map(row => {
                    const jslog = row.getAttribute('jslog') || '';
                    const match = jslog.match(/1:([A-Za-z0-9+\\/]+)/);
                    if (!match) return null;
                    try {
                        let b64 = match[1];
                        while (b64.length % 4) b64 += '=';
                        const data = JSON.parse(atob(b64));
                        const threadId = (data[0] || '').replace('#', '');
                        return threadId ? `https://mail.google.com/mail/u/0/#inbox/${threadId}` : null;
                    } catch(e) { return null; }
                })
                .filter(Boolean)
        """)

        await page.close()
        print(f"Found {len(urls)} emails, scraping {CONCURRENCY} at a time...")

        sem = asyncio.Semaphore(CONCURRENCY)
        tasks = [scrape_thread(ctx, url, i + 1, sem) for i, url in enumerate(urls)]
        results = await asyncio.gather(*tasks)
        await ctx.close()

    emails = [r for r in results if r is not None]
    with open("emails.json", "w", encoding="utf-8") as f:
        json.dump(emails, f, indent=2, ensure_ascii=False)
    print(f"\nSaved {len(emails)} emails to emails.json")

asyncio.run(main())
