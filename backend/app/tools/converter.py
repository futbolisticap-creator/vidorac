from enum import Enum

from .errors import InvalidToolOptionError, NoAudioStreamError
from .ffmpeg_runner import require_encoders, run_ffmpeg
from .media_probe import probe_media
from .processing import ToolResult, cleanup_upload_on_error, finalize_output
from .upload_utils import UploadedMedia


class ConversionFormat(str, Enum):
    MP4 = "mp4"
    WEBM = "webm"
    MP3 = "mp3"


def parse_conversion_format(value: str) -> ConversionFormat:
    try:
        return ConversionFormat(value)
    except ValueError as exc:
        raise InvalidToolOptionError from exc


def convert_video(upload: UploadedMedia, output_format: ConversionFormat) -> ToolResult:
    with cleanup_upload_on_error(upload):
        metadata = probe_media(upload.path)
        output_path = upload.temp_directory / f"output.{output_format.value}"

        if output_format is ConversionFormat.MP4:
            require_encoders("libx264", "aac")
            arguments = [
                "-i", str(upload.path),
                "-map", "0:v:0", "-map", "0:a:0?", "-sn", "-map_metadata", "-1",
                "-c:v", "libx264", "-preset", "medium", "-crf", "20",
                "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k",
                "-movflags", "+faststart", str(output_path),
            ]
        elif output_format is ConversionFormat.WEBM:
            require_encoders("libvpx-vp9", "libopus")
            arguments = [
                "-i", str(upload.path),
                "-map", "0:v:0", "-map", "0:a:0?", "-sn", "-map_metadata", "-1",
                "-c:v", "libvpx-vp9", "-crf", "30", "-b:v", "0",
                "-c:a", "libopus", "-b:a", "128k", str(output_path),
            ]
        else:
            if not metadata.has_audio:
                raise NoAudioStreamError
            require_encoders("libmp3lame")
            arguments = [
                "-i", str(upload.path), "-vn", "-map", "0:a:0", "-map_metadata", "-1",
                "-c:a", "libmp3lame", "-b:a", "192k", str(output_path),
            ]

        run_ffmpeg(arguments)
        artifact, output_size = finalize_output(
            upload,
            output_path,
            name_suffix="converted",
            extension=output_format.value,
        )
        return ToolResult(
            artifact=artifact,
            metadata={
                "original_size": upload.size,
                "output_size": output_size,
                "duration": metadata.duration,
                "format": output_format.value,
            },
        )
