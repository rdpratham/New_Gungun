"""
Token-bucket rate limiter per source domain.
Prevents IP bans and respects site rate limits.
"""

import asyncio
import time
from collections import defaultdict
from dataclasses import dataclass, field


@dataclass
class _Bucket:
    rate: float          # requests per second
    capacity: float      # max burst
    tokens: float = field(init=False)
    last_refill: float = field(init=False)

    def __post_init__(self):
        self.tokens = self.capacity
        self.last_refill = time.monotonic()

    def consume(self) -> float:
        """Return seconds to wait before request is allowed (0 = immediate)."""
        now = time.monotonic()
        elapsed = now - self.last_refill
        self.tokens = min(self.capacity, self.tokens + elapsed * self.rate)
        self.last_refill = now
        if self.tokens >= 1:
            self.tokens -= 1
            return 0.0
        return (1 - self.tokens) / self.rate


# Default rate limits per source (requests/sec, burst capacity)
_DEFAULTS: dict[str, tuple[float, float]] = {
    "google":     (0.5,  3),   # 1 req/2s, burst 3
    "linkedin":   (0.25, 2),   # 1 req/4s, burst 2
    "tofler":     (0.33, 2),   # 1 req/3s
    "zaubacorp":  (0.33, 2),
    "crunchbase": (0.5,  3),
    "default":    (1.0,  5),
}

_buckets: dict[str, _Bucket] = {}


def _get_bucket(source: str) -> _Bucket:
    if source not in _buckets:
        rate, cap = _DEFAULTS.get(source, _DEFAULTS["default"])
        _buckets[source] = _Bucket(rate=rate, capacity=cap)
    return _buckets[source]


async def throttle(source: str):
    """Async sleep until a request to `source` is allowed."""
    bucket = _get_bucket(source)
    wait = bucket.consume()
    if wait > 0:
        await asyncio.sleep(wait)
