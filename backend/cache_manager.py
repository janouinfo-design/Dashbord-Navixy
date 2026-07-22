"""
Tenant-isolated cache manager with audit metadata.
Each tenant has its own cache namespace — no cross-tenant pollution.
"""
import time
from typing import Any, Optional, Tuple


class CacheEntry:
    __slots__ = ('data', 'created_at')

    def __init__(self, data: Any):
        self.data = data
        self.created_at = time.time()

    @property
    def age_seconds(self) -> float:
        return round(time.time() - self.created_at, 1)

    def is_expired(self, ttl: int) -> bool:
        return time.time() - self.created_at >= ttl


class TenantCacheManager:
    """Per-tenant isolated in-memory cache."""

    def __init__(self, ttl: int = 300):
        self._stores: dict[str, dict[str, CacheEntry]] = {}
        self.ttl = ttl

    def _store(self, tenant: str) -> dict:
        if tenant not in self._stores:
            self._stores[tenant] = {}
        return self._stores[tenant]

    def get(self, tenant: str, key: str) -> Tuple[Optional[Any], bool, float]:
        """Returns (data, cache_hit, cache_age_seconds)."""
        store = self._store(tenant)
        entry = store.get(key)
        if entry and not entry.is_expired(self.ttl):
            return entry.data, True, entry.age_seconds
        if entry:
            del store[key]
        return None, False, 0.0

    def set(self, tenant: str, key: str, data: Any):
        self._store(tenant)[key] = CacheEntry(data)

    def invalidate_tenant(self, tenant: str):
        self._stores.pop(tenant, None)

    def stats(self) -> dict:
        return {
            "tenants": {t: len(s) for t, s in self._stores.items()},
            "total_entries": sum(len(s) for s in self._stores.values()),
        }
