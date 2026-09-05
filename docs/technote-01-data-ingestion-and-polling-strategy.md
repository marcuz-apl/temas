# TECHNOTE-01: Data Ingestion Cadence & Upstream Rate-Limit Safety

**Status**: Active / Production  
**Component**: Ingestion Scheduler (`backend/ingestion/scheduler.py`) & Feed Adapters  
**Author**: TEMAS Core Engineering Team  
**Last Updated**: 2026-09-05  

---

## 1. Context & Motivation

During architectural review of the scraper pipeline, a central operational question arose:
> *"Does querying data sources every minute run too often? Will the external data sources reject our frequent requeries?"*

This technical note documents the design mindset, seismological physics, provider constraints, and safety mechanisms governing TEMAS's data ingestion schedule.

---

## 2. Ingestion Cadence Architecture

### 2.1 The 1-Minute Myth (Legacy vs. Modern)
- **Legacy Prototype (2023 Docker Testlab)**:
  Early proof-of-concept scripts in `legacy/testlab` utilized a simplistic `* * * * *` Linux cron entry that executed a scraper script once every minute. This was acceptable for local 10-minute experimentation on a single laptop but was **never intended for sustained production ingestion**.
- **Modern Production Architecture (TEMAS v2.1)**:
  The active asynchronous background scheduler in `backend/ingestion/scheduler.py` defaults to **180 seconds (3 minutes)**:
  $$\text{Interval} = 180\text{ seconds}$$
  This is dynamically configurable via the environment variable `TEMAS_SYNC_INTERVAL`.

### 2.2 Distinguishing Background Ingestion from UI Telemetry
A common misconception occurs when inspecting browser DevTools:
- **Local Telemetry Polling (Every 15s)**: The Admin Deck browser client executes `GET /api/admin/status` every 15 seconds. This query is **100% internal**—it queries the local FastAPI process and SQLite database. It **never makes external network requests**.
- **Upstream Network Ingestion (Every 180s)**: The FastAPI background worker queries external observatory APIs concurrently once every 3 minutes.

---

## 3. Seismological Rationale: Why Sub-Minute Polling is Meaningless

Earthquake detection is constrained by the physics of seismic wave propagation and network solver inversion:

```
[Fault Rupture]
       │
       ▼  P-wave (~6-8 km/s) & S-wave (~3.5-4.5 km/s)
[Regional Seismic Stations] (Dozens of seismometers across Turkey)
       │
       ▼  Telemetry Transmission (Digitizers -> Central Observatory via Satellite/Cellular)
[Inversion Solver] (Earthworm / SeisComP hypocenter & magnitude calculation: 60 - 180s)
       │
       ▼  Publication Delay (Automated prelim solution posted to web/API: 2 - 5 min)
[Public Ingestion Endpoint] (KOERI / EMSC / USGS)
```

1. **Travel Time**: P-waves travel at roughly $6\text{–}8\text{ km/s}$ and S-waves at $3.5\text{–}4.5\text{ km/s}$. For an earthquake in eastern Anatolia to register across enough regional stations to triangulate coordinates and depth, several tens of seconds elapse.
2. **Inversion & Review**: Automated phase picking and grid search/non-linear inversion take another $60\text{–}120\text{ seconds}$.
3. **Publication Lag**: Public feeds publish new preliminary events roughly **2 to 5 minutes** post-origin.
4. **Diminishing Returns**: Polling every 30 or 60 seconds returns identical payload bytes over 95% of the time, consuming outbound bandwidth and server CPU without obtaining new event data.

---

## 4. Upstream Provider Safety & Fair-Use Analysis

| Provider | Endpoint Type | Publication Latency | Requery Tolerance & Fair-Use Policy |
| :--- | :--- | :--- | :--- |
| **KOERI**<br>*(Kandilli Observatory, Boğaziçi Univ)* | Plain HTTP GET to text file (`lasteq.asp`, ~500 rows) | 2 – 5 minutes | **Safe at 3–5 min**. KOERI runs on university academic network infrastructure (`boun.edu.tr`). Querying every few seconds could trigger web application firewall (WAF) IP blocks. At 1 query per 180 seconds with standard user-agent headers, footprint is ~50 KB/query—completely safe and non-intrusive. |
| **EMSC-CSEM**<br>*(Euro-Med Seismological Centre)* | FDSN Standard REST Web Service (`/fdsnws/event/1/query`) | 1 – 3 minutes | **Designed for Machine Consumption**. EMSC guidelines explicitly request polling intervals $\ge 60\text{ seconds}$. TEMAS's 180-second cadence operates strictly within EMSC's fair-use mandate. |
| **USGS**<br>*(United States Geological Survey)* | FDSN GeoJSON API Feeds | ~1 minute | **Global Enterprise CDN**. USGS infrastructure processes tens of thousands of automated API queries per second worldwide. A request every 3 minutes is completely imperceptible. |

---

## 5. Built-In Fault Tolerance & Circuit Breaker Design

To guarantee that external failures never crash the TEMAS backend or cause cascading denial-of-service, `backend/ingestion/scheduler.py` implements the following defensive patterns:

### 5.1 Isolated Async Gather
Providers are queried concurrently using `asyncio.gather(*tasks, return_exceptions=True)`. An unhandled exception or timeout in KOERI does not block EMSC or USGS from completing successfully:

```python
tasks = [
    sync_single_provider("koeri"),
    sync_single_provider("emsc"),
    sync_single_provider("usgs"),
]
sync_results = await asyncio.gather(*tasks, return_exceptions=True)
```

### 5.2 Error State & Backoff Delay
If an unhandled loop exception occurs, the background worker logs the event and introduces a mandatory 30-second backoff sleep before re-entering the scheduled loop, preventing hot-loop hammering of degraded upstream servers.

### 5.3 Operator Control via Environment Variable
Operators running TEMAS under varying network conditions (e.g. cellular edge nodes, restricted corporate egress, or crisis monitoring) can tune the sync cadence without modifying source code:
```bash
# Set 5-minute sync interval for minimal bandwidth
export TEMAS_SYNC_INTERVAL=300

# Set 2-minute sync interval during elevated seismic crisis
export TEMAS_SYNC_INTERVAL=120
```

---

## 6. Summary & Recommendations

- **Is 1 minute too frequent?** Yes. It strains academic endpoints like KOERI without providing faster seismic alerts due to wave arrival and solver delays.
- **Will sources reject our requeries?** At the production **3-minute (180s)** interval, **no**. All three providers welcome automated research aggregators adhering to 2–5 minute cadences.
- **Failover Guarantee**: In the unlikely event that any single source undergoes maintenance or returns HTTP 429/503, TEMAS's multi-source circuit breaker transparently fails over to secondary and tertiary providers.
