/**
 * Scooter Dropdown-Menu Component
 * Usage: <div data-sc="dropdown-menu">
 *          <button data-slot="dropdown-menu-trigger">Menu</button>
 *          <div data-slot="dropdown-menu-content">
 *            <div data-slot="dropdown-menu-label">Section</div>
 *            <button data-slot="dropdown-menu-item">Cut</button>
 *            <button data-slot="dropdown-menu-item">Copy</button>
 *            <div data-slot="dropdown-menu-separator"></div>
 *            <button data-slot="dropdown-menu-checkbox-item" data-checked="true">Show ruler</button>
 *            <div data-slot="dropdown-menu-sub">
 *              <button data-slot="dropdown-menu-sub-trigger">More ▸</button>
 *              <div data-slot="dropdown-menu-sub-content">
 *                <button data-slot="dropdown-menu-item">Sub item</button>
 *              </div>
 *            </div>
 *          </div>
 *        </div>
 * Options: data-side="bottom"  data-align="start"
 */
;(function () {
  Scooter.register('dropdown-menu', function (el) {
    const trigger = el.querySelector(':scope > [data-slot="dropdown-menu-trigger"]');
    const content = el.querySelector(':scope > [data-slot="dropdown-menu-content"]');
    if (!trigger || !content) return;

    const side = el.getAttribute('data-side') || 'bottom';
    const align = el.getAttribute('data-align') || 'start';
    let open = false;

    content.hidden = true;
    content.setAttribute('role', 'menu');
    trigger.setAttribute('aria-haspopup', 'menu');
    trigger.setAttribute('aria-expanded', 'false');

    function show() {
      content.hidden = false;
      open = true;
      document.body.appendChild(content);
      Scooter.position(content, trigger, { side, align, offset: 4 });
      trigger.setAttribute('aria-expanded', 'true');
      content.setAttribute('data-state', 'open');

      // Focus first item
      const first = content.querySelector('[data-slot="dropdown-menu-item"], [data-slot="dropdown-menu-checkbox-item"], [data-slot="dropdown-menu-sub-trigger"]');
      if (first) first.focus();

      // Arrow nav
      Scooter.arrowNav(content, '[data-slot="dropdown-menu-item"], [data-slot="dropdown-menu-checkbox-item"], [data-slot="dropdown-menu-sub-trigger"]', { wrap: true });

      requestAnimationFrame(() => {
        Scooter.onClickOutside(content, hide, trigger);
      });
    }

    function hide() {
      if (!open) return;
      content.setAttribute('data-state', 'closed');
      Scooter.animateOut(content, () => {
        content.hidden = true;
        if (content.parentElement !== el) el.appendChild(content);
      }, 150);
      trigger.setAttribute('aria-expanded', 'false');
      open = false;
      trigger.focus();
    }

    trigger.addEventListener('click', function () {
      open ? hide() : show();
    });

    // Keyboard
    content.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { e.preventDefault(); hide(); }
    });

    // Item click
    content.addEventListener('click', function (e) {
      const item = e.target.closest('[data-slot="dropdown-menu-item"]');
      if (item && !item.hasAttribute('disabled')) {
        el.dispatchEvent(new CustomEvent('sc:select', { detail: item.textContent.trim(), bubbles: true }));
        hide();
        return;
      }
      // Checkbox item toggle
      const cbItem = e.target.closest('[data-slot="dropdown-menu-checkbox-item"]');
      if (cbItem) {
        const checked = cbItem.getAttribute('data-checked') === 'true';
        cbItem.setAttribute('data-checked', String(!checked));
        el.dispatchEvent(new CustomEvent('sc:change', { detail: { label: cbItem.textContent.trim(), checked: !checked }, bubbles: true }));
      }
    });

    // Sub-menu handling
    content.querySelectorAll('[data-slot="dropdown-menu-sub"]').forEach(function (sub) {
      const subTrigger = sub.querySelector('[data-slot="dropdown-menu-sub-trigger"]');
      const subContent = sub.querySelector('[data-slot="dropdown-menu-sub-content"]');
      if (!subTrigger || !subContent) return;
      subContent.hidden = true;

      subTrigger.addEventListener('mouseenter', function () {
        subContent.hidden = false;
        subContent.setAttribute('data-state', 'open');
        Scooter.position(subContent, subTrigger, { side: 'right', align: 'start', offset: 2 });
      });

      sub.addEventListener('mouseleave', function () {
        subContent.setAttribute('data-state', 'closed');
        subContent.hidden = true;
      });

      subTrigger.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowRight' || e.key === 'Enter') {
          e.preventDefault();
          subContent.hidden = false;
          subContent.setAttribute('data-state', 'open');
          Scooter.position(subContent, subTrigger, { side: 'right', align: 'start', offset: 2 });
          const first = subContent.querySelector('[data-slot="dropdown-menu-item"]');
          if (first) first.focus();
        }
      });

      subContent.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowLeft' || e.key === 'Escape') {
          e.preventDefault();
          subContent.hidden = true;
          subTrigger.focus();
        }
      });
    });

    el._dropdownMenu = { show, hide };
  });
})();
