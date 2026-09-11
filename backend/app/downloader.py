import logging
import mimetypes
import re
import shutil
import tempfile
import unicodedata
from collections.abc import Callable, Iterable, Mapping
from dataclasses import dataclass
from enum import Enum
from pathlib import Path
from typing import Any

from .tls_certs import configure_windows_ca_bundle

configure_windows_ca_bundle()

import yt_dlp

from .analyzer import ensure_individual_media_url, validate_and_classify_url
from .format_presets import infer_output_container, select_streams


logger = logging.getLogger("clipora.downloader")

MAX_DURATION_SECONDS = 3 * 60 * 60
MAX_FILESIZE_BYTES = 1024 * 1024 * 1024
MAX_FILENAME_LENGTH = 120
WINDOWS_RESERVED_NAMES = {
    "CON",
    "PRN",
    "AUX",
    "NUL",
    "CLOCK$",
    *(f"COM{index}" for index in range(1, 10)),
    *(f"LPT{index}" for index in range(1, 10)),
}


class DownloadQuality(str, Enum):
    BEST = "best"
    COMPATIBLE = "compatible"
    HD_1080 = "1080"
    HD_720 = "720"
    SD_480 = "480"
    MP3 = "mp3"


class DownloadPreparationError(RuntimeError):
    pass


class FFmpegRequiredError(DownloadPreparationError):
    pass


class FormatUnavailableError(DownloadPreparationError):
    pass


class MediaUnavailableError(DownloadPreparationError):
    pass


class NetworkTimeoutError(DownloadPreparationError):
    pass


class TemporaryUnavailableError(DownloadPreparationError):
    pass


class SourceBlockedError(DownloadPreparationError):
    pass


class ContentRemovedError(MediaUnavailableError):
    pass


class ExtractorChangedError(DownloadPreparationError):
    pass


class AuthenticationRequiredError(DownloadPreparationError):
    pass


class DurationLimitError(DownloadPreparationError):
    pass


class FileSizeLimitError(DownloadPreparationError):
    pass


@dataclass(frozen=True)
class DownloadArtifact:
    path: Path
    download_name: str
    media_type: str
    temp_directory: Path


def is_ffmpeg_available() -> bool:
    return shutil.which("ffmpeg") is not None and shutil.which("ffprobe") is not None


def safe_download_name(title: Any, extension: str) -> str:
    raw_title = title if isinstance(title, str) else "Vidorac download"
    normalized = unicodedata.normalize("NFKC", raw_title)
    cleaned = re.sub(r'[<>:"/\\|?*\x00-\x1f]', " ", normalized)
    cleaned = re.sub(r"\s+", " ", cleaned).strip(" .")
    device_name = cleaned.split(".", 1)[0].upper()
    if not cleaned or device_name in WINDOWS_RESERVED_NAMES:
        cleaned = "Vidorac download"
    cleaned = cleaned[:MAX_FILENAME_LENGTH].rstrip(" .")
    return f"{cleaned}.{extension}"


def _media_type_for(path: Path) -> str:
    known_types = {
        ".mp3": "audio/mpeg",
        ".mp4": "video/mp4",
        ".mkv": "video/x-matroska",
        ".webm": "video/webm",
        ".mov": "video/quicktime",
    }
    return known_types.get(path.suffix.lower()) or mimetypes.guess_type(path.name)[0] or "application/octet-stream"


def _find_output_file(temp_directory: Path, quality: DownloadQuality) -> Path:
    ignored_suffixes = {".part", ".ytdl", ".json", ".description"}
    candidates = [
        path
        for path in temp_directory.iterdir()
        if path.is_file() and path.suffix.lower() not in ignored_suffixes
    ]
    if quality is DownloadQuality.MP3:
        candidates = [path for path in candidates if path.suffix.lower() == ".mp3"]
    else:
        candidates = [
            path
            for path in candidates
            if path.suffix.lower() in {".mp4", ".mkv", ".webm", ".mov"}
        ]
    if not candidates:
        raise FormatUnavailableError
    return max(candidates, key=lambda path: path.stat().st_size)


def _map_download_error(message: str, *, ffmpeg_available: bool) -> DownloadPreparationError:
    lowered = message.lower()
    if any(term in lowered for term in ("timed out", "timeout", "connection reset", "network is unreachable")):
        return NetworkTimeoutError()
    if any(term in lowered for term in ("not a bot", "anti-bot", "po token", "pot required", "po-token")):
        return TemporaryUnavailableError()
    if any(term in lowered for term in ("403", "429", "too many requests", "ip address is blocked", "ip blocked")):
        return SourceBlockedError()
    if any(term in lowered for term in ("http error 404", "status code 404", "not found")):
        return ContentRemovedError()
    if any(term in lowered for term in ("unexpected response from webpage request", "challenge failure", "impersonation unavailable", "impersonation dependency")):
        return TemporaryUnavailableError()
    if any(term in lowered for term in ("temporarily unavailable", "try again later", "http error 502", "http error 503", "http error 504")):
        return TemporaryUnavailableError()
    if "ffmpeg" in lowered or "ffprobe" in lowered:
        return FFmpegRequiredError()
    if "requested format is not available" in lowered or "no video formats" in lowered:
        if not ffmpeg_available:
            return FFmpegRequiredError()
        return FormatUnavailableError()
    if any(term in lowered for term in ("sign in", "login required", "authentication", "private video", "members-only")):
        return AuthenticationRequiredError()
    if any(term in lowered for term in ("removed", "deleted", "does not exist")):
        return ContentRemovedError()
    if any(term in lowered for term in ("unable to extract", "extractor", "unsupported url")):
        return ExtractorChangedError()
    if any(term in lowered for term in ("unavailable", "not available", "geo-restricted", "geoblocked")):
        return MediaUnavailableError()
    return DownloadPreparationError()


def build_orientation_aware_format_selector(
    quality: DownloadQuality,
    *,
    ffmpeg_available: bool,
) -> Callable[[dict[str, Any]], Iterable[dict[str, Any]]]:
    """Select the same orientation-aware streams advertised by the analyzer."""

    def format_selector(context: dict[str, Any]) -> Iterable[dict[str, Any]]:
        formats = [
            item
            for item in context.get("formats") or []
            if isinstance(item, Mapping)
        ]
        selection = select_streams(
            formats,
            quality.value,
            ffmpeg_available=ffmpeg_available,
        )
        if selection is None:
            return

        video = dict(selection.video)
        if selection.audio is None:
            yield video
            return

        audio = dict(selection.audio)
        video_id = str(video.get("format_id") or "video")
        audio_id = str(audio.get("format_id") or "audio")
        video_protocol = str(video.get("protocol") or "https")
        audio_protocol = str(audio.get("protocol") or "https")
        output_extension = infer_output_container(selection) or str(video.get("ext") or "mkv")
        if quality is DownloadQuality.COMPATIBLE:
            output_extension = "mp4"
        yield {
            "format_id": f"{video_id}+{audio_id}",
            "ext": output_extension,
            "requested_formats": [video, audio],
            "protocol": f"{video_protocol}+{audio_protocol}",
        }

    return format_selector


def build_ydl_options(
    quality: DownloadQuality,
    temp_directory: Path,
    *,
    ffmpeg_available: bool,
) -> tuple[dict[str, Any], dict[str, str | None]]:
    limit_state: dict[str, str | None] = {"reason": None}

    def match_filter(info: dict[str, Any], *, incomplete: bool = False) -> str | None:
        if incomplete:
            return None
        duration = info.get("duration")
        if isinstance(duration, (int, float)) and duration > MAX_DURATION_SECONDS:
            limit_state["reason"] = "duration"
            return "Video exceeds Vidorac's duration limit"
        return None

    def progress_hook(status: dict[str, Any]) -> None:
        if status.get("status") not in {"downloading", "finished"}:
            return
        reported_sizes = [
            status.get("downloaded_bytes"),
            status.get("total_bytes"),
            status.get("total_bytes_estimate"),
        ]
        actual_size = sum(
            path.stat().st_size
            for path in temp_directory.iterdir()
            if path.is_file()
        )
        if actual_size > MAX_FILESIZE_BYTES or any(
            isinstance(size, (int, float)) and size > MAX_FILESIZE_BYTES
            for size in reported_sizes
        ):
            limit_state["reason"] = "filesize"
            raise yt_dlp.utils.DownloadCancelled("Download exceeds Vidorac's file-size limit")

    options: dict[str, Any] = {
        "quiet": True,
        "no_warnings": True,
        "noprogress": True,
        "noplaylist": True,
        "playlistend": 1,
        "socket_timeout": 15,
        "retries": 2,
        "fragment_retries": 2,
        "extractor_retries": 2,
        "cachedir": False,
        "compat_opts": {"no-certifi"},
        "overwrites": True,
        "windowsfilenames": True,
        "outtmpl": str(temp_directory / "%(id)s.%(ext)s"),
        "max_filesize": MAX_FILESIZE_BYTES,
        "match_filter": match_filter,
        "progress_hooks": [progress_hook],
    }

    if quality is DownloadQuality.MP3:
        if not ffmpeg_available:
            raise FFmpegRequiredError
        options.update(
            {
                "format": "bestaudio/best",
                "final_ext": "mp3",
                "postprocessors": [
                    {
                        "key": "FFmpegExtractAudio",
                        "preferredcodec": "mp3",
                        "preferredquality": "192",
                    }
                ],
            }
        )
    else:
        options["format"] = build_orientation_aware_format_selector(
            quality,
            ffmpeg_available=ffmpeg_available,
        )
        if ffmpeg_available:
            options["merge_output_format"] = "mp4" if quality is DownloadQuality.COMPATIBLE else "mp4/mkv"

    return options, limit_state


def download_media(raw_url: str, quality: DownloadQuality) -> DownloadArtifact:
    url, platform = validate_and_classify_url(raw_url)
    ensure_individual_media_url(url, platform)
    temp_directory = Path(tempfile.mkdtemp(prefix="clipora-"))
    ffmpeg_available = is_ffmpeg_available()

    try:
        options, limit_state = build_ydl_options(
            quality,
            temp_directory,
            ffmpeg_available=ffmpeg_available,
        )
        with yt_dlp.YoutubeDL(options) as ydl:
            info = ydl.extract_info(url, download=True)

        if limit_state["reason"] == "duration":
            raise DurationLimitError
        if limit_state["reason"] == "filesize":
            raise FileSizeLimitError
        if not isinstance(info, dict) or info.get("_type") in {"playlist", "multi_video"} or info.get("entries") is not None:
            raise MediaUnavailableError

        output_path = _find_output_file(temp_directory, quality)
        if output_path.stat().st_size > MAX_FILESIZE_BYTES:
            raise FileSizeLimitError

        extension = output_path.suffix.lower().lstrip(".") or ("mp3" if quality is DownloadQuality.MP3 else "mp4")
        return DownloadArtifact(
            path=output_path,
            download_name=safe_download_name(info.get("title"), extension),
            media_type=_media_type_for(output_path),
            temp_directory=temp_directory,
        )
    except (yt_dlp.utils.DownloadError, yt_dlp.utils.DownloadCancelled) as exc:
        logger.warning("yt-dlp could not prepare %s: %s", url, exc)
        if "limit_state" in locals():
            if limit_state["reason"] == "duration":
                error: DownloadPreparationError = DurationLimitError()
            elif limit_state["reason"] == "filesize":
                error = FileSizeLimitError()
            else:
                error = _map_download_error(str(exc), ffmpeg_available=ffmpeg_available)
        else:
            error = _map_download_error(str(exc), ffmpeg_available=ffmpeg_available)
        shutil.rmtree(temp_directory, ignore_errors=True)
        raise error from exc
    except DownloadPreparationError:
        shutil.rmtree(temp_directory, ignore_errors=True)
        raise
    except Exception as exc:
        logger.exception("Unexpected download error for %s", url)
        shutil.rmtree(temp_directory, ignore_errors=True)
        raise DownloadPreparationError from exc
