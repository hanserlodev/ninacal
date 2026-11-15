#!/usr/bin/env python3
"""Small load test for the NinaCal API.

    python3 scripts/stress_api.py --path /api/grid/PE?year=2024 --requests 40 --workers 8

Use it against a local container, not against production without edge rate
limits. Client-side p99 includes Python/event-loop overhead; for microbenchmarks
of light endpoints use curl (see deploy/STRESS-TESTS.md).
"""

from __future__ import annotations

import argparse
import asyncio
import statistics
import time
from collections import Counter

import aiohttp


def percentile(values: list[float], p: float) -> float | None:
    if not values:
        return None
    ordered = sorted(values)
    index = min(len(ordered) - 1, max(0, round((p / 100) * (len(ordered) - 1))))
    return ordered[index]


async def run(base: str, path: str, requests: int, workers: int) -> dict:
    limits = aiohttp.TCPConnector(limit=workers * 2, ttl_dns_cache=300)
    timeout = aiohttp.ClientTimeout(total=120)
    semaphore = asyncio.Semaphore(workers)
    latencies: list[float] = []
    statuses: Counter[int | str] = Counter()
    bytes_read = 0

    async with aiohttp.ClientSession(connector=limits, timeout=timeout) as session:
        async def one() -> None:
            nonlocal bytes_read
            async with semaphore:
                started = time.perf_counter()
                try:
                    async with session.get(base + path) as response:
                        body = await response.read()
                        latencies.append((time.perf_counter() - started) * 1000)
                        statuses[response.status] += 1
                        bytes_read += len(body)
                except Exception as error:  # noqa: BLE001 - report the class only
                    statuses[type(error).__name__] += 1

        started = time.perf_counter()
        await asyncio.gather(*(one() for _ in range(requests)))
        elapsed = time.perf_counter() - started

    return {
        "path": path,
        "requests": requests,
        "workers": workers,
        "elapsed_s": round(elapsed, 2),
        "rps": round(requests / elapsed, 1),
        "p50_ms": round(percentile(latencies, 50) or 0, 1),
        "p95_ms": round(percentile(latencies, 95) or 0, 1),
        "p99_ms": round(percentile(latencies, 99) or 0, 1),
        "median_ms": round(statistics.median(latencies), 1) if latencies else None,
        "mib": round(bytes_read / 1024 / 1024, 2),
        "statuses": {str(key): value for key, value in statuses.items()},
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base", default="http://127.0.0.1:8080")
    parser.add_argument("--path", default="/health")
    parser.add_argument("--requests", type=int, default=100)
    parser.add_argument("--workers", type=int, default=8)
    parser.add_argument("--repeat", type=int, default=1)
    args = parser.parse_args()
    for _ in range(args.repeat):
        result = asyncio.run(run(args.base.rstrip("/"), args.path, args.requests, args.workers))
        print(result)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
