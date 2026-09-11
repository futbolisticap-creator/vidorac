import pytest

from app.runtime_config import allowed_origins_from_env, max_concurrent_jobs_from_env


def test_allowed_origins_default_to_local_frontend() -> None:
    assert allowed_origins_from_env("") == [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]


def test_allowed_origins_are_normalized_and_deduplicated() -> None:
    assert allowed_origins_from_env(
        "https://vidorac.pages.dev/, https://www.vidorac.example, https://vidorac.pages.dev"
    ) == ["https://vidorac.pages.dev", "https://www.vidorac.example"]


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
