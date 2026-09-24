"""Mobile analyzer smoke test. Run with the Next dev server on port 3000."""

import json
import os
import re
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit

from playwright.sync_api import sync_playwright


CONFIGURED_URL = os.environ.get("VIDORAC_TEST_URL", "http://localhost:3000/")
PARSED_URL = urlsplit(CONFIGURED_URL)
SITE_ORIGIN = urlunsplit((PARSED_URL.scheme, PARSED_URL.netloc, "", "", "")).rstrip("/")
HOME_URL = f"{SITE_ORIGIN}/"
TIKTOK_DOWNLOADER_URL = f"{SITE_ORIGIN}/tiktok"
TIKTOK_URL = "https://www.tiktok.com/@example/video/1234567890123456789"
PLATFORM_ISOLATION_CASES = (
    ("https://www.instagram.com/reel/ABC123/", "We detected a Instagram link. Open the Instagram Downloader instead."),
    ("https://youtu.be/example", "This is not a supported TikTok URL."),
    ("https://www.reddit.com/r/videos/comments/abc123/example/", "We detected a Reddit link. Open the Reddit Downloader instead."),
)
VIEWPORTS = (
    ("chrome-375", 375, 812, None),
    ("chrome-390", 390, 844, None),
    (
        "android-chrome-390",
        390,
        669,
        "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36",
    ),
    ("chrome-393", 393, 852, None),
    ("chrome-430", 430, 932, None),
    ("tablet-768", 768, 1024, None),
    ("desktop-1024", 1024, 900, None),
    ("desktop-1280", 1280, 900, None),
    ("desktop-1440", 1440, 1000, None),
    ("desktop-1920", 1920, 1080, None),
    (
        "safari-emulation-390",
        390,
        669,
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
        "source_audio_codec": "AAC",
        "source_audio_bitrate_kbps": 128,
        "source_audio_sample_rate_hz": 44_100,
        "source_audio_channels": 2,
        "quality_options": [
            {"id": "best", "label": "Best Quality", "available": True, "resolution": "1080p", "container": "MP4", "video_codec": "H.264", "estimated_size_bytes": 10_000_000},
            {"id": "audio", "label": "Original / Best Audio", "available": True, "resolution": None, "container": "M4A", "video_codec": None, "estimated_size_bytes": 900_000},
            {"id": "mp3", "label": "MP3", "available": True, "resolution": None, "container": "MP3", "video_codec": None, "estimated_size_bytes": 1_000_000},
        ],
    },
}
PLATFORM_HERO_CASES = (
    ("/tiktok", "Download TikTok videos without the extra steps"),
    ("/instagram", "Download Instagram media from one simple link"),
    ("/facebook", "Download Facebook videos with a cleaner workflow"),
    ("/reddit", "Download Reddit media without the clutter"),
    ("/x", "Download videos from X simply from the link"),
    ("/tiktok-downloader", "TikTok Video, Slideshow & MP3 Downloader with every available option in one place"),
    ("/tiktok-mp3-downloader", "TikTok MP3 Downloader from one public video link"),
    ("/tiktok-slideshow-downloader", "TikTok Slideshow Downloader for the photos you want to keep"),
)
TYPOGRAPHY_VIEWPORTS = (
    (375, 812),
    (390, 844),
    (430, 932),
    (768, 1024),
    (1024, 900),
    (1440, 1000),
)


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
    analyze_requests: list[dict] = []
    prepare_requests: list[dict] = []
    pending_prepare_routes = []
    page.on("pageerror", lambda error: page_errors.append(str(error)))
    page.on("console", lambda message: console_errors.append(message.text) if message.type == "error" else None)
    page.on("request", lambda request: analyze_requests.append(request.post_data_json) if "/api/analyze" in request.url else None)
    page.route(
        "**/api/analyze",
        lambda route: route.fulfill(status=200, content_type="application/json", body=json.dumps(VIDEO_RESPONSE)),
    )
    page.route(
        re.compile(r"^https://ko-fi\.com/vidorac/"),
        lambda route: route.fulfill(status=200, content_type="text/html", body="<html><body>Ko-fi test panel</body></html>"),
    )

    def hold_prepare(route) -> None:
        prepare_requests.append(route.request.post_data_json)
        pending_prepare_routes.append(route)

    page.route("**/api/download/prepare", hold_prepare)

    page.goto(HOME_URL, wait_until="networkidle")
    assert page.locator("#kofiframe").count() == 0, f"{name}: Ko-fi iframe loaded before user intent"
    assert page.get_by_test_id("analyze-result-support").count() == 0, f"{name}: result support appeared on initial load"
    assert page.locator("#media-url").count() == 0, f"{name}: analyzer remained on the homepage"
    page.get_by_role("heading", name="Download videos from your favorite platforms").wait_for()
    page.get_by_role("heading", name="Choose where your link comes from").wait_for()
    platform_hub = page.locator('section[aria-labelledby="platforms-title"]')
    for route in ("/tiktok", "/instagram", "/facebook", "/reddit", "/x"):
        assert platform_hub.locator(f'a[href="{route}"]').count() == 1, f"{name}: homepage hub is missing {route}"
    header = page.locator("header.site-header")
    footer = page.locator("footer.site-footer")
    assert header.locator('a[href="/tiktok-downloader"]').count() == 0, f"{name}: TikTok guide remained in primary navigation"
    for route in ("/tiktok-downloader", "/tiktok-mp3-downloader", "/tiktok-slideshow-downloader"):
        assert footer.locator(f'a[href="{route}"]').count() == 0, f"{name}: {route} remained in footer navigation"
    for route in ("/privacy", "/terms", "/contact"):
        assert footer.locator(f'a[href="{route}"]').count() == 1, f"{name}: footer is missing {route}"

    if width < 640:
        mobile_nav = header.locator(".primary-nav-mobile")
        mobile_nav.locator("summary").click()
        assert mobile_nav.get_by_role("link", name="Home", exact=True).is_visible(), f"{name}: mobile Home link is hidden"
        assert mobile_nav.get_by_role("link", name="Contact", exact=True).is_visible(), f"{name}: mobile Contact link is hidden"
        donate_button = mobile_nav.get_by_role("button", name="Open the Vidorac donation panel")
        assert donate_button.is_visible(), f"{name}: mobile Donate button is hidden"
        donate_button.click()
        dialog = page.get_by_role("dialog", name="Support Vidorac")
        dialog.wait_for()
        dialog.get_by_text("Loading Ko-fi...", exact=True).wait_for(state="detached")
        assert page.evaluate("document.body.style.overflow") == "hidden"
        iframe = dialog.locator("#kofiframe")
        assert iframe.get_attribute("src") == "https://ko-fi.com/vidorac/?hidefeed=true&widget=true&embed=true&preview=true"
        assert iframe.get_attribute("title") == "Support Vidorac on Ko-fi"
        fallback = dialog.get_by_role("link", name="Open Ko-fi")
        assert fallback.get_attribute("href").rstrip("/") == "https://ko-fi.com/vidorac"
        assert fallback.get_attribute("target") == "_blank"
        assert fallback.get_attribute("rel") == "noopener noreferrer"
        page.keyboard.press("Escape")
        assert dialog.count() == 0
        assert page.evaluate("document.body.style.overflow") == ""
        assert donate_button.evaluate("element => document.activeElement === element"), f"{name}: focus was not restored to mobile Donate"
        mobile_nav.locator("summary").click()
    else:
        desktop_nav = header.locator(".primary-nav-desktop")
        assert desktop_nav.get_by_role("link", name="Home", exact=True).is_visible(), f"{name}: desktop Home link is hidden"
        assert desktop_nav.get_by_role("link", name="Contact", exact=True).is_visible(), f"{name}: desktop Contact link is hidden"
        donate_button = desktop_nav.get_by_role("button", name="Open the Vidorac donation panel")
        assert donate_button.is_visible(), f"{name}: desktop Donate button is hidden"
        donate_button.click()
        dialog = page.get_by_role("dialog", name="Support Vidorac")
        dialog.wait_for()
        dialog.get_by_text("Loading Ko-fi...", exact=True).wait_for(state="detached")
        assert page.evaluate("document.body.style.overflow") == "hidden"
        assert dialog.locator("#kofiframe").get_attribute("src") == "https://ko-fi.com/vidorac/?hidefeed=true&widget=true&embed=true&preview=true"
        fallback = dialog.get_by_role("link", name="Open Ko-fi")
        fallback.focus()
        page.keyboard.press("Tab")
        assert dialog.get_by_role("button", name="Close donation panel").evaluate("element => document.activeElement === element"), f"{name}: modal focus trap failed"
        dialog.get_by_role("button", name="Close donation panel").click()
        assert dialog.count() == 0
        assert donate_button.evaluate("element => document.activeElement === element"), f"{name}: focus was not restored to desktop Donate"

    page.goto(TIKTOK_DOWNLOADER_URL, wait_until="networkidle")
    page.locator("#media-url").wait_for()
    page.get_by_role("heading", name="Download TikTok videos without the extra steps").wait_for()
    assert page.get_by_text("Vidorac Diagnostics", exact=True).count() == 0
    page.fill("#media-url", TIKTOK_URL)
    page.click("button[type=submit]")
    page.get_by_text("Mobile regression fixture").wait_for()
    page.get_by_test_id("analyze-result-support").wait_for()
    result_support_button = page.get_by_test_id("analyze-result-support").get_by_role("button", name="Open the Vidorac donation panel")
    result_support_button.click()
    result_dialog = page.get_by_role("dialog", name="Support Vidorac")
    result_dialog.wait_for()
    page.get_by_test_id("donation-modal-backdrop").click(position={"x": 3, "y": 3})
    assert result_dialog.count() == 0, f"{name}: backdrop click did not close donation modal"
    assert result_support_button.evaluate("element => document.activeElement === element"), f"{name}: result CTA focus was not restored"
    page.get_by_test_id("mp3-bitrate-128").wait_for()
    page.get_by_role("button", name=re.compile(r"^Original \/ Best Audio")).wait_for()
    page.get_by_text("Source audio: AAC · ~128 kbps · 44.1 kHz · 2 ch", exact=True).wait_for()
    page.get_by_role("heading", name="Download video").wait_for()
    assert len(analyze_requests) == 1, f"{name}: TikTok did not call /api/analyze exactly once"
    assert analyze_requests[0]["url"] == TIKTOK_URL
    assert analyze_requests[0]["diagnostic_request_id"].startswith("mobile-debug-")

    bitrate_128 = page.get_by_test_id("mp3-bitrate-128")
    bitrate_192 = page.get_by_test_id("mp3-bitrate-192")
    bitrate_256 = page.get_by_test_id("mp3-bitrate-256")
    bitrate_320 = page.get_by_test_id("mp3-bitrate-320")
    bitrate_320.click()
    page.wait_for_timeout(100)
    assert len(pending_prepare_routes) == 1, f"{name}: MP3 preparation was not requested"
    assert bitrate_320.is_disabled(), f"{name}: clicked bitrate stayed enabled during preparation"
    assert not bitrate_128.is_disabled() and not bitrate_192.is_disabled() and not bitrate_256.is_disabled(), f"{name}: unrelated bitrate actions were disabled"
    assert prepare_requests[0]["audio_bitrate"] == 320, f"{name}: clicked MP3 bitrate was not sent"
    pending_prepare_routes[0].fulfill(
        status=500,
        content_type="application/json",
        body=json.dumps({"success": False, "detail": "Download could not be prepared."}),
    )
    page.get_by_text("We couldn't prepare this MP3. Please try again.", exact=True).wait_for()
    assert page.get_by_test_id("analyze-result-support").is_visible(), f"{name}: result support disappeared after a failed download"
    assert not bitrate_320.is_disabled(), f"{name}: controls did not recover after preparation failure"
    console_errors.clear()  # The intentional HTTP 500 above is expected to reach the browser console.

    page.get_by_role("button", name="Download another").click()
    for unsupported_url, expected_error in PLATFORM_ISOLATION_CASES:
        page.fill("#media-url", unsupported_url)
        page.click("button[type=submit]")
        page.locator("#analyze-error").get_by_text(expected_error, exact=True).wait_for()
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


def run_idle_state_case(browser) -> None:
    context = browser.new_context(viewport={"width": 390, "height": 777}, is_mobile=True, has_touch=True)
    page = context.new_page()
    page_errors: list[str] = []
    page.on("pageerror", lambda error: page_errors.append(str(error)))
    page.route("**/api/analyze", lambda route: route.fulfill(status=200, content_type="application/json", body=json.dumps(VIDEO_RESPONSE)))
    page.goto(TIKTOK_DOWNLOADER_URL, wait_until="networkidle")

    status = page.get_by_test_id("analysis-status")
    analyze_spinner = page.get_by_test_id("analyze-spinner")
    status_spinner = status.locator(".analysis-wait-spinner")

    def assert_clean_idle() -> None:
        assert status.evaluate("element => getComputedStyle(element).display") == "none"
        assert analyze_spinner.evaluate("element => getComputedStyle(element).visibility") == "hidden"
        assert analyze_spinner.evaluate("element => getComputedStyle(element).animationName") == "none"
        assert status_spinner.evaluate("element => getComputedStyle(element).animationName") == "none"

    assert_clean_idle()
    page.click("button[type=submit]")
    page.get_by_text("Paste a TikTok link first.", exact=True).wait_for()
    assert_clean_idle()

    page.reload(wait_until="networkidle")
    assert page.input_value("#media-url") == ""
    assert_clean_idle()

    page.fill("#media-url", TIKTOK_URL)
    page.click("button[type=submit]")
    page.get_by_role("heading", name="Mobile regression fixture").wait_for()
    page.get_by_test_id("analyze-result-support").wait_for()
    page.fill("#media-url", "")
    assert page.get_by_role("heading", name="Mobile regression fixture").count() == 0
    assert page.get_by_test_id("analyze-result-support").count() == 0
    assert page.get_by_text("Paste a TikTok link first.", exact=True).count() == 0
    assert_clean_idle()
    assert not page_errors, page_errors
    context.close()


def run_platform_typography_matrix(browser) -> None:
    for width, height in TYPOGRAPHY_VIEWPORTS:
        context = browser.new_context(
            viewport={"width": width, "height": height},
            is_mobile=width < 768,
            has_touch=width < 768,
        )
        page = context.new_page()
        page_errors: list[str] = []
        page.on("pageerror", lambda error: page_errors.append(str(error)))
        for route, heading in PLATFORM_HERO_CASES:
            page.goto(f"{SITE_ORIGIN}{route}", wait_until="networkidle")
            page.get_by_role("heading", name=heading, exact=True).wait_for()
            accent = page.locator(".downloader-hero-heading h1 em")
            assert accent.is_visible(), f"{route} at {width}px: editorial accent is hidden"
            assert "Instrument Serif" in accent.evaluate("element => getComputedStyle(element).fontFamily"), f"{route} at {width}px: editorial font is missing"
            assert page.locator("#media-url").is_visible(), f"{route} at {width}px: analyzer is not directly available"
            overflow = page.evaluate("document.documentElement.scrollWidth > document.documentElement.clientWidth")
            assert not overflow, f"{route} at {width}px: horizontal overflow"
        assert not page_errors, {"viewport": width, "page_errors": page_errors}
        context.close()


def run_donation_fallback_case(browser) -> None:
    context = browser.new_context(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True)
    page = context.new_page()
    page_errors: list[str] = []
    page.on("pageerror", lambda error: page_errors.append(str(error)))
    page.route(re.compile(r"^https://ko-fi\.com/vidorac/"), lambda route: route.abort("failed"))
    page.goto(HOME_URL, wait_until="networkidle")
    mobile_nav = page.locator("header.site-header .primary-nav-mobile")
    mobile_nav.locator("summary").click()
    mobile_nav.get_by_role("button", name="Open the Vidorac donation panel").click()
    dialog = page.get_by_role("dialog", name="Support Vidorac")
    dialog.wait_for()
    fallback = dialog.get_by_role("link", name="Open Ko-fi")
    assert fallback.is_visible()
    assert fallback.get_attribute("href").rstrip("/") == "https://ko-fi.com/vidorac"
    assert dialog.locator("#kofiframe").count() == 1
    dialog.get_by_role("button", name="Close donation panel").click()
    assert dialog.count() == 0
    assert not page_errors, page_errors
    context.close()


def run_debug_failure_cases(browser) -> None:
    context = browser.new_context(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True)
    context.add_init_script(
        "Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined });"
        "if (globalThis.crypto) { try { Object.defineProperty(globalThis.crypto, 'randomUUID', { configurable: true, value: undefined }); } catch {} }"
    )
    page = context.new_page()
    debug_url = f"{TIKTOK_DOWNLOADER_URL}?debug=1"
    page.goto(debug_url, wait_until="networkidle")
    page.get_by_text("Vidorac Diagnostics", exact=True).wait_for()
    page.get_by_text("Vidorac Diagnostics", exact=True).click()
    assert page.get_by_role("button", name="Copy diagnostic report").count() == 0

    page.route("**/api/health", lambda route: route.fulfill(status=200, content_type="application/json", body='{"status":"ok"}'))
    page.get_by_role("button", name="Check API").click()
    page.get_by_text("Backend health reachable: YES", exact=False).wait_for()
    page.get_by_text("Backend health status: 200", exact=False).wait_for()

    page.evaluate("setTimeout(() => { throw new Error('diagnostic-window-test'); }, 0)")
    page.get_by_text("Last error: window.onerror", exact=False).wait_for()
    page.evaluate("setTimeout(() => Promise.reject({ message: 'diagnostic-rejection-test' }), 0)")
    page.get_by_text("Unhandled rejection: {\"message\":\"diagnostic-rejection-test\"}", exact=False).wait_for()

    page.route("**/api/analyze", lambda route: route.abort())
    page.fill("#media-url", TIKTOK_URL)
    page.click("button[type=submit]")
    page.get_by_text("We couldn't reach Vidorac's service. Please try again.", exact=True).wait_for()
    assert page.get_by_test_id("analyze-result-support").count() == 0
    page.get_by_text("Analyzer stage: fetch-failed", exact=False).wait_for()
    page.get_by_text("Analyze request started: true", exact=False).wait_for()
    page.get_by_text("Analyze request completed: true", exact=False).wait_for()
    page.get_by_text("API response status: no response", exact=False).wait_for()
    page.unroute("**/api/analyze")

    page.route("**/api/analyze", lambda route: route.abort("accessdenied"))
    page.click("button[type=submit]")
    page.get_by_text("Last error: analyze-fetch", exact=False).wait_for()
    page.get_by_text("Error message: Failed to fetch", exact=False).wait_for()
    page.unroute("**/api/analyze")

    page.route(
        "**/api/analyze",
        lambda route: route.fulfill(status=503, content_type="application/json", body=json.dumps({"success": False, "detail": "Service temporarily unavailable"})),
    )
    page.click("button[type=submit]")
    page.get_by_text("Service temporarily unavailable", exact=True).wait_for()
    page.get_by_text("API response status: 503", exact=False).wait_for()
    page.get_by_text("Analyzer stage: http-error", exact=False).wait_for()
    page.get_by_text("JSON parse: success", exact=False).wait_for()
    page.get_by_text("Schema validation: success", exact=False).wait_for()
    page.unroute("**/api/analyze")

    page.route("**/api/analyze", lambda route: route.fulfill(status=200, content_type="text/html", body="<html><body>gateway error</body></html>"))
    page.click("button[type=submit]")
    page.get_by_text("Vidorac received an invalid response from the service.", exact=True).wait_for()
    page.get_by_text("JSON parse: failed", exact=False).wait_for()
    page.get_by_text("Response Content-Type: text/html", exact=False).wait_for()
    page.get_by_text("Response preview: <html><body>gateway error</body></html>", exact=False).wait_for()
    page.unroute("**/api/analyze")

    page.route("**/api/analyze", lambda route: route.fulfill(status=200, content_type="application/json", body=""))
    page.click("button[type=submit]")
    page.get_by_text("Response preview: [empty body]", exact=False).wait_for()
    page.get_by_text("Error message: Empty response body", exact=False).wait_for()
    page.unroute("**/api/analyze")

    page.route(
        "**/api/analyze",
        lambda route: route.fulfill(status=200, content_type="application/json", body=json.dumps({"success": True, "video": {"media_type": "video"}})),
    )
    page.click("button[type=submit]")
    page.get_by_text("Vidorac received an invalid response from the service.", exact=True).wait_for()
    page.get_by_text("Last error: analyze-schema-validation", exact=False).wait_for()
    page.get_by_text("Schema validation: failed", exact=False).wait_for()
    page.unroute("**/api/analyze")

    without_audio = json.loads(json.dumps(VIDEO_RESPONSE))
    without_audio["video"]["quality_options"] = [without_audio["video"]["quality_options"][0]]
    page.route(
        "**/api/analyze",
        lambda route: route.fulfill(status=200, content_type="application/json", body=json.dumps(without_audio)),
    )
    page.click("button[type=submit]")
    page.get_by_text("MP3 is not available for this TikTok post.", exact=True).wait_for()
    page.get_by_text("Analyzer stage: result-rendered", exact=False).wait_for()

    report = page.locator("details pre").inner_text()
    assert "JSON parse: success" in report, report
    assert "Schema validation: success" in report, report
    assert "API request host:" in report
    assert "Diagnostic request ID: mobile-debug-" in report
    assert TIKTOK_URL not in report
    assert page.get_by_text("Reload", exact=True).count() == 0

    page.reload(wait_until="networkidle")
    page.get_by_text("Vidorac Diagnostics", exact=True).click()
    page.get_by_text("Last stage before reload: result-rendered", exact=False).wait_for()
    context.close()


def run_abort_controller_rerender_case(browser) -> None:
    context = browser.new_context(viewport={"width": 390, "height": 669}, is_mobile=True, has_touch=True)
    page = context.new_page()
    page_errors: list[str] = []
    page.on("pageerror", lambda error: page_errors.append(str(error)))
    page.goto(TIKTOK_DOWNLOADER_URL, wait_until="networkidle")
    page.clock.install()
    page.evaluate(
        """
        () => {
          const originalFetch = window.fetch.bind(window);
          window.fetch = (input, init = {}) => {
            if (String(input).includes('/api/analyze')) {
              window.__vidoracAnalyzeSignal = init.signal;
              return new Promise((resolve) => {
                window.__resolveVidoracAnalyze = () => resolve(new Response(
                  JSON.stringify(%s),
                  { status: 200, headers: { 'Content-Type': 'application/json' } }
                ));
              });
            }
            return originalFetch(input, init);
          };
        }
        """ % json.dumps(VIDEO_RESPONSE)
    )
    page.evaluate(
        """
        () => {
          window.__stableAnalyzerNodes = {
            button: document.querySelector('button[type="submit"]'),
            iconSlot: document.querySelector('[data-testid="analyze-icon-slot"]'),
            spinner: document.querySelector('[data-testid="analyze-spinner"]'),
            label: document.querySelector('[data-testid="analyze-label"]'),
            status: document.querySelector('[data-testid="analysis-status"]'),
          };
        }
        """
    )

    def assert_stable_nodes() -> None:
        assert page.evaluate(
            """
            () => {
              const nodes = window.__stableAnalyzerNodes;
              return nodes.button === document.querySelector('button[type="submit"]')
                && nodes.iconSlot === document.querySelector('[data-testid="analyze-icon-slot"]')
                && nodes.spinner === document.querySelector('[data-testid="analyze-spinner"]')
                && nodes.label === document.querySelector('[data-testid="analyze-label"]')
                && nodes.status === document.querySelector('[data-testid="analysis-status"]');
            }
            """
        )

    page.fill("#media-url", TIKTOK_URL)
    page.click("button[type=submit]")
    page.get_by_text("Analyzing TikTok…", exact=True).wait_for()
    assert page.get_by_test_id("analyze-result-support").count() == 0
    assert_stable_nodes()
    assert page.get_by_test_id("analyze-spinner").evaluate("element => getComputedStyle(element).visibility") == "visible"
    page.clock.fast_forward(3_000)
    page.get_by_role("heading", name="Analyzing TikTok…").wait_for()
    assert_stable_nodes()
    page.clock.fast_forward(12_000)
    page.get_by_role("heading", name="Processing your TikTok link…").wait_for()
    assert_stable_nodes()
    page.set_viewport_size({"width": 430, "height": 932})
    page.evaluate("window.dispatchEvent(new Event('resize'))")
    assert page.evaluate("window.__vidoracAnalyzeSignal.aborted") is False
    page.evaluate("window.__resolveVidoracAnalyze()")
    page.get_by_text("Mobile regression fixture").wait_for()
    page.get_by_test_id("analyze-result-support").wait_for()
    assert_stable_nodes()
    assert page.evaluate("window.__vidoracAnalyzeSignal.aborted") is False

    page.fill("#media-url", "https://www.tiktok.com/@example/video/9876543210987654321")
    page.click("button[type=submit]")
    page.get_by_text("Analyzing TikTok…", exact=True).wait_for()
    assert page.get_by_test_id("analyze-result-support").count() == 0
    page.evaluate("window.__resolveVidoracAnalyze()")
    page.get_by_text("Mobile regression fixture").wait_for()
    page.get_by_test_id("analyze-result-support").wait_for()
    assert not page_errors, page_errors
    context.close()


def run_immediate_failure_retry_case(browser) -> None:
    context = browser.new_context(viewport={"width": 390, "height": 669}, is_mobile=True, has_touch=True)
    page = context.new_page()
    page_errors: list[str] = []
    attempts = 0
    page.on("pageerror", lambda error: page_errors.append(str(error)))

    def analyze_route(route) -> None:
        nonlocal attempts
        attempts += 1
        if attempts == 1:
            route.abort("failed")
        else:
            route.fulfill(status=200, content_type="application/json", body=json.dumps(VIDEO_RESPONSE))

    page.route("**/api/analyze", analyze_route)
    page.goto(TIKTOK_DOWNLOADER_URL, wait_until="networkidle")
    page.fill("#media-url", TIKTOK_URL)
    button = page.locator('button[type="submit"]')
    button.evaluate("element => { window.__stableAnalyzeButton = element; }")
    button.click()
    page.get_by_text("We couldn't reach Vidorac's service. Please try again.", exact=True).wait_for()
    assert button.evaluate("element => element === window.__stableAnalyzeButton")
    page.get_by_test_id("analyze-error-retry").click()
    page.get_by_text("Mobile regression fixture").wait_for()
    assert button.evaluate("element => element === window.__stableAnalyzeButton")
    assert attempts == 2
    assert not page_errors, page_errors
    context.close()


def run_mp3_download_transition_matrix(browser) -> None:
    context = browser.new_context(viewport={"width": 390, "height": 777}, is_mobile=True, has_touch=True, accept_downloads=True)
    page = context.new_page()
    page_errors: list[str] = []
    prepare_bodies: list[dict] = []
    native_download_requests: list[str] = []
    fail_next_prepare = {"value": False}
    page.on("pageerror", lambda error: page_errors.append(str(error)))
    page.on("request", lambda request: native_download_requests.append(request.url) if "/api/download/" in request.url and "/prepare" not in request.url else None)
    page.route("**/api/analyze", lambda route: route.fulfill(status=200, content_type="application/json", body=json.dumps(VIDEO_RESPONSE)))

    def prepare_route(route) -> None:
        prepare_bodies.append(route.request.post_data_json)
        if fail_next_prepare["value"]:
            fail_next_prepare["value"] = False
            route.fulfill(status=500, content_type="application/json", body=json.dumps({"success": False, "detail": "Download could not be prepared."}))
            return
        route.fulfill(
            status=200,
            content_type="application/json",
            body=json.dumps({"success": True, "download_id": f"test-{len(prepare_bodies)}", "filename": "test.mp3", "content_type": "audio/mpeg"}),
        )

    page.route("**/api/download/prepare", prepare_route)
    page.route("**/api/download/test-*", lambda route: route.fulfill(status=200, content_type="audio/mpeg", headers={"Content-Disposition": "attachment; filename=test.mp3"}, body="test-audio"))
    page.goto(f"{TIKTOK_DOWNLOADER_URL}?debug=1", wait_until="networkidle")
    page.clock.install()
    page.fill("#media-url", TIKTOK_URL)
    page.click("button[type=submit]")
    page.get_by_role("heading", name="Mobile regression fixture").wait_for()
    page.get_by_test_id("analyze-result-support").wait_for()

    page.evaluate(
        """
        () => {
          window.__stableMp3Nodes = {
            card: document.querySelector('[data-testid="audio-card"]'),
            selector: document.querySelector('[data-testid="mp3-bitrate-selector"]'),
            button: document.querySelector('[data-testid="mp3-bitrate-192"]'),
            iconSlot: document.querySelector('[data-testid="mp3-192-icon-slot"]'),
            spinner: document.querySelector('[data-testid="mp3-192-spinner"]'),
            copy: document.querySelector('[data-testid="mp3-192-copy"]'),
            label: document.querySelector('[data-testid="mp3-192-label"]'),
          };
        }
        """
    )

    def assert_mp3_nodes_stable() -> None:
        assert page.evaluate(
            """
            () => {
              const nodes = window.__stableMp3Nodes;
              return nodes.card === document.querySelector('[data-testid="audio-card"]')
                && nodes.selector === document.querySelector('[data-testid="mp3-bitrate-selector"]')
                && nodes.button === document.querySelector('[data-testid="mp3-bitrate-192"]')
                && nodes.iconSlot === document.querySelector('[data-testid="mp3-192-icon-slot"]')
                && nodes.spinner === document.querySelector('[data-testid="mp3-192-spinner"]')
                && nodes.copy === document.querySelector('[data-testid="mp3-192-copy"]')
                && nodes.label === document.querySelector('[data-testid="mp3-192-label"]');
            }
            """
        )

    button = page.get_by_test_id("mp3-bitrate-192")
    label = page.get_by_test_id("mp3-192-label")
    page.evaluate("() => { window.__nativeAnchorClick = HTMLAnchorElement.prototype.click; HTMLAnchorElement.prototype.click = function() {}; }")
    button.click()
    label.get_by_text("MP3 ready", exact=True).wait_for()
    assert_mp3_nodes_stable()
    page.clock.fast_forward(350)
    label.get_by_text("Download started", exact=True).wait_for()
    result_support = page.get_by_test_id("analyze-result-support")
    result_support.wait_for()
    result_support_button = result_support.get_by_role("button", name="Open the Vidorac donation panel")
    assert result_support_button.is_visible()
    assert_mp3_nodes_stable()
    assert not native_download_requests
    page.clock.fast_forward(2_400)
    label.get_by_text("192 kbps", exact=True).wait_for()
    page.evaluate("() => { HTMLAnchorElement.prototype.click = window.__nativeAnchorClick; }")

    for bitrate in (128, 192, 256, 320):
        button = page.get_by_test_id(f"mp3-bitrate-{bitrate}")
        label = page.get_by_test_id(f"mp3-{bitrate}-label")
        button.evaluate("element => { window.__stableCurrentBitrateButton = element; }")
        button.click()
        label.get_by_text("MP3 ready", exact=True).wait_for()
        assert_mp3_nodes_stable()
        assert button.evaluate("element => element === window.__stableCurrentBitrateButton")
        page.clock.fast_forward(350)
        label.get_by_text("Download started", exact=True).wait_for()
        assert_mp3_nodes_stable()
        page.get_by_text("Vidorac Diagnostics", exact=True).locator("..").evaluate("element => { element.open = true; }")
        page.get_by_text("Download stage: mp3-download-triggered", exact=False).wait_for()
        page.clock.fast_forward(2_400)
        label.get_by_text(f"{bitrate} kbps", exact=True).wait_for()
        assert_mp3_nodes_stable()

    assert [body["audio_bitrate"] for body in prepare_bodies[-4:]] == [128, 192, 256, 320]
    best_label = page.get_by_test_id("quality-best-label")
    best_button = best_label.locator("xpath=../..").first
    best_button.evaluate("element => { window.__stableBestButton = element; }")
    best_button.click()
    best_label.get_by_text("Download ready", exact=True).wait_for()
    page.clock.fast_forward(350)
    best_label.get_by_text("Download started", exact=True).wait_for()
    assert best_button.evaluate("element => element === window.__stableBestButton")
    assert prepare_bodies[-1]["quality"] == "best"

    fail_next_prepare["value"] = True
    button.click()
    page.get_by_text("We couldn't prepare this MP3. Please try again.", exact=True).wait_for()
    assert_mp3_nodes_stable()
    button.click()
    label.get_by_text("MP3 ready", exact=True).wait_for()
    page.clock.fast_forward(350)
    label.get_by_text("Download started", exact=True).wait_for()
    assert_mp3_nodes_stable()
    assert len(native_download_requests) == 6
    assert not page_errors, page_errors
    context.close()


with sync_playwright() as playwright:
    mp3_only = os.environ.get("VIDORAC_TEST_MP3_ONLY") == "1"
    executable = browser_executable()
    launch_options = {"headless": True}
    if executable:
        launch_options["executable_path"] = executable
    browser = playwright.chromium.launch(**launch_options)
    if not mp3_only and os.environ.get("VIDORAC_TEST_DEBUG_ONLY") != "1":
        requested_viewports = {
            item.strip()
            for item in os.environ.get("VIDORAC_TEST_VIEWPORTS", "").split(",")
            if item.strip()
        }
        for viewport in VIEWPORTS:
            if not requested_viewports or viewport[0] in requested_viewports:
                print(run_viewport(browser, *viewport), flush=True)
        run_platform_typography_matrix(browser)
        print({"platform_typography_matrix": "passed", "route_viewport_checks": len(PLATFORM_HERO_CASES) * len(TYPOGRAPHY_VIEWPORTS)}, flush=True)
    if not mp3_only:
        run_idle_state_case(browser)
        run_donation_fallback_case(browser)
        run_debug_failure_cases(browser)
        run_abort_controller_rerender_case(browser)
        run_immediate_failure_retry_case(browser)
    run_mp3_download_transition_matrix(browser)
    if not mp3_only:
        print({"debug_failure_cases": "passed"}, flush=True)
        print({"donation_fallback": "passed"}, flush=True)
        print({"abort_controller_rerender": "passed"}, flush=True)
        print({"immediate_failure_retry": "passed"}, flush=True)
    print({"mp3_download_transition_matrix": "passed"}, flush=True)
    browser.close()
    webkit = playwright.webkit.launch(headless=True)
    if not mp3_only:
        print(run_viewport(webkit, "webkit-iphone-390x669", 390, 669, VIEWPORTS[-1][3]), flush=True)
        run_idle_state_case(webkit)
        run_abort_controller_rerender_case(webkit)
        print({"webkit_loading_transitions": "passed"}, flush=True)
    run_mp3_download_transition_matrix(webkit)
    print({"webkit_mp3_download_transitions": "passed"}, flush=True)
    webkit.close()
