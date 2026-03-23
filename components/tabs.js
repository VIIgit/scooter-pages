/**
 * Scooter Tabs Component
 * Usage: <div data-sc="tabs" data-default-value="tab1">
 *          <div data-slot="tabs-list" role="tablist">
 *            <button data-slot="tabs-trigger" data-value="tab1" role="tab">Tab 1</button>
 *            <button data-slot="tabs-trigger" data-value="tab2" role="tab">Tab 2</button>
 *          </div>
 *          <div data-slot="tabs-content" data-value="tab1" role="tabpanel">…</div>
 *          <div data-slot="tabs-content" data-value="tab2" role="tabpanel">…</div>
 *        </div>
 */
;(function () {
  Scooter.register('tabs', function (el) {
    const triggers = el.querySelectorAll('[data-slot="tabs-trigger"]');
    const panels = el.querySelectorAll('[data-slot="tabs-content"]');
    const defaultVal = el.getAttribute('data-default-value');

    function activate(value, notify) {
      triggers.forEach(t => {
        const active = t.getAttribute('data-value') === value;
        t.setAttribute('aria-selected', String(active));
        t.setAttribute('data-state', active ? 'active' : 'inactive');
        t.setAttribute('tabindex', active ? '0' : '-1');
      });
      panels.forEach(p => {
        const active = p.getAttribute('data-value') === value;
        p.setAttribute('data-state', active ? 'active' : 'inactive');
        p.hidden = !active;
      });
      el.setAttribute('data-value', value);
      if (notify !== false) {
        el.dispatchEvent(new CustomEvent('sc:change', { detail: { value }, bubbles: true }));
      }
    }

    // Wire click
    triggers.forEach(t => {
      t.addEventListener('click', () => activate(t.getAttribute('data-value')));
    });

    // Keyboard navigation in tablist
    const tablist = el.querySelector('[data-slot="tabs-list"]');
    if (tablist) {
      Scooter.arrowNav(tablist, '[data-slot="tabs-trigger"]', { orientation: 'horizontal' });
      tablist.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          const t = e.target.closest('[data-slot="tabs-trigger"]');
          if (t) activate(t.getAttribute('data-value'));
        }
      });
    }

    // Initial state (no event on init)
    if (defaultVal) activate(defaultVal, false);
    else if (triggers.length) activate(triggers[0].getAttribute('data-value'), false);

    // Programmatic API
    el._tabs = {
      select: function (value) { activate(value); },
      getValue: function () { return el.getAttribute('data-value'); }
    };
  });
})();
