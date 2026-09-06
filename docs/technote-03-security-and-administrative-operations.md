# TECHNOTE-03: Security Architecture & Operator Ergonomics

**Status**: Active / Production  
**Component**: Authentication (`backend/main.py`), Admin Deck UI (`frontend/admin.html`, `frontend/js/admin.js`)  
**Author**: TEMAS Core Engineering Team  
**Last Updated**: 2026-09-06  

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

> **Default Master Passkey**: `Tema$2023`

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

### 2.4 Concealed Administrative Route (`/samet`)
To insulate the operations panel against automated botnet scanning, brute-force dictionary probes, and common crawler discovery:
1. **Route Obfuscation**: The administrative deck is routed strictly to `/samet` (`temas` spelled backwards).
   - **Local Operations URL**: `http://localhost:4070/samet`
2. **Deceptive 404 on `/admin`**: Requests probing `/admin` receive a standard HTTP 404 Not Found response, concealing the existence of an operational interface.
3. **Zero Public Links**: No public frontpage headers, mobile menus, or search engine sitemaps link to `/samet`.
4. **Credential Privacy**: The login interface does not disclose passkey hints; initial credentials (`Tema$2023`) are preserved solely in developer documentation.

### 2.5 Documentation Balance: Public README vs. Internal Engineering Manuals
A key architectural principle in TEMAS is maintaining a secure balance between open-source transparency and operational hardening:
- **In Public Documentation (`README.md`)**:
  - The feature is documented conceptually as the **"Hardened Administrative Operations Deck"**.
  - Neither the live concealed path (`/samet`) nor the default master passkey (`Tema$2023`) are published in `README.md`.
  - Probes to `/admin` are explained as returning a deceptive `404 Not Found` decoy.
  - Legitimate operators and contributors are directed to this technical note (`docs/technote-03-security-and-administrative-operations.md`) for internal onboarding.
- **In Engineering Manuals (`technote-03`)**:
  - Complete, un-redacted architectural and deployment details are maintained for authorized system maintainers.

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

### 3.3 Operations Deck "About" Manifest & Attributions (v2.10.2)
To provide instant institutional transparency without cluttering operational space:
- **Command Deck Action**: Embedded in the top-right header alongside version badge and passkey controls.
- **Two-Section Cyber-Glass Modal**:
  1. *Mission & Heritage*: Documents the project's inception following the Feb 6, 2023 Kahramanmaraş earthquake sequence and its transition to continuous Anatolian plate monitoring.
  2. *Data Sources & Attribution*: Explicit technical attribution for Boğaziçi University KOERI, EMSC-CSEM, USGS, and Peter Bird's PB2002 plate boundary model.
- **Developer Identity & Armed Status**: Highlights `@2023-2026, Alfazen Inc. All rights reserved.` alongside a pulsing green live engine status beacon.
- **Keyboard & Backdrop Ergonomics**: Supports instantaneous dismissal via `Esc` key, background backdrop click, or confirmation button.
