import os
import sqlite3
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime, timedelta, timezone

DB_PATH = os.environ.get("TEMAS_DB_PATH", os.path.join(os.path.dirname(__file__), "..", "data", "eq-turkey.db"))


def get_db_connection() -> sqlite3.Connection:
    os.makedirs(os.path.dirname(os.path.abspath(DB_PATH)), exist_ok=True)
    conn = sqlite3.connect(DB_PATH, timeout=15.0)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    return conn


def init_db():
    """Initializes schema and creates indexes if missing."""
    with get_db_connection() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS quaketk (
                origintimeutc TEXT NOT NULL,
                magnitude REAL NOT NULL,
                magtype TEXT DEFAULT 'ML',
                latitude REAL NOT NULL,
                longitude REAL NOT NULL,
                depthkm REAL DEFAULT 0.0,
                region TEXT NOT NULL,
                measmethod TEXT DEFAULT 'RETMC',
                updtime TEXT,
                attribute TEXT,
                PRIMARY KEY (origintimeutc, latitude, longitude)
            )
        """)
        # Create indexes for fast filtering
        conn.execute("CREATE INDEX IF NOT EXISTS idx_quaketk_time ON quaketk (origintimeutc DESC)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_quaketk_mag ON quaketk (magnitude DESC)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_quaketk_region ON quaketk (region)")


def insert_earthquakes(records: List[Dict[str, Any]]) -> int:
    """Inserts records using INSERT OR IGNORE to prevent duplicates."""
    if not records:
        return 0

    inserted_count = 0
    sql = """
        INSERT OR IGNORE INTO quaketk 
        (origintimeutc, magnitude, magtype, latitude, longitude, depthkm, region, measmethod, updtime, attribute)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """
    with get_db_connection() as conn:
        for r in records:
            try:
                mag = float(r.get("magnitude", 0.0))
            except Exception:
                continue

            # Seismological noise filter: discard micro-tremors below M < 2.0
            if mag < 2.0:
                continue

            cursor = conn.execute(sql, (
                str(r["origintimeutc"]),
                mag,
                str(r.get("magtype", "ML")),
                float(r["latitude"]),
                float(r["longitude"]),
                float(r.get("depthkm", 0.0)),
                str(r["region"]).strip(),
                str(r.get("measmethod", "RETMC")),
                str(r.get("updtime", r["origintimeutc"])),
                str(r.get("attribute", ""))
            ))
            if cursor.rowcount > 0:
                inserted_count += 1
        conn.commit()
    return inserted_count


def to_turkey_time(utc_str: str) -> str:
    """Converts UTC string (YYYY-MM-DD HH:MM:SS) to TRT / UTC+3."""
    try:
        dt = datetime.strptime(utc_str[:19], "%Y-%m-%d %H:%M:%S")
        trt = dt + timedelta(hours=3)
        return trt.strftime("%Y-%m-%d %H:%M:%S")
    except Exception:
        return utc_str


def query_earthquakes(
    min_mag: float = 0.0,
    max_mag: float = 10.0,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    region: Optional[str] = None,
    min_depth: Optional[float] = None,
    max_depth: Optional[float] = None,
    limit: int = 500,
    offset: int = 0
) -> Tuple[List[Dict[str, Any]], int]:
    """Queries earthquakes with dynamic filters and returns (records, total_matching)."""
    where_clauses = ["magnitude >= ?", "magnitude <= ?"]
    params: List[Any] = [min_mag, max_mag]

    if start_date:
        where_clauses.append("origintimeutc >= ?")
        params.append(start_date)
    if end_date:
        where_clauses.append("origintimeutc <= ?")
        params.append(end_date)
    if min_depth is not None:
        where_clauses.append("depthkm >= ?")
        params.append(min_depth)
    if max_depth is not None:
        where_clauses.append("depthkm <= ?")
        params.append(max_depth)
    if region:
        where_clauses.append("region LIKE ?")
        params.append(f"%{region.strip()}%")

    where_sql = " AND ".join(where_clauses)

    with get_db_connection() as conn:
        # Total matching
        count_cursor = conn.execute(f"SELECT COUNT(*) as count FROM quaketk WHERE {where_sql}", params)
        total_count = count_cursor.fetchone()["count"]

        # Results with pagination
        data_params = params + [limit, offset]
        query_sql = f"""
            SELECT * FROM quaketk 
            WHERE {where_sql} 
            ORDER BY origintimeutc DESC 
            LIMIT ? OFFSET ?
        """
        rows = conn.execute(query_sql, data_params).fetchall()

        results = []
        for row in rows:
            d = dict(row)
            try:
                d["latitude"] = float(str(d["latitude"]).replace("°", "").replace("N", "").strip())
                d["longitude"] = float(str(d["longitude"]).replace("°", "").replace("E", "").strip())
                d["magnitude"] = float(d["magnitude"])
                d["depthkm"] = float(d["depthkm"]) if d["depthkm"] is not None else 0.0
            except Exception:
                pass
            d["eventtime"] = to_turkey_time(d["origintimeutc"])
            results.append(d)

    return results, total_count


def get_stats() -> Dict[str, Any]:
    """Computes summary statistics for KPIs."""
    with get_db_connection() as conn:
        total_row = conn.execute("SELECT COUNT(*) as cnt, AVG(depthkm) as avg_depth, MAX(magnitude) as max_mag FROM quaketk").fetchone()
        total_count = total_row["cnt"] or 0
        avg_depth = round(total_row["avg_depth"] or 0.0, 1)
        max_mag = total_row["max_mag"] or 0.0

        # Max magnitude event details
        max_event_row = conn.execute("SELECT * FROM quaketk WHERE magnitude = ? ORDER BY origintimeutc DESC LIMIT 1", (max_mag,)).fetchone()
        max_event = None
        if max_event_row:
            max_event = dict(max_event_row)
            max_event["eventtime"] = to_turkey_time(max_event["origintimeutc"])

        # Latest event time
        latest_row = conn.execute("SELECT MAX(origintimeutc) as latest FROM quaketk").fetchone()
        latest_time = latest_row["latest"] if latest_row else None

        # Last 24h count relative to now (UTC) or relative to latest event if historical
        now_utc = datetime.now(timezone.utc)
        yesterday_utc = (now_utc - timedelta(days=1)).strftime("%Y-%m-%d %H:%M:%S")
        day_row = conn.execute("SELECT COUNT(*) as cnt FROM quaketk WHERE origintimeutc >= ?", (yesterday_utc,)).fetchone()
        last_24h_count = day_row["cnt"] or 0

        # If last_24h_count is 0 because database contains historical sequences, get quakes in last 7 days of the dataset
        if last_24h_count == 0 and latest_time:
            try:
                latest_dt = datetime.strptime(latest_time[:19], "%Y-%m-%d %H:%M:%S")
                recent_window = (latest_dt - timedelta(days=1)).strftime("%Y-%m-%d %H:%M:%S")
                hist_24h_row = conn.execute("SELECT COUNT(*) as cnt FROM quaketk WHERE origintimeutc >= ?", (recent_window,)).fetchone()
                last_24h_count = hist_24h_row["cnt"] or 0
            except Exception:
                pass

    return {
        "total_count": total_count,
        "last_24h_count": last_24h_count,
        "max_magnitude": max_mag,
        "max_magnitude_event": max_event,
        "avg_depth": avg_depth,
        "last_event_time": latest_time,
        "last_event_time_trt": to_turkey_time(latest_time) if latest_time else None
    }


def get_admin_stats() -> Dict[str, Any]:
    """Provides detailed database telemetry, storage metrics, and annual breakdowns."""
    db_size_bytes = 0
    if os.path.exists(DB_PATH):
        db_size_bytes = os.path.getsize(DB_PATH)

    wal_path = f"{DB_PATH}-wal"
    wal_size_bytes = os.path.getsize(wal_path) if os.path.exists(wal_path) else 0

    with get_db_connection() as conn:
        # Total & date range
        total_row = conn.execute("SELECT COUNT(*) as cnt, MIN(origintimeutc) as min_date, MAX(origintimeutc) as max_date FROM quaketk").fetchone()
        total_count = total_row["cnt"] or 0
        min_date = total_row["min_date"]
        max_date = total_row["max_date"]

        # Yearly distribution
        years_rows = conn.execute("""
            SELECT SUBSTR(origintimeutc, 1, 4) as year, COUNT(*) as cnt, MAX(magnitude) as max_mag 
            FROM quaketk 
            GROUP BY year 
            ORDER BY year DESC
        """).fetchall()
        by_year = [{"year": r["year"], "count": r["cnt"], "max_mag": r["max_mag"]} for r in years_rows]

        # Magnitude classes (Threshold floor M >= 2.0)
        mag_dist_rows = conn.execute("""
            SELECT 
                SUM(CASE WHEN magnitude >= 7.0 THEN 1 ELSE 0 END) as m7_plus,
                SUM(CASE WHEN magnitude >= 6.0 AND magnitude < 7.0 THEN 1 ELSE 0 END) as m6_69,
                SUM(CASE WHEN magnitude >= 5.0 AND magnitude < 6.0 THEN 1 ELSE 0 END) as m5_59,
                SUM(CASE WHEN magnitude >= 4.0 AND magnitude < 5.0 THEN 1 ELSE 0 END) as m4_49,
                SUM(CASE WHEN magnitude >= 3.0 AND magnitude < 4.0 THEN 1 ELSE 0 END) as m3_39,
                SUM(CASE WHEN magnitude >= 2.0 AND magnitude < 3.0 THEN 1 ELSE 0 END) as m2_29,
                SUM(CASE WHEN magnitude < 2.0 THEN 1 ELSE 0 END) as m_sub2
            FROM quaketk
        """).fetchone()

        # Measurement methods / sources breakdown
        sources_rows = conn.execute("""
            SELECT measmethod, COUNT(*) as cnt 
            FROM quaketk 
            GROUP BY measmethod 
            ORDER BY cnt DESC 
            LIMIT 10
        """).fetchall()
        sources = [{"method": r["measmethod"], "count": r["cnt"]} for r in sources_rows]

    return {
        "total_records": total_count,
        "earliest_date": min_date,
        "latest_date": max_date,
        "db_size_bytes": db_size_bytes,
        "db_size_mb": round(db_size_bytes / (1024 * 1024), 2),
        "wal_size_mb": round(wal_size_bytes / (1024 * 1024), 2),
        "by_year": by_year,
        "magnitude_distribution": {
            "M7.0+": mag_dist_rows["m7_plus"] or 0,
            "M6.0-6.9": mag_dist_rows["m6_69"] or 0,
            "M5.0-5.9": mag_dist_rows["m5_59"] or 0,
            "M4.0-4.9": mag_dist_rows["m4_49"] or 0,
            "M3.0-3.9": mag_dist_rows["m3_39"] or 0,
            "M2.0-2.9": mag_dist_rows["m2_29"] or 0,
            "< M2.0 (Noise)": mag_dist_rows["m_sub2"] or 0
        },
        "sources": sources
    }


def purge_subthreshold_earthquakes(min_mag: float = 2.0) -> Dict[str, Any]:
    """
    Purges sub-threshold micro-tremors below min_mag (default < 2.0) from the database
    and defragments the SQLite file via VACUUM.
    """
    with get_db_connection() as conn:
        count_row = conn.execute("SELECT COUNT(*) as cnt FROM quaketk WHERE magnitude < ?", (min_mag,)).fetchone()
        deleted_count = count_row["cnt"] or 0
        conn.execute("DELETE FROM quaketk WHERE magnitude < ?", (min_mag,))
        conn.commit()

    vacuum_res = vacuum_database()
    return {
        "status": "success",
        "purged_records": deleted_count,
        "threshold": min_mag,
        "vacuum": vacuum_res
    }


def checkpoint_wal_database() -> Dict[str, Any]:
    """
    Executes PRAGMA wal_checkpoint(TRUNCATE) to commit all write-ahead log transactions
    into the primary database file and truncate the .db-wal file to 0 bytes.
    """
    wal_path = f"{DB_PATH}-wal"
    wal_before = os.path.getsize(wal_path) if os.path.exists(wal_path) else 0
    with get_db_connection() as conn:
        res = conn.execute("PRAGMA wal_checkpoint(TRUNCATE)").fetchone()
        busy = res[0] if res else 0
        log = res[1] if res else 0
        checkpointed = res[2] if res else 0
    wal_after = os.path.getsize(wal_path) if os.path.exists(wal_path) else 0
    reclaimed_bytes = max(0, wal_before - wal_after)
    return {
        "status": "success",
        "busy": busy,
        "log_pages": log,
        "checkpointed_pages": checkpointed,
        "wal_before_mb": round(wal_before / (1024 * 1024), 2),
        "wal_after_mb": round(wal_after / (1024 * 1024), 2),
        "reclaimed_kb": round(reclaimed_bytes / 1024, 1)
    }


def vacuum_database() -> Dict[str, Any]:
    """Runs SQLite VACUUM, ANALYZE, and WAL checkpoint to reclaim disk space and rebuild indexes."""
    before_size = os.path.getsize(DB_PATH) if os.path.exists(DB_PATH) else 0
    wal_res = checkpoint_wal_database()
    with get_db_connection() as conn:
        conn.execute("VACUUM")
        conn.execute("PRAGMA optimize")
    after_size = os.path.getsize(DB_PATH) if os.path.exists(DB_PATH) else 0
    saved_bytes = before_size - after_size
    return {
        "status": "success",
        "before_mb": round(before_size / (1024 * 1024), 2),
        "after_mb": round(after_size / (1024 * 1024), 2),
        "saved_kb": round(saved_bytes / 1024, 1),
        "wal": wal_res
    }


def delete_earthquake(origintimeutc: str, latitude: float, longitude: float) -> bool:
    """Deletes an anomalous or false-positive earthquake event."""
    with get_db_connection() as conn:
        cursor = conn.execute(
            "DELETE FROM quaketk WHERE origintimeutc = ? AND latitude = ? AND longitude = ?",
            (origintimeutc, latitude, longitude)
        )
        return cursor.rowcount > 0


def insert_manual_earthquake(record: Dict[str, Any]) -> bool:
    """Manually inserts a verified seismic record."""
    inserted = insert_earthquakes([record])
    return inserted > 0

