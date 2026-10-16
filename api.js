/**
 * API layer – Google Apps Script Web App ↔ portal
 */
(function (global) {
  const URL_KEY = 'credlock_ts_api_url';

  function getApiUrl() {
    try {
      const saved = localStorage.getItem(URL_KEY);
      if (saved) return saved;
    } catch (e) {}
    return (global.PORTAL_CONFIG && PORTAL_CONFIG.API_URL) || '';
  }

  function setApiUrl(url) {
    try { localStorage.setItem(URL_KEY, url || ''); } catch (e) {}
  }

  function getSheetUrl() {
    return (global.PORTAL_CONFIG && PORTAL_CONFIG.SHEET_URL) || '';
  }

  function getMode() {
    return getApiUrl() ? 'sheets' : 'local';
  }

  async function request(action, payload) {
    const base = getApiUrl();
    if (!base) return { ok: false, error: 'No API URL – set in Settings' };
    try {
      if (payload !== undefined && payload !== null) {
        const res = await fetch(base, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify(Object.assign({ action: action }, payload || {}))
        });
        const text = await res.text();
        try { return JSON.parse(text); } catch (e) {
          return { ok: false, error: 'API returned non-JSON (redeploy Apps Script as Web App → Anyone)', raw: text.slice(0, 120) };
        }
      }
      const url = base + (base.indexOf('?') >= 0 ? '&' : '?') + 'action=' + encodeURIComponent(action);
      const res = await fetch(url, { method: 'GET' });
      const text = await res.text();
      try { return JSON.parse(text); } catch (e) {
        return { ok: false, error: 'API returned non-JSON (redeploy Apps Script)', raw: text.slice(0, 120) };
      }
    } catch (err) {
      return { ok: false, error: String(err.message || err) };
    }
  }

  async function ping() { return request('ping'); }
  async function listTickets() {
    const r = await request('listTickets');
    if (r && r.tickets) return r.tickets;
    if (Array.isArray(r)) return r;
    return [];
  }
  async function upsertTicket(ticket) { return request('upsertTicket', { ticket: ticket }); }
  async function bulkTickets(tickets) { return request('bulkTickets', { tickets: tickets }); }
  async function listUsers() {
    const r = await request('listUsers');
    return (r && r.users) ? r.users : [];
  }
  async function registerUser(data) { return request('registerUser', data); }
  async function approveUser(userId, by) { return request('approveUser', { userId: userId, by: by }); }
  async function rejectUser(userId, by) { return request('rejectUser', { userId: userId, by: by }); }
  async function listKavro() {
    const r = await request('listKavro');
    return (r && r.devices) ? r.devices : [];
  }
  async function bulkKavro(rows) { return request('bulkKavro', { rows: rows }); }
  async function sync() { return request('sync'); }
  async function setup() { return request('setup'); }

  global.TSApi = {
    getApiUrl, setApiUrl, getSheetUrl, getMode, request, ping,
    listTickets, upsertTicket, bulkTickets, listUsers, registerUser,
    approveUser, rejectUser, listKavro, bulkKavro, sync, setup
  };
})(window);
