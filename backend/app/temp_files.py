import logging
import shutil
import tempfile
import threading
import time
from collections.abc import Iterable
from pathlib import Path


logger = logging.getLogger("clipora.temp_files")

TEMP_CLEANUP_INTERVAL = 5 * 60
TEMP_ORPHAN_MAX_AGE = 30 * 60
VIDORAC_TEMP_PREFIXES = ("clipora-", "clipora-gallery-", "clipora-tool-")

_temp_state_lock = threading.RLock()
_protected_temp_directories: set[Path] = set()
_handoff_temp_directories: dict[Path, float] = {}


def system_temp_directory() -> Path:
    return Path(tempfile.gettempdir()).resolve()


def _normalized_owned_directory(path: Path) -> Path:
    temp_root = system_temp_directory()
    candidate = Path(path)
    if candidate.is_symlink():
        raise ValueError("top-level temporary path is a symlink")
    normalized = candidate.resolve(strict=False)
    if normalized.parent != temp_root:
        raise ValueError("temporary directory is outside the system temp root")
    if not normalized.name.startswith(VIDORAC_TEMP_PREFIXES):
        raise ValueError("temporary directory does not use a Vidorac prefix")
    return normalized


def protect_temp_directory(path: Path) -> None:
    normalized = _normalized_owned_directory(path)
    with _temp_state_lock:
        _protected_temp_directories.add(normalized)
        _handoff_temp_directories.pop(normalized, None)


def handoff_temp_directory(path: Path) -> None:
    normalized = _normalized_owned_directory(path)
    with _temp_state_lock:
        _protected_temp_directories.discard(normalized)
        _handoff_temp_directories[normalized] = time.time() + TEMP_CLEANUP_INTERVAL


def create_temp_directory(prefix: str) -> Path:
    if not prefix.startswith(VIDORAC_TEMP_PREFIXES):
        raise ValueError("temporary directory prefix is not approved")
    with _temp_state_lock:
        path = Path(tempfile.mkdtemp(prefix=prefix, dir=system_temp_directory()))
        normalized = path.resolve(strict=True)
        _protected_temp_directories.add(normalized)
        _handoff_temp_directories.pop(normalized, None)
        return normalized


def cleanup_temp_directory(temp_directory: Path) -> bool:
    try:
        normalized = _normalized_owned_directory(temp_directory)
    except (OSError, ValueError) as exc:
        logger.warning("Refused unsafe temporary-directory cleanup for %s: %s", temp_directory, exc)
        return False

    with _temp_state_lock:
        _protected_temp_directories.discard(normalized)
        _handoff_temp_directories.pop(normalized, None)
        try:
            shutil.rmtree(normalized)
        except FileNotFoundError:
            return True
        except OSError as exc:
            logger.warning("Could not remove Vidorac temporary directory %s: %s", normalized, exc)
            return False
    return True


def protected_temp_directories(*, now: float | None = None) -> set[Path]:
    with _temp_state_lock:
        current_time = time.time() if now is None else now
        expired_handoffs = [
            path
            for path, deadline in _handoff_temp_directories.items()
            if deadline <= current_time
        ]
        for path in expired_handoffs:
            _handoff_temp_directories.pop(path, None)
        return set(_protected_temp_directories) | set(_handoff_temp_directories)


def cleanup_orphan_temp_directories(
    *,
    additionally_protected: Iterable[Path] = (),
    now: float | None = None,
) -> int:
    temp_root = system_temp_directory()
    cutoff_time = (time.time() if now is None else now) - TEMP_ORPHAN_MAX_AGE
    protected = protected_temp_directories(now=now)
    for path in additionally_protected:
        try:
            protected.add(_normalized_owned_directory(path))
        except (OSError, ValueError):
            logger.warning("Ignored unsafe protected temporary path during orphan cleanup: %s", path)

    removed = 0
    try:
        candidates = list(temp_root.iterdir())
    except OSError as exc:
        logger.warning("Could not scan the system temporary directory for Vidorac orphans: %s", exc)
        return 0

    for candidate in candidates:
        try:
            if candidate.is_symlink() or not candidate.is_dir():
                continue
            if not candidate.name.startswith(VIDORAC_TEMP_PREFIXES):
                continue
            normalized = _normalized_owned_directory(candidate)
            if normalized in protected:
                continue
            if candidate.stat().st_mtime > cutoff_time:
                continue
        except OSError as exc:
            logger.warning("Could not inspect Vidorac temporary candidate %s: %s", candidate, exc)
            continue

        with _temp_state_lock:
            handoff_deadline = _handoff_temp_directories.get(normalized)
            if normalized in _protected_temp_directories or (
                handoff_deadline is not None
                and handoff_deadline > (time.time() if now is None else now)
            ):
                continue
            _handoff_temp_directories.pop(normalized, None)
            if cleanup_temp_directory(normalized):
                removed += 1

    return removed
