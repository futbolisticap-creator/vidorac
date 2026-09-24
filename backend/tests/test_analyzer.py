import asyncio
import json
import unittest
from unittest.mock import MagicMock, patch

import yt_dlp

from app.analyzer import (
    AnalysisAuthenticationError,
    AnalysisContentUnavailableError,
    AnalysisFailedError,
    AnalysisSourceBlockedError,
    AnalysisTemporaryError,
    YDL_OPTIONS,
    InvalidUrlError,
    UnsupportedCollectionUrlError,
    UnsupportedUrlError,
    analyze_media,
    analyze_content,
    build_quality_options,
    extract_source_audio_metadata,
    extract_max_height,
    ensure_individual_media_url,
    normalize_url_for_extraction,
    validate_and_classify_url,
)
from app.format_presets import get_effective_resolution


class UrlValidationTests(unittest.TestCase):
    def test_uses_the_windows_certificate_store(self) -> None:
        self.assertIn("no-certifi", YDL_OPTIONS["compat_opts"])

    def test_accepts_supported_hosts_and_subdomains(self) -> None:
        cases = {
            "https://youtube.com/watch?v=test": "youtube",
            "https://www.youtube.com/watch?v=test": "youtube",
            "https://m.youtube.com/watch?v=test": "youtube",
            "https://youtu.be/test": "youtube",
            "https://vm.tiktok.com/test": "tiktok",
            "https://www.instagram.com/reel/test/": "instagram",
            "https://x.com/creator/status/123": "x",
            "https://twitter.com/creator/status/123": "x",
            "https://www.reddit.com/r/videos/comments/abc123/a_video/": "reddit",
            "https://redd.it/abc123": "reddit",
            "https://v.redd.it/abc123": "reddit",
            "https://www.facebook.com/watch/?v=123": "facebook",
            "https://fb.watch/abc123/": "facebook",
        }
        for url, expected_platform in cases.items():
            with self.subTest(url=url):
                self.assertEqual(validate_and_classify_url(url)[1], expected_platform)

    def test_rejects_unsupported_hosts(self) -> None:
        urls = (
            "https://youtube.com.fakewebsite.com/",
            "https://x.com.fake.com/status/123",
            "https://twitter.com.attacker.com/user/status/123",
            "https://reddit.com.fake.com/r/videos/comments/123/post",
            "https://facebook.com.attacker.com/watch/?v=123",
        )
        for url in urls:
            with self.subTest(url=url), self.assertRaises(UnsupportedUrlError):
                validate_and_classify_url(url)

    def test_rejects_invalid_urls(self) -> None:
        invalid_urls = [
            "",
            "not-a-url",
            "file:///etc/passwd",
            "ftp://youtube.com/video",
            "javascript:alert(1)",
            "https://youtube.com@fakewebsite.com/video",
            "https://user:password@youtube.com/video",
            "https://youtube.com:8080/video",
        ]
        for url in invalid_urls:
            with self.subTest(url=url), self.assertRaises(InvalidUrlError):
                validate_and_classify_url(url)

    def test_normalizes_instagram_post_tracking_parameters(self) -> None:
        self.assertEqual(
            normalize_url_for_extraction(
                "https://www.instagram.com/p/Ddk8Iq6J2wB/?stkn=tracking&igsh=other#fragment",
                "instagram",
            ),
            "https://www.instagram.com/p/Ddk8Iq6J2wB/",
        )

    def test_normalizes_instagram_reel_tracking_parameters(self) -> None:
        self.assertEqual(
            normalize_url_for_extraction(
                "https://www.instagram.com/reel/ABC123?igsh=tracking",
                "instagram",
            ),
            "https://www.instagram.com/reel/ABC123/",
        )

    def test_does_not_strip_identifying_queries_from_other_platforms(self) -> None:
        facebook_url = "https://www.facebook.com/watch/?v=123"
        self.assertEqual(normalize_url_for_extraction(facebook_url, "facebook"), facebook_url)

    def test_instagram_analysis_uses_normalized_url(self) -> None:
        expected = {"media_type": "image", "platform": "instagram"}
        with patch("app.media_gallery.analyze_gallery_post", return_value=expected) as gallery:
            result = analyze_content("https://www.instagram.com/p/Ddk8Iq6J2wB/?stkn=tracking")
        self.assertEqual(result, expected)
        gallery.assert_called_once_with("https://www.instagram.com/p/Ddk8Iq6J2wB/", "instagram")

    def test_accepts_only_individual_posts_on_new_platforms(self) -> None:
        valid = (
            ("https://x.com/creator/status/123", "x"),
            ("https://twitter.com/i/web/status/123", "x"),
            ("https://x.com/creator/status/123/video/1", "x"),
            ("https://reddit.com/r/videos/comments/abc123/a_video/", "reddit"),
            ("https://reddit.com/gallery/abc123", "reddit"),
            ("https://reddit.com/user/creator/comments/abc123/a_video/", "reddit"),
            ("https://redd.it/abc123", "reddit"),
            ("https://v.redd.it/abc123", "reddit"),
            ("https://facebook.com/watch/?v=123", "facebook"),
            ("https://facebook.com/creator/videos/123", "facebook"),
            ("https://facebook.com/creator/posts/pfbid123", "facebook"),
            ("https://facebook.com/creator/photos/a.123/456", "facebook"),
            ("https://facebook.com/photo.php?fbid=123", "facebook"),
            ("https://facebook.com/share/p/abc123", "facebook"),
            ("https://facebook.com/reel/123", "facebook"),
            ("https://fb.watch/abc123/", "facebook"),
        )
        for url, platform in valid:
            with self.subTest(url=url):
                ensure_individual_media_url(url, platform)

        invalid = (
            ("https://x.com/creator", "x"),
            ("https://twitter.com/home", "x"),
            ("https://reddit.com/r/videos/", "reddit"),
            ("https://reddit.com/user/creator", "reddit"),
            ("https://facebook.com/creator", "facebook"),
            ("https://facebook.com/groups/videos", "facebook"),
        )
        for url, platform in invalid:
            with self.subTest(url=url), self.assertRaises(UnsupportedCollectionUrlError):
                ensure_individual_media_url(url, platform)

    def test_normalizes_new_platforms_without_extractor_names(self) -> None:
        info = {
            "title": "Public test video",
            "duration": 12,
            "formats": [
                {"height": 720, "vcodec": "avc1.64001f", "acodec": "mp4a.40.2", "ext": "mp4"}
            ],
        }
        downloader = MagicMock()
        downloader.__enter__.return_value.extract_info.return_value = info
        cases = {
            "https://x.com/creator/status/123": "x",
            "https://reddit.com/r/videos/comments/abc123/a_video/": "reddit",
            "https://facebook.com/reel/123": "facebook",
        }
        with patch("app.analyzer.yt_dlp.YoutubeDL", return_value=downloader):
            for url, expected in cases.items():
                with self.subTest(url=url):
                    media = analyze_media(url)
                    self.assertEqual(media["platform"], expected)
                    self.assertEqual(media["media_type"], "video")
                    self.assertNotIn("extractor", media)

    def test_facebook_authentication_failure_is_classified_safely(self) -> None:
        downloader = MagicMock()
        downloader.__enter__.return_value.extract_info.side_effect = yt_dlp.utils.DownloadError("login required")
        with (
            patch("app.analyzer.yt_dlp.YoutubeDL", return_value=downloader),
            self.assertRaises(AnalysisAuthenticationError) as caught,
        ):
            analyze_media("https://facebook.com/reel/123")
        self.assertEqual(caught.exception.platform, "facebook")

    def test_successful_tiktok_analysis(self) -> None:
        info = {
            "title": "Public TikTok",
            "duration": 10,
            "formats": [
                {"width": 1080, "height": 1920, "vcodec": "h264", "acodec": "aac", "ext": "mp4"}
            ],
        }
        downloader = MagicMock()
        downloader.__enter__.return_value.extract_info.return_value = info
        with patch("app.analyzer.yt_dlp.YoutubeDL", return_value=downloader):
            media = analyze_media("https://www.tiktok.com/@creator/video/123")
        self.assertEqual(media["platform"], "tiktok")
        self.assertEqual(media["max_height"], 1080)

    def test_tiktok_failures_are_classified(self) -> None:
        cases = (
            ("HTTP Error 403: Forbidden", AnalysisSourceBlockedError),
            ("IP address is blocked", AnalysisSourceBlockedError),
            ("HTTP Error 404: Not Found", AnalysisContentUnavailableError),
            ("Unexpected response from webpage request", AnalysisTemporaryError),
            ("challenge failure", AnalysisTemporaryError),
            ("impersonation unavailable", AnalysisTemporaryError),
        )
        for message, expected in cases:
            downloader = MagicMock()
            downloader.__enter__.return_value.extract_info.side_effect = yt_dlp.utils.DownloadError(message)
            with (
                self.subTest(message=message),
                patch("app.analyzer.yt_dlp.YoutubeDL", return_value=downloader),
                self.assertRaises(expected),
            ):
                analyze_media("https://www.tiktok.com/@creator/video/123")

    def test_tiktok_failure_exposes_only_allow_listed_technical_detail(self) -> None:
        downloader = MagicMock()
        downloader.__enter__.return_value.extract_info.side_effect = yt_dlp.utils.DownloadError(
            "ERROR: [TikTok] https://example.invalid/?token=secret: Unexpected response from webpage request"
        )
        with (
            patch("app.analyzer.yt_dlp.YoutubeDL", return_value=downloader),
            self.assertRaises(AnalysisTemporaryError) as caught,
        ):
            analyze_media("https://www.tiktok.com/@creator/video/123")
        self.assertEqual(
            caught.exception.technical_error,
            "TikTok extractor · temporary · Unexpected response from webpage request",
        )
        self.assertNotIn("secret", caught.exception.technical_error or "")

    def test_tiktok_video_does_not_lose_extractor_error_to_gallery_fallback(self) -> None:
        error = AnalysisTemporaryError(
            "tiktok",
            technical_error="TikTok extractor · temporary · Unexpected response from webpage request",
        )
        with (
            patch("app.analyzer.analyze_media", side_effect=error),
            patch("app.media_gallery.analyze_gallery_post") as gallery,
            self.assertRaises(AnalysisTemporaryError),
        ):
            analyze_content("https://www.tiktok.com/@creator/video/123")
        gallery.assert_not_called()

    def test_youtube_failures_distinguish_challenges_from_private_media(self) -> None:
        cases = (
            (
                "Sign in to confirm you're not a bot",
                AnalysisTemporaryError,
                "temporary_platform_challenge",
            ),
            ("Private video", AnalysisAuthenticationError, "private_media"),
            (
                "Join this channel to get access",
                AnalysisAuthenticationError,
                "authentication_required",
            ),
            ("HTTP Error 429: Too Many Requests", AnalysisSourceBlockedError, "rate_limit"),
            (
                "This client requires a PO Token",
                AnalysisTemporaryError,
                "youtube_verification_required",
            ),
            (
                "HTTP Error 403: Forbidden during player challenge",
                AnalysisTemporaryError,
                "temporary_platform_challenge",
            ),
            (
                "Unable to extract player response",
                AnalysisFailedError,
                "generic_extraction_failure",
            ),
        )
        for message, expected_type, expected_category in cases:
            downloader = MagicMock()
            downloader.__enter__.return_value.extract_info.side_effect = yt_dlp.utils.DownloadError(message)
            with (
                self.subTest(message=message),
                patch("app.analyzer.yt_dlp.YoutubeDL", return_value=downloader),
                self.assertRaises(expected_type) as caught,
            ):
                analyze_media("https://www.youtube.com/watch?v=test")
            self.assertEqual(caught.exception.error_category, expected_category)
            self.assertIn("YouTube extractor", caught.exception.technical_error or "")

class AnalyzeEndpointErrorTests(unittest.TestCase):
    def test_diagnostic_request_id_is_validated_and_logged_without_media_url(self) -> None:
        from pydantic import ValidationError
        from app.main import AnalyzeRequest, analyze

        media_url = "https://www.tiktok.com/@creator/video/123"
        request = AnalyzeRequest(
            url=media_url,
            platform="tiktok",
            diagnostic_request_id="mobile-debug-abc12345-1234abcd",
        )
        with (
            patch("app.main.PUBLIC_PLATFORMS", frozenset({"tiktok", "instagram", "facebook", "reddit", "x"})),
            patch("app.main.analyze_content", return_value={"media_type": "video"}),
            self.assertLogs("vidorac.analyze", level="INFO") as captured,
        ):
            asyncio.run(analyze(request))
        self.assertIn("mobile-debug-abc12345-1234abcd", captured.output[0])
        self.assertNotIn(media_url, captured.output[0])

        with self.assertRaises(ValidationError):
            AnalyzeRequest(url=media_url, platform="tiktok", diagnostic_request_id="unsafe request id")

    def test_platform_mismatch_is_rejected_before_extraction(self) -> None:
        from app.main import AnalyzeRequest, analyze

        with (
            patch("app.main.PUBLIC_PLATFORMS", frozenset({"tiktok", "instagram", "facebook", "reddit", "x"})),
            patch("app.main.analyze_content") as extractor,
        ):
            response = asyncio.run(analyze(AnalyzeRequest(url="https://www.instagram.com/reel/test/", platform="tiktok")))
        payload = json.loads(response.body)
        self.assertEqual(response.status_code, 400)
        self.assertEqual(payload["error_code"], "wrong_platform")
        self.assertEqual(payload["expected_platform"], "tiktok")
        self.assertEqual(payload["detected_platform"], "instagram")
        extractor.assert_not_called()

    def test_instagram_post_restriction_is_useful_and_not_misclassified_as_private(self) -> None:
        from app.main import AnalyzeRequest, analyze
        from app.media_gallery import InstagramPostTemporarilyUnavailableError

        with patch("app.main.analyze_content", side_effect=InstagramPostTemporarilyUnavailableError):
            response = asyncio.run(analyze(AnalyzeRequest(url="https://www.instagram.com/p/ABC123/", platform="instagram")))
        payload = json.loads(response.body)
        self.assertEqual(response.status_code, 503)
        self.assertEqual(
            payload["detail"],
            "Instagram photo and carousel posts are temporarily unavailable. Instagram is currently restricting anonymous access to some public posts. Reels are still supported.",
        )
        self.assertNotIn("private", payload["detail"].lower())
        self.assertNotIn("authentication", payload["detail"].lower())

    def test_development_response_includes_sanitized_tiktok_error(self) -> None:
        from app.main import AnalyzeRequest, analyze

        error = AnalysisTemporaryError(
            "tiktok",
            technical_error="TikTok extractor · temporary · Unexpected response from webpage request",
        )
        with (
            patch("app.main.DEVELOPMENT_MODE", True),
            patch("app.main.analyze_content", side_effect=error),
        ):
            response = asyncio.run(analyze(AnalyzeRequest(url="https://www.tiktok.com/@creator/video/123", platform="tiktok")))
        payload = json.loads(response.body)
        self.assertEqual(response.status_code, 503)
        self.assertEqual(
            payload["detail"],
            "TikTok is temporarily unavailable due to changes on the platform. Please try again later.",
        )
        self.assertEqual(payload["technical_error"], error.technical_error)

    def test_production_response_omits_technical_error(self) -> None:
        from app.main import AnalyzeRequest, analyze

        error = AnalysisTemporaryError(
            "tiktok",
            technical_error="TikTok extractor · temporary · Unexpected response from webpage request",
        )
        with (
            patch("app.main.DEVELOPMENT_MODE", False),
            patch("app.main.analyze_content", side_effect=error),
        ):
            response = asyncio.run(analyze(AnalyzeRequest(url="https://www.tiktok.com/@creator/video/123", platform="tiktok")))
        self.assertNotIn("technical_error", json.loads(response.body))


class MetadataTests(unittest.TestCase):
    def test_effective_resolution_is_orientation_independent(self) -> None:
        cases = (
            (1920, 1080, 1080),
            (1080, 1920, 1080),
            (1280, 720, 720),
            (720, 1280, 720),
            (3840, 2160, 2160),
            (2160, 3840, 2160),
            (1080, 1080, 1080),
        )
        for width, height, expected in cases:
            with self.subTest(width=width, height=height):
                self.assertEqual(
                    get_effective_resolution({"width": width, "height": height}),
                    expected,
                )

    def test_effective_resolution_handles_missing_and_invalid_metadata(self) -> None:
        self.assertEqual(get_effective_resolution({"height": 720}), 720)
        self.assertEqual(get_effective_resolution({"width": 480}), 480)
        self.assertIsNone(get_effective_resolution({"width": None, "height": float("inf")}))
    def test_extracts_highest_available_height(self) -> None:
        info = {"height": 720, "formats": [{"height": 360}, {"height": 1080}, {"height": None}]}
        self.assertEqual(extract_max_height(info), 1080)

    def test_missing_height_is_safe(self) -> None:
        self.assertIsNone(extract_max_height({"formats": []}))

    def test_quality_options_reflect_available_resolutions(self) -> None:
        info = {
            "duration": 100,
            "formats": [
                {"height": 480, "vcodec": "avc1", "acodec": "none", "ext": "mp4", "filesize": 8_000_000},
                {"height": 720, "vcodec": "avc1", "acodec": "none", "ext": "mp4", "filesize": 12_000_000},
                {"height": None, "vcodec": "none", "acodec": "mp4a", "ext": "m4a", "filesize": 2_000_000},
            ],
        }

        options = {option["id"]: option for option in build_quality_options(info)}

        self.assertTrue(options["best"]["available"])
        self.assertTrue(options["compatible"]["available"])
        self.assertNotIn("1080", options)
        self.assertTrue(options["720"]["available"])
        self.assertEqual(options["720"]["label"], "720p")
        self.assertEqual(options["720"]["resolution"], "720p")
        self.assertEqual(options["720"]["estimated_size_bytes"], 14_000_000)
        self.assertEqual(options["compatible"]["container"], "MP4")
        self.assertEqual(options["compatible"]["video_codec"], "H.264")
        self.assertTrue(options["mp3"]["available"])
        self.assertEqual(options["mp3"]["container"], "MP3")
        self.assertTrue(options["audio"]["available"])
        self.assertEqual(options["audio"]["container"], "M4A")

    def test_source_audio_metadata_keeps_extractor_bitrate_separate(self) -> None:
        metadata = extract_source_audio_metadata(
            {
                "formats": [
                    {
                        "vcodec": "none",
                        "acodec": "mp4a.40.2",
                        "ext": "m4a",
                        "abr": 127.6,
                        "asr": 44_100,
                        "audio_channels": 2,
                    }
                ]
            }
        )
        self.assertEqual(metadata["source_audio_codec"], "AAC")
        self.assertEqual(metadata["source_audio_bitrate_kbps"], 128)
        self.assertEqual(metadata["source_audio_sample_rate_hz"], 44_100)
        self.assertEqual(metadata["source_audio_channels"], 2)

    def test_unknown_source_audio_bitrate_remains_unknown(self) -> None:
        metadata = extract_source_audio_metadata(
            {"formats": [{"vcodec": "none", "acodec": "opus", "ext": "webm"}]}
        )
        self.assertEqual(metadata["source_audio_codec"], "Opus")
        self.assertIsNone(metadata["source_audio_bitrate_kbps"])

    def test_unknown_sizes_are_returned_as_null(self) -> None:
        options = build_quality_options(
            {"formats": [{"height": 720, "vcodec": "avc1", "acodec": "none", "ext": "mp4"}]}
        )
        best = next(option for option in options if option["id"] == "best")
        self.assertIsNone(best["estimated_size_bytes"])

    def test_estimated_downloads_over_beta_limit_are_unavailable(self) -> None:
        options = build_quality_options(
            {
                "duration": 600,
                "formats": [
                    {
                        "height": 2160,
                        "vcodec": "avc1",
                        "acodec": "mp4a",
                        "ext": "mp4",
                        "filesize": 300 * 1024 * 1024,
                    }
                ],
            }
        )
        best = next(option for option in options if option["id"] == "best")
        self.assertFalse(best["available"])

    def test_separate_youtube_video_and_audio_streams_enable_each_matching_quality(self) -> None:
        info = {
            "duration": 300,
            "formats": [
                {"height": 1080, "vcodec": "avc1.640028", "acodec": "none", "ext": "mp4"},
                {"height": 720, "vcodec": "avc1.64001f", "acodec": "none", "ext": "mp4"},
                {"height": None, "vcodec": "none", "acodec": "mp4a.40.2", "ext": "m4a"},
            ],
        }
        with patch("app.analyzer.shutil.which", return_value="ffmpeg"):
            options = {option["id"]: option for option in build_quality_options(info)}

        self.assertTrue(options["best"]["available"])
        self.assertTrue(options["1080"]["available"])
        self.assertTrue(options["720"]["available"])
        self.assertNotIn("480", options)
        self.assertTrue(options["mp3"]["available"])
        self.assertEqual(options["1080"]["resolution"], "1080p")
        self.assertEqual(options["1080"]["container"], "MP4")

    def test_vertical_video_and_separate_audio_enable_1080p(self) -> None:
        info = {
            "formats": [
                {"width": 1080, "height": 1920, "vcodec": "avc1.640028", "acodec": "none", "ext": "mp4"},
                {"vcodec": "none", "acodec": "mp4a.40.2", "ext": "m4a"},
            ],
        }
        with patch("app.analyzer.shutil.which", return_value="ffmpeg"):
            options = {option["id"]: option for option in build_quality_options(info)}

        self.assertTrue(options["1080"]["available"])
        self.assertEqual(options["1080"]["resolution"], "1080p")
        self.assertNotIn("720", options)
        self.assertNotIn("480", options)

    def test_vp9_and_opus_separate_streams_are_available(self) -> None:
        info = {
            "formats": [
                {"height": 1080, "vcodec": "vp9", "acodec": "none", "ext": "webm"},
                {"height": None, "vcodec": "none", "acodec": "opus", "ext": "webm"},
            ],
        }
        with patch("app.analyzer.shutil.which", return_value="ffmpeg"):
            options = {option["id"]: option for option in build_quality_options(info)}

        self.assertTrue(options["best"]["available"])
        self.assertTrue(options["1080"]["available"])
        self.assertEqual(options["1080"]["container"], "WEBM")
        self.assertEqual(options["1080"]["video_codec"], "VP9")

    def test_x_formats_with_omitted_audio_codec_still_expose_qualities(self) -> None:
        info = {
            "duration": 30,
            "formats": [
                {"format_id": "hls-audio-128000-Audio", "height": None, "vcodec": "none", "acodec": None, "ext": "mp4"},
                {"format_id": "http-2176", "height": 720, "vcodec": None, "acodec": None, "ext": "mp4"},
                {"format_id": "hls-716", "height": 720, "vcodec": "avc1.64001F", "acodec": "none", "ext": "mp4"},
            ],
        }
        with patch("app.analyzer.shutil.which", return_value="ffmpeg"):
            options = {option["id"]: option for option in build_quality_options(info)}

        self.assertTrue(options["best"]["available"])
        self.assertTrue(options["compatible"]["available"])
        self.assertTrue(options["720"]["available"])
        self.assertTrue(options["mp3"]["available"])
        self.assertEqual(options["best"]["container"], "MKV")
        self.assertEqual(options["compatible"]["container"], "MP4")
        self.assertEqual(options["compatible"]["video_codec"], "H.264")

    def test_facebook_direct_formats_without_dimensions_keep_best_options(self) -> None:
        info = {
            "formats": [
                {"format_id": "sd", "height": None, "vcodec": None, "acodec": None, "ext": "mp4"},
                {"format_id": "hd", "height": None, "vcodec": None, "acodec": None, "ext": "mp4"},
                {"format_id": "dash-video", "height": 848, "vcodec": "vp9", "acodec": "none", "ext": "mp4"},
            ],
        }
        with patch("app.analyzer.shutil.which", return_value="ffmpeg"):
            options = {option["id"]: option for option in build_quality_options(info)}

        self.assertTrue(options["best"]["available"])
        self.assertTrue(options["compatible"]["available"])
        self.assertIsNone(options["best"]["resolution"])
        self.assertEqual(options["best"]["container"], "MP4")
        self.assertFalse(options["mp3"]["available"])
        self.assertNotIn("1080", options)

    def test_best_quality_keeps_av1_while_best_mp4_prefers_h264_aac(self) -> None:
        info = {
            "formats": [
                {"height": 2160, "vcodec": "av01.0.12M", "acodec": "none", "ext": "webm"},
                {"height": 1080, "vcodec": "avc1.640028", "acodec": "none", "ext": "mp4"},
                {"height": None, "vcodec": "none", "acodec": "opus", "ext": "webm"},
                {"height": None, "vcodec": "none", "acodec": "mp4a.40.2", "ext": "m4a"},
            ],
        }
        with patch("app.analyzer.shutil.which", return_value="ffmpeg"):
            options = {option["id"]: option for option in build_quality_options(info)}

        self.assertEqual(options["best"]["resolution"], "2160p")
        self.assertEqual(options["best"]["container"], "MKV")
        self.assertEqual(options["best"]["video_codec"], "AV1")
        self.assertEqual(options["compatible"]["resolution"], "1080p")
        self.assertEqual(options["compatible"]["container"], "MP4")
        self.assertEqual(options["compatible"]["video_codec"], "H.264")

    def test_resolution_preset_means_best_available_up_to_limit(self) -> None:
        info = {
            "formats": [
                {"height": 900, "vcodec": "av01", "acodec": "none", "ext": "mp4"},
                {"height": None, "vcodec": "none", "acodec": "mp4a", "ext": "m4a"},
            ],
        }
        with patch("app.analyzer.shutil.which", return_value="ffmpeg"):
            options = {option["id"]: option for option in build_quality_options(info)}

        self.assertTrue(options["1080"]["available"])
        self.assertEqual(options["1080"]["label"], "900p")
        self.assertEqual(options["1080"]["resolution"], "900p")
        self.assertNotIn("720", options)

    def test_bitrate_only_size_estimate_does_not_disable_a_quality(self) -> None:
        info = {
            "duration": 3600,
            "formats": [
                {"height": 1080, "vcodec": "avc1", "acodec": "none", "ext": "mp4", "tbr": 9000},
                {"height": None, "vcodec": "none", "acodec": "mp4a", "ext": "m4a", "tbr": 192},
            ],
        }
        with patch("app.analyzer.shutil.which", return_value="ffmpeg"):
            best = next(option for option in build_quality_options(info) if option["id"] == "best")

        self.assertGreater(best["estimated_size_bytes"], 250 * 1024 * 1024)
        self.assertTrue(best["available"])


if __name__ == "__main__":
    unittest.main()
