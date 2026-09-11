import logging
import tempfile
from dataclasses import dataclass
from pathlib import Path

from fastapi import UploadFile

from ..download_registry import cleanup_temp_directory
from ..downloader import MAX_FILESIZE_BYTES, safe_download_name
from .errors import MediaIOError, UnsupportedUploadError, UploadTooLargeError


logger = logging.getLogger("clipora.tools.upload")

UPLOAD_CHUNK_SIZE = 1024 * 1024
ALLOWED_VIDEO_EXTENSIONS = {".mp4", ".mov", ".mkv", ".webm", ".avi", ".m4v"}
ALLOWED_UPLOAD_CONTENT_TYPES = {
    "application/octet-stream",
    "application/x-matroska",
    "video/avi",
    "video/mp4",
    "video/quicktime",
    "video/webm",
    "video/x-m4v",
    "video/x-matroska",
    "video/x-msvideo",
}


@dataclass(frozen=True)
class UploadedMedia:
    path: Path
    temp_directory: Path
    original_filename: str
    size: int


def _client_basename(filename: str | None) -> str:
    return (filename or "").replace("\\", "/").rsplit("/", 1)[-1]


def validate_upload_metadata(file: UploadFile) -> tuple[str, str]:
    basename = _client_basename(file.filename)
    extension = Path(basename).suffix.lower()
    if not basename or extension not in ALLOWED_VIDEO_EXTENSIONS:
        raise UnsupportedUploadError

    content_type = (file.content_type or "").lower()
    if content_type and not (
        content_type.startswith("video/") or content_type in ALLOWED_UPLOAD_CONTENT_TYPES
    ):
        raise UnsupportedUploadError

    safe_name = safe_download_name(Path(basename).stem, extension.lstrip("."))
    return safe_name, extension


async def save_upload(file: UploadFile) -> UploadedMedia:
    safe_name, extension = validate_upload_metadata(file)
    temp_directory = Path(tempfile.mkdtemp(prefix="clipora-tool-"))
    destination = temp_directory / f"input{extension}"
    total_bytes = 0

    try:
        with destination.open("xb") as output:
            while chunk := await file.read(UPLOAD_CHUNK_SIZE):
                total_bytes += len(chunk)
                if total_bytes > MAX_FILESIZE_BYTES:
                    raise UploadTooLargeError
                output.write(chunk)
        if total_bytes == 0:
            raise UnsupportedUploadError
        return UploadedMedia(
            path=destination,
            temp_directory=temp_directory,
            original_filename=safe_name,
            size=total_bytes,
        )
    except (UploadTooLargeError, UnsupportedUploadError):
        cleanup_temp_directory(temp_directory)
        raise
    except BaseException as exc:
        cleanup_temp_directory(temp_directory)
        if not isinstance(exc, Exception):
            raise
        logger.exception("Could not persist an uploaded file")
        raise MediaIOError from exc
    finally:
        await file.close()


def derived_download_name(upload: UploadedMedia, suffix: str, extension: str) -> str:
    original_stem = Path(upload.original_filename).stem
    return safe_download_name(f"{original_stem}-{suffix}", extension)
