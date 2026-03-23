/**
 * Scooter Dialog Component
 * Usage: <div data-sc="dialog">
 *          <button data-slot="dialog-trigger">Open</button>
 *          <dialog data-slot="dialog-content">
 *            <div data-slot="dialog-header">
 *              <h2 data-slot="dialog-title">Title</h2>
 *              <p data-slot="dialog-description">Description</p>
 *            </div>
 *            <div data-slot="dialog-body">…</div>
 *            <div data-slot="dialog-footer">
 *              <button data-slot="dialog-close">Close</button>
 *            </div>
 *          </dialog>
 *        </div>
 * Options: data-open (opens by default)
 */
;(function () {
  Scooter.register('dialog', function (el) {
    const trigger = el.querySelector('[data-slot="dialog-trigger"]');
    const dlg = el.querySelector('[data-slot="dialog-content"]');
    if (!dlg) return;

    // Ensure dialog has an overlay wrapper
    if (!dlg.querySelector('[data-slot="dialog-overlay"]')) {
      // Browsers render <dialog>::backdrop automatically, but we still
      // layer our own overlay inside for style parity with the CSS.
    }

    function open() {
      dlg.showModal();
      dlg.setAttribute('data-state', 'open');
      Scooter.trapFocus(dlg);
      el.dispatchEvent(new CustomEvent('sc:open', { bubbles: true }));
    }

    function close() {
      dlg.setAttribute('data-state', 'closed');
      el.dispatchEvent(new CustomEvent('sc:close', { bubbles: true }));
      Scooter.animateOut(dlg, () => dlg.close(), 200);
    }

    // Trigger
    if (trigger) trigger.addEventListener('click', open);

    // Close buttons anywhere inside
    dlg.addEventListener('click', function (e) {
      const btn = e.target.closest('[data-slot="dialog-close"]');
      if (btn) close();
    });

    // Clicking backdrop (::backdrop registers as click on <dialog> outside content)
    dlg.addEventListener('click', function (e) {
      if (e.target === dlg) close();
    });

    // ESC handled natively by <dialog>, but we intercept to animate
    dlg.addEventListener('cancel', function (e) {
      e.preventDefault();
      close();
    });

    // Default open
    if (el.hasAttribute('data-open')) open();

    // Expose API
    el._dialog = { open, close };
  });
})();
