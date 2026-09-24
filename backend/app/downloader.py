import logging
import mimetypes
import re
import shutil
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
from .temp_files import cleanup_temp_directory, create_temp_directory, handoff_temp_directory
from .tools.ffmpeg_runner import require_encoders, run_ffmpeg


logger = logging.getLogger("clipora.downloader")

MAX_DURATION_SECONDS = 3 * 60 * 60
MAX_FILESIZE_BYTES = 250 * 1024 * 1024
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
    ORIGINAL_AUDIO = "audio"
    MP3 = "mp3"


class Mp3Bitrate(int, Enum):
    KBPS_128 = 128
    KBPS_192 = 192
    KBPS_256 = 256
    KBPS_320 = 320


DEFAULT_MP3_BITRATE = Mp3Bitrate.KBPS_192


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


def _find_downloaded_audio_source(temp_directory: Path) -> Path:
    ignored_suffixes = {".part", ".ytdl", ".json", ".description"}
    candidates = [
        path
        for path in temp_directory.iterdir()
        if path.is_file()
        and path.suffix.lower() not in ignored_suffixes
        and path.name != "vidorac-encoded-output.mp3"
    ]
    if not candidates:
        raise FormatUnavailableError
    return max(candidates, key=lambda path: path.stat().st_size)


def _encode_mp3(
    source_path: Path,
    temp_directory: Path,
    audio_bitrate: Mp3Bitrate,
) -> Path:
    output_path = temp_directory / "vidorac-encoded-output.mp3"
    require_encoders("libmp3lame")
    run_ffmpeg(
        [
            "-i", str(source_path),
            "-vn", "-map", "0:a:0", "-map_metadata", "-1",
            "-c:a", "libmp3lame", "-b:a", f"{audio_bitrate.value}k",
            str(output_path),
        ]
    )
    try:
        source_path.unlink()
    except OSError:
        logger.warning("Could not remove the downloaded audio source after MP3 encoding")
    return output_path


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
    audio_bitrate: Mp3Bitrate = DEFAULT_MP3_BITRATE,
) -> tuple[dict[str, Any], dict[str, str | None]]:
    limit_state: dict[str, str | None] = {"reason": None}

    def match_filter(info: dict[str, Any], *, incomplete: bool = False) -> str | None:
        if incomplete:
            return None
        duration = info.get("duration")
        if isinstance(duration, (int, float)) and duration > MAX_DURATION_SECONDS:
            limit_state["reason"] = "duration"
            return "Video exceeds Vidorac's duration limit"
        if (
            quality is DownloadQuality.MP3
            and isinstance(duration, (int, float))
            and duration * audio_bitrate.value * 1_000 / 8 > MAX_FILESIZE_BYTES
        ):
            limit_state["reason"] = "filesize"
            return "MP3 exceeds Vidorac's file-size limit"
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

    if quality in {DownloadQuality.MP3, DownloadQuality.ORIGINAL_AUDIO}:
        if quality is DownloadQuality.MP3 and not ffmpeg_available:
            raise FFmpegRequiredError
        options.update(
            {
                "format": "bestaudio/best",
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


def download_media(
    raw_url: str,
    quality: DownloadQuality,
    audio_bitrate: Mp3Bitrate | None = None,
) -> DownloadArtifact:
    url, platform = validate_and_classify_url(raw_url)
    ensure_individual_media_url(url, platform)
    temp_directory = create_temp_directory("clipora-")
    ffmpeg_available = is_ffmpeg_available()

    try:
        options, limit_state = build_ydl_options(
            quality,
            temp_directory,
            ffmpeg_available=ffmpeg_available,
            audio_bitrate=audio_bitrate or DEFAULT_MP3_BITRATE,
        )
        with yt_dlp.YoutubeDL(options) as ydl:
            info = ydl.extract_info(url, download=True)

        if limit_state["reason"] == "duration":
            raise DurationLimitError
        if limit_state["reason"] == "filesize":
            raise FileSizeLimitError
        if not isinstance(info, dict) or info.get("_type") in {"playlist", "multi_video"} or info.get("entries") is not None:
            raise MediaUnavailableError

        if quality is DownloadQuality.MP3:
            source_path = _find_downloaded_audio_source(temp_directory)
            output_path = _encode_mp3(
                source_path,
                temp_directory,
                audio_bitrate or DEFAULT_MP3_BITRATE,
            )
        elif quality is DownloadQuality.ORIGINAL_AUDIO:
            output_path = _find_downloaded_audio_source(temp_directory)
        else:
            output_path = _find_output_file(temp_directory, quality)
        if output_path.stat().st_size > MAX_FILESIZE_BYTES:
            raise FileSizeLimitError

        extension = output_path.suffix.lower().lstrip(".") or ("mp3" if quality is DownloadQuality.MP3 else "mp4")
        if quality in {DownloadQuality.MP3, DownloadQuality.ORIGINAL_AUDIO}:
            uploader = info.get("uploader") or info.get("creator")
            title = info.get("title")
            download_title = " - ".join(part.strip() for part in (uploader, title) if isinstance(part, str) and part.strip())
            download_title = download_title or "vidorac-tiktok-audio"
        else:
            download_title = info.get("title")
        artifact = DownloadArtifact(
            path=output_path,
            download_name=safe_download_name(download_title, extension),
            media_type=_media_type_for(output_path),
            temp_directory=temp_directory,
        )
        handoff_temp_directory(temp_directory)
        return artifact
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
        cleanup_temp_directory(temp_directory)
        raise error from exc
    except DownloadPreparationError:
        cleanup_temp_directory(temp_directory)
        raise
    except Exception as exc:
        logger.exception("Unexpected download error for %s", url)
        cleanup_temp_directory(temp_directory)
        raise DownloadPreparationError from exc
