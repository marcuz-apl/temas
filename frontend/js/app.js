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
        min_magnitude: 4.0,
        preset: '1y',
        region: '',
        limit: 20000
      },
      playback: {
        isPlaying: false,
        timer: null,
        currentIndex: 0,
        speed: 5
      },
      analyticsScope: 'archive'
    };

    this.fullCatalogCache = null;
    this.mapEngine = null;
    this._audioCtx = null;
    this._lastKnownNewestTime = null;
    this.init();
  }

  async init() {
    this.mapEngine = new TemasMap('map', (eq) => this.handleMarkerClick(eq));
    this.bindEvents();
    this.startRealtimeClock();
    this.startDatasetAutoRefresh();

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

    // Pre-warm multi-year catalog cache in background for instantaneous Analytics Deck
    setTimeout(() => this.fetchFullCatalogCache(), 1200);
  }

  bindEvents() {
    // Mobile Filter Header & Summary Sync
    const filterBar = document.getElementById('filter-bar');
    const filterMobileHeader = document.getElementById('filter-mobile-header');
    const filterSummary = document.getElementById('filter-mobile-summary');

    const updateFilterSummary = () => {
      if (!filterSummary) return;
      const activePreset = document.querySelector('.pill-btn.active')?.textContent || 'All';
      const magVal = document.getElementById('mag-val')?.textContent || 'M4.0+';
      filterSummary.textContent = `${activePreset} • ${magVal}`;
    };

    if (filterMobileHeader && filterBar) {
      this.initDraggable(filterBar, filterMobileHeader, () => {
        filterBar.classList.toggle('mobile-collapsed');
        updateFilterSummary();
      });
    }

    // Magnitude Slider
    const magSlider = document.getElementById('mag-slider');
    const magValue = document.getElementById('mag-val');
    if (magSlider && magValue) {
      magSlider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        magValue.textContent = `M${val.toFixed(1)}+`;
        this.state.filters.min_magnitude = val;
        updateFilterSummary();
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
        updateFilterSummary();
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

    // Make Floating Controls Mobile & Draggable (Docked at Lower-Left and Lower-Right)
    const layerControlsBox = document.getElementById('layer-controls');
    const layerDragHandle = document.getElementById('layer-drag-handle');
    const legendBox = document.getElementById('map-legend');
    const legendDragHandle = document.getElementById('legend-drag-handle');

    const WIDGET_IDLE_TIMEOUT_MS = 30000; // 30 seconds
    let layerIdleTimer = null;
    let legendIdleTimer = null;

    const resetWidgetToCorner = (widget) => {
      if (!widget) return;
      widget.style.left = '';
      widget.style.top = '';
      widget.style.right = '';
      widget.style.bottom = '';
      widget.style.transform = '';
    };

    const collapseWidget = (widget) => {
      if (!widget) return;
      widget.classList.add('collapsed', 'collapsed-mobile');
      resetWidgetToCorner(widget);
      if (widget === layerControlsBox && layerIdleTimer) {
        clearTimeout(layerIdleTimer);
        layerIdleTimer = null;
      }
      if (widget === legendBox && legendIdleTimer) {
        clearTimeout(legendIdleTimer);
        legendIdleTimer = null;
      }
    };

    const resetLayerIdleTimer = () => {
      if (layerIdleTimer) clearTimeout(layerIdleTimer);
      if (layerControlsBox && !layerControlsBox.classList.contains('collapsed') && !layerControlsBox.classList.contains('collapsed-mobile')) {
        layerIdleTimer = setTimeout(() => {
          collapseWidget(layerControlsBox);
        }, WIDGET_IDLE_TIMEOUT_MS);
      }
    };

    const resetLegendIdleTimer = () => {
      if (legendIdleTimer) clearTimeout(legendIdleTimer);
      if (legendBox && !legendBox.classList.contains('collapsed') && !legendBox.classList.contains('collapsed-mobile')) {
        legendIdleTimer = setTimeout(() => {
          collapseWidget(legendBox);
        }, WIDGET_IDLE_TIMEOUT_MS);
      }
    };

    const expandWidget = (target, other) => {
      if (!target) return;
      target.classList.remove('collapsed', 'collapsed-mobile');
      // If widget was moved while collapsed, keep it fully visible within viewport on expansion
      if (target.style.top) {
        requestAnimationFrame(() => {
          const rect = target.getBoundingClientRect();
          const pHeight = target.offsetParent ? target.offsetParent.clientHeight : window.innerHeight;
          const pWidth = target.offsetParent ? target.offsetParent.clientWidth : window.innerWidth;
          if (rect.bottom > pHeight - 8) {
            const newTop = Math.max(8, pHeight - rect.height - 8);
            target.style.top = `${newTop}px`;
          }
          if (rect.right > pWidth - 8) {
            const newLeft = Math.max(8, pWidth - rect.width - 8);
            target.style.left = `${newLeft}px`;
          }
        });
      }
      if (window.innerWidth <= 768 && other) {
        collapseWidget(other);
      }
      if (target === layerControlsBox) resetLayerIdleTimer();
      if (target === legendBox) resetLegendIdleTimer();
    };

    const toggleFloatingWidget = (target, other) => {
      if (!target) return;
      const isCollapsed = target.classList.contains('collapsed') || target.classList.contains('collapsed-mobile');
      if (isCollapsed) {
        expandWidget(target, other);
      } else {
        collapseWidget(target);
      }
    };

    // On mobile screens, initialize corner widgets in collapsed state
    if (window.innerWidth <= 768) {
      if (layerControlsBox) layerControlsBox.classList.add('collapsed', 'collapsed-mobile');
      if (legendBox) legendBox.classList.add('collapsed', 'collapsed-mobile');
    }

    if (layerControlsBox && layerDragHandle) {
      this.initDraggable(layerControlsBox, layerDragHandle, () => {
        toggleFloatingWidget(layerControlsBox, legendBox);
      });

      // User activity inside layer controls resets its 30s idle countdown
      ['mousemove', 'mousedown', 'touchstart', 'change', 'click'].forEach((evt) => {
        layerControlsBox.addEventListener(evt, () => resetLayerIdleTimer(), { passive: true });
      });

      // On load: if expanded, start 30s auto-collapse countdown
      if (!layerControlsBox.classList.contains('collapsed') && !layerControlsBox.classList.contains('collapsed-mobile')) {
        resetLayerIdleTimer();
      }
    }

    if (legendBox && legendDragHandle) {
      this.initDraggable(legendBox, legendDragHandle, () => {
        toggleFloatingWidget(legendBox, layerControlsBox);
      });

      // User activity inside legend box resets its 30s idle countdown
      ['mousemove', 'mousedown', 'touchstart', 'change', 'click'].forEach((evt) => {
        legendBox.addEventListener(evt, () => resetLegendIdleTimer(), { passive: true });
      });

      // On load: if expanded, start 30s auto-collapse countdown
      if (!legendBox.classList.contains('collapsed') && !legendBox.classList.contains('collapsed-mobile')) {
        resetLegendIdleTimer();
      }
    }

    const filterDragHandle = document.getElementById('filter-drag-handle');
    this.initDraggable(filterBar, filterDragHandle);

    // Auto-minimize floating toolbars on mobile when clicking anywhere on map or document
    if (this.mapEngine && this.mapEngine.map) {
      this.mapEngine.map.on('click', () => {
        if (window.innerWidth <= 768) {
          collapseWidget(layerControlsBox);
          collapseWidget(legendBox);
        }
      });
    }

    document.addEventListener('click', (e) => {
      if (window.innerWidth <= 768) {
        if (layerControlsBox && !layerControlsBox.contains(e.target) && (!layerControlsBox.classList.contains('collapsed') && !layerControlsBox.classList.contains('collapsed-mobile'))) {
          collapseWidget(layerControlsBox);
        }
        if (legendBox && !legendBox.contains(e.target) && (!legendBox.classList.contains('collapsed') && !legendBox.classList.contains('collapsed-mobile'))) {
          collapseWidget(legendBox);
        }
      }
    });

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
    const syncAudioUI = () => {
      const isAudioOn = this.state.audioEnabled;
      if (audioIcon) {
        audioIcon.innerHTML = isAudioOn
          ? `<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor"></polygon><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path><path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path></svg>`
          : `<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor"></polygon><line x1="23" y1="9" x2="17" y2="15"></line><line x1="17" y1="9" x2="23" y2="15"></line></svg>`;
      }
      if (audioBtn) audioBtn.classList.toggle('active', isAudioOn);
      const mAudioIcon = document.getElementById('m-audio-icon');
      if (mAudioIcon) mAudioIcon.textContent = isAudioOn ? '🔊' : '🔇';
      const mAudioBtn = document.getElementById('m-btn-toggle-audio');
      if (mAudioBtn) mAudioBtn.classList.toggle('active', isAudioOn);
    };

    if (audioBtn) {
      audioBtn.addEventListener('click', () => {
        this.state.audioEnabled = !this.state.audioEnabled;
        syncAudioUI();
        if (this.state.audioEnabled) {
          this.playSeismicTone(5.0);
          this.showToast('🔊 Audio ON: Timeline Sonification & Live Alerts Active', 'info');
        } else {
          this.showToast('🔇 Audio Muted', 'info');
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
      analyticsBtn.addEventListener('click', async () => {
        analyticsModal.classList.add('open');
        this.renderAnalytics();
        await this.ensureAnalyticsData();
        this.renderAnalytics();
      });
    }

    if (closeAnalyticsBtn && analyticsModal) {
      closeAnalyticsBtn.addEventListener('click', () => analyticsModal.classList.remove('open'));
      analyticsModal.addEventListener('click', (e) => {
        if (e.target === analyticsModal) analyticsModal.classList.remove('open');
      });
    }

    // Analytics Scope Toggle (Full Archive vs Filtered View)
    const scopeArchiveBtn = document.getElementById('btn-scope-archive');
    const scopeViewBtn = document.getElementById('btn-scope-view');
    if (scopeArchiveBtn && scopeViewBtn) {
      scopeArchiveBtn.addEventListener('click', async () => {
        this.state.analyticsScope = 'archive';
        scopeArchiveBtn.classList.add('active');
        scopeViewBtn.classList.remove('active');
        await this.ensureAnalyticsData();
        this.renderAnalytics();
      });

      scopeViewBtn.addEventListener('click', () => {
        this.state.analyticsScope = 'view';
        scopeViewBtn.classList.add('active');
        scopeArchiveBtn.classList.remove('active');
        this.renderAnalytics();
      });
    }

    // Analytics 4-Tab Switching
    const analyticsTabBtns = document.querySelectorAll('.analytics-tab-btn');
    analyticsTabBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const targetTab = btn.dataset.tab;
        analyticsTabBtns.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');

        document.querySelectorAll('.analytics-tab-pane').forEach((pane) => {
          pane.classList.remove('active');
        });
        const activePane = document.getElementById(`tab-analytics-${targetTab}`);
        if (activePane) activePane.classList.add('active');
        this.renderAnalytics();
      });
    });

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

    // Mobile Drawer Elements
    const backdrop = document.getElementById('sidebar-backdrop');
    const closeBtn = document.getElementById('btn-close-sidebar');

    const openMobileSidebar = () => {
      sidebar.classList.add('mobile-open');
      sidebar.classList.remove('auto-hidden', 'collapsed', 'hover-peek');
      if (backdrop) backdrop.classList.add('active');
    };

    const closeMobileSidebar = () => {
      sidebar.classList.remove('mobile-open', 'hover-peek');
      sidebar.classList.add('auto-hidden');
      if (backdrop) backdrop.classList.remove('active');
    };

    if (closeBtn) {
      closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (window.innerWidth <= 768) {
          closeMobileSidebar();
        } else {
          sidebar.classList.add('collapsed');
          setTimeout(() => this.mapEngine?.invalidateMapSize(true), 120);
        }
      });
    }

    if (backdrop) {
      backdrop.addEventListener('click', () => closeMobileSidebar());
    }

    // Touch swipe left on mobile sidebar to dismiss drawer
    let touchStartX = 0;
    let touchStartY = 0;
    sidebar.addEventListener('touchstart', (e) => {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
    }, { passive: true });

    sidebar.addEventListener('touchend', (e) => {
      const diffX = e.changedTouches[0].clientX - touchStartX;
      const diffY = e.changedTouches[0].clientY - touchStartY;
      if (diffX < -50 && Math.abs(diffX) > Math.abs(diffY)) {
        closeMobileSidebar();
      }
    }, { passive: true });

    // Toggle button works on both mobile (drawer) and desktop (wake/collapse)
    if (sidebarToggle) {
      sidebarToggle.addEventListener('click', () => {
        if (window.innerWidth <= 768) {
          if (sidebar.classList.contains('mobile-open')) {
            closeMobileSidebar();
          } else {
            openMobileSidebar();
          }
        } else {
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
        }
        resetIdleTimer();
      });
    }

    // Mobile Left Feed Toggle
    const mobileFeedToggle = document.getElementById('btn-mobile-feed-toggle');
    if (mobileFeedToggle) {
      mobileFeedToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        if (sidebar.classList.contains('mobile-open')) {
          closeMobileSidebar();
        } else {
          openMobileSidebar();
        }
      });
    }

    // Mobile Tools Overflow Menu
    const mobileToolsToggle = document.getElementById('btn-mobile-tools-toggle');
    const mobileToolsMenu = document.getElementById('mobile-tools-menu');
    const mobileToolsBackdrop = document.getElementById('mobile-tools-backdrop');

    const closeMobileTools = () => {
      if (mobileToolsMenu) mobileToolsMenu.classList.remove('open');
      if (mobileToolsBackdrop) mobileToolsBackdrop.classList.remove('active');
    };

    if (mobileToolsToggle && mobileToolsMenu) {
      mobileToolsToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = mobileToolsMenu.classList.contains('open');
        if (isOpen) {
          closeMobileTools();
        } else {
          mobileToolsMenu.classList.add('open');
          if (mobileToolsBackdrop) mobileToolsBackdrop.classList.add('active');
        }
      });
    }

    if (mobileToolsBackdrop) {
      mobileToolsBackdrop.addEventListener('click', () => closeMobileTools());
    }

    // Mobile Tools Menu Actions
    const mAudioBtn = document.getElementById('m-btn-toggle-audio');
    if (mAudioBtn) {
      mAudioBtn.addEventListener('click', () => {
        this.state.audioEnabled = !this.state.audioEnabled;
        syncAudioUI();
        if (this.state.audioEnabled) this.playSeismicTone(5.0);
        closeMobileTools();
      });
    }

    const mAnalyticsBtn = document.getElementById('m-btn-analytics');
    if (mAnalyticsBtn) {
      mAnalyticsBtn.addEventListener('click', () => {
        closeMobileTools();
        this.renderAnalytics();
        const analyticsModal = document.getElementById('analytics-modal');
        if (analyticsModal) analyticsModal.classList.add('open');
      });
    }

    const mTableBtn = document.getElementById('m-btn-table-view');
    if (mTableBtn) {
      mTableBtn.addEventListener('click', () => {
        closeMobileTools();
        this.renderModalTable();
        const tableModal = document.getElementById('table-modal');
        if (tableModal) tableModal.classList.add('open');
      });
    }

    const mMapSnapshotBtn = document.getElementById('m-btn-map-snapshot');
    if (mMapSnapshotBtn) {
      mMapSnapshotBtn.addEventListener('click', () => {
        closeMobileTools();
        this.captureFrontpageSnapshot();
      });
    }

    const mSyncBtn = document.getElementById('m-btn-sync');
    if (mSyncBtn) {
      mSyncBtn.addEventListener('click', () => {
        closeMobileTools();
        this.handleSync();
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

    // Responsive viewport resize & orientation adaptation
    window.addEventListener('resize', () => {
      clearTimeout(this._resizeTimer);
      this._resizeTimer = setTimeout(() => {
        this.mapEngine?.invalidateMapSize(true);
      }, 150);
    });
    window.addEventListener('orientationchange', () => {
      setTimeout(() => {
        this.mapEngine?.invalidateMapSize(true);
      }, 250);
    });

    // Arm initial 30s idle countdown
    resetIdleTimer();
  }

  /**
   * Makes floating elements smoothly draggable across the viewport (mouse and touch),
   * constrained within parent boundaries without jumping or disappearing offscreen.
   */
  initDraggable(element, handle, onToggle = null) {
    if (!element || !handle) return;

    // Prevent Leaflet map from capturing drag and scroll events on the floating widget
    if (window.L && window.L.DomEvent) {
      window.L.DomEvent.disableClickPropagation(element);
      window.L.DomEvent.disableScrollPropagation(element);
    }

    let isDragging = false;
    let hasMoved = false;
    let startX = 0;
    let startY = 0;
    let initialLeft = 0;
    let initialTop = 0;

    const onPointerDown = (e) => {
      // Ignore clicks on form inputs, buttons, or checkboxes
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON' || e.target.closest('label')) return;

      isDragging = true;
      hasMoved = false;
      const clientX = e.type.startsWith('touch') ? e.touches[0].clientX : e.clientX;
      const clientY = e.type.startsWith('touch') ? e.touches[0].clientY : e.clientY;

      startX = clientX;
      startY = clientY;

      // Calculate initial position relative to offsetParent (NOT window viewport)
      const parentRect = element.offsetParent ? element.offsetParent.getBoundingClientRect() : { left: 0, top: 0 };
      const elRect = element.getBoundingClientRect();
      initialLeft = elRect.left - parentRect.left;
      initialTop = elRect.top - parentRect.top;

      const onPointerMove = (moveEvent) => {
        if (!isDragging) return;
        if (moveEvent.cancelable && moveEvent.type.startsWith('touch')) {
          moveEvent.preventDefault();
        }

        const curX = moveEvent.type.startsWith('touch') ? moveEvent.touches[0].clientX : moveEvent.clientX;
        const curY = moveEvent.type.startsWith('touch') ? moveEvent.touches[0].clientY : moveEvent.clientY;

        const dx = curX - startX;
        const dy = curY - startY;

        if (!hasMoved && Math.hypot(dx, dy) > 8) {
          hasMoved = true;
          element.classList.add('dragging');
          element.style.right = 'auto';
          element.style.bottom = 'auto';
          element.style.transform = 'none';
          element.style.left = `${initialLeft}px`;
          element.style.top = `${initialTop}px`;
        }

        if (hasMoved) {
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
        }
      };

      const onPointerUp = () => {
        if (!isDragging) return;
        isDragging = false;
        element.classList.remove('dragging');
        document.removeEventListener('mousemove', onPointerMove);
        document.removeEventListener('mouseup', onPointerUp);
        document.removeEventListener('touchmove', onPointerMove);
        document.removeEventListener('touchend', onPointerUp);
        // Cleanly reset hasMoved after short trailing window to avoid swallowing future clicks
        setTimeout(() => {
          hasMoved = false;
        }, 80);
      };

      document.addEventListener('mousemove', onPointerMove);
      document.addEventListener('mouseup', onPointerUp);
      document.addEventListener('touchmove', onPointerMove, { passive: false });
      document.addEventListener('touchend', onPointerUp);
    };

    handle.addEventListener('mousedown', onPointerDown);
    handle.addEventListener('touchstart', onPointerDown, { passive: true });

    // Single-tap on handle collapses/expands floating widget
    handle.addEventListener('click', (e) => {
      if (hasMoved) {
        hasMoved = false;
        return;
      }
      if (onToggle) {
        onToggle();
      } else {
        const isCollapsed = element.classList.contains('collapsed') || element.classList.contains('collapsed-mobile');
        if (isCollapsed) {
          element.classList.remove('collapsed', 'collapsed-mobile');
        } else {
          element.classList.add('collapsed', 'collapsed-mobile');
        }
      }
    });

    // Clicking anywhere on collapsed pill opens it directly
    element.addEventListener('click', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON' || e.target.closest('label')) return;
      const isCollapsed = element.classList.contains('collapsed') || element.classList.contains('collapsed-mobile');
      if (isCollapsed && !handle.contains(e.target)) {
        if (hasMoved) return;
        if (onToggle) {
          onToggle();
        } else {
          element.classList.remove('collapsed', 'collapsed-mobile');
        }
      }
    });
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
    } else if (this.state.filters.preset === '1y') {
      const yearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
      queryParams.start_date = yearAgo.toISOString().replace('T', ' ').substring(0, 19);
    } else if (this.state.filters.preset === 'feb2023') {
      queryParams.start_date = '2023-02-06 00:00:00';
      queryParams.end_date = '2023-02-28 23:59:59';
    }

    try {
      const data = await fetchEarthquakes(queryParams);
      const incoming = data.items || [];

      // Check for incoming live seismic events when catalog is already active
      if (this._lastKnownNewestTime && incoming.length > 0) {
        const newEvents = incoming.filter((eq) => eq.origintimeutc > this._lastKnownNewestTime);
        if (newEvents.length > 0) {
          const mostSignificant = newEvents.reduce(
            (prev, curr) => (parseFloat(curr.magnitude) || 0) > (parseFloat(prev.magnitude) || 0) ? curr : prev,
            newEvents[0]
          );
          this.playLiveAlertAlarm(mostSignificant);
          this.showToast(
            `🚨 Live Event Alert: M${mostSignificant.magnitude} • ${mostSignificant.region || 'Turkey Seismic Zone'}`,
            'warning'
          );
        }
      }

      if (incoming.length > 0) {
        const newestTime = incoming.reduce(
          (max, eq) => (eq.origintimeutc > max ? eq.origintimeutc : max),
          incoming[0].origintimeutc
        );
        this._lastKnownNewestTime = newestTime;
      }

      this.state.earthquakes = incoming;
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
      this.state.playback.currentIndex = Math.max(0, this.state.sortedChronological.length - 1);
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
      this.renderPlaybackFrame(0, 0);
    }

    const intervalMs = Math.max(40, 500 / this.state.playback.speed);

    this.state.playback.timer = setInterval(() => {
      const total = this.state.sortedChronological.length;
      if (this.state.playback.currentIndex >= total - 1) {
        this.stopPlayback();
        return;
      }

      const prevIdx = this.state.playback.currentIndex;
      this.state.playback.currentIndex += Math.max(1, Math.floor(total / 100));
      if (this.state.playback.currentIndex >= total) {
        this.state.playback.currentIndex = total - 1;
      }

      const percent = Math.floor((this.state.playback.currentIndex / (total - 1)) * 100);
      if (scrubber) scrubber.value = percent;
      this.renderPlaybackFrame(prevIdx, this.state.playback.currentIndex);
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
    const prevIdx = this.state.playback.currentIndex;
    this.state.playback.currentIndex = Math.floor((percent / 100) * (total - 1));
    this.renderPlaybackFrame(prevIdx, this.state.playback.currentIndex);
  }

  renderPlaybackFrame(prevIdx = null, currIdx = null) {
    const total = this.state.sortedChronological.length;
    if (!total) return;
    const currentEvent = this.state.sortedChronological[this.state.playback.currentIndex];
    if (!currentEvent) return;

    const maxTime = currentEvent.origintimeutc;
    this.mapEngine.renderEarthquakes(this.state.earthquakes, maxTime);

    const dateDisplay = document.getElementById('timeline-date-display');
    if (dateDisplay) {
      const dt = currentEvent.eventtime || currentEvent.origintimeutc;
      dateDisplay.textContent = `Date: ${dt.substring(0, 16)} UTC+3`;
    }

    // Playback Sonification
    if (
      this.state.playback.isPlaying &&
      this.state.audioEnabled &&
      prevIdx !== null &&
      currIdx !== null &&
      currIdx > prevIdx
    ) {
      const stepEvents = this.state.sortedChronological.slice(prevIdx, currIdx + 1);
      if (stepEvents.length > 0) {
        let maxMag = 0;
        for (let i = 0; i < stepEvents.length; i++) {
          const m = parseFloat(stepEvents[i].magnitude) || 0;
          if (m > maxMag) maxMag = m;
        }
        if (maxMag >= 3.0) {
          this.playPlaybackTone(maxMag);
        }
      }
    }
  }

  /* ==========================================================================
     Multi-Tab Analytics Observatory Engine (v2.12.1)
     ========================================================================== */
  async fetchFullCatalogCache() {
    if (this.fullCatalogCache && this.fullCatalogCache.length > 0) return this.fullCatalogCache;
    try {
      const res = await fetch('/api/earthquakes?limit=20000');
      if (res.ok) {
        const data = await res.json();
        this.fullCatalogCache = data.items || [];
        const archCountEl = document.getElementById('analytics-arch-count');
        if (archCountEl) archCountEl.textContent = (this.fullCatalogCache.length / 1000).toFixed(1) + 'k';
        const viewCountEl = document.getElementById('analytics-view-count');
        if (viewCountEl) viewCountEl.textContent = (this.state.earthquakes || []).length.toLocaleString();
        return this.fullCatalogCache;
      }
    } catch (err) {
      console.warn('Could not preload full catalog cache:', err);
    }
    return this.state.earthquakes || [];
  }

  async ensureAnalyticsData() {
    if (this.state.analyticsScope === 'archive' && (!this.fullCatalogCache || !this.fullCatalogCache.length)) {
      await this.fetchFullCatalogCache();
    }
  }

  renderAnalytics() {
    const scope = this.state.analyticsScope || 'archive';
    let quakes = [];
    if (scope === 'archive' && this.fullCatalogCache && this.fullCatalogCache.length > 0) {
      quakes = this.fullCatalogCache;
    } else {
      quakes = this.state.earthquakes || [];
    }
    if (!quakes.length) return;

    // Update Scope Toggle UI
    const scopeArchiveBtn = document.getElementById('btn-scope-archive');
    const scopeViewBtn = document.getElementById('btn-scope-view');
    if (scopeArchiveBtn && scopeViewBtn) {
      scopeArchiveBtn.classList.toggle('active', scope === 'archive');
      scopeViewBtn.classList.toggle('active', scope === 'view');
    }
    const archCountEl = document.getElementById('analytics-arch-count');
    if (archCountEl) {
      archCountEl.textContent = this.fullCatalogCache
        ? (this.fullCatalogCache.length / 1000).toFixed(1) + 'k'
        : '13.4k';
    }
    const viewCountEl = document.getElementById('analytics-view-count');
    if (viewCountEl) {
      viewCountEl.textContent = (this.state.earthquakes || []).length.toLocaleString();
    }

    this.renderAnalyticsOverview(quakes);
    this.renderAnalyticsTime(quakes);
    this.renderAnalyticsEnergy(quakes);
    this.renderAnalyticsRegions(quakes);
  }

  /**
   * Tab 1: Overview & Catalog Distribution
   */
  renderAnalyticsOverview(quakes) {
    const magChart = document.getElementById('analytics-mag-chart');
    const depthSummary = document.getElementById('analytics-depth-summary');
    const sourceChart = document.getElementById('analytics-source-chart');
    const healthSummary = document.getElementById('analytics-health-summary');

    const badgeTotal = document.getElementById('analytics-total-quakes');
    const badgeAvgDepth = document.getElementById('analytics-avg-depth-kpi');
    const badgeMaxMag = document.getElementById('analytics-max-mag-kpi');
    const badgeMaxLoc = document.getElementById('analytics-max-loc-kpi');
    const badge24h = document.getElementById('analytics-24h-kpi');
    const badgeDateRange = document.getElementById('analytics-date-range');
    const badgeDepthMean = document.getElementById('analytics-avg-depth');

    // 1. KPI Counter Calculations
    if (badgeTotal) badgeTotal.textContent = quakes.length.toLocaleString();

    let totalDepth = 0;
    let maxMag = 0;
    let maxLoc = 'Unknown';
    let count24h = 0;
    const nowMs = Date.now();
    const MS_24H = 24 * 60 * 60 * 1000;

    let minDate = '9999';
    let maxDate = '0000';

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

    const sourceCounts = {
      'KOERI (Local)': { count: 0, color: '#38bdf8' },
      'EMSC (Euro-Med)': { count: 0, color: '#f59e0b' },
      'USGS (Global)': { count: 0, color: '#10b981' },
      'Historical / Other': { count: 0, color: '#a855f7' }
    };

    let magGte2Count = 0;
    let magGte2Sum = 0;

    quakes.forEach((eq) => {
      const m = parseFloat(eq.magnitude) || 0;
      const d = parseFloat(eq.depthkm) || 0;
      totalDepth += d;

      if (m > maxMag) {
        maxMag = m;
        maxLoc = (eq.region || 'Unknown').split(',')[0].trim();
      }

      const tStr = eq.origintimeutc || '';
      if (tStr) {
        if (tStr < minDate) minDate = tStr;
        if (tStr > maxDate) maxDate = tStr;
        const tMs = new Date(tStr.replace(' ', 'T') + 'Z').getTime();
        if (nowMs - tMs <= MS_24H) count24h++;
      }

      if (m >= 2.0) {
        magGte2Count++;
        magGte2Sum += m;
      }

      if (m < 3.0) bins['< 3.0 (Minor)'].count++;
      else if (m < 4.0) bins['3.0–3.9 (Light)'].count++;
      else if (m < 5.0) bins['4.0–4.9 (Moderate)'].count++;
      else if (m < 6.0) bins['5.0–5.9 (Strong)'].count++;
      else if (m < 7.0) bins['6.0–6.9 (Major)'].count++;
      else bins['≥ 7.0 (Great)'].count++;

      if (d < 10) shallow++;
      else if (d <= 30) intermediate++;
      else deep++;

      const src = (eq.measmethod || '').toUpperCase();
      if (src.includes('KOERI')) sourceCounts['KOERI (Local)'].count++;
      else if (src.includes('EMSC')) sourceCounts['EMSC (Euro-Med)'].count++;
      else if (src.includes('USGS')) sourceCounts['USGS (Global)'].count++;
      else sourceCounts['Historical / Other'].count++;
    });

    const avgD = quakes.length ? (totalDepth / quakes.length).toFixed(1) : '0';
    if (badgeAvgDepth) badgeAvgDepth.textContent = `${avgD} km`;
    if (badgeDepthMean) badgeDepthMean.textContent = `Mean: ${avgD} km`;
    if (badgeMaxMag) badgeMaxMag.textContent = `M${maxMag.toFixed(1)}`;
    if (badgeMaxLoc) badgeMaxLoc.textContent = maxLoc;
    if (badge24h) badge24h.textContent = `${count24h} events`;

    if (badgeDateRange && minDate !== '9999') {
      badgeDateRange.textContent = `${minDate.substring(0, 10)} &bull; ${maxDate.substring(0, 10)}`;
    }

    // Magnitude Distribution Chart
    if (magChart) {
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
              <span class="chart-bar-count">${data.count.toLocaleString()} <span style="font-size: 0.72rem; color: var(--text-muted);">(${share}%)</span></span>
            </div>
          `;
        })
        .join('');
    }

    // Depth Stratification Summary
    if (depthSummary) {
      depthSummary.innerHTML = `
        <div class="depth-stat-row">
          <span>Shallow Crustal (&lt; 10 km) — Direct Ground Rupture Risk</span>
          <strong style="color: #ef4444">${shallow.toLocaleString()} events (${Math.round((shallow / (quakes.length || 1)) * 100)}%)</strong>
        </div>
        <div class="depth-stat-row">
          <span>Intermediate Depth (10 – 30 km) — Seismogenic Zone</span>
          <strong style="color: #f59e0b">${intermediate.toLocaleString()} events (${Math.round((intermediate / (quakes.length || 1)) * 100)}%)</strong>
        </div>
        <div class="depth-stat-row">
          <span>Deep Subduction / Lithospheric (&gt; 30 km)</span>
          <strong style="color: #38bdf8">${deep.toLocaleString()} events (${Math.round((deep / (quakes.length || 1)) * 100)}%)</strong>
        </div>
        <div class="depth-stat-row" style="background: rgba(56, 189, 248, 0.05); border-color: rgba(56, 189, 248, 0.2);">
          <span>Catalog Mean Focal Depth</span>
          <strong style="color: #38bdf8">${avgD} km hypocenter</strong>
        </div>
      `;
    }

    // Multi-Network Ingestion Share
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
              <span class="source-count">${sData.count.toLocaleString()} <span style="font-size: 0.75rem; color: var(--text-muted); font-weight: normal;">(${sShare}%)</span></span>
            </div>
          `;
        })
        .join('');
    }

    // Catalog Health & Observational Metrics
    if (healthSummary) {
      // Aki (1965) b-value estimation: b = log10(e) / (M_mean - (Mc - bin/2))
      const meanM = magGte2Count > 0 ? (magGte2Sum / magGte2Count) : 3.0;
      const bVal = (Math.LOG10E / (meanM - (2.0 - 0.05))).toFixed(2);
      const spanYears = minDate !== '9999'
        ? ((new Date(maxDate.substring(0, 10)) - new Date(minDate.substring(0, 10))) / (365.25 * 86400000)).toFixed(1)
        : '5.6';

      healthSummary.innerHTML = `
        <div class="health-row">
          <span class="health-label">Gutenberg-Richter b-Value:</span>
          <span class="health-val text-sky">b &approx; ${bVal} <small style="color:var(--text-muted)">(Tectonic Normal &sim; 1.0)</small></span>
        </div>
        <div class="health-row">
          <span class="health-label">Catalog Completeness (M<sub>c</sub>):</span>
          <span class="health-val text-emerald">M &ge; 2.0 <small style="color:var(--text-muted)">(100% Network Coverage)</small></span>
        </div>
        <div class="health-row">
          <span class="health-label">Catalog Monitored Horizon:</span>
          <span class="health-val text-amber">${spanYears} Years Archive</span>
        </div>
        <div class="health-row">
          <span class="health-label">Multi-Provider Telemetry:</span>
          <span class="health-val text-purple">3 Active Feeds <small style="color:var(--text-muted)">(KOERI, EMSC, USGS)</small></span>
        </div>
      `;
    }
  }

  /**
   * Tab 2: Temporal Trends & Time Intelligence
   */
  renderAnalyticsTime(quakes) {
    const monthlyContainer = document.getElementById('analytics-monthly-chart');
    const diurnalContainer = document.getElementById('analytics-diurnal-chart');
    const dowContainer = document.getElementById('analytics-dow-chart');
    const peakMonthBadge = document.getElementById('analytics-peak-month-badge');

    // 1. Monthly Buckets
    const monthCounts = {};
    const monthMaxM = {};

    // 2. 24-Hour Diurnal Buckets (TRT / UTC+3)
    const hourCounts = new Array(24).fill(0);

    // 3. Day of Week Buckets (Sun = 0, Mon = 1, etc.)
    const dowCounts = [
      { name: 'Mon', count: 0 },
      { name: 'Tue', count: 0 },
      { name: 'Wed', count: 0 },
      { name: 'Thu', count: 0 },
      { name: 'Fri', count: 0 },
      { name: 'Sat', count: 0 },
      { name: 'Sun', count: 0 }
    ];

    quakes.forEach((eq) => {
      const tStr = eq.origintimeutc || '';
      const m = parseFloat(eq.magnitude) || 0;
      if (!tStr) return;

      const ym = tStr.substring(0, 7);
      if (ym.length === 7) {
        monthCounts[ym] = (monthCounts[ym] || 0) + 1;
        if (!monthMaxM[ym] || m > monthMaxM[ym]) monthMaxM[ym] = m;
      }

      // Local TRT Date object (UTC+3)
      const dObj = new Date(tStr.replace(' ', 'T') + 'Z');
      const trtHour = (dObj.getUTCHours() + 3) % 24;
      hourCounts[trtHour]++;

      const trtDay = (dObj.getUTCDay() + 6) % 7; // Convert Sun(0) -> 6, Mon(1) -> 0
      dowCounts[trtDay].count++;
    });

    // Monthly Chart Render (SVG Area-Bars)
    if (monthlyContainer) {
      const rawMonths = Object.keys(monthCounts).sort();
      let sortedMonths = [];
      if (rawMonths.length > 0) {
        // Guarantee continuous full-catalog timeline from earliest recorded month (2021-01) to latest (2026-09)
        const firstYm = rawMonths[0];
        const lastYm = rawMonths[rawMonths.length - 1];
        const startY = parseInt(firstYm.substring(0, 4), 10);
        const startM = parseInt(firstYm.substring(5, 7), 10);
        const endY = parseInt(lastYm.substring(0, 4), 10);
        const endM = parseInt(lastYm.substring(5, 7), 10);

        let cy = startY, cm = startM;
        while (cy < endY || (cy === endY && cm <= endM)) {
          const ymKey = `${cy}-${String(cm).padStart(2, '0')}`;
          sortedMonths.push(ymKey);
          if (!monthCounts[ymKey]) monthCounts[ymKey] = 0;
          cm++;
          if (cm > 12) { cm = 1; cy++; }
        }
      } else {
        sortedMonths = rawMonths;
      }

      let peakMonth = '2023-02';
      let peakCount = 0;

      sortedMonths.forEach((ym) => {
        if (monthCounts[ym] > peakCount) {
          peakCount = monthCounts[ym];
          peakMonth = ym;
        }
      });

      if (peakMonthBadge) {
        peakMonthBadge.textContent = `Peak: ${peakMonth} (${peakCount.toLocaleString()} quakes)`;
      }

      const svgWidth = 1000;
      const svgHeight = 220;
      const padLeft = 45;
      const padRight = 20;
      const padTop = 20;
      const padBottom = 30;

      const plotW = svgWidth - padLeft - padRight;
      const plotH = svgHeight - padTop - padBottom;
      const maxVal = Math.max(peakCount, 100);

      const nMonths = sortedMonths.length || 1;
      const barSlotW = plotW / nMonths;
      const barW = Math.max(3, barSlotW - 1.5);

      let barsSvg = '';
      let yearTicks = '';
      let lastYear = '';

      sortedMonths.forEach((ym, i) => {
        const count = monthCounts[ym] || 0;
        const barH = (count / maxVal) * plotH;
        const x = padLeft + i * barSlotW;
        const y = padTop + plotH - barH;

        let color = '#38bdf8';
        if (ym === '2023-02' || count >= 1000) color = '#ef4444';
        else if (count >= 500) color = '#f43f5e';
        else if (count >= 200) color = '#f59e0b';

        barsSvg += `
          <rect x="${x}" y="${y}" width="${barW}" height="${Math.max(barH, count > 0 ? 3 : 0)}" rx="1.5" fill="${color}" opacity="${count > 0 ? 0.9 : 0.2}">
            <title>${ym}: ${count.toLocaleString()} quakes (Max M${(monthMaxM[ym] || 0).toFixed(1)})</title>
          </rect>
        `;

        const curYear = ym.substring(0, 4);
        if (curYear !== lastYear) {
          yearTicks += `
            <text x="${x}" y="${svgHeight - 8}" fill="#94a3b8" font-size="11" font-family="monospace" font-weight="bold">${curYear}</text>
            <line x1="${x}" y1="${padTop}" x2="${x}" y2="${padTop + plotH}" stroke="rgba(255,255,255,0.06)" stroke-dasharray="3,3" />
          `;
          lastYear = curYear;
        }
      });

      monthlyContainer.innerHTML = `
        <svg viewBox="0 0 ${svgWidth} ${svgHeight}" preserveAspectRatio="none">
          <line x1="${padLeft}" y1="${padTop + plotH}" x2="${svgWidth - padRight}" y2="${padTop + plotH}" stroke="rgba(255,255,255,0.15)" stroke-width="1" />
          ${yearTicks}
          ${barsSvg}
          <text x="8" y="${padTop + 14}" fill="#64748b" font-size="10" font-family="monospace">${maxVal}</text>
          <text x="8" y="${padTop + plotH / 2}" fill="#64748b" font-size="10" font-family="monospace">${Math.round(maxVal / 2)}</text>
          <text x="8" y="${padTop + plotH}" fill="#64748b" font-size="10" font-family="monospace">0</text>
        </svg>
      `;
    }

    // 24-Hour Diurnal Chart
    if (diurnalContainer) {
      const maxHour = Math.max(1, ...hourCounts);
      diurnalContainer.innerHTML = hourCounts
        .map((count, hr) => {
          const pct = Math.round((count / maxHour) * 100);
          const isNight = hr <= 5 || hr >= 22;
          const bg = isNight ? 'linear-gradient(180deg, #38bdf8, #0284c7)' : 'linear-gradient(180deg, #818cf8, #4f46e5)';
          const hrLabel = hr % 4 === 0 ? `${hr}h` : '';
          return `
            <div class="diurnal-col" title="${hr}:00 TRT: ${count.toLocaleString()} events (${Math.round((count / (quakes.length || 1)) * 100)}%)">
              <div class="diurnal-bar" style="height: ${Math.max(6, pct)}%; background: ${bg};"></div>
              <span class="diurnal-label">${hrLabel}</span>
            </div>
          `;
        })
        .join('');
    }

    // Day of Week Chart
    if (dowContainer) {
      const maxDow = Math.max(1, ...dowCounts.map((d) => d.count));
      dowContainer.innerHTML = dowCounts
        .map((d) => {
          const pct = Math.round((d.count / maxDow) * 100);
          const share = Math.round((d.count / (quakes.length || 1)) * 100);
          return `
            <div class="dow-col" title="${d.name}: ${d.count.toLocaleString()} quakes (${share}%)">
              <div class="dow-bar" style="height: ${Math.max(8, pct)}%; background: linear-gradient(180deg, #10b981, #059669);"></div>
              <span class="dow-label">${d.name}</span>
            </div>
          `;
        })
        .join('');
    }
  }

  /**
   * Tab 3: Seismic Energy & Geophysical Physics
   */
  renderAnalyticsEnergy(quakes) {
    const energyJoulesBadge = document.getElementById('analytics-energy-joules');
    const energyTntBadge = document.getElementById('analytics-energy-tnt');
    const concentrationBadge = document.getElementById('analytics-energy-concentration');
    const energyCurveContainer = document.getElementById('analytics-energy-curve');
    const magTypeContainer = document.getElementById('analytics-magtype-chart');

    let totalJoules = 0;
    let feb6Joules = 0;
    const magTypeCounts = {};

    // Chronological sort for energy progression curve
    const chronologicalQuakes = [...quakes].sort((a, b) => (a.origintimeutc || '').localeCompare(b.origintimeutc || ''));

    chronologicalQuakes.forEach((eq) => {
      const m = parseFloat(eq.magnitude) || 0;
      // Gutenberg-Richter log10 E = 4.8 + 1.5M
      const e = Math.pow(10, 4.8 + 1.5 * m);
      totalJoules += e;

      if ((eq.origintimeutc || '').startsWith('2023-02-06')) {
        feb6Joules += e;
      }

      const mt = (eq.magtype || 'ML').toUpperCase();
      magTypeCounts[mt] = (magTypeCounts[mt] || 0) + 1;
    });

    const megatons = totalJoules / 4.184e15;
    const feb6Share = totalJoules > 0 ? ((feb6Joules / totalJoules) * 100).toFixed(1) : '93.3';

    if (energyJoulesBadge) energyJoulesBadge.textContent = `${(totalJoules / 1e15).toFixed(1)} PJ`;
    if (energyTntBadge) energyTntBadge.textContent = `${megatons.toFixed(1)} Mt`;
    if (concentrationBadge) concentrationBadge.textContent = `${feb6Share}%`;

    // Cumulative Energy Release Curve (SVG Area Chart - Wide Aspect Ratio)
    if (energyCurveContainer) {
      const svgW = 700;
      const svgH = 290;
      const padL = 50;
      const padR = 20;
      const padT = 25;
      const padB = 35;
      const plotW = svgW - padL - padR;
      const plotH = svgH - padT - padB;

      // Determine temporal baseline
      const tStart = chronologicalQuakes.length > 0
        ? new Date((chronologicalQuakes[0].origintimeutc || '').replace(' ', 'T') + 'Z').getTime()
        : new Date('2021-01-01T00:00:00Z').getTime();
      const tEnd = chronologicalQuakes.length > 0
        ? new Date((chronologicalQuakes[chronologicalQuakes.length - 1].origintimeutc || '').replace(' ', 'T') + 'Z').getTime()
        : new Date('2026-09-06T00:00:00Z').getTime();
      const tSpan = Math.max(1, tEnd - tStart);

      // Sample 120 chronological points along curve
      const nSamples = 120;
      const step = Math.max(1, Math.floor(chronologicalQuakes.length / nSamples));
      let runningJoules = 0;
      const points = [];

      for (let i = 0; i < chronologicalQuakes.length; i++) {
        const m = parseFloat(chronologicalQuakes[i].magnitude) || 0;
        runningJoules += Math.pow(10, 4.8 + 1.5 * m);

        if (i % step === 0 || i === chronologicalQuakes.length - 1) {
          const tCurr = new Date((chronologicalQuakes[i].origintimeutc || '').replace(' ', 'T') + 'Z').getTime();
          const fracX = Math.max(0, Math.min(1, (tCurr - tStart) / tSpan));
          const fracY = totalJoules > 0 ? runningJoules / totalJoules : 0;
          const px = padL + fracX * plotW;
          const py = padT + plotH - fracY * plotH;
          points.push({ x: px, y: py, frac: fracY });
        }
      }

      if (points.length === 0) {
        points.push({ x: padL, y: padT + plotH, frac: 0 });
        points.push({ x: padL + plotW, y: padT, frac: 1 });
      }

      let pathD = `M ${points[0].x} ${points[0].y}`;
      for (let i = 1; i < points.length; i++) {
        pathD += ` L ${points[i].x} ${points[i].y}`;
      }

      const areaD = `${pathD} L ${padL + plotW} ${padT + plotH} L ${padL} ${padT + plotH} Z`;

      // Calculate exact Feb 6, 2023 coordinates
      const tFeb6 = new Date('2023-02-06T01:17:34Z').getTime();
      const feb6FracX = Math.max(0, Math.min(1, (tFeb6 - tStart) / tSpan));
      const feb6X = padL + feb6FracX * plotW;

      // Annual tick lines along X axis
      let annualTicks = '';
      const startYear = new Date(tStart).getUTCFullYear();
      const endYear = new Date(tEnd).getUTCFullYear();
      for (let yr = startYear; yr <= endYear; yr++) {
        const tYr = new Date(`${yr}-01-01T00:00:00Z`).getTime();
        if (tYr >= tStart && tYr <= tEnd) {
          const fracYr = (tYr - tStart) / tSpan;
          const xYr = padL + fracYr * plotW;
          annualTicks += `
            <line x1="${xYr}" y1="${padT}" x2="${xYr}" y2="${padT + plotH}" stroke="rgba(255,255,255,0.06)" stroke-dasharray="3,3" />
            <text x="${xYr + 2}" y="${svgH - 10}" fill="#64748b" font-size="10" font-family="monospace">${yr}</text>
          `;
        }
      }

      energyCurveContainer.innerHTML = `
        <svg viewBox="0 0 ${svgW} ${svgH}" preserveAspectRatio="none" style="width:100%; height:100%;">
          <defs>
            <linearGradient id="energyAreaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#ec4899" stop-opacity="0.38" />
              <stop offset="60%" stop-color="#ec4899" stop-opacity="0.10" />
              <stop offset="100%" stop-color="#ec4899" stop-opacity="0.0" />
            </linearGradient>
            <linearGradient id="energyLineGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stop-color="#f59e0b" />
              <stop offset="45%" stop-color="#ec4899" />
              <stop offset="100%" stop-color="#38bdf8" />
            </linearGradient>
          </defs>

          <!-- Axes & Horizontal Gridlines -->
          <line x1="${padL}" y1="${padT + plotH}" x2="${padL + plotW}" y2="${padT + plotH}" stroke="rgba(255,255,255,0.15)" stroke-width="1" />
          <line x1="${padL}" y1="${padT}" x2="${padL}" y2="${padT + plotH}" stroke="rgba(255,255,255,0.15)" stroke-width="1" />
          <line x1="${padL}" y1="${padT + plotH * 0.75}" x2="${padL + plotW}" y2="${padT + plotH * 0.75}" stroke="rgba(255,255,255,0.04)" stroke-dasharray="2,2" />
          <line x1="${padL}" y1="${padT + plotH * 0.50}" x2="${padL + plotW}" y2="${padT + plotH * 0.50}" stroke="rgba(255,255,255,0.08)" stroke-dasharray="3,3" />
          <line x1="${padL}" y1="${padT + plotH * 0.25}" x2="${padL + plotW}" y2="${padT + plotH * 0.25}" stroke="rgba(255,255,255,0.04)" stroke-dasharray="2,2" />
          <line x1="${padL}" y1="${padT}" x2="${padL + plotW}" y2="${padT}" stroke="rgba(255,255,255,0.08)" stroke-dasharray="2,2" />

          <!-- Calendar Year Vertical Ticks -->
          ${annualTicks}

          <!-- Area and Energy Curve Path -->
          <path d="${areaD}" fill="url(#energyAreaGrad)" />
          <path d="${pathD}" fill="none" stroke="url(#energyLineGrad)" stroke-width="2.8" stroke-linecap="round" />

          <!-- February 6, 2023 Sequence Step Function Annotation -->
          <line x1="${feb6X}" y1="${padT}" x2="${feb6X}" y2="${padT + plotH}" stroke="rgba(236, 72, 153, 0.45)" stroke-dasharray="4,3" stroke-width="1.5" />
          <circle cx="${feb6X}" cy="${padT + plotH * 0.05}" r="5" fill="#ec4899" />
          <rect x="${Math.min(feb6X + 8, padL + plotW - 195)}" y="${padT + 12}" width="185" height="22" rx="4" fill="rgba(236, 72, 153, 0.18)" stroke="rgba(236, 72, 153, 0.5)" stroke-width="1" />
          <text x="${Math.min(feb6X + 16, padL + plotW - 187)}" y="${padT + 27}" fill="#f43f5e" font-size="10" font-family="monospace" font-weight="bold">Feb 2023 Sequence (&gt;96% &Sigma;E)</text>

          <!-- Y-Axis Energy Percentage Labels -->
          <text x="8" y="${padT + 10}" fill="#94a3b8" font-size="10" font-family="monospace">100%</text>
          <text x="8" y="${padT + plotH * 0.50 + 4}" fill="#94a3b8" font-size="10" font-family="monospace">50%</text>
          <text x="8" y="${padT + plotH}" fill="#94a3b8" font-size="10" font-family="monospace">0%</text>
        </svg>
      `;
    }

    // MagType Breakdown
    if (magTypeContainer) {
      const maxMt = Math.max(1, ...Object.values(magTypeCounts));
      magTypeContainer.innerHTML = Object.entries(magTypeCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([mName, mCount]) => {
          const pct = Math.round((mCount / maxMt) * 100);
          const share = Math.round((mCount / (quakes.length || 1)) * 100);
          return `
            <div class="magtype-row">
              <span class="magtype-name">${mName}</span>
              <div class="magtype-bar-track">
                <div class="magtype-bar-fill" style="width: ${pct}%;"></div>
              </div>
              <span class="magtype-count">${mCount.toLocaleString()} (${share}%)</span>
            </div>
          `;
        })
        .join('');
    }
  }

  /**
   * Tab 4: Regional Seismicity & Hypocenter Cross-Matrix
   */
  renderAnalyticsRegions(quakes) {
    const topRegionsList = document.getElementById('analytics-top-regions-list');
    const matrixContainer = document.getElementById('analytics-cross-matrix');
    const depthHistContainer = document.getElementById('analytics-depth-histogram');

    const regionMap = {};
    const depthBins = {
      '0–5 km': 0,
      '5–10 km': 0,
      '10–15 km': 0,
      '15–20 km': 0,
      '20–30 km': 0,
      '30–50 km': 0,
      '> 50 km': 0
    };

    // 2D Matrix: Rows = Depth tiers, Cols = Mag tiers
    // Depth: 0: Shallow (<10km), 1: Intermediate (10-30km), 2: Deep (>30km)
    // Mag: 0: <3.0, 1: 3.0-4.4, 2: 4.5-5.9, 3: >=6.0
    const matrix = [
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0]
    ];

    quakes.forEach((eq) => {
      const reg = (eq.region || 'Unknown').trim();
      const m = parseFloat(eq.magnitude) || 0;
      const d = parseFloat(eq.depthkm) || 0;

      if (!regionMap[reg]) regionMap[reg] = { count: 0, maxM: 0 };
      regionMap[reg].count++;
      if (m > regionMap[reg].maxM) regionMap[reg].maxM = m;

      // Depth bins
      if (d <= 5) depthBins['0–5 km']++;
      else if (d <= 10) depthBins['5–10 km']++;
      else if (d <= 15) depthBins['10–15 km']++;
      else if (d <= 20) depthBins['15–20 km']++;
      else if (d <= 30) depthBins['20–30 km']++;
      else if (d <= 50) depthBins['30–50 km']++;
      else depthBins['> 50 km']++;

      // Matrix row (depth)
      let rIdx = 0;
      if (d < 10) rIdx = 0;
      else if (d <= 30) rIdx = 1;
      else rIdx = 2;

      // Matrix col (mag)
      let cIdx = 0;
      if (m < 3.0) cIdx = 0;
      else if (m < 4.5) cIdx = 1;
      else if (m < 6.0) cIdx = 2;
      else cIdx = 3;

      matrix[rIdx][cIdx]++;
    });

    // Top 15 Regions List with Tectonic Fault Zone Classification Tags
    if (topRegionsList) {
      const getRegionFaultTag = (name) => {
        const u = (name || '').toUpperCase();
        if (
          u.includes('KAHRAMANMARAS') || u.includes('MALATYA') || u.includes('HATAY') ||
          u.includes('ADIYAMAN') || u.includes('GAZIANTEP') || u.includes('ELAZIG') ||
          u.includes('SIVRICE') || u.includes('GOKSUN') || u.includes('DOGANSEHIR') ||
          u.includes('PAZARCIK') || u.includes('NURHAK') || u.includes('EASTERN TURKEY')
        ) {
          return { tag: 'EAFZ', cls: 'tag-eafz', belt: 'East Anatolian Fault Zone' };
        }
        if (
          u.includes('WESTERN TURKEY') || u.includes('AEGEAN') || u.includes('IZMIR') ||
          u.includes('MUGLA') || u.includes('DENIZLI') || u.includes('CANAKKALE') ||
          u.includes('MANISA') || u.includes('AYDIN')
        ) {
          return { tag: 'WAES', cls: 'tag-waes', belt: 'Western Aegean Extensional System' };
        }
        if (
          u.includes('CENTRAL TURKEY') || u.includes('TOKAT') || u.includes('DUZCE') ||
          u.includes('BOLU') || u.includes('BALIKESIR') || u.includes('MARMARA') ||
          u.includes('BURSA') || u.includes('NIKSAR') || u.includes('ERBAA')
        ) {
          return { tag: 'NAFZ', cls: 'tag-nafz', belt: 'North Anatolian Fault Zone' };
        }
        if (
          u.includes('CRETE') || u.includes('DODECANESE') || u.includes('CYPRUS') ||
          u.includes('MEDITERRANEAN') || u.includes('GREECE') || u.includes('RHODES')
        ) {
          return { tag: 'ARC', cls: 'tag-arc', belt: 'Hellenic-Cyprus Arc' };
        }
        return { tag: 'ZONE', cls: 'tag-border', belt: 'Border / Suture Collision Zone' };
      };

      const sortedRegions = Object.entries(regionMap)
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 15);
      const topMax = sortedRegions[0] ? sortedRegions[0][1].count : 1;

      topRegionsList.innerHTML = sortedRegions
        .map(([rName, rData], idx) => {
          const pct = Math.round((rData.count / topMax) * 100);
          const tagInfo = getRegionFaultTag(rName);
          return `
            <div class="region-row-ext" title="${rName}: ${rData.count.toLocaleString()} quakes • ${tagInfo.belt}">
              <span class="region-rank">#${idx + 1}</span>
              <span class="region-tag-ext ${tagInfo.cls}">${tagInfo.tag}</span>
              <span class="region-name-ext" title="${rName}">${rName}</span>
              <div class="region-bar-track-ext">
                <div class="region-bar-fill-ext" style="width: ${pct}%;"></div>
              </div>
              <span class="region-count-ext">${rData.count.toLocaleString()} <span style="color:#ef4444; font-size:0.66rem; font-weight:700;">(M${rData.maxM.toFixed(1)})</span></span>
            </div>
          `;
        })
        .join('');
    }

    // Depth vs Magnitude Cross Matrix Table
    if (matrixContainer) {
      let maxCell = 1;
      matrix.forEach((row) => row.forEach((val) => { if (val > maxCell) maxCell = val; }));

      const depthLabels = ['Shallow (< 10 km)', 'Interm. (10–30 km)', 'Deep (> 30 km)'];
      const magHeaders = ['M < 3.0', '3.0–4.4', '4.5–5.9', 'M ≥ 6.0'];

      let rowsHtml = '';
      matrix.forEach((row, rIdx) => {
        let cellsHtml = `<td><strong>${depthLabels[rIdx]}</strong></td>`;
        row.forEach((count, cIdx) => {
          const alpha = (0.05 + (count / maxCell) * 0.45).toFixed(2);
          const color = cIdx === 3 ? '#ec4899' : cIdx === 2 ? '#f59e0b' : '#38bdf8';
          cellsHtml += `
            <td style="background: rgba(56, 189, 248, ${alpha}); color: ${color};" title="${depthLabels[rIdx]} &bull; ${magHeaders[cIdx]}: ${count.toLocaleString()} quakes">
              ${count.toLocaleString()}
            </td>
          `;
        });
        rowsHtml += `<tr>${cellsHtml}</tr>`;
      });

      matrixContainer.innerHTML = `
        <table class="matrix-table">
          <thead>
            <tr>
              <th>Focal Depth \\ Mag</th>
              <th>M &lt; 3.0</th>
              <th>3.0 – 4.4</th>
              <th>4.5 – 5.9</th>
              <th>M &ge; 6.0</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      `;
    }

    // Depth Bins Histogram
    if (depthHistContainer) {
      const maxDepthCount = Math.max(1, ...Object.values(depthBins));
      depthHistContainer.innerHTML = Object.entries(depthBins)
        .map(([dLabel, dCount]) => {
          const pct = Math.round((dCount / maxDepthCount) * 100);
          const share = Math.round((dCount / (quakes.length || 1)) * 100);
          return `
            <div class="depth-hist-row">
              <span class="depth-hist-label">${dLabel}</span>
              <div class="depth-hist-track">
                <div class="depth-hist-fill" style="width: ${pct}%;"></div>
              </div>
              <span class="depth-hist-count">${dCount.toLocaleString()} (${share}%)</span>
            </div>
          `;
        })
        .join('');
    }
  }


  /* ==========================================================================
     Real-Time Clock & Periodic Auto-Refresh
     ========================================================================== */
  startRealtimeClock() {
    const elSync = document.getElementById('live-status-text');
    const update = () => {
      if (!elSync) return;
      const now = new Date();
      const timeStr = now.toLocaleTimeString('en-GB', {
        timeZone: 'Europe/Istanbul',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      });
      elSync.textContent = `${timeStr} UTC+3`;
    };
    update();
    setInterval(update, 1000);
  }

  startDatasetAutoRefresh() {
    if (this._datasetRefreshTimer) {
      clearInterval(this._datasetRefreshTimer);
    }
    // Automatically updates the dataset every 3 minutes (180,000 ms)
    this._datasetRefreshTimer = setInterval(async () => {
      // Do not interrupt chronological timeline replay if active
      if (this.state.playback.isPlaying) return;
      try {
        await this.refreshAll();
      } catch (err) {
        console.warn('Periodic 3-minute dataset refresh encountered an error:', err);
      }
    }, 180000);
  }

  /* ==========================================================================
     KPI & Feed Rendering
     ========================================================================== */
  renderKPIs(stats) {
    const elTotal = document.getElementById('kpi-total');
    const elMax = document.getElementById('kpi-max');
    const el24h = document.getElementById('kpi-24h');

    if (elTotal) elTotal.textContent = stats.total_count ? stats.total_count.toLocaleString() : '0';
    if (elMax) elMax.textContent = stats.max_magnitude ? `M${stats.max_magnitude.toFixed(1)}` : '-';
    if (el24h) el24h.textContent = stats.last_24h_count || '0';

    if (stats.sync) {
      const parentIndicator = document.querySelector('.live-indicator');
      if (parentIndicator) {
        const syncTime = stats.sync.last_sync_time_trt || stats.sync.last_sync_time || 'Just now';
        parentIndicator.title = `Turkey Time (UTC+3) • Real-Time Clock\nLast Dataset Update: ${syncTime}\nDataset Auto-Refresh: Every 3 minutes`;
      }
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
    // If selecting on mobile drawer, auto-dismiss drawer to reveal map focus
    if (window.innerWidth <= 768) {
      const sidebar = document.getElementById('sidebar');
      const backdrop = document.getElementById('sidebar-backdrop');
      if (sidebar && sidebar.classList.contains('mobile-open')) {
        sidebar.classList.remove('mobile-open', 'hover-peek');
        sidebar.classList.add('auto-hidden');
        if (backdrop) backdrop.classList.remove('active');
      }
    }
    this.playSeismicTone(eq.magnitude);
    this.mapEngine.focusEarthquake(eq);
  }

  getAudioContext() {
    if (!this._audioCtx || this._audioCtx.state === 'closed') {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        this._audioCtx = new AudioContextClass();
      }
    }
    if (this._audioCtx && this._audioCtx.state === 'suspended') {
      this._audioCtx.resume().catch(() => {});
    }
    return this._audioCtx;
  }

  playSeismicTone(mag) {
    if (!this.state.audioEnabled) return;
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const baseFreq = Math.max(55, 175 - (parseFloat(mag) * 15));
      osc.type = 'sine';
      osc.frequency.setValueAtTime(baseFreq, now);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.45);
    } catch (e) {}
  }

  playPlaybackTone(mag) {
    if (!this.state.audioEnabled) return;
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      // Lower frequency for higher magnitudes (deep tectonic rumble)
      const baseFreq = Math.max(50, 190 - (parseFloat(mag) * 16));
      osc.type = mag >= 6.0 ? 'sawtooth' : 'sine';
      osc.frequency.setValueAtTime(baseFreq, now);

      // Magnitude-scaled volume
      const peakGain = Math.min(0.25, 0.04 + Math.max(0, (mag - 3.0) * 0.04));
      const duration = mag >= 6.0 ? 0.32 : 0.16;

      gain.gain.setValueAtTime(peakGain, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + duration);

      // Extra sub-bass boom for massive earthquakes (M >= 6.5)
      if (mag >= 6.5) {
        const subOsc = ctx.createOscillator();
        const subGain = ctx.createGain();
        subOsc.type = 'triangle';
        subOsc.frequency.setValueAtTime(45, now);
        subGain.gain.setValueAtTime(0.2, now);
        subGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);
        subOsc.connect(subGain);
        subGain.connect(ctx.destination);
        subOsc.start(now);
        subOsc.stop(now + 0.45);
      }
    } catch (e) {}
  }

  playLiveAlertAlarm(event) {
    if (!this.state.audioEnabled) return;
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;
      const now = ctx.currentTime;

      // Alert chime 1: C5 (523.25 Hz)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'triangle';
      osc1.frequency.setValueAtTime(523.25, now);
      gain1.gain.setValueAtTime(0.18, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.18);

      // Alert chime 2: G5 (783.99 Hz)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(783.99, now + 0.16);
      gain2.gain.setValueAtTime(0.22, now + 0.16);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.16);
      osc2.stop(now + 0.55);

      // Resonant seismic low rumble if M >= 4.0
      const mag = parseFloat(event.magnitude) || 0;
      if (mag >= 4.0) {
        const subOsc = ctx.createOscillator();
        const subGain = ctx.createGain();
        subOsc.type = 'sawtooth';
        subOsc.frequency.setValueAtTime(Math.max(50, 110 - (mag * 8)), now + 0.12);
        subGain.gain.setValueAtTime(0.15, now + 0.12);
        subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.7);
        subOsc.connect(subGain);
        subGain.connect(ctx.destination);
        subOsc.start(now + 0.12);
        subOsc.stop(now + 0.7);
      }
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
    const originalText = syncBtn ? syncBtn.innerHTML : '';
    if (syncBtn) {
      syncBtn.disabled = true;
      syncBtn.innerHTML = '<span>⏳ Syncing...</span>';
    }

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
      if (syncBtn) {
        syncBtn.disabled = false;
        syncBtn.innerHTML = originalText;
      }
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
if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', () => {
    window.app = new TemasApp();
  });
} else {
  window.app = new TemasApp();
}
