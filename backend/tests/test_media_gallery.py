import json
import subprocess
import tempfile
import unittest
import zipfile
from pathlib import Path
from unittest.mock import MagicMock, patch

from app.analyzer import (
    AnalysisFailedError,
    UnsupportedCollectionUrlError,
    analyze_content,
    ensure_individual_media_url,
)
from app.download_registry import PreparedDownloadRegistry, cleanup_prepared_download
from app.media_gallery import (
    MAX_GALLERY_ITEMS,
    GalleryAnalysisError,
    GalleryAuthenticationError,
    GalleryDownloadError,
    GalleryExtraction,
    GalleryIndexError,
    GalleryItem,
    GallerySizeLimitError,
    GalleryTooManyItemsError,
    InstagramPostTemporarilyUnavailableError,
    _create_safe_zip,
    _download_item,
    _extract_gallery_post_direct,
    _map_gallery_exception,
    _run_gallery_worker,
    _serialize_extraction,
    analyze_gallery_post,
    download_gallery_post,
    extract_gallery_post,
)


def extraction(*extensions: str, title: str = "A post", platform: str = "instagram") -> GalleryExtraction:
    items = tuple(
        GalleryItem(
            url=f"https://cdn.example.com/{index}.{extension}",
            extension=extension,
            kind="image" if extension in {"jpg", "png", "webp"} else "video",
            headers={},
        )
        for index, extension in enumerate(extensions, 1)
    )
    return GalleryExtraction(title, "creator", platform, items)


def mock_data_job(*extensions: str) -> MagicMock:
    result = MagicMock()
    result.exception = None
    result.data_urls = [f"https://cdn.example.com/{index}.{extension}" for index, extension in enumerate(extensions, 1)]
    result.data_meta = [
        {"extension": extension, "username": "creator", "caption": "A public post"}
        for extension in extensions
    ]
    result.data_post = []
    result.run.return_value = 0
    return result


class DetectionTests(unittest.TestCase):
    def test_video_detection_does_not_call_gallery_dl(self) -> None:
        video = {"media_type": "video", "platform": "youtube"}
        with (
            patch("app.analyzer.analyze_media", return_value=video),
            patch("app.media_gallery.analyze_gallery_post") as gallery,
        ):
            self.assertEqual(analyze_content("https://youtu.be/abc"), video)
        gallery.assert_not_called()

    def test_image_detection(self) -> None:
        with patch("app.media_gallery._run_gallery_worker", return_value=extraction("jpg")):
            media = analyze_gallery_post("https://www.instagram.com/p/ABC123/")
        self.assertEqual(media["media_type"], "image")
        self.assertEqual(media["item_count"], 1)

    def test_gallery_detection(self) -> None:
        with patch("app.media_gallery._run_gallery_worker", return_value=extraction("jpg", "webp", "png")):
            media = analyze_gallery_post("https://www.instagram.com/p/ABC123/")
        self.assertEqual(media["media_type"], "gallery")
        self.assertEqual(media["item_count"], 3)
        self.assertEqual([item["index"] for item in media["items"]], [0, 1, 2])
        self.assertEqual([item["type"] for item in media["items"]], ["image", "image", "image"])
        self.assertNotIn("url", media["items"][0])

    def test_mixed_detection(self) -> None:
        with patch("app.media_gallery._run_gallery_worker", return_value=extraction("jpg", "mp4", "png")):
            media = analyze_gallery_post("https://www.instagram.com/p/ABC123/")
        self.assertEqual(media["media_type"], "mixed")
        self.assertEqual([item["type"] for item in media["items"]], ["image", "video", "image"])

    def test_image_and_gallery_detection_on_extended_platforms(self) -> None:
        cases = (
            ("https://x.com/vidorac/status/123", "x", ("jpg",)),
            ("https://reddit.com/gallery/abc123", "reddit", ("jpg", "png")),
            ("https://facebook.com/vidorac/posts/123", "facebook", ("jpg", "mp4")),
        )
        for url, platform, extensions in cases:
            with self.subTest(platform=platform), patch(
                "app.media_gallery._run_gallery_worker",
                return_value=extraction(*extensions, platform=platform),
            ):
                media = analyze_gallery_post(url)
            self.assertEqual(media["platform"], platform)
            self.assertEqual(media["media_type"], "image" if len(extensions) == 1 else ("mixed" if "mp4" in extensions else "gallery"))
            self.assertEqual(media["item_count"], len(extensions))

    def test_x_video_falls_through_from_gallery_to_yt_dlp(self) -> None:
        video = {"media_type": "video", "platform": "x"}
        with (
            patch("app.media_gallery.analyze_gallery_post", side_effect=GalleryAnalysisError) as gallery,
            patch("app.analyzer.analyze_media", return_value=video) as yt,
        ):
            self.assertEqual(analyze_content("https://x.com/vidorac/status/123"), video)
        gallery.assert_called_once()
        yt.assert_called_once()

    def test_tiktok_video_regression_keeps_yt_dlp_first(self) -> None:
        video = {"media_type": "video", "platform": "tiktok"}
        with patch("app.analyzer.analyze_media", return_value=video) as yt:
            self.assertEqual(analyze_content("https://www.tiktok.com/@vidorac/video/123"), video)
        yt.assert_called_once()

    def test_instagram_reel_regression_keeps_yt_dlp_first(self) -> None:
        video = {"media_type": "video", "platform": "instagram"}
        with patch("app.analyzer.analyze_media", return_value=video) as yt:
            self.assertEqual(analyze_content("https://www.instagram.com/reel/ABC123/"), video)
        yt.assert_called_once()

    def test_instagram_gallery_timeout_does_not_chain_another_slow_extractor(self) -> None:
        with (
            patch(
                "app.media_gallery.analyze_gallery_post",
                side_effect=InstagramPostTemporarilyUnavailableError,
            ),
            patch("app.analyzer.analyze_media") as video,
            self.assertRaises(InstagramPostTemporarilyUnavailableError),
        ):
            analyze_content("https://www.instagram.com/p/ABC123/")
        video.assert_not_called()

    def test_image_post_falls_back_after_video_analysis_fails(self) -> None:
        expected = {"media_type": "image", "platform": "instagram"}
        with (
            patch("app.analyzer.analyze_media", side_effect=AnalysisFailedError),
            patch("app.media_gallery.analyze_gallery_post", return_value=expected) as gallery,
        ):
            self.assertEqual(analyze_content("https://www.instagram.com/p/ABC123/"), expected)
        gallery.assert_called_once()

    def test_instagram_login_redirect_is_temporary_not_private(self) -> None:
        error = _map_gallery_exception(
            RuntimeError("HTTP redirect to login page (https://www.instagram.com/accounts/login/)"),
            "instagram",
        )
        self.assertIsInstance(error, InstagramPostTemporarilyUnavailableError)
        self.assertNotIsInstance(error, GalleryAuthenticationError)


class ScopeAndLimitTests(unittest.TestCase):
    def test_rejects_instagram_and_tiktok_profiles(self) -> None:
        cases = (
            ("https://www.instagram.com/creator/", "instagram"),
            ("https://www.instagram.com/explore/tags/video/", "instagram"),
            ("https://www.tiktok.com/@creator", "tiktok"),
            ("https://www.tiktok.com/tag/travel", "tiktok"),
        )
        for url, platform in cases:
            with self.subTest(url=url), self.assertRaises(UnsupportedCollectionUrlError):
                ensure_individual_media_url(url, platform)

    def test_rejects_extended_platform_collections(self) -> None:
        cases = (
            ("https://x.com/vidorac/media", "x"),
            ("https://reddit.com/r/videos", "reddit"),
            ("https://facebook.com/vidorac/photos", "facebook"),
            ("https://facebook.com/media/set/?set=a.123", "facebook"),
        )
        for url, platform in cases:
            with self.subTest(url=url), self.assertRaises(UnsupportedCollectionUrlError):
                ensure_individual_media_url(url, platform)

    def test_rejects_more_than_fifty_items(self) -> None:
        data_job = mock_data_job(*(["jpg"] * (MAX_GALLERY_ITEMS + 1)))
        # Make each URL unique despite the repeated extensions.
        data_job.data_urls = [f"https://cdn.example.com/{index}.jpg" for index in range(MAX_GALLERY_ITEMS + 1)]
        with (
            patch("app.media_gallery.job.DataJob", return_value=data_job),
            self.assertRaises(GalleryTooManyItemsError),
        ):
            _extract_gallery_post_direct("https://www.instagram.com/p/ABC123/")

    def test_rejects_lone_video_from_gallery_engine(self) -> None:
        with (
            patch("app.media_gallery.job.DataJob", return_value=mock_data_job("mp4")),
            self.assertRaises(GalleryAnalysisError),
        ):
            _extract_gallery_post_direct("https://www.instagram.com/p/ABC123/")


class IsolatedGalleryWorkerTests(unittest.TestCase):
    def test_worker_result_is_deserialized(self) -> None:
        process = MagicMock()
        process.returncode = 0
        process.communicate.return_value = (
            json.dumps({"ok": True, "extraction": _serialize_extraction(extraction("jpg"))}),
            "",
        )
        with patch("app.media_gallery.subprocess.Popen", return_value=process):
            result = _run_gallery_worker("https://www.instagram.com/p/ABC123/", "instagram")
        self.assertEqual(result.media_type, "image")
        process.communicate.assert_called_once_with(timeout=20)

    def test_timeout_terminates_worker_without_leaving_it_running(self) -> None:
        process = MagicMock()
        process.communicate.side_effect = [
            subprocess.TimeoutExpired("gallery-worker", 20),
            ("", ""),
        ]
        with (
            patch("app.media_gallery.subprocess.Popen", return_value=process),
            self.assertRaises(InstagramPostTemporarilyUnavailableError),
        ):
            _run_gallery_worker("https://www.instagram.com/p/ABC123/", "instagram")
        process.terminate.assert_called_once()
        process.kill.assert_not_called()

    def test_worker_is_killed_if_graceful_termination_times_out(self) -> None:
        process = MagicMock()
        process.communicate.side_effect = [
            subprocess.TimeoutExpired("gallery-worker", 20),
            subprocess.TimeoutExpired("gallery-worker", 2),
            ("", ""),
        ]
        with (
            patch("app.media_gallery.subprocess.Popen", return_value=process),
            self.assertRaises(InstagramPostTemporarilyUnavailableError),
        ):
            _run_gallery_worker("https://www.instagram.com/p/ABC123/", "instagram")
        process.terminate.assert_called_once()
        process.kill.assert_called_once()

    def test_worker_classifies_instagram_login_redirect(self) -> None:
        process = MagicMock()
        process.returncode = 0
        process.communicate.return_value = (
            json.dumps({"ok": False, "error": "InstagramPostTemporarilyUnavailableError"}),
            "gallery-dl: HTTP redirect to login page",
        )
        with (
            patch("app.media_gallery.subprocess.Popen", return_value=process),
            self.assertRaises(InstagramPostTemporarilyUnavailableError),
        ):
            _run_gallery_worker("https://www.instagram.com/p/ABC123/", "instagram")


class DownloadAndZipTests(unittest.TestCase):
    @staticmethod
    def fake_download(_session, item, destination: Path, _remaining: int) -> int:
        content = f"content-{item.extension}".encode()
        destination.write_bytes(content)
        return len(content)

    def test_single_image_preserves_original_extension(self) -> None:
        with (
            patch("app.media_gallery.extract_gallery_post", return_value=extraction("webp")),
            patch("app.media_gallery._download_item", side_effect=self.fake_download),
        ):
            artifact = download_gallery_post("https://www.instagram.com/p/ABC123/")
        try:
            self.assertEqual(artifact.path.suffix, ".webp")
            self.assertEqual(artifact.media_type, "image/webp")
            self.assertTrue(artifact.path.is_file())
        finally:
            cleanup_prepared_download(PreparedDownloadRegistry().register(artifact)[1])

    def test_gallery_download_creates_ordered_zip(self) -> None:
        with (
            patch("app.media_gallery.extract_gallery_post", return_value=extraction("jpg", "png", "webp")),
            patch("app.media_gallery._download_item", side_effect=self.fake_download),
        ):
            artifact = download_gallery_post("https://www.instagram.com/p/ABC123/")
        try:
            with zipfile.ZipFile(artifact.path) as archive:
                self.assertEqual(archive.namelist(), ["01.jpg", "02.png", "03.webp"])
                self.assertTrue(all("/" not in name and "\\" not in name and ".." not in name for name in archive.namelist()))
        finally:
            cleanup_prepared_download(PreparedDownloadRegistry().register(artifact)[1])

    def test_individual_middle_item_downloads_only_that_item(self) -> None:
        calls: list[str] = []

        def record_download(_session, item, destination: Path, _remaining: int) -> int:
            calls.append(item.url)
            destination.write_bytes(b"selected")
            return 8

        with (
            patch("app.media_gallery.extract_gallery_post", return_value=extraction("jpg", "png", "webp")),
            patch("app.media_gallery._download_item", side_effect=record_download),
        ):
            artifact = download_gallery_post("https://www.instagram.com/p/ABC123/", [1])
        try:
            self.assertEqual(calls, ["https://cdn.example.com/2.png"])
            self.assertEqual(artifact.path.name, "02.png")
            self.assertEqual(artifact.path.suffix, ".png")
            self.assertEqual(artifact.download_name, "A post - Image 2.png")
        finally:
            cleanup_prepared_download(PreparedDownloadRegistry().register(artifact)[1])

    def test_first_and_last_indices_are_valid(self) -> None:
        for index, expected_name in ((0, "01.jpg"), (2, "03.webp")):
            with self.subTest(index=index):
                with (
                    patch("app.media_gallery.extract_gallery_post", return_value=extraction("jpg", "png", "webp")),
                    patch("app.media_gallery._download_item", side_effect=self.fake_download),
                ):
                    artifact = download_gallery_post("https://www.instagram.com/p/ABC123/", [index])
                try:
                    self.assertEqual(artifact.path.name, expected_name)
                finally:
                    cleanup_prepared_download(PreparedDownloadRegistry().register(artifact)[1])

    def test_invalid_indices_are_rejected_before_any_download(self) -> None:
        for indices in ([-1], [3], [], [0, 0]):
            with self.subTest(indices=indices):
                with (
                    patch("app.media_gallery.extract_gallery_post", return_value=extraction("jpg", "png", "webp")),
                    patch("app.media_gallery._download_item") as download,
                    self.assertRaises(GalleryIndexError),
                ):
                    download_gallery_post("https://www.instagram.com/p/ABC123/", indices)
                download.assert_not_called()

    def test_selected_items_create_ordered_zip(self) -> None:
        with (
            patch("app.media_gallery.extract_gallery_post", return_value=extraction("jpg", "png", "webp", "jpg")),
            patch("app.media_gallery._download_item", side_effect=self.fake_download),
        ):
            artifact = download_gallery_post(
                "https://www.instagram.com/p/ABC123/",
                [3, 0, 2],
                force_archive=True,
            )
        try:
            with zipfile.ZipFile(artifact.path) as archive:
                self.assertEqual(archive.namelist(), ["01.jpg", "03.webp", "04.jpg"])
        finally:
            cleanup_prepared_download(PreparedDownloadRegistry().register(artifact)[1])

    def test_individual_mixed_video_item_preserves_original_file(self) -> None:
        with (
            patch("app.media_gallery.extract_gallery_post", return_value=extraction("jpg", "mp4", "png")),
            patch("app.media_gallery._download_item", side_effect=self.fake_download),
        ):
            artifact = download_gallery_post("https://www.instagram.com/p/ABC123/", [1])
        try:
            self.assertEqual(artifact.path.suffix, ".mp4")
            self.assertEqual(artifact.media_type, "video/mp4")
        finally:
            cleanup_prepared_download(PreparedDownloadRegistry().register(artifact)[1])

    def test_mixed_download_stores_video_without_recompression(self) -> None:
        with (
            patch("app.media_gallery.extract_gallery_post", return_value=extraction("jpg", "mp4")),
            patch("app.media_gallery._download_item", side_effect=self.fake_download),
        ):
            artifact = download_gallery_post("https://www.instagram.com/p/ABC123/")
        try:
            with zipfile.ZipFile(artifact.path) as archive:
                video = archive.getinfo("02.mp4")
                self.assertEqual(video.compress_type, zipfile.ZIP_STORED)
        finally:
            cleanup_prepared_download(PreparedDownloadRegistry().register(artifact)[1])

    def test_zip_rejects_files_outside_operation_directory(self) -> None:
        with tempfile.TemporaryDirectory() as root, tempfile.TemporaryDirectory() as outside:
            root_path = Path(root)
            outside_file = Path(outside) / "../escape.jpg"
            outside_file = outside_file.resolve()
            outside_file.write_bytes(b"x")
            with self.assertRaises(GalleryDownloadError):
                _create_safe_zip([outside_file], root_path / "post.zip")

    def test_streaming_download_enforces_total_remaining_size(self) -> None:
        response = MagicMock()
        response.is_redirect = False
        response.is_permanent_redirect = False
        response.status_code = 200
        response.headers = {}
        response.iter_content.return_value = [b"1234", b"5678"]
        session = MagicMock()
        session.get.return_value = response
        with tempfile.TemporaryDirectory() as directory, patch("app.media_gallery._validate_public_download_url"):
            destination = Path(directory) / "01.jpg"
            with self.assertRaises(GallerySizeLimitError):
                _download_item(session, extraction("jpg").items[0], destination, 6)
            self.assertFalse(destination.exists())

    def test_failure_cleans_isolated_temporary_directory(self) -> None:
        made = Path(tempfile.mkdtemp(prefix="clipora-gallery-failure-test-"))
        with (
            patch("app.media_gallery.extract_gallery_post", return_value=extraction("jpg", "png")),
            patch("app.media_gallery.tempfile.mkdtemp", return_value=str(made)),
            patch("app.media_gallery._download_item", side_effect=GalleryDownloadError),
            self.assertRaises(GalleryDownloadError),
        ):
            download_gallery_post("https://www.instagram.com/p/ABC123/")
        self.assertFalse(made.exists())


if __name__ == "__main__":
    unittest.main()
