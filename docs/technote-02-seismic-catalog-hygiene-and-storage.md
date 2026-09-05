# TECHNOTE-02: Seismic Catalog Hygiene, Noise Filtering & Storage Optimization

**Status**: Active / Production  
**Component**: Storage Engine (`backend/database.py`), Admin De-duplication & Moderation  
**Author**: TEMAS Core Engineering Team  
**Last Updated**: 2026-09-05  

---

## 1. Context & Core Questions

During system scaling and observatory operations, key questions emerged:
1. *"Why should we scrape and store earthquakes < M2.0? Isn't that meaningless?"*
2. *"Why does the database show duplicates when querying across multiple providers?"*
3. *"Shall we do the Backfill job every time we enter the Admin Panel?"*
4. *"How can we safely reclaim disk space without corrupting the WAL?"*

This note documents the seismological, data modeling, and SQLite storage decisions implemented in TEMAS v2.1.

---

## 2. The M < 2.0 Seismological Noise Cut-Off

### 2.1 The Physics of Micro-Tremors
In the Richter/Moment magnitude scale, magnitude is logarithmic:
- An **M2.0** earthquake releases roughly **1,000 times less energy** than an **M4.0** event and **32,000 times less energy** than an **M5.0** event.
- Events below **M2.0** (micro-earthquakes) are rarely, if ever, felt by human beings. They are recorded exclusively by ultra-sensitive seismometers located in quiet boreholes or remote mountainous stations.
- In active tectonic zones like the North Anatolian Fault (NAF) and East Anatolian Fault (EAF), dozens of micro-events occur daily due to geothermal activity, quarry blasts, and minor crustal stress relaxation.

### 2.2 Civil Protection & Storage Trade-offs
1. **Civil Emergency Impact**: Micro-tremors below **M2.0** pose zero structural risk and trigger no civil defense or public warning responses.
2. **Database Bloat**: Retaining **M < 2.0** records accounts for over **60% to 75%** of raw table rows while contributing zero utility to regional risk maps.
3. **Multi-Tier Filtering Policy**:
   - **KOERI scraper**: Discards records with magnitude < 2.0 during stream parsing.
   - **EMSC scraper**: Configured with `min_mag=2.5`.
   - **USGS scraper**: Passes `minmagnitude=2.0`.
   - **Database Ingestion**: `insert_earthquakes()` enforces `magnitude >= 2.0` at the persistence boundary.
   - **On-Demand Purge**: `POST /api/admin/db/purge-noise` purges any historical sub-threshold records and automatically executes `VACUUM` to reclaim disk space.

---

## 3. Multi-Agency Event Deduplication

### 3.1 Why Duplicates Occur Across Seismic Networks
When an earthquake occurs in or near Turkey:
- **KOERI** solves the event using its dense local Turkish station network.
- **EMSC** receives data from multiple European and Mediterranean institutions and publishes its own solution.
- **USGS** computes global teleseismic inversion solutions for events ≥ M4.0.

Because each agency uses slightly different station subsets, crustal velocity models, and arrival pickers:
- Origin times can differ by ±1 to 3 seconds.
- Epicentral coordinates can differ by 0.01° to 0.05° (~1–5 km).
- Calculated magnitudes can differ by ±0.1 to 0.3.

However, when multiple agencies forward the *same* underlying network solution or when batch syncs are triggered, identical coordinates, origin times, and magnitudes can be ingested.

### 3.2 Automated Deduplication Engine & Unique Index
TEMAS implements a two-stage deduplication architecture:

1. **Database-Level Composite Unique Index**:
   ```sql
   CREATE UNIQUE INDEX IF NOT EXISTS uq_quaketk_event 
   ON quaketk (origintimeutc, latitude, longitude, measmethod);
   ```
   This schema-enforced constraint prevents identical reports from the same provider from ever inserting duplicate rows.

2. **Operator Deduplication Endpoint (`POST /api/admin/db/deduplicate`)**:
   A deterministic SQL window function partitions events by origin time, rounded spatial coordinates (±0.05°), and magnitude (±0.2), retaining only the highest-fidelity or primary local agency report (`KOERI > EMSC > USGS`) and safely deleting redundant entries.

---

## 4. SQLite Storage Engine & WAL Management

### 4.1 Write-Ahead Logging (WAL) Mode
TEMAS operates SQLite in `WAL` mode (`PRAGMA journal_mode = WAL`), which offers:
- Concurrency: Readers never block writers; writers never block readers.
- Performance: Sequential appends to `-wal` file rather than continuous in-place database file mutations.

### 4.2 WAL Checkpointing (`POST /api/admin/db/checkpoint-wal`)
Under high-volume batch ingestion (e.g. historical backfill), the `-wal` file can temporarily grow to several megabytes.
The Admin Deck provides an explicit **"Checkpoint WAL"** utility executing:
```sql
PRAGMA wal_checkpoint(TRUNCATE);
```
This forces all committed transactions from the `-wal` journal into the main `eq-turkey.db` file and truncates the WAL file back to 0 bytes without locking the system.

### 4.3 Database Compaction (`VACUUM`)
After large noise purge operations, SQLite marks pages as free in its internal free-list. Running `VACUUM` rebuilds the entire database file into contiguous disk blocks, reclaiming disk space and maximizing B-tree cache locality.

---

## 5. Historical Backfill Architecture (2021–2026)

### 5.1 No Backfill Needed on Startup
A core design tenet is **catalog persistence**:
- The SQLite database file `data/eq-turkey.db` permanently retains all ingested records.
- Historical data from **2021 through 2026** is already stored and indexed.
- Operators **do NOT need to run backfill jobs** upon opening the Admin Panel. Backfill is purely a disaster recovery tool in case the database file is lost or rebuilt.

### 5.2 Preset Range Architecture
For maintenance operations, the Admin UI provides one-click presets:
- `2021 - 2022 Archive`: Historical deep catalog backfill.
- `2023 - 2024 Archive`: Covers the 2023 Kahramanmaraş earthquake sequence and aftershocks.
- `2025 - Present`: Recent and real-time monitoring.
- `Full Archive (2021 - 2026)`: Complete multi-year catalog verification.
