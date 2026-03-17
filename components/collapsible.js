/**
 * Scooter Collapsible Component
 * Usage: <div data-sc="collapsible">
 *          <button data-slot="collapsible-trigger">Toggle</button>
 *          <div data-slot="collapsible-content">…</div>
 *        </div>
 */
;(function () {
  Scooter.register('collapsible', function (el) {
    const trigger = el.querySelector('[data-slot="collapsible-trigger"]');
    const content = el.querySelector('[data-slot="collapsible-content"]');
    if (!trigger || !content) return;

    const startOpen = el.hasAttribute('data-default-open');
    content.setAttribute('data-state', startOpen ? 'open' : 'closed');
    trigger.setAttribute('aria-expanded', String(startOpen));
    if (!startOpen) content.style.height = '0';

    trigger.addEventListener('click', () => {
      const isOpen = content.getAttribute('data-state') === 'open';
      if (isOpen) {
        trigger.setAttribute('aria-expanded', 'false');
        content.style.height = content.scrollHeight + 'px';
        requestAnimationFrame(() => {
          content.style.height = '0';
          content.addEventListener('transitionend', function onEnd() {
            content.setAttribute('data-state', 'closed');
            content.removeEventListener('transitionend', onEnd);
          });
        });
      } else {
        trigger.setAttribute('aria-expanded', 'true');
        content.setAttribute('data-state', 'open');
        const h = content.scrollHeight;
        content.style.height = '0';
        requestAnimationFrame(() => {
          content.style.height = h + 'px';
          content.addEventListener('transitionend', function onEnd() {
            content.style.height = 'auto';
            content.removeEventListener('transitionend', onEnd);
          });
        });
      }
    });
  });
})();
