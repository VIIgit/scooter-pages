/**
 * Scooter Core — Shared runtime for Scooter Pages component library.
 * Auto-initializes components via [data-sc="name"] attributes.
 * Provides utilities for positioning, focus trapping, keyboard nav, and a11y.
 *
 * Usage:
 *   <script src="../components/scooter-core.js"></script>
 *   <script src="../components/accordion.js"></script>
 *   <script>Scooter.init();</script>
 */
;(function (root) {
  'use strict';

  const registry = {};
  const initialized = new WeakSet();

  const Scooter = {
    version: '1.0.0',

    /** Register a component initializer. */
    register(name, initFn) {
      registry[name] = initFn;
    },

    /** Scan the DOM (or a subtree) and initialize all [data-sc] elements. */
    init(root) {
      root = root || document;
      const els = root.querySelectorAll('[data-sc]');
      els.forEach(el => {
        if (initialized.has(el)) return;
        const names = el.getAttribute('data-sc').split(/\s+/);
        names.forEach(name => {
          const fn = registry[name];
          if (fn) {
            fn(el);
            initialized.add(el);
          }
        });
      });
    },

    /** Auto-init new elements added to the DOM. */
    observe() {
      if (typeof MutationObserver === 'undefined') return;
      const observer = new MutationObserver(mutations => {
        mutations.forEach(m => {
          m.addedNodes.forEach(node => {
            if (node.nodeType === 1) Scooter.init(node.parentElement || document);
          });
        });
      });
      observer.observe(document.body, { childList: true, subtree: true });
      return observer;
    },

    // ── Utilities ──────────────────────────────────────────────────────

    /** Generate a unique ID. */
    uid: (prefix = 'sc') => `${prefix}-${Math.random().toString(36).slice(2, 9)}`,

    /** Merge class strings (simple — no Tailwind dedup needed). */
    cn(...classes) {
      return classes.filter(Boolean).join(' ');
    },

    /** Add/remove a click-outside listener.  Returns a teardown function. */
    onClickOutside(el, callback) {
      function handler(e) {
        if (!el.contains(e.target)) callback(e);
      }
      document.addEventListener('mousedown', handler, true);
      return () => document.removeEventListener('mousedown', handler, true);
    },

    /** Position a popup element relative to an anchor.
     *  side: 'bottom' | 'top' | 'left' | 'right'
     *  align: 'start' | 'center' | 'end'
     *  offset: px gap between anchor and popup
     */
    position(popup, anchor, { side = 'bottom', align = 'center', offset = 4 } = {}) {
      const ar = anchor.getBoundingClientRect();
      const pr = popup.getBoundingClientRect();
      let top, left;

      // Side positioning
      if (side === 'bottom') { top = ar.bottom + offset; }
      else if (side === 'top') { top = ar.top - pr.height - offset; }
      else if (side === 'left') { left = ar.left - pr.width - offset; top = ar.top; }
      else if (side === 'right') { left = ar.right + offset; top = ar.top; }

      // Alignment
      if (side === 'bottom' || side === 'top') {
        if (align === 'start') left = ar.left;
        else if (align === 'end') left = ar.right - pr.width;
        else left = ar.left + (ar.width - pr.width) / 2;
      } else {
        if (align === 'start') top = ar.top;
        else if (align === 'end') top = ar.bottom - pr.height;
        else top = top + (ar.height - pr.height) / 2;
      }

      // Viewport clamping
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      if (left < 8) left = 8;
      if (left + pr.width > vw - 8) left = vw - pr.width - 8;
      if (top < 8) top = 8;
      if (top + pr.height > vh - 8) top = vh - pr.height - 8;

      popup.style.position = 'fixed';
      popup.style.top = `${top}px`;
      popup.style.left = `${left}px`;
    },

    /** Trap focus inside an element. Returns a teardown function. */
    trapFocus(el) {
      const focusable = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
      function getFocusable() {
        return [...el.querySelectorAll(focusable)].filter(e => !e.closest('[hidden],[aria-hidden="true"]'));
      }
      function handler(e) {
        if (e.key !== 'Tab') return;
        const items = getFocusable();
        if (items.length === 0) { e.preventDefault(); return; }
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey) {
          if (document.activeElement === first) { e.preventDefault(); last.focus(); }
        } else {
          if (document.activeElement === last) { e.preventDefault(); first.focus(); }
        }
      }
      el.addEventListener('keydown', handler);
      // Auto-focus first focusable
      const items = getFocusable();
      if (items.length) requestAnimationFrame(() => items[0].focus());
      return () => el.removeEventListener('keydown', handler);
    },

    /** Keyboard arrow navigation among children.
     *  orientation: 'horizontal' | 'vertical' | 'both'
     */
    arrowNav(container, selector, { orientation = 'vertical', loop = true } = {}) {
      container.addEventListener('keydown', e => {
        const items = [...container.querySelectorAll(selector)].filter(
          el => !el.disabled && !el.hasAttribute('data-disabled')
        );
        const idx = items.indexOf(document.activeElement);
        if (idx === -1) return;

        let next = -1;
        const prev = (orientation === 'horizontal') ? 'ArrowLeft' : 'ArrowUp';
        const fwd  = (orientation === 'horizontal') ? 'ArrowRight' : 'ArrowDown';

        if (e.key === fwd || (orientation === 'both' && (e.key === 'ArrowDown' || e.key === 'ArrowRight'))) {
          next = loop ? (idx + 1) % items.length : Math.min(idx + 1, items.length - 1);
        } else if (e.key === prev || (orientation === 'both' && (e.key === 'ArrowUp' || e.key === 'ArrowLeft'))) {
          next = loop ? (idx - 1 + items.length) % items.length : Math.max(idx - 1, 0);
        } else if (e.key === 'Home') {
          next = 0;
        } else if (e.key === 'End') {
          next = items.length - 1;
        }

        if (next >= 0 && next !== idx) {
          e.preventDefault();
          items[next].focus();
        }
      });
    },

    /** Animate-out helper: adds .closing class, waits for animation, calls callback. */
    animateOut(el, callback, duration = 200) {
      el.classList.add('closing');
      setTimeout(() => {
        el.classList.remove('closing');
        if (callback) callback();
      }, duration);
    },

    /** Create an element from an HTML string. */
    html(str) {
      const t = document.createElement('template');
      t.innerHTML = str.trim();
      return t.content.firstChild;
    },

    /** SVG icon helper — returns commonly used icons as SVG strings. */
    icons: {
      chevronDown: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>',
      chevronRight: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>',
      chevronLeft: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>',
      x: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>',
      check: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
      circle: '<svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="10"/></svg>',
      search: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>',
      minus: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/></svg>',
      moreHorizontal: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>',
      gripVertical: '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="5" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="19" r="1"/></svg>',
      panelLeft: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 3v18"/></svg>',
      arrowLeft: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>',
      arrowRight: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>',
      alertCircle: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg>',
      pin: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/><circle cx="12" cy="9" r="2.5"/></svg>',
      globe: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>',
    },
  };

  // Auto-init on DOMContentLoaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { Scooter.init(); Scooter.observe(); });
  } else {
    // Already loaded (script at end of body or deferred)
    requestAnimationFrame(() => { Scooter.init(); Scooter.observe(); });
  }

  root.Scooter = Scooter;
})(typeof globalThis !== 'undefined' ? globalThis : window);
