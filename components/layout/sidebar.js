/**
 * Scooter Layout Sidebar Component
 * Data-driven sidebar that generates navigation from a JSON config.
 *
 * Usage:
 *   <div data-sc="layout-sidebar"
 *        data-title="My App"
 *        data-subtitle="v1.0"
 *        data-footer="© 2026">
 *   </div>
 *
 * Then call the API to set navigation items:
 *   el._layoutSidebar.setNavigation(groups)
 *
 * Navigation data format (array of groups):
 *   [
 *     {
 *       label: 'Group Label',
 *       items: [
 *         { name: 'Home',  page: 'home.html', icon: '<svg>…</svg>', active: true },
 *         { name: 'About', page: 'about.html', icon: '<svg>…</svg>' }
 *       ]
 *     }
 *   ]
 *
 * Events:
 *   sc:navigate  { page, name, item }  Fired when a nav item is clicked
 *
 * API:
 *   el._layoutSidebar.setNavigation(groups)  → render sidebar navigation
 *   el._layoutSidebar.setActive(page)        → highlight item by page value
 *   el._layoutSidebar.getActive()            → current active page string
 */
;(function () {
  'use strict';

  Scooter.register('layout-sidebar', function (el) {
    var title    = el.getAttribute('data-title') || '';
    var subtitle = el.getAttribute('data-subtitle') || '';
    var footer   = el.getAttribute('data-footer') || '';
    var brandIcon = el.getAttribute('data-brand-icon') || '';
    var activePage = '';
    var navEl;

    // Build the sidebar shell — mirrors the data-slot structure from sidebar.js
    el.innerHTML =
      '<div data-slot="sidebar-header">' +
        '<span class="layout-sidebar-brand">' +
          (brandIcon ? '<span class="layout-sidebar-brand-icon">' + brandIcon + '</span>' : '') +
          '<span>' + title + '</span>' +
        '</span>' +
      '</div>' +
      '<nav data-slot="sidebar-content"></nav>' +
      (footer ? '<div data-slot="sidebar-footer">' + footer + '</div>' : '');

    navEl = el.querySelector('[data-slot="sidebar-content"]');

    function render(groups) {
      var html = '';
      groups.forEach(function (group) {
        html += '<div data-slot="sidebar-group">';
        if (group.label) {
          html += '<div data-slot="sidebar-group-label">' + group.label + '</div>';
        }
        html += '<ul data-slot="sidebar-group-content">';
        group.items.forEach(function (item) {
          var isActive = item.page === activePage || item.active;
          html +=
            '<li data-slot="sidebar-menu-item">' +
              '<a data-slot="sidebar-menu-button" href="#" data-page="' + item.page + '"' +
                (isActive ? ' data-active="true"' : '') + '>' +
                (item.icon || '') +
                item.name +
              '</a>' +
            '</li>';
        });
        html += '</ul></div>';
      });
      navEl.innerHTML = html;
      bindClicks();
    }

    function bindClicks() {
      navEl.querySelectorAll('[data-slot="sidebar-menu-button"]').forEach(function (btn) {
        btn.addEventListener('click', function (e) {
          e.preventDefault();
          var page = btn.getAttribute('data-page');
          setActive(page);
          el.dispatchEvent(new CustomEvent('sc:navigate', {
            detail: { page: page, name: btn.textContent.trim(), item: btn },
            bubbles: true
          }));
        });
      });
    }

    function setActive(page) {
      activePage = page;
      navEl.querySelectorAll('[data-slot="sidebar-menu-button"]').forEach(function (btn) {
        if (btn.getAttribute('data-page') === page) {
          btn.setAttribute('data-active', 'true');
        } else {
          btn.removeAttribute('data-active');
        }
      });
    }

    el._layoutSidebar = {
      setNavigation: function (groups) { render(groups); },
      setActive: setActive,
      getActive: function () { return activePage; }
    };
  });
})();
