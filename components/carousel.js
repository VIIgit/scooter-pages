/**
 * Scooter Carousel Component
 * Usage: <div data-sc="carousel" data-orientation="horizontal">
 *          <div data-slot="carousel-content">
 *            <div data-slot="carousel-item">Slide 1</div>
 *            <div data-slot="carousel-item">Slide 2</div>
 *            <div data-slot="carousel-item">Slide 3</div>
 *          </div>
 *          <button data-slot="carousel-previous">‹</button>
 *          <button data-slot="carousel-next">›</button>
 *        </div>
 * Options: data-loop="false" data-auto-play="0" (ms, 0=off)
 */
;(function () {
  Scooter.register('carousel', function (el) {
    const content = el.querySelector('[data-slot="carousel-content"]');
    const prevBtn = el.querySelector('[data-slot="carousel-previous"]');
    const nextBtn = el.querySelector('[data-slot="carousel-next"]');
    if (!content) return;

    const orientation = el.getAttribute('data-orientation') || 'horizontal';
    const loop = el.getAttribute('data-loop') === 'true';
    const autoPlay = parseInt(el.getAttribute('data-auto-play') || '0', 10);
    const horizontal = orientation === 'horizontal';

    const items = () => Array.from(content.querySelectorAll('[data-slot="carousel-item"]'));
    let current = 0;
    let autoTimer = null;

    function update() {
      const slides = items();
      if (!slides.length) return;
      current = Math.max(0, Math.min(current, slides.length - 1));

      // Scroll to current
      const target = slides[current];
      if (horizontal) {
        content.scrollTo({ left: target.offsetLeft - content.offsetLeft, behavior: 'smooth' });
      } else {
        content.scrollTo({ top: target.offsetTop - content.offsetTop, behavior: 'smooth' });
      }

      // Disable buttons at ends
      if (prevBtn) prevBtn.disabled = !loop && current === 0;
      if (nextBtn) nextBtn.disabled = !loop && current === slides.length - 1;

      slides.forEach((s, i) => s.setAttribute('data-active', i === current ? 'true' : 'false'));
      el.dispatchEvent(new CustomEvent('sc:slide', { detail: current, bubbles: true }));
    }

    function next() {
      const slides = items();
      if (current < slides.length - 1) current++;
      else if (loop) current = 0;
      update();
    }

    function prev() {
      if (current > 0) current--;
      else if (loop) current = items().length - 1;
      update();
    }

    if (nextBtn) nextBtn.addEventListener('click', next);
    if (prevBtn) prevBtn.addEventListener('click', prev);

    // Keyboard
    el.addEventListener('keydown', function (e) {
      if ((horizontal && e.key === 'ArrowRight') || (!horizontal && e.key === 'ArrowDown')) {
        e.preventDefault(); next();
      } else if ((horizontal && e.key === 'ArrowLeft') || (!horizontal && e.key === 'ArrowUp')) {
        e.preventDefault(); prev();
      }
    });

    // Touch / swipe
    let startX = 0, startY = 0;
    content.addEventListener('touchstart', function (e) {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
    }, { passive: true });

    content.addEventListener('touchend', function (e) {
      const dx = e.changedTouches[0].clientX - startX;
      const dy = e.changedTouches[0].clientY - startY;
      const dist = horizontal ? dx : dy;
      if (Math.abs(dist) > 50) {
        dist < 0 ? next() : prev();
      }
    }, { passive: true });

    // Auto-play
    if (autoPlay > 0) {
      autoTimer = setInterval(next, autoPlay);
      el.addEventListener('mouseenter', () => clearInterval(autoTimer));
      el.addEventListener('mouseleave', () => { autoTimer = setInterval(next, autoPlay); });
    }

    update();
    el._carousel = { next, prev, goTo: function (i) { current = i; update(); }, getCurrent: () => current };
  });
})();
