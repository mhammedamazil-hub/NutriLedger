// Applies the saved theme before first paint to avoid a flash of the wrong
// theme. Kept as an external file so the Content-Security-Policy can forbid
// inline scripts. Mirrors src/app/theme.ts.
(function () {
  var theme = 'system';
  try {
    var raw = localStorage.getItem('nutriledger.preferences.v1');
    if (raw) {
      var parsed = JSON.parse(raw);
      if (parsed && (parsed.theme === 'light' || parsed.theme === 'dark' || parsed.theme === 'system')) theme = parsed.theme;
    }
  } catch (e) {
    /* storage blocked: fall back to system */
  }
  var dark = theme === 'dark' || (theme === 'system' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  var meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', dark ? '#101612' : '#245B43');
})();
