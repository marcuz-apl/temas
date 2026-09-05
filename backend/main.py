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
    delete_earthquake,
    insert_manual_earthquake,
    purge_subthreshold_earthquakes,
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
ADMIN_KEY = os.environ.get("TEMAS_ADMIN_KEY", "temas-admin-2026")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    init_db()
    # Start background sync worker task
    task = asyncio.create_task(background_sync_worker(interval_seconds=180))
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
    """Validates Admin credentials via header, Bearer token, or query param."""
    token = x_admin_key or key
    if not token and authorization and authorization.startswith("Bearer "):
        token = authorization.split("Bearer ", 1)[1].strip()

    if not token or token != ADMIN_KEY:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing TEMAS Admin Key"
        )
    return True


class BackfillRequest(BaseModel):
    start_date: str = Field(default="2023-03-01", description="YYYY-MM-DD")
    end_date: str = Field(default="2026-08-31", description="YYYY-MM-DD")
    min_mag: float = Field(default=3.0, ge=1.0, le=9.0)
    chunk_days: int = Field(default=30, ge=5, le=90)


class ManualEarthquakeRequest(BaseModel):
    origintimeutc: str = Field(..., description="YYYY-MM-DD HH:MM:SS")
    magnitude: float = Field(..., ge=0.1, le=10.0)
    magtype: str = Field(default="ML")
    latitude: float = Field(..., ge=30.0, le=48.0)
    longitude: float = Field(..., ge=20.0, le=50.0)
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

@app.get("/api/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "TEMAS-2.1",
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
    limit: int = Query(500, ge=1, le=5000),
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


@app.get("/admin")
async def serve_admin():
    """Serves Admin Panel UI."""
    admin_file = os.path.join(FRONTEND_DIR, "admin.html")
    if os.path.exists(admin_file):
        return FileResponse(admin_file)
    return {"message": "Admin UI under construction."}


@app.get("/")
async def serve_index():
    index_file = os.path.join(FRONTEND_DIR, "index.html")
    if os.path.exists(index_file):
        return FileResponse(index_file)
    return {"message": "TEMAS 2.1 API is running."}
