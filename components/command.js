/**
 * Scooter Command Component  (cmdk-style command palette / searchable list)
 * Usage: <div data-sc="command">
 *          <div data-slot="command-input-wrapper">
 *            <input data-slot="command-input" placeholder="Search…" />
 *          </div>
 *          <div data-slot="command-list">
 *            <div data-slot="command-empty">No results.</div>
 *            <div data-slot="command-group" data-heading="Fruit">
 *              <div data-slot="command-group-heading">Fruit</div>
 *              <button data-slot="command-item" data-value="apple">Apple</button>
 *              <button data-slot="command-item" data-value="banana">Banana</button>
 *            </div>
 *            <div data-slot="command-separator"></div>
 *            <div data-slot="command-group" data-heading="Vegetable">
 *              <div data-slot="command-group-heading">Vegetable</div>
 *              <button data-slot="command-item" data-value="carrot">Carrot</button>
 *            </div>
 *          </div>
 *        </div>
 */
;(function () {
  Scooter.register('command', function (el) {
    const input = el.querySelector('[data-slot="command-input"]');
    const list = el.querySelector('[data-slot="command-list"]');
    const emptyMsg = el.querySelector('[data-slot="command-empty"]');

    if (!input || !list) return;

    // Hide empty message initially
    if (emptyMsg) emptyMsg.hidden = true;

    function allItems() {
      return Array.from(list.querySelectorAll('[data-slot="command-item"]'));
    }

    function allGroups() {
      return Array.from(list.querySelectorAll('[data-slot="command-group"]'));
    }

    function filter(query) {
      const q = query.toLowerCase().trim();
      let visibleCount = 0;

      allItems().forEach(function (item) {
        const text = (item.getAttribute('data-value') || '') + ' ' + item.textContent;
        const match = !q || text.toLowerCase().includes(q);
        item.hidden = !match;
        if (match) visibleCount++;
      });

      // Hide empty groups
      allGroups().forEach(function (group) {
        const visible = group.querySelectorAll('[data-slot="command-item"]:not([hidden])');
        group.hidden = visible.length === 0;
      });

      if (emptyMsg) emptyMsg.hidden = visibleCount > 0;

      // Focus first visible
      const first = list.querySelector('[data-slot="command-item"]:not([hidden])');
      if (first) first.setAttribute('data-highlighted', 'true');
      allItems().forEach(function (item) {
        if (item !== first) item.removeAttribute('data-highlighted');
      });
    }

    function highlight(item) {
      allItems().forEach(function (it) { it.removeAttribute('data-highlighted'); });
      if (item) {
        item.setAttribute('data-highlighted', 'true');
        item.scrollIntoView({ block: 'nearest' });
      }
    }

    function getHighlighted() {
      return list.querySelector('[data-slot="command-item"][data-highlighted="true"]');
    }

    input.addEventListener('input', function () {
      filter(input.value);
    });

    input.addEventListener('keydown', function (e) {
      const visible = allItems().filter(function (it) { return !it.hidden; });
      const cur = getHighlighted();
      let idx = visible.indexOf(cur);

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        idx = idx < visible.length - 1 ? idx + 1 : 0;
        highlight(visible[idx]);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        idx = idx > 0 ? idx - 1 : visible.length - 1;
        highlight(visible[idx]);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (cur && !cur.hidden) {
          selectItem(cur);
        }
      }
    });

    function selectItem(item) {
      const val = item.getAttribute('data-value') || item.textContent.trim();
      el.dispatchEvent(new CustomEvent('sc:select', { detail: val, bubbles: true }));
    }

    // Click selection
    list.addEventListener('click', function (e) {
      const item = e.target.closest('[data-slot="command-item"]');
      if (item && !item.hidden && !item.hasAttribute('disabled')) {
        selectItem(item);
      }
    });

    // Hover highlighting
    list.addEventListener('mousemove', function (e) {
      const item = e.target.closest('[data-slot="command-item"]');
      if (item && !item.hidden) highlight(item);
    });

    // Initial filter (empty = show all)
    filter('');

    el._command = {
      filter,
      getValue: function () {
        const h = getHighlighted();
        return h ? (h.getAttribute('data-value') || h.textContent.trim()) : '';
      },
      focus: function () { input.focus(); }
    };
  });
})();
