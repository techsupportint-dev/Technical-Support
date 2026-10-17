/**
 * Credlock Offline-First Database
 * Works 100% without Google Sheets or XAMPP.
 * Optional live API when available; otherwise localStorage + import/export.
 */
(function (global) {
  'use strict';

  var TICKETS_KEY = 'credlock_ts_tickets_v1';
  var USERS_KEY = 'credlock_ts_users_v1';
  var KAVRO_KEY = 'credlock_ts_kavro_v1';
  var META_KEY = 'credlock_ts_meta_v1';
  var MODE_KEY = 'credlock_ts_db_mode';

  function read(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      if (!raw) return fallback;
      return JSON.parse(raw);
    } catch (e) {
      return fallback;
    }
  }

  function write(key, val) {
    localStorage.setItem(key, JSON.stringify(val));
  }

  function ensureLeadUser() {
    var users = read(USERS_KEY, []);
    var has = users.some(function (u) {
      return (u.email || '').toLowerCase() === 'techsupport.int@gmail.com';
    });
    if (!has) {
      users.unshift({
        id: 'u-lead-joseph',
        name: 'Joseph Olayemi',
        email: 'techsupport.int@gmail.com',
        role: 'lead',
        pin: '6424',
        status: 'approved',
        permissions: 'ALL',
        createdAt: new Date().toISOString(),
        approvedAt: new Date().toISOString(),
        approvedBy: 'system'
      });
      write(USERS_KEY, users);
    }
    return users;
  }

  var OfflineDB = {
    mode: function () {
      try {
        return localStorage.getItem(MODE_KEY) || 'offline';
      } catch (e) {
        return 'offline';
      }
    },
    setMode: function (m) {
      localStorage.setItem(MODE_KEY, m === 'api' ? 'api' : 'offline');
    },

    listTickets: function () {
      return read(TICKETS_KEY, []);
    },
    saveTickets: function (list) {
      write(TICKETS_KEY, list || []);
      return list || [];
    },
    upsertTicket: function (t) {
      if (!t) return { ok: false, error: 'No ticket' };
      var list = read(TICKETS_KEY, []);
      var id = t.id || ('TS-' + new Date().toISOString().slice(2, 10).replace(/-/g, '') + '-' + String(list.length + 1).padStart(3, '0'));
      t.id = id;
      t.created = t.created || t.date || new Date().toISOString().slice(0, 10);
      var found = -1;
      for (var i = 0; i < list.length; i++) {
        if (list[i].id === id) { found = i; break; }
      }
      if (found >= 0) list[found] = Object.assign({}, list[found], t);
      else list.unshift(t);
      write(TICKETS_KEY, list);
      return { ok: true, id: id, ticket: t };
    },
    deleteTicket: function (id) {
      var list = read(TICKETS_KEY, []).filter(function (t) { return t.id !== id; });
      write(TICKETS_KEY, list);
      return { ok: true };
    },
    clearTickets: function () {
      write(TICKETS_KEY, []);
      return { ok: true };
    },

    listUsers: function () {
      return ensureLeadUser();
    },
    registerUser: function (data) {
      var email = String(data.email || '').trim().toLowerCase();
      var name = String(data.name || '').trim();
      var pin = String(data.pin || '').trim();
      var role = data.role === 'viewer' ? 'viewer' : 'officer';
      if (!email || !name || !pin) return { ok: false, error: 'All fields required' };
      if (!/^\d{4,6}$/.test(pin)) return { ok: false, error: 'PIN must be 4-6 digits' };
      var users = ensureLeadUser();
      if (users.some(function (u) { return u.email === email; })) {
        return { ok: false, error: 'Email already registered' };
      }
      var id = 'u-' + Math.random().toString(16).slice(2, 10);
      var row = {
        id: id, name: name, email: email, role: role, pin: pin,
        status: 'pending', permissions: '', createdAt: new Date().toISOString(),
        approvedAt: '', approvedBy: ''
      };
      users.push(row);
      write(USERS_KEY, users);
      return { ok: true, id: id, status: 'pending' };
    },
    setUserStatus: function (userId, status, by) {
      var users = ensureLeadUser();
      var hit = false;
      users = users.map(function (u) {
        if (u.id === userId || u.email === String(userId).toLowerCase()) {
          hit = true;
          u.status = status;
          if (status === 'approved') {
            u.approvedAt = new Date().toISOString();
            u.approvedBy = by || 'Team Lead';
          }
        }
        return u;
      });
      if (!hit) return { ok: false, error: 'User not found' };
      write(USERS_KEY, users);
      return { ok: true, userId: userId, status: status };
    },

    exportAll: function () {
      return {
        version: 1,
        exportedAt: new Date().toISOString(),
        tickets: read(TICKETS_KEY, []),
        users: ensureLeadUser(),
        meta: read(META_KEY, {})
      };
    },
    importAll: function (payload, merge) {
      if (!payload || typeof payload !== 'object') return { ok: false, error: 'Invalid file' };
      var tickets = Array.isArray(payload.tickets) ? payload.tickets : [];
      var users = Array.isArray(payload.users) ? payload.users : [];
      if (merge) {
        var curT = read(TICKETS_KEY, []);
        var map = {};
        curT.forEach(function (t) { map[t.id] = t; });
        tickets.forEach(function (t) { if (t && t.id) map[t.id] = t; });
        write(TICKETS_KEY, Object.keys(map).map(function (k) { return map[k]; }));
        var curU = ensureLeadUser();
        var umap = {};
        curU.forEach(function (u) { umap[u.email] = u; });
        users.forEach(function (u) { if (u && u.email) umap[u.email.toLowerCase()] = u; });
        write(USERS_KEY, Object.keys(umap).map(function (k) { return umap[k]; }));
      } else {
        write(TICKETS_KEY, tickets);
        if (users.length) write(USERS_KEY, users);
        else ensureLeadUser();
      }
      return { ok: true, tickets: read(TICKETS_KEY, []).length, users: read(USERS_KEY, []).length };
    },

    downloadBackup: function () {
      var data = OfflineDB.exportAll();
      var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'credlock-support-backup-' + new Date().toISOString().slice(0, 10) + '.json';
      a.click();
      URL.revokeObjectURL(a.href);
    }
  };

  ensureLeadUser();
  global.OfflineDB = OfflineDB;
})(window);
