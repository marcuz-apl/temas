import logging
import httpx
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional

logger = logging.getLogger("temas.ingestion.emsc")

EMSC_FDSN_URL = "https://www.seismicportal.eu/fdsnws/event/1/query"

# Turkey bounding box
TURKEY_BBOX = {
    "minlat": 35.0,
    "maxlat": 43.0,
    "minlon": 25.0,
    "maxlon": 45.0
}


def parse_emsc_feature(feature: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """Converts a single EMSC GeoJSON feature to TEMAS internal earthquake schema."""
    props = feature.get("properties", {})
    time_str = props.get("time")
    if not time_str:
        return None

    try:
        # e.g. "2026-09-05T11:48:35.41Z" -> "2026-09-05 11:48:35"
        clean_time = time_str.replace("Z", "+00:00")
        dt = datetime.fromisoformat(clean_time).astimezone(timezone.utc)
        origintimeutc = dt.strftime("%Y-%m-%d %H:%M:%S")
    except Exception:
        origintimeutc = time_str[:19].replace("T", " ")

    mag = props.get("mag")
    if mag is None:
        return None

    lat = props.get("lat")
    lon = props.get("lon")
    if lat is None or lon is None:
        # Fallback to geometry coordinates [lon, lat, depth]
        coords = feature.get("geometry", {}).get("coordinates", [])
        if len(coords) >= 2:
            lon, lat = coords[0], coords[1]
        else:
            return None

    depth = props.get("depth", 0.0)
    magtype = (props.get("magtype") or "ML").upper()
    region = props.get("flynn_region") or "TURKEY REGION"
    auth = props.get("auth") or "EMSC"

    return {
        "origintimeutc": origintimeutc,
        "magnitude": round(float(mag), 1),
        "magtype": magtype,
        "latitude": round(float(lat), 4),
        "longitude": round(float(lon), 4),
        "depthkm": round(float(depth or 0.0), 1),
        "region": region.strip(),
        "measmethod": f"EMSC-{auth}",
        "updtime": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S"),
        "attribute": "AUTOMATIC" if props.get("evtype") == "ke" else "REVIEWED"
    }


async def fetch_emsc_earthquakes(
    min_mag: float = 2.5,
    limit: int = 500,
    start_time: Optional[str] = None,
    end_time: Optional[str] = None
) -> List[Dict[str, Any]]:
    """
    Fetches real-time or historical seismic events from EMSC FDSN web service.
    EMSC serves as high-uptime secondary provider when KOERI is unreachable.
    """
    params = {
        "format": "json",
        "minlat": TURKEY_BBOX["minlat"],
        "maxlat": TURKEY_BBOX["maxlat"],
        "minlon": TURKEY_BBOX["minlon"],
        "maxlon": TURKEY_BBOX["maxlon"],
        "minmag": min_mag,
        "limit": limit
    }
    if start_time:
        params["starttime"] = start_time
    if end_time:
        params["endtime"] = end_time

    headers = {
        "User-Agent": "TEMAS/2.1 (Earthquake Observatory; Turkey-Syria Region)",
        "Accept": "application/json"
    }

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(EMSC_FDSN_URL, params=params, headers=headers)
            resp.raise_for_status()
            data = resp.json()

        features = data.get("features", [])
        parsed_records = []
        for feat in features:
            record = parse_emsc_feature(feat)
            if record:
                parsed_records.append(record)

        logger.info("Successfully fetched %d records from EMSC", len(parsed_records))
        return parsed_records
    except Exception as e:
        logger.error("EMSC fetch error: %s", e)
        raise
