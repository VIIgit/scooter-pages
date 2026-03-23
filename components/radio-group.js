/**
 * Scooter Radio Group Component
 * Usage: <div data-sc="radio-group" data-slot="radio-group" data-name="color" role="radiogroup">
 *          <div style="display:flex;align-items:center;gap:8px">
 *            <button data-slot="radio-group-item" data-value="red" role="radio" aria-checked="false">
 *              <span data-slot="radio-group-indicator"></span>
 *            </button>
 *            <label>Red</label>
 *          </div>
 *        </div>
 */
;(function () {
  Scooter.register('radio-group', function (el) {
    const name = el.getAttribute('data-name') || '';
    const items = () => el.querySelectorAll('[data-slot="radio-group-item"]');

    // Hidden input for form
    let hidden = el.querySelector(`input[type="hidden"][name="${name}"]`);
    if (!hidden && name) {
      hidden = document.createElement('input');
      hidden.type = 'hidden';
      hidden.name = name;
      el.appendChild(hidden);
    }

    // Initialize
    items().forEach(item => {
      if (!item.hasAttribute('aria-checked')) item.setAttribute('aria-checked', 'false');
      if (!item.hasAttribute('data-state')) item.setAttribute('data-state', 'unchecked');
      if (!item.hasAttribute('tabindex')) item.setAttribute('tabindex', '-1');
    });

    // Set default value
    const defaultVal = el.getAttribute('data-default-value');
    if (defaultVal) selectValue(defaultVal);
    else {
      // First checked item or make first item tabbable
      const checked = el.querySelector('[aria-checked="true"]');
      if (checked) selectValue(checked.getAttribute('data-value'));
      else { const first = items()[0]; if (first) first.setAttribute('tabindex', '0'); }
    }

    el.addEventListener('click', e => {
      const item = e.target.closest('[data-slot="radio-group-item"]');
      if (!item || item.disabled) return;
      selectValue(item.getAttribute('data-value'));
      el.dispatchEvent(new CustomEvent('sc:change', { detail: { value: item.getAttribute('data-value') }, bubbles: true }));
    });

    el.addEventListener('keydown', e => {
      if (e.key === ' ') {
        const item = e.target.closest('[data-slot="radio-group-item"]');
        if (item) { e.preventDefault(); item.click(); }
      }
    });

    Scooter.arrowNav(el, '[data-slot="radio-group-item"]', { orientation: 'vertical' });

    // After arrow nav focuses a new item, auto-select it (radio pattern)
    items().forEach(item => {
      item.addEventListener('focus', () => {
        selectValue(item.getAttribute('data-value'));
        el.dispatchEvent(new CustomEvent('sc:change', { detail: { value: item.getAttribute('data-value') }, bubbles: true }));
      });
    });

    function selectValue(value) {
      items().forEach(item => {
        const match = item.getAttribute('data-value') === value;
        item.setAttribute('aria-checked', String(match));
        item.setAttribute('data-state', match ? 'checked' : 'unchecked');
        item.setAttribute('tabindex', match ? '0' : '-1');
      });
      if (hidden) hidden.value = value || '';
    }

    // Programmatic API
    el._radioGroup = {
      getValue: function () {
        const checked = el.querySelector('[data-slot="radio-group-item"][aria-checked="true"]');
        return checked ? checked.getAttribute('data-value') : null;
      }
    };
  });
})();
