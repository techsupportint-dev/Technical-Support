/**
 * Tickets: clear local seed; load only from Google Sheet when API is live
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'credlock_ts_tickets_v1';
  var CLEARED_FLAG = 'credlock_ts_tickets_cleared_v1';

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

  function clearLocalTicketsOnce() {
    try {
      if (localStorage.getItem(CLEARED_FLAG) === '1') return;
      localStorage.setItem(STORAGE_KEY, '[]');
      localStorage.setItem(CLEARED_FLAG, '1');
      console.log('[Credlock] Local tickets cleared (no seed data)');
    } catch (e) {}
  }

  function setBackendStatus(ok, msg) {
    var statusDot = document.getElementById('statusDot');
    var statusText = document.getElementById('statusText');
    if (statusDot) statusDot.className = 'status-dot ' + (ok ? 'online' : 'offline');
    if (statusText) statusText.textContent = msg;
  }

  window.__credlockClearTickets = function () {
    try {
      localStorage.setItem(STORAGE_KEY, '[]');
      localStorage.setItem(CLEARED_FLAG, '1');
    } catch (e) {}
    if (typeof toastSuccess === 'function') toastSuccess('Tickets cleared', 'Tickets');
    location.reload();
  };

  window.__credlockLiveSync = async function () {
    if (!window.TSApi || !TSApi.getApiUrl || !TSApi.getApiUrl()) {
      setBackendStatus(false, 'Local mode · 0 tickets');
      if (typeof toast === 'function') toast('No live API — tickets stay empty until Sheet is connected.', 'info');
      return { ok: false, local: true };
    }
    try {
      if (typeof toast === 'function') toast('Connecting to Google Sheet…', 'info');
      var ping = await TSApi.ping();
      if (!ping || !ping.ok) {
        setBackendStatus(false, 'Sheet offline');
        if (typeof toastError === 'function') toastError((ping && ping.error) || 'API offline', 'Sheet');
        return { ok: false };
      }
      setBackendStatus(true, 'Sheets live');
      var remote = await TSApi.listTickets();
      var mapped = (remote || []).map(normalizeTicket).filter(function (t) { return t && t.id; });
      localStorage.setItem(STORAGE_KEY, JSON.stringify(mapped));
      if (typeof toastSuccess === 'function') {
        toastSuccess('Synced ' + mapped.length + ' ticket(s) from Google Sheet ✅', 'Sync');
      }
      location.reload();
      return { ok: true, count: mapped.length };
    } catch (e) {
      setBackendStatus(false, 'Sheet offline');
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
    clearLocalTicketsOnce();
    setBackendStatus(false, 'Local · 0 tickets');
    if (window.TSApi && TSApi.getApiUrl && TSApi.getApiUrl() && !sessionStorage.getItem('auto_sync_done')) {
      sessionStorage.setItem('auto_sync_done', '1');
      setTimeout(function () { window.__credlockLiveSync(); }, 1200);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(boot, 200); });
  } else {
    setTimeout(boot, 200);
  }
})();
