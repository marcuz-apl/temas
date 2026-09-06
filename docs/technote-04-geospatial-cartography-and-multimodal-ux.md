# TECHNOTE-04: Geospatial Cartography, Multimodal Sonification & UI Ergonomics

**Status**: Active / Production  
**Component**: Map Engine (`frontend/js/mapEngine.js`), Audio Synthesis (`frontend/js/app.js`), UI Shell & Styles (`frontend/index.html`, `frontend/css/style.css`)  
**Author**: TEMAS Core Engineering Team  
**Last Updated**: 2026-09-06  

---

## 1. Context & Architectural Principles

The legacy TEMAS prototype relied on Python Folium scripts generating multi-megabyte static HTML pages with embedded `<iframe>` elements and defunct Stamen map tiles. Modernizing the platform into TEMAS Gen2 established five foundational frontend design principles:

1. **Zero Iframe Embedding**: A unified Single Page Application (SPA) where map layers, historical event tables, analytics modals, and telemetry controls operate seamlessly within a single DOM lifecycle.
2. **GPU-Accelerated Vector Cartography**: Utilizing Leaflet's HTML5 Canvas rendering backend to plot thousands of hypocenters simultaneously at 60 FPS without DOM node thrashing.
3. **Multimodal Situational Awareness**: Combining visual cartography with real-time Web Audio API sonification, transforming seismic data from passive visuals into an immersive auditory and spatial experience.
4. **Adaptive Scoping**: Defaulting to a lightweight, instantaneous 1-Year dataset (~1,600 events) for immediate initial paint, with the capability to scale smoothly to the full 2021–2026 catalog (>13,400 events) on demand.
5. **Ergonomic Multi-Device Navigation**: Consistent, distraction-free layouts tailored specifically for wide desktop monitors, tablets, and handheld smartphones.

---

## 2. Balanced 3-Column Observatory Header & Telemetry HUD

### 2.1 Spatial Hierarchy
Desktop navigation is structured into three dedicated functional zones:
```
┌───────────────────────────────────────────────────────────────────────────────────────────┐
│ [Brand & Logo]                [Centered Telemetry HUD Capsule]          [Icon Action Dock]│
│ TEMAS 2                       UTC+3 | Recorded | Max Quake | 24h Count  [≡] [🔊] [📊] [▦] [⛶] [📷]│
└───────────────────────────────────────────────────────────────────────────────────────────┘
```
- **Left Column (`.header-left`)**: Observatory brand mark, live seismogram pulse logo, and geoscientific subtitle.
- **Center Column (`.header-center`)**: Floating, dark-glass telemetry HUD capsule (`.header-kpis`) containing live mission counters.
- **Right Column (`.header-right`)**: Distraction-free, icon-only action dock providing instant access to primary application panels.

### 2.2 Telemetry HUD Capsule Metrics
The centered HUD pill presents four real-time observatory indicators:
1. **Live Observatory Clock**: Real-time `UTC+3 (TRT)` standard, reflecting official Turkish Standard Time.
2. **Catalog Total**: Live count of verified events ($M \ge 2.0$) within the active temporal filter.
3. **Max Quake**: Highest magnitude recorded within the catalog view, highlighted in high-contrast crimson (`#ef4444`).
4. **24h Count**: Total seismic events detected in the region over the preceding 24 hours.

### 2.3 Distraction-Free Icon Action Dock
To maximize map canvas visibility and eliminate visual clutter, action buttons are rendered as uniform $38 \times 38\text{px}$ icon pads with rich hover glows and informative tooltip shortcuts:
- **Feed Toggle (`(F)`)**: Slides open the chronological seismic event drawer.
- **Audio Toggle**: Activates/mutes Web Audio timeline sonification and live alerts with dynamic SVG state updates.
- **Analytics Deck (`(A)`)**: Launches the comprehensive statistical analysis modal (magnitude distribution, depth profiles, daily frequencies).
- **Data Table (`(T)`)**: Opens the virtualized, full-screen data table with multi-vector search.
- **Fullscreen Mode**: Toggles native browser fullscreen mode with automated map invalidation.
- **Map Snapshot**: Captures and downloads an instant client-side high-resolution PNG snapshot.

---

## 3. Geospatial Cartography & Active Tectonic Overlays

### 3.1 Cartographic Layers
- **Primary Base Layer**: CartoDB Dark Matter for nocturnal cyber-observatory aesthetics and maximum hypocenter contrast.
- **Alternative Base Layer**: OpenStreetMap Standard Light, accessible via a one-click SVG toggle that dynamically restyles the entire UI theme (glassmorphism panels, toolbars, and timeline scrubbers).
- **Active Fault Boundaries**: Renders the PB2002 plate boundary model and official MTA active fault lines as high-visibility vector overlays with dynamic popup fault metadata.
- **Administrative Borders**: High-resolution GeoJSON boundaries for Turkish provinces (`geoboundaries-TUR-ADM1`) allowing precise regional context.

### 3.2 Dynamic Hypocenter Styling
Earthquake markers are dynamically styled based on geodynamic properties:
- **Magnitude Scaling**: Marker radius scales non-linearly according to energy release:
  $$\text{Radius} = \max\left(3.5, \text{scale} \times (\text{magnitude} - 1.8)^{1.8}\right)$$
- **Depth Color-Coding**:
  - Shallow ($0\text{–}10\text{ km}$): Neon Cyan (`#06b6d4`)
  - Intermediate-Shallow ($10\text{–}30\text{ km}$): Bright Orange (`#f97316`)
  - Deep Crustal ($>30\text{ km}$): Deep Crimson (`#ef4444`)
- **Radiant Heatmap**: GPU-accelerated density intensity layer highlighting spatial earthquake clustering.

---

## 4. Multimodal Web Audio Sonification

### 4.1 Playback Acoustic Synthesis
To complement visual timeline animation, TEMAS integrates real-time audio sonification using the Web Audio API:
- **Magnitude-to-Frequency Mapping**: Earthquakes are sonified with custom oscillator envelopes. Minor tremors ($M 2.0\text{–}3.5$) emit short, crisp acoustic pings (300–450 Hz), while major events ($M \ge 6.0$) trigger deep tectonic sub-bass rumbles (50–120 Hz) with extended reverb tails.
- **Resource Protection**: The audio engine shares a single cached `AudioContext` across the session lifecycle (`getAudioContext()`), avoiding browser context exhaustion limits.

### 4.2 Real-Time Event Alarm
Incoming real-time earthquakes ($M \ge 4.0$) detected during background ingestion or manual synchronization trigger a dual-tone ascending acoustic chime (523 Hz $\to$ 784 Hz) paired with a visual cyber toast.

---

## 5. Mobile Dual-Navigation Architecture

On compact mobile screens ($\le 768\text{px}$), desktop controls adapt into an ergonomic dual-drawer layout:
- **Left Burger**: Toggles a full-height, touch-swipe-dismissable Seismic Feed Drawer.
- **Right 9-Dot Bento Button**: Opens a grid modal housing secondary tools (Map Layers, Table, Analytics, Basemap, Snapshot).
- **Floating Corner Docks**: Symmetrical bottom-corner widgets (Layers & Magnitude Legend) feature 30-second idle auto-collapse with edge-hover peeking to maximize touch viewport space.
