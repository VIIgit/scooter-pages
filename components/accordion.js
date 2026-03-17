/**
 * Scooter Accordion Component
 * Usage: <div data-sc="accordion" data-type="single|multiple">
 *          <div data-slot="accordion-item">
 *            <button data-slot="accordion-trigger">Title <svg>chevron</svg></button>
 *            <div data-slot="accordion-content"><div data-slot="accordion-content-inner">…</div></div>
 *          </div>
 *        </div>
 */
;(function () {
  Scooter.register('accordion', function (el) {
    const type = el.getAttribute('data-type') || 'single'; // single | multiple

    el.querySelectorAll('[data-slot="accordion-item"]').forEach(item => {
      const trigger = item.querySelector('[data-slot="accordion-trigger"]');
      const content = item.querySelector('[data-slot="accordion-content"]');
      if (!trigger || !content) return;

      // Ensure initial state
      const startOpen = item.hasAttribute('data-default-open');
      const state = startOpen ? 'open' : 'closed';
      content.setAttribute('data-state', state);
      trigger.setAttribute('aria-expanded', String(startOpen));
      if (state === 'closed') content.style.height = '0';

      trigger.addEventListener('click', () => {
        const isOpen = content.getAttribute('data-state') === 'open';

        // In single mode, close all other items first
        if (type === 'single' && !isOpen) {
          el.querySelectorAll('[data-slot="accordion-item"]').forEach(other => {
            if (other === item) return;
            closeItem(other);
          });
        }

        if (isOpen) {
          closeItem(item);
        } else {
          openItem(item);
        }
      });
    });

    function openItem(item) {
      const trigger = item.querySelector('[data-slot="accordion-trigger"]');
      const content = item.querySelector('[data-slot="accordion-content"]');
      const inner = content.querySelector('[data-slot="accordion-content-inner"]') || content.firstElementChild;
      if (!inner) return;

      trigger.setAttribute('aria-expanded', 'true');
      content.setAttribute('data-state', 'open');
      const targetHeight = inner.scrollHeight;
      content.style.height = '0';
      requestAnimationFrame(() => {
        content.style.height = targetHeight + 'px';
        // After transition, set auto for dynamic content
        const onEnd = () => {
          content.style.height = 'auto';
          content.removeEventListener('transitionend', onEnd);
        };
        content.addEventListener('transitionend', onEnd);
      });
    }

    function closeItem(item) {
      const trigger = item.querySelector('[data-slot="accordion-trigger"]');
      const content = item.querySelector('[data-slot="accordion-content"]');

      trigger.setAttribute('aria-expanded', 'false');
      // Set explicit height first so transition works
      content.style.height = content.scrollHeight + 'px';
      requestAnimationFrame(() => {
        content.style.height = '0';
        const onEnd = () => {
          content.setAttribute('data-state', 'closed');
          content.removeEventListener('transitionend', onEnd);
        };
        content.addEventListener('transitionend', onEnd);
      });
    }
  });
})();
