/**
 * Scooter Progress Component
 *
 * Usage (full):
 *   <div data-sc="progress" data-value="90" data-max="100" data-color="#22c55e">
 *     <div data-slot="progress-header">
 *       <p data-slot="progress-title">Title</p>
 *       <p data-slot="progress-description">description</p>
 *       <span data-slot="progress-value"></span>
 *     </div>
 *     <div data-slot="progress">
 *       <div data-slot="progress-indicator"></div>
 *     </div>
 *   </div>
 *
 * Usage (minimal — just a bar):
 *   <div data-sc="progress" data-value="60">
 *     <div data-slot="progress">
 *       <div data-slot="progress-indicator"></div>
 *     </div>
 *   </div>
 *
 * Attributes:
 *   data-value  — current value (default 0)
 *   data-max    — maximum value (default 100)
 *   data-color  — custom indicator color (sets --progress-color)
 *
 * API (on root element):
 *   el._progress.setValue(n)  — update value programmatically
 *   el._progress.getValue()  — read current value
 *
 * Events:
 *   sc:change  — { detail: { value, max, percent } }
 */
;(function () {
  Scooter.register('progress', function (el) {
    const indicator = el.querySelector('[data-slot="progress-indicator"]');
    const valueDisplay = el.querySelector('[data-slot="progress-value"]');
    if (!indicator) return;

    const max = parseFloat(el.getAttribute('data-max') || '100');
    let value = parseFloat(el.getAttribute('data-value') || '0');

    // Apply custom color
    const color = el.getAttribute('data-color');
    if (color) {
      el.style.setProperty('--progress-color', color);
    }

    // ARIA
    el.setAttribute('role', 'progressbar');
    el.setAttribute('aria-valuemin', '0');
    el.setAttribute('aria-valuemax', String(max));

    function render() {
      const pct = Math.min(100, Math.max(0, (value / max) * 100));
      indicator.style.width = pct + '%';
      el.setAttribute('aria-valuenow', String(value));
      if (valueDisplay) {
        valueDisplay.textContent = Math.round(pct) + '%';
      }
    }

    function setValue(v) {
      v = Math.max(0, Math.min(max, v));
      if (v === value) return;
      value = v;
      el.setAttribute('data-value', String(value));
      render();
      el.dispatchEvent(new CustomEvent('sc:change', {
        detail: { value: value, max: max, percent: Math.round((value / max) * 100) },
        bubbles: true,
      }));
    }

    // Observe data-value attribute changes
    const observer = new MutationObserver(function (mutations) {
      mutations.forEach(function (m) {
        if (m.attributeName === 'data-value') {
          const v = parseFloat(el.getAttribute('data-value') || '0');
          if (v !== value) {
            value = Math.max(0, Math.min(max, v));
            render();
          }
        }
        if (m.attributeName === 'data-color') {
          const c = el.getAttribute('data-color');
          if (c) el.style.setProperty('--progress-color', c);
          else el.style.removeProperty('--progress-color');
        }
      });
    });
    observer.observe(el, { attributes: true, attributeFilter: ['data-value', 'data-color'] });

    render();

    // Public API
    el._progress = {
      setValue: setValue,
      getValue: function () { return value; },
    };
  });
})();
