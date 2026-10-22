/* Theme (mode + colour). Runs before the page paints so there is no flash. */
(function () {
  var ACCENTS = {
    purple:  { n: 'বেগুনি', a: '#6d28d9', b: '#db2777', c: '#f59e0b' },
    ocean:   { n: 'নীল',    a: '#1d4ed8', b: '#0891b2', c: '#14b8a6' },
    emerald: { n: 'সবুজ',   a: '#047857', b: '#10b981', c: '#84cc16' },
    rose:    { n: 'গোলাপি', a: '#be123c', b: '#f43f5e', c: '#fb923c' },
    slate:   { n: 'ধূসর',   a: '#334155', b: '#64748b', c: '#94a3b8' }
  };
  var SIZES = { s: 0.92, m: 1, l: 1.12 };
  function get(k) { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } }
  function put(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function apply() {
    var r = document.documentElement, m = get('ggg_theme');
    if (m === 'light' || m === 'dark') r.setAttribute('data-theme', m); else r.removeAttribute('data-theme');
    var a = ACCENTS[get('ggg_accent')] || ACCENTS.purple, s = r.style;
    s.setProperty('--brand', a.a); s.setProperty('--brand-2', a.b); s.setProperty('--accent', a.c);
    s.setProperty('--grad', 'linear-gradient(135deg,' + a.a + ' 0%,' + a.b + ' 62%,' + a.c + ' 100%)');
    var z = SIZES[get('ggg_fs')] || 1;
    if (z === 1) s.removeProperty('zoom'); else s.setProperty('zoom', z);
    var meta = document.querySelector('meta[name=theme-color]');
    if (meta) meta.setAttribute('content', a.a);
  }
  window.GGG_THEME = {
    accents: ACCENTS,
    mode: function () { var m = get('ggg_theme'); return m === 'light' || m === 'dark' ? m : 'auto'; },
    accent: function () { var k = get('ggg_accent'); return ACCENTS[k] ? k : 'purple'; },
    setMode: function (m) { put('ggg_theme', m === 'auto' ? '' : m); apply(); },
    setAccent: function (k) { put('ggg_accent', k); apply(); },
    size: function () { var k = get('ggg_fs'); return SIZES[k] ? k : 'm'; },
    setSize: function (k) { put('ggg_fs', k); apply(); },
    apply: apply
  };
  apply();
  document.addEventListener('DOMContentLoaded', apply);
})();
