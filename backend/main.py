import os
import json
import asyncio
from contextlib import asynccontextmanager
from typing import Optional, Dict, Any, List

from fastapi import FastAPI, Query, HTTPException, Depends, Header, Body, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel, Field

from backend.database import (
    init_db,
    query_earthquakes,
    get_stats,
    get_admin_stats,
    vacuum_database,
    checkpoint_wal_database,
    deduplicate_earthquakes,
    delete_earthquake,
    insert_manual_earthquake,
    purge_subthreshold_earthquakes,
    get_admin_password,
    update_admin_password,
    DEFAULT_ADMIN_KEY,
    AOI_MIN_LATITUDE,
    AOI_MAX_LATITUDE,
    AOI_MIN_LONGITUDE,
    AOI_MAX_LONGITUDE,
    DB_PATH
)
from backend.ingestion.scheduler import (
    perform_sync,
    sync_single_provider,
    background_sync_worker,
    SYNC_STATE,
    PROVIDERS_STATUS
)
from backend.ingestion.backfill import (
    run_backfill_job,
    BACKFILL_STATE
)

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")
FRONTEND_DIR = os.path.join(os.path.dirname(__file__), "..", "frontend")
DOCS_DIR = os.path.join(os.path.dirname(__file__), "..", "docs")
ADMIN_KEY = DEFAULT_ADMIN_KEY


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    init_db()
    # Start background sync worker task (defaults to 180s = 3 minutes)
    sync_interval = int(os.environ.get("TEMAS_SYNC_INTERVAL", "180"))
    task = asyncio.create_task(background_sync_worker(interval_seconds=sync_interval))
    yield
    # Shutdown
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass


app = FastAPI(
    title="TEMAS API",
    description="Turkey Earthquake Monitoring & Analysis System API",
    version="2.1.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
    lifespan=lifespan
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def verify_admin_key(
    x_admin_key: Optional[str] = Header(None, alias="X-Admin-Key"),
    authorization: Optional[str] = Header(None),
    key: Optional[str] = Query(None)
):
    """Validates Admin credentials via header, Bearer token, or query param against dynamic SQLite config."""
    token = x_admin_key or key
    if not token and authorization and authorization.startswith("Bearer "):
        token = authorization.split("Bearer ", 1)[1].strip()

    active_key = get_admin_password()
    if not token or token != active_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing TEMAS Admin Key"
        )
    return True


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(..., min_length=1)
    new_password: str = Field(..., min_length=6)


class BackfillRequest(BaseModel):
    start_date: str = Field(default="2023-03-01", description="YYYY-MM-DD")
    end_date: str = Field(default="2026-08-31", description="YYYY-MM-DD")
    min_mag: float = Field(default=3.0, ge=1.0, le=9.0)
    chunk_days: int = Field(default=30, ge=5, le=90)


class ManualEarthquakeRequest(BaseModel):
    origintimeutc: str = Field(..., description="YYYY-MM-DD HH:MM:SS")
    magnitude: float = Field(..., ge=0.1, le=10.0)
    magtype: str = Field(default="ML")
    latitude: float = Field(..., ge=AOI_MIN_LATITUDE, le=AOI_MAX_LATITUDE)
    longitude: float = Field(..., ge=AOI_MIN_LONGITUDE, le=AOI_MAX_LONGITUDE)
    depthkm: float = Field(default=5.0, ge=0.0)
    region: str = Field(..., min_length=2)
    measmethod: str = Field(default="MANUAL-OPERATOR")
    attribute: str = Field(default="VERIFIED-REVIEWED")


class DeleteEarthquakeRequest(BaseModel):
    origintimeutc: str
    latitude: float
    longitude: float


# ==========================================
# PUBLIC API ENDPOINTS
# ==========================================

def get_version_tag() -> str:
    ver_path = os.path.join(os.path.dirname(__file__), "..", "VERSION")
    try:
        with open(ver_path, "r", encoding="utf-8") as f:
            return f.read().strip()
    except Exception:
        return "v2.8.1"


@app.get("/api/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "TEMAS-2.12",
        "version": get_version_tag(),
        "sync_state": SYNC_STATE
    }


@app.get("/api/earthquakes")
async def get_earthquakes(
    min_magnitude: float = Query(0.0, ge=0.0, le=10.0),
    max_magnitude: float = Query(10.0, ge=0.0, le=10.0),
    start_date: Optional[str] = Query(None, description="Filter >= YYYY-MM-DD or YYYY-MM-DD HH:MM:SS"),
    end_date: Optional[str] = Query(None, description="Filter <= YYYY-MM-DD or YYYY-MM-DD HH:MM:SS"),
    min_depth: Optional[float] = Query(None, ge=0.0),
    max_depth: Optional[float] = Query(None, ge=0.0),
    region: Optional[str] = Query(None, description="Fuzzy match region or province name"),
    measmethod: Optional[str] = Query(None, description="Filter measurement source / agency"),
    magtype: Optional[str] = Query(None, description="Filter magnitude scale (e.g. ML, Mw, MB)"),
    limit: int = Query(500, ge=1, le=25000),
    offset: int = Query(0, ge=0),
):
    """Returns earthquakes with dynamic filtering and total matching count."""
    records, total = query_earthquakes(
        min_mag=min_magnitude,
        max_mag=max_magnitude,
        start_date=start_date,
        end_date=end_date,
        min_depth=min_depth,
        max_depth=max_depth,
        region=region,
        measmethod=measmethod,
        magtype=magtype,
        limit=limit,
        offset=offset
    )
    return {
        "total": total,
        "count": len(records),
        "limit": limit,
        "offset": offset,
        "items": records
    }


@app.get("/api/stats")
async def get_earthquake_stats():
    """Returns summary KPIs and sync status for public dashboard."""
    stats = get_stats()
    stats["sync"] = SYNC_STATE
    return stats


@app.post("/api/sync")
async def trigger_sync():
    """Public manual sync trigger across all active sources."""
    if SYNC_STATE["is_running"]:
        return {"status": "in_progress", "message": "A synchronization task is already executing."}
    result = await perform_sync()
    return result


@app.get("/api/boundaries/tectonic")
async def get_tectonic_boundaries():
    """Serves PB2002 tectonic plate boundaries GeoJSON."""
    file_path = os.path.join(DATA_DIR, "PB2002_boundaries.json")
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Tectonic boundaries GeoJSON file not found.")
    return FileResponse(file_path, media_type="application/json")


@app.get("/api/boundaries/provinces")
async def get_province_boundaries():
    """Serves Turkish administrative provinces GeoJSON."""
    file_path = os.path.join(DATA_DIR, "geoboundaries-TUR-ADM1_simplified.json")
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Provinces GeoJSON file not found.")
    return FileResponse(file_path, media_type="application/json")


# ==========================================
# ADMIN API ENDPOINTS (AUTHENTICATED)
# ==========================================

@app.post("/api/admin/auth")
async def admin_auth_check(_: bool = Depends(verify_admin_key)):
    """Validates provided admin credentials."""
    return {"status": "authenticated", "message": "Admin credentials valid"}


@app.post("/api/admin/change-password")
async def admin_change_password(
    req: ChangePasswordRequest,
    _: bool = Depends(verify_admin_key)
):
    """Changes the administrator master passkey."""
    success = update_admin_password(req.current_password, req.new_password)
    if not success:
        raise HTTPException(status_code=400, detail="Current passkey is incorrect.")
    return {"status": "success", "message": "Admin passkey updated successfully."}


@app.get("/api/admin/status")
async def get_admin_dashboard_status(_: bool = Depends(verify_admin_key)):
    """Returns comprehensive observatory health, provider telemetry, and storage metrics."""
    db_stats = get_admin_stats()
    return {
        "status": "healthy",
        "providers": PROVIDERS_STATUS,
        "sync_state": SYNC_STATE,
        "backfill_state": BACKFILL_STATE,
        "database": db_stats
    }


@app.post("/api/admin/sync/{provider}")
async def admin_sync_provider(provider: str, _: bool = Depends(verify_admin_key)):
    """Triggers an on-demand sync for a specific provider ('koeri', 'emsc', 'usgs', or 'all')."""
    if provider == "all":
        if SYNC_STATE["is_running"]:
            return {"status": "in_progress", "message": "A synchronization task is already running."}
        return await perform_sync()
    
    if provider not in PROVIDERS_STATUS:
        raise HTTPException(status_code=400, detail=f"Invalid provider: {provider}. Options: koeri, emsc, usgs, all")
    
    return await sync_single_provider(provider)


@app.post("/api/admin/backfill")
async def admin_start_backfill(req: BackfillRequest, _: bool = Depends(verify_admin_key)):
    """Starts background historical backfill task for 2023-2026 data gap."""
    if BACKFILL_STATE["is_running"]:
        return {"status": "busy", "message": "A backfill job is currently running."}

    asyncio.create_task(run_backfill_job(
        start_date=req.start_date,
        end_date=req.end_date,
        min_mag=req.min_mag,
        chunk_days=req.chunk_days
    ))
    return {
        "status": "started",
        "message": f"Backfill queued for {req.start_date} to {req.end_date} (min M{req.min_mag})"
    }


@app.get("/api/admin/backfill/status")
async def admin_backfill_status(_: bool = Depends(verify_admin_key)):
    """Returns live backfill progress and log stream."""
    return BACKFILL_STATE


@app.get("/api/admin/db/download")
async def admin_download_db(_: bool = Depends(verify_admin_key)):
    """Exports and downloads a live snapshot of the SQLite database."""
    if not os.path.exists(DB_PATH):
        raise HTTPException(status_code=404, detail="Database file not found.")
    return FileResponse(
        DB_PATH,
        media_type="application/x-sqlite3",
        filename=f"temas-eq-turkey-{int(asyncio.get_event_loop().time())}.db"
    )


@app.post("/api/admin/db/vacuum")
async def admin_vacuum_db(_: bool = Depends(verify_admin_key)):
    """Runs VACUUM and ANALYZE on SQLite database to optimize disk footprint and index trees."""
    return vacuum_database()


@app.post("/api/admin/db/checkpoint-wal")
async def admin_checkpoint_wal(_: bool = Depends(verify_admin_key)):
    """Flushes committed transactions and truncates SQLite .db-wal file to 0 bytes."""
    return checkpoint_wal_database()


@app.post("/api/admin/db/deduplicate")
async def admin_deduplicate_db(_: bool = Depends(verify_admin_key)):
    """Deletes duplicate seismic records, enforces UNIQUE index constraint, and defragments storage."""
    return deduplicate_earthquakes()


@app.post("/api/admin/db/purge-noise")
async def admin_purge_noise(min_mag: float = Query(2.0, ge=1.0, le=5.0), _: bool = Depends(verify_admin_key)):
    """Purges meaningless micro-tremor noise below min_mag (e.g. M < 2.0) and defragments storage."""
    return purge_subthreshold_earthquakes(min_mag=min_mag)


@app.post("/api/admin/earthquakes")
async def admin_create_earthquake(event: ManualEarthquakeRequest, _: bool = Depends(verify_admin_key)):
    """Manually registers a verified seismic event."""
    success = insert_manual_earthquake(event.model_dump())
    if not success:
        return {"status": "duplicate", "message": "Earthquake already exists (identical primary key)."}
    return {"status": "created", "event": event.model_dump()}


@app.delete("/api/admin/earthquakes")
async def admin_delete_earthquake(event: DeleteEarthquakeRequest, _: bool = Depends(verify_admin_key)):
    """Deletes or flags an erroneous earthquake event."""
    deleted = delete_earthquake(event.origintimeutc, event.latitude, event.longitude)
    if not deleted:
        raise HTTPException(status_code=404, detail="Event matching primary key not found.")
    return {"status": "deleted", "deleted": True}


# ==========================================
# STATIC FILES & SPA ROUTING
# ==========================================

os.makedirs(FRONTEND_DIR, exist_ok=True)
app.mount("/static", StaticFiles(directory=FRONTEND_DIR), name="static")


@app.get("/docs")
async def serve_docs():
    """Serves 2-Column Documentation Portal."""
    docs_file = os.path.join(FRONTEND_DIR, "docs.html")
    if os.path.exists(docs_file):
        return FileResponse(docs_file)
    raise HTTPException(status_code=404, detail="Docs page not found")


@app.get("/api/docs/articles")
async def get_docs_articles():
    """Returns catalog of documentation articles grouped strictly into the 3 core pillars."""
    articles = [
        # PART 1: General Knowledge of Earthquakes, Seismology & Surveillance
        {
            "id": "seismology-fundamentals",
            "title": "1. Seismology Fundamentals: Physics & Waves",
            "category": "Part 1: Earthquake & Seismology Science",
            "badge": "Physics",
            "file": "01-seismology-fundamentals.md",
            "description": "Elastic rebound theory, hypocenter vs epicenter, wave spectrum (P, S, Surface), and Gutenberg-Richter scaling."
        },
        {
            "id": "measurement-and-surveillance",
            "title": "2. Scales, Sensors & Surveillance Networks",
            "category": "Part 1: Earthquake & Seismology Science",
            "badge": "Surveillance",
            "file": "02-measurement-and-surveillance.md",
            "description": "Magnitude vs intensity, energy release physics (31.6x factor), broadband seismometers, accelerometers, and EEW."
        },
        # PART 2: Turkey Earthquake History & Tectonic Setting
        {
            "id": "anatolian-tectonics",
            "title": "3. The Anatolian Tectonic Engine & Faults",
            "category": "Part 2: Turkey Earthquake History & Tectonics",
            "badge": "Tectonics",
            "file": "03-anatolian-tectonics.md",
            "description": "Northward Arabian indentation, westward Anatolian escape, North & East Anatolian faults, and the Marmara seismic gap."
        },
        {
            "id": "turkey-earthquake-history",
            "title": "4. Modern Turkey Earthquake Chronicle (1939–2023)",
            "category": "Part 2: Turkey Earthquake History & Tectonics",
            "badge": "History",
            "file": "04-turkey-earthquake-history.md",
            "description": "Chronological history from the 1939 Erzincan mega-event to 1999 Gölcük/Marmara and institutional evolution."
        },
        {
            "id": "kahramanmaras-doublet",
            "title": "5. The February 6, 2023 Kahramanmaraş Doublet",
            "category": "Part 2: Turkey Earthquake History & Tectonics",
            "badge": "Doublet 2023",
            "file": "05-kahramanmaras-doublet.md",
            "description": "Unprecedented multi-fault cascading ruptures (Pazarcık Mw 7.8 and Elbistan Mw 7.5), Coulomb stress transfer, and ground motion."
        },
        # PART 3: How TEMAS Was Formed to Cope with the Challenges
        {
            "id": "temas-genesis-and-mission",
            "title": "6. Platform Genesis & Mission Mandate",
            "category": "Part 3: How TEMAS Was Formed to Cope",
            "badge": "Genesis",
            "file": "06-temas-genesis-and-mission.md",
            "description": "Born from the chaos of February 2023: addressing government server collapse, conflicting public feeds, and panic."
        },
        {
            "id": "engineering-challenges-and-solutions",
            "title": "7. Architectural Solutions & Resilience",
            "category": "Part 3: How TEMAS Was Formed to Cope",
            "badge": "Architecture",
            "file": "07-engineering-challenges-and-solutions.md",
            "description": "Multi-agency deduplication, asynchronous scraper buffering, SQLite WAL throughput, and zero-downtime serving."
        },
        # API REFERENCE
        {
            "id": "api-reference",
            "title": "8. REST API Reference & Data Contracts",
            "category": "API Reference",
            "badge": "API",
            "description": "Public REST endpoints, query parameters, GeoJSON schemas, and real-time feed specifications."
        }
    ]
    return {"articles": articles}


@app.get("/api/docs/article/{doc_id}")
async def get_docs_article_content(doc_id: str):
    """Returns markdown content for a specific technical note or document."""
    doc_map = {
        "seismology-fundamentals": "01-seismology-fundamentals.md",
        "measurement-and-surveillance": "02-measurement-and-surveillance.md",
        "anatolian-tectonics": "03-anatolian-tectonics.md",
        "turkey-earthquake-history": "04-turkey-earthquake-history.md",
        "kahramanmaras-doublet": "05-kahramanmaras-doublet.md",
        "temas-genesis-and-mission": "06-temas-genesis-and-mission.md",
        "engineering-challenges-and-solutions": "07-engineering-challenges-and-solutions.md",
        "technote-01": "technote-01-data-ingestion-and-polling-strategy.md",
        "technote-02": "technote-02-seismic-catalog-hygiene-and-storage.md",
        "technote-03": "technote-03-security-and-administrative-operations.md",
        "technote-04": "technote-04-geospatial-cartography-and-multimodal-ux.md",
        "technote-05": "technote-05-full-spectrum-observatory-analytics.md",
        "changelog": "CHANGELOG.md"
    }

    if doc_id == "api-reference":
        api_md = """# TEMAS REST API & GeoJSON Data Contracts

**Status**: Production / Live  
**Base URL**: `http://localhost:4070`  
**Protocol**: HTTP/1.1 & HTTP/2 over TLS  
**Data Formats**: Application/JSON, GeoJSON (RFC 7946), CSV  

---

## 1. Public API Endpoints

### 1.1 Query Earthquakes (`GET /api/earthquakes`)
Returns filtered earthquakes matching geographic, temporal, and magnitude query constraints.

#### Query Parameters:
| Parameter | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `min_magnitude` | float | `2.0` | Minimum magnitude filter threshold |
| `max_magnitude` | float | `10.0` | Maximum magnitude filter threshold |
| `start_date` | string (ISO) | `null` | Lower UTC origin timestamp boundary |
| `end_date` | string (ISO) | `null` | Upper UTC origin timestamp boundary |
| `min_depth` | float | `0.0` | Minimum hypocenter depth in km |
| `max_depth` | float | `700.0`| Maximum hypocenter depth in km |
| `limit` | int | `1000` | Maximum number of records returned (max: 20,000) |
| `order_by` | string | `origintimeutc DESC` | Sorting column and direction |

#### Example Response:
```json
[
  {
    "eventid": "20230206_011734_AFAD",
    "origintimeutc": "2023-02-06T01:17:34Z",
    "eventtime": "2023-02-06 04:17:34",
    "magnitude": 7.8,
    "magtype": "Mw",
    "latitude": 37.288,
    "longitude": 37.043,
    "depthkm": 8.6,
    "region": "Pazarcık (Kahramanmaraş)",
    "source": "AFAD",
    "measmethod": "Moment Tensor"
  }
]
```

---

### 1.2 Real-Time Live Feed (`GET /api/earthquakes/live`)
Returns the latest seismic events ingested within the last 24 hours.

---

### 1.3 Seismicity Summary (`GET /api/earthquakes/summary`)
Returns aggregated telemetry statistics including 24h count, weekly count, maximum magnitude event, and provider ingestion health.

---

### 1.4 Active Tectonic Fault Lines (`GET /api/boundaries/faults`)
Serves MTA (General Directorate of Mineral Research and Exploration) active fault lines as GeoJSON MultiLineString features.

---

### 1.5 Tectonic Plate Boundaries (`GET /api/boundaries/tectonic`)
Serves Bird 2002 (PB2002) continental plate boundaries delineating the Anatolian, Arabian, Eurasian, and African plates.

---

### 1.6 Administrative Provinces (`GET /api/boundaries/provinces`)
Serves simplified administrative boundary polygons for all 81 provinces of Turkey.

---

## 2. Interactive Swagger / OpenAPI UI
For interactive browser-based testing of all parameters and schemas, visit the [Interactive API Playground](/api/docs).
"""
        return {
            "id": "api-reference",
            "title": "REST API Reference & Data Contracts",
            "category": "Developer Resources",
            "markdown": api_md
        }

    if doc_id not in doc_map:
        raise HTTPException(status_code=404, detail="Document not found")

    file_path = os.path.join(DOCS_DIR, doc_map[doc_id])
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail=f"File {doc_map[doc_id]} not found on disk")

    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()

    return {
        "id": doc_id,
        "filename": doc_map[doc_id],
        "markdown": content
    }


@app.get("/samet")
async def serve_admin():
    """Serves Admin Panel UI at secret route /samet."""
    admin_file = os.path.join(FRONTEND_DIR, "admin.html")
    if os.path.exists(admin_file):
        return FileResponse(admin_file)
    raise HTTPException(status_code=404, detail="Not Found")


@app.get("/admin")
async def dummy_admin():
    """Deceptive 404 for automated bots scanning for /admin."""
    raise HTTPException(status_code=404, detail="Not Found")


@app.get("/")
async def serve_index():
    index_file = os.path.join(FRONTEND_DIR, "index.html")
    if os.path.exists(index_file):
        return FileResponse(index_file)
    return {"message": "TEMAS 2.1 API is running."}
