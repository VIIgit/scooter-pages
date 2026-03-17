/**
 * Scooter Drawer Component  (bottom sheet with optional drag-to-close)
 * Usage: <div data-sc="drawer">
 *          <button data-slot="drawer-trigger">Open</button>
 *          <dialog data-slot="drawer-content">
 *            <div data-slot="drawer-handle"></div>
 *            <div data-slot="drawer-header">
 *              <h2 data-slot="drawer-title">Title</h2>
 *              <p data-slot="drawer-description">…</p>
 *            </div>
 *            <div data-slot="drawer-body">…</div>
 *            <div data-slot="drawer-footer">
 *              <button data-slot="drawer-close">Close</button>
 *            </div>
 *          </dialog>
 *        </div>
 * Options: data-dismiss-threshold="0.4"  (fraction of height to swipe before auto-close)
 */
;(function () {
  Scooter.register('drawer', function (el) {
    const trigger = el.querySelector('[data-slot="drawer-trigger"]');
    const dlg = el.querySelector('[data-slot="drawer-content"]');
    if (!dlg) return;

    const threshold = parseFloat(el.getAttribute('data-dismiss-threshold') || '0.4');
    let startY = 0, currentY = 0, dragging = false;

    function open() {
      dlg.showModal();
      dlg.setAttribute('data-state', 'open');
      dlg.style.transform = '';
      Scooter.trapFocus(dlg);
    }

    function close() {
      dlg.setAttribute('data-state', 'closed');
      dlg.style.transform = 'translateY(100%)';
      Scooter.animateOut(dlg, () => {
        dlg.close();
        dlg.style.transform = '';
      }, 300);
    }

    if (trigger) trigger.addEventListener('click', open);

    dlg.addEventListener('click', function (e) {
      if (e.target.closest('[data-slot="drawer-close"]')) close();
      if (e.target === dlg) close();
    });

    dlg.addEventListener('cancel', function (e) {
      e.preventDefault();
      close();
    });

    /* ---- Drag-to-dismiss ---- */
    const handle = dlg.querySelector('[data-slot="drawer-handle"]');
    const dragTarget = handle || dlg;

    dragTarget.addEventListener('pointerdown', function (e) {
      dragging = true;
      startY = e.clientY;
      currentY = 0;
      dlg.style.transition = 'none';
      dragTarget.setPointerCapture(e.pointerId);
    });

    dragTarget.addEventListener('pointermove', function (e) {
      if (!dragging) return;
      currentY = Math.max(0, e.clientY - startY); // only allow downward
      dlg.style.transform = 'translateY(' + currentY + 'px)';
    });

    dragTarget.addEventListener('pointerup', function () {
      if (!dragging) return;
      dragging = false;
      dlg.style.transition = '';
      if (currentY > dlg.offsetHeight * threshold) {
        close();
      } else {
        dlg.style.transform = '';
      }
    });

    el._drawer = { open, close };
  });
})();
