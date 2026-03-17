/**
 * Scooter Calendar Component  (date picker grid)
 * Usage: <div data-sc="calendar" data-name="date"></div>
 * Options: data-value="2025-01-15"  data-min="2025-01-01"  data-max="2025-12-31"
 *          data-locale="en-US"  data-name="fieldName"
 * The component renders its own markup.
 */
;(function () {
  Scooter.register('calendar', function (el) {
    const locale = el.getAttribute('data-locale') || 'en-US';
    const selectedStr = el.getAttribute('data-value') || '';
    const minDate = el.getAttribute('data-min') ? new Date(el.getAttribute('data-min')) : null;
    const maxDate = el.getAttribute('data-max') ? new Date(el.getAttribute('data-max')) : null;
    const name = el.getAttribute('data-name') || '';

    let viewDate = selectedStr ? new Date(selectedStr + 'T00:00:00') : new Date();
    let selected = selectedStr ? new Date(selectedStr + 'T00:00:00') : null;
    let hidden;

    if (name) {
      hidden = document.createElement('input');
      hidden.type = 'hidden';
      hidden.name = name;
      if (selected) hidden.value = fmt(selected);
      el.appendChild(hidden);
    }

    function fmt(d) {
      return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    }

    function sameDay(a, b) {
      return a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
    }

    function isDisabled(d) {
      if (minDate && d < minDate) return true;
      if (maxDate && d > maxDate) return true;
      return false;
    }

    function monthName(d) {
      return d.toLocaleString(locale, { month: 'long', year: 'numeric' });
    }

    function render() {
      const year = viewDate.getFullYear();
      const month = viewDate.getMonth();
      const firstDay = new Date(year, month, 1).getDay(); // 0=Sun
      const daysInMonth = new Date(year, month + 1, 0).getDate();

      // Day-of-week headers
      const dayNames = [];
      for (let i = 0; i < 7; i++) {
        const d = new Date(2024, 0, i); // Jan 2024 starts Mon? Use explicit
        dayNames.push(new Date(2024, 6, i).toLocaleString(locale, { weekday: 'short' }).slice(0, 2));
      }
      // Adjust: JS week starts Sunday
      const shortDays = [];
      for (let i = 0; i < 7; i++) {
        shortDays.push(new Date(2024, 0, 7 + i).toLocaleString(locale, { weekday: 'short' }).slice(0, 2));
      }

      let html = '<div data-slot="calendar-header">';
      html += '<button data-slot="calendar-nav" data-dir="prev" type="button" aria-label="Previous month">' + (Scooter.icons.chevronLeft || '‹') + '</button>';
      html += '<span data-slot="calendar-heading">' + monthName(viewDate) + '</span>';
      html += '<button data-slot="calendar-nav" data-dir="next" type="button" aria-label="Next month">' + (Scooter.icons.chevronRight || '›') + '</button>';
      html += '</div>';

      html += '<table data-slot="calendar-grid" role="grid"><thead><tr>';
      for (let i = 0; i < 7; i++) {
        html += '<th data-slot="calendar-head-cell">' + shortDays[i] + '</th>';
      }
      html += '</tr></thead><tbody>';

      let day = 1;
      for (let row = 0; row < 6; row++) {
        if (day > daysInMonth) break;
        html += '<tr>';
        for (let col = 0; col < 7; col++) {
          if ((row === 0 && col < firstDay) || day > daysInMonth) {
            html += '<td data-slot="calendar-cell"></td>';
          } else {
            const d = new Date(year, month, day);
            const sel = sameDay(d, selected);
            const today = sameDay(d, new Date());
            const dis = isDisabled(d);
            html += '<td data-slot="calendar-cell">';
            html += '<button data-slot="calendar-day" type="button"';
            html += ' data-date="' + fmt(d) + '"';
            if (sel) html += ' data-selected="true" aria-selected="true"';
            if (today) html += ' data-today="true"';
            if (dis) html += ' disabled';
            html += ' tabindex="' + (sel || (!selected && today) ? '0' : '-1') + '"';
            html += '>' + day + '</button></td>';
            day++;
          }
        }
        html += '</tr>';
      }
      html += '</tbody></table>';

      // Clear existing content except hidden input
      Array.from(el.children).forEach(function (c) {
        if (c !== hidden) el.removeChild(c);
      });
      const frag = document.createRange().createContextualFragment(html);
      el.appendChild(frag);

      // Events
      el.querySelector('[data-dir="prev"]').addEventListener('click', function () {
        viewDate = new Date(year, month - 1, 1);
        render();
      });
      el.querySelector('[data-dir="next"]').addEventListener('click', function () {
        viewDate = new Date(year, month + 1, 1);
        render();
      });

      el.querySelectorAll('[data-slot="calendar-day"]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          selected = new Date(btn.getAttribute('data-date') + 'T00:00:00');
          if (hidden) hidden.value = fmt(selected);
          el.dispatchEvent(new CustomEvent('sc:change', { detail: fmt(selected), bubbles: true }));
          render();
        });
      });

      // Arrow key navigation within grid
      el.addEventListener('keydown', function (e) {
        const focused = document.activeElement;
        if (!focused || !focused.matches('[data-slot="calendar-day"]')) return;
        const cur = new Date(focused.getAttribute('data-date') + 'T00:00:00');
        let next = null;
        if (e.key === 'ArrowRight') next = new Date(cur.getTime() + 86400000);
        else if (e.key === 'ArrowLeft') next = new Date(cur.getTime() - 86400000);
        else if (e.key === 'ArrowDown') next = new Date(cur.getTime() + 7 * 86400000);
        else if (e.key === 'ArrowUp') next = new Date(cur.getTime() - 7 * 86400000);
        if (next) {
          e.preventDefault();
          if (next.getMonth() !== month) {
            viewDate = new Date(next.getFullYear(), next.getMonth(), 1);
            selected = null; // will focus via date attribute after render
            render();
          }
          const btn = el.querySelector('[data-date="' + fmt(next) + '"]');
          if (btn) btn.focus();
        }
      });
    }

    render();

    el._calendar = {
      getValue: function () { return selected ? fmt(selected) : ''; },
      setValue: function (v) {
        selected = v ? new Date(v + 'T00:00:00') : null;
        viewDate = selected || new Date();
        if (hidden) hidden.value = selected ? fmt(selected) : '';
        render();
      },
      goTo: function (year, month) {
        viewDate = new Date(year, month, 1);
        render();
      }
    };
  });
})();
