/**
 * Tickets seed + Google Sheet live sync
 */
(function () {
  'use strict';

  function normalizeTicket(t) {
    if (!t) return null;
    return {
      id: t.id || t['Ticket ID'] || '',
      date: t.date || t.Date || t.created || t.Created || '',
      timeIn: t.timeIn || t.Time || t.time || '',
      requester: t.requester || t.Requester || '',
      type: t.type || t.Type || 'Customer',
      channel: t.channel || t.Channel || '',
      category: t.category || t.Category || '',
      description: t.description || t.Description || t.summary || t.Summary || '',
      summary: t.summary || t.Summary || t.description || t.Description || '',
      priority: t.priority || t.Priority || 'P3 Normal',
      owner: t.owner || t.Owner || '',
      status: t.status || t.Status || 'New',
      assignedAt: t.assignedAt || '',
      firstResponse: t.firstResponse || t['First Response'] || '',
      impact: t.impact || '',
      nextAction: t.nextAction || t['Next Action'] || '',
      escalation: t.escalation || '',
      resolutionNotes: t.resolutionNotes || t.Resolution || '',
      resolvedAt: t.resolvedAt || t['Resolved At'] || '',
      notes: t.notes || t.Notes || '',
      contact: t.contact || t.Contact || '',
      created: t.created || t.date || t.Date || ''
    };
  }

  function seedTicketsFromBundle(force) {
    var seed = (window.TICKETS_DATA || []).map(normalizeTicket).filter(function (t) { return t && t.id; });
    if (!seed.length) return 0;
    var key = 'credlock_ts_tickets_v1';
    try {
      var raw = localStorage.getItem(key);
      var local = raw ? JSON.parse(raw) : [];
      if (force || !local || !local.length || local.length < Math.min(10, seed.length)) {
        localStorage.setItem(key, JSON.stringify(seed));
        return seed.length;
      }
      return local.length;
    } catch (e) {
      localStorage.setItem(key, JSON.stringify(seed));
      return seed.length;
    }
  }

  function setBackendStatus(ok, msg) {
    var statusDot = document.getElementById('statusDot');
    var statusText = document.getElementById('statusText');
    if (statusDot) statusDot.className = 'status-dot ' + (ok ? 'online' : 'offline');
    if (statusText) statusText.textContent = msg;
  }

  window.__credlockReloadTickets = function () {
    var n = seedTicketsFromBundle(true);
    if (typeof toastSuccess === 'function') toastSuccess('Loaded ' + n + ' tickets — reloading…', 'Tickets');
    location.reload();
  };

  window.__credlockLiveSync = async function () {
    if (!window.TSApi || !TSApi.getApiUrl || !TSApi.getApiUrl()) {
      setBackendStatus(false, 'Local mode');
      var n = seedTicketsFromBundle(false);
      if (typeof toast === 'function') toast('Using local tickets (' + (n || (window.TICKETS_DATA || []).length) + '). Connect API in Settings for live Sheet.', 'info');
      return { ok: false, local: true };
    }
    try {
      if (typeof toast === 'function') toast('Connecting to Google Sheet…', 'info');
      var ping = await TSApi.ping();
      if (!ping || !ping.ok) {
        setBackendStatus(false, 'Sheet offline');
        seedTicketsFromBundle(false);
        if (typeof toastError === 'function') toastError((ping && ping.error) || 'API offline — using local tickets', 'Sheet');
        return { ok: false };
      }
      setBackendStatus(true, 'Sheets live');
      var remote = await TSApi.listTickets();
      if (remote && remote.length) {
        var mapped = remote.map(normalizeTicket).filter(function (t) { return t && t.id; });
        localStorage.setItem('credlock_ts_tickets_v1', JSON.stringify(mapped));
        if (typeof toastSuccess === 'function') toastSuccess('Live: ' + mapped.length + ' tickets from Google Sheet ✅', 'Sync');
        sessionStorage.setItem('tickets_synced_once', '1');
        location.reload();
        return { ok: true, count: mapped.length };
      }
      seedTicketsFromBundle(true);
      if (typeof toastSuccess === 'function') toastSuccess('Sheet connected (no remote tickets) — seeded local data', 'Sync');
      location.reload();
      return { ok: true, count: 0 };
    } catch (e) {
      setBackendStatus(false, 'Sheet offline');
      seedTicketsFromBundle(false);
      if (typeof toastError === 'function') toastError(String(e.message || e), 'Sheet');
      return { ok: false };
    }
  };

  window.syncFromSheets = function () {
    return window.__credlockLiveSync();
  };

  document.addEventListener('click', function (e) {
    var t = e.target;
    if (!t) return;
    if (t.id === 'syncBtn' || t.id === 'syncNowBtn' || (t.closest && t.closest('#syncBtn'))) {
      e.preventDefault();
      e.stopPropagation();
      window.__credlockLiveSync();
    }
  }, true);

  function boot() {
    var n = seedTicketsFromBundle(false);
    console.log('[Credlock tickets] seed', (window.TICKETS_DATA || []).length, 'stored', n);
    if (window.TSApi && TSApi.getApiUrl && TSApi.getApiUrl() && !sessionStorage.getItem('auto_sync_done')) {
      sessionStorage.setItem('auto_sync_done', '1');
      setTimeout(function () { window.__credlockLiveSync(); }, 1500);
    } else {
      setBackendStatus(false, n ? ('Local · ' + n + ' tickets') : 'Local mode');
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(boot, 300); });
  } else {
    setTimeout(boot, 300);
  }
})();
