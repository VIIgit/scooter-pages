/**
 * Scooter Toast / Sonner Component  (notification toasts)
 * Usage (imperative only — call from JS):
 *   Scooter.toast('File saved!');
 *   Scooter.toast('Error', { description: 'Network failure', variant: 'destructive', duration: 5000 });
 *
 * Container auto-created:
 * <div data-slot="toast-container" data-position="bottom-right"> auto-generated toasts… </div>
 *
 * Options (on container or via Scooter.toast.defaults):
 *   position: "bottom-right" | "bottom-left" | "top-right" | "top-left" | "top-center" | "bottom-center"
 *   duration: default 4000ms
 */
;(function () {
  var defaults = {
    position: 'bottom-right',
    duration: 4000,
    maxToasts: 5
  };

  var container = null;

  function getContainer() {
    if (container && document.body.contains(container)) return container;
    container = document.querySelector('[data-slot="toast-container"]');
    if (!container) {
      container = document.createElement('div');
      container.setAttribute('data-slot', 'toast-container');
      container.setAttribute('data-position', defaults.position);
      document.body.appendChild(container);
    }
    return container;
  }

  function toast(title, opts) {
    opts = opts || {};
    var c = getContainer();
    var duration = opts.duration != null ? opts.duration : defaults.duration;
    var variant = opts.variant || 'default';

    // Limit visible toasts
    while (c.children.length >= defaults.maxToasts) {
      c.removeChild(c.firstChild);
    }

    var el = document.createElement('div');
    el.setAttribute('data-slot', 'toast');
    el.setAttribute('data-variant', variant);
    el.setAttribute('data-state', 'open');
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');

    var html = '<div data-slot="toast-content">';
    html += '<div data-slot="toast-title">' + title + '</div>';
    if (opts.description) {
      html += '<div data-slot="toast-description">' + opts.description + '</div>';
    }
    html += '</div>';

    if (opts.action) {
      html += '<button data-slot="toast-action">' + (opts.actionLabel || 'Undo') + '</button>';
    }

    html += '<button data-slot="toast-close" aria-label="Dismiss">' + (Scooter.icons.x || '×') + '</button>';
    el.innerHTML = html;

    function dismiss() {
      el.setAttribute('data-state', 'closed');
      Scooter.animateOut(el, function () {
        if (el.parentElement) el.parentElement.removeChild(el);
      }, 200);
    }

    el.querySelector('[data-slot="toast-close"]').addEventListener('click', dismiss);

    if (opts.action) {
      el.querySelector('[data-slot="toast-action"]').addEventListener('click', function () {
        opts.action();
        dismiss();
      });
    }

    // Swipe to dismiss (horizontal)
    var startX = 0;
    el.addEventListener('pointerdown', function (e) { startX = e.clientX; });
    el.addEventListener('pointerup', function (e) {
      if (Math.abs(e.clientX - startX) > 80) dismiss();
    });

    c.appendChild(el);

    // Auto-dismiss
    if (duration > 0) {
      var timer = setTimeout(dismiss, duration);
      el.addEventListener('mouseenter', function () { clearTimeout(timer); });
      el.addEventListener('mouseleave', function () { timer = setTimeout(dismiss, duration); });
    }

    return { dismiss: dismiss, element: el };
  }

  toast.defaults = defaults;

  // Set position from existing container if present
  var existing = document.querySelector('[data-slot="toast-container"]');
  if (existing) {
    var pos = existing.getAttribute('data-position');
    if (pos) defaults.position = pos;
    container = existing;
  }

  // Expose globally on Scooter
  if (typeof Scooter !== 'undefined') {
    Scooter.toast = toast;
  } else {
    // Defer until Scooter is ready
    document.addEventListener('DOMContentLoaded', function () {
      if (typeof Scooter !== 'undefined') Scooter.toast = toast;
    });
  }
})();
