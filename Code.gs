/**
 * Credlock Portal API – paste into Apps Script bound to spreadsheet
 * Spreadsheet ID: 1qOySvKFNS5kkMGjHoyr51-qJJ3bQavTzk83k5owZbIo
 * Deploy: Web app → Execute as Me → Anyone → copy /exec URL
 */
var SS_ID = '1qOySvKFNS5kkMGjHoyr51-qJJ3bQavTzk83k5owZbIo';

function doGet(e) {
  return handle_(e && e.parameter ? e.parameter : {}, null);
}
function doPost(e) {
  var body = {};
  try {
    if (e && e.postData && e.postData.contents) body = JSON.parse(e.postData.contents);
  } catch (err) {}
  return handle_(e && e.parameter ? e.parameter : {}, body);
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function handle_(params, body) {
  body = body || {};
  var action = body.action || (params && params.action) || 'ping';
  try {
    switch (String(action)) {
      case 'ping':
        return json_({ ok: true, service: 'Credlock Portal API', version: '3.3', time: new Date().toISOString() });
      case 'registerUser':
        return json_(registerUser_(body));
      case 'listUsers':
        return json_({ ok: true, users: listUsers_() });
      case 'approveUser':
        return json_(setStatus_(body.userId || body.id, 'approved', body.by));
      case 'rejectUser':
        return json_(setStatus_(body.userId || body.id, 'rejected', body.by));
      case 'listTickets':
        return json_({ ok: true, tickets: listTickets_() });
      case 'sync':
        return json_({ ok: true, tickets: listTickets_(), users: listUsers_(), time: new Date().toISOString() });
      case 'setup':
        return json_(setup_());
      default:
        return json_({ ok: false, error: 'Unknown action: ' + action });
    }
  } catch (err) {
    return json_({ ok: false, error: String(err.message || err) });
  }
}

function ss_() { return SpreadsheetApp.openById(SS_ID); }

function usersSheet_() {
  var ss = ss_();
  var sh = ss.getSheetByName('Users');
  if (!sh) {
    sh = ss.insertSheet('Users');
    sh.appendRow(['User ID','Name','Email','Role','PIN','Status','Permissions','Created At','Approved At','Approved By']);
    sh.getRange(1,1,1,10).setFontWeight('bold');
  }
  return sh;
}

function setup_() {
  usersSheet_();
  var rows = listUsers_();
  if (!rows.some(function (u) { return u.email === 'techsupport.int@gmail.com'; })) {
    usersSheet_().appendRow(['u-lead-joseph','Joseph Olayemi','techsupport.int@gmail.com','lead','6424','approved','ALL', new Date().toISOString(), new Date().toISOString(), 'system']);
  }
  return { ok: true, message: 'Users sheet ready' };
}

function listUsers_() {
  var sh = usersSheet_();
  var data = sh.getDataRange().getValues();
  if (data.length < 2) return [];
  var out = [];
  for (var i = 1; i < data.length; i++) {
    var r = data[i];
    if (!r[2]) continue;
    out.push({
      id: String(r[0] || ''),
      name: String(r[1] || ''),
      email: String(r[2] || '').toLowerCase(),
      role: String(r[3] || 'officer'),
      pin: String(r[4] || ''),
      status: String(r[5] || 'pending'),
      permissions: r[6],
      createdAt: String(r[7] || ''),
      approvedAt: String(r[8] || ''),
      approvedBy: String(r[9] || '')
    });
  }
  return out;
}

function registerUser_(body) {
  var email = String(body.email || '').trim().toLowerCase();
  var name = String(body.name || '').trim();
  var pin = String(body.pin || '').trim();
  var role = body.role === 'viewer' ? 'viewer' : 'officer';
  if (!email || !name || !pin) return { ok: false, error: 'All fields required' };
  if (!/^\d{4,6}$/.test(pin)) return { ok: false, error: 'PIN must be 4-6 digits' };
  var users = listUsers_();
  if (users.some(function (u) { return u.email === email; })) {
    return { ok: false, error: 'Email already registered' };
  }
  var id = 'u-' + Utilities.getUuid().slice(0, 8);
  usersSheet_().appendRow([id, name, email, role, pin, 'pending', '', new Date().toISOString(), '', '']);
  return { ok: true, id: id, status: 'pending' };
}

function setStatus_(userId, status, by) {
  var sh = usersSheet_();
  var data = sh.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(userId) || String(data[i][2]).toLowerCase() === String(userId).toLowerCase()) {
      sh.getRange(i + 1, 6).setValue(status);
      if (status === 'approved') sh.getRange(i + 1, 9).setValue(new Date().toISOString());
      sh.getRange(i + 1, 10).setValue(by || 'Team Lead');
      return { ok: true, userId: userId, status: status };
    }
  }
  return { ok: false, error: 'User not found' };
}

function listTickets_() {
  var sh = ss_().getSheetByName('Tickets');
  if (!sh) return [];
  var data = sh.getDataRange().getValues();
  if (data.length < 2) return [];
  var hdr = data[0].map(String);
  var out = [];
  for (var i = 1; i < data.length; i++) {
    var o = {};
    for (var c = 0; c < hdr.length; c++) o[hdr[c]] = data[i][c];
    if (!o['Ticket ID'] && !o.id) continue;
    out.push({
      id: o['Ticket ID'] || o.id,
      created: o.Created,
      channel: o.Channel,
      requester: o.Requester,
      contact: o.Contact,
      priority: o.Priority,
      category: o.Category,
      summary: o.Summary,
      owner: o.Owner,
      status: o.Status,
      notes: o.Notes
    });
  }
  return out;
}
