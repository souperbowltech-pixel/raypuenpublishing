"""NC server-rendered browser acceptance without external media playback."""
import argparse
import json
from pathlib import Path
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright, expect


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base-url", default="http://localhost:3000")
    parser.add_argument("--output", required=True)
    args = parser.parse_args()
    assert urlparse(args.base_url).hostname in {"localhost", "127.0.0.1"}
    out = Path(args.output).resolve()
    out.mkdir(parents=True, exist_ok=True)
    report = {"mode": "server-rendered; JavaScript disabled; external media deliberately blocked",
              "checks": [], "videoPlaybackVerified": False}
    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True, args=["--disable-gpu"])
        context = browser.new_context(viewport={"width": 1280, "height": 900}, java_script_enabled=False)
        page = context.new_page()
        page.route("**/*", lambda route: route.abort() if any(host in route.request.url for host in
                   ["youtube.com", "youtube-nocookie.com", "googlevideo.com"]) else route.continue_())
        try:
            for slug in ["welcome", "video-1", "video-2", "video-3", "video-4", "bring-two-friends", "join"]:
                response = page.goto(args.base_url + "/nc/" + slug, wait_until="load", timeout=60000)
                assert response.status == 200, (slug, response.status)
                expect(page.locator("main h1")).to_have_count(1)
                if slug.startswith("video-") or slug == "welcome":
                    expect(page.get_by_role("link", name="Open this video on YouTube")).to_be_visible()
                if slug == "join":
                    expect(page.get_by_text("Club registration and referral rewards are not open yet.", exact=False)).to_be_visible()
                report["checks"].append({"slug": slug, "http": response.status})
            for width in [320, 375, 768, 1280]:
                page.set_viewport_size({"width": width, "height": 900})
                page.goto(args.base_url + "/nc/video-2", wait_until="load")
                if not page.evaluate("document.documentElement.scrollWidth <= innerWidth"):
                    report.update(failureKind="horizontal-overflow", failureViewport=width)
                    raise AssertionError(f"Horizontal overflow at {width}px")
                player = page.locator("iframe").bounding_box()
                if player["width"] < 200 or player["height"] < 200:
                    report.update(failureKind="player-minimum-size", failureViewport=width)
                    raise AssertionError(f"Undersized player: {player}")
                report["checks"].append({"width": width, "noOverflow": True, "player": player})
                page.screenshot(path=str(out / f"layout-{width}.png"))
            page.set_viewport_size({"width": 768, "height": 900})
            page.evaluate("document.documentElement.style.fontSize='200%'")
            if not page.evaluate("document.documentElement.scrollWidth <= innerWidth"):
                report.update(failureKind="enlarged-text-overflow", failureViewport=768)
                raise AssertionError("Header/content overflow at 200% text")
            page.screenshot(path=str(out / "text-200-percent.png"))
            report["checks"].append({"width": 768, "textSize": "200%", "noOverflow": True})
            response = page.goto(args.base_url + "/nc/unknown-code", wait_until="load")
            assert response.status == 404
            report["checks"].append({"unknownRoute": 404})
            report["result"] = "passed"
            print("NC browser layout checks passed:", len(report["checks"]))
        except Exception as error:
            report["result"] = "failed"
            report.setdefault("failureKind", "unexpected-error")
            report["error"] = str(error)
            page.screenshot(path=str(out / "failure.png"))
            raise
        finally:
            (out / "geometry-results.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
            context.close()
            browser.close()


if __name__ == "__main__":
    main()
