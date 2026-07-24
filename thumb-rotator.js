/* ════════════════════════════════════════════════════════
   Selected Work thumbnails — sliding documentation carousel
   Each card with a documentation gallery gets a horizontal
   slider (cover + doc photos) that advances on one shared
   global beat, so every thumbnail slides in unison — except
   whichever card the cursor is currently over, which sits
   out that beat so a hovered photo never moves underfoot.
   Small edge arrows (visible on hover) let a card be advanced
   or rewound independently without touching the shared beat.
   Self-healing: strips any stale injected nodes/classes an
   admin Save may have baked back into the DOM.
════════════════════════════════════════════════════════ */
(function () {
  const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const BEAT_MS = 4000; /* dwell time; short enough that even a quick glance catches a change */

  /* slug -> ordered list of documentation photo filenames (smallest
     available width variant — plenty for a ~380px thumbnail slot).
     Entries that are perceptually identical to the homepage cover (which
     is always slide 0) are pruned here so the on-page carousel never
     shows the same picture twice back-to-back. This only affects the
     homepage carousel — the full, undeduplicated gallery still lives on
     each project's works/<slug>.html detail page. */
  const GALLERIES = {
    'coal-shed-pln': ['coal-shed-pln-03-480.webp','coal-shed-pln-04-480.webp','coal-shed-pln-05-480.webp','coal-shed-pln-06-480.webp','coal-shed-pln-07-388.webp','coal-shed-pln-08-480.webp'],
    'pltu-tarahan': ['pltu-tarahan-02-480.webp','pltu-tarahan-03-480.webp','pltu-tarahan-04-480.webp'],
    'jogja-solo-toll': ['jogja-solo-toll-02-480.webp','jogja-solo-toll-03-480.webp','jogja-solo-toll-04-480.webp'],
    'grindulu-river': ['grindulu-river-03-480.webp','grindulu-river-04-480.webp'],
    'wooden-hall-construction': ['wooden-hall-construction-03-480.webp'],
    'residential-housing': ['residential-housing-03-447.webp'],
    'ohse-k3l-guidelines': ['ohse-k3l-guidelines-02-480.webp','ohse-k3l-guidelines-03-337.webp','ohse-k3l-guidelines-04-480.webp'],
    'portfolio-website': ['portfolio-website-01-480.webp','portfolio-website-03-480.webp'],
    'sthirata-bridge': ['sthirata-bridge-02-480.webp','sthirata-bridge-03-480.webp','sthirata-bridge-04-480.webp'],
    'wisesa-kencana-ibdc': ['wisesa-kencana-ibdc-02-480.webp','wisesa-kencana-ibdc-03-480.webp','wisesa-kencana-ibdc-04-454.webp','wisesa-kencana-ibdc-05-480.webp'],
    'wisesa-kencana-kji': ['wisesa-kencana-kji-02-480.webp','wisesa-kencana-kji-03-480.webp'],
    'thesis-liquefaction': ['thesis-liquefaction-03-480.webp','thesis-liquefaction-04-480.webp','thesis-liquefaction-05-480.webp'],
    'plaza-kosudgama': ['plaza-kosudgama-02-480.webp','plaza-kosudgama-03-480.webp','plaza-kosudgama-04-480.webp','plaza-kosudgama-05-480.webp','plaza-kosudgama-06-480.webp'],
    'kkn-kareba-kumba': ['kkn-kareba-kumba-02-480.webp','kkn-kareba-kumba-03-480.webp'],
    'programming-automation': ['programming-automation-02-361.webp','programming-automation-04-480.webp'],
    'gmbb-community': ['gmbb-community-02-480.webp','gmbb-community-03-480.webp'],
    /* lecturer-assistant: only 1 doc photo -> no carousel */
  };

  const NAV_ICON = {
    prev: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"></polyline></svg>',
    next: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"></polyline></svg>',
  };

  function heal() {
    document.querySelectorAll('[data-rotator]').forEach(el => el.remove());
    document.querySelectorAll('.proj-image.rotating').forEach(el => el.classList.remove('rotating'));
    document.querySelectorAll('.proj-image .lqip>img').forEach(img => {
      img.style.removeProperty('opacity');
      img.style.removeProperty('transform');
    });
  }

  function navButton(dir) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'proj-nav ' + dir;
    btn.setAttribute('aria-label', dir === 'prev' ? 'Previous photo' : 'Next photo');
    btn.innerHTML = NAV_ICON[dir];
    return btn;
  }

  /* Builds the slider DOM for one card and returns { next } so the
     global beat can drive it. Uses a clone of the last slide before
     the first and a clone of the first slide after the last, so both
     next() and prev() can wrap seamlessly with an instant, invisible
     snap-back once the transition lands on the matching clone. */
  function buildCard(card, photos) {
    const wrap = card.querySelector('.proj-image');
    const base = wrap && wrap.querySelector('.lqip>img');
    if (!wrap || !base) return null;

    wrap.classList.add('rotating');

    const slider = document.createElement('div');
    slider.className = 'proj-slider';
    slider.setAttribute('data-rotator', '');

    const track = document.createElement('div');
    track.className = 'proj-track';
    slider.appendChild(track);

    const coverSrc = base.currentSrc || base.src;
    const real = [coverSrc].concat(photos.map(f => 'works/images/' + f));
    const N = real.length;
    const domUrls = [real[N - 1]].concat(real, [real[0]]);

    domUrls.forEach((url, i) => {
      const img = document.createElement('img');
      img.className = 'proj-slide';
      img.src = url;
      img.alt = '';
      img.loading = 'lazy';
      img.decoding = 'async';
      img.setAttribute('aria-hidden', i === 1 ? 'false' : 'true');
      track.appendChild(img);
    });

    const prevBtn = navButton('prev');
    const nextBtn = navButton('next');
    slider.appendChild(prevBtn);
    slider.appendChild(nextBtn);
    wrap.appendChild(slider);

    let domIndex = 1; /* real cover slide */
    let animating = false;

    function apply(animate) {
      if (!animate) track.style.transition = 'none';
      track.style.transform = 'translateX(-' + (domIndex * 100) + '%)';
      if (!animate) {
        void track.offsetWidth; /* force reflow before restoring transition */
        track.style.transition = '';
      }
    }
    apply(false);

    track.addEventListener('transitionend', (e) => {
      if (e.target !== track || e.propertyName !== 'transform') return;
      animating = false;
      if (domIndex === N + 1) { domIndex = 1; apply(false); }
      else if (domIndex === 0) { domIndex = N; apply(false); }
    });

    function next() {
      if (animating) return;
      animating = true;
      domIndex += 1;
      apply(true);
    }
    function prev() {
      if (animating) return;
      animating = true;
      domIndex -= 1;
      apply(true);
    }

    prevBtn.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); prev(); });
    nextBtn.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); next(); });

    let hovered = false;
    wrap.addEventListener('mouseenter', () => { hovered = true; });
    wrap.addEventListener('mouseleave', () => { hovered = false; });

    return { next, isHovered: () => hovered };
  }

  function init() {
    heal();

    const beatCards = [];

    const io = new IntersectionObserver((entries, obs) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        obs.unobserve(entry.target);
        const card = entry.target;
        const m = (card.getAttribute('href') || '').match(/works\/([a-z0-9-]+)\.html/);
        const photos = m && GALLERIES[m[1]];
        if (!photos) return;
        const api = buildCard(card, photos);
        if (api) beatCards.push(api);
      });
    }, { rootMargin: '200px' });

    document.querySelectorAll('.proj-card').forEach(card => io.observe(card));

    /* One shared beat drives every built card in unison. A card the
       cursor is currently over sits out that beat (no mid-look jump);
       it simply rejoins on whichever future beat it isn't hovered on.
       An inactive/hidden tab skips the beat entirely (self-resumes on
       the next tick once the tab is visible again). */
    setInterval(() => {
      if (REDUCED || document.hidden) return;
      beatCards.forEach(c => { if (!c.isHovered()) c.next(); });
    }, BEAT_MS);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
