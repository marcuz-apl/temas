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
  const presetBtns = document.querySelectorAll('.preset-btn, .preset-pill');
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
  const kpiWalFoot = document.getElementById('kpiWalFoot');
  const yearsContainer = document.getElementById('yearsContainer');
  const magDistContainer = document.getElementById('magDistContainer');
  const flushWalBtn = document.getElementById('flushWalBtn');
  const vacuumDbBtn = document.getElementById('vacuumDbBtn');
  const deduplicateDbBtn = document.getElementById('deduplicateDbBtn');
  const purgeNoiseBtn = document.getElementById('purgeNoiseBtn');
  const downloadDbBtn = document.getElementById('downloadDbBtn');

  // Event Moderation & Pagination
  const adminSearchRegion = document.getElementById('adminSearchRegion');
  const adminSearchSource = document.getElementById('adminSearchSource');
  const adminSearchScale = document.getElementById('adminSearchScale');
  const adminSearchMinMag = document.getElementById('adminSearchMinMag');
  const adminSearchBtn = document.getElementById('adminSearchBtn');
  const adminResetFilterBtn = document.getElementById('adminResetFilterBtn');
  const eventsTableBody = document.getElementById('eventsTableBody');
  const tableCountText = document.getElementById('tableCountText');
  const openManualEventBtn = document.getElementById('openManualEventBtn');
  const manualEventModal = document.getElementById('manualEventModal');
  const closeManualModalBtn = document.getElementById('closeManualModalBtn');
  const cancelManualModalBtn = document.getElementById('cancelManualModalBtn');
  const manualEventForm = document.getElementById('manualEventForm');

  // Pagination Controls
  const pageRangeText = document.getElementById('pageRangeText');
  const pageSizeSelect = document.getElementById('pageSizeSelect');
  const btnPageFirst = document.getElementById('btnPageFirst');
  const btnPagePrev = document.getElementById('btnPagePrev');
  const currentPageNum = document.getElementById('currentPageNum');
  const totalPagesNum = document.getElementById('totalPagesNum');
  const btnPageNext = document.getElementById('btnPageNext');
  const btnPageLast = document.getElementById('btnPageLast');

  let currentPage = 1;
  let pageSize = 25;
  let totalEventsCount = 0;

  // Sync Result Modal Elements
  const syncResultModal = document.getElementById('syncResultModal');
  const closeSyncModalBtn = document.getElementById('closeSyncModalBtn');
  const okSyncModalBtn = document.getElementById('okSyncModalBtn');
  const syncModalFetched = document.getElementById('syncModalFetched');
  const syncModalInserted = document.getElementById('syncModalInserted');
  const syncModalLatency = document.getElementById('syncModalLatency');
  const syncModalProviders = document.getElementById('syncModalProviders');

  // Confirm Modal Elements
  const confirmModal = document.getElementById('confirmModal');
  const confirmModalTitle = document.getElementById('confirmModalTitle');
  const confirmModalMessage = document.getElementById('confirmModalMessage');
  const confirmModalIcon = document.getElementById('confirmModalIcon');
  const okConfirmModalBtn = document.getElementById('okConfirmModalBtn');
  const cancelConfirmModalBtn = document.getElementById('cancelConfirmModalBtn');
  const closeConfirmModalBtn = document.getElementById('closeConfirmModalBtn');

  // Change Password Modal Elements
  const openChangePwdBtn = document.getElementById('openChangePwdBtn');
  const changePwdModal = document.getElementById('changePwdModal');
  const closeChangePwdBtn = document.getElementById('closeChangePwdBtn');
  const cancelChangePwdBtn = document.getElementById('cancelChangePwdBtn');
  const changePwdForm = document.getElementById('changePwdForm');
  const currentPwdInput = document.getElementById('currentPwdInput');
  const newPwdInput = document.getElementById('newPwdInput');
  const confirmPwdInput = document.getElementById('confirmPwdInput');
  const changePwdError = document.getElementById('changePwdError');
  const submitChangePwdBtn = document.getElementById('submitChangePwdBtn');

  // ==========================================
  // IN-APP NOTIFICATIONS & CLIENT POPUPS
  // ==========================================

  function showToast(title, message, type = 'info', duration = 4500) {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    const icons = { success: '✅', error: '❌', warning: '⚠️', info: '📡' };
    toast.innerHTML = `
      <span class="toast-icon">${icons[type] || '📡'}</span>
      <div class="toast-content">
        <div class="toast-title">${title}</div>
        <div class="toast-body">${message}</div>
      </div>
    `;
    container.appendChild(toast);
    setTimeout(() => {
      toast.classList.add('toast-hiding');
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }

  function showConfirmDialog({ title, message, icon = '⚠️', confirmText = 'Confirm & Execute', onConfirm }) {
    if (!confirmModal) {
      if (confirm(message)) onConfirm();
      return;
    }

    confirmModalTitle.textContent = title;
    confirmModalMessage.textContent = message;
    confirmModalIcon.textContent = icon;
    okConfirmModalBtn.textContent = confirmText;

    function close() {
      confirmModal.classList.add('hidden');
      okConfirmModalBtn.onclick = null;
      cancelConfirmModalBtn.onclick = null;
      closeConfirmModalBtn.onclick = null;
    }

    okConfirmModalBtn.onclick = () => {
      close();
      onConfirm();
    };
    cancelConfirmModalBtn.onclick = close;
    closeConfirmModalBtn.onclick = close;

    confirmModal.classList.remove('hidden');
  }

  function closeSyncModal() {
    if (syncResultModal) syncResultModal.classList.add('hidden');
  }

  if (closeSyncModalBtn) closeSyncModalBtn.addEventListener('click', closeSyncModal);
  if (okSyncModalBtn) okSyncModalBtn.addEventListener('click', closeSyncModal);

  function showSyncModal(result, providerName = null) {
    if (!syncResultModal) {
      showToast('Sync Finished', `Fetched: ${result.fetched || 0}, Stored: ${result.inserted || 0}`, 'success');
      return;
    }

    if (providerName) {
      // Single provider sync report
      syncModalFetched.textContent = Number(result.fetched || 0).toLocaleString();
      syncModalInserted.textContent = Number(result.inserted || 0).toLocaleString();
      syncModalLatency.textContent = `${result.latency_ms || 0} ms`;

      const isSuccess = result.status === 'success';
      syncModalProviders.innerHTML = `
        <div class="sync-prov-item">
          <div class="sync-prov-info">
            <div class="sync-prov-name">
              <span>${providerName.toUpperCase()}</span>
              <span class="prov-badge ${isSuccess ? 'badge-online' : 'badge-error'}">${result.status}</span>
            </div>
            <div class="sync-prov-meta">${result.message || 'On-demand single provider ingestion completed'}</div>
          </div>
          <div class="sync-prov-metrics">
            <div class="sync-metric-pill">
              <span class="sync-m-label">LATENCY</span>
              <span class="sync-m-val text-cyan">${result.latency_ms || 0} ms</span>
            </div>
            <div class="sync-metric-pill">
              <span class="sync-m-label">FETCHED</span>
              <span class="sync-m-val">${result.fetched || 0}</span>
            </div>
            <div class="sync-metric-pill">
              <span class="sync-m-label">STORED (M≥2.0)</span>
              <span class="sync-m-val text-emerald">+${result.inserted || 0}</span>
            </div>
          </div>
        </div>
      `;
    } else {
      // Full multi-tier sync report
      syncModalFetched.textContent = Number(result.fetched || 0).toLocaleString();
      syncModalInserted.textContent = Number(result.inserted || 0).toLocaleString();

      const provs = result.providers || {};
      let maxLatency = 0;
      let provHtml = '';

      Object.keys(provs).forEach((key) => {
        const p = provs[key];
        if (p.latency_ms && p.latency_ms > maxLatency) maxLatency = p.latency_ms;
        const isSuccess = p.status === 'success';
        provHtml += `
          <div class="sync-prov-item">
            <div class="sync-prov-info">
              <div class="sync-prov-name">
                <span>${key.toUpperCase()}</span>
                <span class="prov-badge ${isSuccess ? 'badge-online' : 'badge-error'}">${p.status}</span>
              </div>
              <div class="sync-prov-meta">${p.message || 'Telemetry synchronized & verified'}</div>
            </div>
            <div class="sync-prov-metrics">
              <div class="sync-metric-pill">
                <span class="sync-m-label">LATENCY</span>
                <span class="sync-m-val text-cyan">${p.latency_ms || 0} ms</span>
              </div>
              <div class="sync-metric-pill">
                <span class="sync-m-label">FETCHED</span>
                <span class="sync-m-val">${p.fetched || 0}</span>
              </div>
              <div class="sync-metric-pill">
                <span class="sync-m-label">STORED (M≥2.0)</span>
                <span class="sync-m-val text-emerald">+${p.inserted || 0}</span>
              </div>
            </div>
          </div>
        `;
      });

      syncModalLatency.textContent = `${maxLatency || 0} ms`;
      syncModalProviders.innerHTML = provHtml || '<div class="text-muted">No provider breakdown returned.</div>';
    }

    syncResultModal.classList.remove('hidden');
  }

  // ==========================================
  // AUTHENTICATION
  // ==========================================

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

  function updateClock() {
    const now = new Date();
    deckTime.textContent = now.toLocaleTimeString('en-GB', { timeZone: 'Europe/Istanbul', hour12: false }) + ' UTC+3';
  }
  setInterval(updateClock, 1000);
  updateClock();

  async function loadVersion() {
    try {
      const res = await fetch('/api/health');
      if (res.ok) {
        const data = await res.json();
        const ver = data.version || 'v2.12.0';
        const authVer = document.getElementById('auth-version-text');
        if (authVer) authVer.textContent = ver.split('+')[0];
        const deckVer = document.getElementById('admin-version-badge');
        if (deckVer) deckVer.textContent = ver;
        const aboutVer = document.getElementById('aboutModalVersion');
        if (aboutVer) aboutVer.textContent = `OPERATIONS CONTROL DECK • ${ver}`;
      }
    } catch (err) {
      console.warn('Could not load version from /api/health:', err);
    }
  }
  loadVersion();

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
    if (downloadDbBtn) {
      downloadDbBtn.href = `/api/admin/db/download?key=${encodeURIComponent(adminKey)}`;
    }
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
    authSubmitBtn.textContent = 'Authorize Access';

    if (valid) {
      adminKey = key;
      sessionStorage.setItem('temas_admin_key', key);
      unlockDeck();
      showToast('Deck Unlocked', 'Operations control session authorized', 'success');
    } else {
      authError.classList.remove('hidden');
    }
  });

  // Change Password Modal Actions
  function openChangePasswordModal() {
    if (!changePwdModal) return;
    changePwdModal.classList.remove('hidden');
    changePwdForm.reset();
    if (changePwdError) changePwdError.classList.add('hidden');
    if (currentPwdInput) currentPwdInput.focus();
  }

  function closeChangePasswordModal() {
    if (changePwdModal) changePwdModal.classList.add('hidden');
  }

  if (openChangePwdBtn) openChangePwdBtn.addEventListener('click', openChangePasswordModal);
  if (closeChangePwdBtn) closeChangePwdBtn.addEventListener('click', closeChangePasswordModal);
  if (cancelChangePwdBtn) cancelChangePwdBtn.addEventListener('click', closeChangePasswordModal);

  // About TEMAS Modal Actions
  const openAboutBtn = document.getElementById('openAboutBtn');
  const aboutModal = document.getElementById('aboutModal');
  const closeAboutModalBtn = document.getElementById('closeAboutModalBtn');
  const okAboutModalBtn = document.getElementById('okAboutModalBtn');

  function openAboutModal() {
    if (aboutModal) aboutModal.classList.remove('hidden');
  }

  function closeAboutModal() {
    if (aboutModal) aboutModal.classList.add('hidden');
  }

  if (openAboutBtn) openAboutBtn.addEventListener('click', openAboutModal);
  if (closeAboutModalBtn) closeAboutModalBtn.addEventListener('click', closeAboutModal);
  if (okAboutModalBtn) okAboutModalBtn.addEventListener('click', closeAboutModal);

  if (aboutModal) {
    aboutModal.addEventListener('click', (e) => {
      if (e.target === aboutModal) closeAboutModal();
    });
  }

  // Universal Escape key listener for modal dismissal
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeAboutModal();
      closeChangePasswordModal();
      if (confirmModal) confirmModal.classList.add('hidden');
      const syncModal = document.getElementById('syncResultModal');
      if (syncModal) syncModal.classList.add('hidden');
    }
  });

  if (changePwdForm) {
    changePwdForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const currentPwd = currentPwdInput.value.trim();
      const newPwd = newPwdInput.value.trim();
      const confirmPwd = confirmPwdInput.value.trim();

      if (changePwdError) changePwdError.classList.add('hidden');

      if (newPwd !== confirmPwd) {
        if (changePwdError) {
          changePwdError.textContent = 'New passwords do not match.';
          changePwdError.classList.remove('hidden');
        }
        return;
      }

      if (newPwd.length < 6) {
        if (changePwdError) {
          changePwdError.textContent = 'New password must be at least 6 characters long.';
          changePwdError.classList.remove('hidden');
        }
        return;
      }

      submitChangePwdBtn.disabled = true;
      submitChangePwdBtn.textContent = 'Updating...';

      try {
        const res = await adminFetch('/api/admin/change-password', {
          method: 'POST',
          body: JSON.stringify({
            current_password: currentPwd,
            new_password: newPwd
          })
        });
        const data = await res.json();
        if (res.ok) {
          adminKey = newPwd;
          sessionStorage.setItem('temas_admin_key', newPwd);
          if (downloadDbBtn) {
            downloadDbBtn.href = `/api/admin/db/download?key=${encodeURIComponent(adminKey)}`;
          }
          closeChangePasswordModal();
          showToast('Passkey Updated', 'Admin master password has been successfully updated and saved.', 'success');
        } else {
          if (changePwdError) {
            changePwdError.textContent = data.detail || data.message || 'Failed to update password.';
            changePwdError.classList.remove('hidden');
          }
        }
      } catch (err) {
        if (changePwdError) {
          changePwdError.textContent = err.message || 'Network error updating password.';
          changePwdError.classList.remove('hidden');
        }
      } finally {
        submitChangePwdBtn.disabled = false;
        submitChangePwdBtn.textContent = 'Save New Password';
      }
    });
  }

  logoutBtn.addEventListener('click', lockDeck);

  if (adminKey) {
    verifyKey(adminKey).then((valid) => {
      if (valid) {
        unlockDeck();
      } else {
        lockDeck();
      }
    });
  }

  // ==========================================
  // DATA RENDERING
  // ==========================================

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

  function renderProviders(providers) {
    if (!providers || !providersGrid) return;
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

  function renderDatabaseKPIs(db) {
    if (!db) return;
    if (kpiTotal) kpiTotal.textContent = Number(db.total_records || 0).toLocaleString();
    if (kpiEarliest) kpiEarliest.textContent = db.earliest_date ? db.earliest_date.split(' ')[0] : '—';
    if (kpiLatest) kpiLatest.textContent = db.latest_date ? db.latest_date : '—';
    if (kpiDbSize) kpiDbSize.textContent = `${db.db_size_mb || 0} MB`;
    if (kpiWalFoot) kpiWalFoot.textContent = `WAL: ${db.wal_size_mb || 0} MB • Active`;

    // Years
    if (yearsContainer) {
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
    }

    // Magnitude Distribution
    if (magDistContainer) {
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
  }

  // Presets selector
  presetBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      presetBtns.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      if (bfStart) bfStart.value = btn.dataset.start;
      if (bfEnd) bfEnd.value = btn.dataset.end;
      if (bfMag) bfMag.value = btn.dataset.mag;
    });
  });

  // Launch Backfill
  if (startBackfillBtn) {
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
          showToast('Backfill Notice', data.message || 'Error starting backfill', 'warning');
        } else {
          showToast('Backfill Queued', `Running ${req.start_date} to ${req.end_date}`, 'info');
          startBackfillPolling();
        }
      } catch (e) {
        showToast('Backfill Error', e.message, 'error');
      } finally {
        startBackfillBtn.disabled = false;
        startBackfillBtn.textContent = '🚀 Launch Backfill Job';
      }
    });
  }

  function updateBackfillUI(state) {
    if (!state) return;
    if (bfStatusText) bfStatusText.textContent = `STATUS: ${state.status.toUpperCase()}`;
    if (bfPercentText) bfPercentText.textContent = `${state.progress_pct || 0}%`;
    if (bfProgressBar) bfProgressBar.style.width = `${state.progress_pct || 0}%`;
    if (bfCurrentWindow) bfCurrentWindow.textContent = state.current_window || '—';
    if (bfWindowsCount) bfWindowsCount.textContent = `${state.completed_windows || 0} / ${state.total_windows || 0}`;
    if (bfFetched) bfFetched.textContent = Number(state.total_fetched || 0).toLocaleString();
    if (bfInserted) bfInserted.textContent = Number(state.total_inserted || 0).toLocaleString();

    if (backfillLogs && state.logs && state.logs.length) {
      backfillLogs.innerHTML = state.logs.map((l) => `<div class="log-entry">${l}</div>`).join('');
      backfillLogs.scrollTop = backfillLogs.scrollHeight;
    }
  }

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
          showToast('Backfill Complete', `Total newly inserted: ${state.total_inserted || 0}`, 'success');
          loadDeckData();
          loadEventsTable();
        }
      } catch (e) {
        clearInterval(backfillPollTimer);
      }
    }, 1500);
  }

  // Flush & Empty WAL
  if (flushWalBtn) {
    flushWalBtn.addEventListener('click', () => {
      showConfirmDialog({
        title: 'FLUSH & TRUNCATE SQLITE WAL',
        message: 'Commit all write-ahead log transactions into the main database and truncate the .db-wal file to 0 bytes?',
        confirmText: 'Flush WAL File',
        onConfirm: async () => {
          flushWalBtn.disabled = true;
          flushWalBtn.textContent = 'Flushing...';
          try {
            const res = await adminFetch('/api/admin/db/checkpoint-wal', { method: 'POST' });
            const data = await res.json();
            showToast('WAL Flushed & Truncated', `Reclaimed: ${data.reclaimed_kb} KB. WAL is now ${data.wal_after_mb} MB`, 'success');
            await loadDeckData();
          } catch (e) {
            showToast('Checkpoint Error', e.message, 'error');
          } finally {
            flushWalBtn.disabled = false;
            flushWalBtn.innerHTML = `
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="23 4 23 10 17 10"></polyline>
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
              </svg>
              Flush &amp; Truncate WAL
            `;
          }
        }
      });
    });
  }

  // Vacuum & Optimize DB
  if (vacuumDbBtn) {
    vacuumDbBtn.addEventListener('click', () => {
      showConfirmDialog({
        title: 'REBUILD B-TREES & VACUUM',
        message: 'Defragment SQLite storage and rebuild spatial indexes? This operation reclaims unused disk footprint.',
        confirmText: 'Execute Vacuum',
        onConfirm: async () => {
          vacuumDbBtn.disabled = true;
          vacuumDbBtn.textContent = 'Optimizing...';
          try {
            const res = await adminFetch('/api/admin/db/vacuum', { method: 'POST' });
            const data = await res.json();
            showToast('Database Optimized', `Saved: ${data.saved_kb} KB. Current DB size: ${data.after_mb} MB`, 'success');
            await loadDeckData();
          } catch (e) {
            showToast('Vacuum Error', e.message, 'error');
          } finally {
            vacuumDbBtn.disabled = false;
            vacuumDbBtn.innerHTML = `
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
              </svg>
              Rebuild B-Trees (Vacuum)
            `;
          }
        }
      });
    });
  }

  // Deduplicate Catalog
  if (deduplicateDbBtn) {
    deduplicateDbBtn.addEventListener('click', () => {
      showConfirmDialog({
        title: 'DEDUPLICATE SEISMIC CATALOG',
        message: 'Scan the database, purge all identical duplicate records, and enforce the UNIQUE index constraint? This guarantees zero duplicates across all years.',
        confirmText: 'Remove Duplicates',
        onConfirm: async () => {
          deduplicateDbBtn.disabled = true;
          deduplicateDbBtn.textContent = 'Deduplicating...';
          try {
            const res = await adminFetch('/api/admin/db/deduplicate', { method: 'POST' });
            const data = await res.json();
            const purged = Number(data.purged_duplicates || 0);
            if (purged > 0) {
              showToast('Duplicates Removed', `Purged ${purged.toLocaleString()} duplicate records. ${Number(data.remaining_unique || 0).toLocaleString()} unique events remaining.`, 'success');
            } else {
              showToast('Catalog Pristine', 'No duplicate records found. All events are 100% unique.', 'info');
            }
            await loadDeckData();
            await loadEventsTable(1);
          } catch (e) {
            showToast('Deduplication Error', e.message, 'error');
          } finally {
            deduplicateDbBtn.disabled = false;
            deduplicateDbBtn.innerHTML = `
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
              Remove Duplicates
            `;
          }
        }
      });
    });
  }

  // Purge Sub-Threshold Noise (< M2.0)
  if (purgeNoiseBtn) {
    purgeNoiseBtn.addEventListener('click', () => {
      showConfirmDialog({
        title: 'PURGE SUB-THRESHOLD NOISE',
        message: 'Permanently purge micro-tremor records below magnitude 2.0 (ambient seismic noise) and defragment SQLite storage?',
        confirmText: 'Purge Noise (< M2.0)',
        onConfirm: async () => {
          purgeNoiseBtn.disabled = true;
          purgeNoiseBtn.textContent = 'Purging...';
          try {
            const res = await adminFetch('/api/admin/db/purge-noise?min_mag=2.0', { method: 'POST' });
            const data = await res.json();
            const purgedCount = Number(data.purged_records || 0);
            if (purgedCount > 0) {
              showToast('Noise Purge Finished', `Purged ${purgedCount.toLocaleString()} micro-tremors (< M2.0). Reclaimed ${data.vacuum.saved_kb} KB space.`, 'success');
            } else {
              showToast('Catalog Clean', 'Database is already clean: 0 micro-tremor records (< M2.0) found in catalog.', 'info');
            }
            await loadDeckData();
            await loadEventsTable(1);
          } catch (e) {
            showToast('Purge Error', e.message, 'error');
          } finally {
            purgeNoiseBtn.disabled = false;
            purgeNoiseBtn.innerHTML = `
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
              Purge Noise (&lt; M2.0)
            `;
          }
        }
      });
    });
  }

  // Global Sync Button (Client-Side Popup Window)
  if (syncAllBtn) {
    syncAllBtn.addEventListener('click', async () => {
      syncAllBtn.disabled = true;
      syncAllBtn.innerHTML = '<span>⏳ Syncing All Sources...</span>';
      try {
        const res = await adminFetch('/api/admin/sync/all', { method: 'POST' });
        const data = await res.json();
        // Display in-app popup modal
        showSyncModal(data);
        await loadDeckData();
        await loadEventsTable();
      } catch (e) {
        showToast('Sync Failed', e.message, 'error');
      } finally {
        syncAllBtn.disabled = false;
        syncAllBtn.innerHTML = `
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="sync-icon">
            <polyline points="23 4 23 10 17 10"></polyline>
            <polyline points="1 20 1 14 7 14"></polyline>
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
          </svg>
          <span>Trigger Full Multi-Tier Sync</span>
        `;
      }
    });
  }

  if (refreshHealthBtn) refreshHealthBtn.addEventListener('click', loadDeckData);

  // Sync specific provider (Client-Side Popup Window)
  window.temasAdmin = {
    async syncProvider(providerName) {
      try {
        const res = await adminFetch(`/api/admin/sync/${providerName}`, { method: 'POST' });
        const data = await res.json();
        // Display in-app popup modal
        showSyncModal(data, providerName);
        await loadDeckData();
        await loadEventsTable();
      } catch (e) {
        showToast(`[${providerName.toUpperCase()}] Error`, e.message, 'error');
      }
    },

    deleteEvent(timeUtc, lat, lon) {
      showConfirmDialog({
        title: 'DELETE SEISMIC RECORD',
        message: `Permanently delete event at ${timeUtc} (${lat}°, ${lon}°)? This action cannot be undone.`,
        confirmText: 'Delete Record',
        onConfirm: async () => {
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
              showToast('Event Deleted', `${timeUtc} removed from database`, 'success');
              await loadEventsTable(currentPage);
              await loadDeckData();
            } else {
              showToast('Delete Failed', 'Record could not be removed', 'error');
            }
          } catch (e) {
            showToast('Delete Error', e.message, 'error');
          }
        }
      });
    }
  };

  // Event Moderation Table with Full Pagination & Multi-Vector Filters
  async function loadEventsTable(page = 1) {
    if (!eventsTableBody) return;
    currentPage = Math.max(1, page);
    const region = adminSearchRegion ? adminSearchRegion.value.trim() : '';
    const minMag = adminSearchMinMag ? adminSearchMinMag.value : '';
    const source = adminSearchSource ? adminSearchSource.value.trim() : '';
    const scale = adminSearchScale ? adminSearchScale.value.trim() : '';
    const offset = (currentPage - 1) * pageSize;

    let url = `/api/earthquakes?limit=${pageSize}&offset=${offset}`;
    if (region) url += `&region=${encodeURIComponent(region)}`;
    if (minMag) url += `&min_magnitude=${encodeURIComponent(minMag)}`;
    if (source) url += `&measmethod=${encodeURIComponent(source)}`;
    if (scale) url += `&magtype=${encodeURIComponent(scale)}`;

    eventsTableBody.innerHTML = '<tr><td colspan="8" class="empty-cell">Retrieving records from database...</td></tr>';

    try {
      const res = await fetch(url);
      const data = await res.json();
      totalEventsCount = data.total || 0;
      const totalPages = Math.max(1, Math.ceil(totalEventsCount / pageSize));
      if (currentPage > totalPages && totalPages > 0) {
        currentPage = totalPages;
      }

      const startIdx = totalEventsCount === 0 ? 0 : (currentPage - 1) * pageSize + 1;
      const endIdx = Math.min(currentPage * pageSize, totalEventsCount);

      if (tableCountText) {
        tableCountText.textContent = `Showing ${startIdx.toLocaleString()} – ${endIdx.toLocaleString()} of ${totalEventsCount.toLocaleString()} matches`;
      }
      if (pageRangeText) {
        pageRangeText.textContent = `Showing ${startIdx.toLocaleString()} – ${endIdx.toLocaleString()} of ${totalEventsCount.toLocaleString()} records`;
      }
      if (currentPageNum) currentPageNum.textContent = currentPage.toString();
      if (totalPagesNum) totalPagesNum.textContent = totalPages.toString();

      if (btnPageFirst) btnPageFirst.disabled = currentPage <= 1;
      if (btnPagePrev) btnPagePrev.disabled = currentPage <= 1;
      if (btnPageNext) btnPageNext.disabled = currentPage >= totalPages;
      if (btnPageLast) btnPageLast.disabled = currentPage >= totalPages;

      if (!data.items || !data.items.length) {
        eventsTableBody.innerHTML = '<tr><td colspan="8" class="empty-cell">No matching seismic records found.</td></tr>';
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
      eventsTableBody.innerHTML = '<tr><td colspan="8" class="empty-cell error-msg">Failed to query events table.</td></tr>';
    }
  }

  // Search & Filter listeners
  if (adminSearchBtn) adminSearchBtn.addEventListener('click', () => loadEventsTable(1));
  if (adminSearchRegion) {
    adminSearchRegion.addEventListener('keypress', (e) => { if (e.key === 'Enter') loadEventsTable(1); });
  }
  if (adminSearchMinMag) {
    adminSearchMinMag.addEventListener('change', () => loadEventsTable(1));
  }
  if (adminSearchSource) {
    adminSearchSource.addEventListener('change', () => loadEventsTable(1));
  }
  if (adminSearchScale) {
    adminSearchScale.addEventListener('change', () => loadEventsTable(1));
  }
  if (adminResetFilterBtn) {
    adminResetFilterBtn.addEventListener('click', () => {
      if (adminSearchRegion) adminSearchRegion.value = '';
      if (adminSearchSource) adminSearchSource.value = '';
      if (adminSearchScale) adminSearchScale.value = '';
      if (adminSearchMinMag) adminSearchMinMag.value = '';
      loadEventsTable(1);
    });
  }

  // Pagination navigation listeners
  if (btnPageFirst) {
    btnPageFirst.addEventListener('click', () => {
      if (currentPage > 1) loadEventsTable(1);
    });
  }
  if (btnPagePrev) {
    btnPagePrev.addEventListener('click', () => {
      if (currentPage > 1) loadEventsTable(currentPage - 1);
    });
  }
  if (btnPageNext) {
    btnPageNext.addEventListener('click', () => {
      const totalPages = Math.max(1, Math.ceil(totalEventsCount / pageSize));
      if (currentPage < totalPages) loadEventsTable(currentPage + 1);
    });
  }
  if (btnPageLast) {
    btnPageLast.addEventListener('click', () => {
      const totalPages = Math.max(1, Math.ceil(totalEventsCount / pageSize));
      if (currentPage < totalPages) loadEventsTable(totalPages);
    });
  }
  if (pageSizeSelect) {
    pageSizeSelect.addEventListener('change', (e) => {
      pageSize = parseInt(e.target.value, 10) || 25;
      loadEventsTable(1);
    });
  }

  // Manual Event Injection Modal
  if (openManualEventBtn) {
    openManualEventBtn.addEventListener('click', () => {
      manualEventModal.classList.remove('hidden');
      const now = new Date();
      document.getElementById('manTime').value = now.toISOString().replace('T', ' ').substring(0, 19);
    });
  }

  if (closeManualModalBtn) closeManualModalBtn.addEventListener('click', () => manualEventModal.classList.add('hidden'));
  if (cancelManualModalBtn) cancelManualModalBtn.addEventListener('click', () => manualEventModal.classList.add('hidden'));

  if (manualEventForm) {
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
          showToast('Event Registered', `Committed M${newEvent.magnitude} event at ${newEvent.region}`, 'success');
          manualEventModal.classList.add('hidden');
          manualEventForm.reset();
          await loadEventsTable();
          await loadDeckData();
        } else {
          showToast('Registration Notice', data.message || 'Failed to save event', 'warning');
        }
      } catch (err) {
        showToast('Save Error', err.message, 'error');
      }
    });
  }

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
