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

    function doOpen() {
      trigger.setAttribute('aria-expanded', 'true');
      content.setAttribute('data-state', 'open');
      el.dispatchEvent(new CustomEvent('sc:open', { bubbles: true }));
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

    function doClose() {
      trigger.setAttribute('aria-expanded', 'false');
      content.style.height = content.scrollHeight + 'px';
      requestAnimationFrame(() => {
        content.style.height = '0';
        content.addEventListener('transitionend', function onEnd() {
          content.setAttribute('data-state', 'closed');
          el.dispatchEvent(new CustomEvent('sc:close', { bubbles: true }));
          content.removeEventListener('transitionend', onEnd);
        });
      });
    }

    trigger.addEventListener('click', () => {
      const isOpen = content.getAttribute('data-state') === 'open';
      isOpen ? doClose() : doOpen();
    });

    // Programmatic API
    el._collapsible = {
      toggle: function () { trigger.click(); },
      open: function () { if (content.getAttribute('data-state') !== 'open') doOpen(); },
      close: function () { if (content.getAttribute('data-state') === 'open') doClose(); }
    };
  });
})();
