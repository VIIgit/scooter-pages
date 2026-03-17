/**
 * Scooter Chart Component — lightweight SVG charts (bar, line, area, pie/donut)
 * No external dependencies. Uses --chart-1…--chart-5 tokens from base.css.
 *
 * Usage:
 *   <div data-sc="chart" data-type="bar" data-height="300">
 *     <script type="application/json">
 *       {
 *         "labels": ["Jan","Feb","Mar","Apr","May","Jun"],
 *         "datasets": [
 *           { "label": "Revenue", "values": [40,65,50,80,60,90] },
 *           { "label": "Expenses", "values": [30,40,35,50,45,55] }
 *         ]
 *       }
 *     </script>
 *   </div>
 *
 * Options:
 *   data-type     = "bar" | "line" | "area" | "pie" | "donut"  (default "bar")
 *   data-height   = pixel height (default 300)
 *   data-show-grid    = "true" | "false" (default "true")
 *   data-show-legend  = "true" | "false" (default "true")
 *   data-show-values  = "true" | "false" (default "false")
 *   data-stacked      = "true" | "false" (default "false", bar only)
 *
 * Events:
 *   sc:hover  → { index, label, values }
 */
;(function () {
  'use strict';

  var CHART_COLORS = [
    'var(--chart-1)',
    'var(--chart-2)',
    'var(--chart-3)',
    'var(--chart-4)',
    'var(--chart-5)'
  ];

  var PADDING = { top: 20, right: 20, bottom: 40, left: 50 };

  // ── Tooltip helper ────────────────────────────────────────────

  function ensureTooltip(el) {
    var tip = el.querySelector('[data-slot="chart-tooltip"]');
    if (!tip) {
      tip = document.createElement('div');
      tip.setAttribute('data-slot', 'chart-tooltip');
      tip.style.cssText =
        'position:absolute;pointer-events:none;z-index:50;opacity:0;transition:opacity 120ms;' +
        'background:var(--popover, var(--background));color:var(--popover-foreground, var(--foreground));' +
        'border:1px solid var(--border);border-radius:6px;padding:8px 12px;font-size:12px;' +
        'box-shadow:0 2px 8px rgba(0,0,0,.12);white-space:nowrap;';
      el.style.position = 'relative';
      el.appendChild(tip);
    }
    return tip;
  }

  function showTooltip(el, evt, html) {
    var tip = ensureTooltip(el);
    tip.innerHTML = html;
    tip.style.opacity = '1';
    var rect = el.getBoundingClientRect();
    var x = evt.clientX - rect.left + 12;
    var y = evt.clientY - rect.top - 8;
    // Prevent overflow right
    if (x + tip.offsetWidth > el.clientWidth) x = x - tip.offsetWidth - 24;
    if (y + tip.offsetHeight > el.clientHeight) y = Math.max(0, y - tip.offsetHeight);
    tip.style.left = x + 'px';
    tip.style.top = y + 'px';
  }

  function hideTooltip(el) {
    var tip = el.querySelector('[data-slot="chart-tooltip"]');
    if (tip) tip.style.opacity = '0';
  }

  function buildTooltipHtml(label, datasets, index) {
    var lines = '<div style="font-weight:600;margin-bottom:4px">' + label + '</div>';
    datasets.forEach(function (ds, di) {
      var color = getColor(di);
      var val = ds.values[index];
      if (val == null) return;
      lines +=
        '<div style="display:flex;align-items:center;gap:6px;margin-top:2px">' +
        '<span style="width:8px;height:8px;border-radius:2px;background:' + color + ';display:inline-block"></span>' +
        '<span style="color:var(--muted-foreground)">' + (ds.label || 'Series ' + (di + 1)) + ':</span> ' +
        '<span style="font-weight:600">' + val.toLocaleString() + '</span>' +
        '</div>';
    });
    return lines;
  }

  function buildPieTooltipHtml(label, value, total) {
    var pct = Math.round(value / total * 100);
    return '<div style="font-weight:600;margin-bottom:2px">' + label + '</div>' +
      '<div>' + value.toLocaleString() + ' <span style="color:var(--muted-foreground)">(' + pct + '%)</span></div>';
  }

  function getColor(i) {
    return CHART_COLORS[i % CHART_COLORS.length];
  }

  function resolveColor(cssVar) {
    // Resolve a CSS var() to actual color for SVG fills
    var temp = document.createElement('div');
    temp.style.color = cssVar;
    temp.style.display = 'none';
    document.body.appendChild(temp);
    var color = getComputedStyle(temp).color;
    document.body.removeChild(temp);
    return color;
  }

  function svgEl(tag, attrs, children) {
    var el = document.createElementNS('http://www.w3.org/2000/svg', tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        el.setAttribute(k, attrs[k]);
      });
    }
    if (children) {
      if (typeof children === 'string') {
        el.textContent = children;
      } else if (Array.isArray(children)) {
        children.forEach(function (c) { if (c) el.appendChild(c); });
      }
    }
    return el;
  }

  // ── Bar / Line / Area Charts ──────────────────────────────────

  function renderCartesian(el, data, opts) {
    var type = opts.type;
    var height = opts.height;
    var width = el.clientWidth || 600;
    var showGrid = opts.showGrid;
    var showLegend = opts.showLegend;
    var showValues = opts.showValues;
    var stacked = opts.stacked && type === 'bar';

    var labels = data.labels || [];
    var datasets = data.datasets || [];
    var count = labels.length;
    if (count === 0) return;

    // Calculate data range
    var maxVal = 0;
    if (stacked) {
      for (var i = 0; i < count; i++) {
        var sum = 0;
        datasets.forEach(function (ds) { sum += (ds.values[i] || 0); });
        if (sum > maxVal) maxVal = sum;
      }
    } else {
      datasets.forEach(function (ds) {
        ds.values.forEach(function (v) { if (v > maxVal) maxVal = v; });
      });
    }
    maxVal = maxVal || 1;
    // Round up to nice number
    var magnitude = Math.pow(10, Math.floor(Math.log10(maxVal)));
    maxVal = Math.ceil(maxVal / magnitude) * magnitude;

    var chartW = width - PADDING.left - PADDING.right;
    var chartH = height - PADDING.top - PADDING.bottom;

    var svg = svgEl('svg', {
      width: width,
      height: height,
      viewBox: '0 0 ' + width + ' ' + height,
      'data-slot': 'chart-svg',
      style: 'display:block;width:100%;height:' + height + 'px;'
    });

    var g = svgEl('g', { transform: 'translate(' + PADDING.left + ',' + PADDING.top + ')' });
    svg.appendChild(g);

    // Grid lines & Y-axis labels
    var gridLines = 5;
    for (var gi = 0; gi <= gridLines; gi++) {
      var yPos = chartH - (gi / gridLines) * chartH;
      var val = Math.round((gi / gridLines) * maxVal);
      if (showGrid) {
        g.appendChild(svgEl('line', {
          x1: 0, y1: yPos, x2: chartW, y2: yPos,
          stroke: 'var(--border)', 'stroke-width': '1', 'stroke-dasharray': gi === 0 ? 'none' : '4,4'
        }));
      }
      g.appendChild(svgEl('text', {
        x: -8, y: yPos + 4,
        'text-anchor': 'end',
        'font-size': '11',
        fill: 'var(--muted-foreground)'
      }, String(val)));
    }

    // X-axis labels
    var step = chartW / count;
    labels.forEach(function (label, i) {
      g.appendChild(svgEl('text', {
        x: step * i + step / 2,
        y: chartH + 24,
        'text-anchor': 'middle',
        'font-size': '11',
        fill: 'var(--muted-foreground)'
      }, label));
    });

    // Tooltip tracking area
    var tooltipGroup = svgEl('g', { 'data-slot': 'chart-tooltip-layer' });

    if (type === 'bar') {
      var barGroupW = step * 0.7;
      var barW = stacked ? barGroupW : barGroupW / datasets.length;

      datasets.forEach(function (ds, di) {
        ds.values.forEach(function (v, vi) {
          var barH = (v / maxVal) * chartH;
          var x, y;
          if (stacked) {
            // Calculate offset for stacking
            var offset = 0;
            for (var si = 0; si < di; si++) {
              offset += ((datasets[si].values[vi] || 0) / maxVal) * chartH;
            }
            x = step * vi + (step - barGroupW) / 2;
            y = chartH - offset - barH;
          } else {
            x = step * vi + (step - barGroupW) / 2 + barW * di;
            y = chartH - barH;
          }
          var rect = svgEl('rect', {
            x: x, y: y, width: stacked ? barGroupW : barW, height: barH,
            rx: '3',
            fill: getColor(di),
            style: 'transition:opacity 150ms',
            'data-index': vi,
            'data-dataset': di
          });
          rect.addEventListener('mouseenter', function (e) {
            rect.style.opacity = '0.8';
            showTooltip(el, e, buildTooltipHtml(labels[vi], datasets, vi));
            emitHover(el, vi, labels[vi], datasets);
          });
          rect.addEventListener('mousemove', function (e) { showTooltip(el, e, buildTooltipHtml(labels[vi], datasets, vi)); });
          rect.addEventListener('mouseleave', function () { rect.style.opacity = '1'; hideTooltip(el); });
          g.appendChild(rect);

          if (showValues) {
            g.appendChild(svgEl('text', {
              x: x + (stacked ? barGroupW : barW) / 2,
              y: y - 4,
              'text-anchor': 'middle',
              'font-size': '10',
              fill: 'var(--foreground)'
            }, String(v)));
          }
        });
      });
    }

    if (type === 'line' || type === 'area') {
      datasets.forEach(function (ds, di) {
        var points = ds.values.map(function (v, vi) {
          return {
            x: step * vi + step / 2,
            y: chartH - (v / maxVal) * chartH
          };
        });

        // Area fill
        if (type === 'area') {
          var areaPath = 'M' + points[0].x + ',' + chartH;
          points.forEach(function (p) { areaPath += ' L' + p.x + ',' + p.y; });
          areaPath += ' L' + points[points.length - 1].x + ',' + chartH + ' Z';
          g.appendChild(svgEl('path', {
            d: areaPath,
            fill: getColor(di),
            opacity: '0.15'
          }));
        }

        // Line
        var linePath = points.map(function (p, pi) {
          return (pi === 0 ? 'M' : 'L') + p.x + ',' + p.y;
        }).join(' ');
        g.appendChild(svgEl('path', {
          d: linePath,
          fill: 'none',
          stroke: getColor(di),
          'stroke-width': '2',
          'stroke-linecap': 'round',
          'stroke-linejoin': 'round'
        }));

        // Dots
        points.forEach(function (p, pi) {
          var dot = svgEl('circle', {
            cx: p.x, cy: p.y, r: '4',
            fill: 'var(--background)',
            stroke: getColor(di),
            'stroke-width': '2',
            style: 'transition:r 150ms',
            'data-index': pi,
            'data-dataset': di
          });
          dot.addEventListener('mouseenter', function (e) {
            dot.setAttribute('r', '6');
            showTooltip(el, e, buildTooltipHtml(labels[pi], datasets, pi));
            emitHover(el, pi, labels[pi], datasets);
          });
          dot.addEventListener('mousemove', function (e) { showTooltip(el, e, buildTooltipHtml(labels[pi], datasets, pi)); });
          dot.addEventListener('mouseleave', function () { dot.setAttribute('r', '4'); hideTooltip(el); });
          g.appendChild(dot);

          if (showValues) {
            g.appendChild(svgEl('text', {
              x: p.x, y: p.y - 10,
              'text-anchor': 'middle',
              'font-size': '10',
              fill: 'var(--foreground)'
            }, String(ds.values[pi])));
          }
        });
      });
    }

    g.appendChild(tooltipGroup);
    el.appendChild(svg);

    // Legend
    if (showLegend && datasets.length > 0) {
      var legend = document.createElement('div');
      legend.setAttribute('data-slot', 'chart-legend');
      legend.style.cssText = 'display:flex;justify-content:center;gap:16px;padding:8px 0;font-size:12px;';
      datasets.forEach(function (ds, di) {
        var item = document.createElement('div');
        item.style.cssText = 'display:flex;align-items:center;gap:6px;';
        var swatch = document.createElement('div');
        swatch.style.cssText = 'width:10px;height:10px;border-radius:2px;background:' + getColor(di) + ';';
        item.appendChild(swatch);
        var lbl = document.createElement('span');
        lbl.style.color = 'var(--muted-foreground)';
        lbl.textContent = ds.label || ('Series ' + (di + 1));
        item.appendChild(lbl);
        legend.appendChild(item);
      });
      el.appendChild(legend);
    }
  }

  // ── Pie / Donut Charts ────────────────────────────────────────

  function renderPie(el, data, opts) {
    var height = opts.height;
    var width = el.clientWidth || 400;
    var size = Math.min(width, height);
    var cx = width / 2;
    var cy = height / 2;
    var outerR = size / 2 - 20;
    var innerR = opts.type === 'donut' ? outerR * 0.55 : 0;
    var showLegend = opts.showLegend;
    var showValues = opts.showValues;

    var items = data.labels.map(function (label, i) {
      var val = 0;
      data.datasets.forEach(function (ds) { val += (ds.values[i] || 0); });
      return { label: label, value: val };
    });
    var total = items.reduce(function (s, item) { return s + item.value; }, 0);
    if (total === 0) return;

    var svg = svgEl('svg', {
      width: width,
      height: height,
      viewBox: '0 0 ' + width + ' ' + height,
      'data-slot': 'chart-svg',
      style: 'display:block;width:100%;height:' + height + 'px;'
    });

    var angle = -Math.PI / 2;
    items.forEach(function (item, i) {
      var sweep = (item.value / total) * Math.PI * 2;
      var x1 = cx + outerR * Math.cos(angle);
      var y1 = cy + outerR * Math.sin(angle);
      var x2 = cx + outerR * Math.cos(angle + sweep);
      var y2 = cy + outerR * Math.sin(angle + sweep);
      var large = sweep > Math.PI ? 1 : 0;

      var d = 'M' + cx + ',' + cy;
      if (innerR > 0) {
        var ix1 = cx + innerR * Math.cos(angle);
        var iy1 = cy + innerR * Math.sin(angle);
        var ix2 = cx + innerR * Math.cos(angle + sweep);
        var iy2 = cy + innerR * Math.sin(angle + sweep);
        d = 'M' + ix1 + ',' + iy1 +
            ' L' + x1 + ',' + y1 +
            ' A' + outerR + ',' + outerR + ' 0 ' + large + ' 1 ' + x2 + ',' + y2 +
            ' L' + ix2 + ',' + iy2 +
            ' A' + innerR + ',' + innerR + ' 0 ' + large + ' 0 ' + ix1 + ',' + iy1 + ' Z';
      } else {
        d = 'M' + cx + ',' + cy +
            ' L' + x1 + ',' + y1 +
            ' A' + outerR + ',' + outerR + ' 0 ' + large + ' 1 ' + x2 + ',' + y2 + ' Z';
      }

      var path = svgEl('path', {
        d: d,
        fill: getColor(i),
        style: 'transition:opacity 150ms;cursor:pointer',
        'data-index': i
      });
      path.addEventListener('mouseenter', function (e) {
        path.style.opacity = '0.8';
        showTooltip(el, e, buildPieTooltipHtml(item.label, item.value, total));
        el.dispatchEvent(new CustomEvent('sc:hover', {
          detail: { index: i, label: item.label, value: item.value, percent: Math.round(item.value / total * 100) },
          bubbles: true
        }));
      });
      path.addEventListener('mousemove', function (e) { showTooltip(el, e, buildPieTooltipHtml(item.label, item.value, total)); });
      path.addEventListener('mouseleave', function () { path.style.opacity = '1'; hideTooltip(el); });
      svg.appendChild(path);

      // Value labels on slices
      if (showValues) {
        var midAngle = angle + sweep / 2;
        var labelR = innerR > 0 ? (outerR + innerR) / 2 : outerR * 0.65;
        var lx = cx + labelR * Math.cos(midAngle);
        var ly = cy + labelR * Math.sin(midAngle);
        svg.appendChild(svgEl('text', {
          x: lx, y: ly + 4,
          'text-anchor': 'middle',
          'font-size': '11',
          'font-weight': '600',
          fill: '#fff'
        }, Math.round(item.value / total * 100) + '%'));
      }

      angle += sweep;
    });

    // Center label for donut
    if (opts.type === 'donut') {
      svg.appendChild(svgEl('text', {
        x: cx, y: cy - 4,
        'text-anchor': 'middle',
        'font-size': '22',
        'font-weight': '600',
        fill: 'var(--foreground)'
      }, String(total)));
      svg.appendChild(svgEl('text', {
        x: cx, y: cy + 16,
        'text-anchor': 'middle',
        'font-size': '12',
        fill: 'var(--muted-foreground)'
      }, 'Total'));
    }

    el.appendChild(svg);

    // Legend
    if (showLegend) {
      var legend = document.createElement('div');
      legend.setAttribute('data-slot', 'chart-legend');
      legend.style.cssText = 'display:flex;flex-wrap:wrap;justify-content:center;gap:12px;padding:8px 0;font-size:12px;';
      items.forEach(function (item, i) {
        var row = document.createElement('div');
        row.style.cssText = 'display:flex;align-items:center;gap:6px;';
        var swatch = document.createElement('div');
        swatch.style.cssText = 'width:10px;height:10px;border-radius:2px;background:' + getColor(i) + ';';
        row.appendChild(swatch);
        var lbl = document.createElement('span');
        lbl.style.color = 'var(--muted-foreground)';
        lbl.textContent = item.label + ' (' + item.value + ')';
        row.appendChild(lbl);
        legend.appendChild(row);
      });
      el.appendChild(legend);
    }
  }

  function emitHover(el, index, label, datasets) {
    var values = {};
    datasets.forEach(function (ds) {
      values[ds.label || 'value'] = ds.values[index];
    });
    el.dispatchEvent(new CustomEvent('sc:hover', {
      detail: { index: index, label: label, values: values },
      bubbles: true
    }));
  }

  // ── Registration ──────────────────────────────────────────────

  Scooter.register('chart', function (el) {
    var type = el.getAttribute('data-type') || 'bar';
    var height = parseInt(el.getAttribute('data-height') || '300', 10);
    var showGrid = el.getAttribute('data-show-grid') !== 'false';
    var showLegend = el.getAttribute('data-show-legend') !== 'false';
    var showValues = el.getAttribute('data-show-values') === 'true';
    var stacked = el.getAttribute('data-stacked') === 'true';

    // Parse data from embedded JSON
    var script = el.querySelector('script[type="application/json"]');
    var data = { labels: [], datasets: [] };
    if (script) {
      try { data = JSON.parse(script.textContent); } catch (e) { /* ignore */ }
      script.style.display = 'none';
    }

    var opts = { type: type, height: height, showGrid: showGrid, showLegend: showLegend, showValues: showValues, stacked: stacked };

    function render() {
      // Clear previous render (keep the script tag and tooltip)
      Array.from(el.children).forEach(function (child) {
        if (child !== script && child.getAttribute('data-slot') !== 'chart-tooltip') el.removeChild(child);
      });
      if (type === 'pie' || type === 'donut') {
        renderPie(el, data, opts);
      } else {
        renderCartesian(el, data, opts);
      }
    }

    render();

    // Re-render on resize
    var resizeTimer;
    var observer = new ResizeObserver(function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(render, 150);
    });
    observer.observe(el);

    el._chart = {
      setData: function (newData) {
        data = newData;
        render();
      },
      getData: function () { return data; },
      render: render,
      destroy: function () {
        observer.disconnect();
      }
    };
  });
})();
