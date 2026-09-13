import asyncio
import logging
import os
import re
import threading
from contextlib import asynccontextmanager
from typing import Annotated, AsyncIterator

from fastapi import FastAPI, File, Form, Request, UploadFile
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel, StrictInt, field_validator, model_validator
from starlette.background import BackgroundTask

from .analyzer import (
    AnalysisAuthenticationError,
    AnalysisContentUnavailableError,
    AnalysisFailedError,
    AnalysisSourceBlockedError,
    AnalysisTemporaryError,
    InvalidUrlError,
    UnsupportedCollectionUrlError,
    UnsupportedUrlError,
    analyze_content,
    validate_and_classify_url,
)
from .downloader import (
    AuthenticationRequiredError,
    ContentRemovedError,
    DownloadPreparationError,
    DownloadQuality,
    DEFAULT_MP3_BITRATE,
    DurationLimitError,
    FFmpegRequiredError,
    FileSizeLimitError,
    FormatUnavailableError,
    ExtractorChangedError,
    MediaUnavailableError,
    Mp3Bitrate,
    NetworkTimeoutError,
    SourceBlockedError,
    TemporaryUnavailableError,
    download_media,
)
from .download_registry import (
    PreparedDownloadExpiredError,
    PreparedDownloadFileMissingError,
    PreparedDownloadNotFoundError,
    PreparedDownloadRegistry,
    cleanup_prepared_download,
    cleanup_temp_directory,
)
from .media_gallery import (
    GalleryAnalysisError,
    GalleryAuthenticationError,
    GalleryDownloadError,
    GalleryError,
    GalleryIndexError,
    GalleryContentUnavailableError,
    GallerySourceBlockedError,
    GalleryTemporaryError,
    GalleryTimeoutError,
    InstagramPostTemporarilyUnavailableError,
    GallerySizeLimitError,
    GalleryTooManyItemsError,
    download_gallery_post,
)
from .rate_limit import SlidingWindowRateLimiter, request_client_key
from .runtime_config import (
    allowed_origins_from_env,
    max_concurrent_jobs_from_env,
    preparation_rate_limit_from_env,
    public_platforms_from_env,
)
from .tools.compressor import compress_video, parse_compression_quality
from .tools.converter import convert_video, parse_conversion_format
from .tools.errors import (
    EncoderUnavailableError,
    FFmpegUnavailableError,
    InvalidMediaError,
    InvalidToolOptionError,
    InvalidTrimRangeError,
    MediaIOError,
    MediaToolError,
    NoAudioStreamError,
    NoVideoStreamError,
    ProbeFailedError,
    ProcessingFailedError,
    ProcessingTimeoutError,
    UnsupportedUploadError,
    UploadTooLargeError,
)
from .tools.processing import ToolResult
from .tools.trimmer import trim_video
from .tools.upload_utils import save_upload


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)


prepared_downloads = PreparedDownloadRegistry()
DEVELOPMENT_MODE = os.getenv("VIDORAC_ENV", os.getenv("CLIPORA_ENV", "development")).strip().lower() == "development"
ALLOWED_ORIGINS = allowed_origins_from_env()
HEAVY_JOB_LIMIT = max_concurrent_jobs_from_env()
heavy_job_slots = threading.BoundedSemaphore(HEAVY_JOB_LIMIT)
PUBLIC_PLATFORMS = public_platforms_from_env()
preparation_rate_limiter = SlidingWindowRateLimiter(
    preparation_rate_limit_from_env(),
    10 * 60,
)


def run_heavy_job(function, *args, **kwargs):
    with heavy_job_slots:
        return function(*args, **kwargs)


def analysis_error_content(detail: str, error: AnalysisFailedError | None = None) -> dict[str, object]:
    content: dict[str, object] = {"success": False, "detail": detail}
    if DEVELOPMENT_MODE and error is not None and error.technical_error:
        content["technical_error"] = error.technical_error
    return content


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    try:
        yield
    finally:
        await asyncio.to_thread(prepared_downloads.clear)


app = FastAPI(
    title="Vidorac API",
    description="Local API for public media analysis and downloads in Vidorac.",
    version="0.6.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type"],
    expose_headers=["Content-Disposition"],
)


class AnalyzeRequest(BaseModel):
    url: str
    diagnostic_request_id: str | None = None

    @field_validator("diagnostic_request_id")
    @classmethod
    def validate_diagnostic_request_id(cls, value: str | None) -> str | None:
        if value is not None and not re.fullmatch(r"mobile-debug-[a-z0-9]+-[a-z0-9]{8}", value):
            raise ValueError("Invalid diagnostic request id")
        return value


class DownloadRequest(BaseModel):
    url: str
    quality: DownloadQuality | None = None
    audio_bitrate: Mp3Bitrate | None = None
    item_indices: list[StrictInt] | None = None
    archive: bool = False

    @field_validator("audio_bitrate", mode="before")
    @classmethod
    def validate_audio_bitrate_type(cls, value):
        if value is not None and type(value) is not int:
            raise ValueError("Audio bitrate must be an integer")
        return value

    @model_validator(mode="after")
    def validate_download_kind(self) -> "DownloadRequest":
        if self.quality is not None and (self.item_indices is not None or self.archive):
            raise ValueError("Video qualities cannot include gallery selections")
        if self.archive and self.item_indices == []:
            raise ValueError("Selected downloads require at least one item")
        if self.quality is DownloadQuality.MP3:
            self.audio_bitrate = self.audio_bitrate or DEFAULT_MP3_BITRATE
        elif self.audio_bitrate is not None:
            raise ValueError("Audio bitrate is only valid for MP3 downloads")
        return self


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(
    _request: Request,
    _exc: RequestValidationError,
) -> JSONResponse:
    if _request.url.path == "/api/download/prepare":
        detail = "Invalid download request."
    elif _request.url.path.startswith("/api/tools/"):
        detail = "Invalid tool request."
    else:
        detail = "Invalid URL."
    return JSONResponse(
        status_code=400,
        content={"success": False, "detail": detail},
    )


@app.get("/api/health")
async def health_check() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/api/analyze", response_model=None)
async def analyze(request: AnalyzeRequest) -> dict[str, object] | JSONResponse:
    if request.diagnostic_request_id:
        logging.getLogger("vidorac.analyze").info(
            "Analyze request received: %s", request.diagnostic_request_id
        )
    try:
        _validated_url, platform = validate_and_classify_url(request.url)
        if platform not in PUBLIC_PLATFORMS:
            return JSONResponse(
                status_code=400,
                content={"success": False, "detail": "TikTok links only. Vidorac currently supports TikTok links on this website."},
            )
        media = await asyncio.to_thread(analyze_content, request.url)
    except InvalidUrlError:
        return JSONResponse(
            status_code=400,
            content={"success": False, "detail": "Invalid URL."},
        )
    except UnsupportedCollectionUrlError:
        return JSONResponse(
            status_code=400,
            content={"success": False, "detail": "Only individual posts are supported."},
        )
    except UnsupportedUrlError:
        return JSONResponse(
            status_code=400,
            content={
                "success": False,
                "detail": "Unsupported URL. Vidorac currently supports TikTok links on this website.",
            },
        )
    except GalleryTooManyItemsError:
        return JSONResponse(
            status_code=413,
            content={"success": False, "detail": "This post contains too many files."},
        )
    except InstagramPostTemporarilyUnavailableError:
        return JSONResponse(
            status_code=503,
            content={
                "success": False,
                "detail": "Instagram photo and carousel posts are temporarily unavailable. Instagram is currently restricting anonymous access to some public posts. Reels are still supported.",
            },
        )
    except GalleryAuthenticationError:
        return JSONResponse(
            status_code=422,
            content={"success": False, "detail": "This post requires authentication."},
        )
    except GallerySourceBlockedError:
        return JSONResponse(
            status_code=429,
            content={"success": False, "detail": "The source temporarily rejected the request. Please try again later."},
        )
    except GalleryTimeoutError as error:
        detail = (
            "Instagram is taking too long to respond. Please try again in a moment or try another public post."
            if error.platform == "instagram"
            else "The source platform is taking too long to respond. Please try again in a moment."
        )
        return JSONResponse(status_code=504, content={"success": False, "detail": detail})
    except GalleryTemporaryError:
        return JSONResponse(
            status_code=503,
            content={"success": False, "detail": "The source is temporarily unavailable. Please try again later."},
        )
    except GalleryContentUnavailableError:
        return JSONResponse(
            status_code=422,
            content={"success": False, "detail": "This content was removed or is no longer available."},
        )
    except AnalysisAuthenticationError as error:
        detail = (
            "This Facebook video is not publicly accessible without authentication."
            if error.platform == "facebook"
            else "This TikTok post is not publicly accessible."
            if error.platform == "tiktok"
            else "This video is not publicly accessible without authentication."
        )
        return JSONResponse(status_code=422, content=analysis_error_content(detail, error))
    except AnalysisSourceBlockedError as error:
        detail = (
            "TikTok temporarily blocked access from this network. Please try again later."
            if error.platform == "tiktok"
            else "YouTube is temporarily limiting requests from our server. Please try again later."
            if error.platform == "youtube"
            else "The source temporarily rejected the request. Please try again later."
        )
        return JSONResponse(status_code=429, content=analysis_error_content(detail, error))
    except AnalysisTemporaryError as error:
        detail = (
            "TikTok is temporarily unavailable due to changes on the platform. Please try again later."
            if error.platform == "tiktok"
            else "YouTube currently requires additional verification for this media. Please try again later."
            if error.platform == "youtube" and error.error_category == "youtube_verification_required"
            else "YouTube is temporarily unable to process this request from our server. Please try again later."
            if error.platform == "youtube"
            else "The source is temporarily unavailable. Please try again later."
        )
        return JSONResponse(status_code=503, content=analysis_error_content(detail, error))
    except AnalysisContentUnavailableError as error:
        return JSONResponse(
            status_code=422,
            content=analysis_error_content("This TikTok post is no longer available.", error),
        )
    except (AnalysisFailedError, GalleryAnalysisError):
        return JSONResponse(
            status_code=422,
            content={
                "success": False,
                "detail": "This post could not be analyzed.",
            },
        )

    key = "video" if media.get("media_type") == "video" else "media"
    return {"success": True, key: media}


def download_error_response(error: Exception, *, platform: str | None = None) -> JSONResponse:
    if isinstance(error, InvalidUrlError):
        return JSONResponse(
            status_code=400,
            content={"success": False, "detail": "Invalid URL."},
        )
    if isinstance(error, UnsupportedCollectionUrlError):
        return JSONResponse(
            status_code=400,
            content={"success": False, "detail": "Only individual posts are supported."},
        )
    if isinstance(error, UnsupportedUrlError):
        return JSONResponse(
            status_code=400,
            content={
                "success": False,
                "detail": "Unsupported URL. Vidorac currently supports TikTok links on this website.",
            },
        )
    if isinstance(error, FFmpegRequiredError):
        return JSONResponse(
            status_code=503,
            content={"success": False, "detail": "FFmpeg is required for this download format."},
        )
    if isinstance(error, FormatUnavailableError):
        return JSONResponse(
            status_code=422,
            content={"success": False, "detail": "This format is not available for this video."},
        )
    if isinstance(error, AuthenticationRequiredError):
        detail = (
            "This Facebook video is not publicly accessible without authentication."
            if platform == "facebook"
            else "This TikTok post is not publicly accessible."
            if platform == "tiktok"
            else "This video requires authentication and cannot be downloaded by Vidorac."
        )
        return JSONResponse(
            status_code=422,
            content={"success": False, "detail": detail},
        )
    if isinstance(error, InstagramPostTemporarilyUnavailableError):
        return JSONResponse(
            status_code=503,
            content={
                "success": False,
                "detail": "Instagram photo and carousel posts are temporarily unavailable. Instagram is currently restricting anonymous access to some public posts. Reels are still supported.",
            },
        )
    if isinstance(error, (NetworkTimeoutError, TemporaryUnavailableError, GalleryTemporaryError)):
        detail = (
            "TikTok temporarily rejected the request. Please try again later."
            if platform == "tiktok"
            else "The source is temporarily unavailable. Please try again later."
        )
        return JSONResponse(
            status_code=503,
            content={"success": False, "detail": detail},
        )
    if isinstance(error, (SourceBlockedError, GallerySourceBlockedError)):
        detail = (
            "TikTok temporarily blocked access from this network. Please try again later."
            if platform == "tiktok"
            else "The source temporarily rejected the request. Please try again later."
        )
        return JSONResponse(
            status_code=429,
            content={"success": False, "detail": detail},
        )
    if isinstance(error, (ContentRemovedError, GalleryContentUnavailableError)):
        return JSONResponse(
            status_code=422,
            content={"success": False, "detail": "This content was removed or is no longer available."},
        )
    if isinstance(error, ExtractorChangedError):
        return JSONResponse(
            status_code=422,
            content={"success": False, "detail": "This platform changed how the media is exposed. Update yt-dlp and try again."},
        )
    if isinstance(error, MediaUnavailableError):
        return JSONResponse(
            status_code=422,
            content={"success": False, "detail": "This video is not available."},
        )
    if isinstance(error, DurationLimitError):
        return JSONResponse(
            status_code=413,
            content={"success": False, "detail": "This video exceeds Vidorac's 3-hour limit."},
        )
    if isinstance(error, FileSizeLimitError):
        return JSONResponse(
            status_code=413,
            content={"success": False, "detail": "This file is too large for the current Vidorac Beta limits."},
        )
    if isinstance(error, GalleryTooManyItemsError):
        return JSONResponse(
            status_code=413,
            content={"success": False, "detail": "This post contains too many files."},
        )
    if isinstance(error, GalleryIndexError):
        return JSONResponse(
            status_code=400,
            content={"success": False, "detail": "The selected media item is not available."},
        )
    if isinstance(error, GallerySizeLimitError):
        return JSONResponse(
            status_code=413,
            content={"success": False, "detail": "This gallery is too large to download."},
        )
    if isinstance(error, GalleryAuthenticationError):
        return JSONResponse(
            status_code=422,
            content={"success": False, "detail": "This gallery requires authentication."},
        )
    if isinstance(error, GalleryAnalysisError):
        return JSONResponse(
            status_code=422,
            content={"success": False, "detail": "This post could not be analyzed."},
        )
    if isinstance(error, GalleryDownloadError):
        return JSONResponse(
            status_code=422,
            content={"success": False, "detail": "Vidorac couldn't download this post."},
        )
    return JSONResponse(
        status_code=422,
        content={"success": False, "detail": "We couldn't prepare this download."},
    )


def tool_error_response(error: MediaToolError) -> JSONResponse:
    if isinstance(error, UploadTooLargeError):
        return JSONResponse(
            status_code=413,
            content={"success": False, "detail": "This file exceeds Vidorac's 1 GB limit."},
        )
    if isinstance(error, UnsupportedUploadError):
        return JSONResponse(
            status_code=400,
            content={"success": False, "detail": "Choose a supported video file."},
        )
    if isinstance(error, NoVideoStreamError):
        return JSONResponse(
            status_code=422,
            content={"success": False, "detail": "This file does not contain a video stream."},
        )
    if isinstance(error, NoAudioStreamError):
        return JSONResponse(
            status_code=422,
            content={"success": False, "detail": "This video does not contain an audio stream."},
        )
    if isinstance(error, InvalidToolOptionError):
        return JSONResponse(
            status_code=400,
            content={"success": False, "detail": "Unsupported processing option."},
        )
    if isinstance(error, InvalidTrimRangeError):
        return JSONResponse(
            status_code=400,
            content={"success": False, "detail": "Enter a valid start and end time."},
        )
    if isinstance(error, ProcessingTimeoutError):
        return JSONResponse(
            status_code=408,
            content={"success": False, "detail": "Processing took too long."},
        )
    if isinstance(error, (FFmpegUnavailableError, EncoderUnavailableError)):
        return JSONResponse(
            status_code=503,
            content={"success": False, "detail": "The required media encoder is not available."},
        )
    if isinstance(error, (InvalidMediaError, ProbeFailedError)):
        return JSONResponse(
            status_code=422,
            content={"success": False, "detail": "This video is invalid or corrupted."},
        )
    if isinstance(error, MediaIOError):
        return JSONResponse(
            status_code=500,
            content={"success": False, "detail": "Vidorac could not store this file."},
        )
    if isinstance(error, ProcessingFailedError):
        return JSONResponse(
            status_code=422,
            content={"success": False, "detail": "FFmpeg could not process this video."},
        )
    return JSONResponse(
        status_code=422,
        content={"success": False, "detail": "Vidorac could not process this video."},
    )


def register_tool_result(result: ToolResult) -> dict[str, object]:
    try:
        download_id, prepared = prepared_downloads.register(result.artifact)
    except Exception:
        cleanup_temp_directory(result.artifact.temp_directory)
        logging.getLogger("clipora.tools").exception("Could not register a processed file")
        raise MediaIOError

    return {
        "success": True,
        "download_id": download_id,
        "filename": prepared.filename,
        "content_type": prepared.content_type,
        **result.metadata,
    }


def parse_seconds(value: str) -> float:
    try:
        return float(value)
    except (TypeError, ValueError) as exc:
        raise InvalidTrimRangeError from exc


@app.post("/api/download/prepare", response_model=None)
async def prepare_download(
    request: DownloadRequest,
    http_request: Request,
) -> dict[str, object] | JSONResponse:
    platform: str | None = None
    if not preparation_rate_limiter.allow(request_client_key(http_request)):
        return JSONResponse(
            status_code=429,
            content={"success": False, "detail": "Too many download requests. Please wait a few minutes and try again."},
        )
    try:
        _validated_url, platform = validate_and_classify_url(request.url)
        if platform not in PUBLIC_PLATFORMS:
            return JSONResponse(
                status_code=400,
                content={"success": False, "detail": "TikTok links only. Vidorac currently supports TikTok links on this website."},
            )
        if request.quality is None:
            artifact = await asyncio.to_thread(
                run_heavy_job,
                download_gallery_post,
                request.url,
                request.item_indices,
                force_archive=request.archive,
            )
        else:
            artifact = await asyncio.to_thread(
                run_heavy_job,
                download_media,
                request.url,
                request.quality,
                request.audio_bitrate,
            )
    except (DownloadPreparationError, GalleryError) as error:
        return download_error_response(error, platform=platform)
    except (InvalidUrlError, UnsupportedUrlError) as error:
        return download_error_response(error)

    try:
        download_id, prepared = prepared_downloads.register(artifact)
    except Exception:
        await asyncio.to_thread(cleanup_temp_directory, artifact.temp_directory)
        logging.getLogger("clipora.download").exception("Could not register a prepared download")
        return JSONResponse(
            status_code=500,
            content={"success": False, "detail": "We couldn't prepare this download."},
        )

    return {
        "success": True,
        "download_id": download_id,
        "filename": prepared.filename,
        "content_type": prepared.content_type,
    }


@app.post("/api/tools/compress", response_model=None)
async def compress_tool(
    file: Annotated[UploadFile, File()],
    quality: Annotated[str, Form()],
) -> dict[str, object] | JSONResponse:
    try:
        selected_quality = parse_compression_quality(quality)
        upload = await save_upload(file)
        result = await asyncio.to_thread(
            run_heavy_job, compress_video, upload, selected_quality
        )
        return register_tool_result(result)
    except MediaToolError as error:
        return tool_error_response(error)
    except Exception:
        logging.getLogger("clipora.tools").exception("Unexpected compression error")
        return JSONResponse(
            status_code=500,
            content={"success": False, "detail": "Vidorac could not process this video."},
        )


@app.post("/api/tools/convert", response_model=None)
async def convert_tool(
    file: Annotated[UploadFile, File()],
    format: Annotated[str, Form()],
) -> dict[str, object] | JSONResponse:
    try:
        selected_format = parse_conversion_format(format)
        upload = await save_upload(file)
        result = await asyncio.to_thread(
            run_heavy_job, convert_video, upload, selected_format
        )
        return register_tool_result(result)
    except MediaToolError as error:
        return tool_error_response(error)
    except Exception:
        logging.getLogger("clipora.tools").exception("Unexpected conversion error")
        return JSONResponse(
            status_code=500,
            content={"success": False, "detail": "Vidorac could not process this video."},
        )


@app.post("/api/tools/trim", response_model=None)
async def trim_tool(
    file: Annotated[UploadFile, File()],
    start: Annotated[str, Form()],
    end: Annotated[str, Form()],
) -> dict[str, object] | JSONResponse:
    try:
        start_seconds = parse_seconds(start)
        end_seconds = parse_seconds(end)
        upload = await save_upload(file)
        result = await asyncio.to_thread(
            run_heavy_job, trim_video, upload, start_seconds, end_seconds
        )
        return register_tool_result(result)
    except MediaToolError as error:
        return tool_error_response(error)
    except Exception:
        logging.getLogger("clipora.tools").exception("Unexpected trimming error")
        return JSONResponse(
            status_code=500,
            content={"success": False, "detail": "Vidorac could not process this video."},
        )


@app.get("/api/download/{download_id}", response_model=None)
async def deliver_download(download_id: str) -> FileResponse | JSONResponse:
    try:
        prepared = await asyncio.to_thread(prepared_downloads.claim, download_id)
    except PreparedDownloadExpiredError:
        return JSONResponse(
            status_code=410,
            content={"success": False, "detail": "This download has expired."},
        )
    except PreparedDownloadNotFoundError:
        return JSONResponse(
            status_code=404,
            content={"success": False, "detail": "Download not found."},
        )
    except PreparedDownloadFileMissingError:
        return JSONResponse(
            status_code=410,
            content={"success": False, "detail": "This prepared file is no longer available."},
        )

    cleanup = BackgroundTask(
        cleanup_prepared_download,
        prepared,
    )
    return FileResponse(
        path=prepared.path,
        media_type=prepared.content_type,
        filename=prepared.filename,
        content_disposition_type="attachment",
        background=cleanup,
    )
