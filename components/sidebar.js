/**
 * Scooter Sidebar Component  (collapsible side navigation)
 * Usage: <div data-sc="sidebar" data-default-open="true" data-collapsible="icon">
 *          <aside data-slot="sidebar-panel">
 *            <div data-slot="sidebar-header">Logo / Title</div>
 *            <nav data-slot="sidebar-content">
 *              <div data-slot="sidebar-group">
 *                <div data-slot="sidebar-group-label">Main</div>
 *                <ul data-slot="sidebar-group-content">
 *                  <li data-slot="sidebar-menu-item">
 *                    <a data-slot="sidebar-menu-button" href="#">Dashboard</a>
 *                  </li>
 *                  <li data-slot="sidebar-menu-item">
 *                    <a data-slot="sidebar-menu-button" href="#" data-active="true">Settings</a>
 *                  </li>
 *                </ul>
 *              </div>
 *            </nav>
 *            <div data-slot="sidebar-footer">Footer</div>
 *          </aside>
 *          <button data-slot="sidebar-trigger">☰</button>
 *          <main data-slot="sidebar-inset">…page content…</main>
 *        </div>
 * Options: data-side="left"  data-collapsible="icon|offcanvas|none"
 */
;(function () {
  Scooter.register('sidebar', function (el) {
    const panel = el.querySelector('[data-slot="sidebar-panel"]');
    const trigger = el.querySelector('[data-slot="sidebar-trigger"]');
    const inset = el.querySelector('[data-slot="sidebar-inset"]');
    if (!panel) return;

    const side = el.getAttribute('data-side') || 'left';
    const collapsible = el.getAttribute('data-collapsible') || 'offcanvas';
    let open = el.getAttribute('data-default-open') !== 'false';

    el.setAttribute('data-side', side);
    el.setAttribute('data-collapsible', collapsible);
    el.setAttribute('data-state', open ? 'expanded' : 'collapsed');
    panel.setAttribute('data-state', open ? 'expanded' : 'collapsed');

    function toggle() {
      open = !open;
      el.setAttribute('data-state', open ? 'expanded' : 'collapsed');
      panel.setAttribute('data-state', open ? 'expanded' : 'collapsed');
      el.dispatchEvent(new CustomEvent('sc:toggle', { detail: open, bubbles: true }));
    }

    if (trigger) trigger.addEventListener('click', toggle);

    // Keyboard shortcut: Ctrl+B or Cmd+B
    document.addEventListener('keydown', function (e) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
        e.preventDefault();
        toggle();
      }
    });

    // Mobile: close on outside click when offcanvas
    if (collapsible === 'offcanvas') {
      document.addEventListener('click', function (e) {
        if (open && window.innerWidth < 768 && !panel.contains(e.target) && e.target !== trigger) {
          toggle();
        }
      });
    }

    // Collapsible sub-menus
    el.querySelectorAll('[data-slot="sidebar-menu-sub-trigger"]').forEach(function (subTrig) {
      const item = subTrig.closest('[data-slot="sidebar-menu-item"]');
      const subContent = item ? item.querySelector('[data-slot="sidebar-menu-sub"]') : null;
      if (!subContent) return;

      subContent.hidden = subTrig.getAttribute('data-open') !== 'true';

      subTrig.addEventListener('click', function (e) {
        e.preventDefault();
        const isOpen = !subContent.hidden;
        subContent.hidden = isOpen;
        subTrig.setAttribute('data-open', String(!isOpen));
      });
    });

    el._sidebar = {
      toggle,
      isOpen: function () { return open; },
      open: function () { if (!open) toggle(); },
      close: function () { if (open) toggle(); }
    };
  });
})();
