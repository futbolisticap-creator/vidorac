import asyncio
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from fastapi import Request
from fastapi.responses import FileResponse, JSONResponse

from app.download_registry import (
    PREPARED_DOWNLOAD_TTL,
    PreparedDownloadExpiredError,
    PreparedDownloadFileMissingError,
    PreparedDownloadNotFoundError,
    PreparedDownloadRegistry,
    cleanup_prepared_download,
)
from app.downloader import DownloadArtifact
from app.main import DownloadRequest, deliver_download, prepare_download, prepared_downloads


class MutableClock:
    def __init__(self) -> None:
        self.value = 100.0

    def __call__(self) -> float:
        return self.value


def make_artifact(filename: str = "Vidorac test.mp4") -> DownloadArtifact:
    temp_directory = Path(tempfile.mkdtemp(prefix="clipora-registry-test-"))
    path = temp_directory / "media.mp4"
    path.write_bytes(b"clipora-test")
    return DownloadArtifact(
        path=path,
        download_name=filename,
        media_type="video/mp4",
        temp_directory=temp_directory,
    )


def make_http_request() -> Request:
    return Request({"type": "http", "method": "POST", "path": "/api/download/prepare", "headers": [], "client": ("127.0.0.1", 12345)})


class PreparedDownloadRegistryTests(unittest.TestCase):
    def setUp(self) -> None:
        self.clock = MutableClock()
        self.registry = PreparedDownloadRegistry(ttl_seconds=PREPARED_DOWNLOAD_TTL, clock=self.clock)
        self.claimed = []

    def tearDown(self) -> None:
        self.registry.clear()
        for prepared in self.claimed:
            cleanup_prepared_download(prepared)

    def test_registers_download_and_returns_secure_random_id(self) -> None:
        first_id, first = self.registry.register(make_artifact("one.mp4"))
        second_id, second = self.registry.register(make_artifact("two.mp4"))

        self.assertRegex(first_id, r"^[0-9a-f]{32}$")
        self.assertNotEqual(first_id, second_id)
        self.assertEqual(first.filename, "one.mp4")
        self.assertEqual(second.content_type, "video/mp4")
        self.assertEqual(len(self.registry), 2)

    def test_invalid_id_does_not_touch_registered_files(self) -> None:
        _download_id, prepared = self.registry.register(make_artifact())

        with self.assertRaises(PreparedDownloadNotFoundError):
            self.registry.claim("../../media.mp4")

        self.assertTrue(prepared.path.exists())
        self.assertEqual(len(self.registry), 1)

    def test_well_formed_unknown_id_is_not_found(self) -> None:
        with self.assertRaises(PreparedDownloadNotFoundError):
            self.registry.claim("0" * 32)

    def test_download_is_single_use(self) -> None:
        download_id, _prepared = self.registry.register(make_artifact())
        claimed = self.registry.claim(download_id)
        self.claimed.append(claimed)

        with self.assertRaises(PreparedDownloadNotFoundError):
            self.registry.claim(download_id)

    def test_download_remains_valid_before_ten_minutes(self) -> None:
        download_id, _prepared = self.registry.register(make_artifact())
        self.clock.value += PREPARED_DOWNLOAD_TTL - 1

        claimed = self.registry.claim(download_id)
        self.claimed.append(claimed)
        self.assertTrue(claimed.path.exists())

    def test_expired_download_is_deleted(self) -> None:
        download_id, prepared = self.registry.register(make_artifact())
        self.clock.value += PREPARED_DOWNLOAD_TTL

        with self.assertRaises(PreparedDownloadExpiredError):
            self.registry.claim(download_id)

        self.assertFalse(prepared.temp_directory.exists())
        self.assertEqual(len(self.registry), 0)

    def test_register_lazily_cleans_expired_downloads(self) -> None:
        _old_id, old = self.registry.register(make_artifact("old.mp4"))
        self.clock.value += PREPARED_DOWNLOAD_TTL
        _new_id, _new = self.registry.register(make_artifact("new.mp4"))

        self.assertFalse(old.temp_directory.exists())
        self.assertEqual(len(self.registry), 1)

    def test_missing_file_returns_controlled_error_and_cleans_directory(self) -> None:
        download_id, prepared = self.registry.register(make_artifact())
        prepared.path.unlink()

        with self.assertRaises(PreparedDownloadFileMissingError):
            self.registry.claim(download_id)

        self.assertFalse(prepared.temp_directory.exists())


class DownloadEndpointTests(unittest.TestCase):
    def tearDown(self) -> None:
        prepared_downloads.clear()

    def test_prepare_response_exposes_no_filesystem_path(self) -> None:
        artifact = make_artifact("Safe title.mp4")
        with patch("app.main.download_media", return_value=artifact):
            response = asyncio.run(
                prepare_download(DownloadRequest(url="https://www.tiktok.com/@creator/video/123", platform="tiktok", quality="720"), make_http_request())
            )

        self.assertTrue(response["success"])
        self.assertEqual(response["filename"], "Safe title.mp4")
        self.assertRegex(str(response["download_id"]), r"^[0-9a-f]{32}$")
        self.assertNotIn("path", response)
        self.assertNotIn("temp_directory", response)

    def test_prepare_rejects_a_cross_platform_url_before_extraction(self) -> None:
        with (
            patch("app.main.preparation_rate_limiter.allow", return_value=True),
            patch("app.main.download_media") as downloader,
        ):
            response = asyncio.run(
                prepare_download(
                    DownloadRequest(
                        url="https://www.tiktok.com/@creator/video/123",
                        platform="reddit",
                        quality="best",
                    ),
                    make_http_request(),
                )
            )

        self.assertIsInstance(response, JSONResponse)
        self.assertEqual(response.status_code, 400)
        payload = json.loads(response.body)
        self.assertEqual(payload["error_code"], "wrong_platform")
        self.assertEqual(payload["expected_platform"], "reddit")
        self.assertEqual(payload["detected_platform"], "tiktok")
        downloader.assert_not_called()

    def test_gallery_prepare_passes_only_validated_indices_to_backend(self) -> None:
        artifact = make_artifact("Selected post.zip")
        with patch("app.main.download_gallery_post", return_value=artifact) as gallery:
            response = asyncio.run(
                prepare_download(
                    DownloadRequest(
                        url="https://www.instagram.com/p/ABC123/",
                        platform="instagram",
                        item_indices=[0, 2],
                        archive=True,
                    ),
                    make_http_request(),
                )
            )

        self.assertTrue(response["success"])
        gallery.assert_called_once_with(
            "https://www.instagram.com/p/ABC123/",
            [0, 2],
            force_archive=True,
        )

    def test_mp3_prepare_passes_each_validated_bitrate_to_downloader(self) -> None:
        from app.downloader import DownloadQuality, Mp3Bitrate

        for bitrate in (128, 192, 320):
            with self.subTest(bitrate=bitrate), patch(
                "app.main.download_media",
                return_value=make_artifact(f"audio-{bitrate}.mp3"),
            ) as downloader:
                response = asyncio.run(
                    prepare_download(
                        DownloadRequest(
                            url="https://www.tiktok.com/@creator/video/123",
                            platform="tiktok",
                            quality="mp3",
                            audio_bitrate=bitrate,
                        ),
                        make_http_request(),
                    )
                )

            self.assertTrue(response["success"])
            downloader.assert_called_once_with(
                "https://www.tiktok.com/@creator/video/123",
                DownloadQuality.MP3,
                Mp3Bitrate(bitrate),
            )

    def test_preparing_again_creates_a_new_download_id(self) -> None:
        with patch("app.main.download_media", side_effect=[make_artifact("first.mp4"), make_artifact("second.mp4")]):
            first = asyncio.run(prepare_download(DownloadRequest(url="https://www.tiktok.com/@creator/video/123", platform="tiktok", quality="best"), make_http_request()))
            second = asyncio.run(prepare_download(DownloadRequest(url="https://www.tiktok.com/@creator/video/123", platform="tiktok", quality="best"), make_http_request()))

        self.assertNotEqual(first["download_id"], second["download_id"])

    def test_delivery_returns_attachment_and_invalidates_id(self) -> None:
        download_id, _prepared = prepared_downloads.register(make_artifact("Native.mp4"))
        response = asyncio.run(deliver_download(download_id))

        self.assertIsInstance(response, FileResponse)
        self.assertIn("attachment", response.headers["content-disposition"])
        second = asyncio.run(deliver_download(download_id))
        self.assertIsInstance(second, JSONResponse)
        self.assertEqual(second.status_code, 404)
        if response.background is not None:
            asyncio.run(response.background())

    def test_interrupted_file_response_still_cleans_temporary_directory(self) -> None:
        download_id, prepared = prepared_downloads.register(make_artifact("Interrupted.mp4"))
        response = asyncio.run(deliver_download(download_id))

        async def receive() -> dict[str, str]:
            return {"type": "http.disconnect"}

        async def disconnected_send(_message: dict[str, object]) -> None:
            raise ConnectionError("client disconnected")

        async def stream() -> None:
            await response(
                {"type": "http", "method": "GET", "headers": []},
                receive,
                disconnected_send,
            )

        with self.assertRaises(ConnectionError):
            asyncio.run(stream())
        self.assertFalse(prepared.temp_directory.exists())

    def test_missing_delivery_file_is_controlled(self) -> None:
        download_id, prepared = prepared_downloads.register(make_artifact())
        prepared.path.unlink()

        response = asyncio.run(deliver_download(download_id))

        self.assertIsInstance(response, JSONResponse)
        self.assertEqual(response.status_code, 410)
        self.assertEqual(json.loads(response.body)["success"], False)


if __name__ == "__main__":
    unittest.main()
