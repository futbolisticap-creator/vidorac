import math

from .errors import InvalidTrimRangeError, ProbeFailedError
from .ffmpeg_runner import require_encoders, run_ffmpeg
from .media_probe import probe_media
from .processing import ToolResult, cleanup_upload_on_error, finalize_output
from .upload_utils import UploadedMedia


def validate_trim_range(start: float, end: float, duration: float | None) -> None:
    if not math.isfinite(start) or not math.isfinite(end) or start < 0 or end <= start:
        raise InvalidTrimRangeError
    if duration is None:
        raise ProbeFailedError
    if end > duration + 0.05:
        raise InvalidTrimRangeError


def trim_video(upload: UploadedMedia, start: float, end: float) -> ToolResult:
    with cleanup_upload_on_error(upload):
        metadata = probe_media(upload.path)
        validate_trim_range(start, end, metadata.duration)
        require_encoders("libx264", "aac")
        output_path = upload.temp_directory / "output.mp4"
        clip_duration = end - start
        run_ffmpeg(
            [
                "-i", str(upload.path), "-ss", f"{start:.3f}", "-t", f"{clip_duration:.3f}",
                "-map", "0:v:0", "-map", "0:a:0?", "-sn", "-map_metadata", "-1",
                "-c:v", "libx264", "-preset", "medium", "-crf", "20",
                "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k",
                "-movflags", "+faststart", str(output_path),
            ]
        )
        artifact, output_size = finalize_output(
            upload,
            output_path,
            name_suffix="trimmed",
            extension="mp4",
        )
        return ToolResult(
            artifact=artifact,
            metadata={
                "original_size": upload.size,
                "output_size": output_size,
                "duration": round(clip_duration, 3),
                "start": start,
                "end": end,
            },
        )
