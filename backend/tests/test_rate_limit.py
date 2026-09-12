from app.rate_limit import SlidingWindowRateLimiter


def test_sliding_window_blocks_only_after_the_configured_limit() -> None:
    now = [100.0]
    limiter = SlidingWindowRateLimiter(2, 60, clock=lambda: now[0])
    assert limiter.allow("visitor")
    assert limiter.allow("visitor")
    assert not limiter.allow("visitor")
    assert limiter.allow("other-visitor")

    now[0] = 161.0
    assert limiter.allow("visitor")
