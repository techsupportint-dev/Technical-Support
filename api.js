/**
 * API layer for Credlock Tech Support Portal
 * Syncs tickets with Google Apps Script Web App when configured.
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
    if (!base) return { ok: false, error: 'No API URL' };
    const url = base + (base.indexOf('?') >= 0 ? '&' : '?') + 'action=' + encodeURIComponent(action);
    try {
      if (payload) {
        const res = await fetch(base, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify(Object.assign({ action: action }, payload || {}))
        });
        const text = await res.text();
        try { return JSON.parse(text); } catch (e) { return { ok: false, error: 'Invalid JSON', raw: text.slice(0, 200) }; }
      }
      const res = await fetch(url, { method: 'GET' });
      const text = await res.text();
      try { return JSON.parse(text); } catch (e) { return { ok: false, error: 'Invalid JSON', raw: text.slice(0, 200) }; }
    } catch (err) {
      return { ok: false, error: String(err.message || err) };
    }
  }

  async function ping() {
    return request('ping');
  }

  async function listTickets() {
    const r = await request('listTickets');
    if (r && r.tickets) return r.tickets;
    if (Array.isArray(r)) return r;
    return [];
  }

  async function sync() {
    return request('sync');
  }

  global.TSApi = {
    getApiUrl: getApiUrl,
    setApiUrl: setApiUrl,
    getSheetUrl: getSheetUrl,
    getMode: getMode,
    ping: ping,
    listTickets: listTickets,
    sync: sync,
    request: request
  };
})(window);
