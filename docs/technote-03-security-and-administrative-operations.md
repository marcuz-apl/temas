# TECHNOTE-03: Security Architecture & Operator Ergonomics

**Status**: Active / Production  
**Component**: Authentication (`backend/main.py`), Admin Deck UI (`frontend/admin.html`, `frontend/js/admin.js`)  
**Author**: TEMAS Core Engineering Team  
**Last Updated**: 2026-09-05  

---

## 1. Context & Motivation

As the TEMAS platform evolved from an automated prototype into an operational observatory deck, two fundamental requirements arose:
1. **Secure, Dynamic Authentication**:
   - Master passkey commemorating the project's inception year (2023): `Tema$2023`.
   - The operator must be equipped with the ability to change this passkey at any time after login, with changes persisting across reboots without requiring server restarts or environment variable modifications.
2. **Operator Ergonomics & Mission-Control Design**:
   - Critical sync feedback must appear on the **client side** in responsive, sleek telemetry modals rather than in the server console or disruptive browser `alert()` popups.
   - Comprehensive multi-vector filtering (by Measurement Source, Scale, Region) and multi-page pagination.

---

## 2. Dynamic Authentication Architecture

### 2.1 The Inception Credential: `Tema$2023`
The default administrator master passkey is officially designated as:
$$\mathbf{Tema\$2023}$$
This honors the birth year of the TEMAS project (founded following the catastrophic February 2023 Kahramanmaraş earthquake sequence to advance open, real-time seismic awareness in Turkey).

### 2.2 Dynamic Password Management Architecture
Unlike systems that hardcode credentials in environment variables or configuration files, TEMAS implements a database-backed dynamic credential lifecycle:

```
[Admin Deck UI: Password Modal]
            │
            ▼  POST /api/admin/change-password
[FastAPI Dependency: verify_admin_key]
            │
            ▼  Validates token against get_admin_password()
[Database Layer: update_admin_password()]
            │
            ▼  Validates current_password == active_password
[SQLite Storage: admin_config table]
     key = 'admin_password'
     value = '<new_password>'
     updated_at = datetime('now')
```

### 2.3 Live Session Handshake
When an operator successfully updates their passkey:
1. The backend updates the `admin_config` row in SQLite.
2. The frontend receives the success response and **immediately updates `sessionStorage` in place**:
   ```javascript
   adminKey = newPwd;
   sessionStorage.setItem('temas_admin_key', newPwd);
   ```
3. Direct download anchor links (e.g. SQLite database snapshot) are dynamically re-parameterized with the new key, ensuring zero 401 unauthorized session drops.

---

## 3. Mission-Control Operator Ergonomics

### 3.1 Client-Side Mission Control vs. Server Console / Browser Alerts
In early iterations, sync operations logged output primarily to the server stdout/console or used native `alert()` dialogs. In an operational environment, this was sub-optimal:
- **Server console output** is invisible to web operators monitoring the map from remote workstations.
- **Browser native `alert()`** freezes the browser rendering thread, blocks background map tiles from rendering, and provides zero telemetry styling.

**Solution: The Telemetry Popup Window (`#syncResultModal`)**:
- Triggered whenever an operator clicks **"⚡ Sync All Sources Now"** or an individual provider's **"Sync Now"**.
- Displays key performance indicators:
  - Total Events Fetched
  - Newly Inserted Events ($M \ge 2.0$)
  - Total Round-Trip Latency (ms)
- Provides individual provider breakdown cards (KOERI, EMSC, USGS) with live latency, record counts, and status indicators.

### 3.2 Multi-Vector Filtering & Fast Pagination
The historical table provides real-time client-side and server-side filtering:
- **Measurement Source Filter**: KOERI, EMSC, USGS, MANUAL.
- **Magnitude Scale Filter**: ML (Local Magnitude), MW (Moment Magnitude), MD (Duration Magnitude), MS, MB.
- **Regional Autocomplete & Search**: Substring matching on provincial and fault zones.
- **Deterministic Pagination**: Jump controls (`First`, `Prev`, `Next`, `Last`) with customizable page sizes (25, 50, 100).
