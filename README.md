# TEMAS
## Turkey Earthquake Monitoring and Analysis System

### *May God bless Turkish and Syrian people! And all the lucks go to the rescuers.*

---

**TEMAS** (**T**urkey **E**arthquake **M**onitoring and **A**nalysis **S**ystem) is a high-availability, real-time seismic observatory platform and historical earthquake catalog for Turkey, Syria, and the Aegean/East Mediterranean seismic zones. 

Founded following the devastating February 6, 2023 Kahramanmaraş earthquake sequence, TEMAS bridges the gap between public seismic awareness and rigorous geoscientific analysis.

- **Current Release**: `v2.11.0` (September 2026)
- **Author & Copyright**: © 2023–2026, Alfazen Inc.
- **License**: [MIT License](LICENSE) (Data copyright Boğaziçi Univ. / KOERI)

---

## Overview & Highlights

- **Real-Time Multi-Agency Monitoring**: Asynchronously aggregates seismic feeds across KOERI (Boğaziçi University Kandilli Observatory), EMSC-CSEM, and USGS.
- **Continuous Historical Archive**: Persists over 13,400 verified earthquake records (2021–2026, $M \ge 2.0$) locally in SQLite with zero cloud dependencies.
- **Interactive Geospatial Cartography**: Single Page Application with GPU-accelerated Leaflet Canvas mapping, active tectonic fault overlays, and Day/Night theme synchronization.
- **Multimodal Timeline Replay**: Chronological earthquake playback paired with Web Audio magnitude sonification and real-time alert chimes.
- **Responsive & Ergonomic UI**: Balanced 3-column header with centered telemetry HUD on desktop, and adaptive dual-navigation drawers on mobile.

*(For in-depth architectural specifications and seismological notes, see the [Technical Documentation](#technical-documentation--architecture-notes) section below).*

---

## Technology Stack

| Layer | Technologies |
| :--- | :--- |
| **Backend** | Python 3.11+, FastAPI, Uvicorn, Async HTTPX, AnyIO |
| **Database** | SQLite3 in Write-Ahead Logging (WAL) mode with multi-column B-Tree indexes |
| **Frontend** | Vanilla ESM JavaScript, Semantic HTML5, CSS Glassmorphism, Leaflet.js (Canvas Mode) |
| **Mapping & GIS** | CartoDB Dark Matter, OpenStreetMap Standard, PB2002 Plate Boundaries GeoJSON, Turkey Province Boundaries |
| **DevOps** | Docker, Docker Compose, Automated Git Versioning Hooks |

---

## Quickstart

### Option 1: Docker Compose (Recommended)

```bash
# Clone the repository
git clone https://github.com/marcuz-apl/temas.git
cd temas

# Build and start the container in background
docker compose up -d --build
```
Access the application:
- **Public Map & Spatial Dashboard**: [http://localhost:4070](http://localhost:4070)
- **Operator Operations Deck**: Internal management console documented for authorized maintainers in [TECHNOTE-03](docs/technote-03-security-and-administrative-operations.md).

---

### Option 2: Local Python Environment

```bash
# 1. Create and activate Python virtual environment
python3 -m venv .venv
source .venv/bin/activate

# 2. Install dependencies
pip install -r requirements.txt

# 3. Launch Uvicorn ASGI server
uvicorn backend.main:app --host 0.0.0.0 --port 4070 --reload
```
Open **http://localhost:4070** in your browser.

---

## Technical Documentation & Architecture Notes

Detailed architectural rationale, seismological design considerations, and operational protocols are documented in the [`docs/`](docs/) directory:

- **[Milestone Changelog (`docs/CHANGELOG.md`)](docs/CHANGELOG.md)**: Full semantic progression from the 2023 prototypes (`v0.1.0`) to the modern platform (`v2.11.0`).
- **[TECHNOTE-01: Ingestion Cadence & Upstream Courtesy](docs/technote-01-data-ingestion-and-polling-strategy.md)**: Seismological wave arrival delays, solver latencies, and provider fair-use policies.
- **[TECHNOTE-02: Catalog Hygiene & Storage Optimization](docs/technote-02-seismic-catalog-hygiene-and-storage.md)**: Noise filtering cut-off ($M < 2.0$), multi-agency deduplication, and SQLite WAL mechanics.
- **[TECHNOTE-03: Security & Operator Ergonomics](docs/technote-03-security-and-administrative-operations.md)**: Operations deck console, concealed route architecture (`/samet`), dynamic authentication, and database maintenance.
- **[TECHNOTE-04: Geospatial Cartography & Multimodal UX](docs/technote-04-geospatial-cartography-and-multimodal-ux.md)**: Single-page Leaflet Canvas mapping, fault-line overlays, Web Audio sonification, 3-column header HUD, and mobile dual-nav.

---

## Historical Prototype Notes (2023 Inception Series)

During initial proof-of-concept development in February–March 2023, TEMAS was tested under early containerized environments:

<details>
<summary>Click to expand Legacy Docker & Containerization Observations</summary>

- The lightweight `alpine` Python variants encountered compilation issues with `pandas` in early 2023, leading to the adoption of `python:3.10-slim`.
- The original prototype ran a daily cron scraper inside an Nginx container on port `8001`.
- These legacy proof-of-concept scripts have been retired, with all operations consolidated into the unified async FastAPI architecture on port `4070`.
</details>

---

## Live Earthquake Maps

### Real-Time Epicenter Map (v0.8.0)
![Bubble Map](assets/live-earthquake-map-1.png)

### Seismic Intensity Heat Map (v2.11.0)
![Heat Map](assets/live-earthquake-map-2.png)

---

## Credits & Acknowledgments

- **[Kandilli Observatory and Earthquake Research Institute (KOERI, 1868)](http://www.koeri.boun.edu.tr/new/en)** — Boğaziçi University
- **[European-Mediterranean Seismological Centre (EMSC-CSEM)](https://www.emsc-csem.org/)**
- **[United States Geological Survey (USGS)](https://earthquake.usgs.gov/)**
- **[Peter Bird (PB2002)](https://peterbird.name/oldFTP/PB2002/)** — Global Tectonic Plate Boundaries

---

## License

This software is released under the **[MIT License](LICENSE)**.

```
Copyright (c) 2023-2026 Alfazen Inc.
```

> **Data Attribution Disclaimer**:  
> Seismic observation data, hypocenter solutions, and bulletin records belong to their respective originating institutions (**Boğaziçi University KOERI**, **EMSC-CSEM**, and **USGS**). This software is dedicated to humanitarian, educational, and open scientific research.
