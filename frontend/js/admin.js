(function() {
  'use strict';

  // State
  let adminKey = sessionStorage.getItem('temas_admin_key') || '';
  let backfillPollTimer = null;
  let statusPollTimer = null;

  // DOM Elements
  const authModal = document.getElementById('authModal');
  const authForm = document.getElementById('authForm');
  const adminKeyInput = document.getElementById('adminKeyInput');
  const authError = document.getElementById('authError');
  const authSubmitBtn = document.getElementById('authSubmitBtn');
  const adminDeck = document.getElementById('adminDeck');
  const logoutBtn = document.getElementById('logoutBtn');
  const deckTime = document.getElementById('deckTime');

  // Providers & Sync
  const providersGrid = document.getElementById('providersGrid');
  const syncAllBtn = document.getElementById('syncAllBtn');
  const refreshHealthBtn = document.getElementById('refreshHealthBtn');

  // Backfill
  const presetBtns = document.querySelectorAll('.preset-btn');
  const bfStart = document.getElementById('bfStart');
  const bfEnd = document.getElementById('bfEnd');
  const bfMag = document.getElementById('bfMag');
  const bfChunk = document.getElementById('bfChunk');
  const startBackfillBtn = document.getElementById('startBackfillBtn');
  const bfStatusText = document.getElementById('bfStatusText');
  const bfPercentText = document.getElementById('bfPercentText');
  const bfProgressBar = document.getElementById('bfProgressBar');
  const bfCurrentWindow = document.getElementById('bfCurrentWindow');
  const bfWindowsCount = document.getElementById('bfWindowsCount');
  const bfFetched = document.getElementById('bfFetched');
  const bfInserted = document.getElementById('bfInserted');
  const backfillLogs = document.getElementById('backfillLogs');

  // Database KPIs
  const kpiTotal = document.getElementById('kpiTotal');
  const kpiEarliest = document.getElementById('kpiEarliest');
  const kpiLatest = document.getElementById('kpiLatest');
  const kpiDbSize = document.getElementById('kpiDbSize');
  const yearsContainer = document.getElementById('yearsContainer');
  const magDistContainer = document.getElementById('magDistContainer');
  const vacuumDbBtn = document.getElementById('vacuumDbBtn');
  const downloadDbBtn = document.getElementById('downloadDbBtn');

  // Event Moderation
  const adminSearchRegion = document.getElementById('adminSearchRegion');
  const adminSearchMinMag = document.getElementById('adminSearchMinMag');
  const adminSearchBtn = document.getElementById('adminSearchBtn');
  const eventsTableBody = document.getElementById('eventsTableBody');
  const tableCountText = document.getElementById('tableCountText');
  const openManualEventBtn = document.getElementById('openManualEventBtn');
  const manualEventModal = document.getElementById('manualEventModal');
  const closeManualModalBtn = document.getElementById('closeManualModalBtn');
  const cancelManualModalBtn = document.getElementById('cancelManualModalBtn');
  const manualEventForm = document.getElementById('manualEventForm');

  // Helper for Authenticated Requests
  async function adminFetch(url, options = {}) {
    const headers = options.headers || {};
    headers['X-Admin-Key'] = adminKey;
    if (!(options.body instanceof FormData) && !headers['Content-Type'] && options.body) {
      headers['Content-Type'] = 'application/json';
    }
    const resp = await fetch(url, { ...options, headers });
    if (resp.status === 401) {
      lockDeck();
      throw new Error('Unauthorized');
    }
    return resp;
  }

  // Live UTC Clock
  function updateClock() {
    const now = new Date();
    deckTime.textContent = now.toISOString().replace('T', ' ').substring(11, 19) + ' UTC';
  }
  setInterval(updateClock, 1000);
  updateClock();

  // Authentication Flow
  async function verifyKey(keyToTest) {
    try {
      const res = await fetch('/api/admin/auth', {
        method: 'POST',
        headers: { 'X-Admin-Key': keyToTest }
      });
      return res.ok;
    } catch (e) {
      return false;
    }
  }

  async function unlockDeck() {
    authModal.classList.add('hidden');
    adminDeck.classList.remove('hidden');
    downloadDbBtn.href = `/api/admin/db/download?key=${encodeURIComponent(adminKey)}`;
    await loadDeckData();
    await loadEventsTable();
    startPolling();
  }

  function lockDeck() {
    adminKey = '';
    sessionStorage.removeItem('temas_admin_key');
    authModal.classList.remove('hidden');
    adminDeck.classList.add('hidden');
    adminKeyInput.value = '';
    stopPolling();
  }

  authForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const key = adminKeyInput.value.trim();
    authSubmitBtn.textContent = 'Verifying...';
    authError.classList.add('hidden');

    const valid = await verifyKey(key);
    authSubmitBtn.textContent = 'Unlock Control Deck';

    if (valid) {
      adminKey = key;
      sessionStorage.setItem('temas_admin_key', key);
      unlockDeck();
    } else {
      authError.classList.remove('hidden');
    }
  });

  logoutBtn.addEventListener('click', lockDeck);

  // Auto-login if key is already stored
  if (adminKey) {
    verifyKey(adminKey).then((valid) => {
      if (valid) {
        unlockDeck();
      } else {
        lockDeck();
      }
    });
  }

  // Load Main Deck Data
  async function loadDeckData() {
    try {
      const res = await adminFetch('/api/admin/status');
      const data = await res.json();
      renderProviders(data.providers);
      renderDatabaseKPIs(data.database);
      updateBackfillUI(data.backfill_state);
    } catch (err) {
      console.error('Failed to load admin deck data:', err);
    }
  }

  // Render Providers Matrix
  function renderProviders(providers) {
    if (!providers) return;
    providersGrid.innerHTML = '';

    Object.keys(providers).forEach((key) => {
      const p = providers[key];
      const isOnline = p.status === 'online';
      const card = document.createElement('div');
      card.className = 'provider-card';
      card.innerHTML = `
        <div class="prov-header">
          <div>
            <div class="prov-title">${p.name}</div>
            <div class="prov-role">${p.role}</div>
          </div>
          <div class="prov-badge ${isOnline ? 'badge-online' : 'badge-error'}">
            <span class="dot-live"></span>
            <span>${p.status}</span>
          </div>
        </div>

        <div class="prov-metrics-strip">
          <div class="metric-cell">
            <span class="m-label">LATENCY</span>
            <span class="m-val text-cyan">${p.latency_ms || 0} ms</span>
          </div>
          <div class="metric-cell">
            <span class="m-label">FETCHED</span>
            <span class="m-val">${Number(p.last_fetched || 0).toLocaleString()}</span>
          </div>
          <div class="metric-cell">
            <span class="m-label">LAST SYNC</span>
            <span class="m-val">${p.last_sync ? p.last_sync.split(' ')[1] : 'Never'}</span>
          </div>
        </div>

        <div class="prov-foot-row">
          <span>${p.last_error ? '⚠️ ' + p.last_error.substring(0, 30) : 'Telemetry active & healthy'}</span>
          <button class="btn-sync-single" onclick="window.temasAdmin.syncProvider('${key}')">Sync Now</button>
        </div>
      `;
      providersGrid.appendChild(card);
    });
  }

  // Render Database KPIs
  function renderDatabaseKPIs(db) {
    if (!db) return;
    kpiTotal.textContent = Number(db.total_records || 0).toLocaleString();
    kpiEarliest.textContent = db.earliest_date ? db.earliest_date.split(' ')[0] : '—';
    kpiLatest.textContent = db.latest_date ? db.latest_date : '—';
    kpiDbSize.textContent = `${db.db_size_mb || 0} MB (WAL: ${db.wal_size_mb || 0} MB)`;

    // Years
    yearsContainer.innerHTML = '';
    (db.by_year || []).forEach((y) => {
      const pill = document.createElement('div');
      pill.className = 'year-pill';
      pill.innerHTML = `
        <span class="year-pill-name">${y.year}</span>
        <span class="year-pill-count">${Number(y.count).toLocaleString()}</span>
        <span style="font-size: 0.75rem; color: #f59e0b">M${y.max_mag}</span>
      `;
      yearsContainer.appendChild(pill);
    });

    // Magnitude Distribution
    magDistContainer.innerHTML = '';
    const magDist = db.magnitude_distribution || {};
    const maxVal = Math.max(...Object.values(magDist), 1);

    Object.entries(magDist).forEach(([label, count]) => {
      const pct = Math.round((count / maxVal) * 100);
      const row = document.createElement('div');
      row.className = 'mag-row';
      row.innerHTML = `
        <span class="mag-tag">${label}</span>
        <div class="mag-bar-track">
          <div class="mag-bar-fill" style="width: ${pct}%"></div>
        </div>
        <span class="mag-count">${Number(count).toLocaleString()}</span>
      `;
      magDistContainer.appendChild(row);
    });
  }

  // Presets selector
  presetBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      presetBtns.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      bfStart.value = btn.dataset.start;
      bfEnd.value = btn.dataset.end;
      bfMag.value = btn.dataset.mag;
    });
  });

  // Launch Backfill
  startBackfillBtn.addEventListener('click', async () => {
    const req = {
      start_date: bfStart.value,
      end_date: bfEnd.value,
      min_mag: parseFloat(bfMag.value),
      chunk_days: parseInt(bfChunk.value, 10)
    };

    startBackfillBtn.disabled = true;
    startBackfillBtn.textContent = 'Queuing...';

    try {
      const res = await adminFetch('/api/admin/backfill', {
        method: 'POST',
        body: JSON.stringify(req)
      });
      const data = await res.json();
      if (!res.ok || data.status === 'busy') {
        alert(data.message || 'Error starting backfill');
      } else {
        startBackfillPolling();
      }
    } catch (e) {
      alert('Failed to trigger backfill: ' + e.message);
    } finally {
      startBackfillBtn.disabled = false;
      startBackfillBtn.textContent = '🚀 Start Backfill';
    }
  });

  // Backfill UI Updater
  function updateBackfillUI(state) {
    if (!state) return;
    bfStatusText.textContent = `Status: ${state.status.toUpperCase()}`;
    bfPercentText.textContent = `${state.progress_pct || 0}%`;
    bfProgressBar.style.width = `${state.progress_pct || 0}%`;
    bfCurrentWindow.textContent = state.current_window || '—';
    bfWindowsCount.textContent = `${state.completed_windows || 0} / ${state.total_windows || 0}`;
    bfFetched.textContent = Number(state.total_fetched || 0).toLocaleString();
    bfInserted.textContent = Number(state.total_inserted || 0).toLocaleString();

    // Render logs
    if (state.logs && state.logs.length) {
      backfillLogs.innerHTML = state.logs.map((l) => `<div class="log-line">${l}</div>`).join('');
      backfillLogs.scrollTop = backfillLogs.scrollHeight;
    }
  }

  // Poll backfill job
  function startBackfillPolling() {
    if (backfillPollTimer) clearInterval(backfillPollTimer);
    backfillPollTimer = setInterval(async () => {
      try {
        const res = await adminFetch('/api/admin/backfill/status');
        const state = await res.json();
        updateBackfillUI(state);

        if (!state.is_running) {
          clearInterval(backfillPollTimer);
          backfillPollTimer = null;
          // Refresh database KPIs after backfill complete
          loadDeckData();
          loadEventsTable();
        }
      } catch (e) {
        clearInterval(backfillPollTimer);
      }
    }, 1500);
  }

  // Vacuum & Optimize DB
  vacuumDbBtn.addEventListener('click', async () => {
    if (!confirm('Run VACUUM and rebuild SQLite B-Trees? This optimizes storage footprint.')) return;
    vacuumDbBtn.disabled = true;
    vacuumDbBtn.textContent = 'Optimizing...';
    try {
      const res = await adminFetch('/api/admin/db/vacuum', { method: 'POST' });
      const data = await res.json();
      alert(`Optimization complete! Saved: ${data.saved_kb} KB. Current DB size: ${data.after_mb} MB.`);
      await loadDeckData();
    } catch (e) {
      alert('Vacuum failed: ' + e.message);
    } finally {
      vacuumDbBtn.disabled = false;
      vacuumDbBtn.textContent = '🧹 Vacuum & Optimize DB';
    }
  });

  // Global Sync Button
  syncAllBtn.addEventListener('click', async () => {
    syncAllBtn.disabled = true;
    syncAllBtn.textContent = 'Syncing all sources...';
    try {
      const res = await adminFetch('/api/admin/sync/all', { method: 'POST' });
      const data = await res.json();
      alert(`Sync finished! Fetched: ${data.fetched}, Newly inserted: ${data.inserted}.`);
      await loadDeckData();
      await loadEventsTable();
    } catch (e) {
      alert('Sync failed: ' + e.message);
    } finally {
      syncAllBtn.disabled = false;
      syncAllBtn.textContent = '⚡ Sync All Sources Now';
    }
  });

  refreshHealthBtn.addEventListener('click', loadDeckData);

  // Sync specific provider
  window.temasAdmin = {
    async syncProvider(providerName) {
      try {
        const res = await adminFetch(`/api/admin/sync/${providerName}`, { method: 'POST' });
        const data = await res.json();
        alert(`[${providerName.toUpperCase()}] Fetched: ${data.fetched}, Inserted: ${data.inserted}, Latency: ${data.latency_ms}ms`);
        await loadDeckData();
        await loadEventsTable();
      } catch (e) {
        alert('Sync error: ' + e.message);
      }
    },

    async deleteEvent(timeUtc, lat, lon) {
      if (!confirm(`Permanently delete event at ${timeUtc} (${lat}, ${lon})?`)) return;
      try {
        const res = await adminFetch('/api/admin/earthquakes', {
          method: 'DELETE',
          body: JSON.stringify({
            origintimeutc: timeUtc,
            latitude: parseFloat(lat),
            longitude: parseFloat(lon)
          })
        });
        if (res.ok) {
          await loadEventsTable();
          await loadDeckData();
        } else {
          alert('Delete failed');
        }
      } catch (e) {
        alert('Error: ' + e.message);
      }
    }
  };

  // Event Moderation Table
  async function loadEventsTable() {
    const region = adminSearchRegion.value.trim();
    const minMag = adminSearchMinMag.value;
    let url = `/api/earthquakes?limit=25`;
    if (region) url += `&region=${encodeURIComponent(region)}`;
    if (minMag) url += `&min_magnitude=${encodeURIComponent(minMag)}`;

    eventsTableBody.innerHTML = '<tr><td colspan="8" class="text-center">Loading events...</td></tr>';

    try {
      const res = await fetch(url);
      const data = await res.json();
      tableCountText.textContent = `Showing ${data.count} of ${data.total} matches`;

      if (!data.items || !data.items.length) {
        eventsTableBody.innerHTML = '<tr><td colspan="8" class="text-center">No matching records found.</td></tr>';
        return;
      }

      eventsTableBody.innerHTML = data.items.map((ev) => {
        let magClass = 'light';
        if (ev.magnitude >= 6.0) magClass = 'major';
        else if (ev.magnitude >= 4.5) magClass = 'mod';

        return `
          <tr>
            <td>${ev.origintimeutc}</td>
            <td><span class="mag-badge ${magClass}">M${ev.magnitude}</span></td>
            <td>${ev.magtype || 'ML'}</td>
            <td>${ev.latitude.toFixed(2)}°, ${ev.longitude.toFixed(2)}°</td>
            <td>${ev.depthkm} km</td>
            <td>${ev.region}</td>
            <td><span style="font-size:0.75rem">${ev.measmethod || 'N/A'}</span></td>
            <td>
              <button class="btn-del" onclick="window.temasAdmin.deleteEvent('${ev.origintimeutc}', ${ev.latitude}, ${ev.longitude})">Delete</button>
            </td>
          </tr>
        `;
      }).join('');
    } catch (e) {
      eventsTableBody.innerHTML = '<tr><td colspan="8" class="text-center error-msg">Failed to load events.</td></tr>';
    }
  }

  adminSearchBtn.addEventListener('click', loadEventsTable);
  adminSearchRegion.addEventListener('keypress', (e) => { if (e.key === 'Enter') loadEventsTable(); });

  // Manual Event Injection Modal
  openManualEventBtn.addEventListener('click', () => {
    manualEventModal.classList.remove('hidden');
    const now = new Date();
    document.getElementById('manTime').value = now.toISOString().replace('T', ' ').substring(0, 19);
  });

  closeManualModalBtn.addEventListener('click', () => manualEventModal.classList.add('hidden'));
  cancelManualModalBtn.addEventListener('click', () => manualEventModal.classList.add('hidden'));

  manualEventForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const newEvent = {
      origintimeutc: document.getElementById('manTime').value.trim(),
      magnitude: parseFloat(document.getElementById('manMag').value),
      magtype: document.getElementById('manType').value,
      latitude: parseFloat(document.getElementById('manLat').value),
      longitude: parseFloat(document.getElementById('manLon').value),
      depthkm: parseFloat(document.getElementById('manDepth').value),
      region: document.getElementById('manRegion').value.trim(),
      measmethod: 'MANUAL-OPERATOR',
      attribute: 'VERIFIED-REVIEWED'
    };

    try {
      const res = await adminFetch('/api/admin/earthquakes', {
        method: 'POST',
        body: JSON.stringify(newEvent)
      });
      const data = await res.json();
      if (res.ok) {
        alert('Event registered successfully!');
        manualEventModal.classList.add('hidden');
        manualEventForm.reset();
        await loadEventsTable();
        await loadDeckData();
      } else {
        alert(data.message || 'Failed to save event');
      }
    } catch (err) {
      alert('Error saving event: ' + err.message);
    }
  });

  // Polling
  function startPolling() {
    if (statusPollTimer) clearInterval(statusPollTimer);
    statusPollTimer = setInterval(loadDeckData, 15000); // 15 seconds
  }

  function stopPolling() {
    if (statusPollTimer) clearInterval(statusPollTimer);
    if (backfillPollTimer) clearInterval(backfillPollTimer);
    statusPollTimer = null;
    backfillPollTimer = null;
  }

})();
