/**
 * TEMAS 2.0 - Main Application Controller
 */

import { fetchEarthquakes, fetchStats, fetchTectonicBoundaries, triggerManualSync } from './api.js';
import { TemasMap, getMagnitudeColor } from './map.js';

class TemasApp {
  constructor() {
    this.state = {
      earthquakes: [],
      stats: null,
      selectedEvent: null,
      filters: {
        min_magnitude: 3.0,
        preset: 'all',
        region: '',
        limit: 1000
      }
    };

    this.mapEngine = null;
    this.init();
  }

  async init() {
    this.mapEngine = new TemasMap('map', (eq) => this.handleMarkerClick(eq));
    this.bindEvents();

    // Load tectonic boundaries
    fetchTectonicBoundaries()
      .then((geojson) => this.mapEngine.loadTectonicBoundaries(geojson))
      .catch((err) => console.warn('Could not load tectonic boundaries:', err));

    // Initial load
    await this.refreshAll();
  }

  bindEvents() {
    // Magnitude Slider
    const magSlider = document.getElementById('mag-slider');
    const magValue = document.getElementById('mag-val');
    if (magSlider && magValue) {
      magSlider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        magValue.textContent = `M${val.toFixed(1)}+`;
        this.state.filters.min_magnitude = val;
        this.loadEarthquakes();
      });
    }

    // Time Presets
    const presetButtons = document.querySelectorAll('.pill-btn');
    presetButtons.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        presetButtons.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        const preset = btn.dataset.preset;
        this.state.filters.preset = preset;
        this.loadEarthquakes();
      });
    });

    // Region Search Input
    const searchInput = document.getElementById('region-search');
    if (searchInput) {
      let debounceTimer = null;
      searchInput.addEventListener('input', (e) => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          this.state.filters.region = e.target.value.trim();
          this.loadEarthquakes();
        }, 300);
      });
    }

    // Tectonic Fault Line Layer Toggle
    const faultToggle = document.getElementById('toggle-faults');
    if (faultToggle) {
      faultToggle.addEventListener('change', (e) => {
        this.mapEngine.setTectonicVisibility(e.target.checked);
      });
    }

    // Sync Now Button
    const syncBtn = document.getElementById('btn-sync');
    if (syncBtn) {
      syncBtn.addEventListener('click', () => this.handleSync());
    }

    // Data Table Modal
    const tableBtn = document.getElementById('btn-table-view');
    const modalBackdrop = document.getElementById('table-modal');
    const closeModalBtn = document.getElementById('btn-close-modal');

    if (tableBtn && modalBackdrop) {
      tableBtn.addEventListener('click', () => {
        this.renderModalTable();
        modalBackdrop.classList.add('open');
      });
    }

    if (closeModalBtn && modalBackdrop) {
      closeModalBtn.addEventListener('click', () => modalBackdrop.classList.remove('open'));
      modalBackdrop.addEventListener('click', (e) => {
        if (e.target === modalBackdrop) modalBackdrop.classList.remove('open');
      });
    }

    // Export Buttons
    const exportCsvBtn = document.getElementById('btn-export-csv');
    if (exportCsvBtn) {
      exportCsvBtn.addEventListener('click', () => this.exportCsv());
    }

    const exportGeoJsonBtn = document.getElementById('btn-export-geojson');
    if (exportGeoJsonBtn) {
      exportGeoJsonBtn.addEventListener('click', () => this.exportGeoJson());
    }
  }

  async refreshAll() {
    await Promise.all([this.loadStats(), this.loadEarthquakes()]);
  }

  async loadStats() {
    try {
      const stats = await fetchStats();
      this.state.stats = stats;
      this.renderKPIs(stats);
    } catch (err) {
      console.error('Failed to load stats:', err);
    }
  }

  async loadEarthquakes() {
    const queryParams = {
      min_magnitude: this.state.filters.min_magnitude,
      limit: this.state.filters.limit
    };

    if (this.state.filters.region) {
      queryParams.region = this.state.filters.region;
    }

    // Preset Date Logic
    const now = new Date();
    if (this.state.filters.preset === '24h') {
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      queryParams.start_date = yesterday.toISOString().replace('T', ' ').substring(0, 19);
    } else if (this.state.filters.preset === '7d') {
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      queryParams.start_date = weekAgo.toISOString().replace('T', ' ').substring(0, 19);
    } else if (this.state.filters.preset === 'feb2023') {
      queryParams.start_date = '2023-02-06 00:00:00';
      queryParams.end_date = '2023-02-28 23:59:59';
    }

    try {
      const data = await fetchEarthquakes(queryParams);
      this.state.earthquakes = data.items || [];
      this.renderFeed(this.state.earthquakes);
      this.mapEngine.renderEarthquakes(this.state.earthquakes);

      const countEl = document.getElementById('feed-count');
      if (countEl) countEl.textContent = `${this.state.earthquakes.length} Events`;
    } catch (err) {
      console.error('Failed loading earthquakes:', err);
    }
  }

  renderKPIs(stats) {
    const elTotal = document.getElementById('kpi-total');
    const elMax = document.getElementById('kpi-max');
    const el24h = document.getElementById('kpi-24h');
    const elSync = document.getElementById('live-status-text');

    if (elTotal) elTotal.textContent = stats.total_count ? stats.total_count.toLocaleString() : '0';
    if (elMax) elMax.textContent = stats.max_magnitude ? `M${stats.max_magnitude.toFixed(1)}` : '-';
    if (el24h) el24h.textContent = stats.last_24h_count || '0';
    if (elSync && stats.sync && stats.sync.last_sync_time) {
      elSync.textContent = `Live: ${stats.sync.last_sync_time.substring(11, 16)} UTC`;
    }
  }

  renderFeed(items) {
    const container = document.getElementById('feed-list');
    if (!container) return;

    if (!items.length) {
      container.innerHTML = `
        <div style="text-align: center; color: #64748b; padding: 40px 10px; font-size: 0.85rem;">
          No earthquake events match the selected criteria.
        </div>
      `;
      return;
    }

    container.innerHTML = items
      .slice(0, 150) // render first 150 for smooth scrolling
      .map((eq) => {
        const mag = parseFloat(eq.magnitude) || 0;
        const color = getMagnitudeColor(mag);
        const timeDisplay = (eq.eventtime || eq.origintimeutc).substring(5, 16);

        return `
          <div class="event-card" data-time="${eq.origintimeutc}" style="--card-severity-color: ${color}">
            <div class="mag-pill" style="background: ${color}">
              <span>${mag.toFixed(1)}</span>
              <small>${eq.magtype || 'ML'}</small>
            </div>
            <div class="event-details">
              <div class="event-region" title="${eq.region}">${eq.region}</div>
              <div class="event-meta">
                <span class="event-time">${timeDisplay}</span>
                <span>•</span>
                <span>${eq.depthkm} km depth</span>
              </div>
            </div>
          </div>
        `;
      })
      .join('');

    // Attach click listeners to cards
    container.querySelectorAll('.event-card').forEach((card) => {
      card.addEventListener('click', () => {
        const timeId = card.dataset.time;
        const eq = this.state.earthquakes.find((e) => e.origintimeutc === timeId);
        if (eq) {
          this.handleEventSelect(eq, card);
        }
      });
    });
  }

  handleEventSelect(eq, cardElement = null) {
    this.state.selectedEvent = eq;

    // Highlight active card
    document.querySelectorAll('.event-card').forEach((c) => c.classList.remove('active'));
    if (cardElement) {
      cardElement.classList.add('active');
    } else {
      const matchingCard = document.querySelector(`.event-card[data-time="${eq.origintimeutc}"]`);
      if (matchingCard) {
        matchingCard.classList.add('active');
        matchingCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }

    this.mapEngine.focusEarthquake(eq);
  }

  handleMarkerClick(eq) {
    this.handleEventSelect(eq);
  }

  async handleSync() {
    const syncBtn = document.getElementById('btn-sync');
    const originalText = syncBtn.innerHTML;
    syncBtn.disabled = true;
    syncBtn.innerHTML = '<span>⏳ Syncing...</span>';

    try {
      const result = await triggerManualSync();
      await this.refreshAll();
      alert(`Sync Complete!\nFetched: ${result.fetched} records\nNewly added: ${result.inserted}`);
    } catch (err) {
      alert(`Sync Error: ${err.message}`);
    } finally {
      syncBtn.disabled = false;
      syncBtn.innerHTML = originalText;
    }
  }

  renderModalTable() {
    const tbody = document.getElementById('table-body');
    if (!tbody) return;

    tbody.innerHTML = this.state.earthquakes
      .slice(0, 300)
      .map((eq) => {
        const mag = parseFloat(eq.magnitude) || 0;
        const color = getMagnitudeColor(mag);
        return `
          <tr>
            <td class="mono">${eq.eventtime || eq.origintimeutc}</td>
            <td><span class="badge" style="background: ${color}; color: #fff;">${mag.toFixed(1)} ${eq.magtype}</span></td>
            <td><strong>${eq.region}</strong></td>
            <td class="mono">${parseFloat(eq.depthkm).toFixed(1)} km</td>
            <td class="mono">${parseFloat(eq.latitude).toFixed(3)}°</td>
            <td class="mono">${parseFloat(eq.longitude).toFixed(3)}°</td>
            <td>${eq.measmethod || 'RETMC'}</td>
          </tr>
        `;
      })
      .join('');
  }

  exportCsv() {
    if (!this.state.earthquakes.length) return alert('No data to export.');
    const headers = ['OriginTimeUTC', 'EventTimeTRT', 'Magnitude', 'MagType', 'Latitude', 'Longitude', 'DepthKm', 'Region', 'Method'];
    const rows = this.state.earthquakes.map((eq) => [
      `"${eq.origintimeutc}"`,
      `"${eq.eventtime || ''}"`,
      eq.magnitude,
      `"${eq.magtype || ''}"`,
      eq.latitude,
      eq.longitude,
      eq.depthkm,
      `"${(eq.region || '').replace(/"/g, '""')}"`,
      `"${eq.measmethod || ''}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `temas_earthquakes_${new Date().toISOString().substring(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  exportGeoJson() {
    if (!this.state.earthquakes.length) return alert('No data to export.');
    const geojson = {
      type: 'FeatureCollection',
      features: this.state.earthquakes.map((eq) => ({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [parseFloat(eq.longitude), parseFloat(eq.latitude)]
        },
        properties: {
          magnitude: parseFloat(eq.magnitude),
          magtype: eq.magtype,
          origintimeutc: eq.origintimeutc,
          eventtime: eq.eventtime,
          depthkm: parseFloat(eq.depthkm),
          region: eq.region
        }
      }))
    };

    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(geojson, null, 2));
    const link = document.createElement('a');
    link.setAttribute('href', dataStr);
    link.setAttribute('download', `temas_earthquakes_${new Date().toISOString().substring(0, 10)}.geojson`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}

// Boot application
window.addEventListener('DOMContentLoaded', () => {
  window.app = new TemasApp();
});
