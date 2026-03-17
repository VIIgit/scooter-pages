/**
 * Scooter Sheet Component  (side panel / slide-over)
 * Usage: <div data-sc="sheet" data-side="right">
 *          <button data-slot="sheet-trigger">Open</button>
 *          <dialog data-slot="sheet-content">
 *            <div data-slot="sheet-header">
 *              <h2 data-slot="sheet-title">Panel title</h2>
 *              <p data-slot="sheet-description">…</p>
 *            </div>
 *            <div data-slot="sheet-body">…</div>
 *            <div data-slot="sheet-footer">…</div>
 *            <button data-slot="sheet-close">×</button>
 *          </dialog>
 *        </div>
 * Options: data-side="right|left|top|bottom"
 */
;(function () {
  Scooter.register('sheet', function (el) {
    const trigger = el.querySelector('[data-slot="sheet-trigger"]');
    const dlg = el.querySelector('[data-slot="sheet-content"]');
    if (!dlg) return;

    const side = el.getAttribute('data-side') || 'right';
    dlg.setAttribute('data-side', side);

    function open() {
      dlg.showModal();
      dlg.setAttribute('data-state', 'open');
      Scooter.trapFocus(dlg);
    }

    function close() {
      dlg.setAttribute('data-state', 'closed');
      // Slide-out duration matches CSS (300ms)
      Scooter.animateOut(dlg, () => dlg.close(), 300);
    }

    if (trigger) trigger.addEventListener('click', open);

    // Close button(s)
    dlg.addEventListener('click', function (e) {
      if (e.target.closest('[data-slot="sheet-close"]')) close();
    });

    // Backdrop click
    dlg.addEventListener('click', function (e) {
      if (e.target === dlg) close();
    });

    dlg.addEventListener('cancel', function (e) {
      e.preventDefault();
      close();
    });

    el._sheet = { open, close };
  });
})();
