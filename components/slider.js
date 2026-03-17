/**
 * Scooter Slider Component
 * Usage: <div data-sc="slider" data-min="0" data-max="100" data-step="1" data-value="50" data-name="volume">
 *          <div data-slot="slider-track">
 *            <div data-slot="slider-range"></div>
 *          </div>
 *          <div data-slot="slider-thumb" tabindex="0"></div>
 *        </div>
 * Options: data-orientation="horizontal"  data-min  data-max  data-step  data-value  data-name
 */
;(function () {
  Scooter.register('slider', function (el) {
    const track = el.querySelector('[data-slot="slider-track"]');
    const range = el.querySelector('[data-slot="slider-range"]');
    const thumb = el.querySelector('[data-slot="slider-thumb"]');
    if (!track || !thumb) return;

    const orientation = el.getAttribute('data-orientation') || 'horizontal';
    const min = parseFloat(el.getAttribute('data-min') || '0');
    const max = parseFloat(el.getAttribute('data-max') || '100');
    const step = parseFloat(el.getAttribute('data-step') || '1');
    const name = el.getAttribute('data-name') || '';
    let value = parseFloat(el.getAttribute('data-value') || String(min));

    let hidden;
    if (name) {
      hidden = document.createElement('input');
      hidden.type = 'hidden';
      hidden.name = name;
      el.appendChild(hidden);
    }

    const horizontal = orientation === 'horizontal';
    el.setAttribute('data-orientation', orientation);
    el.setAttribute('role', 'slider');
    el.setAttribute('aria-valuemin', min);
    el.setAttribute('aria-valuemax', max);

    function pct() { return ((value - min) / (max - min)) * 100; }

    function render() {
      const p = pct() + '%';
      if (horizontal) {
        thumb.style.left = p;
        if (range) range.style.width = p;
      } else {
        thumb.style.bottom = p;
        if (range) range.style.height = p;
      }
      el.setAttribute('aria-valuenow', value);
      if (hidden) hidden.value = value;
    }

    function setValue(v) {
      // Snap to step
      v = Math.round((v - min) / step) * step + min;
      v = Math.max(min, Math.min(max, v));
      if (v === value) return;
      value = v;
      render();
      el.dispatchEvent(new CustomEvent('sc:change', { detail: value, bubbles: true }));
    }

    function posToVal(clientX, clientY) {
      const rect = track.getBoundingClientRect();
      let frac;
      if (horizontal) {
        frac = (clientX - rect.left) / rect.width;
      } else {
        frac = 1 - (clientY - rect.top) / rect.height;
      }
      frac = Math.max(0, Math.min(1, frac));
      return min + frac * (max - min);
    }

    // Drag
    let dragging = false;

    function onDown(e) {
      dragging = true;
      thumb.setPointerCapture(e.pointerId);
      setValue(posToVal(e.clientX, e.clientY));
    }

    thumb.addEventListener('pointerdown', onDown);
    track.addEventListener('pointerdown', onDown);

    thumb.addEventListener('pointermove', function (e) {
      if (!dragging) return;
      setValue(posToVal(e.clientX, e.clientY));
    });

    thumb.addEventListener('pointerup', function () {
      dragging = false;
    });

    // Keyboard
    thumb.addEventListener('keydown', function (e) {
      let d = 0;
      if (e.key === 'ArrowRight' || e.key === 'ArrowUp') d = step;
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') d = -step;
      else if (e.key === 'Home') { e.preventDefault(); setValue(min); return; }
      else if (e.key === 'End') { e.preventDefault(); setValue(max); return; }
      if (d) { e.preventDefault(); setValue(value + d); }
    });

    render();
    el._slider = { getValue: () => value, setValue };
  });
})();
