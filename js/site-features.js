(() => {
  'use strict';
  const root = document.documentElement;
  const STORAGE_KEY = 'sato-clinic:text-size';
  const sizes = { standard: 1, large: 1.125, 'extra-large': 1.25 };
  const names = { standard: '標準（100%）', large: '大（112.5%）', 'extra-large': '特大（125%）' };
  const validSize = value => Object.hasOwn(sizes, value) ? value : 'standard';
  let selectedSize = 'standard';
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    selectedSize = validSize(stored);
    if (stored !== null && stored !== selectedSize) localStorage.setItem(STORAGE_KEY, selectedSize);
  } catch (_) { /* Reading remains available when storage is blocked. */ }
  root.dataset.readerSize = selectedSize;
  root.style.setProperty('--reader-scale', sizes[selectedSize]);
  if (selectedSize !== 'standard') root.setAttribute('data-reader-pending', '');
  const revealFallback = setTimeout(() => root.removeAttribute('data-reader-pending'), 2000);

  function initFaqSearch() {
    const form = document.querySelector('.faq-search');
    if (!form) return;
    const input = form.querySelector('input');
    const clear = form.querySelector('.faq-search-clear');
    const status = form.querySelector('[role="status"]');
    const normalize = text => text.normalize('NFKC').toLocaleLowerCase('ja-JP').replace(/[\s\u3000]+/g, ' ').trim();
    const groups = [...document.querySelectorAll('#faq-results .faq-group')].map(group => ({
      group, heading: group.previousElementSibling,
      items: [...group.querySelectorAll('.faq-item')].map(item => ({
        item, text: normalize(item.querySelector('summary').textContent + ' ' + item.querySelector('.faq-answer').textContent)
      }))
    }));
    let composing = false;
    function filter() {
      const terms = normalize(input.value).split(' ').filter(Boolean);
      let count = 0;
      for (const { group, heading, items } of groups) {
        let matches = 0;
        for (const { item, text } of items) {
          item.hidden = !terms.every(term => text.includes(term));
          if (!item.hidden) matches++;
        }
        group.hidden = matches === 0;
        heading.hidden = matches === 0;
        count += matches;
      }
      clear.hidden = input.value.length === 0;
      status.textContent = count ? `${count}件の質問を表示しています。` : '該当する質問が見つかりませんでした。';
      document.dispatchEvent(new Event('site:layout'));
    }
    const reset = () => { input.value = ''; filter(); input.focus(); };
    form.addEventListener('submit', event => event.preventDefault());
    input.addEventListener('compositionstart', () => { composing = true; });
    input.addEventListener('compositionend', () => { composing = false; filter(); });
    input.addEventListener('input', () => { if (!composing) filter(); });
    input.addEventListener('keydown', event => { if (event.key === 'Escape') { event.preventDefault(); reset(); } });
    clear.addEventListener('click', reset);
    form.hidden = false;
    filter();
  }

  function initTextSize() {
    const controls = [...document.querySelectorAll('.text-size-controls')];
    if (!controls.length) return;
    const selector = 'h1,h2,h3,h4,h5,h6,p,a,button,label,legend,summary,li,dt,dd,address,th,td,span,small,strong,b,em,input,textarea,select,.faq-answer';
    let measuring = false;
    let scheduled = false;
    let lastWidth = window.innerWidth;
    function measure() {
      if (measuring) return;
      measuring = true;
      // Disable only our override while measuring the existing responsive CSS.
      // Read every base value before writing any overrides to prevent nested scaling.
      root.dataset.readerSize = 'standard';
      const text = [...document.querySelectorAll(selector)].filter(element => {
        if (element.closest('.text-size-controls,.page-scroll-controls,.faq-search-clear,[aria-hidden="true"],svg')) return false;
        return element.matches('input,textarea,select,summary,th,td,.faq-answer') || [...element.childNodes].some(node => node.nodeType === Node.TEXT_NODE && node.textContent.trim());
      }).map(element => [element, getComputedStyle(element).fontSize]);
      const greetingHeight = document.querySelector('.greeting-photo')?.getBoundingClientRect().height;
      const icons = [...document.querySelectorAll('svg:not(.source-photo)')].map(element => {
        const style = getComputedStyle(element);
        return [element, style.width, style.height];
      });
      for (const [element, size] of text) {
        element.setAttribute('data-reader-base', '');
        element.style.setProperty('--reader-base-size', size);
      }
      for (const [element, width, height] of icons) {
        element.setAttribute('data-reader-icon', '');
        element.style.setProperty('--reader-icon-width', width);
        element.style.setProperty('--reader-icon-height', height);
      }
      if (greetingHeight) root.style.setProperty('--reader-greeting-height', `${greetingHeight}px`);
      root.dataset.readerSize = selectedSize;
      root.style.setProperty('--reader-scale', sizes[selectedSize]);
      measuring = false;
      document.dispatchEvent(new Event('site:layout'));
    }
    const scheduleMeasure = () => {
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(() => { scheduled = false; measure(); });
    };
    function choose(size) {
      selectedSize = validSize(size);
      measure();
      controls.forEach(control => control.querySelectorAll('[data-text-size]').forEach(button => {
        button.setAttribute('aria-pressed', String(button.dataset.textSize === selectedSize));
      }));
      try { localStorage.setItem(STORAGE_KEY, selectedSize); } catch (_) { /* Keep the current page usable. */ }
      const status = document.querySelector('#text-size-status');
      if (status) status.textContent = `文字サイズを${names[selectedSize]}に変更しました。`;
    }
    controls.forEach(control => {
      control.hidden = false;
      control.querySelectorAll('[data-text-size]').forEach(button => {
        button.setAttribute('aria-pressed', String(button.dataset.textSize === selectedSize));
        button.addEventListener('click', () => choose(button.dataset.textSize));
      });
    });
    measure();
    window.addEventListener('resize', () => {
      if (lastWidth !== window.innerWidth) { lastWidth = window.innerWidth; scheduleMeasure(); }
    }, { passive: true });
    // Reservation calendars, errors and review rows are created dynamically.
    const main = document.querySelector('main');
    if (main) new MutationObserver(scheduleMeasure).observe(main, { childList: true, subtree: true });
    document.fonts?.ready.then(scheduleMeasure);
  }

  function initScrollControls() {
    const controls = document.querySelector('.page-scroll-controls');
    if (!controls) return;
    const up = controls.querySelector('[data-scroll-direction="top"]');
    const down = controls.querySelector('[data-scroll-direction="bottom"]');
    const menu = document.querySelector('.mobile-nav');
    const bar = document.querySelector('.hero-cta');
    const protectedElements = [...document.querySelectorAll('footer,.contact-action,.reservation-actions,.reservation-edit-links,.reservation-confirm')];
    const media = matchMedia('(max-width: 767px)');
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    let scheduled = false;
    let activeScroll = null;
    let lastBottom = null;
    const endPosition = () => Math.max(0, document.documentElement.scrollHeight - innerHeight);
    const overlaps = (left, right) => left.left < right.right && left.right > right.left && left.top < right.bottom && left.bottom > right.top;
    function update() {
      scheduled = false;
      const hidden = !media.matches || !!menu?.open;
      if (controls.hidden !== hidden) controls.hidden = hidden;
      if (hidden) return;
      const atTop = scrollY <= 4;
      const atBottom = endPosition() - scrollY <= 4;
      // Batch geometry reads before writes. Resetting bottom here used to force
      // an extra layout on every scroll frame, especially costly on phones.
      const barRect = bar?.getBoundingClientRect();
      const barVisible = bar && getComputedStyle(bar).position === 'fixed' && barRect.height > 0;
      const safeArea = parseFloat(getComputedStyle(controls).getPropertyValue('--scroll-safe-area')) || 0;
      let edge = barVisible ? barRect.top - 12 : innerHeight - 16 - safeArea;
      const box = controls.getBoundingClientRect();
      const rectangles = protectedElements.map(element => element.getBoundingClientRect()).filter(rect => rect.height > 0 && rect.bottom > 0 && rect.top < innerHeight);
      for (let pass = 0; pass < rectangles.length + 1; pass++) {
        const candidate = { left: box.left, right: box.right, top: edge - box.height, bottom: edge };
        const collision = rectangles.filter(rect => overlaps(candidate, rect));
        if (!collision.length) break;
        edge = Math.min(...collision.map(rect => rect.top)) - 12;
      }
      edge = Math.max(box.height + 12, edge);
      const nextBottom = Math.max(16, innerHeight - edge);
      if (up.disabled !== atTop) up.disabled = atTop;
      if (down.disabled !== atBottom) down.disabled = atBottom;
      if (lastBottom === null || Math.abs(nextBottom - lastBottom) > 0.5) {
        controls.style.setProperty('--scroll-buttons-bottom', `${nextBottom}px`);
        lastBottom = nextBottom;
      }
    }
    const requestUpdate = () => {
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(update);
    };
    function restoreScrollBehavior(animation) {
      if (animation.behavior) root.style.setProperty('scroll-behavior', animation.behavior, animation.priority);
      else root.style.removeProperty('scroll-behavior');
    }
    function cancelScroll() {
      if (!activeScroll) return;
      cancelAnimationFrame(activeScroll.frame);
      restoreScrollBehavior(activeScroll);
      activeScroll = null;
      requestUpdate();
    }
    function move(toBottom) {
      cancelScroll();
      const from = scrollY;
      const target = toBottom ? endPosition() : 0;
      const distance = Math.abs(target - from);
      const animation = {
        toBottom, from, frame: 0, start: performance.now(),
        duration: Math.min(1400, Math.max(650, Math.sqrt(distance) * 14)),
        behavior: root.style.getPropertyValue('scroll-behavior'),
        priority: root.style.getPropertyPriority('scroll-behavior')
      };
      // Avoid combining CSS/native smooth scrolling with our per-frame motion.
      // 'auto' with this temporary override also works in older mobile browsers.
      root.style.setProperty('scroll-behavior', 'auto', 'important');
      if (reduced.matches || distance < 8) {
        window.scrollTo({ top: target, behavior: 'auto' });
        restoreScrollBehavior(animation);
        requestUpdate();
        return;
      }
      activeScroll = animation;
      const tick = now => {
        if (activeScroll !== animation) return;
        const progress = Math.min(1, (now - animation.start) / animation.duration);
        const eased = progress < 0.5 ? 4 * progress ** 3 : 1 - (-2 * progress + 2) ** 3 / 2;
        // Re-evaluate the bottom to account for a phone's changing browser bars.
        const destination = animation.toBottom ? endPosition() : 0;
        window.scrollTo({ top: animation.from + (destination - animation.from) * eased, behavior: 'auto' });
        requestUpdate();
        if (progress < 1) animation.frame = requestAnimationFrame(tick);
        else {
          restoreScrollBehavior(animation);
          activeScroll = null;
        }
      };
      animation.frame = requestAnimationFrame(tick);
    }
    up.addEventListener('click', () => move(false));
    down.addEventListener('click', () => move(true));
    // Yield immediately to intentional manual scrolling; never block gestures.
    window.addEventListener('touchstart', cancelScroll, { passive: true });
    window.addEventListener('wheel', cancelScroll, { passive: true });
    window.addEventListener('pointerdown', cancelScroll, { passive: true });
    window.addEventListener('keydown', event => {
      if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '].includes(event.key)) cancelScroll();
    });
    window.addEventListener('pagehide', cancelScroll);
    document.addEventListener('visibilitychange', () => { if (document.hidden) cancelScroll(); });
    window.addEventListener('scroll', requestUpdate, { passive: true });
    window.addEventListener('resize', requestUpdate, { passive: true });
    window.addEventListener('load', requestUpdate);
    menu?.addEventListener('toggle', () => { if (menu.open) cancelScroll(); requestUpdate(); });
    document.addEventListener('site:layout', requestUpdate);
    media.addEventListener('change', () => { if (!media.matches) cancelScroll(); requestUpdate(); });
    reduced.addEventListener('change', () => {
      if (reduced.matches && activeScroll) move(activeScroll.toBottom);
    });
    if (window.ResizeObserver) new ResizeObserver(requestUpdate).observe(document.body);
    update();
  }

  function init() {
    try {
      initFaqSearch();
      initTextSize();
      initScrollControls();
    } finally {
      clearTimeout(revealFallback);
      root.removeAttribute('data-reader-pending');
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
