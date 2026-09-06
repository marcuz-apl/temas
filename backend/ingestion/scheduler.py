import os
import asyncio
import time
import logging
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, Optional, List

from backend.ingestion.koeri import fetch_koeri_earthquakes
from backend.ingestion.emsc import fetch_emsc_earthquakes
from backend.ingestion.usgs import fetch_usgs_earthquakes
from backend.database import insert_earthquakes, deduplicate_earthquakes

logger = logging.getLogger("temas.ingestion.scheduler")

# Provider telemetry and health states
PROVIDERS_STATUS: Dict[str, Dict[str, Any]] = {
    "koeri": {
        "name": "KOERI (Boğaziçi Univ)",
        "role": "Primary Local Network",
        "url": "http://www.koeri.boun.edu.tr/scripts/lasteq.asp",
        "status": "online",
        "latency_ms": 0,
        "last_sync": None,
        "last_fetched": 0,
        "last_error": None
    },
    "emsc": {
        "name": "EMSC-CSEM (Euro-Med)",
        "role": "Secondary FDSN Network",
        "url": "https://www.seismicportal.eu/fdsnws/event/1/query",
        "status": "online",
        "latency_ms": 0,
        "last_sync": None,
        "last_fetched": 0,
        "last_error": None
    },
    "usgs": {
        "name": "USGS (Global)",
        "role": "Tertiary Global Network",
        "url": "https://earthquake.usgs.gov/fdsnws/event/1/query",
        "status": "online",
        "latency_ms": 0,
        "last_sync": None,
        "last_fetched": 0,
        "last_error": None
    }
}

# Global sync state
SYNC_STATE: Dict[str, Any] = {
    "last_sync_time": None,
    "last_sync_time_trt": None,
    "last_sync_status": "idle",
    "last_fetched": 0,
    "last_inserted": 0,
    "is_running": False,
    "providers": PROVIDERS_STATUS
}

DEFAULT_INTERVAL_SECONDS = int(os.environ.get("TEMAS_SYNC_INTERVAL", "180"))  # Default 3 minutes (180s)


async def sync_single_provider(provider_name: str) -> Dict[str, Any]:
    """Syncs a specific provider on-demand, updates metrics, and stores new events."""
    if provider_name not in PROVIDERS_STATUS:
        raise ValueError(f"Unknown provider: {provider_name}")

    prov = PROVIDERS_STATUS[provider_name]
    t0 = time.perf_counter()
    now_str = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")

    try:
        if provider_name == "koeri":
            records = await fetch_koeri_earthquakes()
        elif provider_name == "emsc":
            records = await fetch_emsc_earthquakes(min_mag=2.5, limit=500)
        elif provider_name == "usgs":
            records = await fetch_usgs_earthquakes()
        else:
            records = []

        latency = round((time.perf_counter() - t0) * 1000, 1)
        inserted = insert_earthquakes(records)

        prov["status"] = "online"
        prov["latency_ms"] = latency
        prov["last_sync"] = now_str
        prov["last_fetched"] = len(records)
        prov["last_error"] = None

        return {
            "provider": provider_name,
            "status": "success",
            "fetched": len(records),
            "inserted": inserted,
            "latency_ms": latency,
            "timestamp": now_str
        }
    except Exception as e:
        latency = round((time.perf_counter() - t0) * 1000, 1)
        prov["status"] = "error"
        prov["latency_ms"] = latency
        prov["last_error"] = str(e)
        logger.error("Provider '%s' sync failed: %s", provider_name, e)
        return {
            "provider": provider_name,
            "status": "error",
            "message": str(e),
            "latency_ms": latency,
            "timestamp": now_str
        }


async def perform_sync() -> Dict[str, Any]:
    """
    Executes a multi-tier sync cycle with KOERI (primary), EMSC (secondary),
    and USGS (tertiary fallback) with resilient circuit breaker logic.
    """
    SYNC_STATE["is_running"] = True
    SYNC_STATE["last_sync_status"] = "in_progress"
    now_utc = datetime.now(timezone.utc)
    now_str = now_utc.strftime("%Y-%m-%d %H:%M:%S UTC")
    now_trt = (now_utc + timedelta(hours=3)).strftime("%Y-%m-%d %H:%M:%S TRT")

    all_records: List[Dict[str, Any]] = []
    results: Dict[str, Any] = {}

    try:
        # Run provider syncs concurrently
        tasks = [
            sync_single_provider("koeri"),
            sync_single_provider("emsc"),
            sync_single_provider("usgs"),
        ]
        sync_results = await asyncio.gather(*tasks, return_exceptions=True)

        for res in sync_results:
            if isinstance(res, dict):
                p_name = res.get("provider", "unknown")
                results[p_name] = res

        # Check overall state
        total_fetched = sum(PROVIDERS_STATUS[p]["last_fetched"] for p in PROVIDERS_STATUS)
        # Note: newly inserted count is handled by the individual sync_single_provider calls
        total_inserted = sum(r.get("inserted", 0) for r in results.values() if isinstance(r, dict))

        SYNC_STATE["last_sync_time"] = now_str
        SYNC_STATE["last_sync_time_trt"] = now_trt
        SYNC_STATE["last_sync_status"] = "success"
        SYNC_STATE["last_fetched"] = total_fetched
        SYNC_STATE["last_inserted"] = total_inserted

        # Post-sync automated deduplication pass
        dedup_count = 0
        try:
            dedup_res = deduplicate_earthquakes()
            dedup_count = dedup_res.get("purged_duplicates", 0)
            if dedup_count > 0:
                logger.info("Automated post-sync deduplication purged %d duplicate records", dedup_count)
        except Exception as de:
            logger.warning("Post-sync deduplication warning: %s", de)

        logger.info("Multi-source sync complete: %d fetched, %d newly inserted, %d deduplicated", total_fetched, total_inserted, dedup_count)
        return {
            "status": "success",
            "fetched": total_fetched,
            "inserted": total_inserted,
            "deduplicated": dedup_count,
            "providers": results,
            "timestamp": now_str
        }
    except Exception as e:
        logger.error("Sync cycle failed: %s", e)
        SYNC_STATE["last_sync_status"] = f"failed: {str(e)}"
        return {
            "status": "error",
            "message": str(e),
            "timestamp": now_str
        }
    finally:
        SYNC_STATE["is_running"] = False


async def background_sync_worker(interval_seconds: int = DEFAULT_INTERVAL_SECONDS):
    """Periodic earthquake synchronization worker."""
    logger.info("Starting background earthquake sync worker (interval: %ds)...", interval_seconds)
    # Initial sync on boot
    await perform_sync()

    while True:
        try:
            await asyncio.sleep(interval_seconds)
            await perform_sync()
        except asyncio.CancelledError:
            logger.info("Background sync worker received cancellation.")
            break
        except Exception as e:
            logger.error("Unexpected error in background sync loop: %s", e)
            await asyncio.sleep(30)
