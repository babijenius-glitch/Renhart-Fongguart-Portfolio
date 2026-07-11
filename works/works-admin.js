/* ════════════════════════════════════════════════════════
   WORKS DETAIL — works-admin.js  v3
   Press "1" to toggle admin mode (no prompt() — uses modal)
   Inline editing for all content: text, images, captions
   Persists per-page in localStorage keyed to URL path
   ════════════════════════════════════════════════════════ */

'use strict';

(function () {

  const PASSWORD = 'renhart2025';
  const PAGE_KEY = 'wa_' + location.pathname.replace(/[^\w]/g, '_');

  let active   = false;
  let saved    = load();
  let editEls  = [];
  let imgEls   = [];

  /* ── Assign stable numeric IDs once, on script load ── */
  let idCount = 0;
  const EDIT_SEL = [
    '.work-eyebrow span:not(.line)',
    'h1.work-title',
    '.work-subtitle',
    '.work-tags .tag',
    '.meta-value',
    '.work-body h2',
    '.work-body p',
    '.work-body li',
    '.award-text',
    '.tool-item',
    '.detail-val',
    '.photo-cap',
    '.footer-copy',
  ].join(',');

  function assignIds() {
    var all = document.querySelectorAll(EDIT_SEL + ',img');
    all.forEach(function (el) {
      if (!el.dataset.wid) el.dataset.wid = String(++idCount);
    });
  }

  function applyStored() {
    Object.keys(saved).forEach(function (wid) {
      var ed = saved[wid];
      var el = document.querySelector('[data-wid="' + wid + '"]');
      if (!el) return;
      if (ed.t === 'html') el.innerHTML = ed.v;
      if (ed.t === 'src')  el.src       = ed.v;
    });
  }

  /* Run immediately after DOM is ready (script is deferred) */
  assignIds();
  applyStored();

  /* ── "1" key toggle ── */
  document.addEventListener('keydown', function (e) {
    if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;
    var ae  = document.activeElement;
    var tag = ae ? ae.tagName.toUpperCase() : '';
    /* Don't fire when user is typing in a real input */
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    if (ae && ae.contentEditable === 'true') return;

    if (e.key === '1') {
      e.preventDefault();
      active ? deactivate() : showLogin();
    }
    if (e.key === 'Escape') {
      if (document.getElementById('wa-login-modal')) closeLogin();
      else if (active) deactivate();
    }
  });

  /* ════════ LOGIN MODAL ════════ */
  function showLogin() {
    if (document.getElementById('wa-login-modal')) return;
    injectStyles(); /* inject early so modal looks right */

    var modal = document.createElement('div');
    modal.id = 'wa-login-modal';
    modal.innerHTML = [
      '<div class="wa-back" id="wa-login-back"></div>',
      '<div class="wa-login-box">',
        '<div class="wa-login-icon">',
          '<svg width="22" height="22" fill="none" stroke="#4fc3f7" stroke-width="2" viewBox="0 0 24 24">',
            '<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>',
            '<path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
          '</svg>',
        '</div>',
        '<p class="wa-login-title">Admin Access</p>',
        '<p class="wa-login-sub">Enter password to enable editing</p>',
        '<input id="wa-pwd-input" class="wa-login-input" type="password" placeholder="Password" autocomplete="off"/>',
        '<div id="wa-pwd-err" class="wa-login-err" style="display:none">❌ Wrong password</div>',
        '<button id="wa-pwd-btn" class="wa-login-btn">Unlock</button>',
      '</div>'
    ].join('');

    document.body.appendChild(modal);

    var inp = document.getElementById('wa-pwd-input');
    var btn = document.getElementById('wa-pwd-btn');
    var err = document.getElementById('wa-pwd-err');

    /* Focus input after paint */
    requestAnimationFrame(function () { inp.focus(); });

    btn.addEventListener('click', tryLogin);
    inp.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') tryLogin();
    });
    document.getElementById('wa-login-back').addEventListener('click', closeLogin);

    function tryLogin() {
      if (inp.value === PASSWORD) {
        closeLogin();
        activate();
      } else {
        err.style.display = 'block';
        inp.value = '';
        inp.focus();
        /* shake */
        var box = modal.querySelector('.wa-login-box');
        box.classList.add('wa-shake');
        setTimeout(function () { box.classList.remove('wa-shake'); }, 500);
      }
    }
  }

  function closeLogin() {
    var m = document.getElementById('wa-login-modal');
    if (m) m.remove();
  }

  /* ════════ ACTIVATE / DEACTIVATE ════════ */
  function activate() {
    active = true;
    document.body.classList.add('wa-on');
    buildToolbar();
    enableText();
    enableImages();
    toast('✏️ Admin ON — click any text or image to edit', 'info');
  }

  function deactivate() {
    active = false;
    document.body.classList.remove('wa-on');
    var tb = document.getElementById('wa-toolbar');
    if (tb) tb.remove();
    var im = document.getElementById('wa-img-modal');
    if (im) im.remove();
    disableText();
    disableImages();
    toast('Admin mode OFF', 'neutral');
  }

  /* ════════ TOOLBAR ════════ */
  function buildToolbar() {
    if (document.getElementById('wa-toolbar')) return;
    var bar = document.createElement('div');
    bar.id = 'wa-toolbar';
    bar.innerHTML = [
      '<div class="wa-tb-inner">',
        '<span class="wa-badge">',
          '<svg width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">',
            '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>',
            '<path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>',
          '</svg> Admin',
        '</span>',
        '<span class="wa-hint">Click text or images to edit · Esc to exit</span>',
        '<div class="wa-tb-btns">',
          '<button id="wa-btn-save"  class="wa-btn wa-btn-s">💾 Save</button>',
          '<button id="wa-btn-reset" class="wa-btn wa-btn-r">🗑 Reset</button>',
          '<button id="wa-btn-exit"  class="wa-btn wa-btn-x">✕ Exit</button>',
        '</div>',
      '</div>'
    ].join('');
    document.body.appendChild(bar);
    document.getElementById('wa-btn-save').onclick  = doSave;
    document.getElementById('wa-btn-reset').onclick = doReset;
    document.getElementById('wa-btn-exit').onclick  = deactivate;
  }

  /* ════════ TEXT EDITING ════════ */
  function enableText() {
    editEls = Array.from(document.querySelectorAll(EDIT_SEL));
    editEls.forEach(function (el) {
      /* Capture original value before any editing */
      if (!('wOrig' in el.dataset)) el.dataset.wOrig = el.innerHTML;
      el.contentEditable = 'true';
      el.spellcheck = false;
      el.addEventListener('focus',   onFocus);
      el.addEventListener('blur',    onBlur);
      el.addEventListener('keydown', onKey);
    });
  }

  function disableText() {
    editEls.forEach(function (el) {
      el.removeAttribute('contenteditable');
      el.removeEventListener('focus',   onFocus);
      el.removeEventListener('blur',    onBlur);
      el.removeEventListener('keydown', onKey);
    });
    editEls = [];
  }

  function onFocus(e) {
    e.target.classList.add('wa-focus');
  }

  function onBlur(e) {
    var el = e.target;
    el.classList.remove('wa-focus');
    var wid = el.dataset.wid;
    if (!wid) return;
    /* Save if changed from original */
    if (el.innerHTML !== (el.dataset.wOrig || '')) {
      saved[wid] = { t: 'html', v: el.innerHTML };
      toast('✏️ Change noted — hit Save to keep', 'info');
    }
  }

  function onKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      e.target.blur();
    }
    /* Stop "1" key from toggling admin while typing */
    e.stopPropagation();
  }

  /* ════════ IMAGE EDITING ════════ */
  function enableImages() {
    imgEls = Array.from(document.querySelectorAll('img'));
    imgEls.forEach(function (img) {
      img.addEventListener('click', onImgClick);
    });
  }

  function disableImages() {
    imgEls.forEach(function (img) {
      img.removeEventListener('click', onImgClick);
    });
    imgEls = [];
  }

  function onImgClick(e) {
    if (!active) return;
    e.preventDefault();
    e.stopPropagation();
    openImgModal(e.currentTarget);
  }

  function openImgModal(img) {
    var existing = document.getElementById('wa-img-modal');
    if (existing) existing.remove();

    var wid   = img.dataset.wid || '';
    var curSrc = img.src || '';

    var modal = document.createElement('div');
    modal.id = 'wa-img-modal';
    modal.innerHTML = [
      '<div class="wa-back" id="wa-img-back"></div>',
      '<div class="wa-modal">',
        '<div class="wa-mhd">',
          '<span class="wa-mtitle">Replace Image</span>',
          '<button class="wa-mclose" id="wa-mclose">✕</button>',
        '</div>',
        '<div class="wa-mbd">',
          '<p class="wa-mlbl">Current</p>',
          '<img id="wa-prev" class="wa-prev" src="' + esc(curSrc) + '" alt="preview"/>',
          '<p class="wa-mlbl" style="margin-top:14px">Paste image URL</p>',
          '<input id="wa-url-in" class="wa-minput" type="url" placeholder="https://…" value="' + esc(curSrc) + '"/>',
          '<p class="wa-mlbl" style="margin-top:14px">Or upload a file</p>',
          '<label class="wa-mupload">',
            '<svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">',
              '<polyline points="16 16 12 12 8 16"/>',
              '<line x1="12" y1="12" x2="12" y2="21"/>',
              '<path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/>',
            '</svg>',
            '<span>Click to upload</span>',
            '<input type="file" id="wa-file-in" accept="image/*"/>',
          '</label>',
        '</div>',
        '<div class="wa-mft">',
          '<button id="wa-mapply" class="wa-btn wa-btn-s">Apply</button>',
          '<button id="wa-mcancel" class="wa-btn wa-btn-x">Cancel</button>',
        '</div>',
      '</div>'
    ].join('');

    document.body.appendChild(modal);

    var urlIn = document.getElementById('wa-url-in');
    var prev  = document.getElementById('wa-prev');
    var fileIn = document.getElementById('wa-file-in');

    urlIn.addEventListener('input', function () { prev.src = urlIn.value; });

    fileIn.addEventListener('change', function (ev) {
      var file = ev.target.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function (re) {
        prev.src = re.target.result;
        urlIn.value = re.target.result;
      };
      reader.readAsDataURL(file);
    });

    var close = function () { modal.remove(); };

    document.getElementById('wa-mapply').addEventListener('click', function () {
      var newSrc = urlIn.value.trim();
      if (!newSrc) return;
      img.src = newSrc;
      if (wid) saved[wid] = { t: 'src', v: newSrc };
      close();
      toast('🖼 Image updated — hit Save to keep', 'info');
    });

    document.getElementById('wa-mcancel').addEventListener('click', close);
    document.getElementById('wa-mclose').addEventListener('click', close);
    document.getElementById('wa-img-back').addEventListener('click', close);
  }

  /* ════════ PERSISTENCE ════════ */
  function doSave() {
    toast('⏳ Saving permanently...', 'info');
    
    var clone = document.documentElement.cloneNode(true);
    
    /* Remove admin UI */
    var toRemove = [
      '#wa-toolbar', '#wa-login-modal', '#wa-img-modal', 
      '#wa-toasts', '#wa-css'
    ];
    toRemove.forEach(function(sel) {
      var els = clone.querySelectorAll(sel);
      els.forEach(function(e) { e.remove(); });
    });
    
    /* Clean classes & attributes */
    var body = clone.querySelector('body');
    if (body) body.classList.remove('wa-on');
    
    clone.querySelectorAll('[contenteditable]').forEach(function(el) {
      el.removeAttribute('contenteditable');
      el.removeAttribute('spellcheck');
      el.classList.remove('wa-focus');
    });
    
    clone.querySelectorAll('[data-wid]').forEach(function(el) {
      el.removeAttribute('data-wid');
    });
    
    clone.querySelectorAll('[data-wOrig]').forEach(function(el) {
      el.removeAttribute('data-wOrig');
    });
    
    /* Send to server */
    var finalHtml = '<!DOCTYPE html>\n<html lang="en">\n' + clone.innerHTML + '\n</html>';
    
    fetch('/api/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: location.pathname,
        html: finalHtml
      })
    })
    .then(function(res) {
      if (res.ok) {
        saved = {};
        try { localStorage.removeItem(PAGE_KEY); } catch (_) {}
        toast('💾 Saved permanently to file!', 'success');
      } else {
        toast('❌ Failed to save. Is server.py running?', 'error');
      }
    })
    .catch(function(err) {
      toast('❌ Error: ' + err.message, 'error');
    });
  }

  function doReset() {
    if (!confirm('Reset all edits on this page?')) return;
    saved = {};
    try { localStorage.removeItem(PAGE_KEY); } catch (_) {}
    toast('🗑 Cleared — reloading…', 'neutral');
    setTimeout(function () { location.reload(); }, 1000);
  }

  function load() {
    try { return JSON.parse(localStorage.getItem(PAGE_KEY)) || {}; } catch (_) { return {}; }
  }

  /* ════════ HELPERS ════════ */
  function esc(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  /* ════════ TOAST ════════ */
  function toast(msg, type) {
    var c = document.getElementById('wa-toasts');
    if (!c) {
      c = document.createElement('div');
      c.id = 'wa-toasts';
      document.body.appendChild(c);
    }
    var t = document.createElement('div');
    t.className = 'wa-toast wa-t-' + (type || 'info');
    t.textContent = msg;
    c.appendChild(t);
    requestAnimationFrame(function () { t.classList.add('wa-show'); });
    setTimeout(function () {
      t.classList.remove('wa-show');
      t.addEventListener('transitionend', function () { t.remove(); }, { once: true });
    }, 3200);
  }

  /* ════════ ALL STYLES (injected once) ════════ */
  function injectStyles() {
    if (document.getElementById('wa-css')) return;
    var s = document.createElement('style');
    s.id = 'wa-css';
    s.textContent = '\n' +
      /* body */
      'body.wa-on { padding-top: 50px !important; }\n' +

      /* editable text */
      'body.wa-on [contenteditable] {\n' +
      '  outline: 1.5px dashed rgba(79,195,247,.4) !important;\n' +
      '  border-radius: 4px; cursor: text !important;\n' +
      '  transition: outline .15s, background .15s;\n' +
      '}\n' +
      'body.wa-on [contenteditable]:hover {\n' +
      '  outline: 1.5px dashed rgba(79,195,247,.75) !important;\n' +
      '  background: rgba(79,195,247,.05) !important;\n' +
      '}\n' +
      'body.wa-on [contenteditable].wa-focus {\n' +
      '  outline: 2px solid rgba(79,195,247,.95) !important;\n' +
      '  background: rgba(79,195,247,.08) !important;\n' +
      '}\n' +

      /* image hover */
      'body.wa-on img { cursor: pointer !important; }\n' +
      'body.wa-on img:not(.wa-prev):hover {\n' +
      '  outline: 2px dashed rgba(224,123,58,.8) !important;\n' +
      '  outline-offset: 4px;\n' +
      '  filter: brightness(.45) saturate(.35) !important;\n' +
      '}\n' +

      /* toolbar */
      '#wa-toolbar {\n' +
      '  position: fixed; top: 0; left: 0; right: 0; z-index: 99999;\n' +
      '  height: 50px; display: flex; align-items: center;\n' +
      '  background: rgba(8,12,22,.97); backdrop-filter: blur(18px);\n' +
      '  border-bottom: 1px solid rgba(79,195,247,.18);\n' +
      '  box-shadow: 0 2px 16px rgba(0,0,0,.45);\n' +
      '  font-family: Outfit, sans-serif;\n' +
      '}\n' +
      '.wa-tb-inner { display:flex; align-items:center; gap:12px; padding:0 22px; width:100%; }\n' +
      '.wa-badge {\n' +
      '  display:inline-flex; align-items:center; gap:5px;\n' +
      '  background:rgba(79,195,247,.1); border:1px solid rgba(79,195,247,.3);\n' +
      '  color:#4fc3f7; font-size:.72rem; font-weight:600;\n' +
      '  padding:4px 10px; border-radius:999px; white-space:nowrap;\n' +
      '}\n' +
      '.wa-hint { font-size:.71rem; color:rgba(143,175,200,.5); flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }\n' +
      '.wa-tb-btns { display:flex; gap:7px; margin-left:auto; }\n' +
      '.wa-btn {\n' +
      '  font-family:inherit; font-size:.73rem; font-weight:500;\n' +
      '  padding:5px 13px; border-radius:6px; border:1px solid transparent;\n' +
      '  cursor:pointer; transition:all .16s; white-space:nowrap;\n' +
      '}\n' +
      '.wa-btn-s { background:#4fc3f7; color:#080f1e; border-color:#4fc3f7; }\n' +
      '.wa-btn-s:hover { background:#7dd3f8; }\n' +
      '.wa-btn-r { background:transparent; color:#f87171; border-color:rgba(248,113,113,.3); }\n' +
      '.wa-btn-r:hover { background:rgba(248,113,113,.1); }\n' +
      '.wa-btn-x { background:transparent; color:rgba(143,175,200,.7); border-color:rgba(255,255,255,.1); }\n' +
      '.wa-btn-x:hover { color:#edf2f7; border-color:rgba(255,255,255,.22); }\n' +

      /* login modal */
      '#wa-login-modal {\n' +
      '  position:fixed; inset:0; z-index:999999;\n' +
      '  display:flex; align-items:center; justify-content:center;\n' +
      '}\n' +
      '.wa-back {\n' +
      '  position:absolute; inset:0;\n' +
      '  background:rgba(4,8,18,.82); backdrop-filter:blur(8px);\n' +
      '}\n' +
      '.wa-login-box {\n' +
      '  position:relative; z-index:1;\n' +
      '  background:#0d1b30; border:1px solid rgba(79,195,247,.2);\n' +
      '  border-radius:16px; padding:36px 32px; width:min(360px,90vw);\n' +
      '  box-shadow:0 24px 64px rgba(0,0,0,.6);\n' +
      '  font-family:Outfit,sans-serif;\n' +
      '  display:flex; flex-direction:column; align-items:center; gap:10px;\n' +
      '  text-align:center;\n' +
      '}\n' +
      '.wa-login-icon { margin-bottom:4px; }\n' +
      '.wa-login-title { font-size:1.1rem; font-weight:700; color:#edf2f7; margin:0; }\n' +
      '.wa-login-sub { font-size:.82rem; color:#8fafc8; margin:0; }\n' +
      '.wa-login-input {\n' +
      '  width:100%; padding:11px 14px; margin-top:8px;\n' +
      '  font-family:JetBrains Mono,monospace; font-size:.9rem;\n' +
      '  color:#edf2f7; background:#0a1628;\n' +
      '  border:1px solid rgba(79,195,247,.25); border-radius:9px;\n' +
      '  outline:none; transition:border-color .2s;\n' +
      '  text-align:center;\n' +
      '}\n' +
      '.wa-login-input:focus { border-color:#4fc3f7; }\n' +
      '.wa-login-err { font-size:.8rem; color:#f87171; }\n' +
      '.wa-login-btn {\n' +
      '  width:100%; padding:11px; margin-top:4px;\n' +
      '  background:#4fc3f7; color:#080f1e;\n' +
      '  font-family:inherit; font-size:.88rem; font-weight:600;\n' +
      '  border:none; border-radius:9px; cursor:pointer;\n' +
      '  transition:background .18s;\n' +
      '}\n' +
      '.wa-login-btn:hover { background:#7dd3f8; }\n' +
      '@keyframes wa-shake {\n' +
      '  0%,100% { transform:translateX(0); }\n' +
      '  20%,60% { transform:translateX(-8px); }\n' +
      '  40%,80% { transform:translateX(8px); }\n' +
      '}\n' +
      '.wa-shake { animation: wa-shake .45s ease; }\n' +

      /* image modal */
      '#wa-img-modal {\n' +
      '  position:fixed; inset:0; z-index:999998;\n' +
      '  display:flex; align-items:center; justify-content:center;\n' +
      '}\n' +
      '.wa-modal {\n' +
      '  position:relative; z-index:1;\n' +
      '  background:#0d1b30; border:1px solid rgba(79,195,247,.18);\n' +
      '  border-radius:14px; width:min(480px,94vw);\n' +
      '  box-shadow:0 20px 60px rgba(0,0,0,.6);\n' +
      '  font-family:Outfit,sans-serif;\n' +
      '  display:flex; flex-direction:column; max-height:90vh;\n' +
      '}\n' +
      '.wa-mhd {\n' +
      '  display:flex; align-items:center; justify-content:space-between;\n' +
      '  padding:15px 20px 12px; border-bottom:1px solid rgba(79,195,247,.1);\n' +
      '}\n' +
      '.wa-mtitle { font-size:.88rem; font-weight:600; color:#edf2f7; }\n' +
      '.wa-mclose {\n' +
      '  background:none; border:none; color:#3d6080; cursor:pointer;\n' +
      '  padding:4px 8px; border-radius:4px; font-size:.95rem; transition:color .2s;\n' +
      '}\n' +
      '.wa-mclose:hover { color:#edf2f7; }\n' +
      '.wa-mbd {\n' +
      '  padding:14px 20px; overflow-y:auto;\n' +
      '  display:flex; flex-direction:column; gap:8px;\n' +
      '}\n' +
      '.wa-mlbl { font-size:.68rem; font-weight:600; color:#8fafc8; letter-spacing:.05em; text-transform:uppercase; margin:0; }\n' +
      '.wa-prev {\n' +
      '  width:100%; max-height:160px; object-fit:cover;\n' +
      '  border-radius:8px; border:1px solid rgba(79,195,247,.15);\n' +
      '  cursor:default !important;\n' +
      '}\n' +
      'body.wa-on .wa-prev:hover {\n' +
      '  outline:none !important; filter:none !important;\n' +
      '}\n' +
      '.wa-minput {\n' +
      '  font-family:JetBrains Mono,monospace; font-size:.78rem;\n' +
      '  color:#edf2f7; background:#0a1628;\n' +
      '  border:1px solid rgba(79,195,247,.18); border-radius:7px;\n' +
      '  padding:8px 11px; outline:none; width:100%;\n' +
      '  transition:border-color .2s;\n' +
      '}\n' +
      '.wa-minput:focus { border-color:#4fc3f7; }\n' +
      '.wa-mupload {\n' +
      '  display:flex; flex-direction:column; align-items:center;\n' +
      '  justify-content:center; gap:6px; cursor:pointer;\n' +
      '  border:1.5px dashed rgba(79,195,247,.2); border-radius:9px;\n' +
      '  padding:18px; color:#3d6080; font-size:.8rem;\n' +
      '  transition:border-color .2s, background .2s;\n' +
      '}\n' +
      '.wa-mupload:hover { border-color:rgba(79,195,247,.45); background:rgba(79,195,247,.04); color:#8fafc8; }\n' +
      '#wa-file-in { display:none; }\n' +
      '.wa-mft {\n' +
      '  display:flex; gap:8px; padding:14px 20px;\n' +
      '  border-top:1px solid rgba(79,195,247,.08);\n' +
      '}\n' +

      /* toasts */
      '#wa-toasts {\n' +
      '  position:fixed; bottom:20px; right:20px; z-index:999999;\n' +
      '  display:flex; flex-direction:column; gap:7px; pointer-events:none;\n' +
      '}\n' +
      '.wa-toast {\n' +
      '  font-family:Outfit,sans-serif; font-size:.79rem; font-weight:500;\n' +
      '  padding:9px 15px; border-radius:8px;\n' +
      '  backdrop-filter:blur(14px);\n' +
      '  box-shadow:0 4px 18px rgba(0,0,0,.3);\n' +
      '  opacity:0; transform:translateY(6px);\n' +
      '  transition:opacity .22s, transform .22s;\n' +
      '}\n' +
      '.wa-show { opacity:1 !important; transform:translateY(0) !important; }\n' +
      '.wa-t-info    { background:rgba(13,27,48,.95); color:#4fc3f7; border:1px solid rgba(79,195,247,.22); }\n' +
      '.wa-t-success { background:rgba(13,27,48,.95); color:#4ade80; border:1px solid rgba(74,222,128,.22); }\n' +
      '.wa-t-error   { background:rgba(13,27,48,.95); color:#f87171; border:1px solid rgba(248,113,113,.22); }\n' +
      '.wa-t-neutral { background:rgba(13,27,48,.95); color:#8fafc8; border:1px solid rgba(143,175,200,.18); }\n';

    document.head.appendChild(s);
  }

})();
