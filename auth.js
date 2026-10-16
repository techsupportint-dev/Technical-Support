/**
 * Credlock Tech Support – Auth + permissions (plain PIN)
 * Team Lead: Joseph Olayemi · techsupport.int@gmail.com · PIN 6424
 */
(function (global) {
  const USERS_KEY = 'credlock_ts_users_v1';
  const SESSION_KEY = 'credlock_ts_session_v1';
  const RESET_KEY = 'credlock_ts_resets_v1';

  const ALL_PERMS = [
    'dashboard', 'lead-dash', 'tickets', 'tickets_all', 'kavro', 'kavro_actions',
    'new-ticket', 'rota', 'rota_edit', 'daily', 'weekly', 'monthly', 'officer-reports', 'analytics', 'ai-insights',
    'team', 'templates', 'notifications', 'approvals', 'my-work',
    'settings', 'admin', 'export', 'resolve_any', 'assign_any'
  ];

  const ROLE_PRESETS = {
    lead: ALL_PERMS.slice(),
    admin: ALL_PERMS.slice(),
    officer: [
      'dashboard', 'tickets', 'kavro', 'kavro_actions', 'new-ticket',
      'rota', 'daily', 'weekly', 'monthly', 'officer-reports', 'analytics', 'ai-insights', 'team', 'templates',
      'notifications', 'my-work'
    ],
    viewer: [
      'dashboard', 'tickets', 'kavro', 'daily', 'weekly', 'monthly', 'officer-reports', 'analytics', 'ai-insights', 'team', 'my-work'
    ]
  };

  function loadUsers() {
    try { return JSON.parse(localStorage.getItem(USERS_KEY) || '[]'); }
    catch (e) { return []; }
  }
  function saveUsers(users) { localStorage.setItem(USERS_KEY, JSON.stringify(users)); }
  function loadResets() {
    try { return JSON.parse(localStorage.getItem(RESET_KEY) || '[]'); }
    catch (e) { return []; }
  }
  function saveResets(list) { localStorage.setItem(RESET_KEY, JSON.stringify(list)); }
  function defaultPerms(role) {
    return (ROLE_PRESETS[role] || ROLE_PRESETS.officer).slice();
  }

  function ensureSeed() {
    var users = loadUsers();
    var leadEmail = 'techsupport.int@gmail.com';
    var changed = false;
    users.forEach(function (u) {
      if (u.email === 'joseph.olayemi@credlock.africa' || u.id === 'u-lead-joseph') {
        u.email = leadEmail; u.name = 'Joseph Olayemi'; u.role = 'lead'; u.pin = '6424';
        u.status = 'approved'; u.permissions = defaultPerms('lead'); changed = true;
      }
    });
    var lead = users.find(function (u) { return u.email === leadEmail; });
    if (!lead) {
      users.push({
        id: 'u-lead-joseph', name: 'Joseph Olayemi', email: leadEmail, role: 'lead', pin: '6424',
        status: 'approved', permissions: defaultPerms('lead'),
        createdAt: new Date().toISOString(), approvedAt: new Date().toISOString(), approvedBy: 'system'
      });
      changed = true;
    } else {
      if (lead.pin !== '6424') { lead.pin = '6424'; changed = true; }
      lead.name = 'Joseph Olayemi'; lead.role = 'lead'; lead.status = 'approved';
      if (!lead.permissions || !lead.permissions.length) { lead.permissions = defaultPerms('lead'); changed = true; }
    }
    users.forEach(function (u) {
      if (!u.permissions || !u.permissions.length) {
        u.permissions = defaultPerms(u.role === 'lead' || u.role === 'admin' ? 'lead' : (u.role || 'officer'));
        changed = true;
      }
    });
    var cleaned = users.filter(function (u) {
      if (u.approvedBy === 'system' && u.role === 'officer') return false;
      return true;
    });
    if (cleaned.length !== users.length) { users = cleaned; changed = true; }
    if (changed) saveUsers(users);
  }

  function getSession() {
    try { return JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null'); }
    catch (e) { return null; }
  }
  function setSession(user) {
    if (!user) { sessionStorage.removeItem(SESSION_KEY); return; }
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({
      id: user.id, name: user.name, email: user.email, role: user.role,
      permissions: user.permissions || defaultPerms(user.role)
    }));
  }
  function currentUser() { return getSession(); }
  function isLead() { var s = getSession(); return s && (s.role === 'lead' || s.role === 'admin'); }
  function isAdmin() { return isLead(); }
  function can(perm) {
    var s = getSession();
    if (!s) return false;
    if (s.role === 'lead' || s.role === 'admin') return true;
    return (s.permissions || []).indexOf(perm) !== -1;
  }
  function pendingUsers() { return loadUsers().filter(function (u) { return u.status === 'pending'; }); }

  function register(opts) {
    ensureSeed();
    var email = (opts.email || '').trim().toLowerCase();
    var name = (opts.name || '').trim();
    var pin = String(opts.pin || '').trim();
    var role = opts.role === 'lead' || opts.role === 'admin' ? opts.role : 'officer';
    if (!name || !email || !pin) throw new Error('All fields required');
    if (!/^\d{4,6}$/.test(pin)) throw new Error('PIN must be 4-6 digits');
    var users = loadUsers();
    if (users.find(function (u) { return u.email === email; })) throw new Error('Email already registered');
    users.push({
      id: 'u-' + Date.now().toString(36), name: name, email: email, role: role, pin: pin,
      status: 'pending', permissions: defaultPerms(role === 'lead' || role === 'admin' ? 'lead' : 'officer'),
      createdAt: new Date().toISOString(), approvedAt: null, approvedBy: null
    });
    saveUsers(users);
    return true;
  }

  function login(email, pin) {
    ensureSeed();
    email = (email || '').trim().toLowerCase();
    pin = String(pin || '').trim();
    var user = loadUsers().find(function (u) { return u.email === email; });
    if (!user) throw new Error('Invalid email or PIN');
    if (user.status === 'pending') throw new Error('Pending Team Lead approval');
    if (user.status === 'rejected') throw new Error('Access rejected. Contact Team Lead.');
    if (user.status === 'disabled') throw new Error('Account disabled by admin');
    if (String(user.pin) !== pin) throw new Error('Invalid email or PIN');
    if (!user.permissions) user.permissions = defaultPerms(user.role);
    setSession(user);
    return user;
  }
  function logout() { setSession(null); }

  function approveUser(userId, leadName) {
    var users = loadUsers();
    var u = users.find(function (x) { return x.id === userId; });
    if (!u) throw new Error('User not found');
    u.status = 'approved'; u.approvedAt = new Date().toISOString(); u.approvedBy = leadName || 'Team Lead';
    if (!u.permissions) u.permissions = defaultPerms(u.role);
    saveUsers(users); return u;
  }
  function rejectUser(userId, leadName) {
    var users = loadUsers();
    var u = users.find(function (x) { return x.id === userId; });
    if (!u) throw new Error('User not found');
    u.status = 'rejected'; u.approvedBy = leadName || 'Team Lead';
    saveUsers(users); return u;
  }
  function updateUser(userId, patch) {
    var users = loadUsers();
    var u = users.find(function (x) { return x.id === userId; });
    if (!u) throw new Error('User not found');
    if (patch.name) u.name = patch.name;
    if (patch.role) {
      u.role = patch.role;
      if (!patch.permissions) u.permissions = defaultPerms(patch.role === 'lead' || patch.role === 'admin' ? 'lead' : patch.role);
    }
    if (patch.pin) {
      if (!/^\d{4,6}$/.test(String(patch.pin))) throw new Error('PIN must be 4-6 digits');
      u.pin = String(patch.pin);
    }
    if (patch.status) u.status = patch.status;
    if (patch.permissions) u.permissions = patch.permissions.slice();
    saveUsers(users);
    var s = getSession();
    if (s && s.id === u.id) setSession(u);
    return u;
  }
  function setUserPermissions(userId, perms) { return updateUser(userId, { permissions: perms }); }

  function requestOrResetPin(opts) {
    ensureSeed();
    var email = (opts.email || '').trim().toLowerCase();
    var pin = String(opts.pin || '').trim();
    var token = opts.token;
    var users = loadUsers();
    var user = users.find(function (u) { return u.email === email; });
    if (!user) throw new Error('No account with that email');
    if (!token) {
      var resets = loadResets();
      var t = 'RST-' + Math.random().toString(36).slice(2, 10).toUpperCase();
      resets.push({ email: email, token: t, createdAt: new Date().toISOString(), used: false });
      saveResets(resets);
      return { message: 'Reset requested. Ask Team Lead for token, then submit again with token + new PIN.' };
    }
    var resets2 = loadResets();
    var req = resets2.find(function (r) { return r.email === email && r.token === token && !r.used; });
    if (!req) throw new Error('Invalid or used reset token');
    if (!/^\d{4,6}$/.test(pin)) throw new Error('PIN must be 4-6 digits');
    user.pin = pin; req.used = true;
    saveUsers(users); saveResets(resets2);
    return { message: 'PIN updated. You can sign in.' };
  }
  function issueResetToken(email, leadName) {
    email = (email || '').trim().toLowerCase();
    if (!loadUsers().find(function (u) { return u.email === email; })) throw new Error('User not found');
    var resets = loadResets();
    var t = 'RST-' + Math.random().toString(36).slice(2, 10).toUpperCase();
    resets.push({ email: email, token: t, createdAt: new Date().toISOString(), used: false, issuedBy: leadName });
    saveResets(resets); return t;
  }
  function openResets() { return loadResets().filter(function (r) { return !r.used; }); }

  function showPanel(name) {
    ['authLogin', 'authRegister', 'authReset'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.hidden = id !== name;
    });
    ['loginError', 'registerError', 'registerOk', 'resetError', 'resetOk'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.textContent = '';
    });
  }
  function showAuth(show) {
    var auth = document.getElementById('authShell');
    var app = document.getElementById('appShell');
    if (auth) {
      auth.style.display = show ? 'flex' : 'none';
      auth.classList.toggle('is-visible', !!show);
    }
    if (app) {
      if (show) {
        app.setAttribute('hidden', '');
        app.style.display = 'none';
      } else {
        app.removeAttribute('hidden');
        app.style.display = '';
      }
    }
    document.body.classList.toggle('auth-open', !!show);
  }
  function applyNavPermissions() {
    var s = getSession();
    document.querySelectorAll('.nav-item[data-view]').forEach(function (btn) {
      var view = btn.getAttribute('data-view');
      if (!s) { btn.hidden = true; return; }
      btn.hidden = !can(view === 'admin' ? 'admin' : view);
    });
    var navAppr = document.getElementById('navApprovals');
    var navLead = document.getElementById('navLeadDash');
    var navAdmin = document.getElementById('navAdmin');
    if (navAppr) {
      navAppr.hidden = !can('approvals');
      var badge = document.getElementById('navPendingCount');
      var n = pendingUsers().length + openResets().length;
      if (badge) { badge.textContent = n; badge.style.display = n ? 'inline-block' : 'none'; }
    }
    if (navLead) navLead.hidden = !can('lead-dash');
    if (navAdmin) navAdmin.hidden = !can('admin');
  }
  function updateUserBar() {
    var s = getSession();
    if (!s) return;
    var nameEl = document.getElementById('userName');
    var roleEl = document.getElementById('userRole');
    var av = document.getElementById('userAvatar');
    if (nameEl) nameEl.textContent = s.name;
    if (roleEl) {
      roleEl.textContent = s.role === 'lead' ? 'Team Lead' : s.role === 'admin' ? 'Admin' : s.role === 'viewer' ? 'Viewer' : 'Support Officer';
    }
    if (av) av.textContent = (s.name || '?').charAt(0).toUpperCase();
    applyNavPermissions();
  }

  function bindAuthForms() {
    if (window.__credlockFormsBound) return;
    window.__credlockFormsBound = true;
    document.querySelectorAll('[data-auth]').forEach(function (a) {
      a.addEventListener('click', function (e) {
        e.preventDefault();
        var t = a.getAttribute('data-auth');
        if (t === 'login') showPanel('authLogin');
        if (t === 'register') showPanel('authRegister');
        if (t === 'reset') showPanel('authReset');
      });
    });
    var loginForm = document.getElementById('loginForm');
    if (loginForm) {
      loginForm.addEventListener('submit', function (e) {
        e.preventDefault();
        var fd = new FormData(loginForm);
        var err = document.getElementById('loginError');
        try {
          var user = login(fd.get('email'), fd.get('pin'));
          showAuth(false); updateUserBar();
          if (typeof global.afterAuthLogin === 'function') global.afterAuthLogin(user);
        } catch (ex) { if (err) err.textContent = ex.message; }
      });
    }
    var regForm = document.getElementById('registerForm');
    if (regForm) {
      regForm.addEventListener('submit', function (e) {
        e.preventDefault();
        var fd = new FormData(regForm);
        var err = document.getElementById('registerError');
        var ok = document.getElementById('registerOk');
        if (err) err.textContent = ''; if (ok) ok.textContent = '';
        try {
          if (String(fd.get('pin')) !== String(fd.get('pin2'))) throw new Error('PINs do not match');
          register({ name: fd.get('name'), email: fd.get('email'), role: fd.get('role'), pin: fd.get('pin') });
          if (ok) ok.textContent = 'Submitted. Wait for Team Lead approval, then sign in.';
          regForm.reset();
        } catch (ex) { if (err) err.textContent = ex.message; }
      });
    }
    var resetForm = document.getElementById('resetForm');
    if (resetForm) {
      resetForm.addEventListener('submit', function (e) {
        e.preventDefault();
        var fd = new FormData(resetForm);
        var err = document.getElementById('resetError');
        var ok = document.getElementById('resetOk');
        if (err) err.textContent = ''; if (ok) ok.textContent = '';
        try {
          if (fd.get('pin') && String(fd.get('pin')) !== String(fd.get('pin2'))) throw new Error('PINs do not match');
          var res = requestOrResetPin({ email: fd.get('email'), pin: fd.get('pin'), token: fd.get('token') });
          if (ok) ok.textContent = res.message;
        } catch (ex) { if (err) err.textContent = ex.message; }
      });
    }
    var btnLogout = document.getElementById('btnLogout');
    if (btnLogout) {
      btnLogout.addEventListener('click', function () {
        logout(); showAuth(true); showPanel('authLogin');
      });
    }
  }

  function bootAuth() {
    ensureSeed();
    bindAuthForms();
    var s = getSession();
    if (s) {
      var full = loadUsers().find(function (u) { return u.id === s.id; });
      if (full && full.status === 'approved') {
        setSession(full); showAuth(false); updateUserBar();
        return Promise.resolve(full);
      }
      logout();
    }
    showAuth(true); showPanel('authLogin');
    return Promise.resolve(null);
  }

  global.CredlockAuth = {
    bootAuth: bootAuth, currentUser: currentUser, isLead: isLead, isAdmin: isAdmin, can: can,
    login: login, logout: logout, register: register, approveUser: approveUser, rejectUser: rejectUser,
    updateUser: updateUser, setUserPermissions: setUserPermissions, pendingUsers: pendingUsers,
    loadUsers: loadUsers, issueResetToken: issueResetToken, openResets: openResets,
    updateUserBar: updateUserBar, applyNavPermissions: applyNavPermissions, showAuth: showAuth,
    getSession: getSession, ALL_PERMS: ALL_PERMS, ROLE_PRESETS: ROLE_PRESETS, defaultPerms: defaultPerms,
    ensureSeed: ensureSeed
  };

  function autoAuthInit() {
    try {
      ensureSeed();
      bindAuthForms();
      window.__credlockAuthReady = true;
    } catch (e) {
      console.error('Auth init error', e);
    }
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoAuthInit);
  } else {
    autoAuthInit();
  }
})(window);
