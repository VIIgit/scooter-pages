/**
 * Scooter Service Health Registry Component
 * Dashboard for displaying ~500 microservices with filtering and multiple view modes.
 * 
 * Usage:
 *   <div data-sc="service-health-registry" data-view="grid" data-detail-dialog="#service-detail-dialog">
 *     <!-- Content auto-generated -->
 *   </div>
 * 
 * Options:
 *   data-view     "grid" | "grouped" | "treemap" (default: "grid")
 *   data-detail-dialog  CSS selector for a linked service-detail-dialog component
 * 
 * API:
 *   el._serviceHealthRegistry.setServices(services)
 *   el._serviceHealthRegistry.setStatusColors({ healthy, degraded, critical })
 *   el._serviceHealthRegistry.setFilters(filters)
 *   el._serviceHealthRegistry.setView(view)
 *   el._serviceHealthRegistry.getSelected()
 * 
 * Events:
 *   sc:select       { service: object }
 *   sc:filter       { filters: object }
 *   sc:view-change  { view: string }
 */
;(function () {
  'use strict';

  // ─────────────────────────────────────────────────────────────────────
  // Rendering
  // ─────────────────────────────────────────────────────────────────────

  let statusColors = {
    healthy: 'var(--success)',
    degraded: '#f59e0b',
    critical: 'var(--destructive)'
  };

  function renderFilters(services, currentFilters) {
    const regions = [...new Set(services.map(s => s.region))].sort();
    const exposures = [...new Set(services.map(s => s.exposure))].sort();
    const tiers = [...new Set(services.map(s => s.tier))].sort();
    const interfaces = [...new Set(services.map(s => s.interface))].sort();
    const hasFilters = Object.values(currentFilters).some(v => v !== '');

    return `
      <div data-slot="service-registry-filters">
        <div data-slot="service-registry-filter">
          <label class="text-xs text-muted">Region</label>
          <select data-slot="select" data-filter="region">
            <option value="">All Regions</option>
            ${regions.map(r => `<option value="${r}"${currentFilters.region === r ? ' selected' : ''}>${r}</option>`).join('')}
          </select>
        </div>
        <div data-slot="service-registry-filter">
          <label class="text-xs text-muted">Exposure</label>
          <select data-slot="select" data-filter="exposure">
            <option value="">All</option>
            ${exposures.map(e => `<option value="${e}"${currentFilters.exposure === e ? ' selected' : ''}>${e}</option>`).join('')}
          </select>
        </div>
        <div data-slot="service-registry-filter">
          <label class="text-xs text-muted">Tier</label>
          <select data-slot="select" data-filter="tier">
            <option value="">All Tiers</option>
            ${tiers.map(t => `<option value="${t}"${currentFilters.tier === t ? ' selected' : ''}>${t}</option>`).join('')}
          </select>
        </div>
        <div data-slot="service-registry-filter">
          <label class="text-xs text-muted">Interface</label>
          <select data-slot="select" data-filter="interface">
            <option value="">All</option>
            ${interfaces.map(i => `<option value="${i}"${currentFilters.interface === i ? ' selected' : ''}>${i}</option>`).join('')}
          </select>
        </div>
        <div data-slot="service-registry-filter">
          <label class="text-xs text-muted">Status</label>
          <select data-slot="select" data-filter="status">
            <option value="">All</option>
            <option value="healthy"${currentFilters.status === 'healthy' ? ' selected' : ''}>Healthy</option>
            <option value="degraded"${currentFilters.status === 'degraded' ? ' selected' : ''}>Degraded</option>
            <option value="critical"${currentFilters.status === 'critical' ? ' selected' : ''}>Critical</option>
          </select>
        </div>
        <div data-slot="service-registry-search">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" data-slot="search-icon"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input data-slot="input" type="search" placeholder="Search by name, category, or deployment context..." data-filter="search" value="${currentFilters.search || ''}" id="service-search-input" aria-label="Search services">
          <span data-slot="search-count"></span>
        </div>
        <button data-slot="button" data-variant="ghost" data-size="sm" data-action="reset-filters" ${hasFilters ? '' : 'disabled'} title="Reset all filters">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></svg>
          Reset
        </button>
      </div>
    `;
  }

  function renderViewToggle(currentView) {
    return `
      <div data-slot="service-registry-view-toggle">
        <button data-slot="button" data-size="sm" data-variant="${currentView === 'grid' ? 'default' : 'ghost'}" data-view="grid" title="Grid View">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
        </button>
        <button data-slot="button" data-size="sm" data-variant="${currentView === 'grouped' ? 'default' : 'ghost'}" data-view="grouped" title="Grouped View">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
        </button>
        <button data-slot="button" data-size="sm" data-variant="${currentView === 'treemap' ? 'default' : 'ghost'}" data-view="treemap" title="Treemap View">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>
        </button>
      </div>
    `;
  }

  function renderServiceCard(service) {
    return `
      <div data-slot="service-card" data-status="${service.status}" data-id="${service.id}" tabindex="0">
        <div data-slot="service-card-header">
          <span data-slot="service-status-dot" style="background:${statusColors[service.status]}"></span>
          <span data-slot="service-card-name">${service.name}</span>
        </div>
        <div data-slot="service-card-meta">
          <span class="text-xs">${service.region}</span>
          <span class="text-xs">${service.interface}</span>
          <span class="text-xs">${service.responseTime}ms</span>
        </div>
      </div>
    `;
  }

  function renderGridView(services) {
    return `
      <div data-slot="service-registry-grid">
        ${services.map(renderServiceCard).join('')}
      </div>
    `;
  }

  function renderGroupedView(services) {
    const groups = {};
    services.forEach(s => {
      const key = s.deploymentContext?.name || 'Unknown';
      if (!groups[key]) groups[key] = [];
      groups[key].push(s);
    });

    return `
      <div data-slot="service-registry-grouped">
        ${Object.entries(groups).map(([name, svcs]) => `
          <div data-slot="service-registry-group">
            <div data-slot="service-registry-group-header">
              <span>${name}</span>
              <span class="text-sm text-muted">${svcs.length} services</span>
            </div>
            <div data-slot="service-registry-group-content">
              ${svcs.map(renderServiceCard).join('')}
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  function renderTreemapView(services) {
    // Build hierarchical tree: Region → Exposure → Tier → Interface → Status
    const tree = {};
    services.forEach(s => {
      if (!tree[s.region]) tree[s.region] = {};
      if (!tree[s.region][s.exposure]) tree[s.region][s.exposure] = {};
      if (!tree[s.region][s.exposure][s.tier]) tree[s.region][s.exposure][s.tier] = {};
      if (!tree[s.region][s.exposure][s.tier][s.interface]) tree[s.region][s.exposure][s.tier][s.interface] = { healthy: [], degraded: [], critical: [] };
      tree[s.region][s.exposure][s.tier][s.interface][s.status].push(s);
    });

    // Status summary
    const statusCounts = { healthy: 0, degraded: 0, critical: 0 };
    services.forEach(s => statusCounts[s.status]++);
    const total = services.length;

    function renderStatusDot(status, count) {
      if (count === 0) return '';
      const color = statusColors[status];
      return `<span style="display:inline-flex;align-items:center;gap:3px;margin-right:8px"><span style="width:8px;height:8px;border-radius:50%;background:${color}"></span><span class="text-xs">${count}</span></span>`;
    }

    function countByStatus(obj) {
      const counts = { healthy: 0, degraded: 0, critical: 0 };
      function recurse(node) {
        if (Array.isArray(node)) {
          node.forEach(s => counts[s.status]++);
        } else if (typeof node === 'object') {
          Object.values(node).forEach(recurse);
        }
      }
      recurse(obj);
      return counts;
    }

    let html = `<div data-slot="service-registry-treemap">`;

    // Summary bar
    html += `
      <div data-slot="service-treemap-summary">
        <div data-slot="service-treemap-stat" style="--stat-color:var(--success)">
          <span class="text-3xl font-semibold">${statusCounts.healthy}</span>
          <span class="text-sm text-muted">Healthy (${(statusCounts.healthy/total*100).toFixed(1)}%)</span>
        </div>
        <div data-slot="service-treemap-stat" style="--stat-color:#f59e0b">
          <span class="text-3xl font-semibold">${statusCounts.degraded}</span>
          <span class="text-sm text-muted">Degraded (${(statusCounts.degraded/total*100).toFixed(1)}%)</span>
        </div>
        <div data-slot="service-treemap-stat" style="--stat-color:var(--destructive)">
          <span class="text-3xl font-semibold">${statusCounts.critical}</span>
          <span class="text-sm text-muted">Critical (${(statusCounts.critical/total*100).toFixed(1)}%)</span>
        </div>
      </div>
    `;

    // Hierarchical treemap
    html += `<div data-slot="service-treemap-hierarchy">`;
    
    const regions = Object.keys(tree).sort();
    regions.forEach(region => {
      const regionCounts = countByStatus(tree[region]);
      const regionTotal = regionCounts.healthy + regionCounts.degraded + regionCounts.critical;
      
      html += `
        <details data-slot="treemap-region" open>
          <summary data-slot="treemap-region-header">
            <span class="treemap-region-name">${region}</span>
            <span class="treemap-status-dots">
              ${renderStatusDot('healthy', regionCounts.healthy)}
              ${renderStatusDot('degraded', regionCounts.degraded)}
              ${renderStatusDot('critical', regionCounts.critical)}
            </span>
            <span class="text-xs text-muted">${regionTotal} services</span>
          </summary>
          <div data-slot="treemap-region-content">
      `;

      const exposures = Object.keys(tree[region]).sort();
      exposures.forEach(exposure => {
        const expCounts = countByStatus(tree[region][exposure]);
        const expTotal = expCounts.healthy + expCounts.degraded + expCounts.critical;

        html += `
          <details data-slot="treemap-exposure">
            <summary data-slot="treemap-exposure-header">
              <span data-slot="badge" data-variant="${exposure === 'EXTERNAL' ? 'secondary' : 'outline'}">${exposure}</span>
              <span class="treemap-status-dots">
                ${renderStatusDot('healthy', expCounts.healthy)}
                ${renderStatusDot('degraded', expCounts.degraded)}
                ${renderStatusDot('critical', expCounts.critical)}
              </span>
              <span class="text-xs text-muted">${expTotal}</span>
            </summary>
            <div data-slot="treemap-exposure-content">
        `;

        const tiers = Object.keys(tree[region][exposure]).sort();
        tiers.forEach(tier => {
          const tierCounts = countByStatus(tree[region][exposure][tier]);
          const tierTotal = tierCounts.healthy + tierCounts.degraded + tierCounts.critical;

          html += `
            <details data-slot="treemap-tier">
              <summary data-slot="treemap-tier-header">
                <span data-slot="badge" data-variant="${tier === 'GOLD' ? 'warning' : tier === 'SILVER' ? 'secondary' : 'outline'}">${tier}</span>
                <span class="treemap-status-dots">
                  ${renderStatusDot('healthy', tierCounts.healthy)}
                  ${renderStatusDot('degraded', tierCounts.degraded)}
                  ${renderStatusDot('critical', tierCounts.critical)}
                </span>
                <span class="text-xs text-muted">${tierTotal}</span>
              </summary>
              <div data-slot="treemap-tier-content">
          `;

          const interfaces = Object.keys(tree[region][exposure][tier]).sort();
          interfaces.forEach(iface => {
            const ifaceCounts = countByStatus(tree[region][exposure][tier][iface]);
            const ifaceTotal = ifaceCounts.healthy + ifaceCounts.degraded + ifaceCounts.critical;
            const statusGroups = tree[region][exposure][tier][iface];

            html += `
              <details data-slot="treemap-interface">
                <summary data-slot="treemap-interface-header">
                  <span class="text-sm font-medium">${iface}</span>
                  <span class="treemap-status-dots">
                    ${renderStatusDot('healthy', ifaceCounts.healthy)}
                    ${renderStatusDot('degraded', ifaceCounts.degraded)}
                    ${renderStatusDot('critical', ifaceCounts.critical)}
                  </span>
                  <span class="text-xs text-muted">${ifaceTotal}</span>
                </summary>
                <div data-slot="treemap-interface-content">
            `;

            // Show services grouped by status
            ['critical', 'degraded', 'healthy'].forEach(status => {
              const svcs = statusGroups[status];
              if (svcs.length === 0) return;
              html += `
                <div data-slot="treemap-status-group" data-status="${status}">
                  <div data-slot="treemap-status-header">
                    <span style="width:8px;height:8px;border-radius:50%;background:${statusColors[status]}"></span>
                    <span class="text-xs font-medium">${status.charAt(0).toUpperCase() + status.slice(1)} (${svcs.length})</span>
                  </div>
                  <div data-slot="treemap-services">
                    ${svcs.map(s => `
                      <div data-slot="service-card" data-id="${s.id}" data-status="${s.status}" tabindex="0">
                        <span data-slot="service-card-name">${s.name}</span>
                        <span class="text-xs text-muted">${s.responseTime}ms</span>
                      </div>
                    `).join('')}
                  </div>
                </div>
              `;
            });

            html += `</div></details>`; // interface
          });

          html += `</div></details>`; // tier
        });

        html += `</div></details>`; // exposure
      });

      html += `</div></details>`; // region
    });

    html += `</div></div>`; // hierarchy, treemap
    return html;
  }

  function renderStats(services) {
    const total = services.length;
    const healthy = services.filter(s => s.status === 'healthy').length;
    const avgResponse = total ? Math.round(services.reduce((sum, s) => sum + s.responseTime, 0) / total) : 0;
    const compliant = services.filter(s => s.goldenRule?.compliant).length;
    const healthyPercent = total ? Math.round(healthy / total * 100) : 0;
    const compliantPercent = total ? Math.round(compliant / total * 100) : 0;

    return `
      <div data-slot="service-registry-stats">
        <div data-slot="service-registry-stat">
          <span class="text-2xl font-semibold">${total}</span>
          <span class="text-xs text-muted">Total Services</span>
        </div>
        <div data-slot="service-registry-stat">
          <span class="text-2xl font-semibold" style="color:var(--success)">${healthyPercent}%</span>
          <span class="text-xs text-muted">Healthy</span>
        </div>
        <div data-slot="service-registry-stat">
          <span class="text-2xl font-semibold">${avgResponse}ms</span>
          <span class="text-xs text-muted">Avg Response</span>
        </div>
        <div data-slot="service-registry-stat">
          <span class="text-2xl font-semibold">${compliantPercent}%</span>
          <span class="text-xs text-muted">Compliant</span>
        </div>
      </div>
    `;
  }

  // ─────────────────────────────────────────────────────────────────────
  // Component
  // ─────────────────────────────────────────────────────────────────────

  Scooter.register('service-health-registry', function (el) {
    let services = [];
    let filteredServices = [];
    let currentView = el.dataset.view || 'grid';
    let filters = { region: '', exposure: '', tier: '', interface: '', status: '', search: '' };
    let selectedService = null;
    let linkedDialog = null;
    let searchTimeout;

    function applyFilters() {
      const searchQuery = (filters.search || '').trim().toLowerCase();

      filteredServices = services.filter(s => {
        if (filters.region && s.region !== filters.region) return false;
        if (filters.exposure && s.exposure !== filters.exposure) return false;
        if (filters.tier && s.tier !== filters.tier) return false;
        if (filters.interface && s.interface !== filters.interface) return false;
        if (filters.status && s.status !== filters.status) return false;
        if (searchQuery) {
          const searchable = [
            s.name,
            s.description,
            s.category || '',
            s.region || '',
            s.exposure || '',
            s.tier || '',
            s.interface || '',
            (s.deploymentContext && s.deploymentContext.name) || ''
          ].join(' ').toLowerCase();
          if (!searchable.includes(searchQuery)) return false;
        }
        return true;
      });
    }

    function getViewContent() {
      switch (currentView) {
        case 'grouped':
          return renderGroupedView(filteredServices);
        case 'treemap':
          return renderTreemapView(filteredServices);
        default:
          return renderGridView(filteredServices);
      }
    }

    function hasActiveFilters() {
      return Object.values(filters).some(value => value !== '');
    }

    function updateResetButtonState() {
      const resetBtn = el.querySelector('[data-action="reset-filters"]');
      if (resetBtn) resetBtn.disabled = !hasActiveFilters();
    }

    function updateSearchCount() {
      const searchCount = el.querySelector('[data-slot="search-count"]');
      if (searchCount) {
        searchCount.textContent = filters.search ? `${filteredServices.length} found` : '';
      }
    }

    function updateSummary() {
      const title = el.querySelector('[data-slot="service-registry-title"] .text-sm');
      if (title) title.textContent = `${filteredServices.length} of ${services.length} services`;
    }

    function focusSearchInput() {
      const searchInput = el.querySelector('input[data-filter="search"]');
      if (!searchInput) return;

      searchInput.focus({ preventScroll: true });

      if (typeof searchInput.setSelectionRange === 'function') {
        const length = searchInput.value.length;
        searchInput.setSelectionRange(length, length);
      }
    }

    function emitFilterEvent() {
      el.dispatchEvent(new CustomEvent('sc:filter', {
        bubbles: true,
        detail: { filters: { ...filters } }
      }));
    }

    function resolveLinkedDialog() {
      if (linkedDialog && document.contains(linkedDialog)) return linkedDialog;

      const selector = el.dataset.detailDialog;
      if (selector) {
        linkedDialog = document.querySelector(selector);
        return linkedDialog;
      }

      if (el.parentElement) {
        linkedDialog = el.parentElement.querySelector('[data-sc~="service-detail-dialog"]');
        if (linkedDialog) return linkedDialog;
      }

      linkedDialog = document.querySelector('[data-sc~="service-detail-dialog"]');
      return linkedDialog;
    }

    function openLinkedDialog(service) {
      const dialogEl = resolveLinkedDialog();
      if (!dialogEl || !dialogEl._serviceDetailDialog || typeof dialogEl._serviceDetailDialog.open !== 'function') {
        return;
      }

      dialogEl._serviceDetailDialog.open(service);
    }

    function render() {
      applyFilters();
      const viewContent = getViewContent();

      el.innerHTML = `
        <div data-slot="service-registry-header">
          <div data-slot="service-registry-title">
            <h2>Service Health Registry</h2>
            <span class="text-sm text-muted">${filteredServices.length} of ${services.length} services</span>
          </div>
          ${renderViewToggle(currentView)}
        </div>
        ${renderStats(filteredServices)}
        ${renderFilters(services, filters)}
        <div data-slot="service-registry-content">
          ${viewContent}
        </div>
      `;
      updateResetButtonState();
      updateSearchCount();
    }

    function updateContent() {
      applyFilters();

      const viewContent = getViewContent();
      const content = el.querySelector('[data-slot="service-registry-content"]');
      if (content) content.innerHTML = viewContent;

      const stats = el.querySelector('[data-slot="service-registry-stats"]');
      if (stats) stats.outerHTML = renderStats(filteredServices);

      updateSummary();
      updateSearchCount();
      updateResetButtonState();
    }

    // Event delegation
    el.addEventListener('click', function (e) {
      // View toggle (exclude the root el which also carries data-view)
      const viewBtn = e.target.closest('[data-view]');
      if (viewBtn && viewBtn !== el) {
        currentView = viewBtn.dataset.view;
        el.dataset.view = currentView;
        render();
        el.dispatchEvent(new CustomEvent('sc:view-change', {
          bubbles: true,
          detail: { view: currentView }
        }));
        return;
      }

      // Service card click
      const card = e.target.closest('[data-slot="service-card"]');
      if (card) {
        const id = card.dataset.id;
        selectedService = services.find(s => s.id === id);
        if (selectedService) {
          el.dispatchEvent(new CustomEvent('sc:select', {
            bubbles: true,
            detail: { service: selectedService }
          }));
          openLinkedDialog(selectedService);
        }
      }
    });

    // Filter changes (exclude search — handled by input event)
    el.addEventListener('change', function (e) {
      const filterEl = e.target.closest('[data-filter]');
      if (filterEl && filterEl.dataset.filter !== 'search') {
        filters[filterEl.dataset.filter] = filterEl.value;
        render();
        emitFilterEvent();
      }
    });

    el.addEventListener('input', function (e) {
      const searchInput = e.target.closest('input[data-filter="search"]');
      if (!searchInput) return;

      clearTimeout(searchTimeout);
      filters.search = searchInput.value;
      searchTimeout = setTimeout(() => {
        updateContent();
        emitFilterEvent();
      }, 120);
    });

    el.addEventListener('search', function (e) {
      const searchInput = e.target.closest('input[data-filter="search"]');
      if (!searchInput) return;

      clearTimeout(searchTimeout);
      filters.search = searchInput.value;
      updateContent();
      emitFilterEvent();
    });

    // Reset filters
    el.addEventListener('click', function (e) {
      const resetBtn = e.target.closest('[data-action="reset-filters"]');
      if (resetBtn) {
        clearTimeout(searchTimeout);
        filters = { region: '', exposure: '', tier: '', interface: '', status: '', search: '' };
        render();
        emitFilterEvent();
      }
    }, true);

    // Keyboard navigation
    el.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        const card = e.target.closest('[data-slot="service-card"]');
        if (card) {
          e.preventDefault();
          card.click();
        }
      }
    });

    // Initial render
    render();

    // Expose API
    el._serviceHealthRegistry = {
      setServices(newServices) {
        services = newServices;
        filteredServices = [...services];
        render();
      },
      setStatusColors(colors) {
        statusColors = { ...statusColors, ...colors };
        if (services.length) render();
      },
      setFilters(newFilters) {
        filters = { ...filters, ...newFilters };
        render();
      },
      setView(view) {
        currentView = view;
        el.dataset.view = view;
        render();
      },
      setDetailDialog(dialog) {
        linkedDialog = typeof dialog === 'string' ? document.querySelector(dialog) : dialog;
      },
      getSelected: () => selectedService,
      getFiltered: () => [...filteredServices],
      refresh: render
    };
  });
})();
