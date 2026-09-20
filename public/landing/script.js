(() => {
  'use strict';
  const $ = selector => document.querySelector(selector);
  const $$ = selector => [...document.querySelectorAll(selector)];
  const media = window.matchMedia('(prefers-reduced-motion: reduce)');
  const frame = $('.demo-frame');
  const occurrences = $$('[data-occurrence]');
  const rows = $$('.match-row');
  const steps = $$('[data-step]');
  const journey = $$('[data-journey]');
  const examples = [
    { before: 'Contact us', after: "Let's talk", type: 'Text' },
    { before: '$489,000', after: '$519,000', type: 'Price' },
    { before: 'hello@acme.com', after: 'team@acme.com', type: 'Contact' }
  ];
  const timing = { review: 2400, approved: 5700, replacing: 6500, done: 7700, cycle: 11100 };
  let exampleIndex = 0;
  let elapsed = 0;
  let previousTime = null;
  let animationFrame = null;
  let sceneVisible = false;
  let previousSignature = '';
  let previousReducedMotion = media.matches;

  function motionEnabled() { return !media.matches; }
  function setText(selector, text) {
    const element = $(selector);
    if (element.textContent !== text) element.textContent = text;
  }
  function getPhase() {
    if (elapsed < timing.review) return 'find';
    if (elapsed < timing.approved) return 'review';
    if (elapsed < timing.replacing) return 'approved';
    if (elapsed < timing.done) return 'replacing';
    return 'done';
  }
  function renderScene(overview = false) {
    const example = examples[exampleIndex];
    const phase = overview ? 'overview' : getPhase();
    const found = overview || elapsed >= timing.review ? 4 : Math.min(4, Math.max(0, Math.floor((elapsed - 250) / 400) + 1));
    const updated = overview || elapsed >= timing.done ? 4 : elapsed < timing.replacing ? 0 : Math.min(4, Math.floor((elapsed - timing.replacing) / 300) + 1);
    const characterCount = overview || elapsed >= timing.approved ? example.after.length : Math.min(example.after.length, Math.max(0, Math.floor((elapsed - timing.review) / 65)));
    const typed = example.after.slice(0, characterCount);
    const stage = phase === 'find' ? 'find' : ['review', 'approved'].includes(phase) ? 'review' : 'done';
    const signature = [exampleIndex, phase, found, updated, characterCount].join('|');
    if (signature !== previousSignature) {
      previousSignature = signature;
      frame.dataset.phase = phase;
      frame.dataset.example = example.type.toLowerCase();
      frame.classList.toggle('is-typing', phase === 'review' && characterCount < example.after.length);
      setText('#find-value', example.before);
      setText('#replace-value', typed || '—');
      setText('#review-old', example.before);
      setText('#review-new', example.after);
      setText('#walkthrough-example', example.type.toUpperCase());
      setText('#walkthrough-number', overview ? '01—03' : stage === 'find' ? '01' : stage === 'review' ? '02' : '03');
      const narration = {
        find: ['Find every repeated occurrence.', 'One search brings matching content together across your CMS.'],
        review: ['See exactly what will change.', 'Compare the current content with the replacement before approving.'],
        approved: ['Reviewed. Approved. Ready to replace.', 'The change is approved. Publishing remains a separate step.'],
        replacing: ['One change, updating everywhere.', 'The approved replacement reaches each matching occurrence.'],
        done: ['Four occurrences. One consistent message.', 'Every occurrence is updated. Nothing is published automatically.'],
        overview: ['Find it. Review it. Replace it everywhere.', 'Four matching occurrences. One reviewed replacement. No automatic publishing.']
      };
      setText('#walkthrough-title', narration[phase][0]);
      setText('#walkthrough-description', narration[phase][1]);
      setText('#match-count', updated ? `${updated} of 4 occurrences updated` : `${found} occurrences found`);
      setText('#selection-count', phase === 'find' ? 'Finding matches' : updated ? 'After approval' : 'Reviewing all 4');
      setText('#site-status', updated ? `${updated} of 4 updated` : `${found} matching occurrences`);
      const status = { find: 'Finding matching content…', review: 'Review before applying', approved: 'Change approved', replacing: `Replacing ${updated} of 4 occurrences…`, done: 'All 4 occurrences updated', overview: 'All 4 occurrences updated' };
      setText('#demo-action span', status[phase]);
      $('#demo-action use').setAttribute('href', phase === 'find' ? '#i-search' : phase === 'review' ? '#i-eye' : phase === 'replacing' ? '#i-replace' : '#i-check');
      setText('#demo-message', phase === 'done' || overview ? 'Changes applied to sample data. No live site was changed.' : phase === 'approved' || phase === 'replacing' ? 'Approval is shown as part of this example.' : 'Changes require approval. Publishing stays in your hands.');
      occurrences.forEach((element, index) => {
        const changed = index < updated;
        const detected = index < found;
        const text = changed ? example.after : example.before;
        if (element.textContent !== text) element.textContent = text;
        element.classList.toggle('matched', detected && !changed);
        element.classList.toggle('updated', changed);
        rows[index].classList.toggle('is-found', detected);
        rows[index].classList.toggle('is-updated', changed);
        rows[index].querySelector('.match-state').textContent = changed ? 'Updated' : detected ? 'Found' : 'Scanning';
      });
      steps.forEach(element => {
        const active = !overview && element.dataset.step === stage;
        element.classList.toggle('active', active);
        if (active) element.setAttribute('aria-current', 'step');
        else element.removeAttribute('aria-current');
      });
      journey.forEach((element, index) => {
        const activeIndex = stage === 'find' ? 0 : stage === 'review' ? 1 : 2;
        element.classList.toggle('active', !overview && index === activeIndex);
        element.classList.toggle('complete', overview || index < activeIndex || phase === 'done');
      });
    }
    const spans = [[0, timing.review], [timing.review, timing.replacing], [timing.replacing, timing.cycle]];
    journey.forEach((element, index) => {
      const [start, end] = spans[index];
      const progress = overview ? 1 : Math.min(1, Math.max(0, (elapsed - start) / (end - start)));
      element.style.setProperty('--stage-progress', String(progress));
    });
  }
  function tick(now) {
    animationFrame = null;
    if (!sceneVisible || document.hidden || !motionEnabled()) { previousTime = null; return; }
    if (previousTime !== null) elapsed += now - previousTime;
    previousTime = now;
    if (elapsed >= timing.cycle) {
      elapsed %= timing.cycle;
      exampleIndex = (exampleIndex + 1) % examples.length;
    }
    renderScene();
    animationFrame = requestAnimationFrame(tick);
  }
  function syncWalkthrough() {
    if (previousReducedMotion !== media.matches) {
      previousReducedMotion = media.matches;
      elapsed = 0;
      previousSignature = '';
      previousTime = null;
    }
    const shouldRun = sceneVisible && !document.hidden && motionEnabled();
    if (!shouldRun) {
      if (animationFrame !== null) cancelAnimationFrame(animationFrame);
      animationFrame = null;
      previousTime = null;
      if (media.matches) renderScene(true);
      return;
    }
    if (animationFrame === null) animationFrame = requestAnimationFrame(tick);
  }
  if ('IntersectionObserver' in window) {
    const sceneObserver = new IntersectionObserver(entries => {
      sceneVisible = entries[0].isIntersecting;
      syncWalkthrough();
    }, { threshold: 0 });
    sceneObserver.observe(frame);
  } else sceneVisible = true;
  renderScene(media.matches);
  const menuButton = $('.menu-toggle');
  const nav = $('#navigation');
  function closeMenu() { nav.classList.remove('open'); menuButton.setAttribute('aria-expanded', 'false'); menuButton.setAttribute('aria-label', 'Open navigation'); }
  menuButton.addEventListener('click', () => {
    const open = !nav.classList.contains('open');
    nav.classList.toggle('open', open);
    menuButton.setAttribute('aria-expanded', String(open));
    menuButton.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
  });
  nav.addEventListener('click', event => { if (event.target.closest('a')) closeMenu(); });
  document.addEventListener('keydown', event => { if (event.key === 'Escape') { closeMenu(); menuButton.blur(); } });
  // Progressive enhancement: all content remains visible without motion or JS.
  const root = document.documentElement;
  const progress = $('.reading-progress');
  const entering = new Set();
  const entrances = new Set();
  const seen = new WeakSet();
  let progressFrame = 0;

  function animateElement(element, keyframes, options) {
    if (!motionEnabled() || document.hidden || !element.animate) return;
    const animation = element.animate(keyframes, options);
    entrances.add(animation);
    animation.finished.then(() => entrances.delete(animation)).catch(() => entrances.delete(animation));
  }
  function animateHero() {
    if (window.scrollY > $('.hero').offsetHeight || window.location.hash) return;
    const sequence = ['.hero-eyebrow', '#hero-title', '.hero-description', '.hero-actions', '.hero-meta', '.demo-frame'];
    sequence.forEach((selector, index) => animateElement($(selector), [
      { opacity: 0, transform: 'translateY(24px)', filter: 'blur(4px)' },
      { opacity: 1, transform: 'translateY(0)', filter: 'blur(0)' }
    ], { duration: 780, delay: index * 75, easing: 'cubic-bezier(.16,1,.3,1)', fill: 'backwards' }));
  }
  function reveal(element) {
    if (seen.has(element) || !motionEnabled() || document.hidden) return;
    seen.add(element);
    const group = element.parentElement;
    const siblings = [...group.children].filter(child => entering.has(child));
    const delay = window.innerWidth > 760 ? Math.max(0, siblings.indexOf(element)) * 85 : 0;
    animateElement(element, [
      { opacity: 0.45, transform: 'translateY(24px)' },
      { opacity: 1, transform: 'translateY(0)' }
    ], { duration: 650, delay, easing: 'cubic-bezier(.16,1,.3,1)', fill: 'none' });
  }
  const entranceSelectors = [
    '.problem-layout > div', '.section-heading', '.workflow-card',
    '.use-heading', '.use-grid article', '.safety-intro', '.safety-list article',
    '.managed-heading', '.managed-benefits article', '.managed-cta', '.pricing-card', '.comparison-heading',
    '.faq-layout > div:first-child', '.faq-list details', '.final-copy', '.final-art'
  ];
  entranceSelectors.flatMap(selector => $$(selector)).forEach(element => entering.add(element));

  if ('IntersectionObserver' in window) {
    const entranceObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => { if (entry.isIntersecting) reveal(entry.target); });
    }, { threshold: 0.12 });
    entering.forEach(element => entranceObserver.observe(element));
    const ambientObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        entry.target.classList.toggle('motion-in-view', entry.isIntersecting);
      });
    }, { threshold: 0.08 });
    $$('.hero, .demo-frame, .scattered-visual, .workflow-card, .use-grid article, .final-art').forEach(element => ambientObserver.observe(element));
  }

  // A short, one-time product illustration; the complete view is the default.
  // Use the page's existing easing and native animation path, with no new dependency.
  const managedDashboard = $('.managed-dashboard');
  const managedDetail = $('.managed-detail');
  const managedRows = $$('.managed-row');
  let managedSeen = false;
  let managedDetailSeen = false;
  function revealManagedDetail(delay = 0) {
    if (managedDetailSeen || !motionEnabled() || document.hidden) return;
    managedDetailSeen = true;
    animateElement(managedDetail, [
      { opacity: 0, transform: 'translateX(18px)' },
      { opacity: 1, transform: 'translateX(0)' }
    ], { duration: 700, delay, easing: 'cubic-bezier(.16,1,.3,1)', fill: 'backwards' });
    $$('.linked-fields li').forEach((element, index) => animateElement(element, [
      { backgroundColor: 'transparent' },
      { backgroundColor: 'var(--soft-blue)', offset: 0.4 },
      { backgroundColor: 'transparent' }
    ], { duration: 850, delay: delay + 550 + index * 130, easing: 'ease-in-out' }));
  }
  function revealManagedValues() {
    if (managedSeen || !motionEnabled() || document.hidden) return;
    managedSeen = true;
    managedDashboard.dataset.revealed = 'true';
    animateElement(managedDashboard, [
      { opacity: 0.6, transform: 'translateY(20px)' },
      { opacity: 1, transform: 'translateY(0)' }
    ], { duration: 700, easing: 'cubic-bezier(.16,1,.3,1)' });
    managedRows.forEach((row, index) => animateElement(row, [
      { opacity: 0.2, transform: 'translateY(10px)' },
      { opacity: 1, transform: 'translateY(0)' }
    ], { duration: 550, delay: 150 + index * 110, easing: 'cubic-bezier(.16,1,.3,1)', fill: 'backwards' }));
    animateElement($('.selected-value'), [
      { backgroundColor: 'var(--white)' },
      { backgroundColor: 'var(--soft-blue)' }
    ], { duration: 450, delay: 900, easing: 'ease-out', fill: 'backwards' });
    if (window.innerWidth > 760) revealManagedDetail(1200);
  }
  if (managedDashboard && 'IntersectionObserver' in window) {
    const managedObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        if (entry.target === managedDashboard) revealManagedValues();
        if (entry.target === managedDetail && window.innerWidth <= 760) revealManagedDetail(100);
      });
    }, { threshold: 0.18 });
    managedObserver.observe(managedDashboard);
    managedObserver.observe(managedDetail);
  }

  function updateProgress() {
    progressFrame = 0;
    if (!motionEnabled() || document.hidden) return;
    const distance = root.scrollHeight - window.innerHeight;
    const amount = distance > 0 ? Math.min(1, Math.max(0, window.scrollY / distance)) : 0;
    progress.style.transform = `scaleX(${amount})`;
  }
  function queueProgress() {
    if (!progressFrame && motionEnabled() && !document.hidden) progressFrame = requestAnimationFrame(updateProgress);
  }
  window.addEventListener('scroll', queueProgress, { passive: true });
  window.addEventListener('resize', queueProgress, { passive: true });

  function syncMotion() {
    const enabled = motionEnabled();
    root.dataset.motion = enabled ? 'on' : 'off';
    root.classList.toggle('motion-background', document.hidden);
    progress.hidden = !enabled;
    if (!enabled) {
      entrances.forEach(animation => animation.cancel());
      if (progressFrame) { cancelAnimationFrame(progressFrame); progressFrame = 0; }
    } else {
      entering.forEach(element => {
        const rect = element.getBoundingClientRect();
        if (rect.top < window.innerHeight && rect.bottom > 0) reveal(element);
      });
      queueProgress();
    }
    syncWalkthrough();
  }
  media.addEventListener('change', syncMotion);
  document.addEventListener('visibilitychange', () => {
    root.classList.toggle('motion-background', document.hidden);
    if (document.hidden) entrances.forEach(animation => animation.cancel());
    else queueProgress();
    syncWalkthrough();
  });
  $$('.faq-list details').forEach(details => details.addEventListener('toggle', () => {
    if (details.open) animateElement(details.querySelector('p'), [
      { opacity: 0.4, transform: 'translateY(-6px)' },
      { opacity: 1, transform: 'translateY(0)' }
    ], { duration: 280, easing: 'ease-out' });
  }));
  syncMotion();
  animateHero();
})();
