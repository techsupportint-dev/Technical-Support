/**
 * Clear front-end tickets (no seed). Load only from live Google Sheet.
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'credlock_ts_tickets_v1';

  function normalizeTicket(t) {
    if (!t) return null;
    return {
      id: t.id || t['Ticket ID'] || '',
      date: t.date || t.Date || t.created || '',
      timeIn: t.timeIn || t.Time || '',
      requester: t.requester || t.Requester || '',
      type: t.type || t.Type || 'Customer',
      channel: t.channel || t.Channel || '',
      category: t.category || t.Category || '',
      description: t.description || t.Description || t.summary || '',
      summary: t.summary || t.description || t.Description || '',
      priority: t.priority || t.Priority || 'P3 Normal',
      owner: t.owner || t.Owner || '',
      status: t.status || t.Status || 'New',
      assignedAt: t.assignedAt || '',
      firstResponse: t.firstResponse || t['First Response'] || '',
      impact: t.impact || '',
      nextAction: t.nextAction || t['Next Action'] || '',
      escalation: t.escalation || '',
      resolutionNotes: t.resolutionNotes || '',
      resolvedAt: t.resolvedAt || t['Resolved At'] || '',
      notes: t.notes || t.Notes || '',
      contact: t.contact || '',
      created: t.created || t.date || ''
    };
  }

  function setBackendStatus(ok, msg) {
    var statusDot = document.getElementById('statusDot');
    var statusText = document.getElementById('statusText');
    if (statusDot) statusDot.className = 'status-dot ' + (ok ? 'online' : 'offline');
    if (statusText) statusText.textContent = msg;
  }

  function clearAllTickets() {
    try {
      localStorage.setItem(STORAGE_KEY, '[]');
    } catch (e) {}
    try {
      if (typeof tickets !== 'undefined') {
        tickets.length = 0;
      }
      if (typeof saveTickets === 'function') saveTickets();
      if (typeof updateNavBadge === 'function') updateNavBadge();
      if (typeof render === 'function') render();
    } catch (e2) {
      console.warn('clear tickets', e2);
    }
  }

  window.__credlockClearTickets = function () {
    clearAllTickets();
    if (typeof toastSuccess === 'function') toastSuccess('Tickets cleared', 'Tickets');
  };

  window.__credlockLiveSync = async function () {
    if (!window.TSApi || !TSApi.getApiUrl || !TSApi.getApiUrl()) {
      setBackendStatus(false, 'Local · 0 tickets');
      clearAllTickets();
      return { ok: false, local: true };
    }
    try {
      var ping = await TSApi.ping();
      if (!ping || !ping.ok) {
        setBackendStatus(false, 'Sheet offline');
        clearAllTickets();
        return { ok: false };
      }
      setBackendStatus(true, 'Sheets live');
      var remote = await TSApi.listTickets();
      var mapped = (remote || []).map(normalizeTicket).filter(function (t) { return t && t.id; });
      try {
        if (typeof tickets !== 'undefined') {
          tickets.length = 0;
          mapped.forEach(function (t) { tickets.push(t); });
        }
        localStorage.setItem(STORAGE_KEY, JSON.stringify(mapped));
        if (typeof saveTickets === 'function') saveTickets();
        if (typeof updateNavBadge === 'function') updateNavBadge();
        if (typeof render === 'function') render();
      } catch (e) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(mapped));
        location.reload();
      }
      if (typeof toastSuccess === 'function') {
        toastSuccess('Synced ' + mapped.length + ' ticket(s) from Sheet ✅', 'Sync');
      }
      return { ok: true, count: mapped.length };
    } catch (e) {
      setBackendStatus(false, 'Sheet offline');
      clearAllTickets();
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
    clearAllTickets();
    setBackendStatus(false, 'Local · 0 tickets');
    if (window.TSApi && TSApi.getApiUrl && TSApi.getApiUrl() && !sessionStorage.getItem('auto_sync_done')) {
      sessionStorage.setItem('auto_sync_done', '1');
      setTimeout(function () { window.__credlockLiveSync(); }, 800);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(boot, 100); });
  } else {
    setTimeout(boot, 100);
  }
})();
