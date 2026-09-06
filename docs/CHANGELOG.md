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
  ├─► v2.8.0 (Feat: Ingestion Scheduler Hardening & Configurable TEMAS_SYNC_INTERVAL)
  │     │
  │     ├─► v2.8.1 (Fix: Technical Documentation Markdown KaTeX/MathJax Syntax Cleanup)
  │     │
  │     └─► v2.8.2 (Fix: Main Window Brand Calibration to TEMAS 2 Gen2)
  │
  ├─► v2.9.0 (Feat: Left Sidebar Full-Height Vertical Scroll & 30s Idle Auto-Hide with Edge Peek)
        │
        ├─► v2.9.1 (Fix/Feat: Map Drift Prevention, Large Analytics Deck, Auto-Deduplication on Sync, Clean Visitor Header)
        │
        ├─► v2.9.2 (Feat/Fix: 1-Page PDF & PNG Analytics Export, Expanded Sidebar Card Height & Content)
        │
        ├─► v2.9.3 (Feat/Fix: Default Auto-Hidden Sidebar, Draggable Map Widgets, Clean White A4/Letter PNG Export)
        │
        ├─► v2.9.4 (Feat: One-Click Frontpage Map Snapshot Camera Action)
        │
        ├─► v2.9.5 (Feat: Fancy Seismic Wave Icon, Clean Map Attribution, Snapshot Box Fix, Legacy Purge)
        │
        ├─► v2.9.6 (Feat: Live Observatory Time Calibration to Turkey Time TRT / UTC+3)
        │
        ├─► v2.9.7 (Feat: Mobile-Friendly Responsive Layout, Touch Drawer & Floating Control Accordions)
        │
        ├─► v2.9.8 (Feat: Real-Time Ticking TRT Clock, 3-Minute Auto-Refresh, Mobile Filter Positioning & Scaled Widget Typography)
        │
        ├─► v2.9.9 (Feat: Draggable Filters Bar on Mobile and Desktop Matching Map Layers)
        │
        ├─► v2.9.10 (Feat: Mobile Dual-Burger Header Architecture with Left Feed & Right Tools Menu)
        │
        ├─► v2.9.11 (Feat: Symmetrical Corner Docking for Layers & Mag, Default Radiant Heatmap, Compact Mobile Feed)
        │
        ├─► v2.9.12 (Feat: Observatory Standard UTC+3 Clock, Remove Redundant Sync & Mobile Admin Link)
        │
        ├─► v2.9.13 (Feat: 30s Idle Corner Auto-Collapse for Layers & Mag, One-Click SVG Basemap Toggle)
        │
        └─► v2.9.14 (Feat: High-End Mobile 9-Dot Bento Grid & Vector SVG Dual Header Nav)
  │
  └─► v2.10.0 (Feat: Full-Spectrum Day/Night Theme Sync, Modern Responsive Dual-Nav & Corner Docking)
        │
        ├─► v2.10.1 (Fix: Concealed Admin Route /samet, Deceptive 404, Purge Passkey Hint, Dynamic Versioning)
        │
        ├─► v2.10.2 (Feat: Operations Deck About Modal & Attributions)
        │
        └─► v2.10.3 (Fix: Full 2021–2026 Chronological Timeline Playback & Canvas Rendering)
```

---

## Milestone Change Log Details

### [v2.10.3] — 2026-09-06
**Fix: Full 2021–2026 Chronological Timeline Playback & Canvas Rendering**
- **Type**: `fix(timeline)` / `perf(map)` / `refactor`
- **Scope**: `backend/main.py`, `frontend/js/app.js`, `frontend/js/map.js`, `VERSION`, `docs/CHANGELOG.md`
- **Key Deliverables**:
  - **Uncapped API Catalog Limit**: Elevated FastAPI `/api/earthquakes` limit validation ceiling from 5,000 to 25,000, and configured frontend query parameter `limit: 20000` to fetch the complete multi-year archive (11,600+ events) in `All-Time` mode.
  - **Full-Archive Playback Origin (2021 Start)**: Corrected chronological playback engine so that clicking `Play` or scrubbing to zero starts precisely at the catalog inception (`2021-01-01 03:00 UTC+3`), smoothly progressing through the entire historical record through 2026.
  - **Instant First-Frame Paint**: Added immediate frame rendering upon playback start/restart to ensure the map instantly syncs to the earliest timestamp without waiting for the first timer interval.
  - **Leaflet HTML5 Canvas Acceleration (`preferCanvas: true`)**: Enabled GPU-accelerated canvas marker rendering in Leaflet to guarantee smooth 60 FPS animation without DOM SVG bottlenecking across 11,000+ points.
  - **Standardized UTC+3 Playback Timestamp**: Calibrated live timeline date badge to display scientific observatory `UTC+3` standard.

---

### [v2.10.2] — 2026-09-06
**Feat: Operations Deck About Modal & Attributions**
- **Type**: `feat(admin)` / `feat(ui)` / `docs`
- **Scope**: `frontend/admin.html`, `frontend/js/admin.js`, `VERSION`, `docs/CHANGELOG.md`
- **Key Deliverables**:
  - **Top Command Deck "About" Action**: Embedded a dedicated `About` button in the top-right command bar (`.header-right`) styled with cyber-glow borders and vector info iconography.
  - **Streamlined Mission & Attribution Manifest**: Formulated a focused, 2-section cyber glass modal presenting:
    1. *Mission & Heritage*: Outlines TEMAS platform origins from the February 2023 Kahramanmaraş earthquake sequence and modern Anatolian plate monitoring.
    2. *Data Sources & Attribution*: Explicit technical credits for KOERI, EMSC-CSEM, USGS, and PB2002 plate boundary models.
  - **Developer Copyright & Armed Status**: Added official copyright manifest (`© 2023-2026, Alfazen Inc. All rights reserved.`) with real-time green live engine status beacon.
  - **Universal Dismissal Ergonomics**: Instrumented keyboard `Esc` listener, backdrop click-out, and glowing acknowledge button for swift operational control.

---

### [v2.10.1] — 2026-09-06
**Fix: Concealed Admin Route /samet, Deceptive 404, Purge Passkey Hint, Dynamic Versioning**
- **Type**: `fix(security)` / `feat(admin)` / `docs`
- **Scope**: `backend/main.py`, `frontend/admin.html`, `frontend/js/admin.js`, `docs/technote-03-security-and-administrative-operations.md`, `VERSION`, `docs/CHANGELOG.md`
- **Key Deliverables**:
  - **Concealed Administrative Route (`/samet`)**: Relocated the mission-control operations panel from predictable `/admin` to `/samet` (`temas` spelled backwards), shielding the deck from automated botnet dictionary attacks.
  - **Deceptive 404 on `/admin`**: Requests probing `/admin` return an explicit HTTP 404 Not Found error rather than redirects, preventing vulnerability scanners from discerning administrative endpoints.
  - **Purged Passkey Hint from UI**: Completely removed the default password hint (`DEFAULT: Tema$2023`) from the operator login card, preserving initial credentials exclusively within developer technical documentation (`technote-03`).
  - **Dynamic Version Synchronization**: Added asynchronous `/api/health` handshake to dynamically bind the project version (`v2.10.1`) to the login deck subtitle and mission control badge, eliminating version drift.

---

### [v2.10.0] — 2026-09-06
**Feat: Full-Spectrum Day/Night Theme Sync, Modern Responsive Dual-Nav & Corner Docking**
- **Type**: `feat(theme)` / `feat(ui)` / `major-ui-milestone`
- **Scope**: `frontend/css/style.css`, `frontend/js/map.js`, `VERSION`, `docs/CHANGELOG.md`
- **Key Deliverables**:
  - **Full-Spectrum Day/Night Theme Synchronization**: Integrated global theme switching driven directly by the one-click basemap toggle. Switching to OpenStreetMap dynamically activates a high-visibility frosted glass Light Theme across headers, floating filter bars, timeline scrubbers, corner pills, feed sidebars, and modals.
  - **Persistent Observatory Theme Preference**: Synchronized active theme state to `localStorage` (`temas_theme`), restoring user preferences seamlessly across page reloads and sessions.
  - **High-Contrast Cartographic & Cyber-Dark Aesthetics**: Formulated CSS custom property overrides for borders, shadows, text, and SVG iconography ensuring equal legibility across both solar daytime cartography and midnight cyber-observatory monitoring.
  - **Consolidation of v2.10 Series**: Marks the completion of the mobile dual-nav, 30-second corner docking, and vector SVG iconography enhancements into a unified minor milestone.

---

### [v2.9.14] — 2026-09-06
**Feat: High-End Mobile 9-Dot Bento Grid & Vector SVG Dual Header Nav**
- **Type**: `feat(ui)` / `style(mobile)` / `refactor`
- **Scope**: `frontend/index.html`, `frontend/css/style.css`, `VERSION`, `docs/CHANGELOG.md`
- **Key Deliverables**:
  - **9-Dot Bento Grid Matrix**: Replaced the raw unicode vertical ellipsis on the mobile top-right tools button with an elegant, modern 9-dot Bento Grid SVG (`:::`) signifying the observatory tools and utility deck.
  - **Vector SVG Dual-Nav System**: Upgraded the left feed drawer button with a matching $18\times 18$ crisp vector hamburger SVG, ensuring perfect visual symmetry, resolution independence, and crisp rendering across all mobile device viewports and pixel densities.
  - **Flexbox SVG Hardening**: Applied explicit `flex-shrink: 0` and minimum sizing rules to guarantee consistent rendering across Safari, WebKit, and Blink engines.

---

### [v2.9.13] — 2026-09-06
**Feat: 30s Idle Corner Auto-Collapse for Layers & Mag, One-Click SVG Basemap Toggle**
- **Type**: `feat(ui)` / `ux(interaction)` / `perf(map)`
- **Scope**: `frontend/index.html`, `frontend/css/style.css`, `frontend/js/map.js`, `frontend/js/app.js`, `VERSION`, `docs/CHANGELOG.md`
- **Key Deliverables**:
  - **30-Second Inactivity Auto-Collapse & Corner Snapping**: Instrumented universal 30s idle timers on both `LAYERS` (lower-left) and `MAG` (lower-right) toolbars across desktop and mobile. User interactions inside widgets reset the countdown. When idle, widgets automatically collapse into compact glass pills and reset to their designated corner anchors even if previously dragged.
  - **One-Click Instant Basemap Toggle**: Replaced multi-step Leaflet radio popup with a custom, direct toggle button docked beneath the zoom controls, featuring vector SVG Map/Moon icons with live contextual tooltips (`Dark Canvas` $\leftrightarrow$ `OpenStreetMap`).
  - **Cohesive Dark Glass Leaflet UI**: Custom styled `.leaflet-control-zoom` and `.leaflet-basemap-toggle` to integrate seamlessly with the observatory surface palette.

---

### [v2.9.12] — 2026-09-06
**Feat: Observatory Standard UTC+3 Clock, Remove Redundant Sync & Mobile Admin Link**
- **Type**: `feat(ui)` / `refactor(header)` / `docs`
- **Scope**: `frontend/index.html`, `frontend/js/app.js`, `VERSION`, `docs/CHANGELOG.md`
- **Key Deliverables**:
  - **Observatory Standard `UTC+3` Clock**: Migrated live header clock from regional "TRT" to scientific standard "UTC+3" (`HH:MM:SS UTC+3`) with an explanatory tooltip, aligning with global seismological networks (USGS, EMSC, ISC, GFZ) and eliminating ambiguity.
  - **Removed Redundant "Sync" Button**: Eliminated manual sync from both the desktop header actions and the mobile tools overflow menu; data is automatically polled in the background every 3 minutes and seamlessly refreshed on the frontend.
  - **Streamlined Mobile Menu**: Removed the Admin Console link from the mobile tools dropdown, ensuring mobile visitors interact purely with essential monitoring tools (Audio, Analytics, Table, Snapshot).

---

### [v2.9.11] — 2026-09-06
**Feat: Symmetrical Corner Docking for Layers & Mag, Default Radiant Heatmap, Compact Mobile Feed**
- **Type**: `feat(ui)` / `style(mobile)` / `perf(map)`
- **Scope**: `frontend/index.html`, `frontend/css/style.css`, `frontend/js/map.js`, `frontend/js/app.js`
- **Key Deliverables**:
  - **Symmetrical Lower-Corner Docking**: Positioned `LAYERS` at the lower-left corner (`bottom: 24px; left: 24px;` on desktop; `bottom: 58px; left: 8px;` on mobile) and `MAG` at the lower-right corner (`bottom: 24px; right: 24px;` on desktop; `bottom: 58px; right: 8px;` on mobile), perfectly clearing the northern map, Black Sea, Istanbul, and Leaflet controls.
  - **Shortened Widget Titles**: Streamlined titles from "Map Layers" $\rightarrow$ `Layers` and "Magnitude Scale" $\rightarrow$ `Mag` for clean, compact corner pills.
  - **All Map Layers Active by Default**: Enabled Tectonic Fault Lines, Turkish Provinces, and Seismic HeatMap on initial load.
  - **Calibrated Radiant Heatmap**: Scaled normalized intensity curve (`minOpacity: 0.35`, radius `34px`) so seismic density clouds along the North and East Anatolian faults glow immediately and visibly upon boot.
  - **Compact Mobile Feed Cards**: Streamlined mobile drawer items to display Magnitude and Region only, hiding secondary metadata and reducing card height for effortless scrolling.

---

### [v2.9.10] — 2026-09-06
**Feat: Mobile Dual-Burger Header Architecture with Left Feed & Right Tools Menu**
- **Type**: `feat(ui)` / `ux(mobile)`
- **Scope**: `frontend/index.html`, `frontend/css/style.css`, `frontend/js/app.js`
- **Key Deliverables**:
  - **Dual-Burger Header Layout on Mobile**: Redesigned mobile header (`<=768px`) with left Feed burger (`☰`) toggling the off-canvas Seismic Events Feed drawer and right Tools menu burger (`⋮`) opening a glassmorphic action dropdown.
  - **Centered Brand Identity & Live Clock**: Centered brand title (`TEMAS 2`) with seismic wave icon and real-time live clock (`● HH:MM:SS TRT`) on a single line (`white-space: nowrap`), eliminating multi-line squeeze on narrow displays.
  - **Consolidated Tools Action Sheet**: Collected Audio Alerts, Analytics Deck, Data Moderation Table, Snapshot Camera, Sync Ingestion, and Admin Console into the right tools menu with touch backdrop dismissal.
  - **Desktop 1-Click Navbar Preservation**: Retained full direct 1-click header buttons (`Feed`, `Audio`, `Analytics`, `Table`, `Fullscreen`, `Snapshot`, `Sync`) and all 3 live KPI badges (`Recorded`, `Max Quake`, `24h Count`) on desktop screens (`>768px`).

---

### [v2.9.9] — 2026-09-06
**Feat: Draggable Filters Bar Matching Map Layers & Magnitude Scale**
- **Type**: `feat(ui)` / `style(mobile)`
- **Scope**: `frontend/index.html`, `frontend/css/style.css`, `frontend/js/app.js`
- **Key Deliverables**:
  - **Draggable Filter Accordion Pill**: Integrated the Filters bar header into the floating draggable engine, enabling users to freely drag and reposition the filter pill across the map on both mobile and desktop matching Map Layers and Magnitude Scale.
  - **Discrete Drag Handle**: Added a dedicated drag handle (`⋮⋮`) to `.filter-mobile-header` for seamless touch and mouse dragging without interfering with the expand/collapse tap action.
  - **Non-Blocking Tap vs Drag**: Added movement threshold detection to differentiate between quick taps (toggling the filter dropdown) and pointer drags (repositioning).

---

### [v2.9.8] — 2026-09-06
**Feat: Real-Time Ticking TRT Clock, 3-Minute Auto-Refresh, Mobile Filter Positioning & Scaled Widget Typography**
- **Type**: `feat(ui)` / `feat(ingestion)` / `style(mobile)`
- **Scope**: `frontend/index.html`, `frontend/css/style.css`, `frontend/js/app.js`, `frontend/admin.html`, `frontend/js/admin.js`, `backend/main.py`, `docker-compose.yml`
- **Key Deliverables**:
  - **Real-Time Ticking TRT Clock**: Removed redundant "Live:" text and implemented a live clock ticking every second in Turkey Standard Time (`HH:MM:SS TRT`) next to the pulsing green indicator.
  - **Single-Line Brand Preservation**: Styled `.brand-text` and `.brand-text h1` with `white-space: nowrap` to ensure "TEMAS 2" never wraps into two lines on narrow smartphone screens.
  - **Elevated Mobile Filter Bar**: Adjusted `.filter-bar` top position on mobile screens (`top: 8px` / `top: 6px`) so the floating pill sits directly below the header title bar with zero dead space.
  - **Compact Widget Typography**: Scaled down the header titles and drag icons for "Map Layers" and "Magnitude Scale" on mobile screens (`0.58rem` / `0.52rem`) for a sleek, unobtrusive appearance.
  - **3-Minute Dataset Auto-Refresh**: Added client-side periodic refresh timer (`180,000ms`) in sync with the backend ingestion scheduler to auto-update seismic markers, feed, and KPIs without manual page reloads.

---

### [v2.9.7] — 2026-09-06
**Feat: Mobile-Friendly Responsive Layout, Off-Canvas Touch Drawer & Floating Accordions**
- **Type**: `feat(ui)` / `feat(responsive)`
- **Scope**: `frontend/index.html`, `frontend/css/style.css`, `frontend/js/app.js`
- **Key Deliverables**:
  - **Responsive Header & Icon-Only Collapse**: Transformed top navigation on small screens (`<=768px`) to an ultra-clean mobile header with compact brand identity, live TRT indicator, and icon-only actions with touch-friendly 40px targets.
  - **Off-Canvas Mobile Feed Drawer**: Implemented a slide-out drawer for the seismic feed on mobile with backdrop blur overlay, dedicated close button, and swipe-to-dismiss touch gestures. Feed item clicks seamlessly focus the earthquake on the map and auto-dismiss the drawer.
  - **Collapsible Floating Filter Accordion**: Converted the top filter bar on small viewports into a sleek floating pill (`⚙ Filters All-Time • M3.0+ ▾`) that expands on tap and updates dynamically based on current filtering criteria.
  - **Mobile Widget Accordions**: Added collapsible chevrons to floating Map Layers and Magnitude Scale widgets, keeping the mobile viewport over 85% clear for map exploration while preserving drag & drop on desktop.
  - **Thumb-Friendly Timeline Controls**: Optimized bottom playback scrubber bar to fit cleanly across 360px–480px viewports with responsive controls.

---

### [v2.9.6] — 2026-09-06
**Feat: Live Observatory Time Calibration to Turkey Time (TRT / UTC+3)**
- **Type**: `feat(ui)` / `feat(telemetry)`
- **Scope**: `backend/ingestion/scheduler.py`, `frontend/index.html`, `frontend/js/app.js`, `frontend/admin.html`, `frontend/js/admin.js`
- **Key Deliverables**:
  - **Turkey Standard Time Alignment**: Calibrated the live header status pill to display Turkey Standard Time (`Live: HH:MM TRT`), matching national observatory operations (KOERI/AFAD) and the local Turkish territory monitored by the system.
  - **Dual-Tz Telemetry Ingestion**: Added `last_sync_time_trt` alongside UTC timestamps in backend scheduler state to provide first-class timezone conversions without relying solely on client clock parsing.
  - **Operations Deck Clock Standardization**: Converted the Admin Observatory Console deck clock (`#deckTime`) from UTC to live `HH:MM:SS TRT` with descriptive `Turkey Standard Time (TRT / UTC+3)` tooltip metadata.

---

### [v2.9.5] — 2026-09-05
**Feat: Fancy Seismic Wave Icon, Clean Map Attribution, Snapshot Box Fix, Legacy Purge**
- **Type**: `feat(ui)` / `fix(snapshot)` / `chore(cleanup)`
- **Scope**: `frontend/index.html`, `frontend/css/style.css`, `frontend/js/app.js`, `frontend/js/map.js`, `frontend/assets/favicon.svg`, `legacy/`
- **Key Deliverables**:
  - **Discreet Viewport (Leaflet Bar Removed)**: Fully disabled and suppressed the Leaflet lower-right attribution bar (`attributionControl: false` in map configuration and CSS hard suppression), eliminating map clutter.
  - **Fancy Seismic Wave Brand Icon & SVG Favicon**: Replaced generic lightning symbol with an animated SVG emblem featuring multi-frequency concentric seismic shockwave rings, pulsing epicenter core, and seismogram waveform spike. Added crisp vector `frontend/assets/favicon.svg` for browser tabs.
  - **Snapshot Brand & Timeline Artifact Fixes**:
    - Resolved the gray/white rectangular box artifact that appeared over "TEMAS 2" by eliminating text-background-clip gradients in favor of crisp `#ffffff` and applying DOM sanitization in `onclone`.
    - Eliminated the white background box behind the timeline progress slider by styling `input[type="range"]` with transparent backgrounds and dynamically replacing range inputs with crisp vector tracks in snapshot clones.
    - Reduced and balanced the Playback Speed select dropdown typography (`0.68rem`) and rendered a sleek vector badge in snapshots to prevent oversized system form control fonts.
    - Strictly excluded transient toast notifications (`#public-toast`, `.toast`) from snapshot captures via `ignoreElements`, clone DOM purge, and delayed confirmation toasts.
  - **Retirement of Legacy Directory**: Deleted 40 obsolete 2023 proof-of-concept scripts and notebooks in `legacy/`, keeping the active repository focused on modern FastAPI and async JS architecture.

---

### [v2.9.4] — 2026-09-05
**Feat: One-Click Frontpage Map Snapshot Camera Action**
- **Type**: `feat(ui)`
- **Scope**: `frontend/index.html`, `frontend/css/style.css`, `frontend/js/app.js`, `frontend/js/map.js`
- **Key Deliverables**:
  - **Camera Snapshot Icon**: Added an icon-only `📷` button (`#btn-map-snapshot`) directly to the top-right header action bar beside Fullscreen and Sync.
  - **Instant High-DPI Snapshot Engine**: Clicking the Camera icon triggers `captureFrontpageSnapshot()`, which captures the full interactive map canvas (with live earthquakes, tectonic faults, provincial borders, and active widgets) at 2x Retina resolution without capturing transient toasts or background modals.
  - **CORS-Enabled Tile Layers**: Configured `crossOrigin: true` on ArcGIS and OpenStreetMap tile layers to prevent canvas tainting during client-side export.

---

### [v2.9.3] — 2026-09-05
**Feat/Fix: Default Auto-Hidden Sidebar, Draggable Map Widgets, Clean White A4/Letter PNG Export**
- **Type**: `feat(ui)` / `fix(analytics)`
- **Scope**: `frontend/index.html`, `frontend/css/style.css`, `frontend/js/app.js`, `frontend/js/map.js`
- **Key Deliverables**:
  - **Auto-Hidden Left Sidebar by Default**: The seismic feed boots hidden on load to provide an expansive edge-to-edge map viewport; hovering the left edge trigger zone peeks the feed drawer smoothly on demand without altering map dimensions.
  - **Draggable Floating Widgets**: Equipped both "Map Layers" and "Magnitude Scale" legend with draggable header handles (`⋮⋮`) and boundary containment, preventing widgets from disappearing off-screen and blocking Leaflet map pan propagation during drags.
  - **Clean White 1-Page A4/Letter PNG Export**: Replaced the dark modal snapshot with an isolated sandbox clone rendered in an official executive white paper bulletin format (`.export-a4-snapshot`) at 1414×1000px base (2828×2000px 2x Retina output), perfectly auto-fitting standard landscape paper.
  - **Map Resize & Black-Out Elimination**: Added `ResizeObserver` to `#map` and calibrated `invalidateMapSize(true)` with `pan: true` to guarantee all tiles are continuously loaded across the entire expanded viewport.
  - **Neutral Sync Button**: Harmonized the top-right `⚡ Sync` button with clean glass styling, removing the prominent emergency red gradient.

---

### [v2.9.2] — 2026-09-05
**Feat/Fix: 1-Page PDF & PNG Analytics Export, Expanded Sidebar Card Height & Content**
- **Type**: `feat(analytics)` / `fix(ui)`
- **Scope**: `frontend/index.html`, `frontend/css/style.css`, `frontend/js/app.js`
- **Key Deliverables**:
  - **1-Page Printable PDF & PNG Export**: Equipped the Analytics observatory deck with dedicated `📄 Export PDF` (tailored `@media print` executive A4 landscape single-page layout) and `📸 Export PNG` (high-res 2x retina snapshot via `html2canvas`) buttons for instant report generation.
  - **Expanded Sidebar Card Geometry**: Enhanced `.event-card` with generous `min-height: 86px`, relaxed 2-line title clamping (`line-clamp: 2`), larger magnitude pills (`48x48px`), and structured metadata pill tags for timestamp, hypocentral depth, and reporting network source (KOERI / EMSC / USGS).

---

### [v2.9.1] — 2026-09-05
**Fix/Feat: Map Drift Prevention, Large Analytics Deck, Auto-Deduplication on Sync, Clean Visitor Header**
- **Type**: `fix(map)` / `feat(analytics)` / `feat(sync)`
- **Scope**: `frontend/js/map.js`, `frontend/js/app.js`, `frontend/css/style.css`, `frontend/index.html`, `backend/ingestion/scheduler.py`, `tests/test_api.py`
- **Key Deliverables**:
  - **Map Drift Prevention**: Eliminated map jumping to the Arctic Ocean when toggling "Feed" or "Fullscreen" by disabling Leaflet's erratic `trackResize`, establishing strict geographic `maxBounds` around Turkey/Mediterranean, and creating a center-preserving `invalidateMapSize()` method.
  - **Large Analytics Deck**: Expanded the cramped 800px modal into a 1380px wide 4-card observatory analytics cockpit featuring Gutenberg-Richter magnitude spectrum bars, hypocentral depth stratification, regional clustering, and multi-network sensor ingestion breakdown.
  - **Auto-Deduplication on Sync**: Embedded automatic SQLite database deduplication (`deduplicate_earthquakes`) into every sync cycle with live user toast notifications reporting purged duplicate count.
  - **Clean Visitor Header**: Removed the intrusive "Admin" button from the main header for common visitors (deck remains directly accessible at `/admin`).

---

### [v2.9.0] — 2026-09-05
**Feat: Left Sidebar Full-Height Vertical Scroll & 30s Idle Auto-Hide with Edge Peek**
- **Type**: `feat(ui)`
- **Scope**: `frontend/css/style.css`, `frontend/index.html`, `frontend/js/app.js`
- **Key Deliverables**:
  - **Full-Height Vertical Scroll**: Configured `.feed-list` with `flex: 1 1 auto`, `min-height: 0`, custom glassmorphic cyan scrollbars, and `padding-bottom: 72px` ensuring the very last seismic feed card is fully viewable without clipping.
  - **30-Second Idle Auto-Hide**: Implemented inactivity monitor that automatically collapses the sidebar after 30 seconds of user idle time, maximizing map viewport real estate.
  - **Edge-Hover Peek / Wake**: Introduced `#sidebar-hover-zone` with a glowing futuristic chevron indicator along the left edge that smoothly reveals the sidebar when hovering or clicking, with auto-wake on direct interaction.
  - **Repo Cleanliness**: Verified `.venv/` virtual environment is strictly untracked in Git.

---

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

