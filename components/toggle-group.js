/**
 * Scooter Toggle Group Component
 * Usage: <div data-sc="toggle-group" data-slot="toggle-group" data-type="single|multiple">
 *          <button data-slot="toggle-group-item" data-value="a">A</button>
 *          <button data-slot="toggle-group-item" data-value="b">B</button>
 *        </div>
 */
;(function () {
  Scooter.register('toggle-group', function (el) {
    const type = el.getAttribute('data-type') || 'single';
    const items = () => el.querySelectorAll('[data-slot="toggle-group-item"]');

    // Initialize states
    items().forEach(item => {
      if (!item.hasAttribute('aria-pressed')) item.setAttribute('aria-pressed', 'false');
      if (!item.hasAttribute('data-state')) item.setAttribute('data-state', 'off');
    });

    el.addEventListener('click', e => {
      const item = e.target.closest('[data-slot="toggle-group-item"]');
      if (!item || item.disabled) return;

      const isOn = item.getAttribute('aria-pressed') === 'true';

      if (type === 'single') {
        items().forEach(i => {
          i.setAttribute('aria-pressed', 'false');
          i.setAttribute('data-state', 'off');
        });
        if (!isOn) {
          item.setAttribute('aria-pressed', 'true');
          item.setAttribute('data-state', 'on');
        }
      } else {
        item.setAttribute('aria-pressed', String(!isOn));
        item.setAttribute('data-state', !isOn ? 'on' : 'off');
      }

      const value = [...items()]
        .filter(i => i.getAttribute('aria-pressed') === 'true')
        .map(i => i.getAttribute('data-value'));
      el.dispatchEvent(new CustomEvent('sc:change', { detail: { value }, bubbles: true }));
    });

    Scooter.arrowNav(el, '[data-slot="toggle-group-item"]', { orientation: 'horizontal' });

    // Programmatic API
    el._toggleGroup = {
      getValue: function () {
        const vals = [...items()]
          .filter(i => i.getAttribute('aria-pressed') === 'true')
          .map(i => i.getAttribute('data-value'));
        return type === 'single' ? (vals[0] || null) : vals;
      }
    };
  });
})();
