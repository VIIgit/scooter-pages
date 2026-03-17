/**
 * Scooter Navigation-Menu Component
 * Usage: <nav data-sc="navigation-menu">
 *          <ul data-slot="navigation-menu-list">
 *            <li data-slot="navigation-menu-item">
 *              <button data-slot="navigation-menu-trigger">Products</button>
 *              <div data-slot="navigation-menu-content">
 *                <a data-slot="navigation-menu-link" href="#">Link 1</a>
 *                …
 *              </div>
 *            </li>
 *            <li data-slot="navigation-menu-item">
 *              <a data-slot="navigation-menu-link" href="#">Pricing</a>
 *            </li>
 *          </ul>
 *          <div data-slot="navigation-menu-viewport"></div>
 *        </nav>
 */
;(function () {
  Scooter.register('navigation-menu', function (el) {
    const items = el.querySelectorAll('[data-slot="navigation-menu-item"]');
    const viewport = el.querySelector('[data-slot="navigation-menu-viewport"]');

    let activeItem = null, hideTimer = null;

    function show(item) {
      clearTimeout(hideTimer);
      if (activeItem && activeItem !== item) hideNow(activeItem);

      const trig = item.querySelector('[data-slot="navigation-menu-trigger"]');
      const content = item.querySelector('[data-slot="navigation-menu-content"]');
      if (!content) return;

      activeItem = item;
      content.hidden = false;
      content.setAttribute('data-state', 'open');
      if (trig) trig.setAttribute('data-state', 'open');

      if (viewport) {
        viewport.hidden = false;
        viewport.innerHTML = '';
        viewport.appendChild(content);
        Scooter.position(viewport, trig || item, { side: 'bottom', align: 'start', offset: 4, matchWidth: false });
      }
    }

    function scheduleHide(item) {
      hideTimer = setTimeout(function () { hideNow(item); }, 200);
    }

    function hideNow(item) {
      const trig = item.querySelector('[data-slot="navigation-menu-trigger"]');
      const content = item.querySelector('[data-slot="navigation-menu-content"]');
      if (content) {
        content.setAttribute('data-state', 'closed');
        content.hidden = true;
        // Return content to its item if it was moved to viewport
        if (viewport && content.parentElement === viewport) {
          item.appendChild(content);
        }
      }
      if (trig) trig.removeAttribute('data-state');
      if (activeItem === item) activeItem = null;
      if (viewport) viewport.hidden = true;
    }

    items.forEach(function (item) {
      const trig = item.querySelector('[data-slot="navigation-menu-trigger"]');
      const content = item.querySelector('[data-slot="navigation-menu-content"]');
      if (!trig || !content) return;

      content.hidden = true;

      trig.addEventListener('mouseenter', function () { show(item); });
      item.addEventListener('mouseleave', function () { scheduleHide(item); });
      if (content) content.addEventListener('mouseenter', function () { clearTimeout(hideTimer); });

      // Keyboard
      trig.addEventListener('click', function () {
        content.hidden ? show(item) : hideNow(item);
      });

      trig.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === 'ArrowDown') {
          e.preventDefault();
          show(item);
          const first = content.querySelector('a, button');
          if (first) first.focus();
        }
      });
    });

    // Arrow nav among top-level triggers
    const triggers = el.querySelectorAll('[data-slot="navigation-menu-trigger"], [data-slot="navigation-menu-link"]');
    Scooter.arrowNav(el, '[data-slot="navigation-menu-trigger"], [data-slot="navigation-menu-link"]', { horizontal: true, wrap: true });

    el.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && activeItem) {
        hideNow(activeItem);
        const trig = activeItem ? activeItem.querySelector('[data-slot="navigation-menu-trigger"]') : null;
        if (trig) trig.focus();
      }
    });

    el._navMenu = {
      show: function (idx) { if (items[idx]) show(items[idx]); },
      hideAll: function () { if (activeItem) hideNow(activeItem); }
    };
  });
})();
