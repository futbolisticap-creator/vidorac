import ipaddress
import threading
import time
from collections import defaultdict, deque
from collections.abc import Callable

from fastapi import Request


class SlidingWindowRateLimiter:
    def __init__(self, limit: int, window_seconds: float, *, clock: Callable[[], float] = time.monotonic) -> None:
        self.limit = limit
        self.window_seconds = window_seconds
        self._clock = clock
        self._events: dict[str, deque[float]] = defaultdict(deque)
        self._lock = threading.Lock()

    def allow(self, key: str) -> bool:
        now = self._clock()
        cutoff = now - self.window_seconds
        with self._lock:
            events = self._events[key]
            while events and events[0] <= cutoff:
                events.popleft()
            if len(events) >= self.limit:
                return False
            events.append(now)
            return True


def request_client_key(request: Request) -> str:
    candidates = [
        request.headers.get("cf-connecting-ip", ""),
        request.headers.get("x-forwarded-for", "").split(",", 1)[0].strip(),
        request.client.host if request.client else "",
    ]
    for candidate in candidates:
        try:
            return str(ipaddress.ip_address(candidate))
        except ValueError:
            continue
    return "unknown"
