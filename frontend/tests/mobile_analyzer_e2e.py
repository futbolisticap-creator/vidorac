"""Mobile analyzer smoke test. Run with the Next dev server on port 3000."""

import json
import os
from pathlib import Path

from playwright.sync_api import sync_playwright


TARGET_URL = os.environ.get("VIDORAC_TEST_URL", "http://localhost:3000/")
TIKTOK_URL = "https://www.tiktok.com/@example/video/1234567890123456789"
UNSUPPORTED_URLS = (
    "https://www.instagram.com/reel/ABC123/",
    "https://youtu.be/example",
    "https://www.reddit.com/r/videos/comments/abc123/example/",
)
VIEWPORTS = (
    ("chrome-375", 375, 812, None),
    ("chrome-390", 390, 844, None),
    ("chrome-393", 393, 852, None),
    ("chrome-430", 430, 932, None),
    ("tablet-768", 768, 1024, None),
    ("desktop-1440", 1440, 1000, None),
    (
        "safari-emulation-390",
        390,
        844,
        "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) "
        "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
    ),
)
VIDEO_RESPONSE = {
    "success": True,
    "video": {
        "media_type": "video",
        "title": "Mobile regression fixture",
        "thumbnail": None,
        "duration": 12,
        "uploader": "Vidorac test",
        "platform": "tiktok",
        "webpage_url": TIKTOK_URL,
        "max_height": 1080,
        "quality_options": [
            {"id": "best", "label": "Best Quality", "available": True, "resolution": "1080p", "container": "MP4", "video_codec": "H.264", "estimated_size_bytes": 10_000_000},
            {"id": "mp3", "label": "MP3", "available": True, "resolution": None, "container": "MP3", "video_codec": None, "estimated_size_bytes": 1_000_000},
        ],
    },
}


def browser_executable() -> str | None:
    configured = os.environ.get("VIDORAC_BROWSER_PATH")
    if configured:
        return configured
    candidates = (
        Path(r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"),
        Path(r"C:\Program Files\Google\Chrome\Application\chrome.exe"),
    )
    return str(next((path for path in candidates if path.exists()), "")) or None


def run_viewport(browser, name: str, width: int, height: int, user_agent: str | None) -> dict:
    options = {
        "viewport": {"width": width, "height": height},
        "device_scale_factor": 2,
        "is_mobile": width < 768,
        "has_touch": width < 768,
    }
    if user_agent:
        options["user_agent"] = user_agent

    context = browser.new_context(**options)
    context.add_init_script(
        "Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { "
        "readText: () => Promise.reject(new DOMException('Denied', 'NotAllowedError')) } })"
    )
    page = context.new_page()
    page_errors: list[str] = []
    console_errors: list[str] = []
    analyze_requests: list[str] = []
    prepare_requests: list[dict] = []
    pending_prepare_routes = []
    page.on("pageerror", lambda error: page_errors.append(str(error)))
    page.on("console", lambda message: console_errors.append(message.text) if message.type == "error" else None)
    page.on("request", lambda request: analyze_requests.append(request.url) if "/api/analyze" in request.url else None)
    page.route(
        "**/api/analyze",
        lambda route: route.fulfill(status=200, content_type="application/json", body=json.dumps(VIDEO_RESPONSE)),
    )

    def hold_prepare(route) -> None:
        prepare_requests.append(route.request.post_data_json)
        pending_prepare_routes.append(route)

    page.route("**/api/download/prepare", hold_prepare)

    page.goto(TARGET_URL, wait_until="networkidle")
    assert page.get_by_text("Vidorac Diagnostics", exact=True).count() == 0
    page.fill("#media-url", TIKTOK_URL)
    page.click("button[type=submit]")
    page.get_by_text("Mobile regression fixture").wait_for()
    page.get_by_role("button", name="Download MP3").wait_for()
    page.get_by_role("heading", name="Download video").wait_for()
    assert len(analyze_requests) == 1, f"{name}: TikTok did not call /api/analyze exactly once"

    bitrate_128 = page.get_by_role("button", name="128 kbps Small")
    bitrate_192 = page.get_by_role("button", name="192 kbps Recommended")
    bitrate_320 = page.get_by_role("button", name="320 kbps High")
    assert bitrate_192.get_attribute("aria-pressed") == "true", f"{name}: 192 kbps is not selected by default"
    bitrate_128.click()
    assert bitrate_128.get_attribute("aria-pressed") == "true", f"{name}: 128 kbps selection failed"
    bitrate_320.click()
    assert bitrate_320.get_attribute("aria-pressed") == "true", f"{name}: 320 kbps selection failed"
    assert len(analyze_requests) == 1, f"{name}: changing MP3 bitrate repeated analysis"

    page.get_by_role("button", name="Download MP3").click()
    page.wait_for_timeout(100)
    assert len(pending_prepare_routes) == 1, f"{name}: MP3 preparation was not requested"
    assert bitrate_128.is_disabled() and bitrate_192.is_disabled() and bitrate_320.is_disabled(), f"{name}: bitrate controls stayed enabled during preparation"
    assert prepare_requests[0]["audio_bitrate"] == 320, f"{name}: selected MP3 bitrate was not sent"
    pending_prepare_routes[0].fulfill(
        status=500,
        content_type="application/json",
        body=json.dumps({"success": False, "detail": "Download could not be prepared."}),
    )
    page.get_by_text("We couldn't prepare this MP3. Please try again.", exact=True).wait_for()
    assert bitrate_320.get_attribute("aria-pressed") == "true", f"{name}: failed preparation lost selected bitrate"
    assert not bitrate_320.is_disabled(), f"{name}: controls did not recover after preparation failure"
    console_errors.clear()  # The intentional HTTP 500 above is expected to reach the browser console.

    page.get_by_role("button", name="Download another").click()
    for unsupported_url in UNSUPPORTED_URLS:
        page.fill("#media-url", unsupported_url)
        page.click("button[type=submit]")
        page.locator("#analyze-error").get_by_text("TikTok links only", exact=False).wait_for()
    assert len(analyze_requests) == 1, f"{name}: unsupported platform called /api/analyze"

    page.get_by_role("button", name="Paste TikTok URL from clipboard").click()
    page.get_by_text("Unable to access the clipboard. Paste the link manually.", exact=True).wait_for()
    overflow = page.evaluate("document.documentElement.scrollWidth > document.documentElement.clientWidth")
    reload_screen = page.get_by_text("Reload", exact=True).count() > 0
    result = {
        "viewport": name,
        "page_errors": page_errors,
        "console_errors": console_errors,
        "horizontal_overflow": overflow,
        "reload_screen": reload_screen,
    }
    context.close()
    assert not page_errors, result
    assert not console_errors, result
    assert not overflow, result
    assert not reload_screen, result
    return result


def run_debug_failure_cases(browser) -> None:
    context = browser.new_context(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True)
    context.add_init_script(
        "Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined });"
        "if (globalThis.crypto) { try { Object.defineProperty(globalThis.crypto, 'randomUUID', { configurable: true, value: undefined }); } catch {} }"
    )
    page = context.new_page()
    debug_url = f"{TARGET_URL.rstrip('/')}?debug=1"
    page.goto(debug_url, wait_until="networkidle")
    page.get_by_text("Vidorac Diagnostics", exact=True).wait_for()
    page.get_by_text("Vidorac Diagnostics", exact=True).click()
    assert page.get_by_role("button", name="Copy diagnostic report").count() == 0

    page.evaluate("setTimeout(() => { throw new Error('diagnostic-window-test'); }, 0)")
    page.get_by_text("Last error: window.onerror", exact=False).wait_for()
    page.evaluate("setTimeout(() => Promise.reject({ message: 'diagnostic-rejection-test' }), 0)")
    page.get_by_text("Unhandled rejection: {\"message\":\"diagnostic-rejection-test\"}", exact=False).wait_for()

    page.route("**/api/analyze", lambda route: route.abort())
    page.fill("#media-url", TIKTOK_URL)
    page.click("button[type=submit]")
    page.get_by_text("We couldn't reach Vidorac's service. Please try again.", exact=True).wait_for()
    page.unroute("**/api/analyze")

    page.route(
        "**/api/analyze",
        lambda route: route.fulfill(status=503, content_type="application/json", body=json.dumps({"success": False, "detail": "Service temporarily unavailable"})),
    )
    page.click("button[type=submit]")
    page.get_by_text("This TikTok could not be accessed. It may be private, removed, or temporarily unavailable.", exact=True).wait_for()
    page.get_by_text("API response status: 503", exact=False).wait_for()
    page.unroute("**/api/analyze")

    page.route("**/api/analyze", lambda route: route.fulfill(status=200, content_type="text/plain", body="not json"))
    page.click("button[type=submit]")
    page.get_by_text("Vidorac received an invalid response from the service.", exact=True).wait_for()
    page.unroute("**/api/analyze")

    page.route(
        "**/api/analyze",
        lambda route: route.fulfill(status=200, content_type="application/json", body=json.dumps({"success": True, "video": {"media_type": "video"}})),
    )
    page.click("button[type=submit]")
    page.get_by_text("Vidorac received an invalid response from the service.", exact=True).wait_for()
    page.get_by_text("Last error: analyze-schema-validation", exact=False).wait_for()

    report = page.locator("details pre").inner_text()
    assert "Analyzer stage: response-parsing" in report, report
    assert "Last error: analyze-schema-validation" in report
    assert TIKTOK_URL not in report
    assert page.get_by_text("Reload", exact=True).count() == 0
    context.close()


with sync_playwright() as playwright:
    executable = browser_executable()
    launch_options = {"headless": True}
    if executable:
        launch_options["executable_path"] = executable
    browser = playwright.chromium.launch(**launch_options)
    if os.environ.get("VIDORAC_TEST_DEBUG_ONLY") != "1":
        requested_viewports = {
            item.strip()
            for item in os.environ.get("VIDORAC_TEST_VIEWPORTS", "").split(",")
            if item.strip()
        }
        for viewport in VIEWPORTS:
            if not requested_viewports or viewport[0] in requested_viewports:
                print(run_viewport(browser, *viewport), flush=True)
    run_debug_failure_cases(browser)
    print({"debug_failure_cases": "passed"}, flush=True)
    browser.close()
