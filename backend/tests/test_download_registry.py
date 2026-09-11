import asyncio
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from fastapi.responses import FileResponse, JSONResponse

from app.download_registry import (
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


class PreparedDownloadRegistryTests(unittest.TestCase):
    def setUp(self) -> None:
        self.clock = MutableClock()
        self.registry = PreparedDownloadRegistry(ttl_seconds=900, clock=self.clock)
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

    def test_expired_download_is_deleted(self) -> None:
        download_id, prepared = self.registry.register(make_artifact())
        self.clock.value += 901

        with self.assertRaises(PreparedDownloadExpiredError):
            self.registry.claim(download_id)

        self.assertFalse(prepared.temp_directory.exists())
        self.assertEqual(len(self.registry), 0)

    def test_register_lazily_cleans_expired_downloads(self) -> None:
        _old_id, old = self.registry.register(make_artifact("old.mp4"))
        self.clock.value += 901
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
                prepare_download(DownloadRequest(url="https://youtu.be/test", quality="720"))
            )

        self.assertTrue(response["success"])
        self.assertEqual(response["filename"], "Safe title.mp4")
        self.assertRegex(str(response["download_id"]), r"^[0-9a-f]{32}$")
        self.assertNotIn("path", response)
        self.assertNotIn("temp_directory", response)

    def test_gallery_prepare_passes_only_validated_indices_to_backend(self) -> None:
        artifact = make_artifact("Selected post.zip")
        with patch("app.main.download_gallery_post", return_value=artifact) as gallery:
            response = asyncio.run(
                prepare_download(
                    DownloadRequest(
                        url="https://www.instagram.com/p/ABC123/",
                        item_indices=[0, 2],
                        archive=True,
                    )
                )
            )

        self.assertTrue(response["success"])
        gallery.assert_called_once_with(
            "https://www.instagram.com/p/ABC123/",
            [0, 2],
            force_archive=True,
        )

    def test_preparing_again_creates_a_new_download_id(self) -> None:
        with patch("app.main.download_media", side_effect=[make_artifact("first.mp4"), make_artifact("second.mp4")]):
            first = asyncio.run(prepare_download(DownloadRequest(url="https://youtu.be/test", quality="best")))
            second = asyncio.run(prepare_download(DownloadRequest(url="https://youtu.be/test", quality="best")))

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

    def test_missing_delivery_file_is_controlled(self) -> None:
        download_id, prepared = prepared_downloads.register(make_artifact())
        prepared.path.unlink()

        response = asyncio.run(deliver_download(download_id))

        self.assertIsInstance(response, JSONResponse)
        self.assertEqual(response.status_code, 410)
        self.assertEqual(json.loads(response.body)["success"], False)


if __name__ == "__main__":
    unittest.main()
