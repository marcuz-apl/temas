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
            cursor = conn.execute(sql, (
                str(r["origintimeutc"]),
                float(r["magnitude"]),
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
