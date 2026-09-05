# TEMAS Version Milestone Calibration & Changelog

This document establishes the official semantic version history of the **TEMAS (Turkey Earthquake Monitoring & Alert System)** project, chronicling the journey from the original 2023 Dockerized prototype series (`v0.1.0` – `v0.8.0`) through the modern 2026 production observatory platform (`v2.1.0` – `v2.8.1`).

---

## Semantic Version Progression Matrix (Modern Series)

```
v2.1.0 (Baseline Architecture)
  │
  ├─► v2.2.0 (Feat: Noise Purge M < 2.0 & Mission-Control Telemetry Popup)
  │
  ├─► v2.3.0 (Feat: Data Moderation Table Multi-Page Pagination)
  │
  ├─► v2.4.0 (Feat: Multi-Vector Filtering on Source, Scale, and Region)
  │
  ├─► v2.5.0 (Feat: Manual Deduplication Engine & Composite UNIQUE Event Index)
  │
  ├─► v2.6.0 (Feat: 2021–2022 Deep Historical Catalog Archive Backfill)
  │
  ├─► v2.7.0 (Feat: Dynamic Admin Password Management & Project Inception Passkey)
  │     │
  │     └─► v2.7.1 (Fix: Update Default Admin Credential to Tema$2023)
  │
  └─► v2.8.0 (Feat: Ingestion Scheduler Hardening & Configurable TEMAS_SYNC_INTERVAL)
        │
        ├─► v2.8.1 (Fix: Technical Documentation Markdown KaTeX/MathJax Syntax Cleanup)
        │
        └─► v2.8.2 (Fix: Main Window Brand Calibration to TEMAS 2 Gen2)
```

---

## Milestone Change Log Details

### [v2.8.2] — 2026-09-05
**Fix: Main Window Brand Calibration to TEMAS 2 (Gen2 Platform)**
- **Type**: `fix(branding)`
- **Scope**: `frontend/index.html`
- **Key Deliverables**:
  - Calibrated the primary top-left application title and browser tab title to **"TEMAS 2"** (representing the TEMAS Gen2 platform generation rather than a minor point release).

---

### [v2.8.1] — 2026-09-05
**Fix: Technical Documentation Markdown KaTeX/MathJax Syntax Cleanup**
- **Type**: `fix(docs)`
- **Scope**: Documentation (`docs/*.md`)
- **Key Deliverables**:
  - Eliminated conflicting LaTeX double-dollar (`$$`) and math delimiters that caused rendering failures in Obsidian, VS Code, and standard GitHub Markdown parsers.
  - Formatted password and code callouts as native Markdown blockquotes and code spans (`Tema$2023`).
  - Standardized physical units, wave propagation velocities, and magnitude bounds using clean Unicode formatting (`M < 2.0`, `6–8 km/s`, `±0.05°`).

---

### [v2.8.0] — 2026-09-05
**Feat: Ingestion Scheduler Hardening & Configurable `TEMAS_SYNC_INTERVAL`**
- **Type**: `feat(scheduler)`
- **Scope**: `backend/ingestion/scheduler.py`
- **Key Deliverables**:
  - Made the background sync interval dynamically configurable via the `TEMAS_SYNC_INTERVAL` environment variable (defaults to 180 seconds).
  - Clarified architectural distinction between internal 15-second client telemetry polling and 180-second external upstream network querying.
  - Documented physical wave propagation latency ($P/S$ waves, $90\text{–}180\text{s}$ network solver delay) and provider fair-use policies in `TECHNOTE-01`.

---

### [v2.7.1] — 2026-09-05
**Fix: Update Default Admin Credential to `Tema$2023`**
- **Type**: `fix(auth)`
- **Scope**: `backend/database.py`, `frontend/admin.html`
- **Key Deliverables**:
  - Calibrated default master administrator key to `Tema$2023` in commemorating the project's inception year.
  - Added automatic database migration logic in `init_db()` to update legacy defaults in the `admin_config` table.
  - Updated operator login placeholder and modal hints across UI decks.

---

### [v2.7.0] — 2026-09-05
**Feat: Dynamic Admin Password Management & Project Inception Passkey**
- **Type**: `feat(auth)`
- **Scope**: `backend/database.py`, `backend/main.py`, `frontend/admin.html`, `frontend/js/admin.js`
- **Key Deliverables**:
  - Established `admin_config` SQLite configuration table for permanent credential persistence across restarts.
  - Added `POST /api/admin/change-password` endpoint requiring validation of current password.
  - Added sleek "Update Admin Password" modal accessible from the top deck navigation bar.
  - Updated frontend session state management (`sessionStorage`) in-flight without triggering 401 unauthenticated session drops.

---

### [v2.6.0] — 2026-09-05
**Feat: 2021–2022 Deep Historical Catalog Archive Backfill**
- **Type**: `feat(backfill)`
- **Scope**: `backend/ingestion/backfill.py`, `frontend/admin.html`, `frontend/js/admin.js`
- **Key Deliverables**:
  - Ingested over 5,000 verified historical earthquake records spanning January 1, 2021 through December 31, 2022.
  - Expanded catalog baseline to 12,620 high-fidelity events ($M \ge 2.0$) across Turkey and regional fault systems.
  - Added intuitive UI preset buttons (`2021-2022 Archive`, `2023-2024 Archive`, `2025-Present`, `Full Archive 2021-2026`).
  - Labeled catalog persistence status to clarify that routine dashboard entry does not require re-running backfills.

---

### [v2.5.0] — 2026-09-05
**Feat: Manual Deduplication Engine & Composite UNIQUE Event Index**
- **Type**: `feat(admin)`
- **Scope**: `backend/database.py`, `backend/main.py`, `frontend/admin.html`, `frontend/js/admin.js`
- **Key Deliverables**:
  - Schema-enforced composite UNIQUE index: `uq_quaketk_event ON quaketk (origintimeutc, latitude, longitude, measmethod)`.
  - Added `POST /api/admin/db/deduplicate` endpoint executing deterministic window partitioning on origin time, coordinates (±0.05°), and magnitude.
  - Added "Remove Duplicates" action button in the Database Telemetry card with live result notifications.

---

### [v2.4.0] — 2026-09-05
**Feat: Multi-Vector Filtering on Source, Scale, and Region**
- **Type**: `feat(admin)`
- **Scope**: `backend/main.py`, `frontend/admin.html`, `frontend/js/admin.js`
- **Key Deliverables**:
  - Added multi-criteria filter deck for the Event Moderation table:
    - **Measurement Source**: Filter by KOERI, EMSC, USGS, or MANUAL-OPERATOR.
    - **Magnitude Scale**: Filter by ML, MW, MD, MS, MB.
    - **Region Search**: Live case-insensitive substring search across provincial and fault zone labels.
  - Added "Reset Filters" action button restoring default unfiltered pagination.

---

### [v2.3.0] — 2026-09-05
**Feat: Data Moderation Table Multi-Page Pagination**
- **Type**: `feat(admin)`
- **Scope**: `frontend/admin.html`, `frontend/js/admin.js`
- **Key Deliverables**:
  - Replaced flat table truncation with complete multi-page pagination controls:
    - `⏮ First`: Jump to page 1.
    - `◀ Prev`: Step backward one page.
    - `Page X of Y`: Live page status.
    - `Next ▶`: Step forward one page.
    - `Last ⏭`: Jump to final page.
  - Added page size selector (`25 / page`, `50 / page`, `100 / page`).
  - Added record range indicator (`Showing X – Y of Z records`).

---

### [v2.2.0] — 2026-09-05
**Feat: Noise Purge ($M < 2.0$) & Mission-Control Telemetry Popup**
- **Type**: `feat(admin)`
- **Scope**: `backend/database.py`, `backend/ingestion/*.py`, `frontend/admin.html`, `frontend/js/admin.js`
- **Key Deliverables**:
  - Replaced browser-native `alert()` boxes and console-only logging with responsive client-side `#syncResultModal` popup window.
  - Displays Total Fetched, Newly Stored ($M \ge 2.0$), and Round-Trip Latency with individual KOERI/EMSC/USGS status cards.
  - Enforced $M \ge 2.0$ seismological noise cut-off across all scrapers and database insert operations.
  - Added `POST /api/admin/db/purge-noise` purging 23,795 sub-threshold tremors and reclaiming 5.39 MB via automated `VACUUM`.

---

### [v2.1.0] — 2026-09-05
**Initial Release: Modernized Python/FastAPI Backend & Sleek Vanilla JS Operations Deck**
- **Type**: `feat(init)`
- **Scope**: Full Stack
- **Key Deliverables**:
  - Replaced legacy Docker/PHP scripts with unified FastAPI async backend and Leaflet-based Vanilla JS frontend.
  - Integrated SQLite WAL mode with automated multi-source ingestion (KOERI, EMSC, USGS).
  - Built cybersecurity-styled dark operations deck with health telemetry, manual event injection, and live map feeds.

---

## Historical Prototype Series (v0.x — Inception 2023)

The early experimental milestones and Dockerized prototypes created during the birth year of TEMAS (February–March 2023):

### [v0.8.0] — 2023-03-17
- Tuned Dockerfile and added Nginx container proxy.
- Configured host-level scheduling for `app-updater.py`.

### [v0.7.2] — 2023-03-13
- Upgraded job scheduler, standardized `.gitignore` rules, and pushed production release to cloud container registry.

### [v0.7.1] — 2023-03-12
- Automated continuous data updater and containerized the service for cloud hosting.

### [v0.7.0] — 2023-03-11
- Attempted initial choropleth regional map layer; restructured project folder hierarchy and data directories.

### [v0.6.0] — 2023-03-10
- Modularized background scraping jobs and bootstrapped initial public landing and visualization pages.

### [v0.5.0] — 2023-03-09
- Assembled all-in-one Jupyter notebook pipeline: database reader, scraper, data frame merger, and cartographic mapper.

### [v0.4.1] — 2023-03-08
- Implemented multi-page pagination scraper for KOERI historical events (`sc3.koeri.boun.edu.tr/events/events{i}.html`).

### [v0.4.0] — 2023-03-07
- Completed first automated HTML table scraping pipeline against KOERI live bulletin.

### [v0.3.0] — 2023-03-04
- Established initial SQLite3 database schema and persisted Pandas DataFrame of historical earthquakes into local storage.

### [v0.2.1] — 2023-02-27
- Integrated historical and real-time feeds into a unified local DataFrame structure.

### [v0.2.0] — 2023-02-26
- Incorporated initial deep historical dataset spanning from January 16, 2023 onward.

### [v0.1.0] — 2023-02-13
- **Initial Project Birth**: First prototype release following the February 6, 2023 Kahramanmaraş earthquake sequence; ingested initial 500 real-time seismic data points from Kandilli Observatory.

