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

    // Make Floating Controls Mobile & Draggable
    const layerControlsBox = document.getElementById('layer-controls');
    const layerDragHandle = document.getElementById('layer-drag-handle');
    this.initDraggable(layerControlsBox, layerDragHandle);

    const legendBox = document.getElementById('map-legend');
    const legendDragHandle = document.getElementById('legend-drag-handle');
    this.initDraggable(legendBox, legendDragHandle);

    const filterBar = document.getElementById('filter-bar');
    const filterDragHandle = document.getElementById('filter-drag-handle');
    this.initDraggable(filterBar, filterDragHandle);

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
        setTimeout(() => this.mapEngine?.invalidateMapSize(true), 150);
        setTimeout(() => this.mapEngine?.invalidateMapSize(true), 350);
      });
    }

    // Frontpage Map Snapshot (Camera button)
    const mapSnapshotBtn = document.getElementById('btn-map-snapshot');
    if (mapSnapshotBtn) {
      mapSnapshotBtn.addEventListener('click', () => this.captureFrontpageSnapshot());
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

    const exportPdfBtn = document.getElementById('btn-export-analytics-pdf');
    if (exportPdfBtn) exportPdfBtn.addEventListener('click', () => this.exportAnalyticsPdf());

    const exportPngBtn = document.getElementById('btn-export-analytics-png');
    if (exportPngBtn) exportPngBtn.addEventListener('click', () => this.exportAnalyticsPng());
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
          setTimeout(() => this.mapEngine?.invalidateMapSize(true), 120);
          setTimeout(() => this.mapEngine?.invalidateMapSize(true), 360);
        }
      }, IDLE_TIMEOUT_MS);
    };

    const wakeSidebar = () => {
      sidebar.classList.remove('auto-hidden', 'hover-peek');
      if (hoverZone) hoverZone.classList.add('hidden');
      resetIdleTimer();
      setTimeout(() => this.mapEngine?.invalidateMapSize(true), 120);
      setTimeout(() => this.mapEngine?.invalidateMapSize(true), 360);
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
          setTimeout(() => this.mapEngine?.invalidateMapSize(true), 120);
          setTimeout(() => this.mapEngine?.invalidateMapSize(true), 360);
        }
        resetIdleTimer();
      });
    }

    // Interacting with the feed also refreshes idle status
    const feedList = document.getElementById('feed-list');
    if (feedList) {
      feedList.addEventListener('click', () => resetIdleTimer());
    }

    // Auto-hidden by default on initial load (hover to reveal)
    sidebar.classList.add('auto-hidden');
    if (hoverZone) hoverZone.classList.remove('hidden');
    setTimeout(() => this.mapEngine?.invalidateMapSize(true), 150);

    // Arm initial 30s idle countdown
    resetIdleTimer();
  }

  /**
   * Makes floating elements smoothly draggable across the viewport (mouse and touch),
   * constrained within parent boundaries without jumping or disappearing offscreen.
   */
  initDraggable(element, handle) {
    if (!element || !handle) return;

    // Prevent Leaflet map from capturing drag and scroll events on the floating widget
    if (window.L && window.L.DomEvent) {
      window.L.DomEvent.disableClickPropagation(element);
      window.L.DomEvent.disableScrollPropagation(element);
    }

    let isDragging = false;
    let startX = 0;
    let startY = 0;
    let initialLeft = 0;
    let initialTop = 0;

    const onPointerDown = (e) => {
      // Ignore clicks on form inputs, buttons, or checkboxes
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON' || e.target.closest('label')) return;

      e.stopPropagation();

      isDragging = true;
      const clientX = e.type.startsWith('touch') ? e.touches[0].clientX : e.clientX;
      const clientY = e.type.startsWith('touch') ? e.touches[0].clientY : e.clientY;

      startX = clientX;
      startY = clientY;

      // Calculate initial position relative to offsetParent (NOT window viewport)
      const parentRect = element.offsetParent ? element.offsetParent.getBoundingClientRect() : { left: 0, top: 0 };
      const elRect = element.getBoundingClientRect();
      initialLeft = elRect.left - parentRect.left;
      initialTop = elRect.top - parentRect.top;

      // Clear right, bottom, and transform styling so absolute left/top take effect seamlessly
      element.style.right = 'auto';
      element.style.bottom = 'auto';
      element.style.transform = 'none';
      element.style.left = `${initialLeft}px`;
      element.style.top = `${initialTop}px`;
      element.classList.add('dragging');

      const onPointerMove = (moveEvent) => {
        if (!isDragging) return;
        if (moveEvent.cancelable && moveEvent.type.startsWith('touch')) {
          moveEvent.preventDefault();
        }

        const curX = moveEvent.type.startsWith('touch') ? moveEvent.touches[0].clientX : moveEvent.clientX;
        const curY = moveEvent.type.startsWith('touch') ? moveEvent.touches[0].clientY : moveEvent.clientY;

        const dx = curX - startX;
        const dy = curY - startY;

        let newLeft = initialLeft + dx;
        let newTop = initialTop + dy;

        const pWidth = element.offsetParent ? element.offsetParent.clientWidth : window.innerWidth;
        const pHeight = element.offsetParent ? element.offsetParent.clientHeight : window.innerHeight;
        const maxLeft = pWidth - elRect.width - 8;
        const maxTop = pHeight - elRect.height - 8;

        newLeft = Math.max(8, Math.min(newLeft, maxLeft));
        newTop = Math.max(8, Math.min(newTop, maxTop));

        element.style.left = `${newLeft}px`;
        element.style.top = `${newTop}px`;
      };

      const onPointerUp = () => {
        if (!isDragging) return;
        isDragging = false;
        element.classList.remove('dragging');
        document.removeEventListener('mousemove', onPointerMove);
        document.removeEventListener('mouseup', onPointerUp);
        document.removeEventListener('touchmove', onPointerMove);
        document.removeEventListener('touchend', onPointerUp);
      };

      document.addEventListener('mousemove', onPointerMove);
      document.addEventListener('mouseup', onPointerUp);
      document.addEventListener('touchmove', onPointerMove, { passive: false });
      document.addEventListener('touchend', onPointerUp);
    };

    handle.addEventListener('mousedown', onPointerDown);
    handle.addEventListener('touchstart', onPointerDown, { passive: true });
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
    const regionChart = document.getElementById('analytics-region-chart');
    const sourceChart = document.getElementById('analytics-source-chart');
    const badgeTotal = document.getElementById('analytics-total-quakes');
    const badgeDepth = document.getElementById('analytics-avg-depth');

    if (!magChart || !depthSummary) return;

    if (badgeTotal) badgeTotal.textContent = `${quakes.length} Catalog Events`;

    // Magnitude bins (Gutenberg-Richter Log Spectrum)
    const bins = {
      '< 3.0 (Minor)': { count: 0, color: '#10b981' },
      '3.0–3.9 (Light)': { count: 0, color: '#38bdf8' },
      '4.0–4.9 (Moderate)': { count: 0, color: '#f59e0b' },
      '5.0–5.9 (Strong)': { count: 0, color: '#f97316' },
      '6.0–6.9 (Major)': { count: 0, color: '#ef4444' },
      '≥ 7.0 (Great)': { count: 0, color: '#ec4899' }
    };

    let shallow = 0; // < 10 km
    let intermediate = 0; // 10 - 30 km
    let deep = 0; // > 30 km
    let totalDepth = 0;

    const regionCounts = {};
    const sourceCounts = {
      'KOERI (Local)': { count: 0, color: '#38bdf8' },
      'EMSC (Euro-Med)': { count: 0, color: '#f59e0b' },
      'USGS (Global)': { count: 0, color: '#10b981' },
      'Historical / Other': { count: 0, color: '#a855f7' }
    };

    quakes.forEach((eq) => {
      const mag = parseFloat(eq.magnitude) || 0;
      const d = parseFloat(eq.depthkm) || 0;
      totalDepth += d;

      if (mag < 3.0) bins['< 3.0 (Minor)'].count++;
      else if (mag < 4.0) bins['3.0–3.9 (Light)'].count++;
      else if (mag < 5.0) bins['4.0–4.9 (Moderate)'].count++;
      else if (mag < 6.0) bins['5.0–5.9 (Strong)'].count++;
      else if (mag < 7.0) bins['6.0–6.9 (Major)'].count++;
      else bins['≥ 7.0 (Great)'].count++;

      if (d < 10) shallow++;
      else if (d <= 30) intermediate++;
      else deep++;

      // Region aggregation
      const reg = (eq.region || 'Unknown Region').trim();
      regionCounts[reg] = (regionCounts[reg] || 0) + 1;

      // Source aggregation
      const src = (eq.measmethod || '').toUpperCase();
      if (src.includes('KOERI')) sourceCounts['KOERI (Local)'].count++;
      else if (src.includes('EMSC')) sourceCounts['EMSC (Euro-Med)'].count++;
      else if (src.includes('USGS')) sourceCounts['USGS (Global)'].count++;
      else sourceCounts['Historical / Other'].count++;
    });

    const avgDepth = quakes.length ? (totalDepth / quakes.length).toFixed(1) : '0';
    if (badgeDepth) badgeDepth.textContent = `Mean Hypocenter: ${avgDepth} km`;

    // 1. Magnitude Chart
    const maxCount = Math.max(1, ...Object.values(bins).map((b) => b.count));
    magChart.innerHTML = Object.entries(bins)
      .map(([label, data]) => {
        const pct = Math.round((data.count / maxCount) * 100);
        const share = Math.round((data.count / (quakes.length || 1)) * 100);
        return `
          <div class="chart-bar-row">
            <span class="chart-bar-label">${label}</span>
            <div class="chart-bar-track">
              <div class="chart-bar-fill" style="width: ${pct}%; background: ${data.color}"></div>
            </div>
            <span class="chart-bar-count">${data.count} <span style="font-size: 0.72rem; color: var(--text-muted);">(${share}%)</span></span>
          </div>
        `;
      })
      .join('');

    // 2. Depth Summary
    depthSummary.innerHTML = `
      <div class="depth-stat-row">
        <span>Shallow Crustal (&lt; 10 km) — High Surface Shaking Hazard</span>
        <strong style="color: #ef4444">${shallow} events (${Math.round((shallow / (quakes.length || 1)) * 100)}%)</strong>
      </div>
      <div class="depth-stat-row">
        <span>Intermediate Depth (10 – 30 km) — Seismogenic Zone</span>
        <strong style="color: #f59e0b">${intermediate} events (${Math.round((intermediate / (quakes.length || 1)) * 100)}%)</strong>
      </div>
      <div class="depth-stat-row">
        <span>Deep Subduction / Lithospheric (&gt; 30 km)</span>
        <strong style="color: #38bdf8">${deep} events (${Math.round((deep / (quakes.length || 1)) * 100)}%)</strong>
      </div>
      <div class="depth-stat-row" style="background: rgba(56, 189, 248, 0.05); border-color: rgba(56, 189, 248, 0.2);">
        <span>Catalog Mean Focal Depth</span>
        <strong style="color: #38bdf8">${avgDepth} km depth</strong>
      </div>
    `;

    // 3. Top Active Regions
    if (regionChart) {
      const topRegions = Object.entries(regionCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);
      const maxRegion = topRegions[0] ? topRegions[0][1] : 1;

      regionChart.innerHTML = topRegions.length
        ? topRegions
            .map(([rName, rCount]) => {
              const rPct = Math.round((rCount / maxRegion) * 100);
              return `
                <div class="region-row">
                  <span class="region-name" title="${rName}">${rName}</span>
                  <div class="region-bar-wrap">
                    <div class="region-bar-track">
                      <div class="region-bar-fill" style="width: ${rPct}%;"></div>
                    </div>
                  </div>
                  <span class="region-count">${rCount}</span>
                </div>
              `;
            })
            .join('')
        : '<p style="color: var(--text-muted); font-size: 0.8rem;">No regional data available.</p>';
    }

    // 4. Source Breakdown
    if (sourceChart) {
      sourceChart.innerHTML = Object.entries(sourceCounts)
        .map(([sName, sData]) => {
          const sShare = Math.round((sData.count / (quakes.length || 1)) * 100);
          return `
            <div class="source-row">
              <div class="source-info">
                <span class="source-dot" style="background: ${sData.color};"></span>
                <span class="source-name">${sName}</span>
              </div>
              <span class="source-count">${sData.count} <span style="font-size: 0.75rem; color: var(--text-muted); font-weight: normal;">(${sShare}%)</span></span>
            </div>
          `;
        })
        .join('');
    }
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
        const sourceLabel = (eq.measmethod || 'KOERI').toUpperCase().split('-')[0];

        return `
          <div class="event-card" data-time="${eq.origintimeutc}" style="--card-severity-color: ${color}">
            <div class="mag-pill" style="background: ${color}">
              <span>${mag.toFixed(1)}</span>
              <small>${eq.magtype || 'ML'}</small>
            </div>
            <div class="event-details">
              <div class="event-region" title="${eq.region}">${eq.region}</div>
              <div class="event-meta">
                <span class="event-meta-pill"><span style="opacity: 0.65;">⏱</span> ${timeDisplay}</span>
                <span class="event-meta-pill"><span style="opacity: 0.65;">⬇</span> ${eq.depthkm} km</span>
                <span class="event-meta-pill source-tag">${sourceLabel}</span>
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
      toast.className = 'toast public-toast';
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
      const dedupPart = result.deduplicated && result.deduplicated > 0
        ? `, Purged ${result.deduplicated} duplicates`
        : ' (0 duplicates)';
      this.showToast(`Sync Complete! Fetched: ${result.fetched}, Newly added: ${result.inserted}${dedupPart}`, 'success');
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

  /**
   * Triggers single-page printable PDF bulletin generation via tailored print styles.
   */
  exportAnalyticsPdf() {
    this.showToast('Preparing 1-Page Printable PDF Bulletin...', 'info');
    setTimeout(() => {
      window.print();
    }, 300);
  }

  /**
   * Captures high-resolution PNG snapshot auto-fitted into 1-page A4/Letter Landscape
   * rendered in a crisp, executive white publication bulletin format.
   */
  async exportAnalyticsPng() {
    const dialog = document.querySelector('.modal-analytics-dialog');
    if (!dialog) return;

    if (typeof window.html2canvas === 'undefined') {
      return this.showToast('Snapshot engine is still initializing, please retry in a second.', 'warning');
    }

    this.showToast('Rendering 1-Page White A4/Letter Bulletin (2x Retina)...', 'info');

    // 1. Clone the dialog into an isolated sandbox to prevent viewport clipping and theme contamination
    const clone = dialog.cloneNode(true);
    clone.classList.remove('modal-dialog', 'modal-analytics-dialog');
    clone.classList.add('export-a4-snapshot');

    // Remove buttons from the header in the snapshot
    const headerActions = clone.querySelector('.analytics-header-actions');
    if (headerActions) headerActions.remove();

    // Add an official bulletin footer
    const nowTrt = new Date().toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' });
    const footer = document.createElement('div');
    footer.className = 'bulletin-footer';
    footer.innerHTML = `
      <span>TEMAS 2 &bull; Türkiye Earthquake Monitoring &amp; Analytics System</span>
      <span>Official Seismic Bulletin &bull; Generated: ${nowTrt} (TRT)</span>
      <span>Standard A4 / US Letter Landscape &bull; 2828&times;2000 Ultra-HD</span>
    `;
    clone.appendChild(footer);

    // 2. Wrap in an isolated export container
    const sandbox = document.createElement('div');
    sandbox.id = 'snapshot-sandbox';
    sandbox.style.cssText = `
      position: fixed;
      left: -99999px;
      top: 0;
      width: 1414px;
      height: 1000px;
      margin: 0;
      padding: 0;
      overflow: hidden;
      background: #ffffff;
      z-index: -9999;
    `;
    sandbox.appendChild(clone);
    document.body.appendChild(sandbox);

    try {
      const canvas = await window.html2canvas(clone, {
        width: 1414,
        height: 1000,
        scale: 2, // 2828x2000px high-DPI output
        backgroundColor: '#ffffff',
        useCORS: true,
        logging: false
      });

      const link = document.createElement('a');
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
      link.download = `TEMAS2_Seismic_Bulletin_${timestamp}.png`;
      link.href = canvas.toDataURL('image/png');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      this.showToast('📸 1-Page White A4/Letter Landscape PNG exported successfully!', 'success');
    } catch (err) {
      console.error('PNG export failed:', err);
      this.showToast(`PNG export error: ${err.message}`, 'error');
    } finally {
      if (sandbox && sandbox.parentNode) {
        sandbox.parentNode.removeChild(sandbox);
      }
    }
  }

  /**
   * Captures a high-resolution PNG snapshot of the active frontpage
   * including live earthquakes, fault lines, provinces, and telemetry widgets.
   */
  async captureFrontpageSnapshot() {
    if (typeof window.html2canvas === 'undefined') {
      return this.showToast('Snapshot engine is still initializing, please retry in a second.', 'warning');
    }

    const snapBtn = document.getElementById('btn-map-snapshot');
    if (snapBtn) snapBtn.classList.add('active');

    // Immediately hide any currently visible toast so it never appears in the frame
    const existingToast = document.getElementById('public-toast');
    if (existingToast) {
      existingToast.style.opacity = '0';
      existingToast.style.display = 'none';
    }

    try {
      // Brief pause to allow any pending UI transitions to settle
      await new Promise((r) => setTimeout(r, 120));

      const target = document.body;
      const canvas = await window.html2canvas(target, {
        scale: 2, // High-DPI 2x Retina output
        backgroundColor: '#090d16',
        useCORS: true,
        allowTaint: false,
        logging: false,
        onclone: (clonedDoc) => {
          // 1. Strictly remove all toast notifications and modals from the cloned snapshot DOM
          const pToast = clonedDoc.getElementById('public-toast');
          if (pToast) pToast.remove();
          clonedDoc.querySelectorAll('.toast, .public-toast, #public-toast, #toast-container, #toastContainer').forEach((t) => t.remove());

          // 2. Ensure brand title text renders without any background box artifacts
          const brandH1 = clonedDoc.querySelector('.brand-text h1');
          if (brandH1) {
            brandH1.style.background = 'none';
            brandH1.style.webkitBackgroundClip = 'initial';
            brandH1.style.backgroundClip = 'initial';
            brandH1.style.webkitTextFillColor = 'initial';
            brandH1.style.color = '#ffffff';
          }

          // 3. Replace timeline scrubber range input with a crisp vector track and thumb
          const clonedScrubber = clonedDoc.getElementById('timeline-scrubber');
          if (clonedScrubber) {
            const val = Number(clonedScrubber.value) || 0;
            const max = Number(clonedScrubber.max) || 100;
            const pct = Math.min(100, Math.max(0, (val / max) * 100));

            const trackWrapper = clonedDoc.createElement('div');
            trackWrapper.style.cssText = 'flex: 1; height: 6px; background: rgba(255, 255, 255, 0.18); border-radius: 3px; position: relative; display: flex; align-items: center; margin: 0 4px;';

            const fillBar = clonedDoc.createElement('div');
            fillBar.style.cssText = `position: absolute; left: 0; top: 0; height: 100%; width: ${pct}%; background: #38bdf8; border-radius: 3px;`;

            const thumb = clonedDoc.createElement('div');
            thumb.style.cssText = `position: absolute; left: calc(${pct}% - 7px); width: 14px; height: 14px; background: #ffffff; border: 2.5px solid #38bdf8; border-radius: 50%; box-shadow: 0 0 6px rgba(56, 189, 248, 0.8);`;

            trackWrapper.appendChild(fillBar);
            trackWrapper.appendChild(thumb);
            clonedScrubber.parentNode.replaceChild(trackWrapper, clonedScrubber);
          }

          // 4. Replace magnitude filter range slider with a crisp vector track and thumb
          const clonedMag = clonedDoc.getElementById('mag-filter');
          if (clonedMag) {
            const val = Number(clonedMag.value) || 3.0;
            const min = Number(clonedMag.min) || 0;
            const max = Number(clonedMag.max) || 7;
            const pct = Math.min(100, Math.max(0, ((val - min) / (max - min)) * 100));

            const trackWrapper = clonedDoc.createElement('div');
            trackWrapper.style.cssText = 'width: 90px; height: 6px; background: rgba(255, 255, 255, 0.18); border-radius: 3px; position: relative; display: flex; align-items: center;';

            const fillBar = clonedDoc.createElement('div');
            fillBar.style.cssText = `position: absolute; left: 0; top: 0; height: 100%; width: ${pct}%; background: #ef4444; border-radius: 3px;`;

            const thumb = clonedDoc.createElement('div');
            thumb.style.cssText = `position: absolute; left: calc(${pct}% - 7px); width: 14px; height: 14px; background: #ffffff; border: 2.5px solid #ef4444; border-radius: 50%; box-shadow: 0 0 6px rgba(239, 68, 68, 0.8);`;

            trackWrapper.appendChild(fillBar);
            trackWrapper.appendChild(thumb);
            clonedMag.parentNode.replaceChild(trackWrapper, clonedMag);
          }

          // 5. Replace playback speed select with a sleek, compact badge
          const clonedSpeed = clonedDoc.getElementById('playback-speed');
          if (clonedSpeed) {
            const selectedText = clonedSpeed.options[clonedSpeed.selectedIndex]?.text || '5x Speed';
            const badge = clonedDoc.createElement('div');
            badge.style.cssText = 'background: rgba(255, 255, 255, 0.06); border: 1px solid rgba(255, 255, 255, 0.15); color: #cbd5e1; border-radius: 4px; padding: 2px 7px; font-size: 0.68rem; font-family: inherit; font-weight: 500; white-space: nowrap; display: flex; align-items: center; gap: 4px;';
            badge.innerHTML = `<span>${selectedText}</span><span style="font-size: 0.48rem; opacity: 0.7;">▼</span>`;
            clonedSpeed.parentNode.replaceChild(badge, clonedSpeed);
          }
        },
        ignoreElements: (el) => {
          // Strictly exclude toasts, modals, tooltips, or edge hover triggers
          if (
            el.id === 'public-toast' ||
            el.id === 'toast-container' ||
            el.id === 'toastContainer' ||
            (el.classList && (
              el.classList.contains('toast') ||
              el.classList.contains('public-toast') ||
              el.classList.contains('modal-backdrop') ||
              el.classList.contains('sidebar-hover-zone')
            ))
          ) {
            return true;
          }
          return false;
        }
      });

      const link = document.createElement('a');
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
      link.download = `TEMAS2_Frontpage_Snapshot_${timestamp}.png`;
      link.href = canvas.toDataURL('image/png');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      this.showToast('📸 Frontpage snapshot saved successfully!', 'success');
    } catch (err) {
      console.error('Frontpage snapshot failed:', err);
      this.showToast(`Snapshot error: ${err.message}`, 'error');
    } finally {
      if (snapBtn) snapBtn.classList.remove('active');
    }
  }
}

// Boot application
window.addEventListener('DOMContentLoaded', () => {
  window.app = new TemasApp();
});
