import pytest

from app.runtime_config import (
    SUPPORTED_PUBLIC_PLATFORMS,
    allowed_origins_from_env,
    max_concurrent_jobs_from_env,
    preparation_rate_limit_from_env,
    public_platforms_from_env,
)


def test_allowed_origins_default_to_local_and_production_frontends() -> None:
    assert allowed_origins_from_env("") == [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "https://vidorac.com",
        "https://www.vidorac.com",
    ]


def test_allowed_origins_are_normalized_and_deduplicated() -> None:
    assert allowed_origins_from_env(
        "https://vidorac.pages.dev/, https://www.vidorac.example, https://vidorac.pages.dev"
    ) == [
        "https://vidorac.pages.dev",
        "https://www.vidorac.example",
        "https://vidorac.com",
        "https://www.vidorac.com",
    ]


def test_allowed_origins_preserve_configured_values_without_duplicating_production() -> None:
    assert allowed_origins_from_env(
        "https://vidorac.com, https://vidorac.pages.dev, https://www.vidorac.com/"
    ) == [
        "https://vidorac.com",
        "https://vidorac.pages.dev",
        "https://www.vidorac.com",
    ]


@pytest.mark.parametrize(
    "origin",
    ["*", "vidorac.pages.dev", "https://user:secret@example.com", "https://example.com/path"],
)
def test_allowed_origins_reject_unsafe_values(origin: str) -> None:
    with pytest.raises(ValueError):
        allowed_origins_from_env(origin)


@pytest.mark.parametrize(("value", "expected"), [("1", 1), ("2", 2), ("8", 8)])
def test_max_concurrent_jobs_accepts_safe_limits(value: str, expected: int) -> None:
    assert max_concurrent_jobs_from_env(value) == expected


@pytest.mark.parametrize("value", ["0", "9", "many"])
def test_max_concurrent_jobs_rejects_invalid_limits(value: str) -> None:
    with pytest.raises(ValueError):
        max_concurrent_jobs_from_env(value)


def test_public_platforms_default_preserves_shared_backend_core() -> None:
    assert public_platforms_from_env("") == SUPPORTED_PUBLIC_PLATFORMS


def test_public_platforms_can_restrict_a_deployment_to_tiktok() -> None:
    assert public_platforms_from_env(" tiktok ") == frozenset({"tiktok"})


@pytest.mark.parametrize("value", ["", "tiktok,unknown", "youtube,twitch"])
def test_public_platforms_reject_invalid_nonempty_values(value: str) -> None:
    if not value:
        assert public_platforms_from_env(value) == SUPPORTED_PUBLIC_PLATFORMS
    else:
        with pytest.raises(ValueError):
            public_platforms_from_env(value)


@pytest.mark.parametrize(("value", "expected"), [("1", 1), ("12", 12), ("120", 120)])
def test_preparation_rate_limit_accepts_safe_values(value: str, expected: int) -> None:
    assert preparation_rate_limit_from_env(value) == expected


@pytest.mark.parametrize("value", ["0", "121", "many"])
def test_preparation_rate_limit_rejects_invalid_values(value: str) -> None:
    with pytest.raises(ValueError):
        preparation_rate_limit_from_env(value)
