/**
 * TEMAS 2.0 - Geospatial Map Engine (Leaflet + CartoDB)
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

export class TemasMap {
  constructor(containerId, onMarkerClick) {
    this.containerId = containerId;
    this.onMarkerClick = onMarkerClick;
    this.markers = new Map();
    this.markerLayerGroup = L.layerGroup();
    this.faultLayerGroup = L.layerGroup();
    this.activePopupMarker = null;

    this.initMap();
  }

  initMap() {
    // Center of Turkey
    this.map = L.map(this.containerId, {
      center: [38.9637, 35.2433],
      zoom: 6,
      minZoom: 4,
      maxZoom: 15,
      zoomControl: false
    });

    // Zoom control in top-right
    L.control.zoom({ position: 'topright' }).addTo(this.map);

    // Esri World Dark Gray Base (100% Free, NO API key, zero watermarks)
    this.darkBase = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
      attribution: 'Tiles &copy; Esri &mdash; USGS, NOAA',
      maxZoom: 16
    }).addTo(this.map);

    // Esri Dark Reference Labels Overlay
    this.darkLabels = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 16
    }).addTo(this.map);

    // Alternative OpenStreetMap Standard (100% Free)
    this.osmTiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19
    });

    // Layer control to switch basemaps
    const baseLayers = {
      "Dark Canvas": L.layerGroup([this.darkBase, this.darkLabels]),
      "OpenStreetMap": this.osmTiles
    };
    L.control.layers(baseLayers, null, { position: 'topright' }).addTo(this.map);

    this.markerLayerGroup.addTo(this.map);
    this.faultLayerGroup.addTo(this.map);
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

  setTectonicVisibility(visible) {
    if (visible) {
      if (!this.map.hasLayer(this.faultLayerGroup)) {
        this.map.addLayer(this.faultLayerGroup);
      }
    } else {
      if (this.map.hasLayer(this.faultLayerGroup)) {
        this.map.removeLayer(this.faultLayerGroup);
      }
    }
  }

  renderEarthquakes(earthquakes) {
    this.markerLayerGroup.clearLayers();
    this.markers.clear();

    earthquakes.forEach((eq) => {
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

      // Rich custom popup
      const popupHtml = `
        <div class="custom-popup">
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
        </div>
      `;

      marker.bindPopup(popupHtml, { closeButton: false });

      marker.on('click', () => {
        if (this.onMarkerClick) {
          this.onMarkerClick(eq);
        }
      });

      marker.addTo(this.markerLayerGroup);
      this.markers.set(eq.origintimeutc, marker);
    });
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
}
