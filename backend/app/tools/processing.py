import logging
from contextlib import contextmanager
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterator

from ..downloader import DownloadArtifact, MAX_FILESIZE_BYTES
from ..temp_files import cleanup_temp_directory, handoff_temp_directory
from .ffmpeg_runner import validate_output
from .upload_utils import UploadedMedia, derived_download_name


logger = logging.getLogger("clipora.tools.processing")

CONTENT_TYPES = {
    "mp3": "audio/mpeg",
    "mp4": "video/mp4",
    "webm": "video/webm",
}


@dataclass(frozen=True)
class ToolResult:
    artifact: DownloadArtifact
    metadata: dict[str, Any]


@contextmanager
def cleanup_upload_on_error(upload: UploadedMedia) -> Iterator[None]:
    try:
        yield
    except BaseException:
        cleanup_temp_directory(upload.temp_directory)
        raise


def finalize_output(
    upload: UploadedMedia,
    output_path: Path,
    *,
    name_suffix: str,
    extension: str,
) -> tuple[DownloadArtifact, int]:
    output_size = validate_output(output_path, maximum_size=MAX_FILESIZE_BYTES)
    try:
        upload.path.unlink(missing_ok=True)
    except OSError:
        logger.warning("Could not remove tool input before registering output")

    artifact = DownloadArtifact(
        path=output_path,
        download_name=derived_download_name(upload, name_suffix, extension),
        media_type=CONTENT_TYPES[extension],
        temp_directory=upload.temp_directory,
    )
    handoff_temp_directory(upload.temp_directory)
    return artifact, output_size
