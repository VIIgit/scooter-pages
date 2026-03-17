/**
 * Scooter Menubar Component  (horizontal menu bar with menus)
 * Usage: <div data-sc="menubar">
 *          <div data-slot="menubar-menu">
 *            <button data-slot="menubar-trigger">File</button>
 *            <div data-slot="menubar-content">
 *              <button data-slot="menubar-item">New</button>
 *              <button data-slot="menubar-item">Open</button>
 *              <div data-slot="menubar-separator"></div>
 *              <button data-slot="menubar-item">Exit</button>
 *            </div>
 *          </div>
 *          <div data-slot="menubar-menu">
 *            <button data-slot="menubar-trigger">Edit</button>
 *            <div data-slot="menubar-content">…</div>
 *          </div>
 *        </div>
 */
;(function () {
  Scooter.register('menubar', function (el) {
    const menus = Array.from(el.querySelectorAll('[data-slot="menubar-menu"]'));
    let openMenu = null;

    function showMenu(menu) {
      if (openMenu && openMenu !== menu) hideMenu(openMenu);

      const trigger = menu.querySelector('[data-slot="menubar-trigger"]');
      const content = menu.querySelector('[data-slot="menubar-content"]');
      if (!content) return;

      content.hidden = false;
      content.setAttribute('data-state', 'open');
      trigger.setAttribute('data-state', 'open');
      trigger.setAttribute('aria-expanded', 'true');
      document.body.appendChild(content);
      Scooter.position(content, trigger, { side: 'bottom', align: 'start', offset: 4 });

      const first = content.querySelector('[data-slot="menubar-item"]');
      if (first) first.focus();

      Scooter.arrowNav(content, '[data-slot="menubar-item"], [data-slot="menubar-checkbox-item"], [data-slot="menubar-radio-item"]', { wrap: true });

      openMenu = menu;

      requestAnimationFrame(() => {
        Scooter.onClickOutside(content, function () { hideMenu(menu); }, trigger);
      });
    }

    function hideMenu(menu) {
      const trigger = menu.querySelector('[data-slot="menubar-trigger"]');
      const content = menu.querySelector('[data-slot="menubar-content"]');
      if (!content) return;

      content.setAttribute('data-state', 'closed');
      Scooter.animateOut(content, () => {
        content.hidden = true;
        if (content.parentElement !== menu) menu.appendChild(content);
      }, 120);
      trigger.removeAttribute('data-state');
      trigger.setAttribute('aria-expanded', 'false');
      if (openMenu === menu) openMenu = null;
    }

    menus.forEach(function (menu, idx) {
      const trigger = menu.querySelector('[data-slot="menubar-trigger"]');
      const content = menu.querySelector('[data-slot="menubar-content"]');
      if (!trigger) return;
      if (content) content.hidden = true;

      trigger.setAttribute('aria-haspopup', 'true');
      trigger.setAttribute('aria-expanded', 'false');

      trigger.addEventListener('click', function () {
        if (openMenu === menu) hideMenu(menu);
        else showMenu(menu);
      });

      // If a menu is already open, hovering another trigger opens that one
      trigger.addEventListener('mouseenter', function () {
        if (openMenu && openMenu !== menu) showMenu(menu);
      });

      // Left/Right between menus from inside content
      if (content) {
        content.addEventListener('keydown', function (e) {
          if (e.key === 'ArrowRight') {
            e.preventDefault();
            const next = menus[(idx + 1) % menus.length];
            showMenu(next);
          } else if (e.key === 'ArrowLeft') {
            e.preventDefault();
            const prev = menus[(idx - 1 + menus.length) % menus.length];
            showMenu(prev);
          } else if (e.key === 'Escape') {
            e.preventDefault();
            hideMenu(menu);
            trigger.focus();
          }
        });

        content.addEventListener('click', function (e) {
          const item = e.target.closest('[data-slot="menubar-item"]');
          if (item && !item.hasAttribute('disabled')) {
            el.dispatchEvent(new CustomEvent('sc:select', { detail: item.textContent.trim(), bubbles: true }));
            hideMenu(menu);
            trigger.focus();
          }
        });
      }
    });

    // Arrow nav among triggers
    Scooter.arrowNav(el, '[data-slot="menubar-trigger"]', { horizontal: true, wrap: true });

    el._menubar = {
      showMenu: function (idx) { if (menus[idx]) showMenu(menus[idx]); },
      hideAll: function () { if (openMenu) hideMenu(openMenu); }
    };
  });
})();
