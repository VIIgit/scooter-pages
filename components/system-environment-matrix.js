/**
 * Scooter System Environment Matrix Component
 * Usage: <div data-sc="system-environment-matrix">
 *          <div data-slot="sem-environment" data-name="Production">
 *            <div data-slot="sem-element" data-characteristic="Security">Firewall</div>
 *            <div data-slot="sem-element" data-characteristic="Storage">S3</div>
 *          </div>
 *          <div data-slot="sem-environment" data-name="Staging">
 *            <div data-slot="sem-element" data-characteristic="Security">VPN</div>
 *          </div>
 *        </div>
 *
 * Modes:
 *   expanded (default)  — full grid with characteristic header columns
 *   collapsed           — compact tag-based layout, characteristic shown as badge
 *                         Only shown when an element is selected (filtered)
 *
 * Attributes:
 *   data-compact-default — Start in compact view even without a selection.
 *                          By default the grid view is shown until an element is clicked.
 *
 * Events:
 *   sc:filter   — { environment: string }  (environment selected)
 *   sc:reset    — {}                        (filter cleared)
 *   sc:element  — { environment, element, characteristic } (element clicked)
 */
;(function () {
  Scooter.register('system-environment-matrix', function (el) {

    /* ── Parse data from declarative markup ── */
    const envEls = el.querySelectorAll(':scope > [data-slot="sem-environment"]');
    const environments = [];
    const charSet = new Set();

    envEls.forEach(envEl => {
      const env = {
        id: envEl.getAttribute('data-name') || envEl.textContent.trim(),
        name: envEl.getAttribute('data-name') || '',
        elements: []
      };
      envEl.querySelectorAll('[data-slot="sem-element"]').forEach(elemEl => {
        const char = elemEl.getAttribute('data-characteristic') || '';
        env.elements.push({
          name: elemEl.textContent.trim(),
          characteristic: char
        });
        charSet.add(char);
      });
      environments.push(env);
    });

    const characteristics = Array.from(charSet).sort();

    /* ── Configuration ── */
    const compactDefault = el.hasAttribute('data-compact-default');

    /* ── State ── */
    let selectedEnv = null;
    let selectedEl = null;        // { environment, name, characteristic }
    let isExpanded = compactDefault ? el.hasAttribute('data-expanded') : true;

    /* ── Render ── */
    function render() {
      el.querySelectorAll('.sem-rendered').forEach(n => n.remove());

      const wrap = document.createElement('div');
      wrap.className = 'sem-rendered';

      if (isExpanded) {
        renderExpanded(wrap);
      } else {
        renderCompact(wrap);
      }

      el.appendChild(wrap);
    }

    /* ── Compact / collapsed mode ── */
    function renderCompact(wrap) {
      const body = document.createElement('div');
      body.setAttribute('data-slot', 'sem-body');

      const displayEnvs = selectedEnv
        ? environments.filter(e => e.id === selectedEnv)
        : environments;

      displayEnvs.forEach(env => {
        const row = document.createElement('div');
        row.setAttribute('data-slot', 'sem-row-compact');

        const name = document.createElement('div');
        name.setAttribute('data-slot', 'sem-env-name');
        name.textContent = env.name;

        /* When filtered, the env-name becomes an expand trigger */
        if (selectedEnv && env.id === selectedEnv) {
          name.setAttribute('data-expandable', '');
          name.addEventListener('click', function (ev) {
            ev.stopPropagation();
            isExpanded = true;
            el.setAttribute('data-expanded', '');
            render();
          });
        }

        row.appendChild(name);

        const tags = document.createElement('div');
        tags.setAttribute('data-slot', 'sem-tags');

        env.elements.forEach(element => {
          const btn = document.createElement('button');
          btn.setAttribute('data-slot', 'sem-element');
          if (isSelected(env.name, element.name)) {
            btn.setAttribute('data-selected', '');
          }

          const nameSpan = document.createElement('span');
          nameSpan.setAttribute('data-slot', 'sem-element-name');
          nameSpan.textContent = element.name;
          btn.appendChild(nameSpan);

          const charSpan = document.createElement('span');
          charSpan.setAttribute('data-slot', 'sem-element-char');
          charSpan.textContent = element.characteristic;
          btn.appendChild(charSpan);

          btn.addEventListener('click', handleElementClick(env, element));
          tags.appendChild(btn);
        });

        row.appendChild(tags);
        body.appendChild(row);
      });

      wrap.appendChild(body);
    }

    /* ── Expanded / grid mode ── */
    function renderExpanded(wrap) {
      /* Header row */
      const header = document.createElement('div');
      header.setAttribute('data-slot', 'sem-header');

      const envLabel = document.createElement('div');
      envLabel.setAttribute('data-slot', 'sem-env-label');
      envLabel.textContent = 'Environment';
      header.appendChild(envLabel);

      characteristics.forEach(c => {
        const cl = document.createElement('div');
        cl.setAttribute('data-slot', 'sem-char-label');
        cl.textContent = c;
        header.appendChild(cl);
      });
      wrap.appendChild(header);

      /* Body rows */
      const body = document.createElement('div');
      body.setAttribute('data-slot', 'sem-body');

      environments.forEach(env => {
        const row = document.createElement('div');
        row.setAttribute('data-slot', 'sem-row');

        const name = document.createElement('div');
        name.setAttribute('data-slot', 'sem-env-name');
        name.textContent = env.name;
        row.appendChild(name);

        characteristics.forEach(char => {
          const cell = document.createElement('div');
          cell.setAttribute('data-slot', 'sem-cell');
          const elements = env.elements.filter(e => e.characteristic === char);
          if (elements.length > 0) {
            elements.forEach(element => {
              const btn = document.createElement('button');
              btn.setAttribute('data-slot', 'sem-element');
              if (isSelected(env.name, element.name)) {
                btn.setAttribute('data-selected', '');
              }

              const nameSpan = document.createElement('span');
              nameSpan.setAttribute('data-slot', 'sem-element-name');
              nameSpan.textContent = element.name;
              btn.appendChild(nameSpan);
              /* In expanded mode the header already shows the characteristic,
                 so we don't render the char badge on the element card. */

              btn.addEventListener('click', handleElementClick(env, element));
              cell.appendChild(btn);
            });
          } else {
            const empty = document.createElement('div');
            empty.setAttribute('data-slot', 'sem-empty');
            cell.appendChild(empty);
          }
          row.appendChild(cell);
        });
        body.appendChild(row);
      });
      wrap.appendChild(body);
    }

    /* ── Helpers ── */
    function isSelected(envName, elemName) {
      return selectedEl && selectedEl.environment === envName && selectedEl.name === elemName;
    }

    function handleElementClick(env, element) {
      return function (e) {
        e.stopPropagation();
        var sameEnv = selectedEnv === env.id;
        var prevEl = selectedEl;
        selectedEnv = env.id;
        selectedEl = {
          environment: env.name,
          name: element.name,
          characteristic: element.characteristic
        };

        el.setAttribute('data-filtered', '');
        el.dispatchEvent(new CustomEvent('sc:element', {
          bubbles: true,
          detail: { environment: env.name, element: element.name, characteristic: element.characteristic }
        }));
        el.dispatchEvent(new CustomEvent('sc:filter', {
          bubbles: true,
          detail: { environment: env.name }
        }));

        /* If switching selection within the same env in compact mode,
           just swap data-selected attributes instead of full re-render */
        if (sameEnv && !isExpanded && prevEl) {
          var wrap = el.querySelector('.sem-rendered');
          if (wrap) {
            wrap.querySelectorAll('[data-slot="sem-element"][data-selected]').forEach(
              function (n) { n.removeAttribute('data-selected'); }
            );
            wrap.querySelectorAll('[data-slot="sem-element"]').forEach(function (btn) {
              var nameNode = btn.querySelector('[data-slot="sem-element-name"]');
              if (nameNode && nameNode.textContent === element.name) {
                btn.setAttribute('data-selected', '');
              }
            });
            return;
          }
        }

        /* Collapse to filtered compact view */
        isExpanded = false;
        el.removeAttribute('data-expanded');
        render();
      };
    }

    /* ── Click on container = reset filter ── */
    el.addEventListener('click', () => {
      if (selectedEnv || selectedEl) {
        selectedEnv = null;
        selectedEl = null;
        /* Return to initial mode: expanded unless compact-default */
        isExpanded = !compactDefault;
        el.removeAttribute('data-filtered');
        if (isExpanded) el.setAttribute('data-expanded', '');
        else el.removeAttribute('data-expanded');
        el.dispatchEvent(new CustomEvent('sc:reset', { bubbles: true }));
        render();
      }
    });

    /* ── Hide source markup, initial render ── */
    envEls.forEach(e => e.style.display = 'none');
    el.style.setProperty('--sem-cols', characteristics.length);
    if (isExpanded) el.setAttribute('data-expanded', '');
    render();

    /* ── Expose API ── */
    el._sem = {
      filter(envName) {
        const env = environments.find(e => e.name === envName || e.id === envName);
        if (env) {
          selectedEnv = env.id;
          el.setAttribute('data-filtered', '');
          render();
        }
      },
      reset() {
        selectedEnv = null;
        selectedEl = null;
        isExpanded = !compactDefault;
        el.removeAttribute('data-filtered');
        if (isExpanded) el.setAttribute('data-expanded', '');
        else el.removeAttribute('data-expanded');
        render();
      },
      expand() {
        isExpanded = true;
        el.setAttribute('data-expanded', '');
        render();
      },
      collapse() {
        isExpanded = false;
        el.removeAttribute('data-expanded');
        render();
      },
      toggle() {
        isExpanded = !isExpanded;
        if (isExpanded) el.setAttribute('data-expanded', '');
        else el.removeAttribute('data-expanded');
        render();
      },
      get expanded() { return isExpanded; },
      get selected() { return selectedEnv; },
      get selectedElement() { return selectedEl; },
      get environments() { return environments; },
      get characteristics() { return characteristics; }
    };
  });
})();
