import tempfile
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch

import yt_dlp
from pydantic import ValidationError

from app.analyzer import InvalidUrlError, UnsupportedUrlError
from app.downloader import (
    MAX_FILESIZE_BYTES,
    MAX_DURATION_SECONDS,
    DownloadQuality,
    DownloadPreparationError,
    FFmpegRequiredError,
    ContentRemovedError,
    SourceBlockedError,
    TemporaryUnavailableError,
    _map_download_error,
    build_orientation_aware_format_selector,
    build_ydl_options,
    download_media,
    safe_download_name,
)
from app.main import DownloadRequest


class QualityValidationTests(unittest.TestCase):
    def test_accepts_every_supported_quality(self) -> None:
        for quality in ("best", "compatible", "1080", "720", "480", "mp3"):
            with self.subTest(quality=quality):
                request = DownloadRequest(url="https://youtu.be/test", quality=quality)
                self.assertEqual(request.quality.value, quality)

    def test_rejects_arbitrary_quality(self) -> None:
        with self.assertRaises(ValidationError):
            DownloadRequest(url="https://youtu.be/test", quality="4k")

    def test_gallery_indices_require_real_integers(self) -> None:
        for invalid in ([-1.5], ["1"], [True]):
            with self.subTest(invalid=invalid), self.assertRaises(ValidationError):
                DownloadRequest(url="https://www.instagram.com/p/test/", item_indices=invalid)


class DownloadValidationTests(unittest.TestCase):
    def test_rejects_invalid_url_before_creating_a_temp_directory(self) -> None:
        with patch("app.downloader.tempfile.mkdtemp") as make_temp:
            with self.assertRaises(InvalidUrlError):
                download_media("file:///etc/passwd", DownloadQuality.HD_720)
            make_temp.assert_not_called()

    def test_rejects_unsupported_domain(self) -> None:
        with self.assertRaises(UnsupportedUrlError):
            download_media("https://youtube.com.fakewebsite.com/video", DownloadQuality.BEST)

    def test_reuses_the_shared_url_validator(self) -> None:
        marker = RuntimeError("shared validator called")
        with patch("app.downloader.validate_and_classify_url", side_effect=marker) as validator:
            with self.assertRaisesRegex(RuntimeError, "shared validator called"):
                download_media("https://youtu.be/test", DownloadQuality.HD_720)
        validator.assert_called_once_with("https://youtu.be/test")

    def test_failed_download_removes_its_temporary_directory(self) -> None:
        temp_path = Path(tempfile.mkdtemp(prefix="clipora-test-"))
        downloader = unittest.mock.MagicMock()
        downloader.__enter__.return_value.extract_info.side_effect = yt_dlp.utils.DownloadError("test failure")
        with (
            patch("app.downloader.tempfile.mkdtemp", return_value=str(temp_path)),
            patch("app.downloader.yt_dlp.YoutubeDL", return_value=downloader),
            patch("app.downloader.is_ffmpeg_available", return_value=True),
            self.assertRaises(DownloadPreparationError),
        ):
            download_media("https://youtu.be/test", DownloadQuality.HD_720)
        self.assertFalse(temp_path.exists())

    def test_successful_public_tiktok_download(self) -> None:
        temp_path = Path(tempfile.mkdtemp(prefix="clipora-test-"))
        downloader = MagicMock()

        def write_download(_url: str, *, download: bool) -> dict[str, object]:
            self.assertTrue(download)
            (temp_path / "123.mp4").write_bytes(b"public tiktok video")
            return {"id": "123", "title": "Public TikTok"}

        downloader.__enter__.return_value.extract_info.side_effect = write_download
        with (
            patch("app.downloader.tempfile.mkdtemp", return_value=str(temp_path)),
            patch("app.downloader.yt_dlp.YoutubeDL", return_value=downloader),
            patch("app.downloader.is_ffmpeg_available", return_value=True),
        ):
            artifact = download_media(
                "https://www.tiktok.com/@creator/video/123",
                DownloadQuality.BEST,
            )

        try:
            self.assertEqual(artifact.path, temp_path / "123.mp4")
            self.assertEqual(artifact.download_name, "Public TikTok.mp4")
            self.assertEqual(artifact.media_type, "video/mp4")
        finally:
            artifact.path.unlink(missing_ok=True)
            artifact.temp_directory.rmdir()


class PresetTests(unittest.TestCase):
    def test_video_presets_use_orientation_aware_callable(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            options, _state = build_ydl_options(
                DownloadQuality.HD_1080,
                Path(directory),
                ffmpeg_available=True,
            )
        self.assertTrue(callable(options["format"]))

    def test_vertical_selector_merges_1080_video_and_audio(self) -> None:
        selector = build_orientation_aware_format_selector(
            DownloadQuality.HD_1080,
            ffmpeg_available=True,
        )
        selected = list(selector({"formats": [
            {"format_id": "portrait", "width": 1080, "height": 1920, "vcodec": "avc1", "acodec": "none", "ext": "mp4", "protocol": "https"},
            {"format_id": "audio", "vcodec": "none", "acodec": "mp4a", "ext": "m4a", "protocol": "https"},
        ]}))
        self.assertEqual(selected[0]["format_id"], "portrait+audio")
        self.assertEqual(selected[0]["ext"], "mp4")

    def test_vertical_selector_does_not_upscale_lower_presets(self) -> None:
        formats = [
            {"format_id": "portrait", "width": 1080, "height": 1920, "vcodec": "avc1", "acodec": "none", "ext": "mp4", "protocol": "https"},
            {"format_id": "audio", "vcodec": "none", "acodec": "mp4a", "ext": "m4a", "protocol": "https"},
        ]
        for quality in (DownloadQuality.HD_720, DownloadQuality.SD_480):
            with self.subTest(quality=quality):
                selector = build_orientation_aware_format_selector(quality, ffmpeg_available=True)
                self.assertEqual(list(selector({"formats": formats})), [])

    def test_video_options_enable_limits_and_mp4_merge(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            options, _state = build_ydl_options(
                DownloadQuality.HD_720,
                Path(directory),
                ffmpeg_available=True,
            )
        self.assertEqual(options["max_filesize"], MAX_FILESIZE_BYTES)
        self.assertEqual(options["merge_output_format"], "mp4/mkv")
        self.assertTrue(callable(options["format"]))
        self.assertTrue(options["noplaylist"])
        self.assertIn("no-certifi", options["compat_opts"])

    def test_compatible_preset_prefers_h264_aac_and_mp4(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            options, _state = build_ydl_options(
                DownloadQuality.COMPATIBLE,
                Path(directory),
                ffmpeg_available=True,
            )
        self.assertTrue(callable(options["format"]))
        self.assertEqual(options["merge_output_format"], "mp4")

    def test_tiktok_error_mapping_is_specific_and_bounded(self) -> None:
        self.assertIsInstance(_map_download_error("HTTP Error 403", ffmpeg_available=True), SourceBlockedError)
        self.assertIsInstance(_map_download_error("IP blocked", ffmpeg_available=True), SourceBlockedError)
        self.assertIsInstance(_map_download_error("HTTP Error 404", ffmpeg_available=True), ContentRemovedError)
        self.assertIsInstance(_map_download_error("Unexpected response from webpage request", ffmpeg_available=True), TemporaryUnavailableError)
        self.assertIsInstance(_map_download_error("impersonation dependency missing", ffmpeg_available=True), TemporaryUnavailableError)

    def test_retries_are_controlled(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            options, _state = build_ydl_options(
                DownloadQuality.BEST,
                Path(directory),
                ffmpeg_available=True,
            )
        self.assertEqual(options["retries"], 2)
        self.assertEqual(options["fragment_retries"], 2)
        self.assertEqual(options["extractor_retries"], 2)

    def test_retry_then_success_has_a_bounded_retry_budget(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            options, _state = build_ydl_options(
                DownloadQuality.BEST,
                Path(directory),
                ffmpeg_available=True,
            )
        # yt-dlp owns the retry loop; Vidorac allows the initial attempt plus
        # no more than two retries for each supported request category.
        self.assertEqual(
            (options["retries"], options["fragment_retries"], options["extractor_retries"]),
            (2, 2, 2),
        )

    def test_retry_exhausted_returns_a_clean_temporary_error(self) -> None:
        error = _map_download_error(
            "Unexpected response from webpage request after 2 retries",
            ffmpeg_available=True,
        )
        self.assertIsInstance(error, TemporaryUnavailableError)

    def test_duration_limit_is_applied_before_download(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            options, state = build_ydl_options(
                DownloadQuality.HD_720,
                Path(directory),
                ffmpeg_available=True,
            )
            reason = options["match_filter"](
                {"duration": MAX_DURATION_SECONDS + 1},
                incomplete=False,
            )
        self.assertIsNotNone(reason)
        self.assertEqual(state["reason"], "duration")

    def test_mp3_preset_uses_ffmpeg_at_192_kbps(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            options, _state = build_ydl_options(
                DownloadQuality.MP3,
                Path(directory),
                ffmpeg_available=True,
            )
        self.assertEqual(options["format"], "bestaudio/best")
        self.assertEqual(
            options["postprocessors"],
            [{"key": "FFmpegExtractAudio", "preferredcodec": "mp3", "preferredquality": "192"}],
        )

    def test_mp3_requires_ffmpeg(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            with self.assertRaises(FFmpegRequiredError):
                build_ydl_options(
                    DownloadQuality.MP3,
                    Path(directory),
                    ffmpeg_available=False,
                )

    def test_filename_is_sanitized_and_length_limited(self) -> None:
        filename = safe_download_name('../CON:<bad>|name?*' + ('x' * 200), "mp4")
        self.assertNotIn("..", filename)
        self.assertNotIn("/", filename)
        self.assertNotIn("\\", filename)
        self.assertTrue(filename.endswith(".mp4"))
        self.assertLessEqual(len(filename.removesuffix(".mp4")), 120)
        self.assertEqual(safe_download_name("CON.txt", "mp4"), "Vidorac download.mp4")


if __name__ == "__main__":
    unittest.main()
