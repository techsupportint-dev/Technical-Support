/**
 * Tickets sync – non-destructive (OfflineDB is source of truth)
 */
(function () {
  'use strict';
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
