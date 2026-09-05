from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field


class Earthquake(BaseModel):
    origintimeutc: str = Field(..., description="UTC Origin Time (YYYY-MM-DD HH:MM:SS)")
    eventtime: Optional[str] = Field(None, description="Local Time Turkey (UTC+3)")
    magnitude: float = Field(..., description="Earthquake magnitude")
    magtype: str = Field(default="ML", description="Magnitude scale type (ML, Mw, Md)")
    latitude: float = Field(..., description="Epicenter Latitude (Degrees North)")
    longitude: float = Field(..., description="Epicenter Longitude (Degrees East)")
    depthkm: float = Field(default=0.0, description="Focal Depth in Kilometers")
    region: str = Field(..., description="Geographic region / province / district")
    measmethod: Optional[str] = Field(default="RETMC", description="Measurement Method")
    updtime: Optional[str] = Field(None, description="Last update time")
    attribute: Optional[str] = Field(None, description="Event attributes or quality flag")


class EarthquakeQuery(BaseModel):
    min_magnitude: Optional[float] = 0.0
    max_magnitude: Optional[float] = 10.0
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    min_depth: Optional[float] = None
    max_depth: Optional[float] = None
    region: Optional[str] = None
    limit: int = 500
    offset: int = 0


class EarthquakeStats(BaseModel):
    total_count: int
    last_24h_count: int
    max_magnitude: float
    max_magnitude_event: Optional[Earthquake] = None
    avg_depth: float
    last_event_time: Optional[str] = None
    last_sync_time: Optional[str] = None


class SyncResult(BaseModel):
    fetched: int
    inserted: int
    latest_event: Optional[str] = None
    status: str = "success"
    message: str
