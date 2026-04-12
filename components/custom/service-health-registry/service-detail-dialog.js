/**
 * Scooter Service Detail Dialog Component
 * Modal displaying detailed service information including APIs, deployment context, and health status.
 * 
 * Usage:
 *   <div data-sc="service-detail-dialog">
 *     <dialog data-slot="dialog-content">
 *       <!-- Auto-populated when opened via API -->
 *     </dialog>
 *   </div>
 * 
 * API:
 *   el._serviceDetailDialog.open(serviceData)
 *   el._serviceDetailDialog.close()
 * 
 * Events:
 *   sc:open   { service: object }
 *   sc:close  {}
 */
;(function () {
  'use strict';

  const STATUS_ICONS = {
    healthy: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--success)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
    degraded: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
    critical: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--destructive)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
    unknown: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--muted-foreground)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`
  };

  const METHOD_COLORS = {
    GET: 'var(--success)',
    POST: 'var(--primary)',
    PUT: '#f59e0b',
    PATCH: '#8b5cf6',
    DELETE: 'var(--destructive)'
  };

  function renderApiList(apis) {
    if (!apis || apis.length === 0) {
      return '<p class="text-sm text-muted">No APIs registered</p>';
    }
    
    return `
      <div data-slot="service-api-list">
        ${apis.map(api => `
          <div data-slot="service-api-item">
            <div style="display:flex;align-items:center;gap:12px;flex:1">
              <span data-slot="service-api-method" style="background:${METHOD_COLORS[api.method] || 'var(--muted)'}">
                ${api.method}
              </span>
              <code data-slot="service-api-path">${api.path}</code>
            </div>
            <div style="display:flex;align-items:center;gap:12px">
              <span class="text-xs text-muted">${api.version || 'v1'}</span>
              ${api.rateLimit ? `<span data-slot="badge" data-variant="outline" style="font-size:11px">${api.rateLimit}</span>` : ''}
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  function renderDeploymentContext(ctx) {
    if (!ctx) return '';

    return `
      <div>
        <h3 style="font-size:16px;font-weight:600;margin-bottom:12px;display:flex;align-items:center;gap:8px">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="5" r="3"/><line x1="12" y1="22" x2="12" y2="8"/><path d="M5 12H2a10 10 0 0 0 20 0h-3"/></svg>
          Deployment Context
        </h3>
        <p class="text-sm text-muted" style="margin-bottom:16px">
          The governance construct defining identity (dimensions) and behavior (policies) for this deployment unit.
        </p>

        <!-- Core Identity (Dimensions) -->
        <div data-slot="service-core-identity">
          <h4 style="font-weight:600;margin-bottom:12px;display:flex;align-items:center;gap:8px">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            Core Identity (Dimensions)
          </h4>
          <p class="text-xs text-muted" style="margin-bottom:16px">
            Defines what this unit is. Changes require infrastructure isolation.
          </p>
          <div data-slot="service-identity-grid">
            <div data-slot="service-identity-item">
              <div data-slot="service-identity-icon">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
              </div>
              <div>
                <div class="text-xs text-muted" style="font-weight:500">Region</div>
                <div class="text-sm font-semibold" style="margin-top:2px">${ctx.region || '\u2014'}</div>
                <div class="text-xs text-muted" style="margin-top:2px">Physical jurisdiction</div>
              </div>
            </div>
            <div data-slot="service-identity-item">
              <div data-slot="service-identity-icon">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="5" r="3"/><line x1="12" y1="22" x2="12" y2="8"/><path d="M5 12H2a10 10 0 0 0 20 0h-3"/></svg>
              </div>
              <div>
                <div class="text-xs text-muted" style="font-weight:500">Exposure</div>
                <div class="text-sm font-semibold" style="margin-top:2px">${ctx.exposure || '\u2014'}</div>
                <div class="text-xs text-muted" style="margin-top:2px">Network reachability</div>
              </div>
            </div>
            <div data-slot="service-identity-item">
              <div data-slot="service-identity-icon">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
              </div>
              <div>
                <div class="text-xs text-muted" style="font-weight:500">Data Ownership</div>
                <div class="text-sm font-semibold" style="margin-top:2px">${ctx.dataOwner || '\u2014'}</div>
                <div class="text-xs text-muted" style="margin-top:2px">Legal entity boundary</div>
              </div>
            </div>
            <div data-slot="service-identity-item">
              <div data-slot="service-identity-icon">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>
              </div>
              <div>
                <div class="text-xs text-muted" style="font-weight:500">Auth Profile</div>
                <div class="text-sm font-semibold" style="margin-top:2px">${ctx.authProfile || '\u2014'}</div>
                <div class="text-xs text-muted" style="margin-top:2px">Security contract</div>
              </div>
            </div>
            <div data-slot="service-identity-item" style="grid-column:span 2">
              <div data-slot="service-identity-icon">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
              </div>
              <div>
                <div class="text-xs text-muted" style="font-weight:500">Interface Type</div>
                <div class="text-sm font-semibold" style="margin-top:2px">${ctx.interfaceType || '\u2014'}</div>
                <div class="text-xs text-muted" style="margin-top:2px">Protocol stack</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Runtime Behavior (Policies) -->
        <div data-slot="service-runtime-behavior">
          <h4 style="font-weight:600;margin-bottom:12px;display:flex;align-items:center;gap:8px">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/></svg>
            Runtime Behavior (Policies)
          </h4>
          <p class="text-xs text-muted" style="margin-bottom:16px">
            Defines how this unit behaves. Extensible and changeable at runtime.
          </p>
          <div data-slot="service-policy-grid">
            <div data-slot="service-policy-item">
              <div data-slot="service-policy-icon">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              </div>
              <div>
                <div class="text-xs text-muted" style="font-weight:500">Data Classification</div>
                <div class="text-sm font-semibold" style="margin-top:2px">${ctx.dataClassification || '\u2014'}</div>
                <div class="text-xs text-muted" style="margin-top:2px">Protection level</div>
              </div>
            </div>
            <div data-slot="service-policy-item">
              <div data-slot="service-policy-icon">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/></svg>
              </div>
              <div>
                <div class="text-xs text-muted" style="font-weight:500">Service Tier</div>
                <div class="text-sm font-semibold" style="margin-top:2px">${ctx.serviceTier || '\u2014'}</div>
                <div class="text-xs text-muted" style="margin-top:2px">SLA and scaling</div>
              </div>
            </div>
            <div data-slot="service-policy-item" style="grid-column:span 2">
              <div data-slot="service-policy-icon">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
              </div>
              <div>
                <div class="text-xs text-muted" style="font-weight:500">Deployment Context Name</div>
                <div class="text-sm font-semibold" style="margin-top:2px">${ctx.name || '\u2014'}</div>
                <div class="text-xs text-muted" style="margin-top:2px">Unique identifier for this deployment configuration</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function renderGoldenRule() {
    return `
      <div data-slot="service-golden-rule">
        <div style="display:flex;align-items:flex-start;gap:8px">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#d97706" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;margin-top:2px"><circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/></svg>
          <div>
            <h5 style="font-weight:600;font-size:13px;margin-bottom:4px">The Golden Rule</h5>
            <p class="text-xs" style="color:var(--foreground);line-height:1.5">
              If a property requires physical isolation or a new provisioning step, it is a <strong>Dimension</strong>.
              If it only modifies logic or thresholds, it is a <strong>Policy</strong>. Together with a unique Name,
              these elements ensure every API deployment is explicit, secure, and governable.
            </p>
          </div>
        </div>
      </div>
    `;
  }

  function renderDialogContent(service) {
    const status = service.status || 'unknown';
    const ctx = service.deploymentContext || {};
    
    return `
      <div data-slot="dialog-header">
        <div style="display:flex;align-items:center;gap:12px">
          <div data-slot="service-status-icon" data-status="${status}">
            ${STATUS_ICONS[status] || STATUS_ICONS.unknown}
          </div>
          <div>
            <div style="display:flex;align-items:center;gap:8px">
              <div data-slot="dialog-title">${service.name || 'Service'}</div>
              <span data-slot="badge" data-variant="${status === 'healthy' ? 'default' : 'destructive'}">${status}</span>
            </div>
            <div data-slot="dialog-description">${service.category || ''} \u2022 ${service.id || ''}</div>
          </div>
        </div>
        <button data-slot="dialog-close" aria-label="Close" style="position:absolute;top:16px;right:16px;background:none;border:none;cursor:pointer;padding:4px">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      
      <div data-slot="dialog-body" style="padding:24px 0;display:flex;flex-direction:column;gap:24px">
        <!-- Service Overview -->
        <div data-slot="service-overview-grid">
          <div data-slot="service-overview-card">
            <div class="text-xs text-muted" style="font-weight:500;margin-bottom:4px">Response Time</div>
            <div class="text-2xl font-semibold">${service.responseTime || '\u2014'}ms</div>
          </div>
          <div data-slot="service-overview-card">
            <div class="text-xs text-muted" style="font-weight:500;margin-bottom:4px">Health Endpoint</div>
            <code class="text-sm" style="margin-top:4px">${service.healthEndpoint || '/health'}</code>
          </div>
          <div data-slot="service-overview-card">
            <div class="text-xs text-muted" style="font-weight:500;margin-bottom:4px">API Count</div>
            <div class="text-2xl font-semibold">${(service.apis || []).length}</div>
          </div>
        </div>

        <hr data-slot="separator">

        <!-- APIs Offered -->
        <div>
          <h3 style="font-size:16px;font-weight:600;margin-bottom:12px;display:flex;align-items:center;gap:8px">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
            APIs Offered
          </h3>
          ${renderApiList(service.apis)}
        </div>

        <hr data-slot="separator">

        <!-- Deployment Context -->
        ${renderDeploymentContext(ctx)}

        <!-- Golden Rule -->
        ${renderGoldenRule()}
      </div>

      <div data-slot="dialog-footer">
        <button data-slot="button" data-variant="outline" data-slot-also="dialog-close">Close</button>
      </div>
    `;
  }

  Scooter.register('service-detail-dialog', function (el) {
    const dlg = el.querySelector('[data-slot="dialog-content"]');
    if (!dlg) return;

    let currentService = null;

    function open(service) {
      currentService = service;
      dlg.innerHTML = renderDialogContent(service);
      dlg.setAttribute('data-state', 'open');

      if (!dlg.open) {
        dlg.showModal();
      }
      
      if (typeof Scooter.trapFocus === 'function') {
        Scooter.trapFocus(dlg);
      }
      
      el.dispatchEvent(new CustomEvent('sc:open', {
        bubbles: true,
        detail: { service }
      }));
    }

    function close() {
      dlg.setAttribute('data-state', 'closed');
      el.dispatchEvent(new CustomEvent('sc:close', { bubbles: true }));
      
      if (typeof Scooter.animateOut === 'function') {
        Scooter.animateOut(dlg, () => dlg.close(), 200);
      } else {
        setTimeout(() => dlg.close(), 200);
      }
    }

    // Close button handling
    dlg.addEventListener('click', function (e) {
      const btn = e.target.closest('[data-slot="dialog-close"]');
      if (btn) close();
    });

    // Backdrop click
    dlg.addEventListener('click', function (e) {
      if (e.target === dlg) close();
    });

    // ESC key
    dlg.addEventListener('cancel', function (e) {
      e.preventDefault();
      close();
    });

    // Expose API
    el._serviceDetailDialog = {
      open,
      close,
      getService: () => currentService
    };
  });
})();
