from enum import Enum

from .errors import InvalidToolOptionError
from .ffmpeg_runner import require_encoders, run_ffmpeg
from .media_probe import probe_media
from .processing import ToolResult, cleanup_upload_on_error, finalize_output
from .upload_utils import UploadedMedia


class CompressionQuality(str, Enum):
    LIGHT = "light"
    BALANCED = "balanced"
    STRONG = "strong"


COMPRESSION_CRF = {
    CompressionQuality.LIGHT: 20,
    CompressionQuality.BALANCED: 24,
    CompressionQuality.STRONG: 28,
}


def parse_compression_quality(value: str) -> CompressionQuality:
    try:
        return CompressionQuality(value)
    except ValueError as exc:
        raise InvalidToolOptionError from exc


def compress_video(upload: UploadedMedia, quality: CompressionQuality) -> ToolResult:
    with cleanup_upload_on_error(upload):
        metadata = probe_media(upload.path)
        require_encoders("libx264", "aac")
        output_path = upload.temp_directory / "output.mp4"
        run_ffmpeg(
            [
                "-i",
                str(upload.path),
                "-map",
                "0:v:0",
                "-map",
                "0:a:0?",
                "-sn",
                "-map_metadata",
                "-1",
                "-c:v",
                "libx264",
                "-preset",
                "medium",
                "-crf",
                str(COMPRESSION_CRF[quality]),
                "-pix_fmt",
                "yuv420p",
                "-c:a",
                "aac",
                "-b:a",
                "160k",
                "-movflags",
                "+faststart",
                str(output_path),
            ]
        )
        artifact, output_size = finalize_output(
            upload,
            output_path,
            name_suffix="compressed",
            extension="mp4",
        )
        saved_bytes = upload.size - output_size
        return ToolResult(
            artifact=artifact,
            metadata={
                "original_size": upload.size,
                "output_size": output_size,
                "saved_bytes": saved_bytes,
                "saved_percent": round(saved_bytes / upload.size * 100, 1),
                "duration": metadata.duration,
            },
        )
