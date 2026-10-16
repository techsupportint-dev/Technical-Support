/**
 * Credlock portal repair layer – nav, auth, approvals, sheet registration
 * Load AFTER app.js
 */
(function () {
  'use strict';

  function toastMsg(msg, type) {
    if (type === 'ok' && typeof toastSuccess === 'function') return toastSuccess(msg, 'Portal');
    if (type === 'err' && typeof toastError === 'function') return toastError(msg, 'Portal');
    if (typeof toast === 'function') return toast(msg, type === 'err' ? 'error' : 'info');
    console.log(msg);
  }

  if (window.CredlockAuth) {
    var AP = CredlockAuth.ALL_PERMS;
    if (AP && AP.indexOf('monthly-reports') < 0) AP.push('monthly-reports');
    ['lead', 'admin', 'officer'].forEach(function (role) {
      var p = CredlockAuth.ROLE_PRESETS && CredlockAuth.ROLE_PRESETS[role];
      if (p && p.indexOf('monthly-reports') < 0) p.push('monthly-reports');
    });
  }

  document.addEventListener('click', function (e) {
    var btn = e.target.closest && e.target.closest('.nav-item[data-view]');
    if (!btn) return;
    e.preventDefault();
    var view = btn.getAttribute('data-view');
    if (!view) return;

    if (window.CredlockAuth && CredlockAuth.currentUser) {
      if (!CredlockAuth.currentUser()) {
        CredlockAuth.showAuth(true);
        return;
      }
      var lead = CredlockAuth.isLead && CredlockAuth.isLead();
      var allowed = lead || (CredlockAuth.can && (
        CredlockAuth.can(view === 'admin' ? 'admin' : view) || CredlockAuth.can(view)
      ));
      if (lead) allowed = true;
      if (!allowed) {
        toastMsg('Access denied for this section', 'err');
        return;
      }
    }

    document.querySelectorAll('.nav-item').forEach(function (b) { b.classList.remove('active'); });
    btn.classList.add('active');
    window.__currentView = view;
    try { if (typeof currentView !== 'undefined') currentView = view; } catch (err) {}

    if (view === 'monthly-reports' && typeof window.renderMonthlyReports === 'function') {
      var content = document.getElementById('content');
      var title = document.getElementById('pageTitle');
      if (title) title.textContent = 'Monthly Reports';
      if (content) {
        content.innerHTML = window.renderMonthlyReports();
        if (window.bindMonthlyReports) window.bindMonthlyReports();
      }
      var sb = document.getElementById('sidebar');
      if (sb) sb.classList.remove('open');
      return;
    }

    if (typeof navigate === 'function') navigate(view);
    else if (typeof render === 'function') render();
  }, true);

  function forceLeadNav() {
    if (!window.CredlockAuth || !CredlockAuth.isLead || !CredlockAuth.isLead()) return;
    ['navApprovals', 'navLeadDash', 'navAdmin'].forEach(function (id) {
      var el = document.getElementById(id);
      if (!el) return;
      el.hidden = false;
      el.removeAttribute('hidden');
      el.style.display = '';
      el.style.visibility = 'visible';
    });
    if (CredlockAuth.refreshApprovalsBadge) CredlockAuth.refreshApprovalsBadge();
    else if (CredlockAuth.applyNavPermissions) CredlockAuth.applyNavPermissions();
  }

  var prevAfter = window.afterAuthLogin;
  window.afterAuthLogin = function (user) {
    try { if (typeof prevAfter === 'function') prevAfter(user); } catch (e) { console.warn(e); }
    setTimeout(forceLeadNav, 50);
    setTimeout(forceLeadNav, 300);
    if (window.CredlockAuth) {
      CredlockAuth.showAuth(false);
      if (CredlockAuth.updateUserBar) CredlockAuth.updateUserBar();
    }
    var app = document.getElementById('appShell');
    if (app) { app.removeAttribute('hidden'); app.style.display = ''; }
  };

  async function pushUserToSheet(userPayload) {
    var result = { local: true, sheet: false };
    var apiUrl = (window.TSApi && TSApi.getApiUrl && TSApi.getApiUrl()) ||
      (window.PORTAL_CONFIG && PORTAL_CONFIG.API_URL) || '';
    if (apiUrl) {
      try {
        var res = await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({
            action: 'registerUser',
            name: userPayload.name,
            email: userPayload.email,
            pin: userPayload.pin,
            role: userPayload.role || 'officer'
          })
        });
        var text = await res.text();
        try {
          var json = JSON.parse(text);
          result.sheet = !!(json && json.ok);
          result.api = json;
        } catch (e) {
          result.sheet = false;
          result.apiError = 'Apps Script returned HTML — redeploy Web App as Anyone';
        }
      } catch (err) {
        result.apiError = String(err.message || err);
      }
    }
    return result;
  }

  function bindRegisterHard() {
    var form = document.getElementById('registerForm');
    if (!form || form.__repaired) return;
    form.__repaired = true;
    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      e.stopImmediatePropagation();
      var fd = new FormData(form);
      var err = document.getElementById('registerError');
      var ok = document.getElementById('registerOk');
      if (err) err.textContent = '';
      if (ok) ok.textContent = '';
      var name = (fd.get('name') || '').toString().trim();
      var email = (fd.get('email') || '').toString().trim().toLowerCase();
      var pin = (fd.get('pin') || '').toString().trim();
      var pin2 = (fd.get('pin2') || '').toString().trim();
      var role = (fd.get('role') || 'officer').toString();
      try {
        if (!name || !email || !pin) throw new Error('All fields required');
        if (pin !== pin2) throw new Error('PINs do not match');
        if (!/^\d{4,6}$/.test(pin)) throw new Error('PIN must be 4-6 digits');
        if (window.CredlockAuth && CredlockAuth.register) {
          CredlockAuth.register({ name: name, email: email, role: role, pin: pin });
        }
        if (ok) ok.textContent = 'Saving…';
        var r = await pushUserToSheet({ name: name, email: email, pin: pin, role: role });
        if (r.sheet) {
          if (ok) ok.textContent = 'Registered and saved to Google Sheet Users. Wait for Team Lead approval.';
          toastMsg('Registration saved to database', 'ok');
        } else {
          if (ok) ok.textContent = 'Registered locally. Team Lead: open Approvals on this browser (Sheet API offline).';
          toastMsg('Registered locally — open Approvals', 'ok');
        }
        form.reset();
        if (window.CredlockAuth && CredlockAuth.refreshApprovalsBadge) CredlockAuth.refreshApprovalsBadge();
      } catch (ex) {
        if (err) err.textContent = ex.message || String(ex);
      }
    }, true);
  }

  function bindLoginHard() {
    var form = document.getElementById('loginForm');
    if (!form || form.__repaired) return;
    form.__repaired = true;
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      e.stopImmediatePropagation();
      var fd = new FormData(form);
      var err = document.getElementById('loginError');
      if (err) err.textContent = '';
      try {
        if (!window.CredlockAuth) throw new Error('Auth not loaded');
        if (CredlockAuth.ensureSeed) CredlockAuth.ensureSeed();
        var user = CredlockAuth.login(fd.get('email'), fd.get('pin'));
        CredlockAuth.showAuth(false);
        if (CredlockAuth.updateUserBar) CredlockAuth.updateUserBar();
        if (CredlockAuth.applyNavPermissions) CredlockAuth.applyNavPermissions();
        forceLeadNav();
        if (typeof window.afterAuthLogin === 'function') window.afterAuthLogin(user);
        toastMsg('Signed in as ' + user.name, 'ok');
      } catch (ex) {
        if (err) err.textContent = ex.message || String(ex);
      }
    }, true);
  }

  function bindAuthLinks() {
    document.querySelectorAll('[data-auth]').forEach(function (a) {
      if (a.__repaired) return;
      a.__repaired = true;
      a.addEventListener('click', function (e) {
        e.preventDefault();
        var t = a.getAttribute('data-auth');
        var map = { login: 'authLogin', register: 'authRegister', reset: 'authReset' };
        var show = map[t] || 'authLogin';
        ['authLogin', 'authRegister', 'authReset'].forEach(function (id) {
          var el = document.getElementById(id);
          if (el) el.hidden = id !== show;
        });
      });
    });
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  async function pullUsersFromSheet() {
    if (!window.TSApi || !TSApi.listUsers) return;
    try {
      var remote = await TSApi.listUsers();
      if (!remote || !remote.length) return;
      var local = CredlockAuth.loadUsers();
      var byEmail = {};
      local.forEach(function (u) { byEmail[String(u.email).toLowerCase()] = u; });
      remote.forEach(function (ru) {
        var em = String(ru.email || '').toLowerCase();
        if (!em) return;
        if (!byEmail[em]) {
          local.push({
            id: ru.id || ('u-' + Date.now()),
            name: ru.name, email: em, role: ru.role || 'officer',
            pin: String(ru.pin || ''), status: ru.status || 'pending',
            permissions: CredlockAuth.defaultPerms ? CredlockAuth.defaultPerms(ru.role || 'officer') : [],
            createdAt: ru.createdAt, approvedAt: ru.approvedAt, approvedBy: ru.approvedBy
          });
        } else {
          byEmail[em].status = ru.status || byEmail[em].status;
          if (ru.pin) byEmail[em].pin = String(ru.pin);
        }
      });
      localStorage.setItem('credlock_ts_users_v1', JSON.stringify(local));
      if (CredlockAuth.refreshApprovalsBadge) CredlockAuth.refreshApprovalsBadge();
    } catch (e) { console.warn('pullUsers', e); }
  }

  function showApprovalsPanel() {
    var content = document.getElementById('content');
    var title = document.getElementById('pageTitle');
    if (title) title.textContent = 'User Approvals';
    if (!content || !window.CredlockAuth) return;
    var u = CredlockAuth.currentUser();
    if (!u || !(CredlockAuth.isLead && CredlockAuth.isLead())) {
      content.innerHTML = '<div class="empty">Team Lead only — sign in as techsupport.int@gmail.com</div>';
      return;
    }
    function paint(pending, resets, approved) {
      var html = '<div class="principle"><strong>Approvals</strong> — pending registrations. Approve to grant access.</div>';
      html += '<div class="grid grid-2" style="margin-bottom:18px">';
      html += '<div class="kpi warn"><div class="kpi-label">Pending</div><div class="kpi-value">' + pending.length + '</div></div>';
      html += '<div class="kpi"><div class="kpi-label">Reset tokens</div><div class="kpi-value">' + resets.length + '</div></div></div>';
      html += '<div class="card" style="margin-bottom:16px"><div class="card-header"><span class="card-title">Pending registrations</span>';
      html += '<button class="btn btn-sm btn-ghost" id="btnRefreshPending">Refresh</button></div><div class="card-body table-wrap">';
      if (pending.length) {
        html += '<table><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Requested</th><th></th></tr></thead><tbody>';
        pending.forEach(function (p) {
          html += '<tr><td>' + esc(p.name) + '</td><td>' + esc(p.email) + '</td><td>' +
            (p.role === 'lead' ? 'Team Lead' : 'Officer') + '</td><td style="font-size:12px">' +
            esc(String(p.createdAt || '').slice(0, 16).replace('T', ' ')) +
            '</td><td style="white-space:nowrap">' +
            '<button class="btn btn-sm btn-success" data-approve="' + p.id + '">Approve</button> ' +
            '<button class="btn btn-sm btn-ghost" data-reject="' + p.id + '">Reject</button></td></tr>';
        });
        html += '</tbody></table>';
      } else {
        html += '<div class="empty">No pending registrations.<br><small>Officers Register on this browser until Sheet API is live.</small></div>';
      }
      html += '</div></div>';
      html += '<div class="card"><div class="card-header"><span class="card-title">Approved users (' + approved.length + ')</span></div>';
      html += '<div class="card-body table-wrap"><table><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th></tr></thead><tbody>';
      approved.forEach(function (p) {
        html += '<tr><td>' + esc(p.name) + '</td><td>' + esc(p.email) + '</td><td>' + esc(p.role || '') + '</td><td>' + esc(p.status || '') + '</td></tr>';
      });
      html += '</tbody></table></div></div>';
      content.innerHTML = html;
      content.querySelectorAll('[data-approve]').forEach(function (b) {
        b.addEventListener('click', function () {
          try {
            CredlockAuth.approveUser(b.getAttribute('data-approve'), u.name);
            if (window.TSApi && TSApi.approveUser) TSApi.approveUser(b.getAttribute('data-approve'), u.name).catch(function () {});
            toastMsg('User approved', 'ok');
            showApprovalsPanel(); forceLeadNav();
          } catch (ex) { toastMsg(ex.message, 'err'); }
        });
      });
      content.querySelectorAll('[data-reject]').forEach(function (b) {
        b.addEventListener('click', function () {
          try {
            CredlockAuth.rejectUser(b.getAttribute('data-reject'), u.name);
            if (window.TSApi && TSApi.rejectUser) TSApi.rejectUser(b.getAttribute('data-reject'), u.name).catch(function () {});
            toastMsg('User rejected', 'err');
            showApprovalsPanel(); forceLeadNav();
          } catch (ex) { toastMsg(ex.message, 'err'); }
        });
      });
      var ref = document.getElementById('btnRefreshPending');
      if (ref) ref.addEventListener('click', function () { pullUsersFromSheet().then(showApprovalsPanel); });
    }
    var pending = CredlockAuth.pendingUsers();
    var resets = CredlockAuth.openResets ? CredlockAuth.openResets() : [];
    var approved = CredlockAuth.loadUsers().filter(function (x) { return x.status === 'approved'; });
    paint(pending, resets, approved);
    pullUsersFromSheet().then(function () {
      paint(CredlockAuth.pendingUsers(), resets, CredlockAuth.loadUsers().filter(function (x) { return x.status === 'approved'; }));
    });
  }

  document.addEventListener('click', function (e) {
    if (e.target.closest && e.target.closest('[data-view="approvals"]')) {
      setTimeout(showApprovalsPanel, 40);
    }
  }, true);

  function bootRepair() {
    bindLoginHard();
    bindRegisterHard();
    bindAuthLinks();
    forceLeadNav();
    console.log('[Credlock repair] nav + auth + approvals active');
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(bootRepair, 100); });
  } else {
    setTimeout(bootRepair, 100);
  }
  setTimeout(bootRepair, 800);
  setTimeout(forceLeadNav, 1200);
})();
