import ipaddress
import json
import logging
import mimetypes
import os
import shutil
import socket
import ssl
import subprocess
import sys
import tempfile
import threading
import zipfile
from dataclasses import dataclass
from pathlib import Path
from typing import Any
from urllib.parse import urljoin, urlsplit

import requests
from gallery_dl import config, job
from requests.adapters import HTTPAdapter
from truststore import SSLContext
from urllib3.util.retry import Retry

from .analyzer import ensure_individual_media_url, normalize_url_for_extraction, validate_and_classify_url
from .downloader import DownloadArtifact, safe_download_name


logger = logging.getLogger("clipora.gallery")

MAX_GALLERY_ITEMS = 50
MAX_GALLERY_SIZE_BYTES = 1024 * 1024 * 1024
MAX_REDIRECTS = 5
GALLERY_ANALYSIS_TIMEOUT_SECONDS = 20
GALLERY_PROCESS_SHUTDOWN_SECONDS = 2
IMAGE_EXTENSIONS = {"jpg", "jpeg", "png", "webp", "gif", "avif"}
VIDEO_EXTENSIONS = {"mp4", "webm", "mov", "m4v"}
GALLERY_PLATFORMS = {"instagram", "tiktok", "x", "reddit", "facebook"}
SAFE_REQUEST_HEADERS = {"accept", "accept-language", "referer", "user-agent"}
_gallery_lock = threading.Lock()


class SystemTrustAdapter(HTTPAdapter):
    """Use the operating-system trust store without disabling TLS checks."""

    def init_poolmanager(self, connections: int, maxsize: int, block: bool = False, **pool_kwargs: Any) -> None:
        pool_kwargs["ssl_context"] = SSLContext(ssl.PROTOCOL_TLS_CLIENT)
        super().init_poolmanager(connections, maxsize, block=block, **pool_kwargs)

    def proxy_manager_for(self, proxy: str, **proxy_kwargs: Any):
        proxy_kwargs["ssl_context"] = SSLContext(ssl.PROTOCOL_TLS_CLIENT)
        return super().proxy_manager_for(proxy, **proxy_kwargs)


class GalleryError(RuntimeError):
    pass


class GalleryAnalysisError(GalleryError):
    pass


class GalleryAuthenticationError(GalleryAnalysisError):
    pass


class GalleryTemporaryError(GalleryAnalysisError):
    pass


class GalleryTimeoutError(GalleryTemporaryError):
    def __init__(self, platform: str) -> None:
        self.platform = platform
        super().__init__(f"{platform} gallery extraction timed out")


class InstagramPostTemporarilyUnavailableError(GalleryTemporaryError):
    """Instagram denied anonymous access to a photo or carousel post."""


class GallerySourceBlockedError(GalleryAnalysisError):
    pass


class GalleryContentUnavailableError(GalleryAnalysisError):
    pass


class GalleryTooManyItemsError(GalleryError):
    pass


class GallerySizeLimitError(GalleryError):
    pass


class GalleryDownloadError(GalleryError):
    pass


class GalleryIndexError(GalleryError):
    pass


@dataclass(frozen=True)
class GalleryItem:
    url: str
    extension: str
    kind: str
    headers: dict[str, str]
    preview_url: str | None = None
    width: int | None = None
    height: int | None = None
    duration: float | None = None


@dataclass(frozen=True)
class GalleryExtraction:
    title: str | None
    uploader: str | None
    platform: str
    items: tuple[GalleryItem, ...]

    @property
    def media_type(self) -> str:
        kinds = {item.kind for item in self.items}
        if len(self.items) == 1 and kinds == {"image"}:
            return "image"
        if kinds == {"image"}:
            return "gallery"
        if kinds == {"image", "video"} and len(self.items) > 1:
            return "mixed"
        raise GalleryAnalysisError


def _clean_text(value: Any, *, maximum: int = 180) -> str | None:
    if not isinstance(value, str):
        return None
    value = " ".join(value.split()).strip()
    return value[:maximum] if value else None


def _metadata_value(metadata: dict[str, Any], *keys: str) -> str | None:
    for key in keys:
        if value := _clean_text(metadata.get(key)):
            return value
    return None


def _extension_for(url: str, metadata: dict[str, Any]) -> str:
    extension = metadata.get("extension") or metadata.get("ext")
    if isinstance(extension, str):
        extension = extension.lower().lstrip(".")
    else:
        extension = Path(urlsplit(url).path).suffix.lower().lstrip(".")
    return "jpg" if extension == "jpeg" else extension


def _safe_headers(metadata: dict[str, Any]) -> dict[str, str]:
    raw_headers = metadata.get("_http_headers")
    if not isinstance(raw_headers, dict):
        return {}
    return {
        str(key): str(value)
        for key, value in raw_headers.items()
        if str(key).lower() in SAFE_REQUEST_HEADERS and isinstance(value, (str, int, float))
    }


def _positive_integer(value: Any) -> int | None:
    if isinstance(value, bool) or not isinstance(value, (int, float)) or value <= 0:
        return None
    return round(value)


def _positive_number(value: Any) -> float | None:
    if isinstance(value, bool) or not isinstance(value, (int, float)) or value <= 0:
        return None
    return float(value)


def _public_preview_url(item_url: str, kind: str, metadata: dict[str, Any]) -> str | None:
    candidates = (
        item_url,
        metadata.get("thumbnail"),
        metadata.get("preview"),
        metadata.get("display_url"),
        metadata.get("image"),
    ) if kind == "image" else (
        metadata.get("thumbnail"),
        metadata.get("preview"),
        metadata.get("display_url"),
        metadata.get("image"),
    )
    for candidate in candidates:
        if not isinstance(candidate, str):
            continue
        try:
            parsed = urlsplit(candidate)
        except ValueError:
            continue
        if parsed.scheme in {"http", "https"} and parsed.hostname and not parsed.username and not parsed.password:
            return candidate
    return None


def _map_gallery_exception(exc: Exception, platform: str) -> GalleryAnalysisError:
    message = str(exc).lower()
    if platform == "instagram" and any(
        term in message
        for term in (
            "redirect to login page",
            "redirect to home page",
            "instagram.com/accounts/login",
            "anonymous access",
        )
    ):
        return InstagramPostTemporarilyUnavailableError()
    if any(term in message for term in ("429", "too many requests", "ip blocked", "blocked by network security")):
        return GallerySourceBlockedError()
    if any(term in message for term in ("timeout", "timed out", "temporarily", "502", "503", "504")):
        return GalleryTemporaryError()
    if any(term in message for term in ("removed", "deleted", "not found", "404")):
        return GalleryContentUnavailableError()
    if any(term in message for term in ("login", "authentication", "private", "cookie", "403")):
        return GalleryAuthenticationError()
    return GalleryAnalysisError()


def _extract_gallery_post_direct(raw_url: str, platform: str | None = None) -> GalleryExtraction:
    url, actual_platform = validate_and_classify_url(raw_url)
    platform = platform or actual_platform
    url = normalize_url_for_extraction(url, platform)
    ensure_individual_media_url(url, platform)
    if platform not in GALLERY_PLATFORMS:
        raise GalleryAnalysisError

    settings = (
        (("extractor",), "image-range", f"1-{MAX_GALLERY_ITEMS + 1}"),
        (("extractor",), "cookies", None),
        (("extractor",), "cookies-update", False),
        (("extractor",), "truststore", True),
        (("extractor",), "timeout", 8.0),
        (("extractor",), "retries", 1),
        (("output",), "private", True),
    )
    try:
        with _gallery_lock, config.apply(settings):
            extraction_job = job.DataJob(url, file=None, resolve=True)
            extraction_job.run()
    except Exception as exc:
        logger.warning("gallery-dl could not analyze %s: %s", url, exc)
        raise _map_gallery_exception(exc, platform) from exc

    if extraction_job.exception is not None:
        logger.warning("gallery-dl could not analyze %s: %s", url, extraction_job.exception)
        raise _map_gallery_exception(extraction_job.exception, platform)

    items: list[GalleryItem] = []
    seen: set[str] = set()
    for item_url, raw_metadata in zip(extraction_job.data_urls, extraction_job.data_meta, strict=False):
        if not isinstance(item_url, str) or item_url in seen or not isinstance(raw_metadata, dict):
            continue
        extension = _extension_for(item_url, raw_metadata)
        if extension in IMAGE_EXTENSIONS:
            kind = "image"
        elif extension in VIDEO_EXTENSIONS:
            kind = "video"
        else:
            continue
        seen.add(item_url)
        items.append(
            GalleryItem(
                item_url,
                extension,
                kind,
                _safe_headers(raw_metadata),
                _public_preview_url(item_url, kind, raw_metadata),
                _positive_integer(raw_metadata.get("width")),
                _positive_integer(raw_metadata.get("height")),
                _positive_number(raw_metadata.get("duration")),
            )
        )

    if len(items) > MAX_GALLERY_ITEMS:
        raise GalleryTooManyItemsError
    if not items:
        raise GalleryAnalysisError

    metadata_candidates = [
        item for item in extraction_job.data_post + extraction_job.data_meta if isinstance(item, dict)
    ]
    title = next(
        (value for metadata in metadata_candidates if (value := _metadata_value(metadata, "title", "description", "caption", "content"))),
        None,
    )
    uploader = next(
        (value for metadata in metadata_candidates if (value := _metadata_value(metadata, "username", "uploader", "author", "owner"))),
        None,
    )
    extraction = GalleryExtraction(title, uploader, platform, tuple(items))
    extraction.media_type  # Validate that this is not a lone video result.
    return extraction


def _serialize_extraction(extraction: GalleryExtraction) -> dict[str, Any]:
    return {
        "title": extraction.title,
        "uploader": extraction.uploader,
        "platform": extraction.platform,
        "items": [
            {
                "url": item.url,
                "extension": item.extension,
                "kind": item.kind,
                "headers": item.headers,
                "preview_url": item.preview_url,
                "width": item.width,
                "height": item.height,
                "duration": item.duration,
            }
            for item in extraction.items
        ],
    }


def _deserialize_extraction(payload: Any, expected_platform: str) -> GalleryExtraction:
    if not isinstance(payload, dict) or payload.get("platform") != expected_platform:
        raise GalleryAnalysisError
    raw_items = payload.get("items")
    if not isinstance(raw_items, list):
        raise GalleryAnalysisError
    try:
        items = tuple(
            GalleryItem(
                url=item["url"],
                extension=item["extension"],
                kind=item["kind"],
                headers=item.get("headers") or {},
                preview_url=item.get("preview_url"),
                width=item.get("width"),
                height=item.get("height"),
                duration=item.get("duration"),
            )
            for item in raw_items
            if isinstance(item, dict)
        )
    except (KeyError, TypeError, ValueError) as exc:
        raise GalleryAnalysisError from exc
    extraction = GalleryExtraction(payload.get("title"), payload.get("uploader"), expected_platform, items)
    extraction.media_type
    return extraction


_WORKER_ERRORS: dict[str, type[GalleryError]] = {
    cls.__name__: cls
    for cls in (
        GalleryAnalysisError,
        GalleryAuthenticationError,
        GalleryTemporaryError,
        InstagramPostTemporarilyUnavailableError,
        GallerySourceBlockedError,
        GalleryContentUnavailableError,
        GalleryTooManyItemsError,
    )
}


def _terminate_worker(process: subprocess.Popen[str]) -> None:
    process.terminate()
    try:
        process.communicate(timeout=GALLERY_PROCESS_SHUTDOWN_SECONDS)
    except subprocess.TimeoutExpired:
        process.kill()
        process.communicate()


def _run_gallery_worker(url: str, platform: str) -> GalleryExtraction:
    backend_root = Path(__file__).resolve().parents[1]
    environment = os.environ.copy()
    environment["PYTHONIOENCODING"] = "utf-8"
    process = subprocess.Popen(
        [sys.executable, "-m", "app.gallery_worker", url, platform],
        cwd=backend_root,
        env=environment,
        stdin=subprocess.DEVNULL,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        encoding="utf-8",
    )
    try:
        stdout, stderr = process.communicate(timeout=GALLERY_ANALYSIS_TIMEOUT_SECONDS)
    except subprocess.TimeoutExpired as exc:
        _terminate_worker(process)
        logger.warning("gallery-dl analysis exceeded %s seconds for %s", GALLERY_ANALYSIS_TIMEOUT_SECONDS, platform)
        if platform == "instagram" and urlsplit(url).path.startswith("/p/"):
            raise InstagramPostTemporarilyUnavailableError from exc
        raise GalleryTimeoutError(platform) from exc

    if process.returncode != 0:
        logger.warning("gallery-dl worker failed for %s: %s", platform, " ".join(stderr.split())[:240])
        raise GalleryAnalysisError
    try:
        output_lines = [line for line in stdout.splitlines() if line.strip()]
        payload = json.loads(output_lines[-1])
    except (IndexError, json.JSONDecodeError, TypeError) as exc:
        raise GalleryAnalysisError from exc
    if not isinstance(payload, dict) or payload.get("ok") is not True:
        error_type = _WORKER_ERRORS.get(payload.get("error") if isinstance(payload, dict) else "")
        if error_type is GalleryTooManyItemsError:
            raise GalleryTooManyItemsError
        if error_type is InstagramPostTemporarilyUnavailableError:
            logger.warning(
                "gallery-dl classified an Instagram anonymous-login redirect (exit code %s)",
                process.returncode,
            )
        raise (error_type or GalleryAnalysisError)()
    return _deserialize_extraction(payload.get("extraction"), platform)


def extract_gallery_post(raw_url: str, platform: str | None = None) -> GalleryExtraction:
    url, actual_platform = validate_and_classify_url(raw_url)
    platform = platform or actual_platform
    url = normalize_url_for_extraction(url, platform)
    ensure_individual_media_url(url, platform)
    if platform not in GALLERY_PLATFORMS:
        raise GalleryAnalysisError
    return _run_gallery_worker(url, platform)


def analyze_gallery_post(raw_url: str, platform: str | None = None) -> dict[str, Any]:
    extraction = extract_gallery_post(raw_url, platform)
    first_preview = next((item.preview_url for item in extraction.items if item.preview_url), None)
    return {
        "media_type": extraction.media_type,
        "title": extraction.title,
        "thumbnail": first_preview,
        "uploader": extraction.uploader,
        "platform": extraction.platform,
        "item_count": len(extraction.items),
        "items": [
            {
                "index": index,
                "type": item.kind,
                "thumbnail": item.preview_url,
                "width": item.width,
                "height": item.height,
                "duration": item.duration,
                "extension": item.extension.upper(),
            }
            for index, item in enumerate(extraction.items)
        ],
    }


def _validate_public_download_url(url: str) -> None:
    try:
        parsed = urlsplit(url)
        hostname = parsed.hostname or ""
        port = parsed.port
    except ValueError as exc:
        raise GalleryDownloadError from exc
    if (
        parsed.scheme not in {"http", "https"}
        or not hostname
        or parsed.username is not None
        or parsed.password is not None
        or (port is not None and port not in {80, 443})
    ):
        raise GalleryDownloadError
    try:
        addresses = {entry[4][0] for entry in socket.getaddrinfo(hostname, port or 443)}
    except OSError as exc:
        raise GalleryDownloadError from exc
    if not addresses or any(not ipaddress.ip_address(address).is_global for address in addresses):
        raise GalleryDownloadError


def _download_item(
    session: requests.Session,
    item: GalleryItem,
    destination: Path,
    remaining_bytes: int,
) -> int:
    current_url = item.url
    for _redirect in range(MAX_REDIRECTS + 1):
        _validate_public_download_url(current_url)
        try:
            response = session.get(
                current_url,
                headers=item.headers,
                stream=True,
                timeout=(10, 30),
                allow_redirects=False,
            )
        except requests.RequestException as exc:
            if isinstance(exc, (requests.Timeout, requests.ConnectionError)):
                raise GalleryTemporaryError from exc
            raise GalleryDownloadError from exc
        if response.is_redirect or response.is_permanent_redirect:
            location = response.headers.get("Location")
            response.close()
            if not location:
                raise GalleryDownloadError
            current_url = urljoin(current_url, location)
            continue
        if response.status_code in {401, 403}:
            response.close()
            raise GalleryAuthenticationError
        if response.status_code == 429:
            response.close()
            raise GallerySourceBlockedError
        if response.status_code in {502, 503, 504}:
            response.close()
            raise GalleryTemporaryError
        if response.status_code in {404, 410}:
            response.close()
            raise GalleryContentUnavailableError
        if response.status_code != 200:
            response.close()
            raise GalleryDownloadError
        reported_size = response.headers.get("Content-Length")
        if reported_size and reported_size.isdigit() and int(reported_size) > remaining_bytes:
            response.close()
            raise GallerySizeLimitError
        written = 0
        try:
            with destination.open("xb") as output:
                for chunk in response.iter_content(chunk_size=64 * 1024):
                    if not chunk:
                        continue
                    written += len(chunk)
                    if written > remaining_bytes:
                        raise GallerySizeLimitError
                    output.write(chunk)
        except Exception:
            destination.unlink(missing_ok=True)
            raise
        finally:
            response.close()
        if written == 0:
            destination.unlink(missing_ok=True)
            raise GalleryDownloadError
        return written
    raise GalleryDownloadError


def _create_safe_zip(files: list[Path], zip_path: Path) -> None:
    if len(files) > MAX_GALLERY_ITEMS:
        raise GalleryTooManyItemsError
    with zipfile.ZipFile(zip_path, "x", allowZip64=True) as archive:
        for path in files:
            if path.parent != zip_path.parent or not path.is_file() or path.is_symlink():
                raise GalleryDownloadError
            extension = path.suffix.lower().lstrip(".")
            compression = zipfile.ZIP_STORED if extension in VIDEO_EXTENSIONS else zipfile.ZIP_DEFLATED
            archive.write(path, arcname=path.name, compress_type=compression)


def _selected_items(
    extraction: GalleryExtraction,
    item_indices: list[int] | tuple[int, ...] | None,
) -> list[tuple[int, GalleryItem]]:
    if item_indices is None:
        return list(enumerate(extraction.items))
    if not item_indices or len(item_indices) > MAX_GALLERY_ITEMS:
        raise GalleryIndexError
    if any(isinstance(index, bool) or not isinstance(index, int) for index in item_indices):
        raise GalleryIndexError
    if len(set(item_indices)) != len(item_indices):
        raise GalleryIndexError
    if any(index < 0 or index >= len(extraction.items) for index in item_indices):
        raise GalleryIndexError
    return [(index, extraction.items[index]) for index in sorted(item_indices)]


def download_gallery_post(
    raw_url: str,
    item_indices: list[int] | tuple[int, ...] | None = None,
    *,
    force_archive: bool = False,
) -> DownloadArtifact:
    extraction = extract_gallery_post(raw_url)
    selected = _selected_items(extraction, item_indices)
    temp_directory = Path(tempfile.mkdtemp(prefix="clipora-gallery-"))
    downloaded: list[Path] = []
    total_size = 0

    try:
        with requests.Session() as session:
            session.mount(
                "https://",
                SystemTrustAdapter(
                    max_retries=Retry(
                        total=2,
                        connect=2,
                        read=2,
                        status=2,
                        status_forcelist=(429, 500, 502, 503, 504),
                        allowed_methods=frozenset({"GET"}),
                        backoff_factor=0.25,
                        raise_on_status=False,
                    )
                ),
            )
            for source_index, item in selected:
                output_path = temp_directory / f"{source_index + 1:02d}.{item.extension}"
                total_size += _download_item(
                    session,
                    item,
                    output_path,
                    MAX_GALLERY_SIZE_BYTES - total_size,
                )
                downloaded.append(output_path)

        if len(downloaded) == 1 and not force_archive:
            output_path = downloaded[0]
            source_index = selected[0][0]
            suffix = "" if extraction.media_type == "image" else f" - {item.kind.title()} {source_index + 1}"
            title = (extraction.title or "Vidorac media")[:90].rstrip()
            return DownloadArtifact(
                path=output_path,
                download_name=safe_download_name(
                    f"{title}{suffix}",
                    output_path.suffix.lstrip("."),
                ),
                media_type=mimetypes.guess_type(output_path.name)[0] or "application/octet-stream",
                temp_directory=temp_directory,
            )

        zip_path = temp_directory / "vidorac-post.zip"
        _create_safe_zip(downloaded, zip_path)
        return DownloadArtifact(
            path=zip_path,
            download_name=safe_download_name(extraction.title or f"{extraction.platform}-post", "zip"),
            media_type="application/zip",
            temp_directory=temp_directory,
        )
    except GalleryError:
        shutil.rmtree(temp_directory, ignore_errors=True)
        raise
    except Exception as exc:
        logger.exception("Could not download gallery post %s", raw_url)
        shutil.rmtree(temp_directory, ignore_errors=True)
        raise GalleryDownloadError from exc
