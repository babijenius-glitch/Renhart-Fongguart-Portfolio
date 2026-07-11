/* ════════════════════════════════════════════════════════
   works-theme.js — PAPER / BLUEPRINT theme for works detail pages
   Default = paper (light); honours the saved choice; syncs with the
   main page via the shared localStorage key 'plotmode'.
   Loaded in <head> (no defer) so the boot runs before first paint.
   ════════════════════════════════════════════════════════ */
(function () {
  var root = document.documentElement;
  root.classList.add('js');   /* enables blur-up fade; no-JS falls back to sharp */

  /* ── Boot: set the theme before the page paints ── */
  var saved = null;
  try { saved = localStorage.getItem('plotmode'); } catch (e) {}
  root.setAttribute('data-theme', saved === 'dark' ? 'dark' : 'light');

  /* ── Blur-up (LQIP): mark each wrapper "loaded" when its image finishes ── */
  function initLqip() {
    document.querySelectorAll('.lqip>img').forEach(function (img) {
      function done() { if (img.parentElement) img.parentElement.classList.add('loaded'); }
      if (img.complete && img.naturalWidth > 0) { done(); }
      else { img.addEventListener('load', done); img.addEventListener('error', done); }
    });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initLqip);
  } else { initLqip(); }

  /* ── Build + wire the toggle once the nav exists ── */
  function build() {
    var nav = document.querySelector('.work-nav-inner');
    if (!nav) return;

    var btn = document.getElementById('plotToggle');
    if (!btn) {
      btn = document.createElement('button');
      btn.id = 'plotToggle';
      btn.type = 'button';
      btn.className = 'plot-toggle';
      btn.setAttribute('aria-label', 'Toggle paper or blueprint mode');
      btn.innerHTML =
        '<span class="pt-opt pt-paper">PAPER</span>' +
        '<span class="pt-sep">/</span>' +
        '<span class="pt-opt pt-blue">BLUEPRINT</span>';
      nav.appendChild(btn);
    }

    /* guard against double-wiring using a NON-serialized property
       (never a data-* attribute — admin save would bake it in) */
    if (btn.__themeWired) return;
    btn.__themeWired = true;

    var paper = btn.querySelector('.pt-paper');
    var blue = btn.querySelector('.pt-blue');
    function paint(mode) {
      var isDark = mode === 'dark';
      if (paper) paper.classList.toggle('on', !isDark);
      if (blue) blue.classList.toggle('on', isDark);
    }
    paint(root.getAttribute('data-theme') || 'light');

    btn.addEventListener('click', function () {
      var cur = root.getAttribute('data-theme') || 'light';
      var mode = cur === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', mode);
      try { localStorage.setItem('plotmode', mode); } catch (e) {}
      paint(mode);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', build);
  } else {
    build();
  }
})();
