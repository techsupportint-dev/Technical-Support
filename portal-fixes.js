/**
 * Portal fixes: pending approvals, ticket action buttons, user sync
 */
(function () {
  'use strict';

  function toastOk(msg, title) {
    if (typeof toastSuccess === 'function') toastSuccess(msg, title || 'OK');
    else if (typeof toast === 'function') toast(msg);
  }
  function toastErr(msg) {
    if (typeof toastError === 'function') toastError(msg, 'Error');
    else if (typeof toast === 'function') toast(msg);
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function syncUsersFromOffline() {
    try {
      if (!window.OfflineDB || !window.CredlockAuth) return;
      var offline = OfflineDB.listUsers() || [];
      var local = CredlockAuth.loadUsers() || [];
      var byEmail = {};
      local.forEach(function (u) { byEmail[(u.email || '').toLowerCase()] = u; });
      var changed = false;
      offline.forEach(function (u) {
        if (!u || !u.email) return;
        var key = u.email.toLowerCase();
        if (!byEmail[key]) {
          byEmail[key] = {
            id: u.id || ('u-' + Date.now().toString(36)),
            name: u.name || '', email: key, role: u.role || 'officer',
            pin: String(u.pin || ''), status: u.status || 'pending',
            permissions: u.permissions || null,
            createdAt: u.createdAt || new Date().toISOString(),
            approvedAt: u.approvedAt || null, approvedBy: u.approvedBy || null
          };
          changed = true;
        } else if (u.status === 'pending' && byEmail[key].status !== 'approved') {
          byEmail[key].status = 'pending';
          changed = true;
        }
      });
      if (changed) {
        CredlockAuth.saveUsers(Object.keys(byEmail).map(function (k) { return byEmail[k]; }));
      }
    } catch (e) { console.warn('syncUsers', e); }
  }

  window.renderApprovals = function () {
    syncUsersFromOffline();
    if (!window.CredlockAuth) return '<div class="empty">Auth not loaded</div>';
    if (!CredlockAuth.isLead()) {
      return '<div class="empty"><div class="empty-icon">🔒</div>Team Lead only — sign in as techsupport.int@gmail.com</div>';
    }
    var pending = CredlockAuth.pendingUsers() || [];
    var users = (CredlockAuth.loadUsers() || []).filter(function (x) { return x.status === 'approved'; });
    var resets = (CredlockAuth.openResets && CredlockAuth.openResets()) || [];

    var pendingRows = pending.map(function (p) {
      return '<tr><td>' + esc(p.name) + '</td><td>' + esc(p.email) + '</td><td>' + esc(p.role || 'officer') + '</td>' +
        '<td style="font-size:12px">' + esc(String(p.createdAt || '').slice(0, 16).replace('T', ' ')) + '</td>' +
        '<td style="white-space:nowrap">' +
        '<button type="button" class="btn btn-sm btn-success" data-approve="' + esc(p.id) + '">Approve</button> ' +
        '<button type="button" class="btn btn-sm btn-ghost" data-reject="' + esc(p.id) + '">Reject</button></td></tr>';
    }).join('');

    var userRows = users.map(function (u) {
      return '<tr><td>' + esc(u.name) + '</td><td>' + esc(u.email) + '</td><td>' + esc(u.role) + '</td>' +
        '<td><span class="badge badge-resolved">' + esc(u.status) + '</span></td><td>—</td></tr>';
    }).join('') || '<tr><td colspan="5">No approved users</td></tr>';

    return '<div class="principle"><strong>Approvals</strong> — pending registrations. Use Approve / Reject actions.</div>' +
      '<div class="grid grid-2" style="margin-bottom:18px">' +
      '<div class="kpi warn"><div class="kpi-label">Pending registrations</div><div class="kpi-value">' + pending.length + '</div></div>' +
      '<div class="kpi"><div class="kpi-label">Open reset tokens</div><div class="kpi-value">' + resets.length + '</div></div></div>' +
      '<div class="card" style="margin-bottom:16px"><div class="card-header"><span class="card-title">Pending registrations</span>' +
      '<button type="button" class="btn btn-sm btn-ghost" id="btnRefreshApprovals">Refresh</button></div>' +
      '<div class="card-body table-wrap">' +
      (pending.length
        ? '<table><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Requested</th><th>Actions</th></tr></thead><tbody>' + pendingRows + '</tbody></table>'
        : '<div class="empty">No pending registrations. Officers register on the sign-in screen (same browser as Team Lead for offline mode).</div>') +
      '</div></div>' +
      '<div class="card" style="margin-bottom:16px"><div class="card-header"><span class="card-title">Approved team</span></div>' +
      '<div class="card-body table-wrap"><table><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th></th></tr></thead><tbody>' +
      userRows + '</tbody></table></div></div>' +
      '<div class="card"><div class="card-header"><span class="card-title">Password resets</span>' +
      '<button type="button" class="btn btn-sm btn-primary" id="btnIssueReset">Issue reset token</button></div>' +
      '<div class="card-body">' +
      (resets.length
        ? '<table><thead><tr><th>Email</th><th>Token</th><th>Created</th></tr></thead><tbody>' +
          resets.map(function (r) {
            return '<tr><td>' + esc(r.email) + '</td><td><code>' + esc(r.token) + '</code></td><td>' + esc(String(r.createdAt || '').slice(0, 16)) + '</td></tr>';
          }).join('') + '</tbody></table>'
        : '<div class="empty">No open reset tokens</div>') +
      '</div></div>';
  };

  window.bindApprovals = function () {
    var ref = document.getElementById('btnRefreshApprovals');
    if (ref) ref.onclick = function () {
      syncUsersFromOffline();
      if (typeof navigate === 'function') navigate('approvals');
    };
    var issue = document.getElementById('btnIssueReset');
    if (issue) issue.onclick = function () {
      var email = prompt('Officer email for reset token:');
      if (!email) return;
      try {
        var t = CredlockAuth.issueResetToken(email, (CredlockAuth.currentUser() || {}).name);
        toastOk('Token: ' + t, 'Reset');
        if (typeof navigate === 'function') navigate('approvals');
      } catch (e) { toastErr(e.message || String(e)); }
    };
  };

  function findTicket(id) {
    if (typeof tickets === 'undefined') return null;
    for (var i = 0; i < tickets.length; i++) if (tickets[i].id === id) return tickets[i];
    return null;
  }

  function ticketQuickAction(id, action) {
    var ticket = findTicket(id);
    if (!ticket) { toastErr('Ticket not found'); return; }
    var user = window.CredlockAuth && CredlockAuth.currentUser();
    var name = (user && user.name) || 'Officer';
    if (action === 'view') { if (typeof viewTicket === 'function') viewTicket(id); return; }
    if (action === 'edit') { if (typeof editTicket === 'function') editTicket(id); return; }
    if (action === 'assign-me') {
      ticket.owner = name;
      if (ticket.status === 'New') ticket.status = 'Assigned';
      ticket.assignedAt = ticket.assignedAt || new Date().toISOString().slice(11, 16);
    } else if (action === 'in-progress') {
      ticket.status = 'In Progress';
      if (!ticket.owner) ticket.owner = name;
    } else if (action === 'resolve') {
      ticket.status = 'Resolved';
      ticket.resolvedAt = new Date().toISOString().slice(0, 16);
    } else if (action === 'pending') {
      ticket.status = 'Pending';
    } else return;
    if (typeof saveTickets === 'function') saveTickets();
    if (window.OfflineDB) OfflineDB.upsertTicket(ticket);
    toastOk('Updated: ' + action, 'Ticket');
    if (typeof navigate === 'function') navigate('tickets');
  }

  document.addEventListener('click', function (e) {
    var t = e.target;
    if (!t || !t.closest) return;
    var approveBtn = t.closest('[data-approve]');
    if (approveBtn) {
      e.preventDefault();
      var id = approveBtn.getAttribute('data-approve');
      try {
        CredlockAuth.approveUser(id, (CredlockAuth.currentUser() || {}).name);
        if (window.OfflineDB) OfflineDB.setUserStatus(id, 'approved', (CredlockAuth.currentUser() || {}).name);
        toastOk('User approved ✅', 'Approvals');
        if (CredlockAuth.refreshApprovalsBadge) CredlockAuth.refreshApprovalsBadge();
        if (typeof navigate === 'function') navigate('approvals');
      } catch (err) { toastErr(err.message || String(err)); }
      return;
    }
    var rejectBtn = t.closest('[data-reject]');
    if (rejectBtn) {
      e.preventDefault();
      var rid = rejectBtn.getAttribute('data-reject');
      try {
        CredlockAuth.rejectUser(rid, (CredlockAuth.currentUser() || {}).name);
        if (window.OfflineDB) OfflineDB.setUserStatus(rid, 'rejected', (CredlockAuth.currentUser() || {}).name);
        toastOk('User rejected', 'Approvals');
        if (typeof navigate === 'function') navigate('approvals');
      } catch (err) { toastErr(err.message || String(err)); }
      return;
    }
    var act = t.closest('[data-ticket-action]');
    if (act) {
      e.preventDefault();
      ticketQuickAction(act.getAttribute('data-ticket-id'), act.getAttribute('data-ticket-action'));
    }
  });

  function enhanceTicketRows() {
    var body = document.getElementById('ticketTableBody');
    if (!body) return;
    body.querySelectorAll('tr').forEach(function (tr) {
      if (tr.getAttribute('data-actions-ready')) return;
      var viewBtn = tr.querySelector('button[onclick*="viewTicket"]');
      if (!viewBtn) return;
      var m = (viewBtn.getAttribute('onclick') || '').match(/viewTicket\('([^']+)'\)/);
      if (!m) return;
      var id = m[1];
      tr.setAttribute('data-actions-ready', '1');
      var cell = viewBtn.parentElement;
      if (!cell) return;
      cell.innerHTML = '<div style="display:flex;flex-wrap:wrap;gap:4px">' +
        '<button type="button" class="btn btn-sm btn-ghost" data-ticket-id="' + id + '" data-ticket-action="view">View</button>' +
        '<button type="button" class="btn btn-sm btn-ghost" data-ticket-id="' + id + '" data-ticket-action="edit">Edit</button>' +
        '<button type="button" class="btn btn-sm btn-primary" data-ticket-id="' + id + '" data-ticket-action="assign-me">Assign me</button>' +
        '<button type="button" class="btn btn-sm btn-ghost" data-ticket-id="' + id + '" data-ticket-action="in-progress">In progress</button>' +
        '<button type="button" class="btn btn-sm btn-ghost" data-ticket-id="' + id + '" data-ticket-action="pending">Pending</button>' +
        '<button type="button" class="btn btn-sm btn-success" data-ticket-id="' + id + '" data-ticket-action="resolve">Resolve</button></div>';
    });
  }

  if (document.body) {
    new MutationObserver(function () { enhanceTicketRows(); }).observe(document.body, { childList: true, subtree: true });
  }

  function patchRegister() {
    if (!window.CredlockAuth || !CredlockAuth.register || CredlockAuth.register.__patched) return;
    var orig = CredlockAuth.register.bind(CredlockAuth);
    CredlockAuth.register = function (opts) {
      var ok = orig(opts);
      try {
        if (window.OfflineDB) OfflineDB.registerUser({ name: opts.name, email: opts.email, pin: opts.pin, role: opts.role });
      } catch (e) {}
      syncUsersFromOffline();
      if (CredlockAuth.refreshApprovalsBadge) CredlockAuth.refreshApprovalsBadge();
      return ok;
    };
    CredlockAuth.register.__patched = true;
  }

  var prevAfter = window.afterAuthLogin;
  window.afterAuthLogin = function (user) {
    try { if (typeof prevAfter === 'function') prevAfter(user); } catch (e) {}
    patchRegister();
    syncUsersFromOffline();
    setTimeout(function () {
      if (window.CredlockAuth && CredlockAuth.isLead && CredlockAuth.isLead()) {
        ['navApprovals', 'navLeadDash', 'navAdmin'].forEach(function (id) {
          var el = document.getElementById(id);
          if (el) { el.hidden = false; el.removeAttribute('hidden'); el.style.display = ''; }
        });
        if (CredlockAuth.refreshApprovalsBadge) CredlockAuth.refreshApprovalsBadge();
      }
    }, 100);
  };

  function boot() {
    patchRegister();
    syncUsersFromOffline();
    if (window.CredlockAuth && CredlockAuth.refreshApprovalsBadge) CredlockAuth.refreshApprovalsBadge();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(boot, 150); });
  else setTimeout(boot, 150);
})();
