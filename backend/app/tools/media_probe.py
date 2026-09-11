import json
import logging
import shutil
import subprocess
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from .errors import (
    FFmpegUnavailableError,
    InvalidMediaError,
    NoVideoStreamError,
    ProbeFailedError,
    ProcessingTimeoutError,
)


logger = logging.getLogger("clipora.tools.probe")

FFPROBE_TIMEOUT_SECONDS = 30


@dataclass(frozen=True)
class MediaMetadata:
    duration: float | None
    width: int
    height: int
    video_codec: str | None
    audio_codec: str | None
    container: str | None
    bitrate: int | None
    size: int

    @property
    def has_audio(self) -> bool:
        return self.audio_codec is not None


def _positive_float(value: Any) -> float | None:
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        return None
    return parsed if parsed > 0 else None


def _nonnegative_int(value: Any) -> int | None:
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        return None
    return parsed if parsed >= 0 else None


def probe_media(path: Path) -> MediaMetadata:
    executable = shutil.which("ffprobe")
    if not executable:
        raise FFmpegUnavailableError

    command = [
        executable,
        "-v",
        "error",
        "-show_entries",
        "format=duration,format_name,bit_rate:stream=codec_type,codec_name,width,height",
        "-of",
        "json",
        str(path),
    ]
    try:
        completed = subprocess.run(
            command,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=FFPROBE_TIMEOUT_SECONDS,
            check=False,
        )
    except subprocess.TimeoutExpired as exc:
        raise ProcessingTimeoutError from exc
    except OSError as exc:
        raise FFmpegUnavailableError from exc

    if completed.returncode != 0:
        logger.warning("ffprobe rejected an upload: %s", completed.stderr[-4000:])
        raise InvalidMediaError

    try:
        payload = json.loads(completed.stdout)
        streams = payload.get("streams") or []
        format_info = payload.get("format") or {}
    except (json.JSONDecodeError, AttributeError) as exc:
        raise ProbeFailedError from exc

    video_stream = next(
        (stream for stream in streams if isinstance(stream, dict) and stream.get("codec_type") == "video"),
        None,
    )
    if video_stream is None:
        raise NoVideoStreamError
    audio_stream = next(
        (stream for stream in streams if isinstance(stream, dict) and stream.get("codec_type") == "audio"),
        None,
    )

    try:
        size = path.stat().st_size
    except OSError as exc:
        raise ProbeFailedError from exc

    return MediaMetadata(
        duration=_positive_float(format_info.get("duration")),
        width=_nonnegative_int(video_stream.get("width")) or 0,
        height=_nonnegative_int(video_stream.get("height")) or 0,
        video_codec=video_stream.get("codec_name") if isinstance(video_stream.get("codec_name"), str) else None,
        audio_codec=(
            audio_stream.get("codec_name")
            if audio_stream and isinstance(audio_stream.get("codec_name"), str)
            else None
        ),
        container=(
            format_info.get("format_name").split(",", 1)[0]
            if isinstance(format_info.get("format_name"), str)
            else None
        ),
        bitrate=_nonnegative_int(format_info.get("bit_rate")),
        size=size,
    )
