/**
 * Scooter Resizable Component  (split panes with draggable handle)
 * Usage: <div data-sc="resizable" data-direction="horizontal">
 *          <div data-slot="resizable-panel" data-default-size="60">Left</div>
 *          <div data-slot="resizable-handle"></div>
 *          <div data-slot="resizable-panel" data-default-size="40">Right</div>
 *        </div>
 * Options: data-direction="horizontal|vertical"
 *          data-min-size="10"  data-max-size="90"  (percentages, on panels)
 */
;(function () {
  Scooter.register('resizable', function (el) {
    const direction = el.getAttribute('data-direction') || 'horizontal';
    const horizontal = direction === 'horizontal';
    const handles = Array.from(el.querySelectorAll('[data-slot="resizable-handle"]'));
    const panels = Array.from(el.querySelectorAll('[data-slot="resizable-panel"]'));

    el.setAttribute('data-direction', direction);
    el.style.display = 'flex';
    el.style.flexDirection = horizontal ? 'row' : 'column';

    // Set initial sizes
    panels.forEach(function (p) {
      const size = p.getAttribute('data-default-size');
      if (size) {
        if (horizontal) p.style.width = size + '%';
        else p.style.height = size + '%';
      }
      p.style.overflow = 'auto';
      p.style.flexShrink = '0';
    });

    handles.forEach(function (handle, idx) {
      const before = panels[idx];
      const after = panels[idx + 1];
      if (!before || !after) return;

      handle.style.cursor = horizontal ? 'col-resize' : 'row-resize';
      let dragging = false;

      handle.addEventListener('pointerdown', function (e) {
        dragging = true;
        handle.setPointerCapture(e.pointerId);
        handle.setAttribute('data-dragging', 'true');
        document.body.style.userSelect = 'none';
      });

      handle.addEventListener('pointermove', function (e) {
        if (!dragging) return;

        const containerRect = el.getBoundingClientRect();
        const totalSize = horizontal ? containerRect.width : containerRect.height;
        const pos = horizontal ? (e.clientX - containerRect.left) : (e.clientY - containerRect.top);

        // Account for preceding panels and handles
        let offset = 0;
        for (let i = 0; i < idx; i++) {
          offset += horizontal ? panels[i].offsetWidth : panels[i].offsetHeight;
          if (handles[i]) offset += horizontal ? handles[i].offsetWidth : handles[i].offsetHeight;
        }

        const handleSize = horizontal ? handle.offsetWidth : handle.offsetHeight;
        let beforeSize = ((pos - offset) / totalSize) * 100;
        let afterSize;

        // Calculate remaining space
        let usedByOthers = 0;
        panels.forEach(function (p, i) {
          if (i !== idx && i !== idx + 1) {
            usedByOthers += horizontal ? (p.offsetWidth / totalSize * 100) : (p.offsetHeight / totalSize * 100);
          }
        });
        handles.forEach(function (h) {
          usedByOthers += horizontal ? (h.offsetWidth / totalSize * 100) : (h.offsetHeight / totalSize * 100);
        });

        afterSize = 100 - usedByOthers - beforeSize;

        // Enforce min/max
        const minB = parseFloat(before.getAttribute('data-min-size') || '10');
        const maxB = parseFloat(before.getAttribute('data-max-size') || '90');
        const minA = parseFloat(after.getAttribute('data-min-size') || '10');
        const maxA = parseFloat(after.getAttribute('data-max-size') || '90');

        beforeSize = Math.max(minB, Math.min(maxB, beforeSize));
        afterSize = Math.max(minA, Math.min(maxA, afterSize));

        if (horizontal) {
          before.style.width = beforeSize + '%';
          after.style.width = afterSize + '%';
        } else {
          before.style.height = beforeSize + '%';
          after.style.height = afterSize + '%';
        }

        el.dispatchEvent(new CustomEvent('sc:resize', {
          detail: { sizes: panels.map(function (p) { return parseFloat(horizontal ? p.style.width : p.style.height); }) },
          bubbles: true
        }));
      });

      handle.addEventListener('pointerup', function () {
        dragging = false;
        handle.removeAttribute('data-dragging');
        document.body.style.userSelect = '';
      });

      // Keyboard
      handle.setAttribute('tabindex', '0');
      handle.setAttribute('role', 'separator');
      handle.addEventListener('keydown', function (e) {
        const step = 2; // 2% per keystroke
        let delta = 0;
        if ((horizontal && e.key === 'ArrowRight') || (!horizontal && e.key === 'ArrowDown')) delta = step;
        else if ((horizontal && e.key === 'ArrowLeft') || (!horizontal && e.key === 'ArrowUp')) delta = -step;
        if (delta) {
          e.preventDefault();
          const cur = parseFloat(horizontal ? before.style.width : before.style.height) || 50;
          const curAfter = parseFloat(horizontal ? after.style.width : after.style.height) || 50;
          const newBefore = Math.max(parseFloat(before.getAttribute('data-min-size') || '10'), Math.min(parseFloat(before.getAttribute('data-max-size') || '90'), cur + delta));
          const newAfter = Math.max(parseFloat(after.getAttribute('data-min-size') || '10'), Math.min(parseFloat(after.getAttribute('data-max-size') || '90'), curAfter - delta));
          if (horizontal) {
            before.style.width = newBefore + '%';
            after.style.width = newAfter + '%';
          } else {
            before.style.height = newBefore + '%';
            after.style.height = newAfter + '%';
          }
        }
      });
    });
  });
})();
