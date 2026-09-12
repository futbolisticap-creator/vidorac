"""Mobile analyzer smoke test. Run with the Next dev server on port 3000."""

import json
import os
from pathlib import Path

from playwright.sync_api import sync_playwright


TARGET_URL = os.environ.get("VIDORAC_TEST_URL", "http://localhost:3000/")
POST_URL = "https://www.instagram.com/p/ABC123/?igsh=test"
REEL_URL = "https://www.instagram.com/reel/ABC123/"
CONTROL_URLS = (
    "https://www.tiktok.com/@example/video/1234567890123456789",
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
        "platform": "instagram",
        "webpage_url": REEL_URL,
        "max_height": 1080,
        "quality_options": [],
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
    page.on("pageerror", lambda error: page_errors.append(str(error)))
    page.on("console", lambda message: console_errors.append(message.text) if message.type == "error" else None)
    page.on("request", lambda request: analyze_requests.append(request.url) if "/api/analyze" in request.url else None)
    page.route(
        "**/api/analyze",
        lambda route: route.fulfill(status=200, content_type="application/json", body=json.dumps(VIDEO_RESPONSE)),
    )

    page.goto(TARGET_URL, wait_until="networkidle")
    page.fill("#media-url", POST_URL)
    page.click("button[type=submit]")
    page.get_by_role("heading", name="Instagram photo posts are temporarily unavailable").wait_for()
    assert not analyze_requests, f"{name}: Instagram /p/ called /api/analyze"

    page.get_by_role("button", name="Try another link").click()
    page.fill("#media-url", REEL_URL)
    page.click("button[type=submit]")
    page.get_by_text("Mobile regression fixture").wait_for()
    assert len(analyze_requests) == 1, f"{name}: Reel did not call /api/analyze exactly once"

    for control_url in CONTROL_URLS:
        page.get_by_role("button", name="Download another").click()
        page.fill("#media-url", control_url)
        page.click("button[type=submit]")
        page.get_by_text("Mobile regression fixture").wait_for()
    assert len(analyze_requests) == 3, f"{name}: control platforms did not preserve analysis"

    page.get_by_role("button", name="Paste URL from clipboard").click()
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


with sync_playwright() as playwright:
    executable = browser_executable()
    launch_options = {"headless": True}
    if executable:
        launch_options["executable_path"] = executable
    browser = playwright.chromium.launch(**launch_options)
    for viewport in VIEWPORTS:
        print(run_viewport(browser, *viewport), flush=True)
    browser.close()
