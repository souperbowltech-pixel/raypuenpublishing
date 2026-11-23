"""Record local campaign QA with Python Playwright; never contact a live campaign.

Usage: python scripts/capture-campaign-qa.py --output <private-delivery-folder>
Requires an already running local Next server and installed Playwright browsers.
Real requests and explicitly labelled API fixtures are reported separately.
"""
import argparse
import json
import re
from pathlib import Path
from urllib.parse import urlparse

from playwright.sync_api import sync_playwright, expect


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base-url", default="http://localhost:3000")
    parser.add_argument("--output", required=True)
    args = parser.parse_args()
    base = args.base_url.rstrip("/")
    assert urlparse(base).hostname in {"127.0.0.1", "localhost"}, "Local server only"
    out = Path(args.output).resolve()
    out.mkdir(parents=True, exist_ok=True)
    report = {"baseUrl": base, "cases": [], "pageErrors": [], "limitations": [
        "No staging database, provider delivery, storage expiry or scheduler verification.",
        "Confirmation success uses browser-only API fixtures, labelled throughout.",
        "No real customer data or emails are submitted.",
        "Use canonical localhost; this Next dev instance rejects the 127.0.0.1 Origin alias.",
    ]}

    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True, args=["--disable-gpu"])
        context = browser.new_context(viewport={"width": 1280, "height": 900},
                                      locale="en-US", reduced_motion="reduce",
                                      record_video_dir=str(out / "raw"),
                                      record_video_size={"width": 1280, "height": 900})
        page = context.new_page()
        page.set_default_timeout(12000)
        page.on("pageerror", lambda error: report["pageErrors"].append(str(error)))
        actual_posts = []
        embed_requests = []
        page.on("request", lambda r: actual_posts.append(r.post_data_json)
                if r.url == base + "/api/campaign/vote" and r.method == "POST" else None)
        page.on("request", lambda r: embed_requests.append(r.headers.get("referer"))
                if "youtube-nocookie.com/embed/" in r.url else None)

        def passed(name, mode="real", **details):
            report["cases"].append({"name": name, "mode": mode, "result": "passed", **details})
            print("PASS:", name, flush=True)

        def caption(title, detail="Actual local app | Playwright browser test", fixture=False):
            page.evaluate("""({title, detail, fixture}) => {
              let b = document.getElementById('qa-recording-caption');
              if (!b) { b = document.createElement('div'); b.id='qa-recording-caption';
                document.body.append(b); }
              Object.assign(b.style, {position:'fixed',top:'0',left:'0',right:'0',zIndex:'2147483647',
                background:fixture?'#713f12':'#102a43',color:'#fff',padding:'12px 24px',
                fontFamily:'Arial,sans-serif',boxShadow:'0 2px 8px #0004',pointerEvents:'none'});
              b.replaceChildren();
              const strong=document.createElement('strong');strong.textContent=title;
              strong.style.cssText='display:block;font-size:21px;line-height:26px';
              const small=document.createElement('div');small.textContent=detail;
              small.style.cssText='font-size:15px;line-height:22px';b.append(strong,small);
            }""", {"title": title, "detail": detail, "fixture": fixture})
            page.wait_for_timeout(350)

        def pause(ms=2100):
            page.wait_for_timeout(ms)

        def center(locator):
            locator.evaluate("e => e.scrollIntoView({block:'center', behavior:'instant'})")

        def invalid(field, message):
            page.get_by_role("button", name="Unlock My Child's Free Starter Kit").click()
            expect(page.locator('main [role="alert"]')).to_contain_text(message)
            expect(page.locator('[name="' + field + '"]').first).to_be_focused()
            pause()

        try:
            health = context.request.get(base + "/api/campaign/health", timeout=30000)
            report["health"] = {"status": health.status, "body": health.json()}
            # Never send a valid real vote if the backend unexpectedly becomes ready.
            assert health.json().get("checks", {}).get("campaign") is False, \
                "Ready backend: skip this harness to avoid persistence or real email"
            page.goto(base + "/welcome?ref=fiesta", wait_until="domcontentloaded", timeout=60000)
            caption("01 | Welcome Video: real playback")
            frame = page.frame_locator('iframe[title="The Neighborhood Chronicles Welcome Video"]')
            frame.locator('button.ytmCuedOverlayPlayButton, button.ytp-large-play-button').first.click(timeout=30000)
            video = frame.locator("video").first
            expect(video).to_be_attached(timeout=30000)
            for _ in range(30):
                playback = video.evaluate("v => ({time:v.currentTime,paused:v.paused,ready:v.readyState})")
                if playback["time"] > 1 and not playback["paused"]:
                    break
                pause(500)
            assert playback["time"] > 1 and not playback["paused"], playback
            assert embed_requests[0] == base + "/", embed_requests
            passed("YouTube plays; origin-only Referer", playback=playback,
                   referer=embed_requests[0])
            pause(3000)
            page.screenshot(path=str(out / "01-video-playing.png"))
            video.evaluate("v => v.pause()")

            caption("02 | Empty form: error and focus on first character")
            invalid("character", "Choose one character.")
            passed("Empty form focuses character; no API submission")
            assert not actual_posts

            caption("03 | All five characters update the optional question")
            for name in ["gideon", "sunny", "barnabas", "lucy", "willie"]:
                page.locator('[name="character"][value="' + name + '"]').check()
                expect(page.locator('label[for="vote-answer"]')).to_contain_text(name.title())
                pause(220)
            passed("Five character choices and matching optional question")
            page.locator('[name="character"][value="sunny"]').check()

            caption("04 | Missing parent name: focused field and clear error")
            invalid("firstName", "Use your first name")
            passed("Missing parent name rejected with focus")
            page.locator('#vote-firstName').fill("QAParent")
            page.locator('#vote-email').fill("wrong-email")
            caption("05 | Wrong email: rejected before any server request")
            invalid("email", "Enter a valid email address.")
            passed("Invalid email rejected with focus")
            page.locator('#vote-email').fill("qa-parent@example.invalid")
            caption("06 | Adult permission is required; marketing is optional")
            invalid("adultConsent", "A parent or adult caregiver")
            expect(page.locator('[name="marketingConsent"]')).not_to_be_checked()
            expect(page.locator('[name="smsConsent"]')).not_to_be_checked()
            passed("Adult consent required; optional consents unchecked")
            page.locator('[name="adultConsent"]').check()
            page.locator('#vote-phone').fill("123")
            caption("07 | Invalid phone number and missing text permission")
            invalid("phone", "Use international format")
            page.locator('#vote-phone').fill("+15551234567")
            invalid("phone", "give text permission")
            passed("Invalid phone and phone without SMS consent rejected")
            page.locator('#vote-phone').fill("")
            page.locator('[name="smsConsent"]').check()
            caption("08 | Text permission requires a phone number")
            invalid("phone", "Add your phone number")
            passed("SMS consent without phone rejected")
            page.locator('[name="smsConsent"]').uncheck()
            page.locator('#vote-answer').fill("x" * 520)
            assert len(page.locator('#vote-answer').input_value()) == 500
            page.locator('#vote-answer').fill("")
            passed("Optional answer limited to 500 characters")
            assert not actual_posts

            caption("09 | Valid form: real service reports setup unavailable",
                    "Database/kit setup pending | No success or email delivery claimed")
            # Delay, then forward the actual request, to inspect the busy guard.
            def delayed_real(route):
                page.wait_for_timeout(1200)
                route.continue_()
            page.route("**/api/campaign/vote", delayed_real)
            button = page.get_by_role("button", name="Unlock My Child's Free Starter Kit")
            center(button)
            button.evaluate("b => { b.click(); b.click(); }")
            expect(page.get_by_role("button", name="Saving your request...")).to_be_disabled()
            expect(page.locator('main [role="alert"]')).to_contain_text("temporarily unavailable", timeout=30000)
            assert len(actual_posts) == 1
            assert actual_posts[0]["source"] == "fiesta"
            assert actual_posts[0]["marketingConsent"] is False
            assert actual_posts[0]["phone"] is None
            expect(page.locator('#vote-email')).to_have_value("qa-parent@example.invalid")
            passed("Real setup boundary, input retained, source tag, optional fields and double-click guard")
            pause()
            button.click()
            expect(page.locator('main [role="alert"]')).to_contain_text("temporarily unavailable", timeout=30000)
            assert len(actual_posts) == 2
            assert actual_posts[0]["submissionId"] == actual_posts[1]["submissionId"]
            passed("Unchanged retry reuses submission ID")
            page.unroute("**/api/campaign/vote", delayed_real)
            page.locator('#vote-answer').fill("A new adventure")
            context.set_offline(True)
            caption("10 | Network loss: recoverable error, entries retained",
                    "Injected offline connection | Same app error handling")
            button.click()
            expect(page.locator('main [role="alert"]')).to_contain_text("may already be saved")
            expect(page.locator('#vote-email')).to_have_value("qa-parent@example.invalid")
            passed("Offline error retains inputs and enables retry", mode="network-fault")
            pause()
            context.set_offline(False)

            page.goto(base + "/welcome/thanks", wait_until="domcontentloaded")
            caption("11 | Confirmation without private link: safe recovery")
            expect(page.locator('main [role="alert"]')).to_contain_text("original private link")
            expect(page.get_by_role("link", name="Contact Puen Publishing")).to_be_visible()
            expect(page.get_by_role("button", name="Download Your Free Starter Kit (PDF)")).to_have_count(0)
            passed("Missing receipt cannot expose confirmation or download")
            pause()
            page.goto(base + "/welcome/thanks?qa=invalid#receipt=qa-invalid-link", wait_until="domcontentloaded")
            caption("12 | Invalid private link: rejected by actual server")
            expect(page.locator('main [role="alert"]')).to_contain_text("could not open this private link", timeout=30000)
            passed("Forged receipt rejected; support and retry available")
            pause()

            # These fixtures exercise the real receipt component, not the backend.
            source = (Path(__file__).resolve().parents[1] / "lib/campaign-content.ts").read_text(encoding="utf-8")
            messages = {key: json.loads(value) for key, value in re.findall(
                r'^  (gideon|sunny|barnabas|lucy|willie): (".*"),$', source.split('export const CHARACTER_DESCRIPTIONS')[0], re.M)}
            fixture_state = {"name": "sunny", "canOrder": False}
            def fixture(route):
                action = urlparse(route.request.url).path.rsplit("/", 1)[-1]
                if action == "receipt":
                    name = fixture_state["name"]
                    data = {"title": f"Woohoo, QAParent! {name.title()} says thank you!",
                            "message": messages[name], "character": name.title(),
                            "canOrder": fixture_state["canOrder"], "quantity": None,
                            "reservationTitle": "Reserve a copy for Christmas"}
                    route.fulfill(status=200, json=data)
                elif action == "reserve":
                    assert route.request.post_data_json["quantity"] == 2
                    route.fulfill(status=200, json={"quantity": 2})
                elif action == "kit":
                    route.fulfill(status=503, json={"error": "QA fixture: private storage is unavailable. Please try again."})
                else:
                    route.abort()
            context.add_init_script("""document.addEventListener('DOMContentLoaded', () => {
              const b=document.createElement('div');b.id='qa-recording-caption';
              b.textContent='SIMULATED API RESPONSE | Confirmation UI only; no database or email proof';
              b.style.cssText='position:fixed;top:0;left:0;right:0;z-index:2147483647;background:#713f12;color:white;padding:16px 24px;font:18px Arial;pointer-events:none';
              document.body.append(b);
            });""")
            page.route("**/api/campaign/*", fixture)
            page.goto(base + "/welcome/thanks?qa=fixture#receipt=browser-fixture-only", wait_until="domcontentloaded")
            caption("13 | Confirmation UI preview: Sunny and parent name",
                    "SIMULATED API RESPONSE | Database, email and PDF delivery NOT tested", fixture=True)
            expect(page.get_by_role("heading", name="Woohoo, QAParent! Sunny says thank you!")).to_be_visible()
            expect(page.get_by_role("heading", level=1)).to_be_focused()
            expect(page.get_by_text(messages["sunny"], exact=True)).to_be_visible()
            passed("Sunny confirmation, approved message and heading focus", mode="api-fixture")
            pause(3000)
            page.screenshot(path=str(out / "02-confirmation-fixture.png"))
            page.get_by_role("button", name="Download Your Free Starter Kit (PDF)").click()
            expect(page.locator('main [role="alert"]')).to_contain_text("private storage is unavailable")
            passed("Download failure displays recoverable error", mode="api-fixture")
            caption("14 | Download error and reservation confirmation UI",
                    "SIMULATED API RESPONSE | No file downloaded, payment taken or reservation stored", fixture=True)
            pause()
            page.locator('#reserve-quantity').fill("2")
            page.get_by_role("button", name="Save My Interest").click()
            expect(page.get_by_role("status")).to_contain_text("Interest saved for 2 copies")
            expect(page.get_by_role("status")).to_contain_text("not a payment")
            passed("Reservation UI shows saved quantity without payment promise", mode="api-fixture")
            pause(3000)
            # Verify all five real component variants without extending the recording.
            for name in ["gideon", "barnabas", "lucy", "willie"]:
                fixture_state["name"] = name
                page.reload(wait_until="domcontentloaded")
                caption("15 | Character confirmation variants",
                        "SIMULATED API RESPONSE | Actual component and approved messages", fixture=True)
                expect(page.get_by_role("heading", level=1)).to_contain_text(name.title())
                expect(page.get_by_text(messages[name], exact=True)).to_be_visible()
                pause(350)
            passed("All five personalized character confirmations", mode="api-fixture")
            fixture_state["canOrder"] = True
            page.reload(wait_until="domcontentloaded")
            caption("16 | Live-payment branch UI: correct Book 1 order link",
                    "SIMULATED API RESPONSE | No checkout or real payment performed", fixture=True)
            expect(page.get_by_role("link", name="Order Book 1")).to_have_attribute("href", "/neighborhood#order")
            expect(page.get_by_role("button", name="Save My Interest")).to_have_count(0)
            passed("Order branch replaces reservation with NC Book 1 link", mode="api-fixture")
            pause()
            page.unroute("**/api/campaign/*", fixture)

            caption("QA complete | Validation and playback passed",
                    "Successful storage, real emails and reservations still require staging verification")
            pause(4000)
            # Additional actual browser checks outside the short desktop recording.
            mobile = browser.new_context(viewport={"width": 375, "height": 812}, is_mobile=True, has_touch=True)
            phone = mobile.new_page()
            phone.goto(base + "/welcome?ref=church", wait_until="domcontentloaded")
            for width in [375, 320]:
                phone.set_viewport_size({"width": width, "height": 812})
                assert phone.evaluate("document.documentElement.scrollWidth <= window.innerWidth"), width
                phone.locator('#vote-email').scroll_into_view_if_needed()
                phone.screenshot(path=str(out / f"mobile-{width}.png"))
                passed(f"No horizontal overflow at {width}px")
            phone.set_viewport_size({"width": 375, "height": 812})
            phone.locator('[name="character"][value="gideon"]').focus()
            phone.keyboard.press("ArrowDown")
            expect(phone.locator('[name="character"][value="sunny"]')).to_be_checked()
            passed("Keyboard arrow changes character selection")
            deny = mobile.request.get(base + "/api/admin/campaign")
            assert deny.status == 401, deny.status
            passed("Unauthenticated admin API denies access", status=deny.status)
            malformed = mobile.request.post(base + "/api/campaign/vote", data={},
                                            headers={"Origin": base})
            assert malformed.status == 400, malformed.status
            passed("Server rejects malformed vote independently of browser", status=malformed.status)
            mobile.close()
            assert not report["pageErrors"], report["pageErrors"]
            report["result"] = "passed-with-staging-limitations"
        except Exception as error:
            report["result"] = "failed"
            report["error"] = str(error)
            page.screenshot(path=str(out / "failure.png"))
            raise
        finally:
            context.set_offline(False)
            video_path = page.video.path()
            context.close()
            browser.close()
            report["recording"] = str(video_path)
            (out / "browser-qa-results.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    print("Recording:", video_path)
    print("Cases:", len(report["cases"]))


if __name__ == "__main__":
    main()
