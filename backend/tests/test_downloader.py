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
    DEFAULT_MP3_BITRATE,
    DownloadQuality,
    DownloadPreparationError,
    FFmpegRequiredError,
    FileSizeLimitError,
    Mp3Bitrate,
    ContentRemovedError,
    SourceBlockedError,
    TemporaryUnavailableError,
    _encode_mp3,
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

    def test_accepts_only_supported_mp3_bitrates(self) -> None:
        for bitrate in (128, 192, 320):
            with self.subTest(bitrate=bitrate):
                request = DownloadRequest(
                    url="https://www.tiktok.com/@creator/video/123",
                    quality="mp3",
                    audio_bitrate=bitrate,
                )
                self.assertEqual(request.audio_bitrate.value, bitrate)

    def test_mp3_bitrate_defaults_to_192(self) -> None:
        request = DownloadRequest(
            url="https://www.tiktok.com/@creator/video/123",
            quality="mp3",
        )
        self.assertEqual(request.audio_bitrate, DEFAULT_MP3_BITRATE)

    def test_rejects_invalid_or_non_integer_mp3_bitrates(self) -> None:
        for bitrate in (0, 999, "192", "320k; rm -rf", True):
            with self.subTest(bitrate=bitrate), self.assertRaises(ValidationError):
                DownloadRequest(
                    url="https://www.tiktok.com/@creator/video/123",
                    quality="mp3",
                    audio_bitrate=bitrate,
                )

    def test_rejects_audio_bitrate_for_non_mp3_downloads(self) -> None:
        with self.assertRaises(ValidationError):
            DownloadRequest(
                url="https://www.tiktok.com/@creator/video/123",
                quality="best",
                audio_bitrate=192,
            )

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

    def test_tiktok_mp3_uses_creator_title_and_audio_mime(self) -> None:
        temp_path = Path(tempfile.mkdtemp(prefix="clipora-test-"))
        downloader = MagicMock()

        def write_download(_url: str, *, download: bool) -> dict[str, object]:
            self.assertTrue(download)
            (temp_path / "123.mp3").write_bytes(b"ID3 valid test audio")
            return {"id": "123", "title": "A / caption", "uploader": "Creator"}

        downloader.__enter__.return_value.extract_info.side_effect = write_download
        with (
            patch("app.downloader.tempfile.mkdtemp", return_value=str(temp_path)),
            patch("app.downloader.yt_dlp.YoutubeDL", return_value=downloader),
            patch("app.downloader.is_ffmpeg_available", return_value=True),
            patch("app.downloader.require_encoders"),
            patch(
                "app.downloader.run_ffmpeg",
                side_effect=lambda arguments: Path(arguments[-1]).write_bytes(b"ID3 encoded test audio"),
            ),
        ):
            artifact = download_media("https://www.tiktok.com/@creator/video/123", DownloadQuality.MP3)

        try:
            self.assertEqual(artifact.download_name, "Creator - A caption.mp3")
            self.assertEqual(artifact.media_type, "audio/mpeg")
            self.assertGreater(artifact.path.stat().st_size, 0)
        finally:
            artifact.path.unlink(missing_ok=True)
            artifact.temp_directory.rmdir()

    def test_failed_mp3_encoding_cleans_temporary_files(self) -> None:
        temp_path = Path(tempfile.mkdtemp(prefix="clipora-test-"))
        downloader = MagicMock()

        def write_download(_url: str, *, download: bool) -> dict[str, object]:
            (temp_path / "123.mp3").write_bytes(b"source audio")
            return {"id": "123", "title": "Public TikTok"}

        downloader.__enter__.return_value.extract_info.side_effect = write_download
        with (
            patch("app.downloader.tempfile.mkdtemp", return_value=str(temp_path)),
            patch("app.downloader.yt_dlp.YoutubeDL", return_value=downloader),
            patch("app.downloader.is_ffmpeg_available", return_value=True),
            patch("app.downloader.require_encoders"),
            patch("app.downloader.run_ffmpeg", side_effect=RuntimeError("conversion failed")),
            self.assertRaises(DownloadPreparationError),
        ):
            download_media("https://www.tiktok.com/@creator/video/123", DownloadQuality.MP3)

        self.assertFalse(temp_path.exists())

    def test_mp3_output_size_limit_is_enforced_after_encoding(self) -> None:
        temp_path = Path(tempfile.mkdtemp(prefix="clipora-test-"))
        downloader = MagicMock()

        def write_download(_url: str, *, download: bool) -> dict[str, object]:
            (temp_path / "123.mp3").write_bytes(b"source audio")
            return {"id": "123", "title": "Public TikTok"}

        def write_large_output(arguments: list[str]) -> None:
            with Path(arguments[-1]).open("wb") as output:
                output.seek(MAX_FILESIZE_BYTES)
                output.write(b"0")

        downloader.__enter__.return_value.extract_info.side_effect = write_download
        with (
            patch("app.downloader.tempfile.mkdtemp", return_value=str(temp_path)),
            patch("app.downloader.yt_dlp.YoutubeDL", return_value=downloader),
            patch("app.downloader.is_ffmpeg_available", return_value=True),
            patch("app.downloader.require_encoders"),
            patch("app.downloader.run_ffmpeg", side_effect=write_large_output),
            self.assertRaises(FileSizeLimitError),
        ):
            download_media("https://www.tiktok.com/@creator/video/123", DownloadQuality.MP3)

        self.assertFalse(temp_path.exists())


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
        self.assertEqual(MAX_FILESIZE_BYTES, 250 * 1024 * 1024)

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

    def test_youtube_challenge_is_not_mapped_to_authentication(self) -> None:
        self.assertIsInstance(
            _map_download_error("Sign in to confirm you're not a bot", ffmpeg_available=True),
            TemporaryUnavailableError,
        )
        self.assertIsInstance(
            _map_download_error("PO Token required", ffmpeg_available=True),
            TemporaryUnavailableError,
        )

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

    def test_mp3_download_selects_the_best_available_audio_source(self) -> None:
        for bitrate in Mp3Bitrate:
            with self.subTest(bitrate=bitrate.value), tempfile.TemporaryDirectory() as directory:
                options, _state = build_ydl_options(
                    DownloadQuality.MP3,
                    Path(directory),
                    ffmpeg_available=True,
                    audio_bitrate=bitrate,
                )
            self.assertEqual(options["format"], "bestaudio/best")
            self.assertNotIn("postprocessors", options)

    def test_mp3_encoder_uses_safe_arguments_for_each_validated_bitrate(self) -> None:
        for bitrate in Mp3Bitrate:
            with self.subTest(bitrate=bitrate.value), tempfile.TemporaryDirectory() as directory:
                temp_path = Path(directory)
                source_path = temp_path / "source.mp3"
                source_path.write_bytes(b"source audio")
                with (
                    patch("app.downloader.require_encoders") as require,
                    patch("app.downloader.run_ffmpeg") as runner,
                ):
                    output_path = _encode_mp3(source_path, temp_path, bitrate)

            require.assert_called_once_with("libmp3lame")
            runner.assert_called_once_with(
                [
                    "-i", str(source_path),
                    "-vn", "-map", "0:a:0", "-map_metadata", "-1",
                    "-c:a", "libmp3lame", "-b:a", f"{bitrate.value}k",
                    str(output_path),
                ]
            )

    def test_mp3_preset_defaults_to_192_kbps(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            options, _state = build_ydl_options(
                DownloadQuality.MP3,
                Path(directory),
                ffmpeg_available=True,
            )
            reason = options["match_filter"]({"duration": 60}, incomplete=False)
        self.assertIsNone(reason)

    def test_mp3_size_estimate_uses_selected_bitrate(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            options, state = build_ydl_options(
                DownloadQuality.MP3,
                Path(directory),
                ffmpeg_available=True,
                audio_bitrate=Mp3Bitrate.KBPS_320,
            )
            reason = options["match_filter"]({"duration": 2 * 60 * 60}, incomplete=False)
        self.assertIsNotNone(reason)
        self.assertEqual(state["reason"], "filesize")

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
