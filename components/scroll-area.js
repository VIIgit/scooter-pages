/**
 * Scooter Scroll-Area Component  (custom scrollbar wrapper)
 * Usage: <div data-sc="scroll-area" data-orientation="vertical" style="height:300px">
 *          <div data-slot="scroll-area-viewport">
 *            …long content…
 *          </div>
 *          <div data-slot="scroll-area-scrollbar" data-orientation="vertical">
 *            <div data-slot="scroll-area-thumb"></div>
 *          </div>
 *        </div>
 * Options: data-orientation="vertical|horizontal|both"
 */
;(function () {
  Scooter.register('scroll-area', function (el) {
    const viewport = el.querySelector('[data-slot="scroll-area-viewport"]');
    if (!viewport) return;

    const orientations = (el.getAttribute('data-orientation') || 'vertical').split('|');

    function setupBar(axis) {
      const isV = axis === 'vertical';
      let bar = el.querySelector('[data-slot="scroll-area-scrollbar"][data-orientation="' + axis + '"]');

      // Auto-create if missing
      if (!bar) {
        bar = document.createElement('div');
        bar.setAttribute('data-slot', 'scroll-area-scrollbar');
        bar.setAttribute('data-orientation', axis);
        const thumb = document.createElement('div');
        thumb.setAttribute('data-slot', 'scroll-area-thumb');
        bar.appendChild(thumb);
        el.appendChild(bar);
      }

      const thumb = bar.querySelector('[data-slot="scroll-area-thumb"]');
      if (!thumb) return;

      function update() {
        const scrollSize = isV ? viewport.scrollHeight : viewport.scrollWidth;
        const clientSize = isV ? viewport.clientHeight : viewport.clientWidth;
        const scrollPos = isV ? viewport.scrollTop : viewport.scrollLeft;

        if (scrollSize <= clientSize) {
          bar.hidden = true;
          return;
        }
        bar.hidden = false;

        const ratio = clientSize / scrollSize;
        const thumbSize = Math.max(30, ratio * clientSize);
        const trackSpace = clientSize - thumbSize;
        const thumbPos = (scrollPos / (scrollSize - clientSize)) * trackSpace;

        if (isV) {
          thumb.style.height = thumbSize + 'px';
          thumb.style.transform = 'translateY(' + thumbPos + 'px)';
        } else {
          thumb.style.width = thumbSize + 'px';
          thumb.style.transform = 'translateX(' + thumbPos + 'px)';
        }
      }

      // Drag thumb
      let dragging = false, startPos = 0, startScroll = 0;

      thumb.addEventListener('pointerdown', function (e) {
        e.preventDefault();
        dragging = true;
        startPos = isV ? e.clientY : e.clientX;
        startScroll = isV ? viewport.scrollTop : viewport.scrollLeft;
        thumb.setPointerCapture(e.pointerId);
        bar.setAttribute('data-dragging', 'true');
      });

      thumb.addEventListener('pointermove', function (e) {
        if (!dragging) return;
        const delta = (isV ? e.clientY : e.clientX) - startPos;
        const clientSize = isV ? viewport.clientHeight : viewport.clientWidth;
        const scrollSize = isV ? viewport.scrollHeight : viewport.scrollWidth;
        const ratio = scrollSize / clientSize;
        if (isV) viewport.scrollTop = startScroll + delta * ratio;
        else viewport.scrollLeft = startScroll + delta * ratio;
      });

      thumb.addEventListener('pointerup', function () {
        dragging = false;
        bar.removeAttribute('data-dragging');
      });

      // Click on track
      bar.addEventListener('click', function (e) {
        if (e.target === thumb) return;
        const rect = bar.getBoundingClientRect();
        const pos = isV ? (e.clientY - rect.top) : (e.clientX - rect.left);
        const clientSize = isV ? viewport.clientHeight : viewport.clientWidth;
        const scrollSize = isV ? viewport.scrollHeight : viewport.scrollWidth;
        const frac = pos / clientSize;
        if (isV) viewport.scrollTop = frac * (scrollSize - clientSize);
        else viewport.scrollLeft = frac * (scrollSize - clientSize);
      });

      viewport.addEventListener('scroll', update, { passive: true });
      new ResizeObserver(update).observe(viewport);
      update();

      // Show/hide on hover
      bar.style.opacity = '0';
      el.addEventListener('mouseenter', function () { bar.style.opacity = '1'; });
      el.addEventListener('mouseleave', function () {
        if (!dragging) bar.style.opacity = '0';
      });
    }

    if (orientations.includes('vertical') || orientations.includes('both')) setupBar('vertical');
    if (orientations.includes('horizontal') || orientations.includes('both')) setupBar('horizontal');
  });
})();
