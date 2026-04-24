/**
 * Scooter EnvironmentGrid Component
 * Visualises large sets of environments as a coloured dot-grid, grouped by system tier.
 *
 * Usage:
 *   <div data-sc="environment-grid"></div>
 *
 *   const grid = document.querySelector('[data-sc="environment-grid"]');
 *   grid._environmentGrid.setData(environments);
 *
 * Environment object shape:
 *   {
 *     id:            string          — unique identifier
 *     name:          string          — display name
 *     region:        string          — e.g. 'CH' | 'APAC' | 'US'
 *     systemEnv:     string          — 'DEV' | 'TE1' | 'TE2' | 'PROD'
 *     status:        string          — 'online' | 'degraded' | 'offline'
 *     multiRegional: boolean         — optional, shows globe indicator in tooltip
 *   }
 *
 * Options (data attributes on root element):
 *   data-columns   Number of system-env columns to show (default: 4)
 *   data-dot-size  Dot size in px (default: 8)
 *
 * API:
 *   el._environmentGrid.setData(environments)   — load / replace all data
 *   el._environmentGrid.getData()               — return current dataset
 *
 * Events (bubble from root element):
 *   sc:render   { count: number }   — fired after each render
 *   sc:hover    { env: object }     — fired when a dot is hovered (env is null on leave)
 */
;(function () {
  'use strict';

  const STATUS_COLORS = {
    online:   '#2e7d32',
    degraded: '#ffb74d',
    offline:  '#e65100'
  };

  const DEFAULT_SYSTEM_ENVS = ['PROD', 'TE2', 'TE1', 'DEV'];

  // ─── Shared singleton tooltip (one per page) ────────────────────────────
  let _tooltip = null;

  function getTooltip() {
    if (_tooltip) return _tooltip;
    _tooltip = document.createElement('div');
    _tooltip.setAttribute('role', 'tooltip');
    _tooltip.style.cssText = [
      'position:fixed',
      'z-index:9999',
      'background:var(--card,#fff)',
      'border:1px solid var(--border,#e2e8f0)',
      'border-radius:var(--radius,6px)',
      'padding:10px 12px',
      'box-shadow:0 4px 16px rgba(0,0,0,.12)',
      'pointer-events:none',
      'display:none',
      'font-size:12px',
      'line-height:1.6',
      'min-width:148px',
      'max-width:220px'
    ].join(';');
    document.body.appendChild(_tooltip);
    return _tooltip;
  }

  function showTooltip(env, e) {
    const tip = getTooltip();
    const statusColor = STATUS_COLORS[env.status] || 'var(--foreground)';
    tip.innerHTML =
      '<div style="font-weight:600;margin-bottom:2px">' + env.name + '</div>' +
      (env.region ? '<div style="color:var(--muted-foreground,#64748b)">Region: ' + env.region + '</div>' : '') +
      '<div style="color:var(--muted-foreground,#64748b)">System: ' + env.systemEnv + '</div>' +
      '<div style="margin-top:4px">Status: <span style="color:' + statusColor + ';font-weight:600">' + env.status + '</span></div>' +
      (env.multiRegional ? '<div style="color:var(--primary,#3b82f6);margin-top:4px">&#127759; Multi-Regional</div>' : '');
    tip.style.display = 'block';
    positionTooltip(e);
  }

  function positionTooltip(e) {
    const tip = getTooltip();
    let left = e.clientX + 16;
    let top  = e.clientY + 16;
    // keep inside right edge
    if (left + 230 > window.innerWidth)  left = e.clientX - 230;
    // keep inside bottom edge
    if (top  + 140 > window.innerHeight) top  = e.clientY - 140;
    tip.style.left = left + 'px';
    tip.style.top  = top  + 'px';
  }

  function hideTooltip() {
    getTooltip().style.display = 'none';
  }

  // ─── Component registration ──────────────────────────────────────────────
  Scooter.register('environment-grid', function (el) {
    let environments = [];

    const dotSize  = parseInt(el.getAttribute('data-dot-size') || '8', 10);
    const colCount = parseInt(el.getAttribute('data-columns')  || '4',  10);

    // Outer wrapper keeps the element in flow; we manage children directly.
    el.style.display = 'block';

    // ─── Build column grid ─────────────────────────────────────────────
    const gridEl = document.createElement('div');
    gridEl.style.cssText =
      'display:grid;grid-template-columns:repeat(' + colCount + ',1fr);gap:20px';
    el.appendChild(gridEl);

    // ─── Render ────────────────────────────────────────────────────────
    function render() {
      // Group by systemEnv, respecting column order
      const groups = {};
      DEFAULT_SYSTEM_ENVS.forEach(k => { groups[k] = []; });
      environments.forEach(env => {
        if (!groups[env.systemEnv]) groups[env.systemEnv] = [];
        groups[env.systemEnv].push(env);
      });

      gridEl.innerHTML = '';

      DEFAULT_SYSTEM_ENVS.forEach(sysEnv => {
        const envs = groups[sysEnv] || [];

        const col = document.createElement('div');

        // Column header
        const header = document.createElement('div');
        header.style.cssText =
          'font-size:11px;font-weight:600;color:var(--muted-foreground,#64748b);' +
          'margin-bottom:6px;white-space:nowrap';
        header.textContent = sysEnv + ' (' + envs.length + ')';
        col.appendChild(header);

        // Dot container
        const dots = document.createElement('div');
        dots.style.cssText = 'display:flex;flex-wrap:wrap;gap:2px';

        envs.forEach(env => {
          const dot = document.createElement('div');
          dot.style.cssText =
            'width:' + dotSize + 'px;height:' + dotSize + 'px;' +
            'flex-shrink:0;cursor:pointer;' +
            'transition:transform .1s ease;' +
            'background:' + (STATUS_COLORS[env.status] || '#94a3b8');

          dot.addEventListener('mouseenter', function (e) {
            dot.style.transform = 'scale(1.5)';
            showTooltip(env, e);
            el.dispatchEvent(new CustomEvent('sc:hover', {
              bubbles: true,
              detail: { env }
            }));
          });
          dot.addEventListener('mousemove', positionTooltip);
          dot.addEventListener('mouseleave', function () {
            dot.style.transform = '';
            hideTooltip();
            el.dispatchEvent(new CustomEvent('sc:hover', {
              bubbles: true,
              detail: { env: null }
            }));
          });

          dots.appendChild(dot);
        });

        col.appendChild(dots);
        gridEl.appendChild(col);
      });

      el.dispatchEvent(new CustomEvent('sc:render', {
        bubbles: true,
        detail: { count: environments.length }
      }));
    }

    // ─── Public API ────────────────────────────────────────────────────
    function setData(envs) {
      environments = Array.isArray(envs) ? envs : [];
      render();
    }

    function getData() {
      return environments;
    }

    // Support inline JSON via data attribute (small datasets only)
    const raw = el.getAttribute('data-environments');
    if (raw) {
      try { setData(JSON.parse(raw)); } catch (err) {
        console.warn('[environment-grid] invalid data-environments JSON', err);
      }
    }

    el._environmentGrid = { setData, getData };
  });
})();
