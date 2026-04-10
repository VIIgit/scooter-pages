/**
 * Scooter Pagination Component
 * Self-rendering pagination with navigation events.
 * 
 * Usage:
 *   <nav data-sc="pagination" data-total="100" data-page-size="10" data-current="1">
 *     <!-- Content auto-generated -->
 *   </nav>
 * 
 * Options:
 *   data-total       Total number of items
 *   data-page-size   Items per page (default: 10)
 *   data-current     Current page number (default: 1)
 *   data-sibling     Number of sibling pages to show (default: 1)
 * 
 * Events:
 *   sc:change   { page: number, prevPage: number }
 */
;(function () {
  'use strict';

  const ELLIPSIS = '…';

  function generatePageRange(current, total, siblings) {
    const range = [];
    const showLeft = Math.max(1, current - siblings);
    const showRight = Math.min(total, current + siblings);

    // Always show first page
    if (showLeft > 1) {
      range.push(1);
      if (showLeft > 2) range.push(ELLIPSIS);
    }

    // Middle range
    for (let i = showLeft; i <= showRight; i++) {
      range.push(i);
    }

    // Always show last page
    if (showRight < total) {
      if (showRight < total - 1) range.push(ELLIPSIS);
      range.push(total);
    }

    return range;
  }

  function createButton(text, ariaLabel, disabled, isCurrent) {
    const isEllipsis = text === ELLIPSIS;
    
    if (isEllipsis) {
      return `<li data-slot="pagination-item">
        <span data-slot="pagination-ellipsis" aria-hidden="true">${text}</span>
      </li>`;
    }

    const attrs = [];
    if (disabled) attrs.push('disabled');
    if (isCurrent) attrs.push('aria-current="page"', 'data-active="true"');
    
    return `<li data-slot="pagination-item">
      <button data-slot="pagination-link" data-page="${text}" ${attrs.join(' ')} aria-label="${ariaLabel}">
        ${text}
      </button>
    </li>`;
  }

  function createNavButton(type, disabled, currentPage) {
    const icons = {
      first: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="11 17 6 12 11 7"/><polyline points="18 17 13 12 18 7"/></svg>',
      prev: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>',
      next: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>',
      last: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="13 17 18 12 13 7"/><polyline points="6 17 11 12 6 7"/></svg>'
    };

    const labels = {
      first: 'First page',
      prev: 'Previous page',
      next: 'Next page',
      last: 'Last page'
    };

    const targetPage = {
      first: 1,
      prev: Math.max(1, currentPage - 1),
      next: currentPage + 1,
      last: null // Set by caller
    };

    return `<li data-slot="pagination-item">
      <button data-slot="pagination-link" data-nav="${type}" ${disabled ? 'disabled' : ''} aria-label="${labels[type]}">
        ${icons[type]}
      </button>
    </li>`;
  }

  Scooter.register('pagination', function (el) {
    let totalItems = parseInt(el.dataset.total, 10) || 0;
    let pageSize = parseInt(el.dataset.pageSize, 10) || 10;
    let currentPage = parseInt(el.dataset.current, 10) || 1;
    let siblings = parseInt(el.dataset.sibling, 10) || 1;

    function getTotalPages() {
      return Math.ceil(totalItems / pageSize) || 1;
    }

    function render() {
      const totalPages = getTotalPages();
      currentPage = Math.max(1, Math.min(currentPage, totalPages));

      const range = generatePageRange(currentPage, totalPages, siblings);

      const html = `
        <ul data-slot="pagination-content">
          ${createNavButton('first', currentPage === 1, currentPage)}
          ${createNavButton('prev', currentPage === 1, currentPage)}
          ${range.map(p => {
            if (p === ELLIPSIS) {
              return createButton(ELLIPSIS, '', false, false);
            }
            return createButton(p, `Page ${p}`, false, p === currentPage);
          }).join('')}
          ${createNavButton('next', currentPage === totalPages, currentPage)}
          ${createNavButton('last', currentPage === totalPages, currentPage)}
        </ul>
      `;

      el.innerHTML = html;
    }

    function goToPage(page) {
      const totalPages = getTotalPages();
      const newPage = Math.max(1, Math.min(page, totalPages));
      
      if (newPage !== currentPage) {
        const prevPage = currentPage;
        currentPage = newPage;
        el.dataset.current = currentPage;
        
        render();
        
        el.dispatchEvent(new CustomEvent('sc:change', {
          bubbles: true,
          detail: { page: currentPage, prevPage }
        }));
      }
    }

    // Event delegation
    el.addEventListener('click', function (e) {
      const btn = e.target.closest('[data-slot="pagination-link"]');
      if (!btn || btn.disabled) return;

      const nav = btn.dataset.nav;
      const page = btn.dataset.page;
      const totalPages = getTotalPages();

      if (nav === 'first') goToPage(1);
      else if (nav === 'prev') goToPage(currentPage - 1);
      else if (nav === 'next') goToPage(currentPage + 1);
      else if (nav === 'last') goToPage(totalPages);
      else if (page) goToPage(parseInt(page, 10));
    });

    // Initial render
    render();

    // Expose API
    el._pagination = {
      goToPage,
      getCurrentPage: () => currentPage,
      getTotalPages,
      setTotal(total) {
        totalItems = total;
        el.dataset.total = total;
        render();
      },
      setPageSize(size) {
        pageSize = size;
        el.dataset.pageSize = size;
        render();
      },
      refresh: render
    };
  });
})();
