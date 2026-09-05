import os
import json
import asyncio
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse

from backend.database import init_db, query_earthquakes, get_stats
from backend.ingestion.scheduler import perform_sync, background_sync_worker, SYNC_STATE

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")
FRONTEND_DIR = os.path.join(os.path.dirname(__file__), "..", "frontend")


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
    version="2.0.0",
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


@app.get("/api/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "TEMAS-2.0",
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
    """Returns summary KPIs and sync status."""
    stats = get_stats()
    stats["sync"] = SYNC_STATE
    return stats


@app.post("/api/sync")
async def trigger_sync():
    """Manual sync trigger."""
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


# Mount frontend static files
os.makedirs(FRONTEND_DIR, exist_ok=True)
app.mount("/static", StaticFiles(directory=FRONTEND_DIR), name="static")


@app.get("/")
async def serve_index():
    index_file = os.path.join(FRONTEND_DIR, "index.html")
    if os.path.exists(index_file):
        return FileResponse(index_file)
    return {"message": "TEMAS 2.0 API is running. Frontend under construction."}
