"""
scripts/capture_delivery_screenshots.py
Captures desktop (1440x900) and mobile (375x812) visual evidence for client handover.
"""
import os
import asyncio
from playwright.async_api import async_playwright

BASE_URL = os.getenv("APP_URL", "https://puenpublishing.com")
OUT_DIR = os.path.abspath("delivery_screenshots")
os.makedirs(OUT_DIR, exist_ok=True)

TARGETS = [
    {
        "name_prefix": "01_home",
        "url": f"{BASE_URL}/",
        "desktop": True,
        "mobile": True,
    },
    {
        "name_prefix": "02_gamification_book2",
        "url": f"{BASE_URL}/dashboard/book2?demo=1",
        "desktop": True,
        "mobile": True,
    },
    {
        "name_prefix": "03_guide_patrol",
        "url": f"{BASE_URL}/guide",
        "desktop": True,
        "mobile": True,
    },
    {
        "name_prefix": "04_start_registration",
        "url": f"{BASE_URL}/start",
        "desktop": True,
        "mobile": True,
    },
    {
        "name_prefix": "05_institutions_wholesale",
        "url": f"{BASE_URL}/institutions",
        "desktop": True,
        "mobile": True,
    },
    {
        "name_prefix": "06_video_portal",
        "url": f"{BASE_URL}/v1",
        "desktop": True,
        "mobile": True,
    },
    {
        "name_prefix": "07_system_health",
        "url": f"{BASE_URL}/api/health",
        "desktop": True,
        "mobile": False,
    },
]

async def capture_all():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        
        desk_context = await browser.new_context(
            viewport={"width": 1440, "height": 900},
            device_scale_factor=2
        )
        mob_context = await browser.new_context(
            viewport={"width": 375, "height": 812},
            is_mobile=True,
            device_scale_factor=2
        )

        for target in TARGETS:
            prefix = target["name_prefix"]
            url = target["url"]
            print(f"Processing {prefix} -> {url}...")

            if target.get("desktop"):
                page = await desk_context.new_page()
                try:
                    await page.goto(url, wait_until="load", timeout=45000)
                    await page.wait_for_timeout(2000)
                    out_path = os.path.join(OUT_DIR, f"{prefix}_desktop.png")
                    await page.screenshot(path=out_path, full_page=False)
                    print(f"  [Desktop] Saved {out_path}")
                except Exception as e:
                    print(f"  [Desktop] Error on {url}: {e}")
                finally:
                    await page.close()

            if target.get("mobile"):
                mob_page = await mob_context.new_page()
                try:
                    await mob_page.goto(url, wait_until="load", timeout=45000)
                    await mob_page.wait_for_timeout(2000)
                    out_path = os.path.join(OUT_DIR, f"{prefix}_mobile.png")
                    await mob_page.screenshot(path=out_path, full_page=False)
                    print(f"  [Mobile] Saved {out_path}")
                except Exception as e:
                    print(f"  [Mobile] Error on {url}: {e}")
                finally:
                    await mob_page.close()

        await browser.close()
        print(f"\nAll screenshots successfully captured into: {OUT_DIR}")

if __name__ == "__main__":
    asyncio.run(capture_all())
