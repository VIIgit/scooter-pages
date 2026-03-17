/**
 * Scooter Checkbox Component
 * Usage: <button data-sc="checkbox" data-slot="checkbox" role="checkbox" aria-checked="false" data-name="fieldName">
 *          <span data-slot="checkbox-indicator"><svg>✓</svg></span>
 *        </button>
 * A hidden <input type="checkbox"> is auto-created for form submission.
 */
;(function () {
  Scooter.register('checkbox', function (el) {
    const name = el.getAttribute('data-name') || '';
    const initial = el.getAttribute('aria-checked') === 'true' || el.getAttribute('data-state') === 'checked';

    // Create hidden input for form compat
    let hidden = el.parentElement.querySelector(`input[type="hidden"][name="${name}"]`);
    if (!hidden && name) {
      hidden = document.createElement('input');
      hidden.type = 'hidden';
      hidden.name = name;
      el.parentElement.insertBefore(hidden, el.nextSibling);
    }

    setState(initial);

    el.addEventListener('click', () => {
      if (el.disabled || el.hasAttribute('data-disabled')) return;
      const checked = el.getAttribute('aria-checked') === 'true';
      setState(!checked);
      el.dispatchEvent(new CustomEvent('sc:change', { detail: { checked: !checked }, bubbles: true }));
    });

    el.addEventListener('keydown', e => {
      if (e.key === ' ') { e.preventDefault(); el.click(); }
    });

    function setState(checked) {
      el.setAttribute('aria-checked', String(checked));
      el.setAttribute('data-state', checked ? 'checked' : 'unchecked');
      if (hidden) hidden.value = checked ? 'on' : '';
    }
  });
})();
