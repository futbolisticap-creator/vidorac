import os
from urllib.parse import urlsplit


LOCAL_FRONTEND_ORIGINS = (
    "http://localhost:3000",
    "http://127.0.0.1:3000",
)


def allowed_origins_from_env(value: str | None = None) -> list[str]:
    raw_value = os.getenv("VIDORAC_ALLOWED_ORIGINS") if value is None else value
    if not raw_value or not raw_value.strip():
        return list(LOCAL_FRONTEND_ORIGINS)

    origins: list[str] = []
    for raw_origin in raw_value.split(","):
        origin = raw_origin.strip().rstrip("/")
        parsed = urlsplit(origin)
        if (
            parsed.scheme not in {"http", "https"}
            or not parsed.hostname
            or parsed.username
            or parsed.password
            or parsed.path
            or parsed.query
            or parsed.fragment
        ):
            raise ValueError(
                f"Invalid origin in VIDORAC_ALLOWED_ORIGINS: {raw_origin.strip()}"
            )
        if origin not in origins:
            origins.append(origin)

    if not origins:
        raise ValueError("VIDORAC_ALLOWED_ORIGINS must contain at least one origin")
    return origins


def max_concurrent_jobs_from_env(value: str | None = None) -> int:
    raw_value = (
        os.getenv("VIDORAC_MAX_CONCURRENT_JOBS", "2") if value is None else value
    )
    try:
        limit = int(raw_value)
    except (TypeError, ValueError) as exc:
        raise ValueError("VIDORAC_MAX_CONCURRENT_JOBS must be an integer") from exc
    if not 1 <= limit <= 8:
        raise ValueError("VIDORAC_MAX_CONCURRENT_JOBS must be between 1 and 8")
    return limit
