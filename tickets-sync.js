/**
 * Clear any cached tickets on first load; keep Kavro untouched.
 */
(function () {
  'use strict';
  var KEY = 'credlock_ts_tickets_v1';
  var FLAG = 'credlock_tickets_cleared_ghpages_v1';
  try {
    if (localStorage.getItem(FLAG) !== '1') {
      localStorage.setItem(KEY, '[]');
      localStorage.setItem(FLAG, '1');
    }
  } catch (e) {}
  document.addEventListener('click', function (e) {
    var t = e.target;
    if (!t) return;
    if (t.id === 'syncBtn' || t.id === 'syncNowBtn') {
      if (typeof window.__credlockLiveSync === 'function') {
        e.preventDefault();
        e.stopPropagation();
        window.__credlockLiveSync();
      }
    }
  }, true);
})();
