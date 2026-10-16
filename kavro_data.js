/** Clears stale Kavro cache so full sheet seed loads */
try {
  localStorage.removeItem('credlock_kavro_v1');
  var v2 = localStorage.getItem('credlock_kavro_v2');
  if (v2) {
    try {
      var arr = JSON.parse(v2);
      if (!arr || arr.length < 100) localStorage.removeItem('credlock_kavro_v2');
    } catch (e) { localStorage.removeItem('credlock_kavro_v2'); }
  }
} catch (e) {}
window.KAVRO_DATA = window.KAVRO_DATA || [];
