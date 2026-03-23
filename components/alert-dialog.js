/**
 * Scooter Alert-Dialog Component
 * Same as dialog but backdrop click does NOT close it — user must choose an action.
 * Usage: <div data-sc="alert-dialog">
 *          <button data-slot="alert-dialog-trigger">Delete</button>
 *          <dialog data-slot="alert-dialog-content">
 *            <div data-slot="alert-dialog-header">
 *              <h2 data-slot="alert-dialog-title">Are you sure?</h2>
 *              <p data-slot="alert-dialog-description">This cannot be undone.</p>
 *            </div>
 *            <div data-slot="alert-dialog-footer">
 *              <button data-slot="alert-dialog-cancel">Cancel</button>
 *              <button data-slot="alert-dialog-action">Continue</button>
 *            </div>
 *          </dialog>
 *        </div>
 */
;(function () {
  Scooter.register('alert-dialog', function (el) {
    const trigger = el.querySelector('[data-slot="alert-dialog-trigger"]');
    const dlg = el.querySelector('[data-slot="alert-dialog-content"]');
    if (!dlg) return;

    function open() {
      dlg.showModal();
      dlg.setAttribute('data-state', 'open');
      Scooter.trapFocus(dlg);
    }

    function close() {
      dlg.setAttribute('data-state', 'closed');
      Scooter.animateOut(dlg, () => dlg.close(), 200);
    }

    if (trigger) trigger.addEventListener('click', open);

    // Cancel button
    dlg.addEventListener('click', function (e) {
      if (e.target.closest('[data-slot="alert-dialog-cancel"]')) {
        el.dispatchEvent(new CustomEvent('sc:cancel', { bubbles: true }));
        close();
      }
    });

    // Action button — fires event then closes
    dlg.addEventListener('click', function (e) {
      if (e.target.closest('[data-slot="alert-dialog-action"]')) {
        el.dispatchEvent(new CustomEvent('sc:action', { bubbles: true }));
        close();
      }
    });

    // Prevent ESC close — user must pick an action
    dlg.addEventListener('cancel', function (e) {
      e.preventDefault();
    });

    // NO backdrop click close (alert-dialog requirement)

    el._alertDialog = { open, close };
  });
})();
