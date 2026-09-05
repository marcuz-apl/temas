/**
 * TEMAS 2.0 - Main Application Controller
 */

import { fetchEarthquakes, fetchStats, fetchTectonicBoundaries, fetchProvinceBoundaries, triggerManualSync } from './api.js';
import { TemasMap, getMagnitudeColor } from './map.js';

class TemasApp {
  constructor() {
    this.state = {
      earthquakes: [],
      sortedChronological: [],
      stats: null,
      selectedEvent: null,
      filters: {
        min_magnitude: 3.0,
        preset: 'all',
        region: '',
        limit: 1500
      },
      playback: {
        isPlaying: false,
        timer: null,
        currentIndex: 0,
        speed: 5
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

    // Load Turkish province boundaries
    fetchProvinceBoundaries()
      .then((geojson) => this.mapEngine.loadProvinceBoundaries(geojson))
      .catch((err) => console.warn('Could not load province boundaries:', err));

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
        this.stopPlayback();
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

    // Layer Toggles
    const faultToggle = document.getElementById('toggle-faults');
    if (faultToggle) {
      faultToggle.addEventListener('change', (e) => this.mapEngine.setTectonicVisibility(e.target.checked));
    }

    const provToggle = document.getElementById('toggle-provinces');
    if (provToggle) {
      provToggle.addEventListener('change', (e) => this.mapEngine.setProvinceVisibility(e.target.checked));
    }

    const heatToggle = document.getElementById('toggle-heatmap');
    if (heatToggle) {
      heatToggle.addEventListener('change', (e) => this.mapEngine.setHeatmapVisibility(e.target.checked));
    }

    // Reset Map View
    const resetMapBtn = document.getElementById('btn-reset-map');
    if (resetMapBtn) {
      resetMapBtn.addEventListener('click', () => this.mapEngine.resetView());
    }

    // Timeline Playback Controls
    const playBtn = document.getElementById('btn-playback-toggle');
    if (playBtn) {
      playBtn.addEventListener('click', () => this.togglePlayback());
    }

    const scrubber = document.getElementById('timeline-scrubber');
    if (scrubber) {
      scrubber.addEventListener('input', (e) => {
        const percent = parseInt(e.target.value, 10);
        this.setPlaybackProgress(percent);
      });
    }

    const speedSelect = document.getElementById('playback-speed');
    if (speedSelect) {
      speedSelect.addEventListener('change', (e) => {
        this.state.playback.speed = parseInt(e.target.value, 10);
        if (this.state.playback.isPlaying) {
          this.stopPlayback();
          this.startPlayback();
        }
      });
    }

    // Sidebar Collapse / Expand Toggle & 30s Idle Auto-Hide
    const sidebarToggle = document.getElementById('btn-toggle-sidebar');
    const sidebar = document.querySelector('.sidebar');
    this.initSidebarAutoHide(sidebar, sidebarToggle);

    // Fullscreen Toggle
    const fsBtn = document.getElementById('btn-fullscreen');
    if (fsBtn) {
      fsBtn.addEventListener('click', () => {
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen().catch(() => {});
          fsBtn.textContent = '⤦';
        } else {
          document.exitFullscreen().catch(() => {});
          fsBtn.textContent = '⛶';
        }
      });
    }

    // Seismic Audio Alerts Toggle
    const audioBtn = document.getElementById('btn-toggle-audio');
    const audioIcon = document.getElementById('audio-icon');
    if (audioBtn) {
      audioBtn.addEventListener('click', () => {
        this.state.audioEnabled = !this.state.audioEnabled;
        if (this.state.audioEnabled) {
          audioIcon.textContent = '🔊 Audio';
          this.playSeismicTone(5.0);
        } else {
          audioIcon.textContent = '🔇 Audio';
        }
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

    // Analytics Modal
    const analyticsBtn = document.getElementById('btn-analytics');
    const analyticsModal = document.getElementById('analytics-modal');
    const closeAnalyticsBtn = document.getElementById('btn-close-analytics');

    if (analyticsBtn && analyticsModal) {
      analyticsBtn.addEventListener('click', () => {
        this.renderAnalytics();
        analyticsModal.classList.add('open');
      });
    }

    if (closeAnalyticsBtn && analyticsModal) {
      closeAnalyticsBtn.addEventListener('click', () => analyticsModal.classList.remove('open'));
      analyticsModal.addEventListener('click', (e) => {
        if (e.target === analyticsModal) analyticsModal.classList.remove('open');
      });
    }

    // Export Buttons
    const exportCsvBtn = document.getElementById('btn-export-csv');
    if (exportCsvBtn) exportCsvBtn.addEventListener('click', () => this.exportCsv());

    const exportGeoJsonBtn = document.getElementById('btn-export-geojson');
    if (exportGeoJsonBtn) exportGeoJsonBtn.addEventListener('click', () => this.exportGeoJson());
  }

  /**
   * Initializes 30-second idle auto-hiding of the left sidebar with
   * edge-hover slide out / peek behavior.
   */
  initSidebarAutoHide(sidebar, sidebarToggle) {
    if (!sidebar) return;

    let idleTimer = null;
    let hoverLeaveTimer = null;
    let isHoveringSidebar = false;
    const IDLE_TIMEOUT_MS = 30000; // 30 seconds

    const hoverZone = document.getElementById('sidebar-hover-zone');

    const resetIdleTimer = () => {
      if (idleTimer) clearTimeout(idleTimer);

      idleTimer = setTimeout(() => {
        if (!isHoveringSidebar && !sidebar.classList.contains('collapsed')) {
          sidebar.classList.add('auto-hidden');
          if (hoverZone) hoverZone.classList.remove('hidden');
          setTimeout(() => this.mapEngine?.map?.invalidateSize(), 350);
        }
      }, IDLE_TIMEOUT_MS);
    };

    const wakeSidebar = () => {
      sidebar.classList.remove('auto-hidden', 'hover-peek');
      if (hoverZone) hoverZone.classList.add('hidden');
      resetIdleTimer();
      setTimeout(() => this.mapEngine?.map?.invalidateSize(), 350);
    };

    // User activity anywhere in the window resets the 30s idle timer
    ['mousemove', 'mousedown', 'keydown', 'touchstart', 'wheel', 'scroll'].forEach((evt) => {
      window.addEventListener(evt, resetIdleTimer, { passive: true });
    });

    // Hovering the left edge zone peeks the sidebar back out smoothly
    if (hoverZone) {
      hoverZone.addEventListener('mouseenter', () => {
        if (hoverLeaveTimer) clearTimeout(hoverLeaveTimer);
        sidebar.classList.add('hover-peek');
      });
      hoverZone.addEventListener('click', wakeSidebar);
    }

    // Hovering the sidebar keeps it open and prevents auto-hiding while reading
    sidebar.addEventListener('mouseenter', () => {
      isHoveringSidebar = true;
      if (hoverLeaveTimer) clearTimeout(hoverLeaveTimer);
      if (sidebar.classList.contains('auto-hidden')) {
        sidebar.classList.add('hover-peek');
      }
    });

    // Leaving the sidebar resets timer and re-hides if in auto-hidden mode
    sidebar.addEventListener('mouseleave', () => {
      isHoveringSidebar = false;
      if (sidebar.classList.contains('auto-hidden')) {
        hoverLeaveTimer = setTimeout(() => {
          sidebar.classList.remove('hover-peek');
        }, 350);
      }
      resetIdleTimer();
    });

    // Toggle button still works manually to collapse or wake
    if (sidebarToggle) {
      sidebarToggle.addEventListener('click', () => {
        if (sidebar.classList.contains('auto-hidden')) {
          wakeSidebar();
        } else {
          sidebar.classList.toggle('collapsed');
          if (sidebar.classList.contains('collapsed') && hoverZone) {
            hoverZone.classList.add('hidden');
          }
          setTimeout(() => this.mapEngine?.map?.invalidateSize(), 350);
        }
        resetIdleTimer();
      });
    }

    // Interacting with the feed also refreshes idle status
    const feedList = document.getElementById('feed-list');
    if (feedList) {
      feedList.addEventListener('click', () => resetIdleTimer());
    }

    // Arm initial 30s idle countdown
    resetIdleTimer();
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
      // Chronologically sorted for playback
      this.state.sortedChronological = [...this.state.earthquakes].sort(
        (a, b) => a.origintimeutc.localeCompare(b.origintimeutc)
      );

      this.renderFeed(this.state.earthquakes);
      this.mapEngine.renderEarthquakes(this.state.earthquakes);

      const countEl = document.getElementById('feed-count');
      if (countEl) countEl.textContent = `${this.state.earthquakes.length} Events`;

      // Reset scrubber to 100%
      const scrubber = document.getElementById('timeline-scrubber');
      const dateDisplay = document.getElementById('timeline-date-display');
      if (scrubber) scrubber.value = 100;
      if (dateDisplay) dateDisplay.textContent = 'All Records Visible';
    } catch (err) {
      console.error('Failed loading earthquakes:', err);
    }
  }

  /* ==========================================================================
     Timeline Playback Engine
     ========================================================================== */
  togglePlayback() {
    if (this.state.playback.isPlaying) {
      this.stopPlayback();
    } else {
      this.startPlayback();
    }
  }

  startPlayback() {
    if (!this.state.sortedChronological.length) return;
    this.state.playback.isPlaying = true;
    const playIcon = document.getElementById('playback-icon');
    const playLabel = document.getElementById('playback-label');
    if (playIcon) playIcon.textContent = '⏸';
    if (playLabel) playLabel.textContent = 'Pause';

    const scrubber = document.getElementById('timeline-scrubber');
    if (scrubber && parseInt(scrubber.value, 10) >= 100) {
      scrubber.value = 0;
      this.state.playback.currentIndex = 0;
    }

    const intervalMs = Math.max(40, 500 / this.state.playback.speed);

    this.state.playback.timer = setInterval(() => {
      const total = this.state.sortedChronological.length;
      if (this.state.playback.currentIndex >= total - 1) {
        this.stopPlayback();
        return;
      }

      this.state.playback.currentIndex += Math.max(1, Math.floor(total / 100));
      if (this.state.playback.currentIndex >= total) {
        this.state.playback.currentIndex = total - 1;
      }

      const percent = Math.floor((this.state.playback.currentIndex / (total - 1)) * 100);
      if (scrubber) scrubber.value = percent;
      this.renderPlaybackFrame();
    }, intervalMs);
  }

  stopPlayback() {
    this.state.playback.isPlaying = false;
    clearInterval(this.state.playback.timer);
    const playIcon = document.getElementById('playback-icon');
    const playLabel = document.getElementById('playback-label');
    if (playIcon) playIcon.textContent = '▶';
    if (playLabel) playLabel.textContent = 'Play';
  }

  setPlaybackProgress(percent) {
    const total = this.state.sortedChronological.length;
    if (!total) return;
    this.state.playback.currentIndex = Math.floor((percent / 100) * (total - 1));
    this.renderPlaybackFrame();
  }

  renderPlaybackFrame() {
    const total = this.state.sortedChronological.length;
    if (!total) return;
    const currentEvent = this.state.sortedChronological[this.state.playback.currentIndex];
    if (!currentEvent) return;

    const maxTime = currentEvent.origintimeutc;
    this.mapEngine.renderEarthquakes(this.state.earthquakes, maxTime);

    const dateDisplay = document.getElementById('timeline-date-display');
    if (dateDisplay) {
      dateDisplay.textContent = `Date: ${(currentEvent.eventtime || currentEvent.origintimeutc).substring(0, 16)} TRT`;
    }
  }

  /* ==========================================================================
     Analytics Visualizations
     ========================================================================== */
  renderAnalytics() {
    const quakes = this.state.earthquakes;
    const magChart = document.getElementById('analytics-mag-chart');
    const depthSummary = document.getElementById('analytics-depth-summary');
    if (!magChart || !depthSummary) return;

    // Magnitude bins
    const bins = {
      '< 3.0': { count: 0, color: '#10b981' },
      '3.0–3.9': { count: 0, color: '#38bdf8' },
      '4.0–4.9': { count: 0, color: '#f59e0b' },
      '5.0–5.9': { count: 0, color: '#f97316' },
      '6.0–6.9': { count: 0, color: '#ef4444' },
      '≥ 7.0': { count: 0, color: '#ec4899' }
    };

    let shallow = 0; // < 10 km
    let intermediate = 0; // 10 - 30 km
    let deep = 0; // > 30 km

    quakes.forEach((eq) => {
      const mag = parseFloat(eq.magnitude) || 0;
      const d = parseFloat(eq.depthkm) || 0;

      if (mag < 3.0) bins['< 3.0'].count++;
      else if (mag < 4.0) bins['3.0–3.9'].count++;
      else if (mag < 5.0) bins['4.0–4.9'].count++;
      else if (mag < 6.0) bins['5.0–5.9'].count++;
      else if (mag < 7.0) bins['6.0–6.9'].count++;
      else bins['≥ 7.0'].count++;

      if (d < 10) shallow++;
      else if (d <= 30) intermediate++;
      else deep++;
    });

    const maxCount = Math.max(1, ...Object.values(bins).map((b) => b.count));

    magChart.innerHTML = Object.entries(bins)
      .map(([label, data]) => {
        const pct = Math.round((data.count / maxCount) * 100);
        return `
          <div class="chart-bar-row">
            <span class="chart-bar-label">${label}</span>
            <div class="chart-bar-track">
              <div class="chart-bar-fill" style="width: ${pct}%; background: ${data.color}"></div>
            </div>
            <span class="chart-bar-count">${data.count}</span>
          </div>
        `;
      })
      .join('');

    depthSummary.innerHTML = `
      <div class="depth-stat-row">
        <span>Shallow Focal Depth (&lt; 10 km)</span>
        <strong style="color: #ef4444">${shallow} events (${Math.round((shallow / (quakes.length || 1)) * 100)}%)</strong>
      </div>
      <div class="depth-stat-row">
        <span>Intermediate Depth (10 – 30 km)</span>
        <strong style="color: #f59e0b">${intermediate} events (${Math.round((intermediate / (quakes.length || 1)) * 100)}%)</strong>
      </div>
      <div class="depth-stat-row">
        <span>Deep Focal Depth (&gt; 30 km)</span>
        <strong style="color: #38bdf8">${deep} events (${Math.round((deep / (quakes.length || 1)) * 100)}%)</strong>
      </div>
    `;
  }

  /* ==========================================================================
     KPI & Feed Rendering
     ========================================================================== */
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
      .slice(0, 150)
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

    container.querySelectorAll('.event-card').forEach((card) => {
      card.addEventListener('click', () => {
        const timeId = card.dataset.time;
        const eq = this.state.earthquakes.find((e) => e.origintimeutc === timeId);
        if (eq) this.handleEventSelect(eq, card);
      });
    });
  }

  handleEventSelect(eq, cardElement = null) {
    this.state.selectedEvent = eq;
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
    this.playSeismicTone(eq.magnitude);
    this.mapEngine.focusEarthquake(eq);
  }

  playSeismicTone(mag) {
    if (!this.state.audioEnabled) return;
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const baseFreq = Math.max(55, 175 - (parseFloat(mag) * 15));
      osc.type = 'sine';
      osc.frequency.setValueAtTime(baseFreq, ctx.currentTime);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.45);
    } catch (e) {}
  }

  handleMarkerClick(eq) {
    this.handleEventSelect(eq);
  }

  showToast(msg, type = 'info') {
    let toast = document.getElementById('public-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'public-toast';
      toast.style.cssText = `
        position: fixed;
        bottom: 2rem;
        right: 2rem;
        z-index: 9999;
        background: rgba(13, 20, 36, 0.95);
        border: 1px solid rgba(56, 189, 248, 0.4);
        box-shadow: 0 10px 30px rgba(0,0,0,0.6), 0 0 20px rgba(56,189,248,0.25);
        backdrop-filter: blur(10px);
        color: #fff;
        padding: 0.9rem 1.25rem;
        border-radius: 8px;
        font-family: 'Outfit', sans-serif;
        font-size: 0.9rem;
        display: flex;
        align-items: center;
        gap: 0.65rem;
        transition: opacity 0.3s ease, transform 0.3s ease;
      `;
      document.body.appendChild(toast);
    }
    const icon = type === 'error' ? '❌' : (type === 'success' ? '✅' : '📡');
    toast.innerHTML = `<span>${icon}</span><span>${msg}</span>`;
    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0)';
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
    }, 4000);
  }

  async handleSync() {
    const syncBtn = document.getElementById('btn-sync');
    const originalText = syncBtn.innerHTML;
    syncBtn.disabled = true;
    syncBtn.innerHTML = '<span>⏳ Syncing...</span>';

    try {
      const result = await triggerManualSync();
      await this.refreshAll();
      this.showToast(`Sync Complete! Fetched: ${result.fetched}, Newly added: ${result.inserted} (M ≥ 2.0)`, 'success');
    } catch (err) {
      this.showToast(`Sync Error: ${err.message}`, 'error');
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
    if (!this.state.earthquakes.length) return this.showToast('No data to export.', 'warning');
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
    if (!this.state.earthquakes.length) return this.showToast('No data to export.', 'warning');
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
