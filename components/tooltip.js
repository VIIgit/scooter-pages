/**
 * Scooter Tooltip Component
 * Usage: <span data-sc="tooltip">
 *          <button data-slot="tooltip-trigger">Hover me</button>
 *          <div data-slot="tooltip-content">Tooltip text</div>
 *        </span>
 * Options: data-side="top|bottom|left|right"  data-delay="300"
 */
;(function () {
  Scooter.register('tooltip', function (el) {
    let trigger = el.querySelector('[data-slot="tooltip-trigger"]');
    let content = el.querySelector('[data-slot="tooltip-content"]');

    // Shorthand: data-tooltip="text" on the element itself
    if (!trigger && el.hasAttribute('data-tooltip')) {
      trigger = el;
      content = document.createElement('div');
      content.setAttribute('data-slot', 'tooltip-content');
      content.textContent = el.getAttribute('data-tooltip');
      el.appendChild(content);
    }

    if (!trigger || !content) return;

    const side = el.getAttribute('data-tooltip-side') || el.getAttribute('data-side') || 'top';
    const delay = parseInt(el.getAttribute('data-delay') || '300', 10);
    let showTimer, hideTimer;

    content.hidden = true;
    content.setAttribute('role', 'tooltip');
    const id = Scooter.uid('tooltip');
    content.id = id;
    trigger.setAttribute('aria-describedby', id);

    function show() {
      clearTimeout(hideTimer);
      showTimer = setTimeout(() => {
        content.hidden = false;
        document.body.appendChild(content);
        Scooter.position(content, trigger, { side, offset: 6 });
      }, delay);
    }

    function hide() {
      clearTimeout(showTimer);
      hideTimer = setTimeout(() => {
        Scooter.animateOut(content, () => {
          content.hidden = true;
          // Move back to parent for cleanup
          if (content.parentElement !== el) el.appendChild(content);
        }, 100);
      }, 100);
    }

    trigger.addEventListener('mouseenter', show);
    trigger.addEventListener('mouseleave', hide);
    trigger.addEventListener('focus', show);
    trigger.addEventListener('blur', hide);

    // Close on Escape
    trigger.addEventListener('keydown', e => {
      if (e.key === 'Escape') hide();
    });
  });
})();
