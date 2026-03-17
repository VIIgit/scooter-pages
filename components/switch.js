/**
 * Scooter Switch Component
 * Usage: <button data-sc="switch" data-slot="switch" role="switch" aria-checked="false" data-name="notify">
 *          <span data-slot="switch-thumb"></span>
 *        </button>
 */
;(function () {
  Scooter.register('switch', function (el) {
    const name = el.getAttribute('data-name') || '';
    const initial = el.getAttribute('aria-checked') === 'true' || el.getAttribute('data-state') === 'checked';

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
