/* ════════════════════════════════════════════════════════
   PORTFOLIO — admin.js
   Admin mode: press "1" to toggle
   Supports inline text, image, and project card editing
   Changes persisted to localStorage
   ════════════════════════════════════════════════════════ */

'use strict';

(function initAdmin() {

  /* ─── Local-only guard: admin mode never runs on the hosted site ─── */
  if (!['localhost', '127.0.0.1', ''].includes(location.hostname)) return;

  /* ─── Config ─── */
  const STORAGE_KEY = 'portfolio_admin_edits';

  /* ─── State ─── */
  let adminActive  = false;
  let pendingEdits = loadEdits();
  let editableEls  = [];
  let imageEls     = [];
  let projCards    = [];

  /* ─── Apply saved edits on every page load ─── */
  applyStoredEdits();

  /* ─── Key: press "1" to toggle admin ─── */
  document.addEventListener('keydown', e => {
    const tag = document.activeElement?.tagName;
    const isEditing = tag === 'INPUT' || tag === 'TEXTAREA'
      || document.activeElement?.isContentEditable;
    if (e.key === '1' && !isEditing && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      adminActive ? deactivate() : activate();
    }
    if (e.key === 'Escape' && adminActive) deactivate();
  });

  /* ════════════════════════════════════════════════════════
     ACTIVATE / DEACTIVATE
  ════════════════════════════════════════════════════════ */
  function activate() {
    adminActive = true;
    document.body.classList.add('admin-mode');
    injectStyles();
    buildToolbar();
    makeTextsEditable();
    makeImagesClickable();
    makeProjectCardsEditable();
    showToast('✏️ Admin mode ON — click text, images, or project cards to edit', 'info');
  }

  function deactivate() {
    adminActive = false;
    document.body.classList.remove('admin-mode');
    removeToolbar();
    removeEditableTexts();
    removeImageHandlers();
    removeProjectCardHandlers();
    document.getElementById('admin-proj-panel')?.remove();
    document.getElementById('admin-img-panel')?.remove();
    showToast('Admin mode OFF', 'neutral');
  }

  /* ════════════════════════════════════════════════════════
     TOOLBAR
  ════════════════════════════════════════════════════════ */
  function buildToolbar() {
    if (document.getElementById('admin-toolbar')) return;
    const bar = document.createElement('div');
    bar.id = 'admin-toolbar';
    bar.innerHTML = `
      <div class="atb-inner">
        <span class="atb-badge">
          <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          Admin Mode
        </span>
        <span class="atb-hint">Click text, images, or 🗂 project cards to edit · Esc to exit</span>
        <div class="atb-actions">
          <button id="atb-save"  class="atb-btn atb-btn--save">💾 Save</button>
          <button id="atb-reset" class="atb-btn atb-btn--reset">🗑 Reset All</button>
          <button id="atb-exit"  class="atb-btn atb-btn--exit">✕ Exit</button>
        </div>
      </div>`;
    document.body.appendChild(bar);
    document.getElementById('atb-save').addEventListener('click',  saveEdits);
    document.getElementById('atb-reset').addEventListener('click', resetEdits);
    document.getElementById('atb-exit').addEventListener('click',  deactivate);
  }

  function removeToolbar() {
    document.getElementById('admin-toolbar')?.remove();
  }

  /* ════════════════════════════════════════════════════════
     TEXT EDITING (general)
  ════════════════════════════════════════════════════════ */
  const TEXT_SELECTORS = [
    'h1', 'h2',
    'p.hero-desc', 'p.hero-title', '.hero-name',
    '.section-title', '.section-subtitle',
    '.stat-num', '.stat-desc',
    '.about-bio',
    '.tl-period', '.tl-role', '.tl-company', '.tl-desc',
    '.edu-degree', '.edu-school', '.edu-note',
    '.achievement-title', '.achievement-desc',
    '.highlight-text',
    '.award-text',
    '.contact-link-val',
    '.badge-val',
    'footer .footer-copy',
    '.hero-eyebrow span:not(.line)',
  ].join(', ');

  function makeTextsEditable() {
    editableEls = [...document.querySelectorAll(TEXT_SELECTORS)];
    editableEls.forEach(el => {
      el.setAttribute('contenteditable', 'true');
      el.setAttribute('spellcheck', 'false');
      el.dataset.adminOriginal = el.innerHTML;
      el.dataset.adminSel = buildSelector(el);
      el.addEventListener('focus',   onTextFocus);
      el.addEventListener('blur',    onTextBlur);
      el.addEventListener('keydown', onTextKeydown);
    });
  }

  function removeEditableTexts() {
    editableEls.forEach(el => {
      el.removeAttribute('contenteditable');
      el.removeAttribute('spellcheck');
      el.removeEventListener('focus',   onTextFocus);
      el.removeEventListener('blur',    onTextBlur);
      el.removeEventListener('keydown', onTextKeydown);
    });
    editableEls = [];
  }

  function onTextFocus(e)   { e.target.classList.add('admin-focused'); }
  function onTextBlur(e) {
    const el  = e.target;
    el.classList.remove('admin-focused');
    const sel = el.dataset.adminSel;
    if (sel && el.innerHTML !== el.dataset.adminOriginal) {
      pendingEdits[sel] = { type: 'text', value: el.innerHTML };
      showToast('✏️ Change recorded — hit Save to persist', 'info');
    }
  }
  function onTextKeydown(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); e.target.blur(); }
  }

  /* ════════════════════════════════════════════════════════
     IMAGE EDITING (general)
  ════════════════════════════════════════════════════════ */
  function makeImagesClickable() {
    // Only images NOT inside project cards (those are handled by card editor)
    imageEls = [...document.querySelectorAll('img')].filter(
      img => !img.closest('.proj-card')
    );
    imageEls.forEach(img => {
      img.dataset.adminSel = buildSelector(img);
      img.addEventListener('click', onImageClick);
    });
  }

  function removeImageHandlers() {
    imageEls.forEach(img => img.removeEventListener('click', onImageClick));
    imageEls = [];
  }

  function onImageClick(e) {
    if (!adminActive) return;
    e.preventDefault(); e.stopPropagation();
    openImageEditor(e.currentTarget);
  }

  /* ════════════════════════════════════════════════════════
     PROJECT CARDS — FULL CARD EDITOR
  ════════════════════════════════════════════════════════ */
  function makeProjectCardsEditable() {
    projCards = [...document.querySelectorAll('.proj-card')];
    projCards.forEach(card => {
      // ── Edit Card button ──
      const editBtn = document.createElement('button');
      editBtn.className = 'admin-card-edit-btn';
      editBtn.innerHTML = `<svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> Edit Card`;
      card.appendChild(editBtn);

      // ── Link button ──
      const linkBtn = document.createElement('button');
      linkBtn.className = 'admin-card-link-btn';
      linkBtn.title = 'Edit redirect link';
      linkBtn.innerHTML = `<svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg> Link`;
      card.appendChild(linkBtn);

      const onCardClick = e => {
        if (!adminActive) return;
        e.preventDefault(); e.stopPropagation();
        openProjectEditor(card);
      };

      editBtn.addEventListener('click', onCardClick);
      card._adminClickHandler = onCardClick;
      card.addEventListener('click', onCardClick);

      // Link button opens inline link popover
      linkBtn.addEventListener('click', e => {
        if (!adminActive) return;
        e.preventDefault(); e.stopPropagation();
        openLinkPopover(card, linkBtn);
      });
    });
  }

  function removeProjectCardHandlers() {
    projCards.forEach(card => {
      card.querySelector('.admin-card-edit-btn')?.remove();
      card.querySelector('.admin-card-link-btn')?.remove();
      if (card._adminClickHandler) {
        card.removeEventListener('click', card._adminClickHandler);
        delete card._adminClickHandler;
      }
    });
    projCards = [];
  }

  /* ── Inline Link Popover ── */
  function openLinkPopover(card, anchorBtn) {
    // Close any existing popover
    document.querySelector('.admin-link-popover')?.remove();

    const currentHref = card.getAttribute('href') || '';
    const cardSel     = buildSelector(card);

    const pop = document.createElement('div');
    pop.className = 'admin-link-popover';
    pop.innerHTML = `
      <div class="alp-label">Card Link (href)</div>
      <div class="alp-row">
        <input class="alp-input" type="text" value="${escHtml(currentHref)}" placeholder="works/page.html or https://..."/>
        <button class="alp-apply atb-btn atb-btn--save">✓</button>
        <button class="alp-cancel atb-btn atb-btn--exit">✕</button>
      </div>`;

    // Position relative to the card
    card.style.position = 'relative';
    card.appendChild(pop);

    const input = pop.querySelector('.alp-input');
    input.focus();
    input.select();

    const apply = () => {
      const newHref = input.value.trim();
      card.setAttribute('href', newHref);
      pendingEdits[cardSel + '__href'] = { type: 'attr', attr: 'href', value: newHref, target: cardSel };
      pop.remove();
      showToast('🔗 Link updated — hit Save to persist', 'success');
    };

    pop.querySelector('.alp-apply').addEventListener('click', apply);
    pop.querySelector('.alp-cancel').addEventListener('click', () => pop.remove());
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter')  { e.preventDefault(); apply(); }
      if (e.key === 'Escape') { e.preventDefault(); pop.remove(); }
    });

    // Close if clicking outside
    setTimeout(() => {
      document.addEventListener('click', function outsideClick(ev) {
        if (!pop.contains(ev.target) && ev.target !== anchorBtn) {
          pop.remove();
          document.removeEventListener('click', outsideClick);
        }
      });
    }, 0);
  }

  /* ── Project Card Editor Modal ── */
  function openProjectEditor(card) {
    document.getElementById('admin-proj-panel')?.remove();

    // Read current card data
    const img        = card.querySelector('.proj-image img');
    const nameEl     = card.querySelector('.proj-name');
    const descEl     = card.querySelector('.proj-desc');
    const tagsEl     = card.querySelector('.proj-tags');
    const metaEl     = card.querySelector('.proj-meta');
    const arrowEl    = card.querySelector('.proj-arrow');
    const metaItems  = [...card.querySelectorAll('.proj-meta-item')];
    const awardBadge = card.querySelector('.proj-award-badge');
    const cardSel    = buildSelector(card);

    // Tags: collect text only from .tag spans
    const tagsText = [...(tagsEl?.querySelectorAll('.tag') || [])]
      .map(t => t.textContent.trim()).join(', ');

    // Meta: text nodes only (strip SVG)
    const getMetaText = el => {
      if (!el) return '';
      return [...el.childNodes]
        .filter(n => n.nodeType === Node.TEXT_NODE)
        .map(n => n.textContent.trim())
        .join('').trim();
    };

    const dateMeta = getMetaText(metaItems[0]);
    const roleMeta = getMetaText(metaItems[1]);

    const panel = document.createElement('div');
    panel.id = 'admin-proj-panel';
    panel.innerHTML = `
      <div class="app-backdrop"></div>
      <div class="app-modal">
        <div class="app-header">
          <h3 class="app-title">
            <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
            Edit Project Card
          </h3>
          <button class="app-close" title="Close">✕</button>
        </div>

        <!-- Image -->
        <div class="app-section">
          <label class="app-label">Cover Image</label>
          <div class="app-img-row">
            <img class="app-img-thumb" src="${img?.src || ''}" alt=""/>
            <div class="app-img-controls">
              <input class="app-input app-img-url" type="url" placeholder="https://..." value="${img?.src || ''}"/>
              <span class="app-or">or</span>
              <label class="app-upload-btn">
                📁 Upload
                <input type="file" class="app-file-input" accept="image/*"/>
              </label>
            </div>
          </div>
        </div>

        <!-- Title -->
        <div class="app-section">
          <label class="app-label">Project Title</label>
          <input class="app-input" id="app-proj-name" type="text" value="${escHtml(nameEl?.textContent || '')}"/>
        </div>

        <!-- Description -->
        <div class="app-section">
          <label class="app-label">Description</label>
          <textarea class="app-input app-textarea" id="app-proj-desc">${escHtml(descEl?.textContent || '')}</textarea>
        </div>

        <!-- Tags -->
        <div class="app-section">
          <label class="app-label">Tags <span class="app-hint-inline">comma-separated</span></label>
          <input class="app-input" id="app-proj-tags" type="text" value="${escHtml(tagsText)}"/>
        </div>

        <!-- Meta row -->
        <div class="app-section app-section--row">
          <div class="app-col">
            <label class="app-label">Date / Period</label>
            <input class="app-input" id="app-proj-date" type="text" placeholder="Jan 2025 – Present" value="${escHtml(dateMeta)}"/>
          </div>
          <div class="app-col">
            <label class="app-label">Role</label>
            <input class="app-input" id="app-proj-role" type="text" placeholder="e.g. BIM Engineer" value="${escHtml(roleMeta)}"/>
          </div>
        </div>

        <!-- Award badge -->
        <div class="app-section">
          <label class="app-label">Award Badge <span class="app-hint-inline">leave blank to hide</span></label>
          <input class="app-input" id="app-proj-award" type="text" placeholder="🥇 1st Place · UNS 2025" value="${escHtml(awardBadge?.textContent || '')}"/>
        </div>

        <!-- Category -->
        <div class="app-section">
          <label class="app-label">Filter Category <span class="app-hint-inline">Hold Ctrl/Cmd for multiple</span></label>
          <select class="app-input app-select" id="app-proj-cat" multiple size="5" style="height: auto;">
            ${[
              {v:'construction-management', l:'Construction Management'},
              {v:'bim', l:'BIM'},
              {v:'structure', l:'Structure'},
              {v:'geotechnic', l:'Geotechnic'},
              {v:'competition', l:'Competition'},
              {v:'research', l:'Research'},
              {v:'other', l:'Other'}
            ].map(c => {
              const currentCats = (card.dataset.category || '').split(',').map(s=>s.trim());
              return `<option value="${c.v}" ${currentCats.includes(c.v) ? 'selected' : ''}>${c.l}</option>`;
            }).join('')}
          </select>
        </div>

        <!-- Link -->
        <div class="app-section">
          <label class="app-label">Card Link (href)</label>
          <input class="app-input" id="app-proj-link" type="text" value="${escHtml(card.getAttribute('href') || '')}"/>
        </div>

        <div class="app-actions">
          <button class="app-btn app-btn--apply atb-btn atb-btn--save">Apply Changes</button>
          <button class="app-btn app-btn--cancel atb-btn atb-btn--exit">Cancel</button>
        </div>
      </div>`;

    document.body.appendChild(panel);

    /* ── file upload preview ── */
    const thumbEl = panel.querySelector('.app-img-thumb');
    panel.querySelector('.app-file-input').addEventListener('change', e => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = ev => {
        thumbEl.src = ev.target.result;
        panel.querySelector('.app-img-url').value = ev.target.result;
      };
      reader.readAsDataURL(file);
    });
    panel.querySelector('.app-img-url').addEventListener('input', e => {
      thumbEl.src = e.target.value;
    });

    /* ── Apply ── */
    panel.querySelector('.app-btn--apply').addEventListener('click', () => {
      const edits = {};

      // Image
      const newImgSrc = panel.querySelector('.app-img-url').value.trim();
      if (img && newImgSrc && newImgSrc !== img.src) {
        img.src = newImgSrc;
        const imgSel = buildSelector(img);
        edits[imgSel] = { type: 'image', value: newImgSrc };
      }

      // Name
      const newName = panel.querySelector('#app-proj-name').value.trim();
      if (nameEl && newName !== nameEl.textContent.trim()) {
        nameEl.textContent = newName;
        edits[buildSelector(nameEl)] = { type: 'text', value: newName };
      }

      // Desc
      const newDesc = panel.querySelector('#app-proj-desc').value.trim();
      if (descEl && newDesc !== descEl.textContent.trim()) {
        descEl.textContent = newDesc;
        edits[buildSelector(descEl)] = { type: 'text', value: newDesc };
      }

      // Tags — rebuild HTML
      if (tagsEl) {
        const rawTags = panel.querySelector('#app-proj-tags').value;
        const tagsList = rawTags.split(',').map(t => t.trim()).filter(Boolean);
        const newTagsHtml = tagsList.map(t => `<span class="tag">${escHtml(t)}</span>`).join('');
        tagsEl.innerHTML = newTagsHtml;
        edits[buildSelector(tagsEl)] = { type: 'text', value: newTagsHtml };
      }

      // Date meta (first meta item — preserves the SVG, replaces text node)
      const newDate = panel.querySelector('#app-proj-date').value.trim();
      if (metaItems[0] && newDate) {
        replaceTextNode(metaItems[0], newDate);
        edits[buildSelector(metaItems[0])] = { type: 'metaText', value: newDate };
      }

      // Role meta (second meta item) — create it if this card never had one
      const newRole = panel.querySelector('#app-proj-role').value.trim();
      if (!metaItems[1] && newRole && metaEl) {
        metaItems[1] = document.createElement('span');
        metaItems[1].className = 'proj-meta-item';
        // insert before the arrow icon so it stays the last element (space-between)
        metaEl.insertBefore(metaItems[1], arrowEl || null);
      }
      if (metaItems[1]) {
        metaItems[1].textContent = newRole;
        edits[buildSelector(metaItems[1])] = { type: 'text', value: newRole };
      }

      // Award badge
      const newAward = panel.querySelector('#app-proj-award').value.trim();
      if (awardBadge) {
        awardBadge.textContent = newAward;
        awardBadge.style.display = newAward ? '' : 'none';
        edits[buildSelector(awardBadge)] = { type: 'text', value: newAward };
        edits[buildSelector(awardBadge) + '__display'] = { type: 'display', value: newAward ? '' : 'none', target: buildSelector(awardBadge) };
      }

      // Category
      const selectEl = panel.querySelector('#app-proj-cat');
      const newCat = Array.from(selectEl.selectedOptions).map(opt => opt.value).join(', ');
      card.dataset.category = newCat;
      edits[cardSel + '__category'] = { type: 'attr', attr: 'data-category', value: newCat, target: cardSel };

      // Link
      const newHref = panel.querySelector('#app-proj-link').value.trim();
      if (newHref !== card.getAttribute('href')) {
        card.setAttribute('href', newHref);
        edits[cardSel + '__href'] = { type: 'attr', attr: 'href', value: newHref, target: cardSel };
      }

      Object.assign(pendingEdits, edits);
      panel.remove();
      showToast('✅ Card updated — hit Save to persist', 'success');
    });

    panel.querySelector('.app-btn--cancel').addEventListener('click', () => panel.remove());
    panel.querySelector('.app-close').addEventListener('click',       () => panel.remove());
    panel.querySelector('.app-backdrop').addEventListener('click',    () => panel.remove());
  }

  /* Replace the text node of an element that also contains child elements (like SVG) */
  function replaceTextNode(el, newText) {
    [...el.childNodes]
      .filter(n => n.nodeType === Node.TEXT_NODE)
      .forEach(n => n.remove());
    el.appendChild(document.createTextNode(newText));
  }

  /* ════════════════════════════════════════════════════════
     IMAGE EDITOR MODAL (general, non-card images)
  ════════════════════════════════════════════════════════ */
  function openImageEditor(img) {
    document.getElementById('admin-img-panel')?.remove();

    const panel = document.createElement('div');
    panel.id = 'admin-img-panel';
    panel.innerHTML = `
      <div class="app-backdrop"></div>
      <div class="app-modal">
        <div class="app-header">
          <h3 class="app-title">
            <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
            Replace Image
          </h3>
          <button class="app-close">✕</button>
        </div>
        <div class="app-section">
          <label class="app-label">Current</label>
          <img class="app-img-preview" src="${img.src}" alt=""/>
        </div>
        <div class="app-section">
          <label class="app-label">New Image URL</label>
          <input class="app-input aip-url" type="url" placeholder="https://..." value="${img.src}"/>
        </div>
        <div class="app-section">
          <label class="app-label">Or Upload</label>
          <label class="app-upload-area">
            <svg width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/></svg>
            <span>Click to upload or drag &amp; drop</span>
            <input type="file" class="app-file-input" accept="image/*"/>
          </label>
        </div>
        <div class="app-actions">
          <button class="app-btn app-btn--apply atb-btn atb-btn--save">Apply</button>
          <button class="app-btn app-btn--cancel atb-btn atb-btn--exit">Cancel</button>
        </div>
      </div>`;

    document.body.appendChild(panel);

    const urlInput = panel.querySelector('.aip-url');
    const preview  = panel.querySelector('.app-img-preview');

    urlInput.addEventListener('input', e => { preview.src = e.target.value; });

    panel.querySelector('.app-file-input').addEventListener('change', e => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = ev => { preview.src = ev.target.result; urlInput.value = ev.target.result; };
      reader.readAsDataURL(file);
    });

    panel.querySelector('.app-btn--apply').addEventListener('click', () => {
      const newSrc = urlInput.value.trim();
      if (!newSrc) { showToast('⚠️ No image selected', 'error'); return; }
      img.src = newSrc;
      pendingEdits[img.dataset.adminSel] = { type: 'image', value: newSrc };
      panel.remove();
      showToast('🖼 Image updated — hit Save to persist', 'info');
    });

    panel.querySelector('.app-btn--cancel').addEventListener('click', () => panel.remove());
    panel.querySelector('.app-close').addEventListener('click',       () => panel.remove());
    panel.querySelector('.app-backdrop').addEventListener('click',    () => panel.remove());
  }

  /* ════════════════════════════════════════════════════════
     PERSISTENCE
  ════════════════════════════════════════════════════════ */
  function saveEdits() {
    showToast('⏳ Saving permanently...', 'info');
    
    const clone = document.documentElement.cloneNode(true);
    
    /* Remove admin UI */
    const toRemove = [
      '#admin-toolbar', '#admin-proj-panel', '#admin-img-panel', 
      '#admin-toast-container', '#admin-styles'
    ];
    toRemove.forEach(sel => {
      clone.querySelectorAll(sel).forEach(e => e.remove());
    });
    
    /* Clean classes & attributes */
    const body = clone.querySelector('body');
    if (body) body.classList.remove('admin-mode');
    
    clone.querySelectorAll('.admin-card-edit-btn').forEach(e => e.remove());
    clone.querySelectorAll('.admin-card-link-btn').forEach(e => e.remove());
    clone.querySelectorAll('.admin-link-popover').forEach(e => e.remove());
    
    clone.querySelectorAll('[contenteditable]').forEach(el => {
      el.removeAttribute('contenteditable');
      el.removeAttribute('spellcheck');
      el.classList.remove('admin-focused');
    });
    
    clone.querySelectorAll('[data-admin-original]').forEach(el => el.removeAttribute('data-admin-original'));
    clone.querySelectorAll('[data-admin-sel]').forEach(el => el.removeAttribute('data-admin-sel'));

    /* Strip thumb-rotator's injected nodes/classes (self-heals on next load) */
    clone.querySelectorAll('[data-rotator]').forEach(el => el.remove());
    clone.querySelectorAll('.proj-image.rotating').forEach(el => el.classList.remove('rotating'));
    clone.querySelectorAll('.proj-image .lqip>img').forEach(img => {
      img.removeAttribute('style');
    });

    /* Send to server */
    const finalHtml = '<!DOCTYPE html>\n<html lang="en">\n' + clone.innerHTML + '\n</html>';
    
    let targetPath = location.pathname;
    if (!targetPath || targetPath === '/') targetPath = '/index.html';
    
    fetch('/api/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: targetPath,
        html: finalHtml
      })
    })
    .then(res => {
      if (res.ok) {
        pendingEdits = {};
        try { localStorage.removeItem(STORAGE_KEY); } catch (_) {}
        showToast('💾 Saved permanently to file!', 'success');
      } else {
        showToast('❌ Failed to save. Is server.py running?', 'error');
      }
    })
    .catch(err => {
      showToast('❌ Error: ' + err.message, 'error');
    });
  }

  function resetEdits() {
    if (!confirm('Reset ALL edits? This cannot be undone.')) return;
    pendingEdits = {};
    localStorage.removeItem(STORAGE_KEY);
    showToast('🗑 All edits cleared — reloading…', 'neutral');
    setTimeout(() => location.reload(), 1200);
  }

  function loadEdits() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; }
    catch { return {}; }
  }

  function applyStoredEdits() {
    Object.entries(pendingEdits).forEach(([key, edit]) => {
      try {
        // attr & display edits have a 'target' property
        const sel = edit.target || key.replace(/__.*$/, '');
        const el  = document.querySelector(sel);
        if (!el) return;

        if (edit.type === 'text' || edit.type === 'metaText') {
          if (edit.type === 'metaText') replaceTextNode(el, edit.value);
          else el.innerHTML = edit.value;
        }
        if (edit.type === 'image')   el.src = edit.value;
        if (edit.type === 'attr')    el.setAttribute(edit.attr, edit.value);
        if (edit.type === 'display') el.style.display = edit.value;
      } catch { /* skip invalid */ }
    });
  }

  /* ════════════════════════════════════════════════════════
     HELPERS
  ════════════════════════════════════════════════════════ */
  function buildSelector(el) {
    if (el.id) return '#' + CSS.escape(el.id);
    const parts = [];
    let cur = el;
    while (cur && cur !== document.body) {
      let part = cur.tagName.toLowerCase();
      if (cur.className && typeof cur.className === 'string') {
        const cls = [...cur.classList]
          .filter(c => !c.startsWith('admin-'))
          .slice(0, 2)
          .map(c => '.' + CSS.escape(c))
          .join('');
        part += cls;
      }
      const siblings = cur.parentElement
        ? [...cur.parentElement.children].filter(c => c.tagName === cur.tagName)
        : [];
      if (siblings.length > 1) part += `:nth-of-type(${siblings.indexOf(cur) + 1})`;
      parts.unshift(part);
      cur = cur.parentElement;
    }
    return parts.join(' > ');
  }

  function escHtml(str) {
    return String(str)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  /* ════════════════════════════════════════════════════════
     TOAST
  ════════════════════════════════════════════════════════ */
  function showToast(msg, type = 'info') {
    let c = document.getElementById('admin-toast-container');
    if (!c) {
      c = document.createElement('div');
      c.id = 'admin-toast-container';
      document.body.appendChild(c);
    }
    const t = document.createElement('div');
    t.className = `admin-toast admin-toast--${type}`;
    t.textContent = msg;
    c.appendChild(t);
    requestAnimationFrame(() => t.classList.add('admin-toast--show'));
    setTimeout(() => {
      t.classList.remove('admin-toast--show');
      t.addEventListener('transitionend', () => t.remove(), { once: true });
    }, 3200);
  }

  /* ════════════════════════════════════════════════════════
     ALL STYLES (injected once)
  ════════════════════════════════════════════════════════ */
  function injectStyles() {
    if (document.getElementById('admin-styles')) return;
    const s = document.createElement('style');
    s.id = 'admin-styles';
    s.textContent = `
      /* ── Body ── */
      body.admin-mode { padding-top: 52px !important; }

      /* ── Editable text highlight ── */
      body.admin-mode [contenteditable] {
        outline: 1.5px dashed rgba(79,195,247,0.35);
        border-radius: 4px; cursor: text;
        transition: outline 0.2s, background 0.2s;
        min-width: 20px; min-height: 1em;
      }
      body.admin-mode [contenteditable]:hover {
        outline: 1.5px dashed rgba(79,195,247,0.7);
        background: rgba(79,195,247,0.04);
      }
      body.admin-mode [contenteditable].admin-focused {
        outline: 2px solid rgba(79,195,247,0.9);
        background: rgba(79,195,247,0.07);
      }

      /* ── General image hover ── */
      body.admin-mode img:not(.proj-card img) {
        cursor: pointer; outline: 2px dashed transparent; outline-offset: 3px;
        transition: outline 0.2s, filter 0.2s;
      }
      body.admin-mode img:not(.proj-card img):hover {
        outline-color: rgba(224,123,58,0.7);
        filter: brightness(0.75) saturate(0.7) !important;
      }

      /* ── Project card admin state ── */
      body.admin-mode .proj-card {
        position: relative;
        outline: 1.5px dashed rgba(79,195,247,0.2);
        outline-offset: 2px;
        cursor: default !important;
      }
      body.admin-mode .proj-card:hover {
        outline-color: rgba(79,195,247,0.5);
      }

      /* ── Edit button overlay on each card ── */
      .admin-card-edit-btn {
        display: none;
        position: absolute; top: 12px; left: 12px; z-index: 20;
        background: rgba(8,15,30,0.88); backdrop-filter: blur(10px);
        border: 1px solid rgba(79,195,247,0.35); color: #4fc3f7;
        font-family: 'Outfit', sans-serif; font-size: 0.72rem; font-weight: 600;
        padding: 6px 12px; border-radius: 6px; cursor: pointer;
        display: inline-flex; align-items: center; gap: 6px;
        transition: background 0.2s, border-color 0.2s;
        pointer-events: all;
      }
      body.admin-mode .proj-card .admin-card-edit-btn {
        display: inline-flex;
      }
      .admin-card-edit-btn:hover {
        background: rgba(79,195,247,0.15); border-color: #4fc3f7;
      }

      /* -- Link button (beside Edit Card) -- */
      .admin-card-link-btn {
        display: none;
        position: absolute; top: 12px; left: 108px; z-index: 20;
        background: rgba(8,15,30,0.88); backdrop-filter: blur(10px);
        border: 1px solid rgba(224,123,58,0.4); color: #e07b3a;
        font-family: 'Outfit', sans-serif; font-size: 0.72rem; font-weight: 600;
        padding: 6px 12px; border-radius: 6px; cursor: pointer;
        display: inline-flex; align-items: center; gap: 6px;
        transition: background 0.2s, border-color 0.2s;
        pointer-events: all;
      }
      body.admin-mode .proj-card .admin-card-link-btn {
        display: inline-flex;
      }
      .admin-card-link-btn:hover {
        background: rgba(224,123,58,0.15); border-color: #e07b3a;
      }

      /* -- Inline link popover -- */
      .admin-link-popover {
        position: absolute; top: 46px; left: 12px; z-index: 30;
        background: rgba(8,15,30,0.97); backdrop-filter: blur(16px);
        border: 1px solid rgba(224,123,58,0.35); border-radius: 10px;
        padding: 12px 14px; min-width: 320px;
        box-shadow: 0 8px 32px rgba(0,0,0,0.5);
        font-family: 'Outfit', sans-serif;
        display: flex; flex-direction: column; gap: 8px;
      }
      .alp-label {
        font-size: 0.68rem; font-weight: 600; color: #e07b3a;
        letter-spacing: 0.08em; text-transform: uppercase;
      }
      .alp-row { display: flex; gap: 6px; align-items: center; }
      .alp-input {
        flex: 1; font-family: 'JetBrains Mono', monospace; font-size: 0.78rem;
        color: #edf2f7; background: #0a1628;
        border: 1px solid rgba(224,123,58,0.3); border-radius: 6px;
        padding: 7px 10px; outline: none; transition: border-color 0.2s;
      }
      .alp-input:focus { border-color: #e07b3a; }
      .alp-apply  { padding: 7px 12px !important; border-radius: 6px !important; }
      .alp-cancel { padding: 7px 10px !important; border-radius: 6px !important; }

      /* ── Toolbar ── */
      #admin-toolbar {
        position: fixed; top: 0; left: 0; right: 0; z-index: 99999;
        height: 52px; display: flex; align-items: center;
        background: rgba(8,12,22,0.97); backdrop-filter: blur(20px);
        border-bottom: 1px solid rgba(79,195,247,0.18);
        box-shadow: 0 2px 20px rgba(0,0,0,0.5);
        font-family: 'Outfit', sans-serif;
      }
      .atb-inner { display: flex; align-items: center; gap: 14px; padding: 0 22px; width: 100%; }
      .atb-badge {
        display: inline-flex; align-items: center; gap: 6px;
        background: rgba(79,195,247,0.1); border: 1px solid rgba(79,195,247,0.28);
        color: #4fc3f7; font-size: 0.74rem; font-weight: 600;
        padding: 5px 12px; border-radius: 999px; letter-spacing: 0.04em; white-space: nowrap;
      }
      .atb-hint { font-size: 0.73rem; color: rgba(143,175,200,0.55); flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .atb-actions { display: flex; gap: 8px; margin-left: auto; }
      .atb-btn {
        font-family: inherit; font-size: 0.76rem; font-weight: 500;
        padding: 6px 14px; border-radius: 6px; border: 1px solid transparent;
        cursor: pointer; transition: all 0.18s; white-space: nowrap;
        display: inline-flex; align-items: center; gap: 5px;
      }
      .atb-btn--save  { background: #4fc3f7; color: #080f1e; border-color: #4fc3f7; }
      .atb-btn--save:hover  { background: #7dd3f8; }
      .atb-btn--reset { background: transparent; color: #f87171; border-color: rgba(248,113,113,0.3); }
      .atb-btn--reset:hover { background: rgba(248,113,113,0.1); border-color: rgba(248,113,113,0.6); }
      .atb-btn--exit  { background: transparent; color: rgba(143,175,200,0.7); border-color: rgba(255,255,255,0.1); }
      .atb-btn--exit:hover  { color: #edf2f7; border-color: rgba(255,255,255,0.22); }

      /* ── Shared Modal base ── */
      #admin-proj-panel, #admin-img-panel {
        position: fixed; inset: 0; z-index: 999998;
        display: flex; align-items: center; justify-content: center;
      }
      .app-backdrop {
        position: absolute; inset: 0;
        background: rgba(4,8,18,0.82); backdrop-filter: blur(7px);
      }
      .app-modal {
        position: relative; z-index: 1;
        background: #0d1b30; border: 1px solid rgba(79,195,247,0.18);
        border-radius: 16px; padding: 0; width: min(560px, 94vw);
        box-shadow: 0 24px 64px rgba(0,0,0,0.65);
        font-family: 'Outfit', sans-serif;
        display: flex; flex-direction: column;
        max-height: 90vh; overflow: hidden;
      }
      .app-header {
        display: flex; align-items: center; justify-content: space-between;
        padding: 20px 24px 16px; border-bottom: 1px solid rgba(79,195,247,0.1);
        flex-shrink: 0;
      }
      .app-title {
        font-size: 0.95rem; font-weight: 600; color: #edf2f7; margin: 0;
        display: flex; align-items: center; gap: 8px;
      }
      .app-close {
        font-size: 1rem; color: #3d6080; background: none; border: none;
        cursor: pointer; padding: 4px 8px; border-radius: 4px;
        transition: color 0.2s;
      }
      .app-close:hover { color: #edf2f7; }

      /* Scrollable body */
      .app-modal > *:not(.app-header):not(.app-actions) {
        overflow-y: auto;
      }
      .app-section {
        padding: 14px 24px 0;
        display: flex; flex-direction: column; gap: 7px;
      }
      .app-section--row {
        flex-direction: row; gap: 14px;
      }
      .app-col { flex: 1; display: flex; flex-direction: column; gap: 7px; }
      .app-label {
        font-size: 0.75rem; font-weight: 600; color: #8fafc8;
        letter-spacing: 0.04em; text-transform: uppercase;
        display: flex; align-items: center; gap: 6px;
      }
      .app-hint-inline { font-weight: 400; text-transform: none; color: #3d6080; letter-spacing: 0; }
      .app-input {
        font-family: inherit; font-size: 0.875rem; color: #edf2f7;
        background: #0a1628; border: 1px solid rgba(79,195,247,0.18);
        border-radius: 8px; padding: 10px 13px; width: 100%;
        transition: border-color 0.2s, box-shadow 0.2s; outline: none;
      }
      .app-input:focus { border-color: #4fc3f7; box-shadow: 0 0 0 3px rgba(79,195,247,0.12); }
      .app-textarea { min-height: 80px; resize: vertical; }
      .app-select { cursor: pointer; }

      /* Image row inside card editor */
      .app-img-row { display: flex; gap: 14px; align-items: flex-start; }
      .app-img-thumb {
        width: 110px; height: 70px; object-fit: cover;
        border-radius: 8px; border: 1px solid rgba(79,195,247,0.15); flex-shrink: 0;
      }
      .app-img-controls { flex: 1; display: flex; flex-direction: column; gap: 8px; }
      .app-or { font-size: 0.72rem; color: #3d6080; text-align: center; }
      .app-upload-btn {
        display: inline-flex; align-items: center; gap: 6px;
        font-family: inherit; font-size: 0.78rem; color: #4fc3f7;
        background: rgba(79,195,247,0.08); border: 1px solid rgba(79,195,247,0.22);
        padding: 7px 14px; border-radius: 6px; cursor: pointer;
        transition: all 0.18s; align-self: flex-start;
      }
      .app-upload-btn:hover { background: rgba(79,195,247,0.16); }
      .app-file-input { display: none; }

      /* Upload area (image editor) */
      .app-img-preview {
        width: 100%; max-height: 160px; object-fit: cover;
        border-radius: 8px; border: 1px solid rgba(79,195,247,0.15);
      }
      .app-upload-area {
        display: flex; flex-direction: column; align-items: center;
        justify-content: center; gap: 8px;
        border: 1.5px dashed rgba(79,195,247,0.2); border-radius: 10px;
        padding: 24px 20px; cursor: pointer; color: #3d6080;
        font-size: 0.83rem; text-align: center;
        transition: border-color 0.2s, background 0.2s;
      }
      .app-upload-area:hover { border-color: rgba(79,195,247,0.45); background: rgba(79,195,247,0.04); color: #8fafc8; }
      .app-upload-area svg { color: #4fc3f7; opacity: 0.55; }

      .app-actions {
        display: flex; gap: 10px; padding: 18px 24px;
        border-top: 1px solid rgba(79,195,247,0.08);
        flex-shrink: 0;
      }

      /* ── Toast ── */
      #admin-toast-container {
        position: fixed; bottom: 22px; right: 22px; z-index: 999999;
        display: flex; flex-direction: column; gap: 9px; pointer-events: none;
      }
      .admin-toast {
        font-family: 'Outfit', sans-serif; font-size: 0.81rem; font-weight: 500;
        padding: 10px 17px; border-radius: 8px;
        backdrop-filter: blur(16px); box-shadow: 0 4px 24px rgba(0,0,0,0.35);
        opacity: 0; transform: translateY(8px);
        transition: opacity 0.25s ease, transform 0.25s ease;
        pointer-events: none;
      }
      .admin-toast--show { opacity: 1; transform: translateY(0); }
      .admin-toast--info    { background: rgba(13,27,48,0.95); color: #4fc3f7; border: 1px solid rgba(79,195,247,0.22); }
      .admin-toast--success { background: rgba(13,27,48,0.95); color: #4ade80; border: 1px solid rgba(74,222,128,0.22); }
      .admin-toast--error   { background: rgba(13,27,48,0.95); color: #f87171; border: 1px solid rgba(248,113,113,0.22); }
      .admin-toast--neutral { background: rgba(13,27,48,0.95); color: #8fafc8; border: 1px solid rgba(143,175,200,0.18); }
    `;
    document.head.appendChild(s);
  }

})();
