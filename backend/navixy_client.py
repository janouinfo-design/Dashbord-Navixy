"""
Navixy API Client — Centralized, auditable communication layer.
Every request is tracked for the audit trail.
"""
import httpx
import time
import logging
import asyncio
from typing import Dict, List, Optional
from datetime import datetime, timezone

logger = logging.getLogger(__name__)


class NavixyRequestLog:
    """Tracks a single API request for audit purposes."""

    def __init__(self, endpoint: str, params: dict):
        self.endpoint = endpoint
        self.params = {k: v for k, v in params.items() if k != 'hash'}
        self.started_at = datetime.now(timezone.utc)
        self.response_time_ms = 0
        self.success = False
        self.error = None

    def complete(self, success: bool, response_time_ms: float, error: str = None):
        self.success = success
        self.response_time_ms = round(response_time_ms, 1)
        self.error = error

    def to_dict(self) -> dict:
        d = {
            "endpoint": self.endpoint,
            "fetched_at": self.started_at.isoformat(),
            "response_time_ms": self.response_time_ms,
            "success": self.success,
        }
        if self.error:
            d["error"] = self.error
        return d


class NavixyClient:
    """Centralized Navixy API client with per-request audit logging."""

    def __init__(self, api_url: str, default_hash: str = ""):
        self.api_url = api_url
        self.default_hash = default_hash
        self._request_logs: List[NavixyRequestLog] = []

    def reset_logs(self):
        self._request_logs = []

    def get_logs(self) -> List[dict]:
        return [log.to_dict() for log in self._request_logs]

    async def request(self, endpoint: str, params: dict = None, navixy_hash: str = None) -> dict:
        if params is None:
            params = {}
        params['hash'] = navixy_hash or self.default_hash

        req_log = NavixyRequestLog(endpoint, params)
        self._request_logs.append(req_log)

        start = time.monotonic()
        async with httpx.AsyncClient(timeout=30.0) as http_client:
            try:
                response = await http_client.post(f"{self.api_url}/{endpoint}", json=params)
                data = response.json()
                elapsed = (time.monotonic() - start) * 1000
                success = data.get('success', False)
                req_log.complete(success, elapsed, None if success else str(data.get('status', {})))
                if not success:
                    logger.warning(f"Navixy {endpoint}: {data.get('status', data)}")
                return data
            except Exception as e:
                elapsed = (time.monotonic() - start) * 1000
                req_log.complete(False, elapsed, str(e))
                logger.error(f"Navixy request failed {endpoint}: {e}")
                return {"success": False, "error": str(e)}

    # ---- Typed helpers ----

    async def get_trackers(self, h: str) -> dict:
        return await self.request("tracker/list", navixy_hash=h)

    async def get_tracker_state(self, tracker_id: int, h: str) -> dict:
        return await self.request("tracker/get_state", {"tracker_id": tracker_id}, navixy_hash=h)

    async def get_tracker_states_batch(self, ids: List[int], h: str, batch_size: int = 15) -> Dict[int, dict]:
        states: Dict[int, dict] = {}

        async def _single(tid: int):
            r = await self.get_tracker_state(tid, h)
            return tid, r

        for i in range(0, len(ids), batch_size):
            batch = ids[i:i + batch_size]
            results = await asyncio.gather(*[_single(tid) for tid in batch])
            for tid, result in results:
                if result.get('success'):
                    states[tid] = result.get('state', {})
        return states

    async def _chunked_stats(self, endpoint: str, ids: List[int], base_params: dict, h: str,
                             chunk: int = 100, result_key: str = "result") -> dict:
        """Navixy limite ces endpoints (ex: 128 traceurs max) — découpe et fusionne les résultats."""
        chunks = [ids[i:i + chunk] for i in range(0, len(ids), chunk)]
        results = await asyncio.gather(*[
            self.request(endpoint, {**base_params, "trackers": c}, navixy_hash=h) for c in chunks])
        merged: dict = {}
        ok = 0
        for r in results:
            if r.get('success'):
                ok += 1
                merged.update(r.get(result_key, {}) or {})
        if ok == 0:
            return results[0] if results else {"success": False}
        out = {"success": True, result_key: merged}
        if ok < len(chunks):
            out["partial"] = True
            logger.warning(f"Navixy {endpoint}: {len(chunks) - ok}/{len(chunks)} lots en échec — données partielles")
        return out

    async def get_mileage(self, ids: List[int], from_dt: str, to_dt: str, h: str) -> dict:
        return await self._chunked_stats("tracker/stats/mileage/read",
                                         ids, {"from": from_dt, "to": to_dt}, h)

    async def get_counters(self, ids: List[int], counter_type: str, h: str) -> dict:
        return await self._chunked_stats("tracker/counter/value/list",
                                         ids, {"type": counter_type}, h, result_key="value")

    async def get_groups(self, h: str) -> dict:
        return await self.request("tracker/group/list", navixy_hash=h)

    async def get_employees(self, h: str) -> dict:
        return await self.request("employee/list", navixy_hash=h)

    async def get_tracker_readings(self, tracker_id: int, h: str) -> dict:
        return await self.request("tracker/readings/list", {"tracker_id": tracker_id}, navixy_hash=h)

    async def get_sensors(self, tracker_id: int, h: str) -> dict:
        return await self.request("tracker/sensor/list", {"tracker_id": tracker_id}, navixy_hash=h)

    async def get_sensor_history(self, tracker_id: int, sensor_id: int, from_dt: str, to_dt: str, h: str) -> dict:
        return await self.request("tracker/sensor/data/read", {
            "tracker_id": tracker_id, "sensor_id": sensor_id, "from": from_dt, "to": to_dt
        }, navixy_hash=h)

    async def get_readings_and_sensors_batch(self, ids: List[int], h: str, batch_size: int = 10) -> Dict[int, tuple]:
        """Par traceur: (readings, sensors). Traceur absent du résultat = échec des deux appels."""
        out: Dict[int, tuple] = {}

        async def _one(tid: int):
            r, s = await asyncio.gather(self.get_tracker_readings(tid, h), self.get_sensors(tid, h))
            return tid, r, s

        for i in range(0, len(ids), batch_size):
            for tid, r, s in await asyncio.gather(*[_one(t) for t in ids[i:i + batch_size]]):
                if r.get("success") or s.get("success"):
                    out[tid] = (r, s)
        return out

    async def get_tracks(self, tracker_id: int, from_dt: str, to_dt: str, h: str) -> dict:
        return await self.request("track/list", {
            "tracker_id": tracker_id, "from": from_dt, "to": to_dt
        }, navixy_hash=h)

    async def generate_report(self, tracker_ids: List[int], from_dt: str, to_dt: str, plugin_id: int, title: str, h: str) -> dict:
        return await self.request("report/tracker/generate", {
            "trackers": tracker_ids, "from": from_dt, "to": to_dt,
            "time_filter": {"from": "00:00:00", "to": "23:59:59", "weekdays": [1, 2, 3, 4, 5, 6, 7]},
            "title": title, "geocoder": "google",
            "plugin": {"plugin_id": plugin_id},
        }, navixy_hash=h)

    async def get_report_status(self, report_id: int, h: str) -> dict:
        return await self.request("report/tracker/status", {"report_id": report_id}, navixy_hash=h)

    async def get_vehicles(self, h: str) -> dict:
        return await self.request("vehicle/list", {}, navixy_hash=h)

    async def read_vehicle(self, vehicle_id: int, h: str) -> dict:
        return await self.request("vehicle/read", {"vehicle_id": vehicle_id}, navixy_hash=h)

    async def update_vehicle(self, vehicle: dict, h: str) -> dict:
        return await self.request("vehicle/update", {"vehicle": vehicle}, navixy_hash=h)

    async def upload_vehicle_avatar(self, vehicle_id: int, filename: str, content: bytes, content_type: str, h: str) -> dict:
        async with httpx.AsyncClient(timeout=60.0) as c:
            r = await c.post(f"{self.api_url}/vehicle/avatar/upload",
                             data={"hash": h, "vehicle_id": str(vehicle_id)},
                             files={"file": (filename, content, content_type)})
            return r.json()

    async def retrieve_report(self, report_id: int, h: str) -> dict:
        return await self.request("report/tracker/retrieve", {"report_id": report_id}, navixy_hash=h)

    async def delete_report(self, report_id: int, h: str) -> dict:
        return await self.request("report/tracker/delete", {"report_id": report_id}, navixy_hash=h)
