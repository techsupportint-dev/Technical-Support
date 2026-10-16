/**
 * Credlock Africa – Tech Support Portal
 * Client-side SPA with localStorage persistence
 * Aligned to Technical Support Operations Playbook – 14 Oct 2026
 */

const STORAGE_KEY = 'credlock_ts_tickets_v1';
const ROTA_KEY = 'credlock_ts_rota_v1';
const NOTIFY_KEY = 'credlock_ts_notify_v1';
const NOTIFY_LOG_KEY = 'credlock_ts_notify_log_v1';

const OFFICERS = ['Tosin', 'Peter', 'Zainab', 'Joseph Olayemi'];
const PRIORITIES = ['P1 Critical', 'P2 High', 'P3 Normal', 'P4 Low'];
const STATUSES = ['New', 'Assigned', 'In Progress', 'Pending', 'Resolved'];
const CATEGORIES = [
  'Merchant Support', 'Customer Support', 'Enrollment', 'Device/MDM',
  'Application/Platform', 'Payment/Transaction', 'Access/Account',
  'Internal Request', 'Incident/Outage', 'Other'
];
const CHANNELS = [
  'Phone 1 External', 'Phone 2 Enrollment', 'WhatsApp', 'Call',
  'Missed Call', 'Ticketing System', 'Internal Chat', 'Other'
];
const TYPES = ['Merchant', 'Customer', 'Enrollment Officer', 'Internal Staff', 'Other'];

const RESPONSE_TARGETS = {
  'P1 Critical': 5,
  'P2 High': 10,
  'P3 Normal': 30,
  'P4 Low': 120
};

const TEAM_INFO = {
  'Tosin': {
    role: 'Queue & Frontline',
    focus: 'Monitor incoming messages & missed calls; acknowledge; create tickets; categorize & route; follow up unanswered; maintain daily intake count.'
  },
  'Peter': {
    role: 'Devices & Enrollment',
    focus: 'Device, MDM/KAVRO, Manager App, lock/unlock, device validation, IMEI & enrollment cases. Escalate elevated needs.'
  },
  'Zainab': {
    role: 'Quality & Backup',
    focus: 'Review unassigned, overdue & pending tickets; back up intake; check update quality; identify recurring issues; daily operational summary.'
  },
  'Joseph Olayemi': {
    role: 'Team Lead',
    focus: 'Departmental performance, workload balancing, critical escalations, cross-dept coordination, coaching, management reporting.'
  }
};

const TEMPLATES = [
  {
    name: 'Acknowledgement',
    text: 'Hello, thank you for contacting Credlock Technical Support. We have received your request and are reviewing it. Your ticket reference is [Ticket ID]. The next step is [next action]. We will provide an update by [time/date].'
  },
  {
    name: 'Need more information',
    text: 'Hello, we are investigating ticket [Ticket ID]. Please provide [specific details/screenshots/error message] so we can continue. Please avoid sending passwords, OTPs, or unnecessary sensitive personal information.'
  },
  {
    name: 'Pending update',
    text: 'Hello, an update on ticket [Ticket ID]: we have completed [work done]. The issue is currently awaiting [dependency/action]. [Owner/team] is following up, and our next update is due by [time/date].'
  },
  {
    name: 'Resolution confirmation',
    text: 'Hello, ticket [Ticket ID] has been addressed. The action taken was [brief resolution], and the result was [test/confirmation]. Please let us know promptly if the same issue persists.'
  },
  {
    name: 'Internal escalation',
    text: 'Ticket: [ID]. Priority: [P1–P4]. Impact: [users/process affected]. Started: [time]. Steps attempted: [list]. Current status: [status]. Assistance required: [specific request]. Next stakeholder update due: [time].'
  }
];

// Default notification settings (emails are placeholders – team fills real addresses)
const DEFAULT_NOTIFY = {
  enabled: true,
  teamLeadEmail: 'joseph.olayemi@credlock.africa',
  engineeringEmail: 'engineering@credlock.africa',
  opsEmail: 'operations@credlock.africa',
  officerEmails: {
    'Tosin': 'tosin@credlock.africa',
    'Peter': 'peter@credlock.africa',
    'Zainab': 'zainab@credlock.africa',
    'Joseph Olayemi': 'joseph.olayemi@credlock.africa'
  },
  rules: {
    onP1: true,           // notify Team Lead on every P1
    onP2: true,           // notify owner + Team Lead on P2
    onEscalation: true,   // notify when escalation field is filled
    onAssign: true,       // notify assigned officer
    onResolve: false,     // optional resolve notification
    onOverdue: true       // flag overdue in digests
  }
};

// ── State ────────────────────────────────────────────────────────────
let tickets = loadTickets();
let currentView = 'dashboard';
let editId = null;
let notifySettings = loadNotifySettings();
let notifyLog = loadNotifyLog();

// Seed sample data if empty
if (tickets.length === 0) {
  tickets = getSampleTickets();
  saveTickets();
}

function updateNavBadge() {
  const el = document.getElementById('navOpenCount');
  if (el) {
    const n = tickets.filter(t => t.status !== 'Resolved').length;
    el.textContent = n;
    el.style.display = n ? 'inline-block' : 'none';
  }
}

async function syncFromSheets() {
  if (!window.TSApi) { toast('API layer not loaded'); return; }
  toast('Syncing…');
  const result = await TSApi.sync();
  if (result.ok) {
    const remote = await TSApi.listTickets();
    if (remote && remote.length) {
      tickets = remote;
      saveTickets();
    }
    updateNavBadge();
    render();
    toastSuccess('Synced ' + tickets.length + ' tickets from Google Sheet', 'Google Sheets');
  } else {
    toast('Sheets offline – using local data');
    render();
  }
}

// ── Persistence ──────────────────────────────────────────────────────
function loadTickets() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveTickets() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tickets));
}

function loadNotifySettings() {
  try {
    const raw = localStorage.getItem(NOTIFY_KEY);
    if (raw) return { ...DEFAULT_NOTIFY, ...JSON.parse(raw), rules: { ...DEFAULT_NOTIFY.rules, ...(JSON.parse(raw).rules || {}) }, officerEmails: { ...DEFAULT_NOTIFY.officerEmails, ...(JSON.parse(raw).officerEmails || {}) } };
  } catch { /* ignore */ }
  return JSON.parse(JSON.stringify(DEFAULT_NOTIFY));
}

function saveNotifySettings() {
  localStorage.setItem(NOTIFY_KEY, JSON.stringify(notifySettings));
}

function loadNotifyLog() {
  try {
    const raw = localStorage.getItem(NOTIFY_LOG_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveNotifyLog() {
  // Keep last 100 entries
  if (notifyLog.length > 100) notifyLog = notifyLog.slice(0, 100);
  localStorage.setItem(NOTIFY_LOG_KEY, JSON.stringify(notifyLog));
}

function loadRota() {
  try {
    const raw = localStorage.getItem(ROTA_KEY);
    return raw ? JSON.parse(raw) : getDefaultRota();
  } catch {
    return getDefaultRota();
  }
}

function saveRota(rota) {
  localStorage.setItem(ROTA_KEY, JSON.stringify(rota));
}

function getDefaultRota() {
  return {
    weekStart: getMonday(new Date()).toISOString().slice(0, 10),
    slots: {
      'Opening': ['All', 'All', 'All', 'All', 'All'],
      'Phone 1 AM': ['Tosin', 'Tosin', 'Tosin', 'Tosin', 'Tosin'],
      'Phone 2 AM': ['Peter', 'Peter', 'Peter', 'Peter', 'Peter'],
      'Midday': ['Zainab', 'Zainab', 'Zainab', 'Zainab', 'Zainab'],
      'Phone 1 PM': ['Tosin', 'Tosin', 'Tosin', 'Tosin', 'Tosin'],
      'Phone 2 PM': ['Peter', 'Peter', 'Peter', 'Peter', 'Peter'],
      'Closing': ['All', 'All', 'All', 'All', 'All'],
      'Backup': ['Zainab', 'Joseph Olayemi', 'Zainab', 'Joseph Olayemi', 'Zainab']
    }
  };
}

function getSampleTickets() {
  const today = new Date();
  const yest = new Date(today);
  yest.setDate(yest.getDate() - 1);

  return [
    {
      id: genId(yest, 1),
      date: yest.toISOString().slice(0, 10),
      timeIn: '09:05',
      requester: 'Merchant Apex',
      type: 'Merchant',
      channel: 'Phone 1 External',
      category: 'Device/MDM',
      description: 'Device locked after payment – cannot unlock',
      priority: 'P2 High',
      impact: 'Sales blocked',
      owner: 'Peter',
      assignedAt: '09:08',
      firstResponse: '09:12',
      status: 'Resolved',
      lastUpdate: yest.toISOString().slice(0, 10) + 'T10:25',
      nextAction: 'Closed',
      resolutionNotes: 'Unlocked via Manager App; merchant confirmed',
      resolvedAt: yest.toISOString().slice(0, 10) + 'T10:25',
      escalation: ''
    },
    {
      id: genId(yest, 2),
      date: yest.toISOString().slice(0, 10),
      timeIn: '09:22',
      requester: 'EO - Fatima',
      type: 'Enrollment Officer',
      channel: 'Phone 2 Enrollment',
      category: 'Enrollment',
      description: 'IMEI validation fails on new device batch',
      priority: 'P3 Normal',
      impact: 'Enrollment delayed',
      owner: 'Peter',
      assignedAt: '09:25',
      firstResponse: '09:30',
      status: 'Pending',
      lastUpdate: yest.toISOString().slice(0, 10) + 'T11:00',
      nextAction: 'Await MDM elevated rights – follow-up tomorrow 09:00',
      resolutionNotes: '',
      resolvedAt: '',
      escalation: 'Escalated to Joseph – elevated access needed'
    },
    {
      id: genId(yest, 3),
      date: yest.toISOString().slice(0, 10),
      timeIn: '10:15',
      requester: 'Customer K.O.',
      type: 'Customer',
      channel: 'WhatsApp',
      category: 'Payment/Transaction',
      description: 'Transaction declined – needs investigation',
      priority: 'P2 High',
      impact: 'Payment blocked',
      owner: 'Tosin',
      assignedAt: '10:18',
      firstResponse: '10:22',
      status: 'In Progress',
      lastUpdate: yest.toISOString().slice(0, 10) + 'T14:00',
      nextAction: 'Gateway check – update by 15:00',
      resolutionNotes: '',
      resolvedAt: '',
      escalation: ''
    },
    {
      id: genId(today, 1),
      date: today.toISOString().slice(0, 10),
      timeIn: '08:30',
      requester: 'Merchant Zenith',
      type: 'Merchant',
      channel: 'Phone 1 External',
      category: 'Application/Platform',
      description: 'Manager App crashes on login',
      priority: 'P3 Normal',
      impact: 'Cannot manage devices',
      owner: 'Zainab',
      assignedAt: '08:35',
      firstResponse: '08:40',
      status: 'Assigned',
      lastUpdate: today.toISOString().slice(0, 10) + 'T09:00',
      nextAction: 'Reproduce + collect logs – due 12:00 today',
      resolutionNotes: '',
      resolvedAt: '',
      escalation: ''
    },
    {
      id: genId(today, 2),
      date: today.toISOString().slice(0, 10),
      timeIn: '09:00',
      requester: 'Staff - Audit',
      type: 'Internal Staff',
      channel: 'Internal Chat',
      category: 'Access/Account',
      description: 'Temporary elevated access for quarterly audit',
      priority: 'P4 Low',
      impact: 'No immediate impact',
      owner: 'Joseph Olayemi',
      assignedAt: '09:10',
      firstResponse: '09:15',
      status: 'New',
      lastUpdate: today.toISOString().slice(0, 10) + 'T09:15',
      nextAction: 'Review & approve/reject by EOD',
      resolutionNotes: '',
      resolvedAt: '',
      escalation: ''
    },
    {
      id: genId(today, 3),
      date: today.toISOString().slice(0, 10),
      timeIn: '09:45',
      requester: 'Merchant Nova',
      type: 'Merchant',
      channel: 'Missed Call',
      category: 'Merchant Support',
      description: 'Missed call – returned; query on settlement report',
      priority: 'P3 Normal',
      impact: 'Report access',
      owner: 'Tosin',
      assignedAt: '09:50',
      firstResponse: '09:55',
      status: 'In Progress',
      lastUpdate: today.toISOString().slice(0, 10) + 'T10:30',
      nextAction: 'Guide merchant on report path – confirm by 14:00',
      resolutionNotes: '',
      resolvedAt: '',
      escalation: ''
    }
  ];
}

// ── Helpers ──────────────────────────────────────────────────────────
function genId(date, seq) {
  const d = date instanceof Date ? date : new Date(date);
  const y = String(d.getFullYear()).slice(2);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `TS-${y}${m}${day}-${String(seq).padStart(3, '0')}`;
}

function nextSeq(dateStr) {
  const sameDay = tickets.filter(t => t.date === dateStr);
  return sameDay.length + 1;
}

function getMonday(d) {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(date.setDate(diff));
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function responseOk(ticket) {
  if (!ticket.firstResponse || !ticket.timeIn || !ticket.priority) return null;
  const target = RESPONSE_TARGETS[ticket.priority];
  if (!target) return null;
  const [h1, m1] = ticket.timeIn.split(':').map(Number);
  const [h2, m2] = ticket.firstResponse.split(':').map(Number);
  const mins = (h2 * 60 + m2) - (h1 * 60 + m1);
  return mins <= target;
}

function isOverdue(ticket) {
  if (ticket.status === 'Resolved' || !ticket.date) return false;
  const created = new Date(ticket.date + 'T' + (ticket.timeIn || '00:00'));
  const now = new Date();
  const mins = (now - created) / 60000;
  const thresholds = { 'P1 Critical': 30, 'P2 High': 120, 'P3 Normal': 480, 'P4 Low': 1440 };
  return mins > (thresholds[ticket.priority] || 1440);
}

function priorityBadge(p) {
  const map = { 'P1 Critical': 'p1', 'P2 High': 'p2', 'P3 Normal': 'p3', 'P4 Low': 'p4' };
  return `<span class="badge badge-${map[p] || 'p3'}">${p || '—'}</span>`;
}

function statusBadge(s) {
  const map = {
    'New': 'new', 'Assigned': 'assigned', 'In Progress': 'progress',
    'Pending': 'pending', 'Resolved': 'resolved'
  };
  return `<span class="badge badge-${map[s] || 'new'}">${s || '—'}</span>`;
}

// ── Notifications: toast box, sounds, alerts, reminders ─────────────
const SOUND_PREF_KEY = 'credlock_ts_sound_v1';

function soundEnabled() {
  try {
    const v = localStorage.getItem(SOUND_PREF_KEY);
    return v === null ? true : v === '1';
  } catch (e) { return true; }
}
function setSoundEnabled(on) {
  localStorage.setItem(SOUND_PREF_KEY, on ? '1' : '0');
}

/** Web Audio beeps – no external files needed */
function playTone(freq, duration, type, gainVal) {
  if (!soundEnabled()) return;
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    if (!window._credlockAudioCtx) window._credlockAudioCtx = new Ctx();
    const ctx = window._credlockAudioCtx;
    if (ctx.state === 'suspended') ctx.resume();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type || 'sine';
    osc.frequency.value = freq;
    gain.gain.value = gainVal != null ? gainVal : 0.08;
    osc.connect(gain);
    gain.connect(ctx.destination);
    const t = ctx.currentTime;
    gain.gain.setValueAtTime(gain.gain.value, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
    osc.start(t);
    osc.stop(t + duration + 0.02);
  } catch (e) { /* ignore */ }
}

function playSound(kind) {
  if (!soundEnabled()) return;
  if (kind === 'success') {
    playTone(523.25, 0.08, 'sine', 0.07);
    setTimeout(() => playTone(659.25, 0.12, 'sine', 0.07), 90);
  } else if (kind === 'ticket') {
    // Incoming ticket – two-tone alert
    playTone(880, 0.12, 'square', 0.05);
    setTimeout(() => playTone(1174.66, 0.18, 'square', 0.05), 140);
    setTimeout(() => playTone(880, 0.1, 'square', 0.04), 320);
  } else if (kind === 'alert') {
    playTone(400, 0.15, 'sawtooth', 0.06);
    setTimeout(() => playTone(320, 0.2, 'sawtooth', 0.06), 160);
  } else if (kind === 'warn') {
    playTone(600, 0.1, 'triangle', 0.06);
    setTimeout(() => playTone(600, 0.1, 'triangle', 0.05), 150);
  } else if (kind === 'error') {
    playTone(200, 0.25, 'sawtooth', 0.07);
  } else {
    playTone(500, 0.1, 'sine', 0.05);
  }
}

/**
 * Notification message box
 * @param {string} msg
 * @param {'success'|'error'|'warn'|'info'|'ticket'} [type]
 * @param {string} [title]
 */
function toast(msg, type, title) {
  type = type || 'info';
  const stack = document.getElementById('toastStack') || document.getElementById('toast');
  if (!stack) {
    console.log('[toast]', type, msg);
    return;
  }

  // Legacy single toast element
  if (stack.id === 'toast') {
    const icons = { success: '✅', error: '❌', warn: '⚠️', info: 'ℹ️', ticket: '🎫' };
    stack.textContent = (icons[type] || '') + ' ' + msg;
    stack.className = 'toast show ' + type;
    clearTimeout(stack._hideTimer);
    stack._hideTimer = setTimeout(() => stack.classList.remove('show'), 3500);
    if (type === 'success') playSound('success');
    else if (type === 'ticket') playSound('ticket');
    else if (type === 'error') playSound('error');
    else if (type === 'warn') playSound('warn');
    return;
  }

  const icons = { success: '✅', error: '❌', warn: '⚠️', info: 'ℹ️', ticket: '🎫' };
  const titles = {
    success: title || 'Success',
    error: title || 'Error',
    warn: title || 'Warning',
    info: title || 'Notice',
    ticket: title || 'New ticket'
  };

  const el = document.createElement('div');
  el.className = 'toast ' + type;
  el.innerHTML =
    '<span class="toast-icon">' + (icons[type] || 'ℹ️') + '</span>' +
    '<div class="toast-body">' +
      '<div class="toast-title">' + titles[type] + '</div>' +
      '<div class="toast-msg"></div>' +
    '</div>' +
    '<button type="button" class="toast-close" aria-label="Dismiss">×</button>';
  el.querySelector('.toast-msg').textContent = msg;

  const remove = () => {
    el.classList.remove('show');
    setTimeout(() => el.remove(), 280);
  };
  el.querySelector('.toast-close').onclick = remove;
  stack.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(remove, type === 'ticket' || type === 'alert' ? 6000 : 3800);

  if (type === 'success') playSound('success');
  else if (type === 'ticket') playSound('ticket');
  else if (type === 'error') playSound('error');
  else if (type === 'warn') playSound('warn');
  else if (type === 'info') playSound('info');
}

function toastSuccess(msg, title) { toast(msg, 'success', title || 'Success'); }
function toastError(msg, title) { toast(msg, 'error', title || 'Error'); }
function toastWarn(msg, title) { toast(msg, 'warn', title || 'Warning'); }
function toastTicket(msg, title) { toast(msg, 'ticket', title || 'Incoming ticket'); }

/** Top reminder bar for urgent items */
function showReminder(text, actionFn, tone) {
  const bar = document.getElementById('reminderBar');
  const txt = document.getElementById('reminderText');
  const act = document.getElementById('reminderAction');
  const dis = document.getElementById('reminderDismiss');
  if (!bar || !txt) return;
  txt.textContent = text;
  bar.classList.add('show');
  bar.classList.toggle('warn-bg', tone === 'warn');
  if (act) {
    act.onclick = () => {
      bar.classList.remove('show');
      if (typeof actionFn === 'function') actionFn();
    };
  }
  if (dis) dis.onclick = () => bar.classList.remove('show');
  playSound(tone === 'warn' ? 'warn' : 'alert');
}

/** Scan open tickets / Kavro / approvals and surface reminders */
function runAlertReminders() {
  const u = window.CredlockAuth && CredlockAuth.currentUser();
  if (!u) return;

  const open = (typeof tickets !== 'undefined' ? tickets : []).filter(
    t => t.status !== 'Resolved' && t.status !== 'Closed'
  );
  const p1 = open.filter(t => t.priority === 'P1 Critical');
  const unassigned = open.filter(t => !t.owner || t.owner === '—');
  const pending = (window.CredlockAuth && CredlockAuth.pendingUsers)
    ? CredlockAuth.pendingUsers().length : 0;

  if (u.role === 'lead' && p1.length > 0) {
    showReminder(
      '⚠️ ' + p1.length + ' open P1 Critical ticket(s) need attention',
      () => navigate('lead-dash'),
      'alert'
    );
  } else if (u.role === 'lead' && pending > 0) {
    showReminder(
      'ℹ️ ' + pending + ' registration(s) waiting for approval',
      () => navigate('approvals'),
      'warn'
    );
  } else if (u.role !== 'lead') {
    const name = (u.name || '').toLowerCase();
    const mine = open.filter(t => (t.owner || '').toLowerCase().includes(name.split(' ')[0]));
    const myP1 = mine.filter(t => t.priority === 'P1 Critical');
    if (myP1.length) {
      showReminder(
        '⚠️ You have ' + myP1.length + ' open P1 ticket(s)',
        () => navigate('my-work'),
        'alert'
      );
    }
  }

  if (u.role === 'lead' && unassigned.length >= 3) {
    // secondary toast only
    toastWarn(unassigned.length + ' tickets have no owner', 'Unassigned queue');
  }
}

let _ticketCountSnapshot = null;

/** Call after tickets array changes – detect new incoming */
function watchIncomingTickets() {
  if (typeof tickets === 'undefined') return;
  const openIds = tickets
    .filter(t => t.status !== 'Resolved' && t.status !== 'Closed')
    .map(t => t.id)
    .sort();
  if (_ticketCountSnapshot === null) {
    _ticketCountSnapshot = openIds.join(',');
    return;
  }
  const prev = new Set(_ticketCountSnapshot.split(',').filter(Boolean));
  const newer = openIds.filter(id => !prev.has(id));
  _ticketCountSnapshot = openIds.join(',');
  if (newer.length === 1) {
    const t = tickets.find(x => x.id === newer[0]);
    toastTicket(
      (t ? (t.id + ' · ' + (t.requester || '') + ' · ' + (t.priority || '')) : newer[0]),
      'Incoming ticket'
    );
  } else if (newer.length > 1) {
    toastTicket(newer.length + ' new tickets in the queue', 'Incoming tickets');
  }
}

// ── Email / Notification helpers ─────────────────────────────────────
function buildTicketEmailBody(ticket, purpose) {
  const lines = [
    `Credlock Technical Support – ${purpose}`,
    `────────────────────────────────────`,
    `Ticket ID:     ${ticket.id}`,
    `Priority:      ${ticket.priority}`,
    `Status:        ${ticket.status}`,
    `Requester:     ${ticket.requester} (${ticket.type || ''})`,
    `Channel:       ${ticket.channel || ''}`,
    `Category:      ${ticket.category || ''}`,
    `Received:      ${ticket.date} ${ticket.timeIn || ''}`,
    `Owner:         ${ticket.owner || 'Unassigned'}`,
    `Impact:        ${ticket.impact || '—'}`,
    ``,
    `Description:`,
    ticket.description || '—',
    ``,
    `Next action:   ${ticket.nextAction || '—'}`,
    `Escalation:    ${ticket.escalation || '—'}`,
    ``,
    `First response: ${ticket.firstResponse || 'Not yet'}`,
    `────────────────────────────────────`,
    `This message was prepared from the Tech Support Portal.`,
    `Please do not reply with passwords or OTPs.`
  ];
  return lines.join('\n');
}

function buildMailto(to, subject, body, cc) {
  let url = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  if (cc) url += `&cc=${encodeURIComponent(cc)}`;
  return url;
}

function logNotification(entry) {
  notifyLog.unshift({
    id: 'N-' + Date.now(),
    at: new Date().toISOString(),
    ...entry
  });
  saveNotifyLog();
}

/**
 * Opens the user's email client with a pre-filled message.
 * Also records the attempt in the notification log.
 */
function sendEmailNotification(ticket, purpose, recipients, extraNote) {
  if (!notifySettings.enabled) {
    toast('Email notifications are disabled in settings');
    return;
  }
  const to = Array.isArray(recipients) ? recipients.filter(Boolean).join(',') : recipients;
  if (!to) {
    toast('No recipient email configured');
    return;
  }
  const subject = `[${ticket.priority}] ${ticket.id} – ${purpose}`;
  let body = buildTicketEmailBody(ticket, purpose);
  if (extraNote) body += `\n\nNote: ${extraNote}`;

  const mailto = buildMailto(to, subject, body);
  window.open(mailto, '_self');

  logNotification({
    ticketId: ticket.id,
    purpose,
    to,
    priority: ticket.priority,
    status: 'opened-mail-client'
  });
  toast('Email draft opened for ' + purpose);
}

/** Decide who should be notified based on rules + ticket */
function getRecipientsFor(ticket, event) {
  const s = notifySettings;
  const emails = [];
  const ownerEmail = s.officerEmails[ticket.owner];

  if (event === 'p1' || (event === 'create' && ticket.priority === 'P1 Critical' && s.rules.onP1)) {
    if (s.teamLeadEmail) emails.push(s.teamLeadEmail);
    if (ownerEmail) emails.push(ownerEmail);
  }
  if (event === 'p2' || (event === 'create' && ticket.priority === 'P2 High' && s.rules.onP2)) {
    if (ownerEmail) emails.push(ownerEmail);
    if (s.teamLeadEmail) emails.push(s.teamLeadEmail);
  }
  if (event === 'assign' && s.rules.onAssign && ownerEmail) {
    emails.push(ownerEmail);
  }
  if (event === 'escalation' && s.rules.onEscalation) {
    if (s.teamLeadEmail) emails.push(s.teamLeadEmail);
    if (s.engineeringEmail) emails.push(s.engineeringEmail);
  }
  if (event === 'resolve' && s.rules.onResolve && ownerEmail) {
    emails.push(ownerEmail);
  }
  // Unique
  return [...new Set(emails)];
}

/** Called after create / update to optionally trigger notifications */
function maybeAutoNotify(ticket, isNew) {
  if (!notifySettings.enabled) return;

  if (isNew) {
    if (ticket.priority === 'P1 Critical' && notifySettings.rules.onP1) {
      const to = getRecipientsFor(ticket, 'p1');
      if (to.length) {
        // Delay slightly so UI updates first
        setTimeout(() => {
          if (confirm(`P1 Critical ticket created.\nOpen email notification to:\n${to.join(', ')}?`)) {
            sendEmailNotification(ticket, 'P1 Critical – Immediate attention required', to);
          }
        }, 300);
      }
    } else if (ticket.priority === 'P2 High' && notifySettings.rules.onP2) {
      const to = getRecipientsFor(ticket, 'p2');
      if (to.length) {
        setTimeout(() => {
          if (confirm(`P2 High ticket created.\nNotify:\n${to.join(', ')}?`)) {
            sendEmailNotification(ticket, 'P2 High – New ticket assigned', to);
          }
        }, 300);
      }
    } else if (ticket.owner && notifySettings.rules.onAssign) {
      const to = getRecipientsFor(ticket, 'assign');
      if (to.length) {
        // Soft prompt only for non-critical
        setTimeout(() => {
          if (confirm(`Notify assigned owner (${ticket.owner}) by email?`)) {
            sendEmailNotification(ticket, 'New ticket assigned to you', to);
          }
        }, 300);
      }
    }
  } else {
    // On update: escalation filled
    if (ticket.escalation && notifySettings.rules.onEscalation) {
      const to = getRecipientsFor(ticket, 'escalation');
      if (to.length) {
        setTimeout(() => {
          if (confirm(`Escalation recorded.\nNotify Team Lead / Engineering?\n${to.join(', ')}`)) {
            sendEmailNotification(ticket, 'Escalation – assistance required', to, ticket.escalation);
          }
        }, 300);
      }
    }
  }
}

function openModal(title, bodyHtml, footerHtml) {
  document.getElementById('modalTitle').textContent = title;
  document.getElementById('modalBody').innerHTML = bodyHtml;
  document.getElementById('modalFooter').innerHTML = footerHtml || '';
  document.getElementById('modalBackdrop').classList.add('open');
}

function closeModal() {
  document.getElementById('modalBackdrop').classList.remove('open');
}

// ── Clock ────────────────────────────────────────────────────────────
function updateClock() {
  const el = document.getElementById('liveClock');
  if (el) {
    el.textContent = new Date().toLocaleString('en-GB', {
      weekday: 'short', day: 'numeric', month: 'short',
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
  }
}
setInterval(updateClock, 1000);
updateClock();

// ── Navigation ───────────────────────────────────────────────────────
document.querySelectorAll('.nav-item').forEach(btn => {
  btn.addEventListener('click', () => {
    const view = btn.dataset.view;
    if (window.CredlockAuth && CredlockAuth.can) {
      const perm = view === 'admin' ? 'admin' : view;
      if (!CredlockAuth.can(perm)) {
        if (typeof toastError === 'function') toastError('Access denied', 'Permission');
        else if (typeof toast === 'function') toast('Access denied', 'error');
        return;
      }
    }
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentView = view;
    render();
    document.getElementById('sidebar')?.classList.remove('open');
  });
});

document.getElementById('menuToggle').addEventListener('click', () => {
  document.getElementById('sidebar').classList.toggle('open');
});

document.getElementById('quickNewBtn').addEventListener('click', () => {
  currentView = 'new-ticket';
  document.querySelectorAll('.nav-item').forEach(b => {
    b.classList.toggle('active', b.dataset.view === 'new-ticket');
  });
  render();
});

document.getElementById('modalClose').addEventListener('click', closeModal);
document.getElementById('modalBackdrop').addEventListener('click', e => {
  if (e.target.id === 'modalBackdrop') closeModal();
});

document.getElementById('exportBtn').addEventListener('click', exportData);

// ── Render router ────────────────────────────────────────────────────
function navigate(view) {
  if (window.CredlockAuth && !CredlockAuth.currentUser()) {
    CredlockAuth.showAuth(true);
    return;
  }
  if (window.CredlockAuth && CredlockAuth.can) {
    const perm = view === 'admin' ? 'admin' : view;
    if (!CredlockAuth.can(perm)) {
      if (typeof toastError === 'function') toastError('You do not have permission for this section', 'Access denied');
      else if (typeof toast === 'function') toast('Access denied', 'error');
      return;
    }
  }
  currentView = view;
  document.querySelectorAll('.nav-item').forEach(b => {
    b.classList.toggle('active', b.dataset.view === view);
  });
  render();
  document.getElementById('sidebar')?.classList.remove('open');
}

function render() {

  const titles = {
    dashboard: 'Dashboard',
    tickets: 'Ticket Log',
    'new-ticket': 'New Ticket',
    rota: 'Coverage Rota',
    daily: 'Daily Report',
    weekly: 'Weekly Report',
    monthly: 'Monthly Report',
    team: 'Team',
    templates: 'Communication Templates',
    notifications: 'Email Notifications',
    settings: 'Settings & Backend',
    approvals: 'User Approvals',
    'lead-dash': 'Team Lead Dashboard',
    admin: 'Admin Panel',
    'my-work': 'My Work',
    kavro: 'Kavro Device Issues'
  };
  document.getElementById('pageTitle').textContent = titles[currentView] || 'Portal';
  const content = document.getElementById('content');

  switch (currentView) {
    case 'dashboard': content.innerHTML = renderDashboard(); break;
    case 'analytics': content.innerHTML = renderAnalytics(); break;
    case 'ai-insights': content.innerHTML = renderAIInsights(); break;
    case 'tickets': content.innerHTML = renderTickets(); bindTicketFilters(); break;
    case 'new-ticket': content.innerHTML = renderNewTicket(); bindNewTicketForm(); break;
    case 'rota': content.innerHTML = renderRota(); bindRota(); break;
    case 'daily': content.innerHTML = renderDaily(); bindDaily(); break;
    case 'weekly': content.innerHTML = renderWeekly(); bindWeekly(); break;
    case 'monthly': content.innerHTML = renderMonthly(); bindMonthly(); break;
    case 'team': content.innerHTML = renderTeam(); break;
    case 'templates': content.innerHTML = renderTemplates(); break;
    case 'notifications': content.innerHTML = renderNotifications(); bindNotifications(); break;
    case 'settings': content.innerHTML = renderSettings(); bindSettings(); break;
    case 'admin': content.innerHTML = renderAdmin(); bindAdmin(); break;
    case 'officer-reports': content.innerHTML = renderOfficerReports(); bindOfficerReports(); break;
    case 'kavro': content.innerHTML = renderKavro(); bindKavro(); break;
    case 'approvals': content.innerHTML = renderApprovals(); bindApprovals(); break;
    case 'lead-dash': content.innerHTML = renderLeadDashboard(); break;
    case 'my-work': content.innerHTML = renderMyWork(); break;
    default: content.innerHTML = '<p>View not found</p>';
  }
  updateNavBadge();
}

// ── Dashboard ────────────────────────────────────────────────────────

// ── Performance analytics & charts ───────────────────────────────────
function computeOfficerStats(name) {
  const a = activityForUser(name);
  const withResp = a.mine.filter(t => t.firstResponse);
  const ok = withResp.filter(t => responseOk(t) === true).length;
  const compliance = withResp.length ? Math.round((ok / withResp.length) * 100) : null;
  const resolutionRate = a.mine.length ? Math.round((a.resolved.length / a.mine.length) * 100) : 0;
  const overdue = a.open.filter(isOverdue).length;
  // Score 0–100: weight resolution, compliance, low overdue
  let score = resolutionRate * 0.45;
  if (compliance != null) score += compliance * 0.4;
  else score += 20;
  score += Math.max(0, 15 - overdue * 3);
  score = Math.round(Math.min(100, Math.max(0, score)));
  return {
    name,
    total: a.mine.length,
    open: a.open.length,
    resolved: a.resolved.length,
    p1: a.p1.length,
    overdue,
    compliance,
    resolutionRate,
    score
  };
}


// ── AI insight & SWOT (rule-based analysis of officer activity) ───────
function generateOfficerAIInsight(name) {
  const s = computeOfficerStats(name);
  const a = activityForUser(name);
  const insights = [];
  if (s.score >= 80) insights.push('Strong overall performance with balanced resolution and responsiveness.');
  else if (s.score >= 60) insights.push('Solid baseline performance; focused coaching can push score into the top band.');
  else insights.push('Performance needs attention — prioritise overdue clearance and first-response discipline.');

  if (s.overdue > 2) insights.push(s.overdue + ' overdue tickets are dragging response quality; clear oldest items first.');
  if (s.p1 > 0) insights.push(s.p1 + ' open P1 ticket(s) require immediate ownership and Team Lead visibility.');
  if (s.compliance != null && s.compliance < 70) insights.push('Response-time compliance at ' + s.compliance + '% is below target; protect opening/closing coverage slots.');
  if (s.compliance != null && s.compliance >= 90) insights.push('Excellent response-time compliance (' + s.compliance + '%).');
  if (s.resolutionRate >= 70) insights.push('Healthy resolution rate (' + s.resolutionRate + '%) indicates good ticket closure hygiene.');
  else if (s.total > 0) insights.push('Resolution rate (' + s.resolutionRate + '%) suggests tickets may be lingering — review Pending and escalations.');
  if (s.open > 8) insights.push('High open load (' + s.open + '). Consider rebalancing with Team Lead.');
  if (s.total === 0) insights.push('No tickets attributed yet — ensure owner field is set on intake.');

  const actions = [];
  if (s.overdue) actions.push('Clear overdue queue before taking new non-P1 work.');
  if (s.p1) actions.push('Update every P1 with next action and timestamp today.');
  if (s.compliance != null && s.compliance < 80) actions.push('Acknowledge new tickets within priority targets (P1:5m, P2:10m).');
  if (s.open > s.resolved && s.total > 5) actions.push('Block 30 minutes for resolution push on oldest open items.');
  if (!actions.length) actions.push('Maintain current rhythm; document known fixes for recurring categories.');

  return { stats: s, insights, actions, summary: insights[0] };
}

function generateOfficerSWOT(name) {
  const s = computeOfficerStats(name);
  const a = activityForUser(name);
  const cats = {};
  a.mine.forEach(t => { const c = t.category || 'Other'; cats[c] = (cats[c] || 0) + 1; });
  const topCat = Object.keys(cats).sort((x, y) => cats[y] - cats[x])[0] || '—';

  const strengths = [];
  const weaknesses = [];
  const opportunities = [];
  const threats = [];

  if (s.compliance != null && s.compliance >= 85) strengths.push('High first-response compliance (' + s.compliance + '%)');
  if (s.resolutionRate >= 65) strengths.push('Strong ticket closure rate (' + s.resolutionRate + '%)');
  if (s.score >= 75) strengths.push('Overall performance score in top band (' + s.score + ')');
  if (s.p1 === 0 && s.open > 0) strengths.push('No open P1 backlog under this owner');
  if (topCat !== '—') strengths.push('Domain volume concentrated in ' + topCat);

  if (s.overdue > 0) weaknesses.push(s.overdue + ' overdue ticket(s)');
  if (s.compliance != null && s.compliance < 75) weaknesses.push('Response compliance below 75%');
  if (s.resolutionRate < 50 && s.total >= 4) weaknesses.push('Low resolution rate relative to volume');
  if (s.open > 10) weaknesses.push('Elevated open workload may slow quality updates');
  if (!strengths.length) strengths.push('Baseline activity logged for coaching baseline');
  if (!weaknesses.length) weaknesses.push('No critical weakness flags from current metrics');

  opportunities.push('Pair with peer review on ' + topCat + ' for known-fix documentation');
  opportunities.push('Use Officer Reports export for weekly 1:1 with Team Lead');
  if (s.score < 80) opportunities.push('Target +10 score points via overdue burn-down this week');
  opportunities.push('Cross-train on Kavro lock/unlock flows to absorb device peaks');

  if (s.p1 > 0) threats.push('Open P1 exposure can escalate to merchant/partner impact');
  if (s.overdue > 2) threats.push('Growing overdue queue risks SLA breaches and customer trust');
  threats.push('Unregistered chat requests outside tickets remain invisible to analytics');
  if (s.open > 12) threats.push('Capacity risk if intake spikes without reassignment');

  return { strengths, weaknesses, opportunities, threats, topCategory: topCat, stats: s };
}

function renderOfficerInsightCard(name) {
  const ai = generateOfficerAIInsight(name);
  const sw = generateOfficerSWOT(name);
  const s = ai.stats;
  return `
    <div class="card" style="margin-bottom:16px">
      <div class="card-header">
        <span class="card-title">${esc(name)} · AI insight & SWOT</span>
        <span class="perf-score ${scoreClass(s.score)}">${s.score}</span>
      </div>
      <div class="card-body">
        <div class="ai-insight-box">
          <div class="ai-label">AI insight</div>
          <ul class="ai-list">${ai.insights.map(i => '<li>' + esc(i) + '</li>').join('')}</ul>
          <div class="ai-label" style="margin-top:10px">Recommended actions</div>
          <ul class="ai-list">${ai.actions.map(i => '<li>' + esc(i) + '</li>').join('')}</ul>
        </div>
        <div class="swot-grid">
          <div class="swot-cell swot-s"><h4>Strengths</h4><ul>${sw.strengths.map(x => '<li>' + esc(x) + '</li>').join('')}</ul></div>
          <div class="swot-cell swot-w"><h4>Weaknesses</h4><ul>${sw.weaknesses.map(x => '<li>' + esc(x) + '</li>').join('')}</ul></div>
          <div class="swot-cell swot-o"><h4>Opportunities</h4><ul>${sw.opportunities.map(x => '<li>' + esc(x) + '</li>').join('')}</ul></div>
          <div class="swot-cell swot-t"><h4>Threats</h4><ul>${sw.threats.map(x => '<li>' + esc(x) + '</li>').join('')}</ul></div>
        </div>
      </div>
    </div>`;
}

function renderAIInsights() {
  const officers = (typeof OFFICERS !== 'undefined' ? OFFICERS : ['Tosin', 'Peter', 'Zainab', 'Joseph Olayemi']);
  const u = window.CredlockAuth && CredlockAuth.currentUser();
  const canAll = window.CredlockAuth && CredlockAuth.can && (CredlockAuth.can('admin') || CredlockAuth.isLead() || CredlockAuth.can('analytics'));
  const names = canAll ? officers : (u ? [u.name] : officers);
  return `
    <div class="analytics-hero">
      <h2>AI insights & SWOT</h2>
      <p>Rule-based analysis of workload, compliance, resolution and risk for each officer — not a generative AI call; grounded in ticket metrics.</p>
    </div>
    ${names.map(renderOfficerInsightCard).join('')}
  `;
}


function scoreClass(score) {
  if (score >= 75) return 'high';
  if (score >= 50) return 'mid';
  return 'low';
}

function barChartHtml(items, opts) {
  opts = opts || {};
  const max = Math.max(1, ...items.map(i => i.value));
  return items.map(i => {
    const pct = Math.round((i.value / max) * 100);
    const cls = i.cls || opts.fillClass || '';
    return `<div class="chart-bar-row">
      <div class="chart-bar-label" title="${esc(i.label)}">${esc(i.label)}</div>
      <div class="chart-bar-track"><div class="chart-bar-fill ${cls}" style="width:${pct}%"></div></div>
      <div class="chart-bar-val">${i.value}${opts.suffix || ''}</div>
    </div>`;
  }).join('');
}

function donutHtml(segments, centerLabel, centerSub) {
  // segments: [{value, color, label}]
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  let acc = 0;
  const parts = segments.map(seg => {
    const start = (acc / total) * 360;
    acc += seg.value;
    const end = (acc / total) * 360;
    return `${seg.color} ${start}deg ${end}deg`;
  }).join(', ');
  const bg = total === 0 || segments.every(s => !s.value)
    ? '#EEF2FF'
    : `conic-gradient(${parts})`;
  return `<div class="chart-donut-wrap">
    <div class="chart-donut" style="background:${bg}">
      <div class="chart-donut-hole">${esc(String(centerLabel))}<small>${esc(centerSub || '')}</small></div>
    </div>
    <div class="chart-legend">
      ${segments.map(s => `
        <div class="chart-legend-item">
          <span class="chart-legend-swatch" style="background:${s.color}"></span>
          ${esc(s.label)} · <strong>${s.value}</strong>
        </div>`).join('')}
    </div>
  </div>`;
}

function last7DaysVolume() {
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const count = tickets.filter(t => t.date === key).length;
    days.push({ label: key.slice(5), value: count });
  }
  return days;
}

function sparklineHtml(values) {
  const max = Math.max(1, ...values);
  return `<div class="sparkline">${values.map(v => {
    const h = Math.max(8, Math.round((v / max) * 100));
    return `<span style="height:${h}%"></span>`;
  }).join('')}</div>`;
}

function renderAnalytics() {
  const officers = (typeof OFFICERS !== 'undefined' ? OFFICERS : ['Tosin', 'Peter', 'Zainab', 'Joseph Olayemi']);
  const stats = officers.map(computeOfficerStats);
  const open = tickets.filter(t => t.status !== 'Resolved' && t.status !== 'Closed');
  const byPrio = PRIORITIES.map((p, i) => ({
    label: p.replace(' Critical', '').replace(' High', '').replace(' Normal', '').replace(' Low', ''),
    value: open.filter(t => t.priority === p).length,
    cls: 'p' + (i + 1),
    color: ['#DC2626', '#D97706', '#CA8A04', '#16A34A'][i]
  }));
  const volume = last7DaysVolume();
  const statusSegs = [
    { label: 'New', value: open.filter(t => t.status === 'New').length, color: '#3B5BDB' },
    { label: 'Assigned', value: open.filter(t => t.status === 'Assigned').length, color: '#6366F1' },
    { label: 'In Progress', value: open.filter(t => t.status === 'In Progress').length, color: '#0EA5E9' },
    { label: 'Pending', value: open.filter(t => t.status === 'Pending').length, color: '#D97706' }
  ];
  const resolved = tickets.filter(t => t.status === 'Resolved' || t.status === 'Closed').length;

  return `
    <div class="analytics-hero">
      <h2>Officer performance analytics</h2>
      <p>Workload, resolution rate, response compliance, and 7-day intake trends ·
        <a href="#" style="color:#fff;text-decoration:underline" onclick="navigate('ai-insights');return false">AI insights & SWOT →</a></p>
    </div>

    <div class="grid grid-4" style="margin-bottom:18px">
      <div class="kpi"><div class="kpi-label">Open tickets</div><div class="kpi-value">${open.length}</div></div>
      <div class="kpi success"><div class="kpi-label">Resolved (all time)</div><div class="kpi-value">${resolved}</div></div>
      <div class="kpi"><div class="kpi-label">Team avg score</div><div class="kpi-value">${stats.length ? Math.round(stats.reduce((s, x) => s + x.score, 0) / stats.length) : 0}</div></div>
      <div class="kpi"><div class="kpi-label">7-day intake</div><div class="kpi-value">${volume.reduce((s, d) => s + d.value, 0)}</div>
        <div class="kpi-sub">${sparklineHtml(volume.map(d => d.value))}</div>
      </div>
    </div>

    <div class="grid grid-2" style="margin-bottom:18px">
      <div class="card">
        <div class="card-header"><span class="card-title">Officer workload (open)</span></div>
        <div class="card-body">
          ${barChartHtml(stats.map(s => ({ label: s.name, value: s.open })))}
        </div>
      </div>
      <div class="card">
        <div class="card-header"><span class="card-title">Priority mix (open)</span></div>
        <div class="card-body">
          ${barChartHtml(byPrio.map(p => ({ label: p.label, value: p.value, cls: p.cls })))}
        </div>
      </div>
    </div>

    <div class="grid grid-2" style="margin-bottom:18px">
      <div class="card">
        <div class="card-header"><span class="card-title">Open status mix</span></div>
        <div class="card-body">
          ${donutHtml(statusSegs, open.length, 'open')}
        </div>
      </div>
      <div class="card">
        <div class="card-header"><span class="card-title">7-day ticket intake</span></div>
        <div class="card-body">
          ${barChartHtml(volume.map(d => ({ label: d.label, value: d.value })), { fillClass: 'green' })}
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-header"><span class="card-title">Officer performance scorecard</span></div>
      <div class="card-body table-wrap">
        <table>
          <thead>
            <tr>
              <th>Officer</th><th>Score</th><th>Total</th><th>Open</th><th>Resolved</th>
              <th>Res. rate</th><th>Compliance</th><th>P1 open</th><th>Overdue</th>
            </tr>
          </thead>
          <tbody>
            ${stats.map(s => `
              <tr>
                <td><strong>${esc(s.name)}</strong></td>
                <td><span class="perf-score ${scoreClass(s.score)}">${s.score}</span></td>
                <td>${s.total}</td>
                <td>${s.open}</td>
                <td>${s.resolved}</td>
                <td>${s.resolutionRate}%</td>
                <td>${s.compliance == null ? '—' : s.compliance + '%'}</td>
                <td>${s.p1}</td>
                <td>${s.overdue ? `<span style="color:#DC2626;font-weight:700">${s.overdue}</span>` : '0'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}


function renderDashboard() {
  const open = tickets.filter(t => t.status !== 'Resolved');
  const overdue = open.filter(isOverdue);
  const unassigned = open.filter(t => !t.owner);
  const pending = open.filter(t => t.status === 'Pending');
  const today = todayStr();
  const todayTickets = tickets.filter(t => t.date === today);
  const resolvedToday = tickets.filter(t => t.resolvedAt && t.resolvedAt.startsWith(today));
  const withResponse = todayTickets.filter(t => t.firstResponse);
  const okCount = withResponse.filter(t => responseOk(t) === true).length;
  const compliance = withResponse.length ? Math.round((okCount / withResponse.length) * 100) : 0;

  const byOwner = {};
  OFFICERS.forEach(o => {
    byOwner[o] = open.filter(t => t.owner === o).length;
  });

  const byPrio = {};
  PRIORITIES.forEach(p => {
    byPrio[p] = open.filter(t => t.priority === p).length;
  });

  return `
    <div class="principle">
      <strong>Operating principle:</strong> No actionable request should depend on someone remembering a chat.
      Register it → Assign one owner → Record the next action → Follow until resolved or handed over.
    </div>

    <div class="grid grid-4" style="margin-bottom:18px">
      <div class="kpi">
        <div class="kpi-label">Open Tickets</div>
        <div class="kpi-value">${open.length}</div>
        <div class="kpi-sub">${tickets.length} total logged</div>
      </div>
      <div class="kpi ${overdue.length ? 'danger' : ''}">
        <div class="kpi-label">Overdue</div>
        <div class="kpi-value">${overdue.length}</div>
        <div class="kpi-sub">Need immediate attention</div>
      </div>
      <div class="kpi ${unassigned.length ? 'warn' : 'success'}">
        <div class="kpi-label">Unassigned</div>
        <div class="kpi-value">${unassigned.length}</div>
        <div class="kpi-sub">Must have an owner</div>
      </div>
      <div class="kpi">
        <div class="kpi-label">Today's Compliance</div>
        <div class="kpi-value">${compliance}%</div>
        <div class="kpi-sub">${okCount}/${withResponse.length} within target</div>
      </div>
    </div>

    <div class="grid grid-2" style="margin-bottom:18px">
      <div class="card">
        <div class="card-header"><span class="card-title">Officer workload (open)</span>
          <button class="btn btn-sm btn-ghost" onclick="navigate('analytics')">Full analytics</button>
        </div>
        <div class="card-body">
          ${barChartHtml(OFFICERS.map(o => ({ label: o, value: byOwner[o] || 0 })))}
        </div>
      </div>
      <div class="card">
        <div class="card-header"><span class="card-title">Priority mix (open)</span></div>
        <div class="card-body">
          ${barChartHtml(PRIORITIES.map((p, i) => ({
            label: p.split(' ')[0],
            value: byPrio[p] || 0,
            cls: 'p' + (i + 1)
          })))}
        </div>
      </div>
    </div>

    <div class="grid grid-2" style="margin-bottom:18px">
      <div class="card">
        <div class="card-header"><span class="card-title">7-day intake</span></div>
        <div class="card-body">
          ${barChartHtml(last7DaysVolume().map(d => ({ label: d.label, value: d.value })), { fillClass: 'green' })}
        </div>
      </div>
      <div class="card">
        <div class="card-header"><span class="card-title">Officer scores</span></div>
        <div class="card-body table-wrap">
          <table>
            <thead><tr><th>Officer</th><th>Score</th><th>Open</th><th>Resolved</th><th>Compliance</th></tr></thead>
            <tbody>
              ${OFFICERS.map(o => {
                const s = computeOfficerStats(o);
                return `<tr>
                  <td><strong>${esc(o)}</strong></td>
                  <td><span class="perf-score ${scoreClass(s.score)}">${s.score}</span></td>
                  <td>${s.open}</td>
                  <td>${s.resolved}</td>
                  <td>${s.compliance == null ? '—' : s.compliance + '%'}</td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <span class="card-title">Recent / Open Tickets</span>
        <button class="btn btn-sm btn-primary" onclick="document.querySelector('[data-view=tickets]').click()">View all</button>
      </div>
      <div class="card-body table-wrap">
        ${ticketTable(open.slice(0, 8).concat(tickets.filter(t => t.status === 'Resolved').slice(-3)).slice(0, 10))}
      </div>
    </div>
  `;
}

// ── Tickets list ─────────────────────────────────────────────────────
function renderTickets() {
  const _allTickets = tickets;
  // Officers see own queue; lead sees all
  const ticketsView = (typeof ticketsForCurrentUser === 'function') ? ticketsForCurrentUser(tickets) : tickets;

  return `
    <div class="filters" id="ticketFilters">
      <div class="search-box">
        <input type="search" id="searchInput" placeholder="Search tickets..." />
      </div>
      <select id="filterStatus">
        <option value="">All statuses</option>
        ${STATUSES.map(s => `<option value="${s}">${s}</option>`).join('')}
      </select>
      <select id="filterOwner">
        <option value="">All owners</option>
        ${OFFICERS.map(o => `<option value="${o}">${o}</option>`).join('')}
      </select>
      <select id="filterPriority">
        <option value="">All priorities</option>
        ${PRIORITIES.map(p => `<option value="${p}">${p}</option>`).join('')}
      </select>
    </div>
    <div class="card">
      <div class="card-body table-wrap" id="ticketTableBody">
        ${ticketTable(tickets)}
      </div>
    </div>
  `;
}

function ticketTable(list) {
  if (!list.length) {
    return `<div class="empty"><div class="empty-icon">☰</div>No tickets found</div>`;
  }
  // Sort: open first, then by date desc
  const sorted = [...list].sort((a, b) => {
    if (a.status === 'Resolved' && b.status !== 'Resolved') return 1;
    if (b.status === 'Resolved' && a.status !== 'Resolved') return -1;
    return (b.date + b.timeIn).localeCompare(a.date + a.timeIn);
  });

  return `
    <table>
      <thead>
        <tr>
          <th>Ticket ID</th>
          <th>Date</th>
          <th>Requester</th>
          <th>Category</th>
          <th>Priority</th>
          <th>Owner</th>
          <th>Status</th>
          <th>Response</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        ${sorted.map(t => {
          const ok = responseOk(t);
          const overdue = isOverdue(t);
          return `
            <tr>
              <td><strong>${t.id}</strong>${overdue ? ' <span class="badge badge-overdue">OVERDUE</span>' : ''}</td>
              <td>${t.date}<br><small style="color:var(--muted)">${t.timeIn || ''}</small></td>
              <td>${esc(t.requester)}<br><small style="color:var(--muted)">${t.type || ''}</small></td>
              <td>${esc(t.category)}</td>
              <td>${priorityBadge(t.priority)}</td>
              <td>${esc(t.owner) || '—'}</td>
              <td>${statusBadge(t.status)}</td>
              <td>${ok === true ? '<span class="badge badge-yes">YES</span>' : ok === false ? '<span class="badge badge-no">NO</span>' : '—'}</td>
              <td>
                <button class="btn btn-sm btn-ghost" onclick="viewTicket('${t.id}')">View</button>
              </td>
            </tr>
          `;
        }).join('')}
      </tbody>
    </table>
  `;
}

function bindTicketFilters() {
  const apply = () => {
    const q = (document.getElementById('searchInput')?.value || '').toLowerCase();
    const st = document.getElementById('filterStatus')?.value || '';
    const ow = document.getElementById('filterOwner')?.value || '';
    const pr = document.getElementById('filterPriority')?.value || '';

    let list = tickets.filter(t => {
      if (st && t.status !== st) return false;
      if (ow && t.owner !== ow) return false;
      if (pr && t.priority !== pr) return false;
      if (q) {
        const hay = [t.id, t.requester, t.description, t.category, t.owner].join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    document.getElementById('ticketTableBody').innerHTML = ticketTable(list);
  };

  ['searchInput', 'filterStatus', 'filterOwner', 'filterPriority'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', apply);
    if (el) el.addEventListener('change', apply);
  });
}

function viewTicket(id) {
  const t = tickets.find(x => x.id === id);
  if (!t) return;

  const ok = responseOk(t);
  openModal(t.id, `
    <div style="display:grid;gap:10px;font-size:13px">
      <div><strong>Requester:</strong> ${esc(t.requester)} (${esc(t.type)})</div>
      <div><strong>Channel:</strong> ${esc(t.channel)} · <strong>Category:</strong> ${esc(t.category)}</div>
      <div><strong>Priority:</strong> ${priorityBadge(t.priority)} · <strong>Status:</strong> ${statusBadge(t.status)}</div>
      <div><strong>Owner:</strong> ${esc(t.owner) || '—'} · <strong>Assigned:</strong> ${t.assignedAt || '—'}</div>
      <div><strong>Received:</strong> ${t.date} ${t.timeIn || ''} · <strong>1st response:</strong> ${t.firstResponse || '—'}
        ${ok === true ? ' <span class="badge badge-yes">Within target</span>' : ok === false ? ' <span class="badge badge-no">Breached</span>' : ''}
      </div>
      <div><strong>Impact:</strong> ${esc(t.impact) || '—'}</div>
      <div><strong>Description:</strong><br>${esc(t.description)}</div>
      <div><strong>Next action:</strong> ${esc(t.nextAction) || '—'}</div>
      <div><strong>Escalation / Dependency:</strong> ${esc(t.escalation) || '—'}</div>
      <div><strong>Resolution notes:</strong> ${esc(t.resolutionNotes) || '—'}</div>
      ${t.resolvedAt ? `<div><strong>Resolved at:</strong> ${t.resolvedAt}</div>` : ''}
    </div>
  `, `
    <button class="btn btn-ghost" onclick="closeModal()">Close</button>
    <button class="btn btn-ghost" onclick="notifyTicket('${t.id}')">✉ Email notify</button>
    <button class="btn btn-primary" onclick="editTicket('${t.id}')">Edit</button>
    ${t.status !== 'Resolved' ? `<button class="btn btn-success" onclick="quickResolve('${t.id}')">Mark Resolved</button>` : ''}
  `);
}

function notifyTicket(id) {
  const t = tickets.find(x => x.id === id);
  if (!t) return;
  closeModal();

  const ownerEmail = notifySettings.officerEmails[t.owner] || '';
  const options = [
    { label: 'Owner only', to: ownerEmail },
    { label: 'Team Lead', to: notifySettings.teamLeadEmail },
    { label: 'Owner + Team Lead', to: [ownerEmail, notifySettings.teamLeadEmail].filter(Boolean).join(',') },
    { label: 'Engineering', to: notifySettings.engineeringEmail },
    { label: 'Escalation package (Lead + Engineering)', to: [notifySettings.teamLeadEmail, notifySettings.engineeringEmail].filter(Boolean).join(',') }
  ].filter(o => o.to);

  openModal('Email notification – ' + t.id, `
    <p style="margin-bottom:12px;font-size:13px;color:var(--muted)">Opens your email client with a pre-filled message. Recipients come from Notification settings.</p>
    <div class="form-group" style="margin-bottom:12px">
      <label>Purpose / subject line</label>
      <select id="notifyPurpose" style="width:100%;padding:9px 12px;border:1px solid var(--border);border-radius:8px">
        <option value="Update on ticket">Update on ticket</option>
        <option value="P1 Critical – Immediate attention">P1 Critical – Immediate attention</option>
        <option value="P2 High – Action required">P2 High – Action required</option>
        <option value="Escalation – assistance required">Escalation – assistance required</option>
        <option value="Ticket assigned to you">Ticket assigned to you</option>
        <option value="Ticket resolved">Ticket resolved</option>
        <option value="Overdue reminder">Overdue reminder</option>
      </select>
    </div>
    <div class="form-group" style="margin-bottom:12px">
      <label>Send to</label>
      <select id="notifyTo" style="width:100%;padding:9px 12px;border:1px solid var(--border);border-radius:8px">
        ${options.map(o => `<option value="${esc(o.to)}">${esc(o.label)} (${esc(o.to)})</option>`).join('')}
        <option value="custom">Custom address…</option>
      </select>
    </div>
    <div class="form-group" id="customEmailWrap" style="display:none;margin-bottom:12px">
      <label>Custom email(s)</label>
      <input type="text" id="customEmail" placeholder="name@company.com, other@company.com" style="width:100%;padding:9px 12px;border:1px solid var(--border);border-radius:8px" />
    </div>
    <div class="form-group">
      <label>Extra note (optional)</label>
      <textarea id="notifyNote" rows="2" style="width:100%;padding:9px 12px;border:1px solid var(--border);border-radius:8px" placeholder="Any extra context for the recipient"></textarea>
    </div>
  `, `
    <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
    <button class="btn btn-primary" onclick="confirmNotify('${t.id}')">Open email draft</button>
  `);

  setTimeout(() => {
    document.getElementById('notifyTo')?.addEventListener('change', e => {
      document.getElementById('customEmailWrap').style.display = e.target.value === 'custom' ? 'block' : 'none';
    });
  }, 50);
}

function confirmNotify(id) {
  const t = tickets.find(x => x.id === id);
  if (!t) return;
  const purpose = document.getElementById('notifyPurpose')?.value || 'Update';
  let to = document.getElementById('notifyTo')?.value || '';
  if (to === 'custom') to = document.getElementById('customEmail')?.value || '';
  const note = document.getElementById('notifyNote')?.value || '';
  closeModal();
  if (!to) { toast('No recipient'); return; }
  sendEmailNotification(t, purpose, to, note);
}

function editTicket(id) {
  editId = id;
  closeModal();
  currentView = 'new-ticket';
  document.querySelectorAll('.nav-item').forEach(b => {
    b.classList.toggle('active', b.dataset.view === 'new-ticket');
  });
  render();
}

function quickResolve(id) {
  const t = tickets.find(x => x.id === id);
  if (!t) return;
  t.status = 'Resolved';
  t.resolvedAt = new Date().toISOString().slice(0, 16);
  t.nextAction = 'Closed';
  if (!t.resolutionNotes) t.resolutionNotes = 'Resolved';
  saveTickets();
  closeModal();
  toastSuccess('Ticket marked Resolved');
  render();
}

// ── New / Edit Ticket ────────────────────────────────────────────────
function renderNewTicket() {
  const t = editId ? tickets.find(x => x.id === editId) : null;
  const isEdit = !!t;

  return `
    <div class="card" style="max-width:560px">
      <div class="card-header">
        <span class="card-title">${isEdit ? 'Edit Ticket ' + t.id : 'New ticket (quick form)'}</span>
      </div>
      <div class="card-body">
        <p style="font-size:12px;color:var(--muted);margin-bottom:14px">
          Only the essentials. Extra fields stay optional. Device issues can link an IMEI to Kavro records.
        </p>
        <form class="form-grid" id="ticketForm">
          <div class="form-group">
            <label>Date *</label>
            <input type="date" name="date" required value="${t?.date || todayStr()}" />
          </div>
          <div class="form-group">
            <label>Time *</label>
            <input type="time" name="timeIn" required value="${t?.timeIn || new Date().toTimeString().slice(0, 5)}" />
          </div>
          <div class="form-group full">
            <label>Requester *</label>
            <input type="text" name="requester" required value="${esc(t?.requester || '')}" placeholder="Name or merchant" />
          </div>
          <div class="form-group">
            <label>Type</label>
            <select name="type">
              ${TYPES.map(x => `<option value="${x}" ${t?.type === x ? 'selected' : ''}>${x}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label>Category *</label>
            <select name="category" required>
              ${CATEGORIES.map(x => `<option value="${x}" ${t?.category === x ? 'selected' : ''}>${x}</option>`).join('')}
            </select>
          </div>
          <div class="form-group full">
            <label>What is the issue? *</label>
            <textarea name="description" required rows="3" placeholder="Short description">${esc(t?.description || '')}</textarea>
          </div>
          <div class="form-group">
            <label>Priority *</label>
            <select name="priority" required>
              ${PRIORITIES.map(x => `<option value="${x}" ${t?.priority === x ? 'selected' : ''}>${x}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label>Owner *</label>
            <select name="owner" required>
              <option value="">— Select —</option>
              ${OFFICERS.map(x => `<option value="${x}" ${t?.owner === x ? 'selected' : ''}>${x}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label>Status *</label>
            <select name="status" required>
              ${STATUSES.map(x => `<option value="${x}" ${t?.status === x ? 'selected' : ''}>${x}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label>IMEI (optional – for Kavro)</label>
            <input type="text" name="imei" value="${esc(t?.imei || '')}" placeholder="Link to device record" />
          </div>
          <div class="form-group full">
            <label>Next action *</label>
            <input type="text" name="nextAction" required value="${esc(t?.nextAction || '')}" placeholder="What happens next?" />
          </div>
          <div class="form-actions">
            <button type="submit" class="btn btn-primary">${isEdit ? 'Save' : 'Create ticket'}</button>
            ${isEdit ? `<button type="button" class="btn btn-ghost" id="cancelEdit">Cancel</button>` : ''}
          </div>
        </form>
      </div>
    </div>
  `;
}

function bindNewTicketForm() {
  const form = document.getElementById('ticketForm');
  if (!form) return;

  form.addEventListener('submit', e => {
    e.preventDefault();
    const fd = new FormData(form);
    const data = Object.fromEntries(fd.entries());
    if (!data.channel) data.channel = 'Phone 1 External';
    if (!data.impact) data.impact = '';
    if (!data.assignedAt) data.assignedAt = data.timeIn || '';
    if (!data.firstResponse) data.firstResponse = '';
    if (!data.escalation) data.escalation = '';
    if (!data.resolutionNotes) data.resolutionNotes = '';

    if (editId) {
      const t = tickets.find(x => x.id === editId);
      Object.assign(t, data);
      t.lastUpdate = new Date().toISOString().slice(0, 16);
      if (data.status === 'Resolved' && !t.resolvedAt) {
        t.resolvedAt = new Date().toISOString().slice(0, 16);
      }
      toastSuccess('Ticket updated');
      saveTickets();
      maybeAutoNotify(t, false);
      editId = null;
    } else {
      const seq = nextSeq(data.date);
      const ticket = {
        id: genId(data.date, seq),
        ...data,
        lastUpdate: new Date().toISOString().slice(0, 16),
        resolvedAt: data.status === 'Resolved' ? new Date().toISOString().slice(0, 16) : ''
      };
      tickets.unshift(ticket);
      toastSuccess('Ticket ' + ticket.id + ' created'); watchIncomingTickets();;
      saveTickets();
      maybeAutoNotify(ticket, true);
    }
    currentView = 'tickets';
    document.querySelectorAll('.nav-item').forEach(b => {
      b.classList.toggle('active', b.dataset.view === 'tickets');
    });
    render();
  });

  const cancel = document.getElementById('cancelEdit');
  if (cancel) {
    cancel.addEventListener('click', () => {
      editId = null;
      currentView = 'tickets';
      document.querySelectorAll('.nav-item').forEach(b => {
        b.classList.toggle('active', b.dataset.view === 'tickets');
      });
      render();
    });
  }
}

// ── Rota ─────────────────────────────────────────────────────────────
function renderRota() {
  const rota = loadRota();
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
  const slots = Object.keys(rota.slots);

  return `
    <div class="principle">Publish who monitors each phone. Explicit handover required before breaks, lunch, meetings or end of day.</div>
    <div class="card">
      <div class="card-header">
        <span class="card-title">Week commencing</span>
        <input type="date" id="rotaWeek" value="${rota.weekStart}" style="padding:6px 10px;border:1px solid var(--border);border-radius:8px" />
      </div>
      <div class="card-body table-wrap">
        <table class="rota-table">
          <thead>
            <tr>
              <th>Period / Phone</th>
              ${days.map(d => `<th>${d}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${slots.map(slot => `
              <tr>
                <td>${slot}</td>
                ${rota.slots[slot].map((val, i) => `
                  <td>
                    <select data-slot="${slot}" data-day="${i}" class="rota-select" style="width:100%;padding:4px;border:1px solid var(--border);border-radius:6px;font-size:12px">
                      <option value="">—</option>
                      <option value="All" ${val === 'All' ? 'selected' : ''}>All</option>
                      ${OFFICERS.map(o => `<option value="${o}" ${val === o ? 'selected' : ''}>${o.split(' ')[0]}</option>`).join('')}
                    </select>
                  </td>
                `).join('')}
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
      <div class="card-body" style="border-top:1px solid var(--border);padding-top:12px">
        <button class="btn btn-primary" id="saveRotaBtn">Save Rota</button>
      </div>
    </div>
  `;
}

function bindRota() {
  document.getElementById('saveRotaBtn')?.addEventListener('click', () => {
    const rota = loadRota();
    rota.weekStart = document.getElementById('rotaWeek').value;
    document.querySelectorAll('.rota-select').forEach(sel => {
      const slot = sel.dataset.slot;
      const day = Number(sel.dataset.day);
      if (!rota.slots[slot]) rota.slots[slot] = ['', '', '', '', ''];
      rota.slots[slot][day] = sel.value;
    });
    saveRota(rota);
    toastSuccess('Rota saved');
  });
}

// ── Daily Report ─────────────────────────────────────────────────────
function renderDaily() {
  const date = todayStr();
  return `
    <div class="filters">
      <label style="font-weight:600;color:var(--muted)">Report date</label>
      <input type="date" id="dailyDate" value="${date}" />
    </div>
    <div id="dailyContent">${dailyContent(date)}</div>
  `;
}

function dailyContent(date) {
  const received = tickets.filter(t => t.date === date);
  const withResp = received.filter(t => t.firstResponse);
  const ok = withResp.filter(t => responseOk(t) === true).length;
  const compliance = withResp.length ? Math.round((ok / withResp.length) * 100) : 0;
  const resolved = tickets.filter(t => t.resolvedAt && t.resolvedAt.startsWith(date));
  const open = tickets.filter(t => t.status !== 'Resolved');
  const overdue = open.filter(isOverdue);
  const unassigned = open.filter(t => !t.owner);
  const pending = open.filter(t => t.status === 'Pending');

  return `
    <div class="grid grid-4" style="margin-bottom:18px">
      <div class="kpi"><div class="kpi-label">Received</div><div class="kpi-value">${received.length}</div></div>
      <div class="kpi"><div class="kpi-label">Response OK</div><div class="kpi-value">${compliance}%</div><div class="kpi-sub">${ok}/${withResp.length}</div></div>
      <div class="kpi"><div class="kpi-label">Resolved today</div><div class="kpi-value">${resolved.length}</div></div>
      <div class="kpi ${overdue.length ? 'danger' : ''}"><div class="kpi-label">Overdue now</div><div class="kpi-value">${overdue.length}</div></div>
    </div>

    <div class="grid grid-2" style="margin-bottom:18px">
      <div class="card">
        <div class="card-header"><span class="card-title">Officer activity</span></div>
        <div class="card-body table-wrap">
          <table>
            <thead><tr><th>Officer</th><th>Open</th><th>Resolved today</th><th>Pending</th></tr></thead>
            <tbody>
              ${OFFICERS.map(o => `
                <tr>
                  <td><strong>${o}</strong></td>
                  <td>${open.filter(t => t.owner === o).length}</td>
                  <td>${resolved.filter(t => t.owner === o).length}</td>
                  <td>${pending.filter(t => t.owner === o).length}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
      <div class="card">
        <div class="card-header"><span class="card-title">Priority today</span></div>
        <div class="card-body table-wrap">
          <table>
            <thead><tr><th>Priority</th><th>Count</th></tr></thead>
            <tbody>
              ${PRIORITIES.map(p => `
                <tr><td>${priorityBadge(p)}</td><td>${received.filter(t => t.priority === p).length}</td></tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-header"><span class="card-title">Ready-to-send daily summary</span></div>
      <div class="card-body" style="font-size:13px;line-height:1.6;background:#f7fafc;border-radius:8px;padding:14px">
        Date: <strong>${date}</strong> |
        Received: <strong>${received.length}</strong> |
        1st response in target: <strong>${ok} (${compliance}%)</strong> |
        Resolved: <strong>${resolved.length}</strong> |
        Open: <strong>${open.length}</strong> |
        Overdue: <strong>${overdue.length}</strong> |
        Unassigned: <strong>${unassigned.length}</strong> |
        Pending: <strong>${pending.length}</strong>
      </div>
    </div>
  `;
}

function bindDaily() {
  document.getElementById('dailyDate')?.addEventListener('change', e => {
    document.getElementById('dailyContent').innerHTML = dailyContent(e.target.value);
  });
}

// ── Weekly ───────────────────────────────────────────────────────────
function renderWeekly() {
  const mon = getMonday(new Date()).toISOString().slice(0, 10);
  return `
    <div class="filters">
      <label style="font-weight:600;color:var(--muted)">Week starting (Monday)</label>
      <input type="date" id="weeklyStart" value="${mon}" />
    </div>
    <div id="weeklyContent">${weeklyContent(mon)}</div>
  `;
}

function weeklyContent(startStr) {
  const start = new Date(startStr);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  const endStr = end.toISOString().slice(0, 10);

  const received = tickets.filter(t => t.date >= startStr && t.date <= endStr);
  const resolved = tickets.filter(t => t.resolvedAt && t.resolvedAt.slice(0, 10) >= startStr && t.resolvedAt.slice(0, 10) <= endStr);
  const withResp = received.filter(t => t.firstResponse);
  const ok = withResp.filter(t => responseOk(t) === true).length;
  const compliance = withResp.length ? Math.round((ok / withResp.length) * 100) : 0;
  const open = tickets.filter(t => t.status !== 'Resolved');
  const overdue = open.filter(isOverdue);

  return `
    <div class="grid grid-4" style="margin-bottom:18px">
      <div class="kpi"><div class="kpi-label">Received this week</div><div class="kpi-value">${received.length}</div></div>
      <div class="kpi"><div class="kpi-label">Resolved</div><div class="kpi-value">${resolved.length}</div></div>
      <div class="kpi"><div class="kpi-label">Compliance</div><div class="kpi-value">${compliance}%</div></div>
      <div class="kpi ${overdue.length ? 'danger' : ''}"><div class="kpi-label">Overdue now</div><div class="kpi-value">${overdue.length}</div></div>
    </div>
    <div class="card">
      <div class="card-header"><span class="card-title">Officer performance (${startStr} → ${endStr})</span></div>
      <div class="card-body table-wrap">
        <table>
          <thead><tr><th>Officer</th><th>Owned</th><th>Resolved</th><th>Still open</th><th>Pending</th></tr></thead>
          <tbody>
            ${OFFICERS.map(o => `
              <tr>
                <td><strong>${o}</strong></td>
                <td>${received.filter(t => t.owner === o).length}</td>
                <td>${resolved.filter(t => t.owner === o).length}</td>
                <td>${open.filter(t => t.owner === o).length}</td>
                <td>${open.filter(t => t.owner === o && t.status === 'Pending').length}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function bindWeekly() {
  document.getElementById('weeklyStart')?.addEventListener('change', e => {
    document.getElementById('weeklyContent').innerHTML = weeklyContent(e.target.value);
  });
}

// ── Monthly ──────────────────────────────────────────────────────────
function renderMonthly() {
  const now = new Date();
  const start = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  return `
    <div class="filters">
      <label style="font-weight:600;color:var(--muted)">Month start</label>
      <input type="date" id="monthlyStart" value="${start}" />
    </div>
    <div id="monthlyContent">${monthlyContent(start)}</div>
  `;
}

function monthlyContent(startStr) {
  const start = new Date(startStr);
  const end = new Date(start.getFullYear(), start.getMonth() + 1, 0);
  const endStr = end.toISOString().slice(0, 10);

  const received = tickets.filter(t => t.date >= startStr && t.date <= endStr);
  const resolved = tickets.filter(t => t.resolvedAt && t.resolvedAt.slice(0, 10) >= startStr && t.resolvedAt.slice(0, 10) <= endStr);
  const withResp = received.filter(t => t.firstResponse);
  const ok = withResp.filter(t => responseOk(t) === true).length;
  const compliance = withResp.length ? Math.round((ok / withResp.length) * 100) : 0;
  const rate = received.length ? Math.round((resolved.length / received.length) * 100) : 0;
  const open = tickets.filter(t => t.status !== 'Resolved');

  return `
    <div class="grid grid-4" style="margin-bottom:18px">
      <div class="kpi"><div class="kpi-label">Received</div><div class="kpi-value">${received.length}</div></div>
      <div class="kpi"><div class="kpi-label">Resolved</div><div class="kpi-value">${resolved.length}</div></div>
      <div class="kpi"><div class="kpi-label">Resolution rate</div><div class="kpi-value">${rate}%</div></div>
      <div class="kpi"><div class="kpi-label">Response compliance</div><div class="kpi-value">${compliance}%</div></div>
    </div>

    <div class="grid grid-2" style="margin-bottom:18px">
      <div class="card">
        <div class="card-header"><span class="card-title">By category</span></div>
        <div class="card-body table-wrap">
          <table>
            <thead><tr><th>Category</th><th>Count</th></tr></thead>
            <tbody>
              ${CATEGORIES.map(c => {
                const n = received.filter(t => t.category === c).length;
                return n ? `<tr><td>${c}</td><td>${n}</td></tr>` : '';
              }).join('') || '<tr><td colspan="2">No data</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
      <div class="card">
        <div class="card-header"><span class="card-title">Officer scorecard</span></div>
        <div class="card-body table-wrap">
          <table>
            <thead><tr><th>Officer</th><th>Owned</th><th>Resolved</th><th>Open</th></tr></thead>
            <tbody>
              ${OFFICERS.map(o => `
                <tr>
                  <td><strong>${o}</strong></td>
                  <td>${received.filter(t => t.owner === o).length}</td>
                  <td>${resolved.filter(t => t.owner === o).length}</td>
                  <td>${open.filter(t => t.owner === o).length}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

function bindMonthly() {
  document.getElementById('monthlyStart')?.addEventListener('change', e => {
    document.getElementById('monthlyContent').innerHTML = monthlyContent(e.target.value);
  });
}

// ── Team ─────────────────────────────────────────────────────────────
function renderTeam() {
  const open = tickets.filter(t => t.status !== 'Resolved');
  return `
    <div class="grid grid-2">
      ${OFFICERS.map(o => {
        const info = TEAM_INFO[o];
        return `
          <div class="team-card">
            <div class="name">${o}</div>
            <div class="role">${info.role}</div>
            <div class="focus">${info.focus}</div>
            <div class="team-stats">
              <div class="team-stat">
                <div class="num">${open.filter(t => t.owner === o).length}</div>
                <div class="lbl">Open</div>
              </div>
              <div class="team-stat">
                <div class="num">${tickets.filter(t => t.owner === o && t.status === 'Resolved').length}</div>
                <div class="lbl">Resolved</div>
              </div>
              <div class="team-stat">
                <div class="num">${open.filter(t => t.owner === o && t.status === 'Pending').length}</div>
                <div class="lbl">Pending</div>
              </div>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

// ── Templates ────────────────────────────────────────────────────────
function renderTemplates() {
  return `
    <div class="principle">Copy these templates and replace the bracketed placeholders. Never request passwords or OTPs.</div>
    <div class="grid grid-2">
      ${TEMPLATES.map(t => `
        <div class="template-card">
          <h4>${t.name}</h4>
          <p>${esc(t.text)}</p>
          <button class="btn btn-sm btn-ghost" onclick="copyText(\`${t.text.replace(/`/g, '\\`')}\`)">Copy</button>
        </div>
      `).join('')}
    </div>
  `;
}

function copyText(text) {
  navigator.clipboard.writeText(text).then(() => toastSuccess('Copied to clipboard')).catch(() => toast('Could not copy'));
}

// ── Notifications view ───────────────────────────────────────────────
function renderNotifications() {
  const s = notifySettings;
  const log = notifyLog.slice(0, 30);

  return `
    <div class="principle">
      Email notifications open your default mail client with a ready-made message (mailto).
      Configure real team addresses below. For fully automatic server-side email, connect a backend later.
    </div>

    <div class="grid grid-2" style="margin-bottom:18px">
      <div class="card">
        <div class="card-header"><span class="card-title">Notification settings</span></div>
        <div class="card-body">
          <form id="notifySettingsForm" class="form-grid">
            <div class="form-group full">
              <label style="display:flex;align-items:center;gap:8px;cursor:pointer">
                <input type="checkbox" name="enabled" ${s.enabled ? 'checked' : ''} style="width:auto" />
                Enable email notifications
              </label>
            </div>
            <div class="form-group">
              <label>Team Lead email</label>
              <input type="email" name="teamLeadEmail" value="${esc(s.teamLeadEmail)}" />
            </div>
            <div class="form-group">
              <label>Engineering email</label>
              <input type="email" name="engineeringEmail" value="${esc(s.engineeringEmail)}" />
            </div>
            <div class="form-group">
              <label>Operations email</label>
              <input type="email" name="opsEmail" value="${esc(s.opsEmail)}" />
            </div>
            <div class="form-group full"><hr style="border:none;border-top:1px solid var(--border);margin:4px 0" /></div>
            ${OFFICERS.map(o => `
              <div class="form-group">
                <label>${o}</label>
                <input type="email" name="email_${o}" value="${esc(s.officerEmails[o] || '')}" placeholder="email@credlock.africa" />
              </div>
            `).join('')}
            <div class="form-group full"><hr style="border:none;border-top:1px solid var(--border);margin:4px 0" /></div>
            <div class="form-group full">
              <label style="margin-bottom:8px">Auto-prompt rules</label>
              <label style="display:flex;align-items:center;gap:8px;font-weight:400;margin-bottom:6px"><input type="checkbox" name="onP1" ${s.rules.onP1 ? 'checked' : ''} style="width:auto" /> Prompt on P1 Critical</label>
              <label style="display:flex;align-items:center;gap:8px;font-weight:400;margin-bottom:6px"><input type="checkbox" name="onP2" ${s.rules.onP2 ? 'checked' : ''} style="width:auto" /> Prompt on P2 High</label>
              <label style="display:flex;align-items:center;gap:8px;font-weight:400;margin-bottom:6px"><input type="checkbox" name="onAssign" ${s.rules.onAssign ? 'checked' : ''} style="width:auto" /> Prompt when assigned</label>
              <label style="display:flex;align-items:center;gap:8px;font-weight:400;margin-bottom:6px"><input type="checkbox" name="onEscalation" ${s.rules.onEscalation ? 'checked' : ''} style="width:auto" /> Prompt on escalation</label>
              <label style="display:flex;align-items:center;gap:8px;font-weight:400"><input type="checkbox" name="onResolve" ${s.rules.onResolve ? 'checked' : ''} style="width:auto" /> Prompt on resolve</label>
            </div>
            <div class="form-actions">
              <button type="submit" class="btn btn-primary">Save settings</button>
            </div>
          </form>
        </div>
      </div>

      <div class="card">
        <div class="card-header"><span class="card-title">How it works</span></div>
        <div class="card-body" style="font-size:13px;line-height:1.6;color:var(--muted)">
          <ol style="padding-left:18px">
            <li style="margin-bottom:8px">Enter real email addresses for each officer and for Engineering / Ops.</li>
            <li style="margin-bottom:8px">When a <strong>P1</strong> or <strong>P2</strong> ticket is created, the portal asks whether to open an email draft.</li>
            <li style="margin-bottom:8px">From any ticket, click <strong>✉ Email notify</strong> to choose recipients and open a draft.</li>
            <li style="margin-bottom:8px">Your default mail app (Outlook, Gmail, etc.) opens with subject + body already filled.</li>
            <li>Every attempt is recorded in the log below for accountability.</li>
          </ol>
          <p style="margin-top:12px"><strong>Note:</strong> This uses <code>mailto:</code> — it does not send email by itself. The user must click Send in their mail client. For automatic sending without user action, a server-side mail service is required later.</p>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <span class="card-title">Notification log (last 30)</span>
        <button class="btn btn-sm btn-ghost" id="clearNotifyLog">Clear log</button>
      </div>
      <div class="card-body table-wrap">
        ${log.length === 0 ? '<div class="empty"><div class="empty-icon">🔔</div>No notifications yet</div>' : `
          <table>
            <thead>
              <tr><th>When</th><th>Ticket</th><th>Purpose</th><th>To</th><th>Priority</th><th>Status</th></tr>
            </thead>
            <tbody>
              ${log.map(n => `
                <tr>
                  <td style="white-space:nowrap">${new Date(n.at).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</td>
                  <td><strong>${esc(n.ticketId)}</strong></td>
                  <td>${esc(n.purpose)}</td>
                  <td style="font-size:12px">${esc(n.to)}</td>
                  <td>${n.priority ? priorityBadge(n.priority) : '—'}</td>
                  <td><span class="badge badge-yes">${esc(n.status)}</span></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        `}
      </div>
    </div>
  `;
}

function bindNotifications() {
  const snd = document.getElementById('soundAlertsToggle');
  if (snd) {
    snd.checked = soundEnabled();
    snd.addEventListener('change', () => {
      setSoundEnabled(snd.checked);
      toastSuccess(snd.checked ? 'Sound alerts on' : 'Sound alerts muted');
      if (snd.checked) playSound('success');
    });
  }

  document.getElementById('notifySettingsForm')?.addEventListener('submit', e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    notifySettings.enabled = fd.get('enabled') === 'on';
    notifySettings.teamLeadEmail = fd.get('teamLeadEmail') || '';
    notifySettings.engineeringEmail = fd.get('engineeringEmail') || '';
    notifySettings.opsEmail = fd.get('opsEmail') || '';
    OFFICERS.forEach(o => {
      notifySettings.officerEmails[o] = fd.get('email_' + o) || '';
    });
    notifySettings.rules.onP1 = fd.get('onP1') === 'on';
    notifySettings.rules.onP2 = fd.get('onP2') === 'on';
    notifySettings.rules.onAssign = fd.get('onAssign') === 'on';
    notifySettings.rules.onEscalation = fd.get('onEscalation') === 'on';
    notifySettings.rules.onResolve = fd.get('onResolve') === 'on';
    saveNotifySettings();
    toastSuccess('Notification settings saved');
  });

  document.getElementById('clearNotifyLog')?.addEventListener('click', () => {
    if (confirm('Clear the notification log?')) {
      notifyLog = [];
      saveNotifyLog();
      render();
      toastSuccess('Log cleared');
    }
  });
}



// ── Kavro Device Issues ──────────────────────────────────────────────
const KAVRO_STORAGE = 'credlock_kavro_v1';
let kavroRecords = loadKavro();

function loadKavro() {
  try {
    const raw = localStorage.getItem(KAVRO_STORAGE);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  // seed from bundled data
  const seed = (window.KAVRO_DATA || []).map(r => ({
    ...r,
    notes: r.notes || [],
    followUps: r.followUps || [],
    actions: r.actions || [],
    currentAction: r.currentAction || ''
  }));
  return seed;
}

function saveKavro() {
  localStorage.setItem(KAVRO_STORAGE, JSON.stringify(kavroRecords));
  updateKavroBadge();
}

function updateKavroBadge() {
  const el = document.getElementById('navKavroCount');
  if (!el) return;
  const locked = kavroRecords.filter(r => (r.credlockStatus || '').toLowerCase() === 'locked').length;
  el.textContent = locked;
  el.style.display = locked ? 'inline-block' : 'none';
}

/** Auto-decide follow-up from free-text note */
function autoFollowUpFromNote(noteText, record) {
  const t = (noteText || '').toLowerCase();
  const days = parseInt(record.daysOverdue || 0, 10) || 0;
  const locked = (record.credlockStatus || '').toLowerCase() === 'locked';

  // Keyword rules
  if (/unlock|release|payment.?confirm|paid.?full|settled/.test(t)) {
    return {
      type: 'Unlock Device',
      dueInDays: 0,
      owner: 'Peter',
      reason: 'Note indicates payment/unlock request'
    };
  }
  if (/lock|re-?lock|default|no.?payment|refuse/.test(t)) {
    return {
      type: 'Confirm Lock',
      dueInDays: 0,
      owner: 'Peter',
      reason: 'Note indicates lock / default action'
    };
  }
  if (/call|phone|reach|contact.?customer|follow.?up.?call/.test(t)) {
    return {
      type: 'Call Customer',
      dueInDays: 1,
      owner: record.recoveryOfficer || 'Tosin',
      reason: 'Note requests customer contact'
    };
  }
  if (/visit|field|address|locate|home/.test(t)) {
    return {
      type: 'Field Visit',
      dueInDays: 2,
      owner: record.recoveryOfficer || 'Zainab',
      reason: 'Note suggests field recovery'
    };
  }
  if (/escalate|legal|police|fraud/.test(t)) {
    return {
      type: 'Escalate to Lead',
      dueInDays: 0,
      owner: 'Joseph Olayemi',
      reason: 'Note indicates escalation'
    };
  }
  if (/mdm|kavro|imei|serial|device.?issue|technical/.test(t)) {
    return {
      type: 'Technical Check',
      dueInDays: 1,
      owner: 'Peter',
      reason: 'Note indicates technical/MDM issue'
    };
  }
  if (/promise|will.?pay|callback|reschedule/.test(t)) {
    return {
      type: 'Payment Follow-up',
      dueInDays: 3,
      owner: record.recoveryOfficer || 'Tosin',
      reason: 'Customer promised payment / reschedule'
    };
  }

  // Fallback by status / overdue
  if (locked && days >= 45) {
    return { type: 'Escalate Recovery', dueInDays: 1, owner: 'Joseph Olayemi', reason: 'Auto: locked + 45+ days overdue' };
  }
  if (locked && days >= 30) {
    return { type: 'Recovery Call', dueInDays: 1, owner: record.recoveryOfficer || 'Tosin', reason: 'Auto: locked + 30+ days overdue' };
  }
  if (locked) {
    return { type: 'Monitor Lock', dueInDays: 3, owner: 'Peter', reason: 'Auto: device locked' };
  }
  return { type: 'General Follow-up', dueInDays: 2, owner: record.recoveryOfficer || 'Tosin', reason: 'Auto: general note' };
}

function dueDateFromDays(n) {
  const d = new Date();
  d.setDate(d.getDate() + (n || 0));
  return d.toISOString().slice(0, 10);
}

function renderKavro() {
  const locked = kavroRecords.filter(r => (r.credlockStatus || '').toLowerCase() === 'locked').length;
  const unlocked = kavroRecords.length - locked;
  const p1 = kavroRecords.filter(r => r.priority === 'P1 Critical').length;
  const withFu = kavroRecords.filter(r => (r.followUps || []).some(f => f.status !== 'Done')).length;

  return `
    <div class="principle">
      <strong>Kavro / Device Issues</strong> — Locked &amp; unlocked Credlock devices linked to BNPL loans.
      Add notes → system auto-suggests follow-up action, owner and due date from the note text.
    </div>

    <div class="grid grid-4" style="margin-bottom:18px">
      <div class="kpi"><div class="kpi-label">Total devices</div><div class="kpi-value">${kavroRecords.length}</div></div>
      <div class="kpi danger"><div class="kpi-label">Locked</div><div class="kpi-value">${locked}</div></div>
      <div class="kpi success"><div class="kpi-label">Unlocked</div><div class="kpi-value">${unlocked}</div></div>
      <div class="kpi warn"><div class="kpi-label">Open follow-ups</div><div class="kpi-value">${withFu}</div></div>
    </div>

    <div class="filters" id="kavroFilters">
      <div class="search-box">
        <input type="search" id="kavroSearch" placeholder="Search IMEI, name, phone, officer…" />
      </div>
      <select id="kavroStatus">
        <option value="">All lock status</option>
        <option value="Locked">Locked</option>
        <option value="Unlocked">Unlocked</option>
      </select>
      <select id="kavroPriority">
        <option value="">All priorities</option>
        <option value="P1 Critical">P1 Critical</option>
        <option value="P2 High">P2 High</option>
        <option value="P3 Normal">P3 Normal</option>
        <option value="P4 Low">P4 Low</option>
      </select>
      <select id="kavroOfficer">
        <option value="">All recovery officers</option>
        ${[...new Set(kavroRecords.map(r => r.recoveryOfficer).filter(Boolean))].sort().map(o =>
          `<option value="${esc(o)}">${esc(o)}</option>`
        ).join('')}
      </select>
    </div>

    <div class="card">
      <div class="card-body table-wrap" id="kavroTableBody">
        ${kavroTable(kavroRecords)}
      </div>
    </div>
  `;
}

function kavroTable(list) {
  if (!list.length) return '<div class="empty"><div class="empty-icon">📱</div>No records match</div>';
  const sorted = [...list].sort((a, b) => {
    const pa = { 'P1 Critical': 0, 'P2 High': 1, 'P3 Normal': 2, 'P4 Low': 3 }[a.priority] ?? 9;
    const pb = { 'P1 Critical': 0, 'P2 High': 1, 'P3 Normal': 2, 'P4 Low': 3 }[b.priority] ?? 9;
    if (pa !== pb) return pa - pb;
    return (parseInt(b.daysOverdue) || 0) - (parseInt(a.daysOverdue) || 0);
  });

  return `
    <table>
      <thead>
        <tr>
          <th>ID</th>
          <th>Customer</th>
          <th>IMEI / Device</th>
          <th>Lock</th>
          <th>Overdue</th>
          <th>Outstanding</th>
          <th>Priority</th>
          <th>Recovery officer</th>
          <th>Follow-up</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        ${sorted.map(r => {
          const openFu = (r.followUps || []).filter(f => f.status !== 'Done');
          const lastFu = openFu[0];
          return `
            <tr>
              <td><strong>${r.id}</strong></td>
              <td>${esc(r.firstName)} ${esc(r.lastName)}<br><small style="color:var(--muted)">${esc(r.phone)}</small></td>
              <td><code style="font-size:11px">${esc(r.imei)}</code><br><small>${esc(r.deviceBrand)} ${esc(r.deviceModel)}</small></td>
              <td>${(r.credlockStatus || '').toLowerCase() === 'locked'
                ? '<span class="badge badge-p1">Locked</span>'
                : '<span class="badge badge-yes">Unlocked</span>'}</td>
              <td><strong>${esc(r.daysOverdue)}</strong>d</td>
              <td>${Number(r.outstanding || 0).toLocaleString()}</td>
              <td>${priorityBadge(r.priority)}</td>
              <td style="font-size:12px">${esc(r.recoveryOfficer)}</td>
              <td style="font-size:11px">${lastFu ? esc(lastFu.type) + '<br><small>' + esc(lastFu.dueDate) + '</small>' : '—'}</td>
              <td>
                <button class="btn btn-sm btn-ghost" onclick="viewKavro('${r.id}')">Open</button>
              </td>
            </tr>
          `;
        }).join('')}
      </tbody>
    </table>
  `;
}

function bindKavro() {
  const apply = () => {
    const q = (document.getElementById('kavroSearch')?.value || '').toLowerCase();
    const st = document.getElementById('kavroStatus')?.value || '';
    const pr = document.getElementById('kavroPriority')?.value || '';
    const of = document.getElementById('kavroOfficer')?.value || '';
    let list = kavroRecords.filter(r => {
      if (st && r.credlockStatus !== st) return false;
      if (pr && r.priority !== pr) return false;
      if (of && r.recoveryOfficer !== of) return false;
      if (q) {
        const hay = [r.id, r.imei, r.firstName, r.lastName, r.phone, r.recoveryOfficer, r.merchant, r.serialNumber].join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    document.getElementById('kavroTableBody').innerHTML = kavroTable(list);
  };
  ['kavroSearch', 'kavroStatus', 'kavroPriority', 'kavroOfficer'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('input', apply);
      el.addEventListener('change', apply);
    }
  });
  updateKavroBadge();
}

function viewKavro(id) {
  const r = kavroRecords.find(x => x.id === id);
  if (!r) return;

  const notesHtml = (r.notes || []).length
    ? (r.notes || []).slice().reverse().map(n => `
        <div class="activity-item">
          <div class="activity-dot"></div>
          <div>
            <div>${esc(n.text)}</div>
            <div class="activity-meta">${esc(n.by)} · ${esc(n.at)}</div>
          </div>
        </div>
      `).join('')
    : '<div style="color:var(--muted);font-size:13px">No notes yet</div>';

  const fuHtml = (r.followUps || []).length
    ? (r.followUps || []).map((f, i) => `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--border);font-size:13px">
          <div>
            <strong>${esc(f.type)}</strong> → ${esc(f.owner)} · due ${esc(f.dueDate)}
            <div class="activity-meta">${esc(f.reason)}</div>
          </div>
          <div>
            ${f.status === 'Done'
              ? '<span class="badge badge-yes">Done</span>'
              : `<button class="btn btn-sm btn-success" onclick="completeFollowUp('${r.id}',${i})">Done</button>`}
          </div>
        </div>
      `).join('')
    : '<div style="color:var(--muted);font-size:13px">No follow-ups</div>';

  const actionsHtml = (r.actions || []).length
    ? (r.actions || []).slice().reverse().map(a => `
        <div class="activity-meta" style="padding:4px 0">${esc(a.at)} · <strong>${esc(a.type)}</strong> by ${esc(a.by)}${a.note ? ' — ' + esc(a.note) : ''}</div>
      `).join('')
    : '<div style="color:var(--muted);font-size:13px">No actions logged</div>';

  openModal(r.id + ' · ' + r.firstName + ' ' + r.lastName, `
    <div style="display:grid;gap:12px;font-size:13px">
      <div class="grid grid-2" style="gap:8px">
        <div><strong>IMEI</strong><br><code>${esc(r.imei)}</code></div>
        <div><strong>Serial</strong><br>${esc(r.serialNumber) || '—'}</div>
        <div><strong>Device</strong><br>${esc(r.deviceBrand)} ${esc(r.deviceModel)}</div>
        <div><strong>Lock status</strong><br>${(r.credlockStatus || '').toLowerCase() === 'locked' ? '<span class="badge badge-p1">Locked</span>' : '<span class="badge badge-yes">Unlocked</span>'}</div>
        <div><strong>Days overdue</strong><br>${esc(r.daysOverdue)}</div>
        <div><strong>Outstanding</strong><br>${Number(r.outstanding || 0).toLocaleString()}</div>
        <div><strong>Priority</strong><br>${priorityBadge(r.priority)}</div>
        <div><strong>Recovery officer</strong><br>${esc(r.recoveryOfficer)}</div>
        <div><strong>Phone</strong><br>${esc(r.phone)}</div>
        <div><strong>Location</strong><br>${esc(r.city)}, ${esc(r.state)}</div>
      </div>

      <div style="border-top:1px solid var(--border);padding-top:12px">
        <strong style="display:block;margin-bottom:8px">Quick actions</strong>
        <div style="display:flex;flex-wrap:wrap;gap:8px">
          <button class="btn btn-sm btn-primary" onclick="kavroAction('${r.id}','Request Unlock')">Request Unlock</button>
          <button class="btn btn-sm btn-ghost" onclick="kavroAction('${r.id}','Confirm Lock')">Confirm Lock</button>
          <button class="btn btn-sm btn-ghost" onclick="kavroAction('${r.id}','Call Customer')">Call Customer</button>
          <button class="btn btn-sm btn-ghost" onclick="kavroAction('${r.id}','Escalate')">Escalate</button>
          <button class="btn btn-sm btn-ghost" onclick="kavroAction('${r.id}','Technical Check')">Technical Check</button>
        </div>
      </div>

      <div style="border-top:1px solid var(--border);padding-top:12px">
        <strong style="display:block;margin-bottom:8px">Add note (auto follow-up)</strong>
        <textarea id="kavroNoteText" rows="3" style="width:100%;padding:9px 12px;border:1px solid var(--border);border-radius:8px;margin-bottom:8px" placeholder="e.g. Customer promised to pay Friday — call to confirm unlock"></textarea>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
          <select id="kavroNoteBy" style="padding:7px 10px;border:1px solid var(--border);border-radius:8px">
            ${OFFICERS.map(o => `<option value="${o}">${o}</option>`).join('')}
          </select>
          <button class="btn btn-primary" onclick="addKavroNote('${r.id}')">Add note + auto follow-up</button>
        </div>
        <div id="kavroSuggest" style="margin-top:8px;font-size:12px;color:var(--muted)"></div>
      </div>

      <div style="border-top:1px solid var(--border);padding-top:12px">
        <strong>Follow-ups</strong>
        <div style="margin-top:6px">${fuHtml}</div>
      </div>

      <div style="border-top:1px solid var(--border);padding-top:12px">
        <strong>Notes</strong>
        <div style="margin-top:6px">${notesHtml}</div>
      </div>

      <div style="border-top:1px solid var(--border);padding-top:12px">
        <strong>Action log</strong>
        <div style="margin-top:6px">${actionsHtml}</div>
      </div>
    </div>
  `, `
    <button class="btn btn-ghost" onclick="closeModal()">Close</button>
  `);

  // live suggest as user types
  setTimeout(() => {
    const ta = document.getElementById('kavroNoteText');
    const box = document.getElementById('kavroSuggest');
    if (ta && box) {
      ta.addEventListener('input', () => {
        const sug = autoFollowUpFromNote(ta.value, r);
        box.innerHTML = ta.value.trim()
          ? `Suggested follow-up: <strong>${esc(sug.type)}</strong> → ${esc(sug.owner)} in ${sug.dueInDays}d — <em>${esc(sug.reason)}</em>`
          : '';
      });
    }
  }, 50);
}

function addKavroNote(id) {
  const r = kavroRecords.find(x => x.id === id);
  if (!r) return;
  const text = document.getElementById('kavroNoteText')?.value?.trim();
  const by = document.getElementById('kavroNoteBy')?.value || 'Tosin';
  if (!text) { toast('Enter a note'); return; }

  const now = new Date().toISOString().slice(0, 16).replace('T', ' ');
  if (!r.notes) r.notes = [];
  r.notes.push({ text, by, at: now });

  const sug = autoFollowUpFromNote(text, r);
  if (!r.followUps) r.followUps = [];
  r.followUps.unshift({
    type: sug.type,
    owner: sug.owner,
    dueDate: dueDateFromDays(sug.dueInDays),
    reason: sug.reason,
    status: 'Open',
    fromNote: text.slice(0, 80),
    createdAt: now
  });

  if (!r.actions) r.actions = [];
  r.actions.push({ type: 'Note + Follow-up', by, at: now, note: sug.type });

  saveKavro();
  toastSuccess('Note saved · follow-up: ' + sug.type);
  viewKavro(id); // refresh modal
}

function kavroAction(id, type) {
  const r = kavroRecords.find(x => x.id === id);
  if (!r) return;
  const now = new Date().toISOString().slice(0, 16).replace('T', ' ');
  if (!r.actions) r.actions = [];
  r.actions.push({ type, by: 'Portal user', at: now, note: '' });
  r.currentAction = type;

  // auto follow-up from action type
  const fakeNote = type.toLowerCase();
  const sug = autoFollowUpFromNote(fakeNote, r);
  if (!r.followUps) r.followUps = [];
  r.followUps.unshift({
    type: sug.type,
    owner: sug.owner,
    dueDate: dueDateFromDays(sug.dueInDays),
    reason: 'From action: ' + type,
    status: 'Open',
    createdAt: now
  });

  // Status side-effects
  if (type === 'Request Unlock') {
    // does not unlock automatically – creates work item
  }
  if (type === 'Confirm Lock' && (r.credlockStatus || '').toLowerCase() !== 'locked') {
    // record intent only
  }

  saveKavro();
  toastSuccess(type + ' logged · follow-up created');
  viewKavro(id);
}

function completeFollowUp(id, index) {
  const r = kavroRecords.find(x => x.id === id);
  if (!r || !r.followUps || !r.followUps[index]) return;
  r.followUps[index].status = 'Done';
  r.followUps[index].doneAt = new Date().toISOString().slice(0, 16).replace('T', ' ');
  saveKavro();
  toastSuccess('Follow-up marked done');
  viewKavro(id);
}



function ticketsForCurrentUser(all) {
  const u = window.CredlockAuth && CredlockAuth.currentUser();
  if (!u) return all;
  if (u.role === 'lead') return all;
  // Officers see tickets they own or created / requester match
  const name = (u.name || '').toLowerCase();
  return all.filter(t => {
    const owner = (t.owner || '').toLowerCase();
    return owner === name || owner.includes(name.split(' ')[0]);
  });
}

function activityForUser(name) {
  const n = (name || '').toLowerCase();
  const mine = tickets.filter(t => (t.owner || '').toLowerCase().includes(n.split(' ')[0]) || (t.owner || '').toLowerCase() === n);
  const open = mine.filter(t => t.status !== 'Resolved' && t.status !== 'Closed');
  const resolved = mine.filter(t => t.status === 'Resolved' || t.status === 'Closed');
  const p1 = open.filter(t => t.priority === 'P1 Critical');
  return { mine, open, resolved, p1 };
}


function renderLeadDashboard() {
  const u = window.CredlockAuth && CredlockAuth.currentUser();
  if (!u || u.role !== 'lead') {
    return '<div class="empty"><div class="empty-icon">◆</div>Team Lead only. Sign in as Team Lead to view this dashboard.</div>';
  }

  const open = tickets.filter(t => t.status !== 'Resolved' && t.status !== 'Closed');
  const p1 = open.filter(t => t.priority === 'P1 Critical');
  const p2 = open.filter(t => t.priority === 'P2 High');
  const overdue = open.filter(t => {
    // simple: New longer than a day or status Waiting
    return t.status === 'Waiting' || t.status === 'Escalated';
  });
  const unassigned = open.filter(t => !t.owner || t.owner === '—');
  const pendingUsers = CredlockAuth.pendingUsers();
  const locked = (typeof kavroRecords !== 'undefined' ? kavroRecords : [])
    .filter(r => (r.credlockStatus || '').toLowerCase() === 'locked').length;
  const kavroP1 = (typeof kavroRecords !== 'undefined' ? kavroRecords : [])
    .filter(r => r.priority === 'P1 Critical').length;

  const officers = ['Tosin', 'Peter', 'Zainab'];
  const officerCards = officers.map(name => {
    const mine = tickets.filter(t => (t.owner || '').toLowerCase().includes(name.toLowerCase()));
    const mineOpen = mine.filter(t => t.status !== 'Resolved' && t.status !== 'Closed');
    const mineDone = mine.filter(t => t.status === 'Resolved' || t.status === 'Closed');
    const mineP1 = mineOpen.filter(t => t.priority === 'P1 Critical');
    return `
      <div class="officer-card">
        <div class="officer-card-head">
          <div class="officer-card-av">${name.charAt(0)}</div>
          <div>
            <div class="officer-card-name">${name}</div>
            <div class="officer-card-role">Support Officer</div>
          </div>
        </div>
        <div class="officer-stats">
          <div class="officer-stat"><div class="officer-stat-val">${mineOpen.length}</div><div class="officer-stat-lbl">Open</div></div>
          <div class="officer-stat"><div class="officer-stat-val" style="color:${mineP1.length ? '#C0392B' : '#1B4F72'}">${mineP1.length}</div><div class="officer-stat-lbl">P1</div></div>
          <div class="officer-stat"><div class="officer-stat-val">${mineDone.length}</div><div class="officer-stat-lbl">Done</div></div>
        </div>
      </div>`;
  }).join('');

  const recent = [...tickets].slice(-8).reverse();

  return `
    <div class="lead-hero">
      <div>
        <h2>Team Lead Dashboard</h2>
        <p>Welcome, ${esc(u.name)} · Full operations overview · ${new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' })}</p>
      </div>
      <div class="lead-hero-actions">
        <button class="btn btn-sm" onclick="navigate('approvals')">Approvals ${pendingUsers.length ? '(' + pendingUsers.length + ')' : ''}</button>
        <button class="btn btn-sm" onclick="navigate('tickets')">All tickets</button>
        <button class="btn btn-sm" onclick="navigate('kavro')">Kavro</button>
        <button class="btn btn-sm" onclick="navigate('weekly')">Weekly report</button>
      </div>
    </div>

    <div class="alert-strip">
      ${p1.length ? `<span class="alert-pill danger">● ${p1.length} open P1 Critical</span>` : `<span class="alert-pill ok">● No open P1</span>`}
      ${unassigned.length ? `<span class="alert-pill warn">● ${unassigned.length} unassigned</span>` : ''}
      ${pendingUsers.length ? `<span class="alert-pill info">● ${pendingUsers.length} pending user(s)</span>` : ''}
      <span class="alert-pill info">● ${locked} devices locked</span>
      <span class="alert-pill ${kavroP1 ? 'danger' : 'ok'}">● ${kavroP1} Kavro P1</span>
    </div>

    <div class="grid grid-4" style="margin-bottom:18px">
      <div class="kpi"><div class="kpi-label">Open tickets</div><div class="kpi-value">${open.length}</div></div>
      <div class="kpi danger"><div class="kpi-label">P1 Critical</div><div class="kpi-value">${p1.length}</div></div>
      <div class="kpi warn"><div class="kpi-label">P2 High</div><div class="kpi-value">${p2.length}</div></div>
      <div class="kpi"><div class="kpi-label">Waiting / Escalated</div><div class="kpi-value">${overdue.length}</div></div>
    </div>

    <div class="card" style="margin-bottom:18px">
      <div class="card-header"><span class="card-title">Performance snapshot</span>
        <button class="btn btn-sm btn-ghost" onclick="navigate('analytics')">Analytics</button>
      </div>
      <div class="card-body">
        ${barChartHtml(['Tosin','Peter','Zainab'].map(n => {
          const s = computeOfficerStats(n);
          return { label: n, value: s.score, cls: s.score >= 75 ? 'green' : (s.score >= 50 ? '' : 'red') };
        }), { suffix: '' })}
      </div>
    </div>
    <div class="card-title" style="margin:0 0 10px;font-weight:700;color:var(--text)">Officer load</div>
    <div class="grid grid-3" style="margin-bottom:18px">${officerCards}</div>

    <div class="grid grid-2">
      <div class="card">
        <div class="card-header"><span class="card-title">Priority attention</span></div>
        <div class="card-body table-wrap">
          ${[...p1, ...p2].slice(0, 8).length ? `
          <table>
            <thead><tr><th>ID</th><th>Priority</th><th>Owner</th><th>Status</th><th></th></tr></thead>
            <tbody>
              ${[...p1, ...p2].slice(0, 8).map(t => `
                <tr>
                  <td><strong>${esc(t.id)}</strong></td>
                  <td>${priorityBadge(t.priority)}</td>
                  <td>${esc(t.owner || '—')}</td>
                  <td>${esc(t.status)}</td>
                  <td><button class="btn btn-sm btn-ghost" onclick="viewTicket('${t.id}')">Open</button></td>
                </tr>
              `).join('')}
            </tbody>
          </table>` : '<div class="empty">No P1/P2 open tickets</div>'}
        </div>
      </div>
      <div class="card">
        <div class="card-header"><span class="card-title">Recent tickets</span></div>
        <div class="card-body table-wrap">
          ${recent.length ? `
          <table>
            <thead><tr><th>ID</th><th>Requester</th><th>Owner</th><th>Status</th></tr></thead>
            <tbody>
              ${recent.map(t => `
                <tr>
                  <td><strong>${esc(t.id)}</strong></td>
                  <td>${esc(t.requester)}</td>
                  <td>${esc(t.owner || '—')}</td>
                  <td>${esc(t.status)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>` : '<div class="empty">No tickets yet</div>'}
        </div>
      </div>
    </div>
  `;
}


function renderMyWork() {
  const u = CredlockAuth.currentUser();
  if (!u) return '<div class="empty">Sign in required</div>';
  const a = activityForUser(u.name);
  // Also count Kavro follow-ups assigned to this user
  const kavroFu = (typeof kavroRecords !== 'undefined' ? kavroRecords : []).filter(r =>
    (r.followUps || []).some(f => f.status !== 'Done' && (f.owner || '').toLowerCase().includes((u.name || '').toLowerCase().split(' ')[0]))
  );

  return `
    <div class="principle">
      <strong>My Work</strong> — tickets and follow-ups assigned to <em>${esc(u.name)}</em>.
    </div>
    <div class="grid grid-4" style="margin-bottom:18px">
      <div class="kpi"><div class="kpi-label">My open tickets</div><div class="kpi-value">${a.open.length}</div></div>
      <div class="kpi danger"><div class="kpi-label">My P1 open</div><div class="kpi-value">${a.p1.length}</div></div>
      <div class="kpi success"><div class="kpi-label">Resolved by me</div><div class="kpi-value">${a.resolved.length}</div></div>
      <div class="kpi warn"><div class="kpi-label">Kavro follow-ups</div><div class="kpi-value">${kavroFu.length}</div></div>
    </div>
    <div class="card">
      <div class="card-header"><span class="card-title">My open tickets</span></div>
      <div class="card-body table-wrap">
        ${a.open.length ? `
        <table>
          <thead><tr><th>ID</th><th>Requester</th><th>Priority</th><th>Status</th><th>Next action</th><th></th></tr></thead>
          <tbody>
            ${a.open.map(t => `
              <tr>
                <td><strong>${esc(t.id)}</strong></td>
                <td>${esc(t.requester)}</td>
                <td>${priorityBadge(t.priority)}</td>
                <td>${esc(t.status)}</td>
                <td style="font-size:12px">${esc(t.nextAction || '—')}</td>
                <td><button class="btn btn-sm btn-ghost" onclick="viewTicket('${t.id}')">Open</button></td>
              </tr>
            `).join('')}
          </tbody>
        </table>` : '<div class="empty">No open tickets assigned to you</div>'}
      </div>
    </div>
  `;
}

function renderApprovals() {
  const u = CredlockAuth.currentUser();
  if (!u || u.role !== 'lead') {
    return '<div class="empty">Team Lead only</div>';
  }
  const pending = CredlockAuth.pendingUsers();
  const users = CredlockAuth.loadUsers().filter(x => x.status === 'approved');
  const resets = CredlockAuth.openResets();

  return `
    <div class="principle">
      <strong>Approvals</strong> — register requests and password reset tokens. Only Team Lead can approve.
    </div>
    <div class="grid grid-2" style="margin-bottom:18px">
      <div class="kpi warn"><div class="kpi-label">Pending registrations</div><div class="kpi-value">${pending.length}</div></div>
      <div class="kpi"><div class="kpi-label">Open reset tokens</div><div class="kpi-value">${resets.length}</div></div>
    </div>

    <div class="card" style="margin-bottom:16px">
      <div class="card-header"><span class="card-title">Pending registrations</span></div>
      <div class="card-body table-wrap">
        ${pending.length ? `
        <table>
          <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Requested</th><th></th></tr></thead>
          <tbody>
            ${pending.map(p => `
              <tr>
                <td>${esc(p.name)}</td>
                <td>${esc(p.email)}</td>
                <td>${p.role === 'lead' ? 'Team Lead' : 'Officer'}</td>
                <td style="font-size:12px">${esc((p.createdAt || '').slice(0, 16).replace('T',' '))}</td>
                <td style="white-space:nowrap">
                  <button class="btn btn-sm btn-success" data-approve="${p.id}">Approve</button>
                  <button class="btn btn-sm btn-ghost" data-reject="${p.id}">Reject</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>` : '<div class="empty">No pending registrations</div>'}
      </div>
    </div>

    <div class="card" style="margin-bottom:16px">
      <div class="card-header"><span class="card-title">Password reset requests</span></div>
      <div class="card-body table-wrap">
        ${resets.length ? `
        <table>
          <thead><tr><th>Email</th><th>Token</th><th>Created</th></tr></thead>
          <tbody>
            ${resets.map(r => `
              <tr>
                <td>${esc(r.email)}</td>
                <td><code>${esc(r.token)}</code></td>
                <td style="font-size:12px">${esc((r.createdAt || '').slice(0, 16).replace('T',' '))}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        <p style="font-size:12px;color:var(--muted);margin-top:8px">Share the token with the officer so they can complete reset on the Forgot password page.</p>
        ` : '<div class="empty">No open reset tokens</div>'}
      </div>
    </div>

    <div class="card">
      <div class="card-header"><span class="card-title">Approved officers</span>
        <button class="btn btn-sm btn-ghost" id="btnIssueReset">Issue reset token</button>
      </div>
      <div class="card-body table-wrap">
        <table>
          <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Approved</th></tr></thead>
          <tbody>
            ${users.map(u => `
              <tr>
                <td>${esc(u.name)}</td>
                <td>${esc(u.email)}</td>
                <td>${u.role === 'lead' ? 'Team Lead' : 'Officer'}</td>
                <td style="font-size:12px">${esc((u.approvedAt || '').slice(0, 10))}</td>
              </tr>
            `).join('') || '<tr><td colspan="4">None</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function bindApprovals() {
  document.querySelectorAll('[data-approve]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-approve');
      const lead = CredlockAuth.currentUser();
      CredlockAuth.approveUser(id, lead && lead.name);
      toastSuccess('User approved');
      CredlockAuth.updateUserBar();
      navigate('approvals');
    });
  });
  document.querySelectorAll('[data-reject]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-reject');
      const lead = CredlockAuth.currentUser();
      CredlockAuth.rejectUser(id, lead && lead.name);
      toastWarn('User rejected', 'Approvals');
      CredlockAuth.updateUserBar();
      navigate('approvals');
    });
  });
  const issue = document.getElementById('btnIssueReset');
  if (issue) {
    issue.addEventListener('click', () => {
      const email = prompt('Officer email for reset token:');
      if (!email) return;
      try {
        const t = CredlockAuth.issueResetToken(email, CredlockAuth.currentUser().name);
        toast('Token: ' + t);
        navigate('approvals');
      } catch (e) {
        toast(e.message);
      }
    });
  }
}


// ── Settings (Google Sheets backend) ─────────────────────────────────

function renderAdmin() {
  if (!window.CredlockAuth || !CredlockAuth.can('admin')) {
    return '<div class="empty"><div class="empty-icon">⛨</div>Admin access required (Team Lead / Admin).</div>';
  }
  const users = CredlockAuth.loadUsers();
  const perms = CredlockAuth.ALL_PERMS || [];
  const roleLabels = { lead: 'Team Lead', admin: 'Admin', officer: 'Officer', viewer: 'Viewer' };

  return `
    <div class="principle">
      <strong>Admin Panel</strong> — users, roles, and permission control. Only Team Lead / Admin.
    </div>
    <div class="grid grid-3" style="margin-bottom:18px">
      <div class="kpi"><div class="kpi-label">Total users</div><div class="kpi-value">${users.length}</div></div>
      <div class="kpi warn"><div class="kpi-label">Pending</div><div class="kpi-value">${users.filter(u => u.status === 'pending').length}</div></div>
      <div class="kpi success"><div class="kpi-label">Active</div><div class="kpi-value">${users.filter(u => u.status === 'approved').length}</div></div>
    </div>

    <div class="card" style="margin-bottom:16px">
      <div class="card-header"><span class="card-title">Users &amp; access</span>
        <button class="btn btn-sm btn-primary" id="btnAdminAddUser">+ Add user</button>
      </div>
      <div class="card-body table-wrap">
        <table>
          <thead>
            <tr>
              <th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Permissions</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${users.map(u => `
              <tr>
                <td><strong>${esc(u.name)}</strong></td>
                <td style="font-size:12px">${esc(u.email)}</td>
                <td><span class="badge badge-${u.role === 'lead' || u.role === 'admin' ? 'p1' : 'p3'}">${roleLabels[u.role] || u.role}</span></td>
                <td>${esc(u.status)}</td>
                <td style="font-size:11px;max-width:180px">${(u.permissions || []).length} of ${perms.length}</td>
                <td style="white-space:nowrap">
                  <button class="btn btn-sm btn-ghost" data-admin-edit="${u.id}">Edit</button>
                  <button class="btn btn-sm btn-ghost" data-admin-perms="${u.id}">Permissions</button>
                  ${u.status === 'approved' ? `<button class="btn btn-sm btn-ghost" data-admin-disable="${u.id}">Disable</button>` : ''}
                  ${u.status === 'disabled' ? `<button class="btn btn-sm btn-success" data-admin-enable="${u.id}">Enable</button>` : ''}
                  ${u.status === 'pending' ? `<button class="btn btn-sm btn-success" data-admin-approve="${u.id}">Approve</button>` : ''}
                </td>
              </tr>
            `).join('') || '<tr><td colspan="6">No users</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>


    <div class="card" style="margin-bottom:16px">
      <div class="card-header"><span class="card-title">Permission matrix</span>
        <button class="btn btn-sm btn-ghost" id="btnSaveMatrix">Save matrix changes</button>
      </div>
      <div class="card-body table-wrap" style="overflow-x:auto">
        <table id="permMatrixTable">
          <thead>
            <tr>
              <th style="position:sticky;left:0;background:#fff;z-index:1">User</th>
              <th>Role</th>
              ${(CredlockAuth.ALL_PERMS || []).map(p => `<th style="font-size:10px;writing-mode:vertical-rl;transform:rotate(180deg);max-height:100px;white-space:nowrap">${p}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${users.filter(u => u.status === 'approved' || u.status === 'disabled').map(u => `
              <tr data-matrix-user="${u.id}">
                <td style="position:sticky;left:0;background:#fff;font-weight:600;font-size:12px">${esc(u.name)}</td>
                <td style="font-size:11px">${esc(u.role)}</td>
                ${(CredlockAuth.ALL_PERMS || []).map(p => {
                  const on = (u.permissions || []).indexOf(p) !== -1;
                  const locked = u.role === 'lead' || u.role === 'admin';
                  return `<td style="text-align:center">
                    <input type="checkbox" data-matrix-perm="${p}" ${on || locked ? 'checked' : ''} ${locked ? 'disabled' : ''} />
                  </td>`;
                }).join('')}
              </tr>
            `).join('')}
          </tbody>
        </table>
        <p style="font-size:11px;color:var(--muted);margin-top:8px">Team Lead / Admin rows are locked to full access. Toggle checkboxes for officers, then Save matrix changes.</p>
      </div>
    </div>

    <div class="card">
      <div class="card-header"><span class="card-title">Role presets</span></div>
      <div class="card-body table-wrap">
        <table>
          <thead><tr><th>Role</th><th>Default access</th></tr></thead>
          <tbody>
            <tr><td><strong>Team Lead / Admin</strong></td><td>Full access — all modules, approvals, settings, admin</td></tr>
            <tr><td><strong>Officer</strong></td><td>Dashboard, tickets, Kavro, new ticket, rota, reports, team, templates, My Work</td></tr>
            <tr><td><strong>Viewer</strong></td><td>Read-focused: dashboard, tickets, Kavro, reports, team, My Work</td></tr>
          </tbody>
        </table>
        <p style="font-size:12px;color:var(--muted);margin-top:10px">
          Team Lead sign-in: <code>techsupport.int@gmail.com</code> · PIN set by admin seed.
          Officers register → Approve here or under Approvals → optional fine-tune permissions.
        </p>
      </div>
    </div>
  `;
}

function bindAdmin() {
  const lead = CredlockAuth.currentUser();

  document.getElementById('btnSaveMatrix')?.addEventListener('click', () => {
    let n = 0;
    document.querySelectorAll('[data-matrix-user]').forEach(tr => {
      const id = tr.getAttribute('data-matrix-user');
      const u = CredlockAuth.loadUsers().find(x => x.id === id);
      if (!u || u.role === 'lead' || u.role === 'admin') return;
      const selected = [];
      tr.querySelectorAll('[data-matrix-perm]').forEach(cb => {
        if (cb.checked) selected.push(cb.getAttribute('data-matrix-perm'));
      });
      CredlockAuth.setUserPermissions(id, selected);
      n++;
    });
    toastSuccess('Permission matrix saved (' + n + ' user(s))');
    if (CredlockAuth.applyNavPermissions) CredlockAuth.applyNavPermissions();
    navigate('admin');
  });


  document.getElementById('btnAdminAddUser')?.addEventListener('click', () => {
    const name = prompt('Full name:');
    if (!name) return;
    const email = prompt('Email:');
    if (!email) return;
    const pin = prompt('PIN (4–6 digits):');
    if (!pin) return;
    const role = prompt('Role: officer | viewer | admin | lead', 'officer') || 'officer';
    try {
      CredlockAuth.register({ name, email, pin, role });
      // Auto-approve when admin creates
      const u = CredlockAuth.loadUsers().find(x => x.email === email.trim().toLowerCase());
      if (u) CredlockAuth.approveUser(u.id, lead && lead.name);
      toastSuccess('User created and approved');
      navigate('admin');
    } catch (e) {
      toastError(e.message);
    }
  });

  document.querySelectorAll('[data-admin-edit]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-admin-edit');
      const u = CredlockAuth.loadUsers().find(x => x.id === id);
      if (!u) return;
      const name = prompt('Name', u.name);
      if (name == null) return;
      const role = prompt('Role: officer | viewer | admin | lead', u.role);
      if (role == null) return;
      const pin = prompt('New PIN (leave blank to keep)', '');
      try {
        const patch = { name, role };
        if (pin) patch.pin = pin;
        CredlockAuth.updateUser(id, patch);
        toastSuccess('User updated');
        navigate('admin');
      } catch (e) {
        toastError(e.message);
      }
    });
  });

  document.querySelectorAll('[data-admin-perms]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-admin-perms');
      const u = CredlockAuth.loadUsers().find(x => x.id === id);
      if (!u) return;
      openAdminPermsModal(u);
    });
  });

  document.querySelectorAll('[data-admin-disable]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-admin-disable');
      if (!confirm('Disable this account?')) return;
      CredlockAuth.updateUser(id, { status: 'disabled' });
      toastWarn('User disabled');
      navigate('admin');
    });
  });

  document.querySelectorAll('[data-admin-enable]').forEach(btn => {
    btn.addEventListener('click', () => {
      CredlockAuth.updateUser(btn.getAttribute('data-admin-enable'), { status: 'approved' });
      toastSuccess('User enabled');
      navigate('admin');
    });
  });

  document.querySelectorAll('[data-admin-approve]').forEach(btn => {
    btn.addEventListener('click', () => {
      CredlockAuth.approveUser(btn.getAttribute('data-admin-approve'), lead && lead.name);
      toastSuccess('User approved');
      navigate('admin');
    });
  });
}

function openAdminPermsModal(user) {
  const all = CredlockAuth.ALL_PERMS || [];
  const current = new Set(user.permissions || []);
  const body = `
    <p style="margin:0 0 12px;font-size:13px">Permissions for <strong>${esc(user.name)}</strong> (${esc(user.email)})</p>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px 12px;max-height:320px;overflow:auto">
      ${all.map(p => `
        <label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer">
          <input type="checkbox" data-perm="${p}" ${current.has(p) ? 'checked' : ''} />
          ${p}
        </label>
      `).join('')}
    </div>
    <div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap">
      <button type="button" class="btn btn-sm btn-ghost" id="permPresetLead">Preset: Lead</button>
      <button type="button" class="btn btn-sm btn-ghost" id="permPresetOfficer">Preset: Officer</button>
      <button type="button" class="btn btn-sm btn-ghost" id="permPresetViewer">Preset: Viewer</button>
    </div>
  `;
  const footer = `
    <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
    <button class="btn btn-primary" id="permSaveBtn">Save permissions</button>
  `;
  if (typeof openModal === 'function') {
    openModal('Edit permissions', body, footer);
  } else {
    alert('Modal not available');
    return;
  }

  const applyPreset = (role) => {
    const preset = (CredlockAuth.ROLE_PRESETS && CredlockAuth.ROLE_PRESETS[role]) || [];
    document.querySelectorAll('[data-perm]').forEach(cb => {
      cb.checked = preset.indexOf(cb.getAttribute('data-perm')) !== -1;
    });
  };
  document.getElementById('permPresetLead')?.addEventListener('click', () => applyPreset('lead'));
  document.getElementById('permPresetOfficer')?.addEventListener('click', () => applyPreset('officer'));
  document.getElementById('permPresetViewer')?.addEventListener('click', () => applyPreset('viewer'));
  document.getElementById('permSaveBtn')?.addEventListener('click', () => {
    const selected = [];
    document.querySelectorAll('[data-perm]').forEach(cb => {
      if (cb.checked) selected.push(cb.getAttribute('data-perm'));
    });
    CredlockAuth.setUserPermissions(user.id, selected);
    closeModal();
    toastSuccess('Permissions saved');
    navigate('admin');
  });
}


function renderSettings() {
  const apiUrl = (window.TSApi && TSApi.getApiUrl()) || (window.PORTAL_CONFIG && PORTAL_CONFIG.API_URL) || '';
  const sheetUrl = (window.TSApi && TSApi.getSheetUrl()) || (window.PORTAL_CONFIG && PORTAL_CONFIG.SHEET_URL) || '';
  const mode = (window.TSApi && TSApi.getMode()) || 'local';

  return `
    <div class="settings-hero">
      <h2>Google Sheets database</h2>
      <p>Tickets, rota, config and notification log live in a shared Google Sheet.
         Deploy the Apps Script (Code.gs) as a Web App, then paste the URL below to go live for the whole team.</p>
      ${sheetUrl ? `<a class="sheet-link" href="${sheetUrl}" target="_blank" rel="noopener">Open Credlock TS Database ↗</a>` : ''}
    </div>

    <div class="grid grid-2" style="margin-bottom:18px">
      <div class="card">
        <div class="card-header"><span class="card-title">Backend connection</span></div>
        <div class="card-body">
          <div class="form-group" style="margin-bottom:12px">
            <label>Mode</label>
            <div style="font-weight:700;color:var(--navy)">${mode === 'sheets' ? '● Connected to Google Sheets' : '○ Local browser storage'}</div>
          </div>
          <div class="form-group" style="margin-bottom:12px">
            <label>Apps Script Web App URL</label>
            <input type="url" id="apiUrlInput" value="${esc(apiUrl)}" placeholder="https://script.google.com/macros/s/.../exec" style="width:100%;padding:9px 12px;border:1px solid var(--border);border-radius:8px" />
          </div>
          <div style="display:flex;gap:10px;flex-wrap:wrap">
            <button class="btn btn-primary" id="saveApiBtn">Save &amp; connect</button>
            <button class="btn btn-ghost" id="pingApiBtn">Test connection</button>
            <button class="btn btn-ghost" id="syncNowBtn">↻ Sync now</button>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-header"><span class="card-title">Setup checklist</span></div>
        <div class="card-body" style="font-size:13px;line-height:1.7;color:var(--muted)">
          <ol style="padding-left:18px">
            <li>Open the <strong>Credlock TS Database</strong> Google Sheet (link above).</li>
            <li><strong>Extensions → Apps Script</strong></li>
            <li>Delete any default code, paste the contents of <code>Code.gs</code>, Save.</li>
            <li><strong>Deploy → New deployment → Web app</strong><br>
                Execute as: <em>Me</em><br>
                Who has access: <em>Anyone</em> (or your Google Workspace domain)</li>
            <li>Copy the Web App URL and paste it in the field on the left.</li>
            <li>Click <strong>Save &amp; connect</strong>, then <strong>Sync now</strong>.</li>
          </ol>
          <p style="margin-top:10px">Until the Web App is deployed, the portal works fully in <strong>local mode</strong> (data stays in this browser).</p>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-header"><span class="card-title">Sheet structure</span></div>
      <div class="card-body table-wrap">
        <table>
          <thead><tr><th>Sheet</th><th>Purpose</th></tr></thead>
          <tbody>
            <tr><td><strong>Tickets</strong></td><td>Master ticket log (system of record)</td></tr>
            <tr><td><strong>Config</strong></td><td>Emails, notification rules, portal settings</td></tr>
            <tr><td><strong>Rota</strong></td><td>Phone coverage by day</td></tr>
            <tr><td><strong>NotifyLog</strong></td><td>Email notification audit trail</td></tr>
            <tr><td><strong>Officers</strong></td><td>Team roles and emails</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function bindSettings() {
  const snd = document.getElementById('soundAlertsToggle');
  if (snd) {
    snd.checked = soundEnabled();
    snd.onchange = () => {
      setSoundEnabled(snd.checked);
      toastSuccess(snd.checked ? 'Sound alerts enabled' : 'Sound alerts muted');
    };
  }
  document.getElementById('btnTestSound')?.addEventListener('click', () => {
    playSound('ticket');
    toastTicket('This is how a new ticket alert sounds', 'Test');
  });
  document.getElementById('btnTestSuccess')?.addEventListener('click', () => {
    toastSuccess('Action completed successfully');
  });
  document.getElementById('btnRunReminders')?.addEventListener('click', () => {
    runAlertReminders();
    toast('Reminder scan complete', 'info');
  });
  document.getElementById('saveApiBtn')?.addEventListener('click', async () => {
    const url = document.getElementById('apiUrlInput')?.value?.trim() || '';
    if (window.TSApi) TSApi.setApiUrl(url);
    if (window.PORTAL_CONFIG) PORTAL_CONFIG.API_URL = url;
    toast('URL saved – testing…', 'info');
    await syncFromSheets();
  });
  document.getElementById('pingApiBtn')?.addEventListener('click', async () => {
    if (!window.TSApi) return;
    const r = await TSApi.ping();
    if (r.ok) toastSuccess('Connection OK – Google Sheets live', 'Backend'); else toastError('Cannot reach Web App: ' + (r.error || 'check URL'), 'Backend');
  });
  document.getElementById('syncNowBtn')?.addEventListener('click', () => syncFromSheets());
}


// ── Export ───────────────────────────────────────────────────────────

// ── Officer activity reports (Excel / PDF / Word) ────────────────────
function officerActivityReport(name) {
  const a = activityForUser(name);
  const all = a.mine.slice().sort((x, y) => String(y.date || '').localeCompare(String(x.date || '')));
  const byStatus = {};
  const byPriority = {};
  all.forEach(t => {
    byStatus[t.status] = (byStatus[t.status] || 0) + 1;
    byPriority[t.priority] = (byPriority[t.priority] || 0) + 1;
  });
  return {
    name,
    generatedAt: new Date().toISOString(),
    total: all.length,
    open: a.open.length,
    resolved: a.resolved.length,
    p1: a.p1.length,
    byStatus,
    byPriority,
    tickets: all
  };
}

function downloadBlob(filename, mime, content) {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function exportOfficerExcel(name) {
  const r = officerActivityReport(name);
  const lines = [];
  lines.push('Credlock Tech Support – Officer Activity Report');
  lines.push('Officer,' + csvEsc(r.name));
  lines.push('Generated,' + csvEsc(r.generatedAt));
  lines.push('Total tickets,' + r.total);
  lines.push('Open,' + r.open);
  lines.push('Resolved,' + r.resolved);
  lines.push('P1 open,' + r.p1);
  lines.push('');
  lines.push('Ticket ID,Date,Time,Requester,Category,Priority,Status,Owner,Next Action,Description');
  r.tickets.forEach(t => {
    lines.push([
      t.id, t.date, t.timeIn || t.time || '', t.requester, t.category,
      t.priority, t.status, t.owner, t.nextAction, t.description
    ].map(csvEsc).join(','));
  });
  const stamp = todayStr().replace(/-/g, '');
  downloadBlob(
    'Credlock_Officer_' + safeFileName(name) + '_' + stamp + '.csv',
    'text/csv;charset=utf-8',
    '\uFEFF' + lines.join('\n')
  );
  toastSuccess('Excel/CSV report downloaded for ' + name);
}

function csvEsc(v) {
  const s = v == null ? '' : String(v);
  if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

function safeFileName(n) {
  return String(n || 'officer').replace(/[^a-zA-Z0-9_-]+/g, '_').slice(0, 40);
}

function officerReportHtml(name, forPrint) {
  const r = officerActivityReport(name);
  const rows = r.tickets.map(t => `
    <tr>
      <td>${esc(t.id)}</td>
      <td>${esc(t.date)}</td>
      <td>${esc(t.requester)}</td>
      <td>${esc(t.priority)}</td>
      <td>${esc(t.status)}</td>
      <td>${esc(t.nextAction || '')}</td>
    </tr>`).join('');
  return `<!DOCTYPE html><html><head><meta charset="utf-8">
    <title>Officer Report – ${esc(name)}</title>
    <style>
      body{font-family:Inter,Arial,sans-serif;color:#060527;margin:32px;font-size:13px}
      h1{font-size:20px;margin:0 0 4px;color:#3B5BDB}
      h2{font-size:14px;margin:20px 0 8px}
      .meta{color:#5B6478;margin-bottom:16px}
      .kpis{display:flex;gap:12px;flex-wrap:wrap;margin:12px 0 20px}
      .kpi{border:1px solid #E2E8F5;border-radius:8px;padding:10px 14px;min-width:90px}
      .kpi b{display:block;font-size:18px;color:#060527}
      table{width:100%;border-collapse:collapse}
      th,td{border:1px solid #E2E8F5;padding:6px 8px;text-align:left}
      th{background:#060527;color:#fff}
      ${forPrint ? '@media print{body{margin:12px}}' : ''}
    </style></head><body>
    <h1>Credlock Tech Support</h1>
    <div class="meta">Officer activity report · ${esc(name)} · Generated ${esc(r.generatedAt.slice(0, 19).replace('T', ' '))}</div>
    <div class="kpis">
      <div class="kpi"><span>Total</span><b>${r.total}</b></div>
      <div class="kpi"><span>Open</span><b>${r.open}</b></div>
      <div class="kpi"><span>Resolved</span><b>${r.resolved}</b></div>
      <div class="kpi"><span>P1 open</span><b>${r.p1}</b></div>
    </div>
    <h2>Tickets</h2>
    <table>
      <thead><tr><th>ID</th><th>Date</th><th>Requester</th><th>Priority</th><th>Status</th><th>Next action</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="6">No tickets</td></tr>'}</tbody>
    </table>
    <p class="meta" style="margin-top:24px">Credlock Africa · Confidential · Internal use only</p>
    </body></html>`;
}

function exportOfficerWord(name) {
  const html = officerReportHtml(name, false);
  const stamp = todayStr().replace(/-/g, '');
  downloadBlob(
    'Credlock_Officer_' + safeFileName(name) + '_' + stamp + '.doc',
    'application/msword',
    html
  );
  toastSuccess('Word report downloaded for ' + name);
}

function exportOfficerPdf(name) {
  const html = officerReportHtml(name, true);
  const w = window.open('', '_blank', 'width=900,height=700');
  if (!w) {
    toastError('Allow pop-ups to generate PDF');
    return;
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
  setTimeout(() => {
    w.focus();
    w.print();
  }, 400);
  toastSuccess('PDF print dialog opened for ' + name + ' — choose Save as PDF');
}

function exportAllOfficersExcel() {
  const officers = OFFICERS.filter(n => n !== 'Joseph Olayemi').concat(['Joseph Olayemi']);
  const lines = ['Officer,Total,Open,Resolved,P1 open'];
  officers.forEach(name => {
    const r = officerActivityReport(name);
    lines.push([name, r.total, r.open, r.resolved, r.p1].map(csvEsc).join(','));
  });
  lines.push('');
  lines.push('Ticket ID,Officer,Date,Requester,Priority,Status,Category,Next Action');
  tickets.forEach(t => {
    lines.push([
      t.id, t.owner, t.date, t.requester, t.priority, t.status, t.category, t.nextAction
    ].map(csvEsc).join(','));
  });
  downloadBlob('Credlock_All_Officers_' + todayStr().replace(/-/g, '') + '.csv', 'text/csv;charset=utf-8', '\uFEFF' + lines.join('\n'));
  toastSuccess('Team activity Excel/CSV downloaded');
}

function renderOfficerReports() {
  const u = window.CredlockAuth && CredlockAuth.currentUser();
  const canAll = window.CredlockAuth && CredlockAuth.can && (CredlockAuth.can('weekly') || CredlockAuth.can('admin') || CredlockAuth.isLead());
  const names = canAll
    ? (typeof OFFICERS !== 'undefined' ? OFFICERS.slice() : ['Tosin', 'Peter', 'Zainab', 'Joseph Olayemi'])
    : (u ? [u.name] : []);

  const cards = names.map(name => {
    const r = officerActivityReport(name);
    return `
      <div class="officer-card">
        <div class="officer-card-head">
          <div class="officer-card-av">${esc(name.charAt(0))}</div>
          <div>
            <div class="officer-card-name">${esc(name)}</div>
            <div class="officer-card-role">Activity report</div>
          </div>
        </div>
        <div class="officer-stats">
          <div class="officer-stat"><div class="officer-stat-val">${r.total}</div><div class="officer-stat-lbl">Total</div></div>
          <div class="officer-stat"><div class="officer-stat-val">${r.open}</div><div class="officer-stat-lbl">Open</div></div>
          <div class="officer-stat"><div class="officer-stat-val">${r.resolved}</div><div class="officer-stat-lbl">Done</div></div>
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:4px">
          <button class="btn btn-sm btn-primary" data-rpt-xlsx="${esc(name)}">Excel</button>
          <button class="btn btn-sm btn-ghost" data-rpt-pdf="${esc(name)}">PDF</button>
          <button class="btn btn-sm btn-ghost" data-rpt-doc="${esc(name)}">Word</button>
        </div>
      </div>`;
  }).join('');

  return `
    <div class="principle">
      <strong>Officer activity reports</strong> — download per-officer performance as Excel (CSV), PDF, or Word.
    </div>
    ${canAll ? `<div style="margin-bottom:14px">
      <button class="btn btn-primary" id="btnExportAllOfficers">Download all officers (Excel)</button>
    </div>` : ''}
    <div class="grid grid-3">${cards || '<div class="empty">No officers</div>'}</div>
  `;
}

function bindOfficerReports() {
  document.querySelectorAll('[data-rpt-xlsx]').forEach(btn => {
    btn.addEventListener('click', () => exportOfficerExcel(btn.getAttribute('data-rpt-xlsx')));
  });
  document.querySelectorAll('[data-rpt-pdf]').forEach(btn => {
    btn.addEventListener('click', () => exportOfficerPdf(btn.getAttribute('data-rpt-pdf')));
  });
  document.querySelectorAll('[data-rpt-doc]').forEach(btn => {
    btn.addEventListener('click', () => exportOfficerWord(btn.getAttribute('data-rpt-doc')));
  });
  document.getElementById('btnExportAllOfficers')?.addEventListener('click', exportAllOfficersExcel);
}


function exportData() {
  const blob = new Blob([JSON.stringify(tickets, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `credlock_tickets_${todayStr()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  toastSuccess('Tickets exported');
}

// ── Utils ────────────────────────────────────────────────────────────
function esc(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Expose for inline handlers
window.viewTicket = viewTicket;
window.editTicket = editTicket;
window.quickResolve = quickResolve;
window.copyText = copyText;
window.closeModal = closeModal;
window.notifyTicket = notifyTicket;
window.confirmNotify = confirmNotify;
window.viewKavro = viewKavro;
window.addKavroNote = addKavroNote;
window.kavroAction = kavroAction;
window.completeFollowUp = completeFollowUp;

// ── Boot ─────────────────────────────────────────────────────────────
document.getElementById('syncBtn')?.addEventListener('click', () => syncFromSheets());

window.afterAuthLogin = function (user) {
  updateNavBadge();
  if (typeof updateKavroBadge === 'function') updateKavroBadge();
  if (window.CredlockAuth) {
    CredlockAuth.updateUserBar();
    if (CredlockAuth.applyNavPermissions) CredlockAuth.applyNavPermissions();
  }
  const u = user || (CredlockAuth && CredlockAuth.currentUser());
  if (u && (u.role === 'lead' || u.role === 'admin')) currentView = 'lead-dash';
  else currentView = 'my-work';
  render();
  setTimeout(runAlertReminders, 600);
  _ticketCountSnapshot = null;
  watchIncomingTickets();
};

setInterval(() => { if (window.CredlockAuth && CredlockAuth.currentUser()) runAlertReminders(); }, 5 * 60 * 1000);

(async function boot() {
  async function startApp() {
    updateNavBadge();
    if (typeof updateKavroBadge === 'function') updateKavroBadge();
    if (window.CredlockAuth) CredlockAuth.updateUserBar();
    render();
    setTimeout(runAlertReminders, 800);
    _ticketCountSnapshot = null;
    watchIncomingTickets();
    if (window.TSApi) {
      try {
        const r = await TSApi.ping();
        if (r.ok) {
          const remote = await TSApi.listTickets();
          if (remote && remote.length) {
            tickets = remote;
            saveTickets();
            updateNavBadge();
            render();
          }
        }
      } catch (e) { console.warn(e); }
    }
  }

  if (window.CredlockAuth) {
    await CredlockAuth.bootAuth();
    const cu = CredlockAuth.currentUser();
    if (cu) {
      if (cu.role === 'lead') currentView = 'lead-dash';
      else currentView = 'my-work';
      await startApp();
    }
    // else stay on login screen
  } else {
    await startApp();
  }
})();
