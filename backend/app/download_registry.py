import re
import secrets
import shutil
import threading
import time
from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path

from .downloader import DownloadArtifact


PREPARED_DOWNLOAD_TTL = 15 * 60
DOWNLOAD_ID_PATTERN = re.compile(r"^[0-9a-f]{32}$")


class PreparedDownloadNotFoundError(LookupError):
    pass


class PreparedDownloadExpiredError(LookupError):
    pass


class PreparedDownloadFileMissingError(RuntimeError):
    pass


@dataclass(frozen=True)
class PreparedDownload:
    path: Path
    filename: str
    content_type: str
    temp_directory: Path
    created_at: float


def cleanup_temp_directory(temp_directory: Path) -> None:
    shutil.rmtree(temp_directory, ignore_errors=True)


def cleanup_prepared_download(download: PreparedDownload) -> None:
    cleanup_temp_directory(download.temp_directory)


class PreparedDownloadRegistry:
    """Thread-safe, process-local registry for one-time prepared files."""

    def __init__(
        self,
        *,
        ttl_seconds: float = PREPARED_DOWNLOAD_TTL,
        clock: Callable[[], float] = time.monotonic,
    ) -> None:
        if ttl_seconds <= 0:
            raise ValueError("ttl_seconds must be positive")
        self._ttl_seconds = ttl_seconds
        self._clock = clock
        self._downloads: dict[str, PreparedDownload] = {}
        self._lock = threading.Lock()

    def register(self, artifact: DownloadArtifact) -> tuple[str, PreparedDownload]:
        self.cleanup_expired()
        prepared = PreparedDownload(
            path=artifact.path,
            filename=artifact.download_name,
            content_type=artifact.media_type,
            temp_directory=artifact.temp_directory,
            created_at=self._clock(),
        )

        with self._lock:
            download_id = secrets.token_hex(16)
            while download_id in self._downloads:
                download_id = secrets.token_hex(16)
            self._downloads[download_id] = prepared

        return download_id, prepared

    def claim(self, download_id: str) -> PreparedDownload:
        # Reject malformed identifiers before running cleanup or touching a path.
        if not DOWNLOAD_ID_PATTERN.fullmatch(download_id):
            raise PreparedDownloadNotFoundError

        now = self._clock()
        expired: list[PreparedDownload] = []
        with self._lock:
            prepared = self._downloads.pop(download_id, None)
            for candidate_id, candidate in list(self._downloads.items()):
                if now - candidate.created_at >= self._ttl_seconds:
                    expired.append(self._downloads.pop(candidate_id))

        for candidate in expired:
            cleanup_prepared_download(candidate)

        if prepared is None:
            raise PreparedDownloadNotFoundError
        if now - prepared.created_at >= self._ttl_seconds:
            cleanup_prepared_download(prepared)
            raise PreparedDownloadExpiredError
        if not prepared.path.is_file():
            cleanup_prepared_download(prepared)
            raise PreparedDownloadFileMissingError

        # The entry has already been removed, so this file can only be claimed once.
        return prepared

    def cleanup_expired(self) -> int:
        now = self._clock()
        expired: list[PreparedDownload] = []
        with self._lock:
            for download_id, prepared in list(self._downloads.items()):
                if now - prepared.created_at >= self._ttl_seconds:
                    expired.append(self._downloads.pop(download_id))

        for prepared in expired:
            cleanup_prepared_download(prepared)
        return len(expired)

    def clear(self) -> int:
        with self._lock:
            prepared_downloads = list(self._downloads.values())
            self._downloads.clear()

        for prepared in prepared_downloads:
            cleanup_prepared_download(prepared)
        return len(prepared_downloads)

    def __len__(self) -> int:
        with self._lock:
            return len(self._downloads)
