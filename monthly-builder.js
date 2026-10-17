/**
 * Monthly Report Builder – design & print reports for the team
 */
(function () {
  'use strict';
  var STORE = 'credlock_monthly_builder_v1';
  function loadStore() {
    try { return JSON.parse(localStorage.getItem(STORE) || '{}'); } catch (e) { return {}; }
  }
  function saveStore(data) {
    localStorage.setItem(STORE, JSON.stringify(data));
  }
  function monthLabel(ym) {
    var p = ym.split('-');
    var names = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    return names[parseInt(p[1], 10) - 1] + ' ' + p[0];
  }
  function getTickets() {
    if (typeof tickets !== 'undefined' && Array.isArray(tickets)) return tickets;
    try { return JSON.parse(localStorage.getItem('credlock_ts_tickets_v1') || '[]'); } catch (e) { return []; }
  }
  function statsForMonth(ym) {
    var start = ym + '-01';
    var endDate = new Date(parseInt(ym.slice(0, 4), 10), parseInt(ym.slice(5, 7), 10), 0);
    var end = endDate.toISOString().slice(0, 10);
    var list = getTickets();
    var received = list.filter(function (t) { return t.date && t.date >= start && t.date <= end; });
    var resolved = list.filter(function (t) {
      var r = (t.resolvedAt || '').slice(0, 10);
      return r && r >= start && r <= end;
    });
    var open = list.filter(function (t) { return t.status !== 'Resolved'; });
    var byOwner = {}, byCat = {}, byPri = {};
    received.forEach(function (t) {
      var o = t.owner || 'Unassigned';
      byOwner[o] = byOwner[o] || { received: 0, resolved: 0 };
      byOwner[o].received++;
      if (t.status === 'Resolved') byOwner[o].resolved++;
      byCat[t.category || 'Other'] = (byCat[t.category || 'Other'] || 0) + 1;
      byPri[t.priority || 'P3 Normal'] = (byPri[t.priority || 'P3 Normal'] || 0) + 1;
    });
    return { start: start, end: end, received: received.length, resolved: resolved.length, open: open.length,
      rate: received.length ? Math.round((resolved.length / received.length) * 100) : 0,
      byOwner: byOwner, byCat: byCat, byPri: byPri };
  }
  function defaultNarrative(ym, st) {
    return {
      title: 'Technical Support Monthly Report — ' + monthLabel(ym),
      preparedBy: 'Joseph Olayemi · Team Lead',
      department: 'Credlock Africa · Technical Support',
      executiveSummary: 'This report summarises support operations for ' + monthLabel(ym) +
        '. Total requests received: ' + st.received + '. Resolved in period: ' + st.resolved +
        ' (resolution rate ' + st.rate + '%). Open backlog at report date: ' + st.open + '.',
      highlights: '• Response and ownership process followed for logged tickets.\n• Device/MDM and enrollment cases tracked.\n• Team coverage rota maintained.',
      challenges: '• Capture all requests as tickets to avoid missed messages.\n• Reduce pending external dependencies.',
      actionsNext: '• Clear backlog and assign single owners.\n• Weekly review of recurring issues.\n• Keep daily queue checks.',
      notes: ''
    };
  }
  function esc(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function escAttr(s) { return esc(s).replace(/"/g, '&quot;'); }
  function kpi(label, value) {
    return '<div class="kpi"><div class="kpi-label">' + label + '</div><div class="kpi-value">' + value + '</div></div>';
  }
  function section(title, id, value) {
    return '<div style="margin-bottom:16px"><div style="font-weight:700;color:#060527;margin-bottom:6px">' + title + '</div>' +
      '<textarea id="' + id + '" rows="4" style="width:100%;padding:10px;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;line-height:1.5;resize:vertical">' +
      esc(value) + '</textarea></div>';
  }
  function buildBody(ym, st, doc) {
    var ownerRows = Object.keys(st.byOwner).map(function (o) {
      var x = st.byOwner[o];
      return '<tr><td>' + esc(o) + '</td><td>' + x.received + '</td><td>' + x.resolved + '</td></tr>';
    }).join('') || '<tr><td colspan="3">No tickets this month yet</td></tr>';
    var catRows = Object.keys(st.byCat).map(function (c) {
      return '<tr><td>' + esc(c) + '</td><td>' + st.byCat[c] + '</td></tr>';
    }).join('') || '<tr><td colspan="2">—</td></tr>';
    var priRows = Object.keys(st.byPri).map(function (p) {
      return '<tr><td>' + esc(p) + '</td><td>' + st.byPri[p] + '</td></tr>';
    }).join('') || '<tr><td colspan="2">—</td></tr>';
    return '<div class="card" id="mbReportCard" style="padding:24px">' +
      '<div style="border-bottom:3px solid #060527;padding-bottom:12px;margin-bottom:16px">' +
      '<div style="font-size:12px;color:#64748b">CREDLOCK AFRICA</div>' +
      '<input id="mbTitle" style="width:100%;font-size:1.35rem;font-weight:700;border:none;border-bottom:1px dashed #e2e8f0;padding:6px 0;color:#060527" value="' + escAttr(doc.title) + '" />' +
      '<div style="display:flex;gap:16px;flex-wrap:wrap;margin-top:8px;font-size:13px;color:#475569">' +
      '<span>Period: <strong>' + monthLabel(ym) + '</strong> (' + st.start + ' → ' + st.end + ')</span>' +
      '<span>Prepared by: <input id="mbPrepared" style="border:none;border-bottom:1px dashed #cbd5e1;min-width:200px" value="' + escAttr(doc.preparedBy) + '" /></span></div>' +
      '<input id="mbDept" style="width:100%;margin-top:6px;border:none;border-bottom:1px dashed #cbd5e1;font-size:13px;color:#64748b" value="' + escAttr(doc.department) + '" /></div>' +
      '<div class="grid grid-4" style="margin-bottom:20px">' +
      kpi('Received', st.received) + kpi('Resolved', st.resolved) + kpi('Resolution rate', st.rate + '%') + kpi('Open backlog', st.open) + '</div>' +
      section('Executive summary', 'mbSummary', doc.executiveSummary) +
      section('Highlights', 'mbHighlights', doc.highlights) +
      section('Challenges', 'mbChallenges', doc.challenges) +
      section('Actions for next month', 'mbActions', doc.actionsNext) +
      '<div class="grid grid-2" style="margin:18px 0;gap:16px">' +
      '<div class="card" style="margin:0"><div class="card-header"><span class="card-title">By officer</span></div>' +
      '<div class="card-body table-wrap"><table><thead><tr><th>Officer</th><th>Received</th><th>Resolved</th></tr></thead><tbody>' + ownerRows + '</tbody></table></div></div>' +
      '<div class="card" style="margin:0"><div class="card-header"><span class="card-title">By category</span></div>' +
      '<div class="card-body table-wrap"><table><thead><tr><th>Category</th><th>Count</th></tr></thead><tbody>' + catRows + '</tbody></table></div></div></div>' +
      '<div class="card" style="margin-bottom:16px"><div class="card-header"><span class="card-title">By priority</span></div>' +
      '<div class="card-body table-wrap"><table><thead><tr><th>Priority</th><th>Count</th></tr></thead><tbody>' + priRows + '</tbody></table></div></div>' +
      section('Additional notes', 'mbNotes', doc.notes || '') +
      '<p style="font-size:11px;color:#94a3b8;margin-top:20px">Credlock Tech Support Portal · ' + new Date().toLocaleString() + '</p></div>';
  }
  window.renderMonthlyBuilder = function () {
    var now = new Date();
    var ym = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
    var store = loadStore();
    var st = statsForMonth(ym);
    var doc = store[ym] || defaultNarrative(ym, st);
    return '<div class="principle"><strong>Monthly Report Builder</strong> — design the management report, save it, Print or Download HTML.</div>' +
      '<div class="filters" style="display:flex;gap:12px;flex-wrap:wrap;align-items:center;margin-bottom:16px">' +
      '<label style="font-weight:600">Month</label><input type="month" id="mbMonth" value="' + ym + '" />' +
      '<button type="button" class="btn btn-primary" id="mbSave">Save report</button>' +
      '<button type="button" class="btn btn-ghost" id="mbPrint">Print / PDF</button>' +
      '<button type="button" class="btn btn-ghost" id="mbDownload">Download HTML</button>' +
      '<button type="button" class="btn btn-ghost" id="mbRefresh">Refresh stats</button></div>' +
      '<div id="mbBody">' + buildBody(ym, st, doc) + '</div>';
  };
  function collectDoc() {
    return {
      title: (document.getElementById('mbTitle') || {}).value || '',
      preparedBy: (document.getElementById('mbPrepared') || {}).value || '',
      department: (document.getElementById('mbDept') || {}).value || '',
      executiveSummary: (document.getElementById('mbSummary') || {}).value || '',
      highlights: (document.getElementById('mbHighlights') || {}).value || '',
      challenges: (document.getElementById('mbChallenges') || {}).value || '',
      actionsNext: (document.getElementById('mbActions') || {}).value || '',
      notes: (document.getElementById('mbNotes') || {}).value || ''
    };
  }
  window.bindMonthlyBuilder = function () {
    var monthEl = document.getElementById('mbMonth');
    function reload() {
      var ym = monthEl.value;
      var st = statsForMonth(ym);
      var store = loadStore();
      var doc = store[ym] || defaultNarrative(ym, st);
      var body = document.getElementById('mbBody');
      if (body) body.innerHTML = buildBody(ym, st, doc);
    }
    if (monthEl) monthEl.addEventListener('change', reload);
    document.getElementById('mbSave') && document.getElementById('mbSave').addEventListener('click', function () {
      var ym = monthEl.value;
      var store = loadStore();
      store[ym] = collectDoc();
      store[ym].savedAt = new Date().toISOString();
      saveStore(store);
      if (typeof toastSuccess === 'function') toastSuccess('Report saved for ' + monthLabel(ym) + ' ✅', 'Monthly');
    });
    document.getElementById('mbRefresh') && document.getElementById('mbRefresh').addEventListener('click', reload);
    document.getElementById('mbPrint') && document.getElementById('mbPrint').addEventListener('click', function () {
      var card = document.getElementById('mbReportCard');
      if (!card) return;
      var clone = card.cloneNode(true);
      clone.querySelectorAll('textarea').forEach(function (ta) {
        var pre = document.createElement('div');
        pre.style.whiteSpace = 'pre-wrap';
        pre.style.fontSize = '13px';
        pre.textContent = ta.value;
        ta.parentNode.replaceChild(pre, ta);
      });
      clone.querySelectorAll('input').forEach(function (inp) {
        var span = document.createElement('span');
        span.style.fontWeight = '600';
        span.textContent = inp.value;
        inp.parentNode.replaceChild(span, inp);
      });
      var w = window.open('', '_blank');
      w.document.write('<!DOCTYPE html><html><head><title>Monthly Report</title><link rel="stylesheet" href="styles.css" />' +
        '<style>body{padding:24px;font-family:Inter,system-ui,sans-serif}</style></head><body>' +
        clone.innerHTML + '<script>window.onload=function(){window.print()}<\/script></body></html>');
      w.document.close();
    });
    document.getElementById('mbDownload') && document.getElementById('mbDownload').addEventListener('click', function () {
      var ym = monthEl.value;
      var card = document.getElementById('mbReportCard');
      if (!card) return;
      var html = '<!DOCTYPE html><html><head><meta charset="utf-8"><title>' + monthLabel(ym) + ' Report</title>' +
        '<style>body{font-family:system-ui,sans-serif;max-width:900px;margin:24px auto;padding:16px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #e2e8f0;padding:8px;text-align:left}</style></head><body>' +
        card.innerHTML + '</body></html>';
      var blob = new Blob([html], { type: 'text/html' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'Credlock-Monthly-Report-' + ym + '.html';
      a.click();
      if (typeof toastSuccess === 'function') toastSuccess('HTML report downloaded', 'Monthly');
    });
  };
  document.addEventListener('click', function (e) {
    var btn = e.target.closest && e.target.closest('[data-view="monthly"]');
    if (!btn) return;
    setTimeout(function () {
      var content = document.getElementById('content');
      if (!content) return;
      content.innerHTML = window.renderMonthlyBuilder();
      window.bindMonthlyBuilder();
      var title = document.getElementById('pageTitle');
      if (title) title.textContent = 'Monthly Report Builder';
    }, 40);
  }, true);
})();
