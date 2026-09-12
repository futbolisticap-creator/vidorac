import logging
import os
import re
import shutil
from collections.abc import Mapping
from time import perf_counter
from typing import Any
from urllib.parse import parse_qs, urlsplit, urlunsplit

from .tls_certs import configure_windows_ca_bundle

configure_windows_ca_bundle()

import yt_dlp

from .format_presets import (
    display_video_codec,
    get_effective_resolution,
    infer_output_container,
    select_streams,
)


logger = logging.getLogger("clipora.analyzer")
MAX_ANALYZED_DOWNLOAD_SIZE = 250 * 1024 * 1024
DEVELOPMENT_TIMINGS = os.getenv("VIDORAC_ENV", os.getenv("CLIPORA_ENV", "development")).strip().lower() == "development"

SUPPORTED_HOSTS = {
    "youtube.com": "youtube",
    "youtu.be": "youtube",
    "tiktok.com": "tiktok",
    "instagram.com": "instagram",
    "x.com": "x",
    "twitter.com": "x",
    "reddit.com": "reddit",
    "redd.it": "reddit",
    "v.redd.it": "reddit",
    "facebook.com": "facebook",
    "fb.watch": "facebook",
}

YDL_OPTIONS: dict[str, Any] = {
    "quiet": True,
    "no_warnings": True,
    "skip_download": True,
    "noplaylist": True,
    "playlistend": 1,
    "socket_timeout": 12,
    "retries": 2,
    "fragment_retries": 2,
    "extractor_retries": 2,
    "cachedir": False,
    # Validate HTTPS with the operating-system trust store. This keeps local
    # Windows installations compatible with managed/root certificates.
    "compat_opts": {"no-certifi"},
}


class InvalidUrlError(ValueError):
    pass


class UnsupportedUrlError(ValueError):
    pass


class UnsupportedCollectionUrlError(UnsupportedUrlError):
    pass


class AnalysisFailedError(RuntimeError):
    def __init__(
        self,
        message: str = "analysis failed",
        *,
        technical_error: str | None = None,
        error_category: str = "generic_extraction_failure",
    ) -> None:
        self.technical_error = technical_error
        self.error_category = error_category
        super().__init__(message)


class AnalysisAuthenticationError(AnalysisFailedError):
    def __init__(
        self,
        platform: str,
        *,
        technical_error: str | None = None,
        error_category: str = "authentication_required",
    ) -> None:
        self.platform = platform
        super().__init__(
            f"{platform} authentication required",
            technical_error=technical_error,
            error_category=error_category,
        )


class AnalysisSourceBlockedError(AnalysisFailedError):
    def __init__(
        self,
        platform: str,
        *,
        technical_error: str | None = None,
        error_category: str = "source_blocked",
    ) -> None:
        self.platform = platform
        super().__init__(
            f"{platform} source blocked",
            technical_error=technical_error,
            error_category=error_category,
        )


class AnalysisTemporaryError(AnalysisFailedError):
    def __init__(
        self,
        platform: str,
        *,
        technical_error: str | None = None,
        error_category: str = "temporary_platform_failure",
    ) -> None:
        self.platform = platform
        super().__init__(
            f"{platform} temporarily unavailable",
            technical_error=technical_error,
            error_category=error_category,
        )


class AnalysisContentUnavailableError(AnalysisFailedError):
    def __init__(self, platform: str, *, technical_error: str | None = None) -> None:
        self.platform = platform
        super().__init__(f"{platform} content unavailable", technical_error=technical_error)


def _tiktok_technical_error(message: str) -> tuple[str, str]:
    """Return an allow-listed category and message safe for local development."""
    lowered = message.lower()
    cases = (
        (("unexpected response from webpage request",), "temporary", "Unexpected response from webpage request"),
        (("unable to extract webpage video data",), "extractor", "Unable to extract webpage video data"),
        (("http error 403", "status code 403"), "blocked", "HTTP 403"),
        (("http error 404", "status code 404", "not found"), "unavailable", "HTTP 404"),
        (("ip address is blocked", "ip blocked"), "blocked", "IP blocked"),
        (("too many requests", "429"), "blocked", "HTTP 429"),
        (("challenge",), "temporary", "Challenge failure"),
        (("impersonation",), "dependency", "Browser impersonation unavailable"),
        (("sign in", "login", "authentication", "cookies", "private"), "authentication", "Authentication required"),
    )
    for terms, category, safe_message in cases:
        if any(term in lowered for term in terms):
            return category, f"TikTok extractor · {category} · {safe_message}"
    return "extractor", "TikTok extractor · extractor · Unclassified yt-dlp extraction failure"


def _youtube_technical_error(message: str) -> tuple[str, str]:
    """Classify YouTube failures without treating anti-bot challenges as private media."""
    lowered = message.lower()
    cases = (
        (
            ("private video",),
            "private_media",
            "Private video",
        ),
        (
            ("members-only", "members only", "join this channel to get access", "login-only media"),
            "authentication_required",
            "Members-only or login-only media",
        ),
        (
            ("429", "too many requests"),
            "rate_limit",
            "HTTP 429 rate limit",
        ),
        (
            ("po token", "pot required", "po-token"),
            "youtube_verification_required",
            "PO Token verification required",
        ),
        (
            (
                "sign in to confirm you're not a bot",
                "sign in to confirm you’re not a bot",
                "not a bot",
                "anti-bot",
                "http error 403",
                "status code 403",
                "challenge",
                "n challenge",
                "sig challenge",
            ),
            "temporary_platform_challenge",
            "Sign in to confirm you're not a bot",
        ),
    )
    for terms, category, safe_message in cases:
        if any(term in lowered for term in terms):
            return category, f"YouTube extractor · {category} · {safe_message}"
    return (
        "generic_extraction_failure",
        "YouTube extractor · generic_extraction_failure · Unclassified yt-dlp extraction failure",
    )


def validate_and_classify_url(raw_url: str) -> tuple[str, str]:
    url = raw_url.strip() if isinstance(raw_url, str) else ""
    if not url:
        raise InvalidUrlError

    try:
        parsed = urlsplit(url)
        hostname = (parsed.hostname or "").lower().rstrip(".")
        port = parsed.port
    except ValueError as exc:
        raise InvalidUrlError from exc

    if (
        parsed.scheme.lower() not in {"http", "https"}
        or not hostname
        or parsed.username is not None
        or parsed.password is not None
        or (port is not None and port not in {80, 443})
    ):
        raise InvalidUrlError

    for base_host, platform in SUPPORTED_HOSTS.items():
        if hostname == base_host or hostname.endswith(f".{base_host}"):
            return url, platform

    raise UnsupportedUrlError


def normalize_url_for_extraction(url: str, platform: str) -> str:
    """Remove non-identifying Instagram tracking data after host validation."""
    if platform != "instagram":
        return url
    parsed = urlsplit(url)
    path = parsed.path
    if not re.fullmatch(r"/(?:p|reel|reels|tv)/[A-Za-z0-9_-]+/?", path):
        return url
    normalized_path = f"{path.rstrip('/')}/"
    return urlunsplit((parsed.scheme, parsed.netloc, normalized_path, "", ""))


def _timing(label: str, started_at: float) -> None:
    if DEVELOPMENT_TIMINGS:
        logger.info("%s: %.1f ms", label, (perf_counter() - started_at) * 1000)


def ensure_individual_media_url(url: str, platform: str) -> None:
    """Reject account and collection URLs before an extractor can enumerate them."""
    parsed = urlsplit(url)
    hostname = (parsed.hostname or "").lower().rstrip(".")
    path = parsed.path.rstrip("/") or "/"

    if platform == "instagram":
        if not re.fullmatch(r"/(?:p|reel|reels|tv)/[A-Za-z0-9_-]+", path):
            raise UnsupportedCollectionUrlError
    elif platform == "tiktok":
        if hostname in {"vm.tiktok.com", "vt.tiktok.com"}:
            if not re.fullmatch(r"/[A-Za-z0-9_-]+", path):
                raise UnsupportedCollectionUrlError
        elif not re.fullmatch(r"/@[^/]+/(?:video|photo)/\d+", path):
            raise UnsupportedCollectionUrlError
    elif platform == "x":
        if not re.fullmatch(r"/(?:[^/]+/status|i/(?:web/)?status)/\d+(?:/(?:video|photo)/\d+)?", path):
            raise UnsupportedCollectionUrlError
    elif platform == "reddit":
        if hostname == "v.redd.it" or hostname.endswith(".v.redd.it"):
            if not re.fullmatch(r"/[A-Za-z0-9_-]+(?:/DASHPlaylist\.mpd)?", path):
                raise UnsupportedCollectionUrlError
        elif hostname == "redd.it" or hostname.endswith(".redd.it"):
            if not re.fullmatch(r"/[A-Za-z0-9_-]+", path):
                raise UnsupportedCollectionUrlError
        elif not (
            re.fullmatch(r"/(?:(?:r|user)/[^/]+/)?comments/[A-Za-z0-9]+(?:/[^/]+){0,2}", path)
            or re.fullmatch(r"/gallery/[A-Za-z0-9]+", path)
        ):
            raise UnsupportedCollectionUrlError
    elif platform == "facebook":
        query = parse_qs(parsed.query)
        is_watch = path == "/watch" and bool(query.get("v"))
        is_post_path = bool(re.fullmatch(r"/[^/]+/(?:videos|posts)/[A-Za-z0-9._-]+", path))
        is_photo_path = bool(re.fullmatch(r"/[^/]+/photos/(?:[^/]+/)?[A-Za-z0-9._-]+", path))
        is_photo_query = path in {"/photo", "/photo.php"} and bool(query.get("fbid"))
        is_permalink = path in {"/permalink.php", "/posts.php"} and bool(
            query.get("story_fbid") or query.get("id")
        )
        is_group_post = bool(re.fullmatch(r"/groups/[^/]+/(?:posts|permalink)/[A-Za-z0-9._-]+", path))
        is_reel = bool(re.fullmatch(r"/(?:reel|reels)/[A-Za-z0-9._-]+", path))
        is_shared_post = bool(re.fullmatch(r"/share/(?:v|p)/[A-Za-z0-9._-]+", path))
        is_legacy_video = path in {"/video.php", "/story.php"} and bool(query.get("v") or query.get("story_fbid"))
        is_fb_watch = (hostname == "fb.watch" or hostname.endswith(".fb.watch")) and bool(re.fullmatch(r"/[A-Za-z0-9._-]+", path))
        if not any((is_watch, is_post_path, is_photo_path, is_photo_query, is_permalink, is_group_post, is_reel, is_shared_post, is_legacy_video, is_fb_watch)):
            raise UnsupportedCollectionUrlError


def _prefers_gallery_detection(url: str, platform: str) -> bool:
    """Use gallery-dl first only where one post may contain non-video media."""
    parsed = urlsplit(url)
    path = parsed.path.rstrip("/") or "/"
    hostname = (parsed.hostname or "").lower().rstrip(".")
    if platform == "instagram":
        return path.startswith("/p/")
    if platform == "tiktok":
        return "/photo/" in path
    if platform == "x":
        return True
    if platform == "reddit":
        return hostname != "v.redd.it" and not hostname.endswith(".v.redd.it")
    if platform == "facebook":
        return any(token in path for token in ("/posts/", "/photos/", "/permalink", "/photo")) or path.startswith("/share/p/")
    return False


def _optional_string(value: Any) -> str | None:
    return value if isinstance(value, str) and value.strip() else None


def _optional_integer(value: Any) -> int | None:
    if isinstance(value, bool):
        return None
    if isinstance(value, (int, float)) and value >= 0:
        return round(value)
    return None


def extract_max_height(info: Mapping[str, Any]) -> int | None:
    resolutions = [
        resolution
        for item in info.get("formats") or []
        if isinstance(item, Mapping)
        and (resolution := get_effective_resolution(item)) is not None
    ]
    direct_resolution = get_effective_resolution(info)
    if direct_resolution is not None:
        resolutions.append(direct_resolution)
    return max(resolutions, default=None)


def _positive_number(value: Any) -> float | None:
    if isinstance(value, bool):
        return None
    if isinstance(value, (int, float)) and value > 0:
        return float(value)
    return None


def _estimated_format_size(format_info: Mapping[str, Any], duration: float | None) -> int | None:
    reported_size = _positive_number(format_info.get("filesize")) or _positive_number(
        format_info.get("filesize_approx")
    )
    if reported_size is not None:
        return round(reported_size)

    bitrate = _positive_number(format_info.get("tbr"))
    if bitrate is not None and duration is not None:
        return round(bitrate * 1000 / 8 * duration)
    return None


def _has_stream(format_info: Mapping[str, Any], field: str) -> bool:
    value = format_info.get(field)
    if isinstance(value, str):
        return value.lower() != "none"
    descriptor = f"{format_info.get('format_id', '')} {format_info.get('format_note', '')}".lower()
    resolution = get_effective_resolution(format_info)
    unknown_direct_media = (
        format_info.get("vcodec") is None
        and format_info.get("acodec") is None
        and format_info.get("ext") in {"mp4", "webm", "mov", "m4v"}
    )
    if field == "vcodec":
        return resolution is not None or unknown_direct_media
    if field == "acodec":
        if "audio" in descriptor:
            return True
        return False
    return False


def _pick_format(
    formats: list[Mapping[str, Any]],
    *,
    max_height: int | None = None,
    audio_only: bool = False,
) -> Mapping[str, Any] | None:
    candidates = []
    for format_info in formats:
        if audio_only:
            if not _has_stream(format_info, "acodec") or _has_stream(format_info, "vcodec"):
                continue
        else:
            resolution = get_effective_resolution(format_info)
            if not _has_stream(format_info, "vcodec") or resolution is None:
                continue
            if max_height is not None and resolution > max_height:
                continue
        candidates.append(format_info)

    if not candidates:
        return None

    if not audio_only:
        mp4_candidates = [item for item in candidates if item.get("ext") == "mp4"]
        if mp4_candidates:
            candidates = mp4_candidates

    return max(
        candidates,
        key=lambda item: (
            get_effective_resolution(item) or 0,
            _positive_number(item.get("tbr")) or 0,
            _positive_number(item.get("filesize"))
            or _positive_number(item.get("filesize_approx"))
            or 0,
        ),
    )


def build_quality_options(info: Mapping[str, Any]) -> list[dict[str, Any]]:
    formats = [item for item in info.get("formats") or [] if isinstance(item, Mapping)]
    duration = _positive_number(info.get("duration"))
    best_audio = _pick_format(formats, audio_only=True)
    ffmpeg_available = shutil.which("ffmpeg") is not None and shutil.which("ffprobe") is not None

    def video_option(option_id: str, label: str, height_limit: int | None) -> dict[str, Any]:
        selection = select_streams(formats, option_id, ffmpeg_available=ffmpeg_available)
        selected_resolution = get_effective_resolution(selection.video) if selection else None
        estimated_parts = (
            [_estimated_format_size(selection.video, duration)]
            + ([_estimated_format_size(selection.audio, duration)] if selection and selection.audio else [])
            if selection
            else []
        )
        estimated_size = sum(estimated_parts) if estimated_parts and all(part is not None for part in estimated_parts) else None
        exact_parts = (
            [_positive_number(selection.video.get("filesize"))]
            + ([_positive_number(selection.audio.get("filesize"))] if selection and selection.audio else [])
            if selection
            else []
        )
        exact_size = sum(exact_parts) if exact_parts and all(part is not None for part in exact_parts) else None
        available = selection is not None and (exact_size is None or exact_size <= MAX_ANALYZED_DOWNLOAD_SIZE)
        extension = infer_output_container(selection) if selection else None
        if option_id == "compatible" and selection is not None:
            extension = "mp4"
        return {
            "id": option_id,
            "label": label,
            "available": available,
            "resolution": f"{selected_resolution}p" if selected_resolution is not None else None,
            "container": extension.upper() if extension else None,
            "video_codec": display_video_codec(selection) if selection else None,
            "estimated_size_bytes": estimated_size,
        }

    options = [
        video_option("best", "Best Quality", None),
        video_option("compatible", "Best MP4", None),
        video_option("1080", "1080p", 1080),
        video_option("720", "720p", 720),
        video_option("480", "480p", 480),
    ]
    has_audio = best_audio is not None or any(_has_stream(item, "acodec") for item in formats)
    mp3_size = round(duration * 192_000 / 8) if duration is not None and has_audio else None
    options.append(
        {
            "id": "mp3",
            "label": "MP3",
            "available": has_audio and (mp3_size is None or mp3_size <= MAX_ANALYZED_DOWNLOAD_SIZE),
            "resolution": None,
            "container": "MP3",
            "video_codec": None,
            "estimated_size_bytes": mp3_size,
        }
    )
    return options


def analyze_media(raw_url: str) -> dict[str, Any]:
    url, platform = validate_and_classify_url(raw_url)
    url = normalize_url_for_extraction(url, platform)
    ensure_individual_media_url(url, platform)

    try:
        with yt_dlp.YoutubeDL(YDL_OPTIONS) as ydl:
            info = ydl.extract_info(url, download=False)
    except yt_dlp.utils.DownloadError as exc:
        logger.warning("yt-dlp could not analyze %s: %s", url, exc)
        lowered = str(exc).lower()
        if platform == "youtube":
            category, technical_error = _youtube_technical_error(str(exc))
            if category in {"private_media", "authentication_required"}:
                raise AnalysisAuthenticationError(
                    platform,
                    technical_error=technical_error,
                    error_category=category,
                ) from exc
            if category == "rate_limit":
                raise AnalysisSourceBlockedError(
                    platform,
                    technical_error=technical_error,
                    error_category=category,
                ) from exc
            if category in {"temporary_platform_challenge", "youtube_verification_required"}:
                raise AnalysisTemporaryError(
                    platform,
                    technical_error=technical_error,
                    error_category=category,
                ) from exc
            raise AnalysisFailedError(
                technical_error=technical_error,
                error_category=category,
            ) from exc
        tiktok_technical_error: str | None = None
        if platform == "tiktok":
            _category, tiktok_technical_error = _tiktok_technical_error(str(exc))
        if any(term in lowered for term in ("sign in", "login", "authentication", "cookies", "private")):
            raise AnalysisAuthenticationError(platform, technical_error=tiktok_technical_error) from exc
        if platform == "tiktok":
            if any(term in lowered for term in ("http error 403", "status code 403", "ip address is blocked", "ip blocked", "too many requests", "429")):
                raise AnalysisSourceBlockedError(platform, technical_error=tiktok_technical_error) from exc
            if any(term in lowered for term in ("http error 404", "status code 404", "not found", "removed", "deleted", "does not exist")):
                raise AnalysisContentUnavailableError(platform, technical_error=tiktok_technical_error) from exc
            # TikTok extractor failures are currently volatile. Keep them
            # specific and retryable instead of degrading to the generic 422.
            raise AnalysisTemporaryError(platform, technical_error=tiktok_technical_error) from exc
        raise AnalysisFailedError from exc
    except Exception as exc:
        logger.exception("Unexpected analysis error for %s", url)
        raise AnalysisFailedError from exc

    if not isinstance(info, Mapping) or info.get("_type") in {"playlist", "multi_video"} or info.get("entries") is not None:
        logger.warning("Rejected non-single-video result for %s", url)
        raise AnalysisFailedError

    formats = [item for item in info.get("formats") or [] if isinstance(item, Mapping)]
    if not any(_has_stream(item, "vcodec") for item in formats):
        logger.warning("Rejected result without a video stream for %s", url)
        raise AnalysisFailedError

    return {
        "media_type": "video",
        "title": _optional_string(info.get("title")),
        "thumbnail": _optional_string(info.get("thumbnail")),
        "duration": _optional_integer(info.get("duration")),
        "uploader": _optional_string(info.get("uploader") or info.get("channel")),
        "platform": platform,
        "webpage_url": _optional_string(info.get("webpage_url")) or url,
        "max_height": extract_max_height(info),
        "quality_options": build_quality_options(info),
    }


def analyze_content(raw_url: str) -> dict[str, Any]:
    """Select the extractor without asking the browser to classify the post."""
    validation_started = perf_counter()
    url, platform = validate_and_classify_url(raw_url)
    _timing("url validation and platform detection", validation_started)
    normalization_started = perf_counter()
    url = normalize_url_for_extraction(url, platform)
    _timing(f"{platform} normalization", normalization_started)
    ensure_individual_media_url(url, platform)

    media_post_platforms = {"instagram", "tiktok", "x", "reddit", "facebook"}
    gallery_error: Exception | None = None

    # Ambiguous post URLs can contain images and videos together. gallery-dl sees
    # the complete ordered post; a lone video is deliberately rejected there and
    # falls through to yt-dlp for the existing quality-selector workflow.
    if platform in media_post_platforms and _prefers_gallery_detection(url, platform):
        from .media_gallery import (
            GalleryAnalysisError,
            GalleryTimeoutError,
            InstagramPostTemporarilyUnavailableError,
            analyze_gallery_post,
        )

        gallery_started = perf_counter()
        try:
            result = analyze_gallery_post(url, platform)
            _timing("gallery-dl extraction", gallery_started)
            return result
        except GalleryAnalysisError as exc:
            _timing("gallery-dl extraction failed", gallery_started)
            if platform == "instagram" and isinstance(
                exc, (GalleryTimeoutError, InstagramPostTemporarilyUnavailableError)
            ):
                raise
            gallery_error = exc

    video_started = perf_counter()
    try:
        result = analyze_media(url)
        _timing("yt-dlp extraction", video_started)
        return result
    except AnalysisFailedError as exc:
        _timing("yt-dlp extraction failed", video_started)
        if platform not in media_post_platforms:
            raise
        if platform == "tiktok" and "/video/" in urlsplit(url).path:
            raise exc
        if gallery_error is not None:
            raise gallery_error

    # Keep gallery-dl isolated from the video analyzer and avoid an import cycle.
    from .media_gallery import analyze_gallery_post

    gallery_started = perf_counter()
    result = analyze_gallery_post(url, platform)
    _timing("gallery-dl fallback", gallery_started)
    return result
