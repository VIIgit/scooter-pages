/**
 * Scooter Layout Header Component
 * Renders a top header bar with search input and action buttons.
 *
 * Usage:
 *   <div data-sc="layout-header"
 *        data-search-placeholder="Search..."
 *        data-title="My App">
 *   </div>
 *
 * Options:
 *   data-search-placeholder  Placeholder text for the search field (default: "Search…")
 *   data-title               Optional title shown before the search
 *
 * Events:
 *   sc:search   { value: string }  Fired when the user types in the search input
 *
 * API:
 *   el._layoutHeader.getSearchValue()  → current search field value
 *   el._layoutHeader.setSearchValue(v) → set search field value
 */
;(function () {
  'use strict';

  /* ── SVG Icons (Lucide-compatible) ── */
  var ICON_SEARCH = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>';
  var ICON_BELL   = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>';
  var ICON_USER   = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>';

  Scooter.register('layout-header', function (el) {
    var placeholder = el.getAttribute('data-search-placeholder') || 'Search\u2026';

    // Build DOM
    el.innerHTML =
      '<div data-slot="header-search">' +
        '<span class="header-search-icon">' + ICON_SEARCH + '</span>' +
        '<input type="text" class="header-search-input" placeholder="' + placeholder + '" />' +
      '</div>' +
      '<div data-slot="header-actions">' +
        '<button class="header-action-btn" aria-label="Notifications">' +
          ICON_BELL +
          '<span class="header-notification-dot"></span>' +
        '</button>' +
        '<button class="header-action-btn" aria-label="User">' +
          ICON_USER +
        '</button>' +
      '</div>';

    var input = el.querySelector('.header-search-input');

    input.addEventListener('input', function () {
      el.dispatchEvent(new CustomEvent('sc:search', {
        detail: { value: input.value },
        bubbles: true
      }));
    });

    el._layoutHeader = {
      getSearchValue: function () { return input.value; },
      setSearchValue: function (v) { input.value = v; }
    };
  });
})();
