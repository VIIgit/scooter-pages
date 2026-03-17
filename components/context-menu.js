/**
 * Scooter Context-Menu Component  (right-click menu)
 * Usage: <div data-sc="context-menu">
 *          <div data-slot="context-menu-trigger">Right-click this area</div>
 *          <div data-slot="context-menu-content">
 *            <button data-slot="context-menu-item">Edit</button>
 *            <button data-slot="context-menu-item">Delete</button>
 *            <div data-slot="context-menu-separator"></div>
 *            <button data-slot="context-menu-checkbox-item" data-checked="false">Pinned</button>
 *          </div>
 *        </div>
 */
;(function () {
  Scooter.register('context-menu', function (el) {
    const trigger = el.querySelector('[data-slot="context-menu-trigger"]');
    const content = el.querySelector('[data-slot="context-menu-content"]');
    if (!trigger || !content) return;

    let open = false;
    content.hidden = true;
    content.setAttribute('role', 'menu');

    function show(x, y) {
      content.hidden = false;
      open = true;
      document.body.appendChild(content);
      content.style.position = 'fixed';
      content.style.left = x + 'px';
      content.style.top = y + 'px';
      content.setAttribute('data-state', 'open');

      // Viewport clamping
      requestAnimationFrame(function () {
        const rect = content.getBoundingClientRect();
        if (rect.right > window.innerWidth) {
          content.style.left = Math.max(0, window.innerWidth - rect.width - 4) + 'px';
        }
        if (rect.bottom > window.innerHeight) {
          content.style.top = Math.max(0, window.innerHeight - rect.height - 4) + 'px';
        }
      });

      const first = content.querySelector('[data-slot="context-menu-item"], [data-slot="context-menu-checkbox-item"]');
      if (first) first.focus();

      Scooter.arrowNav(content, '[data-slot="context-menu-item"], [data-slot="context-menu-checkbox-item"]', { wrap: true });

      requestAnimationFrame(() => Scooter.onClickOutside(content, hide));
    }

    function hide() {
      if (!open) return;
      content.setAttribute('data-state', 'closed');
      Scooter.animateOut(content, () => {
        content.hidden = true;
        if (content.parentElement !== el) el.appendChild(content);
      }, 120);
      open = false;
    }

    trigger.addEventListener('contextmenu', function (e) {
      e.preventDefault();
      if (open) hide();
      show(e.clientX, e.clientY);
    });

    content.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { e.preventDefault(); hide(); }
    });

    content.addEventListener('click', function (e) {
      const item = e.target.closest('[data-slot="context-menu-item"]');
      if (item && !item.hasAttribute('disabled')) {
        el.dispatchEvent(new CustomEvent('sc:select', { detail: item.textContent.trim(), bubbles: true }));
        hide();
        return;
      }
      const cbItem = e.target.closest('[data-slot="context-menu-checkbox-item"]');
      if (cbItem) {
        const checked = cbItem.getAttribute('data-checked') === 'true';
        cbItem.setAttribute('data-checked', String(!checked));
        el.dispatchEvent(new CustomEvent('sc:change', { detail: { label: cbItem.textContent.trim(), checked: !checked }, bubbles: true }));
      }
    });

    el._contextMenu = { show, hide };
  });
})();
