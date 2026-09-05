import re
import logging
from datetime import datetime
from typing import List, Dict, Any, Optional
import httpx
from bs4 import BeautifulSoup

logger = logging.getLogger("temas.ingestion.koeri")

KOERI_LASTEQ_URL = "http://www.koeri.boun.edu.tr/scripts/lasteq.asp"
KOERI_EVENTS_URL = "http://sc3.koeri.boun.edu.tr/eqevents/events.html"

HEADERS = {
    "User-Agent": "TEMAS-Bot/2.0 (+https://github.com/marcuz-apl/temas; Earthquake Monitoring)",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
}


def parse_clean_coord(coord_str: str) -> float:
    """Strips degree symbols and directional characters, returning clean float."""
    s = str(coord_str).replace("°", "").replace("N", "").replace("E", "").replace("S", "").replace("W", "").strip()
    try:
        val = float(s)
        if "S" in str(coord_str) or "W" in str(coord_str):
            val = -val
        return val
    except Exception:
        return 0.0


def parse_lasteq_pre(pre_text: str) -> List[Dict[str, Any]]:
    """
    Parses KOERI lasteq.asp <pre> text block.
    Format:
    Date       Time      Latit(N)  Long(E)   Depth(km)     MD   ML   Mw    Region                             Attribute
    2026.09.05 10:58:37  36.3893   33.5123        0.0      -.-  1.4  -.-   KAYRAK-GULNAR (MERSIN)            Quick
    """
    records = []
    lines = pre_text.splitlines()

    for line in lines:
        line = line.strip()
        if not line or line.startswith("Date") or line.startswith("---") or line.startswith("RECENT") or line.startswith("KOERI") or line.startswith("("):
            continue

        parts = line.split()
        if len(parts) < 8:
            continue

        # Check date format YYYY.MM.DD
        if not re.match(r"^\d{4}\.\d{2}\.\d{2}$", parts[0]):
            continue

        try:
            date_str = parts[0].replace(".", "-")
            time_str = parts[1]
            origintimeutc = f"{date_str} {time_str}"

            lat = parse_clean_coord(parts[2])
            lon = parse_clean_coord(parts[3])
            depth = float(parts[4]) if parts[4] != "-.-" else 0.0

            # Magnitude extraction: preference Mw > ML > MD
            mag_md = parts[5]
            mag_ml = parts[6]
            mag_mw = parts[7]

            mag = 0.0
            magtype = "ML"
            if mag_mw != "-.-":
                mag = float(mag_mw)
                magtype = "Mw"
            elif mag_ml != "-.-":
                mag = float(mag_ml)
                magtype = "ML"
            elif mag_md != "-.-":
                mag = float(mag_md)
                magtype = "MD"

            # Filter out meaningless micro-tremor noise below M < 2.0
            if mag < 2.0:
                continue

            # Region and attribute
            attribute = parts[-1] if len(parts) >= 10 and parts[-1] in ["Quick", "Automatic", "İlksel", "Revize"] else ""
            region_end = -1 if attribute else len(parts)
            region = " ".join(parts[8:region_end]).strip()

            records.append({
                "origintimeutc": origintimeutc,
                "magnitude": mag,
                "magtype": magtype,
                "latitude": lat,
                "longitude": lon,
                "depthkm": depth,
                "region": region or "Turkey & Surrounding",
                "measmethod": "RETMC",
                "updtime": origintimeutc,
                "attribute": attribute
            })
        except Exception as e:
            logger.debug("Failed parsing lasteq line '%s': %s", line, e)

    return records


def parse_events_table(html_content: str) -> List[Dict[str, Any]]:
    """
    Parses sc3.koeri.boun.edu.tr table format.
    Columns: [origintimeutc, magnitude, magType, latitude, longitude, depthKm, region, measMethod, updTime, attribute]
    """
    records = []
    soup = BeautifulSoup(html_content, "html.parser")
    table = soup.find("table", {"class": "index"})
    if not table:
        return records

    rows = table.find_all("tr")[1:]
    for row in rows:
        cols = row.find_all("td")
        if len(cols) < 9:
            continue

        try:
            # Date format: YYYY/MM/DD HH:MM:SS -> YYYY-MM-DD HH:MM:SS
            origintimeutc = cols[0].text.strip().replace("/", "-")
            mag = float(cols[1].text.strip())

            # Filter out meaningless micro-tremor noise below M < 2.0
            if mag < 2.0:
                continue

            magtype = cols[2].text.strip() or "ML"
            lat = parse_clean_coord(cols[3].text.strip())
            lon = parse_clean_coord(cols[4].text.strip())
            depth = float(cols[5].text.strip().replace("-", "0") or 0.0)
            region = cols[6].text.strip()
            measmethod = cols[7].text.strip()
            updtime = cols[8].text.strip().replace("/", "-")
            attribute = cols[9].text.strip() if len(cols) > 9 else ""

            records.append({
                "origintimeutc": origintimeutc,
                "magnitude": mag,
                "magtype": magtype,
                "latitude": lat,
                "longitude": lon,
                "depthkm": depth,
                "region": region,
                "measmethod": measmethod,
                "updtime": updtime,
                "attribute": attribute
            })
        except Exception as e:
            logger.debug("Failed parsing events row: %s", e)

    return records


async def fetch_koeri_earthquakes(timeout_sec: float = 12.0) -> List[Dict[str, Any]]:
    """
    Asynchronously fetches earthquake events from KOERI lasteq and sc3 events.
    Merges and deduplicates based on (origintimeutc, latitude, longitude).
    """
    all_records = []

    async with httpx.AsyncClient(headers=HEADERS, timeout=timeout_sec, follow_redirects=True) as client:
        # 1. Fetch lasteq.asp
        try:
            r0 = await client.get(KOERI_LASTEQ_URL)
            if r0.status_code == 200:
                soup = BeautifulSoup(r0.content, "html.parser")
                pre = soup.find("pre")
                if pre and pre.text:
                    records0 = parse_lasteq_pre(pre.text)
                    all_records.extend(records0)
                    logger.info("Fetched %d quakes from lasteq.asp", len(records0))
        except Exception as e:
            logger.warning("Error fetching lasteq.asp: %s", e)

        # 2. Fetch events.html
        try:
            r1 = await client.get(KOERI_EVENTS_URL)
            if r1.status_code == 200:
                records1 = parse_events_table(r1.text)
                all_records.extend(records1)
                logger.info("Fetched %d quakes from events.html", len(records1))
        except Exception as e:
            logger.warning("Error fetching events.html: %s", e)

    # Deduplicate in memory by (origintimeutc, latitude, longitude)
    unique_map = {}
    for r in all_records:
        key = (r["origintimeutc"], round(r["latitude"], 3), round(r["longitude"], 3))
        # Keep latest or more detailed record
        if key not in unique_map or len(r.get("region", "")) > len(unique_map[key].get("region", "")):
            unique_map[key] = r

    deduped = list(unique_map.values())
    logger.info("Total unique live records parsed: %d", len(deduped))
    return deduped
