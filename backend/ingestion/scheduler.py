import asyncio
import logging
from datetime import datetime, timezone
from typing import Dict, Any, Optional
from backend.ingestion.koeri import fetch_koeri_earthquakes
from backend.ingestion.usgs import fetch_usgs_earthquakes
from backend.database import insert_earthquakes

logger = logging.getLogger("temas.ingestion.scheduler")

# Background sync state
SYNC_STATE: Dict[str, Any] = {
    "last_sync_time": None,
    "last_sync_status": "idle",
    "last_fetched": 0,
    "last_inserted": 0,
    "is_running": False
}

DEFAULT_INTERVAL_SECONDS = 180  # 3 minutes


async def perform_sync() -> Dict[str, Any]:
    """Executes a single sync cycle with KOERI (primary) and USGS (secondary)."""
    SYNC_STATE["is_running"] = True
    SYNC_STATE["last_sync_status"] = "in_progress"
    now_str = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")

    try:
        # 1. Fetch Primary (KOERI)
        records = []
        try:
            koeri_records = await fetch_koeri_earthquakes()
            records.extend(koeri_records)
        except Exception as e:
            logger.error("Primary KOERI sync error: %s", e)

        # 2. Fetch Secondary / Fallback (USGS)
        try:
            usgs_records = await fetch_usgs_earthquakes()
            records.extend(usgs_records)
        except Exception as e:
            logger.warning("Secondary USGS sync error: %s", e)

        inserted = insert_earthquakes(records)

        SYNC_STATE["last_sync_time"] = now_str
        SYNC_STATE["last_sync_status"] = "success"
        SYNC_STATE["last_fetched"] = len(records)
        SYNC_STATE["last_inserted"] = inserted

        logger.info("Multi-source sync complete: %d fetched, %d newly inserted", len(records), inserted)
        return {
            "status": "success",
            "fetched": len(records),
            "inserted": inserted,
            "timestamp": SYNC_STATE["last_sync_time"]
        }
    except Exception as e:
        logger.error("Sync failed: %s", e)
        SYNC_STATE["last_sync_status"] = f"failed: {str(e)}"
        return {
            "status": "error",
            "message": str(e),
            "timestamp": now_str
        }
    finally:
        SYNC_STATE["is_running"] = False


async def background_sync_worker(interval_seconds: int = DEFAULT_INTERVAL_SECONDS):
    """Infinite loop for periodic earthquake synchronization."""
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
