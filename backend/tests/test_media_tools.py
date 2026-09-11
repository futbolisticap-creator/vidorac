import asyncio
import io
import json
import subprocess
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from fastapi import UploadFile
from starlette.datastructures import Headers

from app.download_registry import cleanup_prepared_download
from app.main import prepared_downloads, register_tool_result
from app.tools.compressor import (
    COMPRESSION_CRF,
    CompressionQuality,
    compress_video,
    parse_compression_quality,
)
from app.tools.converter import ConversionFormat, convert_video, parse_conversion_format
from app.tools.errors import (
    InvalidMediaError,
    InvalidToolOptionError,
    InvalidTrimRangeError,
    NoAudioStreamError,
    NoVideoStreamError,
    ProcessingFailedError,
    UnsupportedUploadError,
    UploadTooLargeError,
)
from app.tools.ffmpeg_runner import run_ffmpeg
from app.tools.media_probe import MediaMetadata, probe_media
from app.tools.trimmer import trim_video, validate_trim_range
from app.tools.upload_utils import UploadedMedia, derived_download_name, save_upload


def upload_file(data: bytes, filename: str = "sample.mp4", content_type: str = "video/mp4") -> UploadFile:
    return UploadFile(
        file=io.BytesIO(data),
        filename=filename,
        headers=Headers({"content-type": content_type}),
    )


def saved_media(filename: str = "sample.mp4") -> UploadedMedia:
    directory = Path(tempfile.mkdtemp(prefix="clipora-tools-test-"))
    path = directory / "input.mp4"
    path.write_bytes(b"source-video")
    return UploadedMedia(path=path, temp_directory=directory, original_filename=filename, size=path.stat().st_size)


def media_metadata(*, has_audio: bool = True, duration: float = 20.0) -> MediaMetadata:
    return MediaMetadata(
        duration=duration,
        width=1280,
        height=720,
        video_codec="h264",
        audio_codec="aac" if has_audio else None,
        container="mov",
        bitrate=1_000_000,
        size=12,
    )


def write_mock_output(arguments: list[str]) -> None:
    Path(arguments[-1]).write_bytes(b"processed-media")


class UploadTests(unittest.TestCase):
    def test_upload_is_streamed_and_rejected_over_limit(self) -> None:
        with patch("app.tools.upload_utils.MAX_FILESIZE_BYTES", 4):
            with self.assertRaises(UploadTooLargeError):
                asyncio.run(save_upload(upload_file(b"12345")))

    def test_disallowed_extension_is_rejected_before_temp_creation(self) -> None:
        with patch("app.tools.upload_utils.tempfile.mkdtemp") as make_temp:
            with self.assertRaises(UnsupportedUploadError):
                asyncio.run(save_upload(upload_file(b"payload", filename="malware.exe")))
            make_temp.assert_not_called()

    def test_fake_renamed_mp4_is_rejected_by_real_ffprobe(self) -> None:
        directory = Path(tempfile.mkdtemp(prefix="clipora-fake-test-"))
        path = directory / "fake.mp4"
        path.write_text("this is not a video", encoding="utf-8")
        try:
            with self.assertRaises(InvalidMediaError):
                probe_media(path)
        finally:
            for child in directory.iterdir():
                child.unlink()
            directory.rmdir()

    def test_audio_only_probe_is_rejected_as_no_video(self) -> None:
        completed = subprocess.CompletedProcess(
            args=[],
            returncode=0,
            stdout=json.dumps({"streams": [{"codec_type": "audio", "codec_name": "aac"}], "format": {}}),
            stderr="",
        )
        with patch("app.tools.media_probe.subprocess.run", return_value=completed):
            with self.assertRaises(NoVideoStreamError):
                probe_media(Path(__file__))


class CompressionTests(unittest.TestCase):
    def test_presets_use_documented_crf_values(self) -> None:
        self.assertEqual(
            COMPRESSION_CRF,
            {
                CompressionQuality.LIGHT: 20,
                CompressionQuality.BALANCED: 24,
                CompressionQuality.STRONG: 28,
            },
        )

        for quality, expected_crf in COMPRESSION_CRF.items():
            with self.subTest(quality=quality):
                upload = saved_media()
                with (
                    patch("app.tools.compressor.probe_media", return_value=media_metadata()),
                    patch("app.tools.compressor.require_encoders"),
                    patch("app.tools.compressor.run_ffmpeg", side_effect=write_mock_output) as ffmpeg,
                ):
                    result = compress_video(upload, quality)
                arguments = ffmpeg.call_args.args[0]
                self.assertEqual(arguments[arguments.index("-crf") + 1], str(expected_crf))
                prepared_id, prepared = prepared_downloads.register(result.artifact)
                self.assertRegex(prepared_id, r"^[0-9a-f]{32}$")
                cleanup_prepared_download(prepared_downloads.claim(prepared_id))

    def test_invalid_preset_is_rejected(self) -> None:
        with self.assertRaises(InvalidToolOptionError):
            parse_compression_quality("ultra")

    def test_processing_failure_cleans_upload(self) -> None:
        upload = saved_media()
        with (
            patch("app.tools.compressor.probe_media", return_value=media_metadata()),
            patch("app.tools.compressor.require_encoders"),
            patch("app.tools.compressor.run_ffmpeg", side_effect=ProcessingFailedError),
            self.assertRaises(ProcessingFailedError),
        ):
            compress_video(upload, CompressionQuality.BALANCED)
        self.assertFalse(upload.temp_directory.exists())


class ConversionTests(unittest.TestCase):
    def test_only_supported_formats_are_accepted(self) -> None:
        for value in ("mp4", "webm", "mp3"):
            self.assertEqual(parse_conversion_format(value).value, value)
        with self.assertRaises(InvalidToolOptionError):
            parse_conversion_format("exe")

    def test_each_conversion_uses_a_fixed_encoder_set(self) -> None:
        expected_video_encoder = {
            ConversionFormat.MP4: "libx264",
            ConversionFormat.WEBM: "libvpx-vp9",
            ConversionFormat.MP3: "libmp3lame",
        }
        for output_format, encoder in expected_video_encoder.items():
            with self.subTest(output_format=output_format):
                upload = saved_media()
                with (
                    patch("app.tools.converter.probe_media", return_value=media_metadata()),
                    patch("app.tools.converter.require_encoders") as require,
                    patch("app.tools.converter.run_ffmpeg", side_effect=write_mock_output),
                ):
                    result = convert_video(upload, output_format)
                self.assertIn(encoder, require.call_args.args)
                self.assertTrue(result.artifact.download_name.endswith(f".{output_format.value}"))
                cleanup_prepared_download(
                    prepared_downloads.claim(prepared_downloads.register(result.artifact)[0])
                )

    def test_mp3_requires_audio_stream(self) -> None:
        upload = saved_media()
        with (
            patch("app.tools.converter.probe_media", return_value=media_metadata(has_audio=False)),
            self.assertRaises(NoAudioStreamError),
        ):
            convert_video(upload, ConversionFormat.MP3)
        self.assertFalse(upload.temp_directory.exists())


class TrimTests(unittest.TestCase):
    def test_invalid_ranges_are_rejected(self) -> None:
        for start, end, duration in ((-1, 2, 10), (5, 5, 10), (6, 5, 10), (0, 11, 10)):
            with self.subTest(start=start, end=end, duration=duration):
                with self.assertRaises(InvalidTrimRangeError):
                    validate_trim_range(start, end, duration)

    def test_trim_uses_requested_duration_and_safe_filename(self) -> None:
        upload = saved_media("../CON:<clip>.mp4")
        with (
            patch("app.tools.trimmer.probe_media", return_value=media_metadata(duration=20)),
            patch("app.tools.trimmer.require_encoders"),
            patch("app.tools.trimmer.run_ffmpeg", side_effect=write_mock_output) as ffmpeg,
        ):
            result = trim_video(upload, 5, 10)
        arguments = ffmpeg.call_args.args[0]
        self.assertEqual(arguments[arguments.index("-t") + 1], "5.000")
        self.assertNotIn("/", result.artifact.download_name)
        self.assertNotIn("\\", result.artifact.download_name)
        cleanup_prepared_download(
            prepared_downloads.claim(prepared_downloads.register(result.artifact)[0])
        )


class ProcessSafetyTests(unittest.TestCase):
    def test_ffmpeg_command_is_an_argument_list_without_shell(self) -> None:
        completed = subprocess.CompletedProcess(args=[], returncode=0, stdout="", stderr="")
        with (
            patch("app.tools.ffmpeg_runner._ffmpeg_executable", return_value="ffmpeg"),
            patch("app.tools.ffmpeg_runner.subprocess.run", return_value=completed) as process,
        ):
            run_ffmpeg(["-version"])
        command = process.call_args.args[0]
        self.assertIsInstance(command, list)
        self.assertNotIn("shell", process.call_args.kwargs)

    def test_derived_filename_never_reuses_a_client_path(self) -> None:
        upload = saved_media("safe.mp4")
        try:
            name = derived_download_name(upload, "converted", "webm")
            self.assertEqual(name, "safe-converted.webm")
        finally:
            for child in upload.temp_directory.iterdir():
                child.unlink()
            upload.temp_directory.rmdir()

    def test_tool_result_uses_shared_registry_without_exposing_paths(self) -> None:
        upload = saved_media()
        with (
            patch("app.tools.compressor.probe_media", return_value=media_metadata()),
            patch("app.tools.compressor.require_encoders"),
            patch("app.tools.compressor.run_ffmpeg", side_effect=write_mock_output),
        ):
            result = compress_video(upload, CompressionQuality.BALANCED)
        response = register_tool_result(result)
        self.assertNotIn("path", response)
        self.assertNotIn("temp_directory", response)
        cleanup_prepared_download(prepared_downloads.claim(str(response["download_id"])))


if __name__ == "__main__":
    unittest.main()
