/**
 * Scooter Select Component  (custom dropdown select, mirrors native <select> for forms)
 * Usage: <div data-sc="select" data-placeholder="Pick one…" data-name="color">
 *          <button data-slot="select-trigger">
 *            <span data-slot="select-value">Pick one…</span>
 *          </button>
 *          <div data-slot="select-content">
 *            <div data-slot="select-group">
 *              <div data-slot="select-label">Colors</div>
 *              <div data-slot="select-item" data-value="red">Red</div>
 *              <div data-slot="select-item" data-value="blue">Blue</div>
 *              <div data-slot="select-separator"></div>
 *              <div data-slot="select-item" data-value="green">Green</div>
 *            </div>
 *          </div>
 *        </div>
 * Options: data-default-value="blue"  data-name="fieldName"
 */
;(function () {
  Scooter.register('select', function (el) {
    const trigger = el.querySelector('[data-slot="select-trigger"]');
    const valSpan = el.querySelector('[data-slot="select-value"]');
    const content = el.querySelector('[data-slot="select-content"]');
    if (!trigger || !content) return;

    const placeholder = el.getAttribute('data-placeholder') || '';
    const name = el.getAttribute('data-name') || '';
    let value = el.getAttribute('data-default-value') || '';
    let open = false;

    // Hidden native select for form submission
    let hidden = el.querySelector('select[data-slot="select-native"]');
    if (!hidden && name) {
      hidden = document.createElement('select');
      hidden.name = name;
      hidden.setAttribute('data-slot', 'select-native');
      hidden.tabIndex = -1;
      hidden.setAttribute('aria-hidden', 'true');
      hidden.style.cssText = 'position:absolute;width:0;height:0;opacity:0;pointer-events:none';
      el.appendChild(hidden);
      // Sync options
      content.querySelectorAll('[data-slot="select-item"]').forEach(function (item) {
        const opt = document.createElement('option');
        opt.value = item.getAttribute('data-value') || item.textContent.trim();
        opt.textContent = item.textContent.trim();
        hidden.appendChild(opt);
      });
    }

    content.hidden = true;
    content.setAttribute('role', 'listbox');
    trigger.setAttribute('aria-haspopup', 'listbox');
    trigger.setAttribute('aria-expanded', 'false');

    function setValue(v) {
      value = v;
      const item = content.querySelector('[data-slot="select-item"][data-value="' + v + '"]');
      if (valSpan) valSpan.textContent = item ? item.textContent.trim() : v;
      if (hidden) hidden.value = v;
      // Mark selected
      content.querySelectorAll('[data-slot="select-item"]').forEach(function (it) {
        it.setAttribute('data-selected', it.getAttribute('data-value') === v ? 'true' : 'false');
        it.setAttribute('aria-selected', it.getAttribute('data-value') === v ? 'true' : 'false');
      });
      el.dispatchEvent(new CustomEvent('sc:change', { detail: v, bubbles: true }));
    }

    function show() {
      content.hidden = false;
      open = true;
      document.body.appendChild(content);
      Scooter.position(content, trigger, { side: 'bottom', align: 'start', offset: 4, matchWidth: true });
      trigger.setAttribute('aria-expanded', 'true');
      content.setAttribute('data-state', 'open');

      // Focus selected or first
      const sel = content.querySelector('[data-selected="true"]') ||
        content.querySelector('[data-slot="select-item"]');
      if (sel) sel.focus();

      Scooter.arrowNav(content, '[data-slot="select-item"]', { wrap: true });
      requestAnimationFrame(() => Scooter.onClickOutside(content, hide, trigger));
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
    }

    trigger.addEventListener('click', function () {
      open ? hide() : show();
    });

    trigger.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault();
        if (!open) show();
      }
    });

    // Item selection
    content.addEventListener('click', function (e) {
      const item = e.target.closest('[data-slot="select-item"]');
      if (item && !item.hasAttribute('disabled')) {
        setValue(item.getAttribute('data-value') || item.textContent.trim());
        hide();
        trigger.focus();
      }
    });

    content.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { e.preventDefault(); hide(); trigger.focus(); }
      if (e.key === 'Enter') {
        const focused = document.activeElement;
        if (focused && focused.matches('[data-slot="select-item"]')) {
          e.preventDefault();
          setValue(focused.getAttribute('data-value') || focused.textContent.trim());
          hide();
          trigger.focus();
        }
      }
    });

    // Set initial value
    if (value) setValue(value);
    else if (valSpan && placeholder) valSpan.textContent = placeholder;

    el._select = { show, hide, getValue: () => value, setValue };
  });
})();
