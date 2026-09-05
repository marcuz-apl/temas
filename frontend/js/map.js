/**
 * TEMAS 2.0 - Geospatial Map Engine (Leaflet + CartoDB + Heatmap)
 */

export function getMagnitudeColor(mag) {
  if (mag < 3.0) return '#10b981'; // Green
  if (mag < 4.5) return '#38bdf8'; // Sky Blue
  if (mag < 6.0) return '#f59e0b'; // Amber
  if (mag < 7.0) return '#ef4444'; // Red
  return '#ec4899';               // Magenta / Catastrophic
}

export function getMagnitudeRadius(mag) {
  // Exponential scaling for visual energy proportionality
  return Math.max(5, Math.pow(mag, 1.8) * 0.7);
}

export const TURKISH_CITIES = {
  "Kahramanmaraş": [37.5753, 36.9228],
  "Gaziantep": [37.0662, 37.3833],
  "Hatay (Antakya)": [36.2023, 36.1613],
  "Malatya": [38.3552, 38.3095],
  "Adana": [37.0000, 35.3213],
  "Ankara": [39.9334, 32.8597],
  "İstanbul": [41.0082, 28.9784],
  "İzmir": [38.4237, 27.1428],
  "Diyarbakır": [37.9144, 40.2306],
  "Trabzon": [41.0027, 39.7168]
};

export function calculateHaversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export class TemasMap {
  constructor(containerId, onMarkerClick) {
    this.containerId = containerId;
    this.onMarkerClick = onMarkerClick;
    this.markers = new Map();
    this.markerLayerGroup = L.layerGroup();
    this.faultLayerGroup = L.layerGroup();
    this.provinceLayerGroup = L.layerGroup();
    this.heatLayerGroup = L.layerGroup();
    this.heatLayer = null;
    this.currentEarthquakes = [];

    this.initMap();
  }

  initMap() {
    // Center of Turkey
    this.map = L.map(this.containerId, {
      center: [38.9637, 35.2433],
      zoom: 6,
      minZoom: 4,
      maxZoom: 15,
      zoomControl: false,
      attributionControl: false, // Disables Leaflet attribution bar at lower-right corner
      trackResize: false // Handled cleanly via window resize & fullscreenchange listeners
    });

    // Handle window resize and fullscreen toggles cleanly without drift
    window.addEventListener('resize', () => {
      this.invalidateMapSize(true);
    });
    document.addEventListener('fullscreenchange', () => {
      setTimeout(() => this.invalidateMapSize(true), 120);
      setTimeout(() => this.invalidateMapSize(true), 350);
    });

    // Automatically observe map viewport size changes (e.g. sidebar collapse, auto-hide, peek)
    const mapContainer = document.getElementById(this.containerId);
    if (mapContainer && window.ResizeObserver) {
      this.resizeObserver = new ResizeObserver(() => {
        this.invalidateMapSize(true);
      });
      this.resizeObserver.observe(mapContainer);
    }

    // Zoom control in top-right
    L.control.zoom({ position: 'topright' }).addTo(this.map);

    // Esri World Dark Gray Base (100% Free, NO API key, zero watermarks)
    this.darkBase = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
      attribution: 'Tiles &copy; Esri &mdash; USGS, NOAA',
      maxZoom: 16,
      crossOrigin: true
    }).addTo(this.map);

    // Esri Dark Reference Labels Overlay
    this.darkLabels = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 16,
      crossOrigin: true
    }).addTo(this.map);

    // Alternative OpenStreetMap Standard (100% Free)
    this.osmTiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
      crossOrigin: true
    });

    // Layer control to switch basemaps
    const baseLayers = {
      "Dark Canvas": L.layerGroup([this.darkBase, this.darkLabels]),
      "OpenStreetMap": this.osmTiles
    };
    L.control.layers(baseLayers, null, { position: 'topright' }).addTo(this.map);

    this.markerLayerGroup.addTo(this.map);
    this.faultLayerGroup.addTo(this.map);
    this.provinceLayerGroup.addTo(this.map); // Active by default
  }

  loadTectonicBoundaries(geojsonData) {
    this.faultLayerGroup.clearLayers();
    L.geoJSON(geojsonData, {
      style: {
        color: '#f43f5e',
        weight: 2.2,
        opacity: 0.85,
        dashArray: '5, 5'
      },
      onEachFeature: (feature, layer) => {
        if (feature.properties && feature.properties.Name) {
          layer.bindTooltip(`Tectonic Boundary: ${feature.properties.Name}`, { sticky: true });
        }
      }
    }).addTo(this.faultLayerGroup);
  }

  loadProvinceBoundaries(geojsonData) {
    this.provinceLayerGroup.clearLayers();
    L.geoJSON(geojsonData, {
      style: {
        color: '#38bdf8',
        weight: 1.0,
        opacity: 0.45,
        fillColor: '#38bdf8',
        fillOpacity: 0.03
      },
      onEachFeature: (feature, layer) => {
        const name = feature.properties?.shapeName || feature.properties?.name || 'Province';
        layer.bindTooltip(`Province: <strong>${name}</strong>`, { sticky: true });
        layer.on({
          mouseover: (e) => e.target.setStyle({ weight: 2, opacity: 0.9, fillOpacity: 0.1 }),
          mouseout: (e) => e.target.setStyle({ weight: 1.0, opacity: 0.45, fillOpacity: 0.03 })
        });
      }
    }).addTo(this.provinceLayerGroup);
  }

  setTectonicVisibility(visible) {
    if (visible) {
      if (!this.map.hasLayer(this.faultLayerGroup)) this.map.addLayer(this.faultLayerGroup);
    } else {
      if (this.map.hasLayer(this.faultLayerGroup)) this.map.removeLayer(this.faultLayerGroup);
    }
  }

  setProvinceVisibility(visible) {
    if (visible) {
      if (!this.map.hasLayer(this.provinceLayerGroup)) this.map.addLayer(this.provinceLayerGroup);
    } else {
      if (this.map.hasLayer(this.provinceLayerGroup)) this.map.removeLayer(this.provinceLayerGroup);
    }
  }

  setHeatmapVisibility(visible) {
    if (visible) {
      if (!this.map.hasLayer(this.heatLayerGroup)) {
        this.updateHeatMap(this.currentEarthquakes);
        this.map.addLayer(this.heatLayerGroup);
      }
    } else {
      if (this.map.hasLayer(this.heatLayerGroup)) this.map.removeLayer(this.heatLayerGroup);
    }
  }

  updateHeatMap(earthquakes) {
    if (!window.L || !L.heatLayer) return;
    const points = earthquakes
      .map((eq) => [
        parseFloat(eq.latitude),
        parseFloat(eq.longitude),
        Math.min(1.0, Math.pow(parseFloat(eq.magnitude) / 7.0, 2))
      ])
      .filter((pt) => !isNaN(pt[0]) && !isNaN(pt[1]));

    if (this.heatLayer) {
      this.heatLayerGroup.removeLayer(this.heatLayer);
    }
    this.heatLayer = L.heatLayer(points, {
      radius: 28,
      blur: 18,
      maxZoom: 10,
      gradient: { 0.2: '#38bdf8', 0.5: '#f59e0b', 0.8: '#ef4444', 1.0: '#ec4899' }
    });
    this.heatLayer.addTo(this.heatLayerGroup);
  }

  renderEarthquakes(earthquakes, maxTime = null) {
    this.currentEarthquakes = earthquakes;
    this.markerLayerGroup.clearLayers();
    this.markers.clear();

    const filtered = maxTime
      ? earthquakes.filter((e) => e.origintimeutc <= maxTime)
      : earthquakes;

    filtered.forEach((eq) => {
      const lat = parseFloat(eq.latitude);
      const lon = parseFloat(eq.longitude);
      const mag = parseFloat(eq.magnitude);

      if (isNaN(lat) || isNaN(lon)) return;

      const color = getMagnitudeColor(mag);
      const radius = getMagnitudeRadius(mag);

      const marker = L.circleMarker([lat, lon], {
        radius: radius,
        fillColor: color,
        color: '#ffffff',
        weight: mag >= 5.0 ? 2 : 1,
        opacity: 0.8,
        fillOpacity: 0.65
      });

      // Rich custom popup with Wave Arrival Estimator
      const initialCity = "Kahramanmaraş";
      const initialDist = Math.round(calculateHaversineKm(lat, lon, TURKISH_CITIES[initialCity][0], TURKISH_CITIES[initialCity][1]));
      const pWaveSec = Math.round(initialDist / 6.0);
      const sWaveSec = Math.round(initialDist / 3.5);

      const popupHtml = `
        <div class="custom-popup" data-lat="${lat}" data-lon="${lon}">
          <div class="popup-mag" style="color: ${color}">
            <span>${mag.toFixed(1)}</span>
            <small style="font-size: 0.75rem; color: #94a3b8;">${eq.magtype || 'ML'}</small>
          </div>
          <div class="popup-region">${eq.region || 'Unknown Region'}</div>
          <div class="popup-grid">
            <div class="popup-cell">
              <span>Date (TRT):</span>
              <strong>${eq.eventtime || eq.origintimeutc}</strong>
            </div>
            <div class="popup-cell">
              <span>Depth:</span>
              <strong>${eq.depthkm} km</strong>
            </div>
            <div class="popup-cell">
              <span>Coordinates:</span>
              <strong>${lat.toFixed(3)}°N, ${lon.toFixed(3)}°E</strong>
            </div>
            <div class="popup-cell">
              <span>Method:</span>
              <strong>${eq.measmethod || 'RETMC'}</strong>
            </div>
          </div>
          <div class="popup-estimator" style="margin-top: 8px; padding-top: 6px; border-top: 1px solid rgba(255,255,255,0.08);">
            <div style="font-size: 0.7rem; color: #94a3b8; margin-bottom: 4px;"><strong>Wave Arrival from Epicenter:</strong></div>
            <div style="display: flex; gap: 6px; align-items: center;">
              <select class="city-selector" style="background: rgba(255,255,255,0.08); color: #fff; border: 1px solid rgba(255,255,255,0.15); border-radius: 4px; font-size: 0.72rem; padding: 2px 4px; outline: none;">
                ${Object.keys(TURKISH_CITIES).map(c => `<option value="${c}" ${c === initialCity ? 'selected' : ''}>${c}</option>`).join('')}
              </select>
              <span class="est-result" style="font-size: 0.72rem; font-family: monospace; color: #38bdf8;">${initialDist}km | P:~${pWaveSec}s | S:~${sWaveSec}s</span>
            </div>
          </div>
        </div>
      `;

      marker.bindPopup(popupHtml, { closeButton: false });

      marker.on('popupopen', (e) => {
        const popupEl = e.popup.getElement();
        if (!popupEl) return;
        const selector = popupEl.querySelector('.city-selector');
        const resEl = popupEl.querySelector('.est-result');
        if (selector && resEl) {
          selector.addEventListener('change', (ev) => {
            const cityName = ev.target.value;
            const cityCoords = TURKISH_CITIES[cityName];
            if (cityCoords) {
              const d = Math.round(calculateHaversineKm(lat, lon, cityCoords[0], cityCoords[1]));
              const pTime = Math.round(d / 6.0);
              const sTime = Math.round(d / 3.5);
              resEl.textContent = `${d}km | P:~${pTime}s | S:~${sTime}s`;
            }
          });
        }
      });

      marker.on('click', () => {
        if (this.onMarkerClick) {
          this.onMarkerClick(eq);
        }
      });

      marker.addTo(this.markerLayerGroup);
      this.markers.set(eq.origintimeutc, marker);
    });

    if (this.map.hasLayer(this.heatLayerGroup)) {
      this.updateHeatMap(filtered);
    }
  }

  focusEarthquake(eq, zoom = 9) {
    const lat = parseFloat(eq.latitude);
    const lon = parseFloat(eq.longitude);
    if (isNaN(lat) || isNaN(lon)) return;

    this.map.flyTo([lat, lon], zoom, {
      animate: true,
      duration: 1.2
    });

    const marker = this.markers.get(eq.origintimeutc);
    if (marker) {
      setTimeout(() => {
        marker.openPopup();
      }, 700);
    }
  }

  resetView() {
    this.map.flyTo([38.9637, 35.2433], 6, {
      animate: true,
      duration: 1.0
    });
  }

  /**
   * Resizes map viewport without causing Leaflet to pan or drift towards Arctic Ocean / Null Island.
   * Preserves current center coordinate or restores Turkey baseline if coordinates were perturbed.
   */
  invalidateMapSize(preserveCenter = true) {
    if (!this.map) return;
    const currentCenter = this.map.getCenter();
    const currentZoom = this.map.getZoom();

    // Invalidate size with pan: true so Leaflet recomputes viewport offset and fetches newly exposed tiles
    this.map.invalidateSize({ pan: true, animate: false });

    if (preserveCenter && currentCenter && !isNaN(currentCenter.lat) && !isNaN(currentCenter.lng)) {
      // Bounds check: Only restore if coordinates drifted to Arctic/extreme poles
      if (currentCenter.lat > 70 || currentCenter.lat < 10) {
        this.map.setView([38.9637, 35.2433], currentZoom || 6, { animate: false });
      }
    }
  }
}
