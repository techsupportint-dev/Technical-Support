/**
 * Portal extensions: full Kavro load, bulk issues, monthly reports Jan–Dec
 */
(function () {
  // Force app.js-visible data: write seed to storage key app uses
  (function () {
    var seed = (window.KAVRO_DATA || []);
    if (seed.length < 50) return;
    try {
      var raw = localStorage.getItem('credlock_kavro_v1');
      var local = raw ? JSON.parse(raw) : [];
      if (!local || local.length < seed.length * 0.5) {
        localStorage.setItem('credlock_kavro_v1', JSON.stringify(seed));
        localStorage.setItem('credlock_kavro_v2', JSON.stringify(seed));
        if (!sessionStorage.getItem('kavro_reloaded')) {
          sessionStorage.setItem('kavro_reloaded', '1');
          location.reload();
        }
      }
    } catch (e) {}
  })();

  window.__credlockRefreshKavro = function () {
    var seed = window.KAVRO_DATA || [];
    if (!seed.length) return 0;
    localStorage.setItem('credlock_kavro_v1', JSON.stringify(seed));
    localStorage.setItem('credlock_kavro_v2', JSON.stringify(seed));
    if (typeof toastSuccess === 'function') toastSuccess('Loaded ' + seed.length + ' Kavro devices — reloading…', 'Kavro');
    location.reload();
    return seed.length;
  };

  var MONTHLY_KEY = 'credlock_monthly_reports_v1';
  var MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

  window.loadMonthlyReports = function () {
    try { return JSON.parse(localStorage.getItem(MONTHLY_KEY) || '{}'); } catch (e) { return {}; }
  };
  window.saveMonthlyReports = function (data) {
    localStorage.setItem(MONTHLY_KEY, JSON.stringify(data));
  };

  window.renderMonthlyReports = function () {
    var data = window.loadMonthlyReports();
    var year = new Date().getFullYear();
    var esc = window.esc || function (s) {
      return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    };
    var rows = MONTHS.map(function (m, i) {
      var key = year + '-' + String(i + 1).padStart(2, '0');
      var rec = data[key];
      return '<tr><td><strong>' + m + '</strong></td><td>' + (rec ? esc(rec.fileName || 'Saved') : '—') +
        '</td><td>' + (rec ? (rec.records || 0) : 0) + '</td><td style="font-size:12px">' +
        (rec ? esc(String(rec.uploadedAt || '').slice(0, 16).replace('T', ' ')) : '—') +
        '</td><td><label class="btn btn-sm btn-ghost" style="cursor:pointer">Upload<input type="file" accept=".csv,.xlsx,text/csv" data-month="' +
        key + '" class="month-upload" style="display:none"/></label>' +
        (rec ? ' <button class="btn btn-sm btn-ghost" data-view-month="' + key + '">View</button>' : '') +
        '</td></tr>';
    }).join('');
    return '<div class="principle"><strong>Monthly reports</strong> — upload CSVs for January–December ' + year +
      '.</div><div class="card"><div class="card-header"><span class="card-title">' + year +
      ' monthly uploads</span><button class="btn btn-sm btn-primary" id="btnBulkIssues">Bulk import issues</button></div>' +
      '<div class="card-body table-wrap"><table><thead><tr><th>Month</th><th>File</th><th>Records</th><th>Uploaded</th><th></th></tr></thead><tbody>' +
      rows + '</tbody></table></div></div>' +
      '<div class="card" style="margin-top:16px"><div class="card-header"><span class="card-title">Bulk issue import</span></div>' +
      '<div class="card-body"><p style="font-size:13px;color:var(--muted);margin-bottom:10px">CSV: Ticket ID, Channel, Requester, Contact, Priority, Category, Summary, Owner, Status</p>' +
      '<input type="file" id="bulkIssuesFile" accept=".csv,text/csv" /></div></div>';
  };

  window.bindMonthlyReports = function () {
    document.querySelectorAll('.month-upload').forEach(function (inp) {
      inp.addEventListener('change', async function () {
        var file = inp.files && inp.files[0];
        if (!file) return;
        var key = inp.getAttribute('data-month');
        var text = await file.text();
        var lines = text.split(/\r?\n/).filter(function (l) { return l.trim(); });
        var records = Math.max(0, lines.length - 1);
        var data = window.loadMonthlyReports();
        data[key] = { fileName: file.name, records: records, uploadedAt: new Date().toISOString(), preview: text.slice(0, 2000), yearMonth: key };
        window.saveMonthlyReports(data);
        if (window.TSApi && TSApi.request) TSApi.request('saveMonthlyReport', { report: data[key], month: key }).catch(function () {});
        if (typeof toastSuccess === 'function') toastSuccess(file.name + ' saved for ' + key + ' ✅', 'Monthly report');
        if (typeof navigate === 'function') navigate('monthly-reports');
      });
    });
    document.querySelectorAll('[data-view-month]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var key = btn.getAttribute('data-view-month');
        var rec = window.loadMonthlyReports()[key];
        if (!rec) return;
        if (typeof openModal === 'function') openModal('Report ' + key, '<pre style="white-space:pre-wrap;font-size:12px;max-height:400px;overflow:auto">' +
          (window.esc ? window.esc(rec.preview || '') : rec.preview) + '</pre>', '');
      });
    });
    var bulk = document.getElementById('bulkIssuesFile');
    if (bulk) bulk.addEventListener('change', async function () {
      if (bulk.files && bulk.files[0] && window.importBulkIssues) await window.importBulkIssues(bulk.files[0]);
      bulk.value = '';
    });
    var btn = document.getElementById('btnBulkIssues');
    if (btn) btn.addEventListener('click', function () { var el = document.getElementById('bulkIssuesFile'); if (el) el.click(); });
  };

  window.importBulkIssues = window.importBulkIssues || async function (file) {
    var text = await file.text();
    var lines = text.split(/\r?\n/).filter(function (l) { return l.trim(); });
    if (lines.length < 2) { if (typeof toastError === 'function') toastError('No rows', 'Bulk'); return; }
    var headers = lines[0].split(',').map(function (h) { return h.trim().replace(/^"|"$/g, ''); });
    var mapped = [];
    for (var i = 1; i < lines.length; i++) {
      var cells = lines[i].split(',');
      var row = {};
      headers.forEach(function (h, j) { row[h] = (cells[j] || '').trim().replace(/^"|"$/g, ''); });
      mapped.push({
        id: row['Ticket ID'] || row.id || ('TS-IMP-' + Date.now() + '-' + i),
        created: row.Created || new Date().toISOString(),
        channel: row.Channel || 'Bulk Import',
        requester: row.Requester || '',
        contact: row.Contact || '',
        priority: row.Priority || 'P3',
        category: row.Category || 'General',
        summary: row.Summary || row.Issue || '',
        owner: row.Owner || '',
        status: row.Status || 'New',
        notes: row.Notes || ''
      });
    }
    if (typeof tickets !== 'undefined' && Array.isArray(tickets)) {
      var byId = {};
      tickets.forEach(function (t) { byId[t.id] = t; });
      mapped.forEach(function (t) { byId[t.id] = Object.assign({}, byId[t.id] || {}, t); });
      tickets = Object.values(byId);
      if (typeof saveTickets === 'function') saveTickets();
      if (typeof updateNavBadge === 'function') updateNavBadge();
    }
    if (window.TSApi && TSApi.bulkTickets) {
      var r = await TSApi.bulkTickets(mapped);
      if (r && r.ok) { if (typeof toastSuccess === 'function') toastSuccess('Imported ' + mapped.length + ' issues (Sheet) ✅', 'Bulk'); }
      else if (typeof toastSuccess === 'function') toastSuccess('Imported ' + mapped.length + ' issues locally ✅', 'Bulk');
    } else if (typeof toastSuccess === 'function') toastSuccess('Imported ' + mapped.length + ' issues locally ✅', 'Bulk');
    if (typeof render === 'function') render();
  };
})();
