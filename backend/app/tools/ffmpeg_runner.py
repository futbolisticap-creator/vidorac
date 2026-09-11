import logging
import shutil
import subprocess
from functools import lru_cache
from pathlib import Path

from .errors import (
    EncoderUnavailableError,
    FFmpegUnavailableError,
    ProcessingFailedError,
    ProcessingTimeoutError,
)


logger = logging.getLogger("clipora.tools.ffmpeg")

FFMPEG_TIMEOUT_SECONDS = 30 * 60
ENCODER_CHECK_TIMEOUT_SECONDS = 15


def _ffmpeg_executable() -> str:
    executable = shutil.which("ffmpeg")
    if not executable:
        raise FFmpegUnavailableError
    return executable


@lru_cache(maxsize=1)
def available_encoders() -> frozenset[str]:
    try:
        completed = subprocess.run(
            [_ffmpeg_executable(), "-hide_banner", "-encoders"],
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=ENCODER_CHECK_TIMEOUT_SECONDS,
            check=False,
        )
    except subprocess.TimeoutExpired as exc:
        raise ProcessingTimeoutError from exc
    except OSError as exc:
        raise FFmpegUnavailableError from exc

    if completed.returncode != 0:
        logger.error("FFmpeg encoder check failed: %s", completed.stderr[-4000:])
        raise FFmpegUnavailableError

    encoders: set[str] = set()
    for line in completed.stdout.splitlines():
        parts = line.split()
        if len(parts) >= 2 and len(parts[0]) == 6:
            encoders.add(parts[1])
    return frozenset(encoders)


def require_encoders(*encoder_names: str) -> None:
    supported = available_encoders()
    if any(name not in supported for name in encoder_names):
        raise EncoderUnavailableError


def run_ffmpeg(arguments: list[str], *, timeout: int = FFMPEG_TIMEOUT_SECONDS) -> None:
    command = [
        _ffmpeg_executable(),
        "-nostdin",
        "-hide_banner",
        "-loglevel",
        "error",
        "-y",
        *arguments,
    ]
    try:
        completed = subprocess.run(
            command,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=timeout,
            check=False,
        )
    except subprocess.TimeoutExpired as exc:
        logger.warning("FFmpeg processing exceeded %s seconds", timeout)
        raise ProcessingTimeoutError from exc
    except OSError as exc:
        raise FFmpegUnavailableError from exc

    if completed.returncode != 0:
        logger.error("FFmpeg processing failed: %s", completed.stderr[-4000:])
        raise ProcessingFailedError


def validate_output(path: Path, *, maximum_size: int) -> int:
    try:
        size = path.stat().st_size
    except OSError as exc:
        raise ProcessingFailedError from exc
    if size <= 0:
        raise ProcessingFailedError
    if size > maximum_size:
        from .errors import UploadTooLargeError

        raise UploadTooLargeError
    return size
