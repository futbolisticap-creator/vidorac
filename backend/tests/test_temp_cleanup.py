import asyncio
import os
import tempfile
import time
import unittest
from pathlib import Path
from unittest.mock import patch

from app.download_registry import PREPARED_DOWNLOAD_TTL, PreparedDownloadRegistry
from app.downloader import DownloadArtifact
from app.main import app, lifespan, prepared_downloads, run_temp_cleanup_pass
from app.temp_files import (
    TEMP_CLEANUP_INTERVAL,
    TEMP_ORPHAN_MAX_AGE,
    cleanup_orphan_temp_directories,
    cleanup_temp_directory,
    create_temp_directory,
    handoff_temp_directory,
)


class MutableClock:
    def __init__(self) -> None:
        self.value = 100.0

    def __call__(self) -> float:
        return self.value


def artifact_in(directory: Path) -> DownloadArtifact:
    path = directory / "media.mp4"
    path.write_bytes(b"temporary media")
    return DownloadArtifact(
        path=path,
        download_name="media.mp4",
        media_type="video/mp4",
        temp_directory=directory,
    )


class TempCleanupTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_root_context = tempfile.TemporaryDirectory(prefix="vidorac-cleanup-tests-")
        self.temp_root = Path(self.temp_root_context.name).resolve()
        self.temp_root_patch = patch(
            "app.temp_files.system_temp_directory",
            return_value=self.temp_root,
        )
        self.temp_root_patch.start()

    def tearDown(self) -> None:
        self.temp_root_patch.stop()
        self.temp_root_context.cleanup()

    def make_directory(self, name: str, *, age_seconds: int) -> Path:
        path = self.temp_root / name
        path.mkdir()
        modified = time.time() - age_seconds
        os.utime(path, (modified, modified))
        return path

    def test_cleanup_constants_match_the_intended_schedule(self) -> None:
        self.assertEqual(PREPARED_DOWNLOAD_TTL, 600)
        self.assertEqual(TEMP_CLEANUP_INTERVAL, 300)
        self.assertEqual(TEMP_ORPHAN_MAX_AGE, 1800)

    def test_expired_download_is_cleaned_without_claim_or_registration(self) -> None:
        clock = MutableClock()
        registry = PreparedDownloadRegistry(clock=clock)
        directory = create_temp_directory("clipora-")
        registry.register(artifact_in(directory))
        clock.value += PREPARED_DOWNLOAD_TTL

        self.assertEqual(registry.cleanup_expired(), 1)
        self.assertFalse(directory.exists())

    def test_recent_vidorac_directory_is_not_removed(self) -> None:
        directory = self.make_directory("clipora-recent", age_seconds=TEMP_ORPHAN_MAX_AGE - 1)

        self.assertEqual(cleanup_orphan_temp_directories(), 0)
        self.assertTrue(directory.exists())

    def test_old_vidorac_orphan_is_removed(self) -> None:
        directory = self.make_directory("clipora-gallery-old", age_seconds=TEMP_ORPHAN_MAX_AGE + 1)

        self.assertEqual(cleanup_orphan_temp_directories(), 1)
        self.assertFalse(directory.exists())

    def test_active_preparation_directory_is_not_removed(self) -> None:
        directory = create_temp_directory("clipora-tool-")
        modified = time.time() - TEMP_ORPHAN_MAX_AGE - 1
        os.utime(directory, (modified, modified))

        self.assertEqual(cleanup_orphan_temp_directories(), 0)
        self.assertTrue(directory.exists())
        cleanup_temp_directory(directory)

    def test_registered_download_directory_is_not_removed(self) -> None:
        registry = PreparedDownloadRegistry()
        directory = create_temp_directory("clipora-")
        registry.register(artifact_in(directory))
        modified = time.time() - TEMP_ORPHAN_MAX_AGE - 1
        os.utime(directory, (modified, modified))

        self.assertEqual(
            cleanup_orphan_temp_directories(
                additionally_protected=registry.temp_directories()
            ),
            0,
        )
        self.assertTrue(directory.exists())
        registry.clear()

    def test_abandoned_handoff_becomes_collectable(self) -> None:
        directory = create_temp_directory("clipora-")
        modified = time.time() - TEMP_ORPHAN_MAX_AGE - 1
        os.utime(directory, (modified, modified))
        handoff_temp_directory(directory)

        self.assertEqual(cleanup_orphan_temp_directories(now=time.time()), 0)
        self.assertTrue(directory.exists())
        self.assertEqual(
            cleanup_orphan_temp_directories(
                now=time.time() + TEMP_CLEANUP_INTERVAL + 1
            ),
            1,
        )
        self.assertFalse(directory.exists())

    def test_unrelated_directory_is_never_removed(self) -> None:
        directory = self.make_directory("unrelated-application", age_seconds=TEMP_ORPHAN_MAX_AGE + 1)

        self.assertEqual(cleanup_orphan_temp_directories(), 0)
        self.assertTrue(directory.exists())

    def test_cleanup_failure_is_logged_without_raising(self) -> None:
        directory = self.make_directory("clipora-old-failure", age_seconds=TEMP_ORPHAN_MAX_AGE + 1)

        with (
            patch("app.temp_files.shutil.rmtree", side_effect=OSError("locked")),
            self.assertLogs("clipora.temp_files", level="WARNING") as logs,
        ):
            self.assertEqual(cleanup_orphan_temp_directories(), 0)

        self.assertTrue(directory.exists())
        self.assertIn("Could not remove Vidorac temporary directory", "\n".join(logs.output))

    def test_periodic_pass_cleans_expired_entries_and_orphans(self) -> None:
        with (
            patch.object(prepared_downloads, "cleanup_expired", return_value=2) as expired,
            patch("app.main.cleanup_orphan_temp_directories", return_value=3) as orphans,
        ):
            self.assertEqual(run_temp_cleanup_pass(), (2, 3))

        expired.assert_called_once_with()
        orphans.assert_called_once_with(
            additionally_protected=prepared_downloads.temp_directories()
        )

    def test_startup_cleanup_runs_and_periodic_task_stops_cleanly(self) -> None:
        old_directory = self.make_directory(
            "clipora-startup-orphan",
            age_seconds=TEMP_ORPHAN_MAX_AGE + 1,
        )
        stopped = False

        async def waiting_cleanup_loop() -> None:
            nonlocal stopped
            try:
                await asyncio.Future()
            finally:
                stopped = True

        async def exercise_lifespan() -> None:
            with patch("app.main.periodic_temp_cleanup", new=waiting_cleanup_loop):
                async with lifespan(app):
                    await asyncio.sleep(0)
                    self.assertFalse(old_directory.exists())

        asyncio.run(exercise_lifespan())
        self.assertTrue(stopped)


if __name__ == "__main__":
    unittest.main()
