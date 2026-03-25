/**
 * Scooter Hover Card Component
 * Usage: <span data-sc="hover-card">
 *          <a data-slot="hover-card-trigger" href="#">Hover me</a>
 *          <div data-slot="hover-card-content">Rich content…</div>
 *        </span>
 * Options: data-side="bottom"  data-open-delay="500"  data-close-delay="300"
 */
;(function () {
  Scooter.register('hover-card', function (el) {
    const trigger = el.querySelector('[data-slot="hover-card-trigger"]');
    let contentSource = el.querySelector('[data-slot="hover-card-content"]');
    if (!trigger || !contentSource) return;

    // If the content is inside a <template>, clone it into a real element
    let content;
    if (contentSource.tagName === 'TEMPLATE') {
      content = document.createElement('div');
      content.setAttribute('data-slot', 'hover-card-content');
      content.appendChild(contentSource.content.cloneNode(true));
      contentSource.parentNode.replaceChild(content, contentSource);
    } else {
      content = contentSource;
    }

    const side = el.getAttribute('data-side') || 'bottom';
    const openDelay = parseInt(el.getAttribute('data-open-delay') || '500', 10);
    const closeDelay = parseInt(el.getAttribute('data-close-delay') || '300', 10);
    let showTimer, hideTimer;

    content.hidden = true;

    function show() {
      clearTimeout(hideTimer);
      showTimer = setTimeout(() => {
        content.hidden = false;
        document.body.appendChild(content);
        Scooter.position(content, trigger, { side, offset: 6 });
      }, openDelay);
    }

    function hide() {
      clearTimeout(showTimer);
      hideTimer = setTimeout(() => {
        Scooter.animateOut(content, () => {
          content.hidden = true;
          if (content.parentElement !== el) el.appendChild(content);
        }, 150);
      }, closeDelay);
    }

    trigger.addEventListener('mouseenter', show);
    trigger.addEventListener('mouseleave', hide);
    content.addEventListener('mouseenter', () => clearTimeout(hideTimer));
    content.addEventListener('mouseleave', hide);
    trigger.addEventListener('focus', show);
    trigger.addEventListener('blur', hide);
  });
})();
