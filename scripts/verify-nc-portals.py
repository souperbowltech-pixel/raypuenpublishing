"""Verify actual local NC pages, playback and supplied QR SVG renderings."""
import argparse
import json
from pathlib import Path
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright, expect


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base-url", default="http://localhost:3000")
    parser.add_argument("--output", required=True)
    parser.add_argument("--qr-folder")
    parser.add_argument("--layout-only", action="store_true")
    args = parser.parse_args()
    assert urlparse(args.base_url).hostname in {"localhost", "127.0.0.1"}
    out = Path(args.output).resolve()
    out.mkdir(parents=True, exist_ok=True)
    report = {"checks": [], "pageErrors": [], "productionVerified": False}

    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True, args=["--disable-gpu"])
        context = browser.new_context(viewport={"width": 1280, "height": 900}, locale="en-US")
        page = context.new_page()
        page.on("pageerror", lambda error: report["pageErrors"].append(str(error)))
        try:
            slugs = ["welcome", "video-1", "video-2", "video-3", "video-4", "bring-two-friends", "join"]
            for slug in slugs if not args.layout_only else ["video-2"]:
                response = page.goto(args.base_url + "/nc/" + slug, wait_until="domcontentloaded", timeout=60000)
                assert response.status == 200, (slug, response.status)
                expect(page.get_by_role("heading", level=1)).to_be_visible()
                is_video = slug not in ["bring-two-friends", "join"]
                assert page.locator("iframe").count() == int(is_video)
                result = {"slug": slug, "status": response.status, "result": "passed"}
                if is_video and not args.layout_only:
                    frame = page.frame_locator("iframe")
                    button = frame.locator("button.ytmCuedOverlayPlayButton,button.ytp-large-play-button").first
                    expect(button).to_be_visible(timeout=30000)
                    gestures = 0
                    for attempt in range(2):
                        if attempt == 0 or button.is_visible():
                            button.click(timeout=15000)
                            gestures += 1
                        video = frame.locator("video").first
                        expect(video).to_be_attached(timeout=30000)
                        for _ in range(90):
                            state = video.evaluate("v=>({time:v.currentTime,paused:v.paused,ready:v.readyState})")
                            if state["time"] > 0.5 and not state["paused"]:
                                break
                            page.wait_for_timeout(500)
                        if state["time"] > 0.5 and not state["paused"]:
                            break
                        # Allow slow media buffering. Retry a visible play control
                        # once, record the gesture, and never fake playback state.
                    assert state["time"] > 0.5 and not state["paused"], (slug, state)
                    result["playback"] = state
                    result["playGestures"] = gestures
                    video.evaluate("v=>v.pause()")
                if slug == "join":
                    expect(page.get_by_text("Club registration and referral rewards are not open yet.", exact=False)).to_be_visible()
                page.screenshot(path=str(out / f"{slug}.png"))
                report["checks"].append(result)
                print("PASS: NC route", slug, flush=True)

            for width in [320, 375, 768, 1280]:
                page.set_viewport_size({"width": width, "height": 900})
                page.goto(args.base_url + "/nc/video-2", wait_until="domcontentloaded")
                assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth"), width
                box = page.locator("iframe").bounding_box()
                assert box["height"] >= 200 and box["width"] >= 200, box
                report["checks"].append({"width": width, "noOverflow": True, "player": box})
                page.screenshot(path=str(out / f"layout-{width}.png"))
            page.set_viewport_size({"width": 768, "height": 900})
            page.evaluate("document.documentElement.style.fontSize='200%'")
            assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth")
            report["checks"].append({"width": 768, "textSize": "200%", "noOverflow": True})
            page.screenshot(path=str(out / "text-200-percent.png"))
            if not args.layout_only:
                response = page.goto(args.base_url + "/nc/not-a-book-page", wait_until="domcontentloaded")
                assert response.status == 404
                report["checks"].append({"unknownRoute": 404})
                if args.qr_folder:
                    qr = Path(args.qr_folder).resolve()
                    manifest = json.loads((qr / "manifest.json").read_text())
                    for entry in manifest["entries"]:
                        name = "NC_" + entry["key"] + "_PRINT.svg"
                        page.goto((qr / name).as_uri(), wait_until="domcontentloaded")
                        page.locator("svg").screenshot(path=str(out / (name + ".png")))
                    report["svgFilesRendered"] = len(manifest["entries"])
            report["result"] = "passed"
        except Exception as error:
            report["result"] = "failed"
            report["error"] = str(error)
            page.screenshot(path=str(out / "failure.png"))
            raise
        finally:
            context.close()
            browser.close()
            (out / "nc-browser-verification.json").write_text(json.dumps(report, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()
