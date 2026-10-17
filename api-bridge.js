/**
 * API bridge – prefer live API when healthy; otherwise OfflineDB (always works)
 */
(function (global) {
  'use strict';

  function setStatus(ok, msg) {
    var dot = document.getElementById('statusDot');
    var txt = document.getElementById('statusText');
    if (dot) dot.className = 'status-dot ' + (ok ? 'online' : 'offline');
    if (txt) txt.textContent = msg;
  }

  async function tryLivePing() {
    if (!global.TSApi || !TSApi.getApiUrl || !TSApi.getApiUrl()) return null;
    try {
      var r = await TSApi.ping();
      if (r && r.ok && r.service !== 'OfflineDB') return r;
      // If our own patched ping returned Offline, treat as no live
      if (r && r.backend === 'localStorage') return null;
      if (r && r.ok) return r;
    } catch (e) {}
    return null;
  }

  function installBridge() {
    if (!global.OfflineDB) return;

    if (!global.TSApi) {
      global.TSApi = {
        getApiUrl: function () { return ''; },
        setApiUrl: function () {},
        getMode: function () { return 'offline'; },
        ping: async function () { return { ok: true, service: 'OfflineDB', backend: 'localStorage' }; },
        listTickets: async function () { return OfflineDB.listTickets(); },
        upsertTicket: async function (t) { return OfflineDB.upsertTicket(t); },
        bulkTickets: async function (list) {
          var n = 0;
          (list || []).forEach(function (t) { if (OfflineDB.upsertTicket(t).ok) n++; });
          return { ok: true, count: n };
        },
        listUsers: async function () { return OfflineDB.listUsers(); },
        registerUser: async function (d) { return OfflineDB.registerUser(d); },
        approveUser: async function (id, by) { return OfflineDB.setUserStatus(id, 'approved', by); },
        rejectUser: async function (id, by) { return OfflineDB.setUserStatus(id, 'rejected', by); },
        listKavro: async function () { return window.KAVRO_DATA || []; },
        sync: async function () {
          return { ok: true, tickets: OfflineDB.listTickets(), users: OfflineDB.listUsers() };
        },
        setup: async function () { return { ok: true }; }
      };
      setStatus(true, 'Offline · ready');
      return;
    }

    var rawPing = TSApi.ping.bind(TSApi);
    var rawListTickets = TSApi.listTickets.bind(TSApi);
    var rawUpsert = TSApi.upsertTicket.bind(TSApi);
    var rawListUsers = TSApi.listUsers.bind(TSApi);
    var rawRegister = TSApi.registerUser.bind(TSApi);
    var rawApprove = TSApi.approveUser.bind(TSApi);
    var rawReject = TSApi.rejectUser.bind(TSApi);
    var rawSync = TSApi.sync.bind(TSApi);

    TSApi.listTickets = async function () {
      try {
        if (TSApi.getApiUrl && TSApi.getApiUrl()) {
          var remote = await rawListTickets();
          if (Array.isArray(remote)) {
            OfflineDB.saveTickets(remote);
            setStatus(true, 'API live');
            return remote;
          }
        }
      } catch (e) {}
      setStatus(true, 'Offline · local DB');
      return OfflineDB.listTickets();
    };

    TSApi.upsertTicket = async function (ticket) {
      var local = OfflineDB.upsertTicket(ticket);
      try {
        if (TSApi.getApiUrl && TSApi.getApiUrl()) await rawUpsert(ticket);
      } catch (e) {}
      return local;
    };

    TSApi.listUsers = async function () {
      try {
        if (TSApi.getApiUrl && TSApi.getApiUrl()) {
          var u = await rawListUsers();
          if (u && u.length) return u;
        }
      } catch (e) {}
      return OfflineDB.listUsers();
    };

    TSApi.registerUser = async function (data) {
      var local = OfflineDB.registerUser(data);
      try {
        if (TSApi.getApiUrl && TSApi.getApiUrl()) await rawRegister(data);
      } catch (e) {}
      return local;
    };

    TSApi.approveUser = async function (id, by) {
      var local = OfflineDB.setUserStatus(id, 'approved', by);
      try {
        if (TSApi.getApiUrl && TSApi.getApiUrl()) await rawApprove(id, by);
      } catch (e) {}
      return local;
    };

    TSApi.rejectUser = async function (id, by) {
      var local = OfflineDB.setUserStatus(id, 'rejected', by);
      try {
        if (TSApi.getApiUrl && TSApi.getApiUrl()) await rawReject(id, by);
      } catch (e) {}
      return local;
    };

    TSApi.sync = async function () {
      try {
        if (TSApi.getApiUrl && TSApi.getApiUrl()) {
          var r = await rawSync();
          if (r && r.ok && r.tickets) OfflineDB.saveTickets(r.tickets);
          setStatus(true, 'API live · synced');
          return r;
        }
      } catch (e) {}
      setStatus(true, 'Offline · local DB');
      return { ok: true, tickets: OfflineDB.listTickets(), users: OfflineDB.listUsers(), backend: 'offline' };
    };

    TSApi.ping = async function () {
      try {
        if (TSApi.getApiUrl && TSApi.getApiUrl()) {
          var r = await rawPing();
          if (r && r.ok) {
            setStatus(true, 'API live');
            return r;
          }
        }
      } catch (e) {}
      setStatus(true, 'Offline · local DB');
      return { ok: true, service: 'OfflineDB', backend: 'localStorage' };
    };
  }

  function hydrateAppTickets() {
    try {
      var list = OfflineDB.listTickets();
      if (typeof tickets !== 'undefined') {
        tickets.length = 0;
        list.forEach(function (t) { tickets.push(t); });
        if (typeof saveTickets === 'function') saveTickets();
        if (typeof updateNavBadge === 'function') updateNavBadge();
      }
    } catch (e) {}
  }

  function injectBackupControls() {
    document.addEventListener('click', function (e) {
      var btn = e.target.closest && e.target.closest('[data-action]');
      if (!btn) return;
      var act = btn.getAttribute('data-action');
      if (act === 'backup-download') {
        OfflineDB.downloadBackup();
        if (typeof toastSuccess === 'function') toastSuccess('Backup downloaded', 'Offline DB');
      }
      if (act === 'backup-import') {
        var inp = document.getElementById('offlineImportFile');
        if (inp) inp.click();
      }
    });

    if (!document.getElementById('offlineImportFile')) {
      var inp = document.createElement('input');
      inp.type = 'file';
      inp.accept = 'application/json,.json';
      inp.id = 'offlineImportFile';
      inp.hidden = true;
      document.body.appendChild(inp);
      inp.addEventListener('change', function () {
        var f = inp.files && inp.files[0];
        if (!f) return;
        var reader = new FileReader();
        reader.onload = function () {
          try {
            var data = JSON.parse(reader.result);
            var r = OfflineDB.importAll(data, true);
            if (r.ok) {
              hydrateAppTickets();
              if (typeof toastSuccess === 'function') {
                toastSuccess('Imported ' + r.tickets + ' tickets, ' + r.users + ' users', 'Import');
              }
              if (typeof render === 'function') render();
              else location.reload();
            } else if (typeof toastError === 'function') toastError(r.error || 'Import failed', 'Import');
          } catch (err) {
            if (typeof toastError === 'function') toastError('Invalid JSON file', 'Import');
          }
          inp.value = '';
        };
        reader.readAsText(f);
      });
    }
  }

  window.__credlockLiveSync = async function () {
    if (typeof toast === 'function') toast('Syncing…', 'info');
    var r = await TSApi.sync();
    hydrateAppTickets();
    if (typeof render === 'function') render();
    if (typeof updateNavBadge === 'function') updateNavBadge();
    if (typeof toastSuccess === 'function') {
      toastSuccess('Ready · ' + (OfflineDB.listTickets().length) + ' ticket(s)', 'DB');
    }
    return r;
  };

  function boot() {
    installBridge();
    injectBackupControls();
    hydrateAppTickets();
    setStatus(true, 'Offline · local DB');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(boot, 80); });
  } else {
    setTimeout(boot, 80);
  }
})(window);
