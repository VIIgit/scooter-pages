/**
 * Scooter Table Component
 * Sortable columns, selectable rows.
 * 
 * Usage:
 *   <table data-sc="table" data-selectable data-sortable>
 *     <thead data-slot="table-header">
 *       <tr>
 *         <th data-slot="table-head" data-sort-key="name">Name</th>
 *         <th data-slot="table-head" data-sort-key="status">Status</th>
 *       </tr>
 *     </thead>
 *     <tbody data-slot="table-body">
 *       <tr data-slot="table-row" data-value="row-1">
 *         <td data-slot="table-cell">Item 1</td>
 *         <td data-slot="table-cell">Active</td>
 *       </tr>
 *     </tbody>
 *   </table>
 * 
 * Options:
 *   data-selectable     Enable row selection
 *   data-select-type    "single" (default) or "multiple"
 *   data-sortable       Enable column sorting
 *   data-sort-key       Initial sort column
 *   data-sort-dir       "asc" (default) or "desc"
 * 
 * Events:
 *   sc:select     { value: string|string[], row: Element|Element[] }
 *   sc:sort       { key: string, direction: 'asc'|'desc' }
 */
;(function () {
  'use strict';

  const SORT_ICON = `<span data-slot="table-sort-icon" style="margin-left:4px;opacity:0.5">
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m7 15 5 5 5-5"/><path d="m7 9 5-5 5 5"/></svg>
  </span>`;

  const SORT_ASC_ICON = `<span data-slot="table-sort-icon" data-direction="asc" style="margin-left:4px">
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m7 15 5 5 5-5"/></svg>
  </span>`;

  const SORT_DESC_ICON = `<span data-slot="table-sort-icon" data-direction="desc" style="margin-left:4px">
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m7 9 5-5 5 5"/></svg>
  </span>`;

  Scooter.register('table', function (el) {
    const isSelectable = el.hasAttribute('data-selectable');
    const selectType = el.dataset.selectType || 'single';
    const isSortable = el.hasAttribute('data-sortable');

    let sortKey = el.dataset.sortKey || null;
    let sortDir = el.dataset.sortDir || 'asc';
    let selectedValues = [];

    const header = el.querySelector('[data-slot="table-header"]');
    const body = el.querySelector('[data-slot="table-body"]');

    // ─────────────────────────────────────────────────────────────────────
    // Sorting
    // ─────────────────────────────────────────────────────────────────────

    function initSortIcons() {
      if (!isSortable || !header) return;

      const heads = header.querySelectorAll('[data-slot="table-head"][data-sort-key]');
      heads.forEach(th => {
        // Add cursor and icon
        th.style.cursor = 'pointer';
        th.style.userSelect = 'none';
        
        // Remove existing icon
        const existing = th.querySelector('[data-slot="table-sort-icon"]');
        if (existing) existing.remove();

        const key = th.dataset.sortKey;
        if (key === sortKey) {
          th.insertAdjacentHTML('beforeend', sortDir === 'asc' ? SORT_ASC_ICON : SORT_DESC_ICON);
          th.setAttribute('aria-sort', sortDir === 'asc' ? 'ascending' : 'descending');
        } else {
          th.insertAdjacentHTML('beforeend', SORT_ICON);
          th.removeAttribute('aria-sort');
        }
      });
    }

    function sortTable(key) {
      if (sortKey === key) {
        sortDir = sortDir === 'asc' ? 'desc' : 'asc';
      } else {
        sortKey = key;
        sortDir = 'asc';
      }

      el.dataset.sortKey = sortKey;
      el.dataset.sortDir = sortDir;

      // Get column index
      const heads = Array.from(header.querySelectorAll('[data-slot="table-head"]'));
      const colIndex = heads.findIndex(th => th.dataset.sortKey === key);
      
      if (colIndex === -1 || !body) return;

      // Sort rows
      const rows = Array.from(body.querySelectorAll('[data-slot="table-row"]'));
      rows.sort((a, b) => {
        const cellA = a.querySelectorAll('[data-slot="table-cell"]')[colIndex];
        const cellB = b.querySelectorAll('[data-slot="table-cell"]')[colIndex];
        
        let valA = cellA?.textContent?.trim() || '';
        let valB = cellB?.textContent?.trim() || '';

        // Try numeric comparison
        const numA = parseFloat(valA.replace(/[^0-9.-]/g, ''));
        const numB = parseFloat(valB.replace(/[^0-9.-]/g, ''));
        
        if (!isNaN(numA) && !isNaN(numB)) {
          return sortDir === 'asc' ? numA - numB : numB - numA;
        }

        // String comparison
        const cmp = valA.localeCompare(valB, undefined, { sensitivity: 'base' });
        return sortDir === 'asc' ? cmp : -cmp;
      });

      // Reorder DOM
      rows.forEach(row => body.appendChild(row));

      initSortIcons();

      el.dispatchEvent(new CustomEvent('sc:sort', {
        bubbles: true,
        detail: { key: sortKey, direction: sortDir }
      }));
    }

    // ─────────────────────────────────────────────────────────────────────
    // Selection
    // ─────────────────────────────────────────────────────────────────────

    function updateRowStates() {
      if (!body) return;
      
      body.querySelectorAll('[data-slot="table-row"]').forEach(row => {
        const value = row.dataset.value;
        const isSelected = selectedValues.includes(value);
        row.setAttribute('data-state', isSelected ? 'selected' : '');
        row.setAttribute('aria-selected', isSelected ? 'true' : 'false');
      });
    }

    function selectRow(row) {
      const value = row.dataset.value;
      if (!value) return;

      if (selectType === 'single') {
        selectedValues = [value];
      } else {
        // Multiple selection
        const idx = selectedValues.indexOf(value);
        if (idx === -1) {
          selectedValues.push(value);
        } else {
          selectedValues.splice(idx, 1);
        }
      }

      updateRowStates();

      const selectedRows = selectType === 'single' 
        ? row 
        : Array.from(body.querySelectorAll('[data-slot="table-row"][data-state="selected"]'));

      el.dispatchEvent(new CustomEvent('sc:select', {
        bubbles: true,
        detail: {
          value: selectType === 'single' ? selectedValues[0] : selectedValues,
          row: selectedRows
        }
      }));
    }

    // ─────────────────────────────────────────────────────────────────────
    // Event Listeners
    // ─────────────────────────────────────────────────────────────────────

    // Sorting clicks
    if (isSortable && header) {
      header.addEventListener('click', function (e) {
        const th = e.target.closest('[data-slot="table-head"][data-sort-key]');
        if (th) {
          sortTable(th.dataset.sortKey);
        }
      });
    }

    // Row selection
    if (isSelectable && body) {
      body.addEventListener('click', function (e) {
        const row = e.target.closest('[data-slot="table-row"]');
        if (row && !e.target.closest('button, a, input, [data-no-select]')) {
          selectRow(row);
        }
      });

      // Keyboard navigation
      body.addEventListener('keydown', function (e) {
        const row = e.target.closest('[data-slot="table-row"]');
        if (!row) return;

        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          selectRow(row);
        } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          const next = row.nextElementSibling;
          if (next?.matches('[data-slot="table-row"]')) next.focus();
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          const prev = row.previousElementSibling;
          if (prev?.matches('[data-slot="table-row"]')) prev.focus();
        }
      });

      // Make rows focusable
      body.querySelectorAll('[data-slot="table-row"]').forEach(row => {
        if (!row.hasAttribute('tabindex')) {
          row.setAttribute('tabindex', '0');
        }
      });
    }

    // Initialize
    initSortIcons();
    updateRowStates();

    // Expose API
    el._table = {
      sort(key, direction) {
        if (direction) sortDir = direction === 'asc' ? 'desc' : 'asc'; // Will toggle to desired
        sortTable(key);
      },
      getSort() {
        return { key: sortKey, direction: sortDir };
      },
      select(value) {
        if (!body) return;
        const row = body.querySelector(`[data-slot="table-row"][data-value="${value}"]`);
        if (row) selectRow(row);
      },
      getSelected() {
        return selectType === 'single' ? selectedValues[0] : [...selectedValues];
      },
      clearSelection() {
        selectedValues = [];
        updateRowStates();
      },
      selectAll() {
        if (selectType !== 'multiple' || !body) return;
        selectedValues = Array.from(body.querySelectorAll('[data-slot="table-row"][data-value]'))
          .map(r => r.dataset.value);
        updateRowStates();
      }
    };
  });
})();
