import asyncio
import logging
from datetime import datetime, timedelta, timezone
from typing import Dict, Any, Optional, List
import httpx

from backend.ingestion.emsc import fetch_emsc_earthquakes
from backend.ingestion.usgs import fetch_usgs_earthquakes
from backend.database import insert_earthquakes

logger = logging.getLogger("temas.ingestion.backfill")

# Global backfill state
BACKFILL_STATE: Dict[str, Any] = {
    "is_running": False,
    "status": "idle",
    "start_date": None,
    "end_date": None,
    "min_mag": 3.0,
    "total_windows": 0,
    "completed_windows": 0,
    "progress_pct": 0.0,
    "current_window": None,
    "total_fetched": 0,
    "total_inserted": 0,
    "logs": []
}


def add_log(msg: str):
    timestamp = datetime.now(timezone.utc).strftime("%H:%M:%S")
    log_entry = f"[{timestamp}] {msg}"
    logger.info(msg)
    BACKFILL_STATE["logs"].append(log_entry)
    if len(BACKFILL_STATE["logs"]) > 100:
        BACKFILL_STATE["logs"].pop(0)


async def run_backfill_job(
    start_date: str = "2023-03-01",
    end_date: str = "2026-08-31",
    min_mag: float = 3.0,
    chunk_days: int = 30
) -> Dict[str, Any]:
    """
    Asynchronously backfills historical earthquake records in chunked date windows
    using EMSC and USGS APIs. Strictly appends using INSERT OR IGNORE.
    """
    if BACKFILL_STATE["is_running"]:
        return {"status": "busy", "message": "A backfill job is already running."}

    BACKFILL_STATE["is_running"] = True
    BACKFILL_STATE["status"] = "running"
    BACKFILL_STATE["start_date"] = start_date
    BACKFILL_STATE["end_date"] = end_date
    BACKFILL_STATE["min_mag"] = min_mag
    BACKFILL_STATE["total_fetched"] = 0
    BACKFILL_STATE["total_inserted"] = 0
    BACKFILL_STATE["completed_windows"] = 0
    BACKFILL_STATE["progress_pct"] = 0.0
    BACKFILL_STATE["logs"] = []

    add_log(f"Starting historical backfill: {start_date} -> {end_date} (min_mag >= {min_mag})")

    try:
        dt_start = datetime.strptime(start_date, "%Y-%m-%d")
        dt_end = datetime.strptime(end_date, "%Y-%m-%d")

        # Generate windows
        windows = []
        cur = dt_start
        while cur < dt_end:
            win_end = min(cur + timedelta(days=chunk_days), dt_end)
            windows.append((cur.strftime("%Y-%m-%d"), win_end.strftime("%Y-%m-%d")))
            cur = win_end

        BACKFILL_STATE["total_windows"] = len(windows)
        add_log(f"Partitioned backfill into {len(windows)} batch windows of {chunk_days} days each.")

        for idx, (win_s, win_e) in enumerate(windows, 1):
            BACKFILL_STATE["current_window"] = f"{win_s} to {win_e}"
            add_log(f"Processing window [{idx}/{len(windows)}]: {win_s} to {win_e}")

            records: List[Dict[str, Any]] = []

            # 1. Fetch EMSC for this window
            try:
                emsc_recs = await fetch_emsc_earthquakes(
                    min_mag=min_mag,
                    limit=2000,
                    start_time=f"{win_s}T00:00:00",
                    end_time=f"{win_e}T23:59:59"
                )
                records.extend(emsc_recs)
                add_log(f"  EMSC: found {len(emsc_recs)} events")
            except Exception as e:
                add_log(f"  EMSC warning: {e}")

            # 2. Fetch USGS for this window
            try:
                usgs_url = "https://earthquake.usgs.gov/fdsnws/event/1/query"
                params = {
                    "format": "geojson",
                    "starttime": win_s,
                    "endtime": win_e,
                    "minmagnitude": min_mag,
                    "minlatitude": 35.0,
                    "maxlatitude": 43.0,
                    "minlongitude": 25.0,
                    "maxlongitude": 45.0,
                    "limit": 2000
                }
                async with httpx.AsyncClient(timeout=15.0) as client:
                    r = await client.get(usgs_url, params=params)
                    if r.status_code == 200:
                        usgs_data = r.json()
                        from backend.ingestion.usgs import parse_usgs_feature
                        u_recs = [parse_usgs_feature(f) for f in usgs_data.get("features", [])]
                        u_recs = [rec for rec in u_recs if rec]
                        records.extend(u_recs)
                        add_log(f"  USGS: found {len(u_recs)} events")
            except Exception as e:
                add_log(f"  USGS warning: {e}")

            # Insert batch
            inserted = insert_earthquakes(records)
            BACKFILL_STATE["total_fetched"] += len(records)
            BACKFILL_STATE["total_inserted"] += inserted
            BACKFILL_STATE["completed_windows"] = idx
            BACKFILL_STATE["progress_pct"] = round((idx / len(windows)) * 100, 1)

            add_log(f"  Inserted {inserted} new events (Fetched: {len(records)})")

            # Small pause to avoid aggressive hammering
            await asyncio.sleep(0.5)

        BACKFILL_STATE["status"] = "completed"
        add_log(f"Backfill finished! Total fetched: {BACKFILL_STATE['total_fetched']}, newly inserted: {BACKFILL_STATE['total_inserted']}")
        return {
            "status": "completed",
            "total_fetched": BACKFILL_STATE["total_fetched"],
            "total_inserted": BACKFILL_STATE["total_inserted"]
        }
    except Exception as e:
        BACKFILL_STATE["status"] = f"error: {str(e)}"
        add_log(f"Backfill error: {e}")
        return {"status": "error", "message": str(e)}
    finally:
        BACKFILL_STATE["is_running"] = False


if __name__ == "__main__":
    import sys
    start = sys.argv[1] if len(sys.argv) > 1 else "2024-01-01"
    end = sys.argv[2] if len(sys.argv) > 2 else "2024-03-31"
    mag = float(sys.argv[3]) if len(sys.argv) > 3 else 3.0
    print(f"Executing CLI backfill: {start} -> {end} (M >= {mag})")
    asyncio.run(run_backfill_job(start_date=start, end_date=end, min_mag=mag))
