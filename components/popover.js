/**
 * Scooter Popover Component
 * Usage: <div data-sc="popover">
 *          <button data-slot="popover-trigger">Click me</button>
 *          <div data-slot="popover-content">
 *            <p>Rich content here…</p>
 *          </div>
 *        </div>
 * Options: data-side="bottom"  data-align="center"
 */
;(function () {
  Scooter.register('popover', function (el) {
    const trigger = el.querySelector('[data-slot="popover-trigger"]');
    const content = el.querySelector('[data-slot="popover-content"]');
    if (!trigger || !content) return;

    const side = el.getAttribute('data-side') || 'bottom';
    const align = el.getAttribute('data-align') || 'center';
    let open = false;

    content.hidden = true;
    trigger.setAttribute('aria-expanded', 'false');

    function show() {
      content.hidden = false;
      open = true;
      document.body.appendChild(content);
      Scooter.position(content, trigger, { side, align, offset: 6 });
      trigger.setAttribute('aria-expanded', 'true');
      content.setAttribute('data-state', 'open');

      // Focus first focusable
      const focusable = content.querySelector('input, button, [tabindex]');
      if (focusable) focusable.focus();

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
    }

    trigger.addEventListener('click', function () {
      open ? hide() : show();
    });

    content.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { e.preventDefault(); hide(); trigger.focus(); }
    });

    el._popover = { show, hide };
  });
})();
