/**
 * Scooter Layout Page-Container Component
 * Provides a scrollable, max-width-constrained content area.
 *
 * Usage:
 *   <div data-sc="layout-page-container">
 *     …page content…
 *   </div>
 *
 * API:
 *   el._layoutPageContainer.setContent(html)  → replace inner content
 */
;(function () {
  'use strict';

  Scooter.register('layout-page-container', function (el) {
    // Wrap existing content in the inner container if not already wrapped
    if (!el.querySelector('.page-container-inner')) {
      var inner = document.createElement('div');
      inner.className = 'page-container-inner';
      while (el.firstChild) inner.appendChild(el.firstChild);
      el.appendChild(inner);
    }

    var inner = el.querySelector('.page-container-inner');

    el._layoutPageContainer = {
      setContent: function (html) { inner.innerHTML = html; },
      getInner: function () { return inner; }
    };
  });
})();
