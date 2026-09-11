from collections.abc import Mapping
from dataclasses import dataclass
import math
from typing import Any


QUALITY_RESOLUTION_LIMITS = {
    "best": None,
    "compatible": None,
    "1080": 1080,
    "720": 720,
    "480": 480,
}


@dataclass(frozen=True)
class StreamSelection:
    video: Mapping[str, Any]
    audio: Mapping[str, Any] | None


def _has_stream(item: Mapping[str, Any], key: str) -> bool:
    value = item.get(key)
    if isinstance(value, str):
        return value.lower() != "none"
    descriptor = f"{item.get('format_id', '')} {item.get('format_note', '')}".lower()
    unknown_direct_media = (
        item.get("vcodec") is None
        and item.get("acodec") is None
        and item.get("ext") in {"mp4", "webm", "mov", "m4v"}
    )
    if key == "vcodec":
        return get_effective_resolution(item) is not None or unknown_direct_media
    if key == "acodec":
        if "audio" in descriptor:
            return True
        return False
    return False


def _is_unknown_direct_media(item: Mapping[str, Any]) -> bool:
    return (
        item.get("vcodec") is None
        and item.get("acodec") is None
        and item.get("ext") in {"mp4", "webm", "mov", "m4v"}
    )


def _valid_dimension(value: Any) -> int | None:
    if (
        isinstance(value, (int, float))
        and not isinstance(value, bool)
        and math.isfinite(value)
        and value > 0
    ):
        return round(value)
    return None


def get_effective_resolution(item: Mapping[str, Any]) -> int | None:
    """Return the orientation-independent short edge for a video format."""
    width = _valid_dimension(item.get("width"))
    height = _valid_dimension(item.get("height"))
    if width is not None and height is not None:
        return min(width, height)
    return height or width


def _best(items: list[Mapping[str, Any]]) -> Mapping[str, Any] | None:
    if not items:
        return None
    # Resolution is the primary constraint; yt-dlp's own order breaks ties.
    return max(
        enumerate(items),
        key=lambda entry: (get_effective_resolution(entry[1]) or 0, entry[0]),
    )[1]


def select_streams(
    formats: list[Mapping[str, Any]],
    quality: str,
    *,
    ffmpeg_available: bool,
) -> StreamSelection | None:
    """Mirror the ordered yt-dlp selector branches used by the downloader."""
    resolution_limit = QUALITY_RESOLUTION_LIMITS[quality]

    def within_limit(item: Mapping[str, Any]) -> bool:
        resolution = get_effective_resolution(item)
        if resolution is None:
            return resolution_limit is None
        return resolution_limit is None or resolution <= resolution_limit

    video_only = [item for item in formats if within_limit(item) and _has_stream(item, "vcodec") and not _has_stream(item, "acodec") and not _is_unknown_direct_media(item)]
    combined = [item for item in formats if within_limit(item) and ((_has_stream(item, "vcodec") and _has_stream(item, "acodec")) or _is_unknown_direct_media(item))]
    audio_only = [item for item in formats if _has_stream(item, "acodec") and not _has_stream(item, "vcodec")]

    if quality == "compatible":
        h264_video = [
            item for item in video_only
            if item.get("ext") == "mp4" and str(item.get("vcodec", "")).lower().startswith("avc1")
        ]
        aac_audio = [
            item for item in audio_only
            if item.get("ext") in {"m4a", "mp4"} and str(item.get("acodec", "")).lower().startswith("mp4a")
        ]
        h264_aac_combined = [
            item for item in combined
            if item.get("ext") == "mp4"
            and str(item.get("vcodec", "")).lower().startswith("avc1")
            and str(item.get("acodec", "")).lower().startswith("mp4a")
        ]
        if ffmpeg_available and h264_video and aac_audio:
            return StreamSelection(_best(h264_video), _best(aac_audio))  # type: ignore[arg-type]
        if h264_aac_combined:
            return StreamSelection(_best(h264_aac_combined), None)  # type: ignore[arg-type]
        mp4_video = [item for item in video_only if item.get("ext") == "mp4"]
        m4a_audio = [item for item in audio_only if item.get("ext") in {"m4a", "mp4"}]
        if ffmpeg_available and mp4_video and m4a_audio:
            return StreamSelection(_best(mp4_video), _best(m4a_audio))  # type: ignore[arg-type]
        mp4_combined = [item for item in combined if item.get("ext") == "mp4"]
        if mp4_combined:
            return StreamSelection(_best(mp4_combined), None)  # type: ignore[arg-type]
        # "Best MP4" must remain an MP4 option even when H.264/AAC is absent.
        return None

    if ffmpeg_available and video_only and audio_only:
        return StreamSelection(_best(video_only), _best(audio_only))  # type: ignore[arg-type]
    if not ffmpeg_available:
        mp4_combined = [item for item in combined if item.get("ext") == "mp4"]
        if mp4_combined:
            return StreamSelection(_best(mp4_combined), None)  # type: ignore[arg-type]
    if combined:
        return StreamSelection(_best(combined), None)  # type: ignore[arg-type]
    if resolution_limit is None and video_only:
        return StreamSelection(_best(video_only), None)  # type: ignore[arg-type]
    return None


def infer_output_container(selection: StreamSelection) -> str | None:
    video_ext = selection.video.get("ext")
    if not isinstance(video_ext, str):
        return None
    if selection.audio is None:
        return video_ext
    audio_ext = selection.audio.get("ext")
    audio_codec = selection.audio.get("acodec")
    if video_ext == "mp4" and audio_ext == "m4a":
        return "mp4"
    if video_ext == "mp4" and audio_ext == "mp4" and isinstance(audio_codec, str):
        return "mp4"
    if video_ext == "webm" and audio_ext == "webm":
        return "webm"
    return "mkv"


def display_video_codec(selection: StreamSelection) -> str | None:
    value = selection.video.get("vcodec")
    if not isinstance(value, str):
        return None
    codec = value.lower()
    if codec.startswith(("avc1", "h264")):
        return "H.264"
    if codec.startswith(("hev1", "hvc1", "hevc")):
        return "H.265"
    if codec.startswith(("av01", "av1")):
        return "AV1"
    if codec.startswith(("vp09", "vp9")):
        return "VP9"
    return value.upper()[:16]
