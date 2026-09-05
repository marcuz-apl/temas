import logging
from datetime import datetime, timezone
from typing import List, Dict, Any
import httpx

logger = logging.getLogger("temas.ingestion.usgs")

# USGS Earthquake API - Turkey and Eastern Mediterranean Bounding Box
USGS_API_URL = "https://earthquake.usgs.gov/fdsnws/event/1/query"
PARAMS = {
    "format": "geojson",
    "minlatitude": 35.0,
    "maxlatitude": 43.0,
    "minlongitude": 25.0,
    "maxlongitude": 45.0,
    "minmagnitude": 2.5,
    "limit": 200,
    "orderby": "time"
}

HEADERS = {
    "User-Agent": "TEMAS-Bot/2.0 (+https://github.com/marcuz-apl/temas; Earthquake Hazards)",
    "Accept": "application/json",
}


async def fetch_usgs_earthquakes(timeout_sec: float = 12.0) -> List[Dict[str, Any]]:
    """
    Fetches recent earthquakes from the USGS open API for the Turkey bounding box.
    Returns normalized dictionary records compatible with quaketk schema.
    """
    records = []
    try:
        async with httpx.AsyncClient(headers=HEADERS, timeout=timeout_sec, follow_redirects=True) as client:
            r = await client.get(USGS_API_URL, params=PARAMS)
            if r.status_code != 200:
                logger.warning("USGS API returned status %d", r.status_code)
                return records

            data = r.json()
            features = data.get("features", [])

            for f in features:
                props = f.get("properties", {})
                geom = f.get("geometry", {})
                coords = geom.get("coordinates", [0.0, 0.0, 0.0])

                lon = float(coords[0])
                lat = float(coords[1])
                depth = float(coords[2]) if len(coords) > 2 else 0.0

                epoch_ms = props.get("time")
                if not epoch_ms:
                    continue

                utc_dt = datetime.fromtimestamp(epoch_ms / 1000.0, timezone.utc)
                origintimeutc = utc_dt.strftime("%Y-%m-%d %H:%M:%S")

                mag = float(props.get("mag") or 0.0)
                magtype = props.get("magType", "Mw").upper()
                place = props.get("place") or "Turkey Region (USGS)"

                records.append({
                    "origintimeutc": origintimeutc,
                    "magnitude": round(mag, 1),
                    "magtype": magtype,
                    "latitude": round(lat, 4),
                    "longitude": round(lon, 4),
                    "depthkm": round(depth, 1),
                    "region": place,
                    "measmethod": "USGS",
                    "updtime": origintimeutc,
                    "attribute": "USGS International"
                })

            logger.info("Successfully parsed %d earthquakes from USGS API", len(records))
    except Exception as e:
        logger.warning("Error querying USGS API: %s", e)

    return records
