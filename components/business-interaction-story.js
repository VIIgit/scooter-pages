/**
 * Business Interaction Story — Display Component
 *
 * Scroll-driven storytelling that visualises Business Interaction Patterns
 * with an SVG entity diagram, animated connections, and a text panel.
 *
 * Dependencies: business-interaction-data.js (must load first)
 *
 * Usage:
 *   <div data-sc="business-interaction-story"></div>
 *
 *   <script src="../components/scooter-core.js"></script>
 *   <script src="../components/business-interaction-data.js"></script>
 *   <script src="../components/business-interaction-story.js"></script>
 */
(function () {
  'use strict';

  var DATA = window.BusinessInteractionData;
  if (!DATA) { console.error('business-interaction-data.js must be loaded before business-interaction-story.js'); return; }

  var ENTITIES        = DATA.ENTITIES;
  var ENTITY_MAP      = DATA.ENTITY_MAP;
  var CONNECTION_PATHS = DATA.CONNECTION_PATHS;
  var LABEL_ANCHOR    = DATA.LABEL_ANCHOR;
  var ALL_CONNECTIONS = DATA.ALL_CONNECTIONS;
  var BACKGROUND_ZONES = DATA.BACKGROUND_ZONES;
  var ZONE_LABELS     = DATA.ZONE_LABELS;
  var PATTERNS        = DATA.PATTERNS;
  var ICONS           = DATA.ICONS;
  var NUM_PATTERNS    = PATTERNS.length;

  var SVG_NS = 'http://www.w3.org/2000/svg';

  // ─── Helpers ────────────────────────────────────────────────────────────────

  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === 'style' && typeof attrs[k] === 'object') {
        Object.assign(node.style, attrs[k]);
      } else if (k === 'className') {
        node.className = attrs[k];
      } else if (k === 'innerHTML') {
        node.innerHTML = attrs[k];
      } else {
        node.setAttribute(k, attrs[k]);
      }
    });
    if (children) {
      (Array.isArray(children) ? children : [children]).forEach(function (c) {
        if (typeof c === 'string') node.appendChild(document.createTextNode(c));
        else if (c) node.appendChild(c);
      });
    }
    return node;
  }

  function svgEl(tag, attrs) {
    var node = document.createElementNS(SVG_NS, tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === 'style' && typeof attrs[k] === 'object') {
        Object.keys(attrs[k]).forEach(function (s) { node.style[s] = attrs[k][s]; });
      } else if (k === 'textContent') {
        node.textContent = attrs[k];
      } else {
        node.setAttribute(k, attrs[k]);
      }
    });
    return node;
  }

  function iconSvg(name, size) {
    var html = ICONS[name] || '';
    var container = document.createElement('span');
    container.innerHTML = html;
    var svg = container.firstElementChild;
    if (svg && size) {
      svg.setAttribute('width', size);
      svg.setAttribute('height', size);
    }
    return svg || document.createTextNode('');
  }

  // ─── Flow Dots (animated dots on path) ──────────────────────────────────────

  function createFlowDots(pathD, color, reverse) {
    var g = svgEl('g');
    var delays = [0, 0.27, 0.54];
    delays.forEach(function (delay) {
      var circle = svgEl('circle', {
        r: '3.5', fill: color, opacity: '0.85',
        style: { filter: 'drop-shadow(0 0 3px ' + color + ')' },
      });
      var anim = svgEl('animateMotion', {
        dur: '0.85s',
        repeatCount: 'indefinite',
        begin: delay + 's',
        keyPoints: reverse ? '1;0' : '0;1',
        keyTimes: '0;1',
        calcMode: 'linear',
        path: pathD,
      });
      circle.appendChild(anim);
      g.appendChild(circle);
    });
    return g;
  }

  // ─── Build Connection SVG ───────────────────────────────────────────────────

  function buildConnection(conn, isActive, isOverview, patternColor) {
    var pathD = CONNECTION_PATHS[conn.id];
    if (!pathD) return svgEl('g');
    var anchor = LABEL_ANCHOR[conn.id] || [310, 190];
    var mx = anchor[0], my = anchor[1];
    var g = svgEl('g');

    // Glow
    if (isActive) {
      g.appendChild(svgEl('path', {
        d: pathD, stroke: patternColor, 'stroke-width': '10',
        fill: 'none', opacity: '0.12', 'stroke-linecap': 'round',
      }));
    }

    // Main path
    g.appendChild(svgEl('path', {
      d: pathD,
      stroke: isActive ? patternColor : '#c7c7cc',
      'stroke-width': isActive ? '2' : '1',
      fill: 'none', 'stroke-linecap': 'round',
      'stroke-dasharray': isActive ? 'none' : '4 4',
      opacity: isActive ? '1' : (isOverview ? '0.35' : '0.07'),
      style: { transition: 'opacity 0.4s, stroke 0.4s' },
    }));

    // Flowing dots
    if (isActive) {
      g.appendChild(createFlowDots(pathD, patternColor, false));
      if (conn.bidir) {
        g.appendChild(createFlowDots(pathD, patternColor, true));
      }
    }

    // Label badge
    if (isActive) {
      var labelW = conn.label.length * 6.2 + 22;
      var lg = svgEl('g', { style: { animation: 'bisLabelIn 0.3s 0.35s both' } });
      lg.appendChild(svgEl('rect', {
        x: String(mx - labelW / 2), y: String(my - 11),
        width: String(labelW), height: '22', rx: '11',
        fill: 'white', stroke: patternColor, 'stroke-width': '1.5',
        style: { filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.12))' },
      }));
      lg.appendChild(svgEl('text', {
        x: String(mx), y: String(my + 4.5),
        'text-anchor': 'middle', 'font-size': '10',
        'font-family': '-apple-system, system-ui, sans-serif',
        'font-weight': '600', fill: patternColor,
        textContent: conn.label,
      }));
      g.appendChild(lg);
    }

    return g;
  }

  // ─── Build Entity Node (HTML overlay) ───────────────────────────────────────

  function buildEntityNode(entity, isInPattern, isOverview) {
    var visible = isInPattern || isOverview;
    var highlighted = isInPattern && !isOverview;

    var wrapper = el('div', {
      className: 'bis-entity',
      style: {
        position: 'absolute',
        left: (entity.cx / 620 * 100) + '%',
        top: (entity.cy / 380 * 100) + '%',
        transform: 'translate(-50%, -50%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '6px',
        userSelect: 'none',
        opacity: visible ? '1' : '0.18',
        transition: 'opacity 0.5s cubic-bezier(0.4,0,0.2,1), transform 0.5s cubic-bezier(0.4,0,0.2,1)',
      },
    });

    if (highlighted) wrapper.style.transform = 'translate(-50%, -50%) scale(1.06)';

    // Pulse ring
    if (highlighted) {
      var pulse = el('div', {
        className: 'bis-pulse',
        style: {
          position: 'absolute',
          width: '60px', height: '60px',
          top: '0', left: '50%', transform: 'translateX(-50%)',
          border: '2px solid ' + entity.color,
          borderRadius: '16px',
          pointerEvents: 'none',
          animation: 'bisPulse 1.8s ease-out infinite',
        },
      });
      wrapper.appendChild(pulse);
    }

    // Icon box
    var iconBox = el('div', {
      style: {
        position: 'relative',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        width: '60px', height: '60px', borderRadius: '16px',
        background: highlighted ? entity.bg : '#ffffff',
        boxShadow: highlighted
          ? '0 0 0 2px ' + entity.color + ', 0 8px 24px ' + entity.color + '28'
          : '0 2px 12px rgba(0,0,0,0.07)',
        color: visible ? entity.color : '#c7c7cc',
        transition: 'background 0.45s, box-shadow 0.45s, color 0.45s',
      },
    });
    if (entity.image) {
      var img = el('img', {
        src: entity.image,
        style: {
          width: '48px', height: '48px', objectFit: 'contain',
          display: 'block', pointerEvents: 'none',
        },
      });
      iconBox.appendChild(img);
    } else {
      iconBox.appendChild(iconSvg(entity.icon, 36));
    }
    wrapper.appendChild(iconBox);

    // Labels
    var labels = el('div', { style: { textAlign: 'center', minWidth: '88px' } });
    labels.appendChild(el('p', {
      style: { fontSize: '11px', fontWeight: '600', color: highlighted ? '#1d1d1f' : '#6e6e73', lineHeight: '1.35', margin: '0' },
    }, entity.label));
    labels.appendChild(el('p', {
      style: { fontSize: '10px', color: '#aeaeb2', lineHeight: '1.25', margin: '0' },
    }, entity.sublabel));
    wrapper.appendChild(labels);

    return wrapper;
  }

  // ─── Build Nav Pill ─────────────────────────────────────────────────────────

  function buildNavPill(pattern, active) {
    return el('button', {
      className: 'bis-nav-pill',
      style: {
        fontWeight: active ? '700' : '500',
        color: active ? '#ffffff' : '#6e6e73',
        background: active ? pattern.color : 'rgba(0,0,0,0.04)',
        border: '1px solid ' + (active ? pattern.color : 'rgba(0,0,0,0.06)'),
        fontSize: '13px',
        letterSpacing: active ? '0.02em' : '0',
        boxShadow: active ? '0 4px 16px ' + pattern.color + '40' : 'none',
        padding: '8px 16px',
        borderRadius: '9999px',
        cursor: 'pointer',
        transition: 'all 0.35s',
        outline: 'none',
      },
    }, pattern.label);
  }

  // ─── Build Flow Chain ───────────────────────────────────────────────────────

  function buildFlowChain(flow, color) {
    if (!flow || flow.length === 0) return null;
    var wrapper = el('div', {
      style: {
        display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap',
        animation: 'bisFadeUp 0.4s 0.25s both',
      },
    });

    flow.forEach(function (entityId, i) {
      var e = ENTITY_MAP[entityId];
      var chip = el('span', {
        style: {
          display: 'inline-flex', alignItems: 'center', gap: '6px',
          padding: '4px 10px', borderRadius: '9999px',
          background: e.color + '14', border: '1px solid ' + e.color + '30',
          color: e.color, fontSize: '12px', fontWeight: '600',
        },
      });
      chip.appendChild(iconSvg(e.icon, 12));
      chip.appendChild(document.createTextNode(e.label));

      var span = el('span', { style: { display: 'flex', alignItems: 'center', gap: '6px' } });
      span.appendChild(chip);
      if (i < flow.length - 1) {
        var arrow = el('span', { style: { color: color, opacity: '0.7', display: 'inline-flex' } });
        arrow.appendChild(iconSvg('arrowRight', 13));
        span.appendChild(arrow);
      }
      wrapper.appendChild(span);
    });

    return wrapper;
  }

  // ─── Build Pattern Content (text panel) ─────────────────────────────────────

  function buildPatternContent(pattern) {
    var panel = el('div', {
      className: 'bis-content',
      style: {
        display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '440px',
        animation: 'bisFadeUp 0.5s both',
      },
    });

    // Label pill
    var pill = el('div', {
      style: {
        display: 'inline-flex', alignItems: 'center', gap: '8px', alignSelf: 'flex-start',
        padding: '6px 12px', borderRadius: '9999px',
        background: pattern.color + '12', border: '1.5px solid ' + pattern.color + '35',
        color: pattern.color, animation: 'bisFadeRight 0.38s 0.08s both',
      },
    });
    pill.appendChild(el('span', {
      style: { width: '8px', height: '8px', borderRadius: '50%', background: pattern.color, display: 'block' },
    }));
    pill.appendChild(el('span', {
      style: { fontSize: '11px', fontWeight: '700', letterSpacing: '0.07em', textTransform: 'uppercase' },
    }, pattern.fullLabel));
    panel.appendChild(pill);

    // Title
    panel.appendChild(el('h2', {
      style: {
        fontSize: 'clamp(22px, 2.8vw, 34px)', lineHeight: '1.18', fontWeight: '700',
        color: '#1d1d1f', letterSpacing: '-0.02em', margin: '0',
        animation: 'bisFadeUp 0.45s 0.14s both',
      },
    }, pattern.title));

    // Subtitle
    panel.appendChild(el('p', {
      style: {
        fontSize: '14px', color: pattern.color, fontWeight: '600', lineHeight: '1.4', margin: '0',
        animation: 'bisFadeIn 0.4s 0.18s both',
      },
    }, pattern.subtitle));

    // Flow chain
    var chain = buildFlowChain(pattern.flow, pattern.color);
    if (chain) panel.appendChild(chain);

    // Description
    panel.appendChild(el('p', {
      style: {
        fontSize: '15px', color: '#6e6e73', lineHeight: '1.68', margin: '0',
        animation: 'bisFadeUp 0.45s 0.26s both',
      },
    }, pattern.description));

    // Tags
    var tagsWrap = el('div', {
      style: {
        display: 'flex', flexWrap: 'wrap', gap: '6px',
        animation: 'bisFadeIn 0.4s 0.35s both',
      },
    });
    pattern.tags.forEach(function (tag) {
      tagsWrap.appendChild(el('span', {
        style: {
          fontSize: '11px', fontWeight: '500',
          padding: '4px 10px', borderRadius: '9999px',
          background: pattern.color + '0d', border: '1px solid ' + pattern.color + '28',
          color: pattern.color,
        },
      }, tag));
    });
    panel.appendChild(tagsWrap);

    return panel;
  }

  // ─── Inject Styles ──────────────────────────────────────────────────────────

  function injectStyles() {
    if (document.getElementById('bis-styles')) return;
    var css = [
      '@keyframes bisPulse { 0% { transform: translateX(-50%) scale(1); opacity: 0.5; } 50% { transform: translateX(-50%) scale(1.7); opacity: 0.25; } 100% { transform: translateX(-50%) scale(2.2); opacity: 0; } }',
      '@keyframes bisFadeUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }',
      '@keyframes bisFadeIn { from { opacity: 0; } to { opacity: 1; } }',
      '@keyframes bisFadeRight { from { opacity: 0; transform: translateX(-10px); } to { opacity: 1; transform: translateX(0); } }',
      '@keyframes bisLabelIn { from { opacity: 0; transform: scale(0.85); } to { opacity: 1; transform: scale(1); } }',
      '@keyframes bisBounce { 0%,100% { transform: translateY(0); } 50% { transform: translateY(5px); } }',
      '.bis-viewport { position: sticky; top: 0; overflow: hidden; display: flex; flex-direction: column; height: 100vh; transition: background 0.6s; }',
      '.bis-accent-bar { position: absolute; top: 0; left: 0; right: 0; height: 4px; pointer-events: none; transition: background 0.5s; }',
      '.bis-header { flex: none; padding: 28px 32px 12px; }',
      '.bis-header-inner { max-width: 1152px; margin: 0 auto; display: flex; flex-direction: column; align-items: center; gap: 16px; }',
      '.bis-section-label { text-transform: uppercase; letter-spacing: 0.14em; font-size: 11px; color: #aeaeb2; text-align: center; }',
      '.bis-nav { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; justify-content: center; }',
      '.bis-main { flex: 1; display: flex; align-items: center; justify-content: center; padding: 0 24px 24px; min-height: 0; }',
      '.bis-main-inner { max-width: 1152px; width: 100%; margin: 0 auto; display: flex; align-items: center; gap: 48px; }',
      '.bis-diagram-wrap { flex: 1; width: 100%; max-width: 560px; }',
      '.bis-diagram { position: relative; width: 100%; aspect-ratio: 620/380; max-height: 46vh; }',
      '.bis-divider { align-self: stretch; flex: none; width: 1px; transition: background 0.5s; }',
      '.bis-text-panel { flex: 1; display: flex; align-items: center; justify-content: flex-start; min-width: 0; }',
      '.bis-scroll-hint { flex: none; padding-bottom: 24px; display: flex; flex-direction: column; align-items: center; gap: 6px; }',
      '.bis-scroll-hint span:first-child { font-size: 11px; color: #c7c7cc; letter-spacing: 0.12em; text-transform: uppercase; }',
      '.bis-scroll-hint span:last-child { animation: bisBounce 1.5s ease-in-out infinite; color: #c7c7cc; display: inline-flex; }',
      '.bis-progress-track { flex: none; height: 2px; margin: 0 32px 4px; border-radius: 1px; background: #f0f0f5; overflow: hidden; }',
      '.bis-progress-bar { height: 100%; border-radius: 1px; transition: width 0.5s cubic-bezier(0.4,0,0.2,1), background 0.5s; }',
      '@media (max-width: 1023px) { .bis-main-inner { flex-direction: column; gap: 32px; } .bis-divider { display: none; } .bis-diagram-wrap { max-width: 100%; } }',
    ].join('\n');
    var style = document.createElement('style');
    style.id = 'bis-styles';
    style.textContent = css;
    document.head.appendChild(style);
  }

  // ─── Render Full Component ──────────────────────────────────────────────────

  function render(root) {
    var activeIndex = 0;

    // Outer tall container
    root.style.position = 'relative';
    root.style.width = '100%';
    root.style.height = (NUM_PATTERNS + 1) * 100 + 'vh';

    // Sticky viewport
    var viewport = el('div', { className: 'bis-viewport' });
    root.appendChild(viewport);

    // Accent bar
    var accentBar = el('div', { className: 'bis-accent-bar' });
    viewport.appendChild(accentBar);

    // Header + nav
    var header = el('div', { className: 'bis-header' });
    var headerInner = el('div', { className: 'bis-header-inner' });
    headerInner.appendChild(el('p', { className: 'bis-section-label' }, 'Gateway — Business Interaction Patterns'));
    var nav = el('div', { className: 'bis-nav' });
    headerInner.appendChild(nav);
    header.appendChild(headerInner);
    viewport.appendChild(header);

    // Main area
    var main = el('div', { className: 'bis-main' });
    var mainInner = el('div', { className: 'bis-main-inner' });

    // Diagram wrap
    var diagramWrap = el('div', { className: 'bis-diagram-wrap' });
    var diagram = el('div', { className: 'bis-diagram' });
    diagramWrap.appendChild(diagram);
    mainInner.appendChild(diagramWrap);

    // Divider
    var divider = el('div', { className: 'bis-divider' });
    mainInner.appendChild(divider);

    // Text panel
    var textPanel = el('div', { className: 'bis-text-panel' });
    mainInner.appendChild(textPanel);

    main.appendChild(mainInner);
    viewport.appendChild(main);

    // Scroll hint
    var scrollHint = el('div', { className: 'bis-scroll-hint' });
    scrollHint.appendChild(el('span', {}, 'Scroll or tap a pattern to explore'));
    var bounceSpan = el('span');
    bounceSpan.appendChild(iconSvg('chevronDown', 16));
    scrollHint.appendChild(bounceSpan);
    viewport.appendChild(scrollHint);

    // Progress bar
    var progressTrack = el('div', { className: 'bis-progress-track' });
    var progressBar = el('div', { className: 'bis-progress-bar' });
    progressTrack.appendChild(progressBar);
    viewport.appendChild(progressTrack);

    // ─── Update view for given pattern index ──────────────────────────────────

    function update(index) {
      if (index === activeIndex && diagram.hasChildNodes()) return;
      activeIndex = index;
      var pattern = PATTERNS[index];
      var isOverview = pattern.id === 'overview';

      // Background
      viewport.style.background = isOverview
        ? '#fafafa'
        : 'linear-gradient(135deg, #ffffff 60%, ' + pattern.color + '09 100%)';

      // Accent bar
      accentBar.style.background = isOverview ? '#f5f5f7' : pattern.color;

      // Nav pills
      nav.innerHTML = '';
      PATTERNS.forEach(function (p, i) {
        var pill = buildNavPill(p, i === index);
        pill.addEventListener('click', function () { scrollToPattern(i); });
        nav.appendChild(pill);
      });

      // Diagram — rebuild SVG + entity nodes
      diagram.innerHTML = '';

      var svg = document.createElementNS(SVG_NS, 'svg');
      svg.setAttribute('viewBox', '0 0 620 380');
      svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
      svg.setAttribute('overflow', 'visible');
      svg.style.cssText = 'position:absolute;inset:0;width:100%;height:100%';

      // Background zones
      BACKGROUND_ZONES.forEach(function (zone) {
        var zoneEntity = ENTITY_MAP[zone.entity];
        svg.appendChild(svgEl('rect', {
          x: String(zone.x), y: String(zone.y),
          width: String(zone.width), height: String(zone.height),
          rx: String(zone.rx),
          fill: isOverview ? '#f5f5f7' : zoneEntity.color + '19',
          opacity: isOverview ? '0.5' : '1',
          style: { transition: 'fill 0.5s, opacity 0.5s' },
        }));
      });

      // Zone labels
      ZONE_LABELS.forEach(function (zl) {
        svg.appendChild(svgEl('text', {
          x: String(zl.x), y: String(zl.y),
          'text-anchor': 'middle', 'font-size': '9',
          'font-family': '-apple-system, system-ui', 'font-weight': '600',
          'letter-spacing': '1.5', fill: '#aeaeb2',
          opacity: isOverview ? '0.6' : '0.9',
          textContent: zl.label,
        }));
      });

      // Connections
      ALL_CONNECTIONS.forEach(function (conn) {
        svg.appendChild(buildConnection(
          conn,
          pattern.activeConnections.indexOf(conn.id) !== -1,
          isOverview,
          pattern.color
        ));
      });

      diagram.appendChild(svg);

      // Entity nodes (HTML overlay)
      ENTITIES.forEach(function (entity) {
        diagram.appendChild(buildEntityNode(
          entity,
          pattern.activeEntities.indexOf(entity.id) !== -1,
          isOverview
        ));
      });

      // Divider
      divider.style.background = isOverview
        ? '#e5e5ea'
        : 'linear-gradient(to bottom, transparent, ' + pattern.color + '40, transparent)';

      // Text panel
      textPanel.innerHTML = '';
      textPanel.appendChild(buildPatternContent(pattern));

      // Scroll hint visibility
      scrollHint.style.display = index === 0 ? '' : 'none';

      // Progress bar
      progressBar.style.width = (index / (NUM_PATTERNS - 1)) * 100 + '%';
      progressBar.style.background = pattern.color;
    }

    // ─── Scroll tracking ──────────────────────────────────────────────────────

    function onScroll() {
      var rect = root.getBoundingClientRect();
      var scrolledIn = -rect.top;
      if (scrolledIn < 0) { update(0); return; }
      var chapter = Math.max(0, Math.min(NUM_PATTERNS - 1, Math.floor(scrolledIn / window.innerHeight)));
      update(chapter);
    }

    function scrollToPattern(index) {
      var rect = root.getBoundingClientRect();
      var target = window.scrollY + rect.top + index * window.innerHeight;
      window.scrollTo({ top: target, behavior: 'smooth' });
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    // Expose API
    root._businessInteractionStory = {
      goTo: function (index) { scrollToPattern(index); },
      getActiveIndex: function () { return activeIndex; },
      destroy: function () { window.removeEventListener('scroll', onScroll); root.innerHTML = ''; },
    };
  }

  // ─── Register with Scooter ──────────────────────────────────────────────────

  function init() {
    injectStyles();
    document.querySelectorAll('[data-sc="business-interaction-story"]').forEach(function (el) {
      if (el._businessInteractionStory) return;
      render(el);
    });
  }

  if (window.Scooter) {
    Scooter.register('business-interaction-story', init);
  } else {
    document.addEventListener('DOMContentLoaded', init);
  }
})();
