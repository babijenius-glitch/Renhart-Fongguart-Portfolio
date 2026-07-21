/* ════════════════════════════════════════════════════════
   analytics.js — privacy-friendly visit tracking (GoatCounter)
   Logs page + timestamp only. No cookies, no consent banner.
   Dashboard is private (owner-login only) — set in GoatCounter.

   Guarded to localhost so that:
     (a) local editing sessions are never counted, and
     (b) no <script> is injected into the DOM on localhost, so the
         admin save-to-HTML flow can never bake this into the files.
   ════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (['localhost', '127.0.0.1', ''].includes(location.hostname)) return;

  var s = document.createElement('script');
  s.async = true;
  s.src = '//gc.zgo.at/count.js';
  s.setAttribute('data-goatcounter',
    'https://babijenius.goatcounter.com/count');
  document.head.appendChild(s);
})();
