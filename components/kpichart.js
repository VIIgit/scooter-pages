/**
 * KPI Chart - Animated Ring Chart
 * Creates animated concentric rings to display KPI data
 */
(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.KPIChart = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const svgNS = "http://www.w3.org/2000/svg";

  // Use the same colour tokens as chart.js (--chart-1 … --chart-5)
  var CHART_COLORS = [
    'var(--chart-1)',
    'var(--chart-2)',
    'var(--chart-3)',
    'var(--chart-4)',
    'var(--chart-5)'
  ];

  function resolveColor(cssVar) {
    var temp = document.createElement('div');
    temp.style.color = cssVar;
    temp.style.display = 'none';
    document.body.appendChild(temp);
    var color = getComputedStyle(temp).color;
    document.body.removeChild(temp);
    return color;
  }

  function getColor(i) {
    return CHART_COLORS[i % CHART_COLORS.length];
  }

  // ============================================================================
  // HELPER FUNCTIONS
  // ============================================================================

  function toRad(deg) {
    return (Math.PI / 180) * deg;
  }

  function polarToCartesian(cx, cy, r, angleDeg) {
    const angleRad = toRad(angleDeg);
    return {
      x: cx + r * Math.cos(angleRad),
      y: cy + r * Math.sin(angleRad)
    };
  }

  function describeArc(cx, cy, r, startDeg, endDeg) {
    if (endDeg <= startDeg) return "";
    const start = polarToCartesian(cx, cy, r, endDeg);
    const end = polarToCartesian(cx, cy, r, startDeg);
    const largeArcFlag = endDeg - startDeg > 180 ? 1 : 0;
    return ["M", start.x, start.y, "A", r, r, 0, largeArcFlag, 0, end.x, end.y].join(" ");
  }

  function createTooltipGroup() {
    // Create a DOM tooltip element styled similar to the chart.js tooltip
    // Returns the tooltip element which will be positioned relative to the container
    return function ensureTooltipDom(container) {
      let tip = container.querySelector('[data-slot="chart-tooltip"]');
      if (!tip) {
        tip = document.createElement('div');
        tip.setAttribute('data-slot', 'chart-tooltip');
        tip.style.cssText =
          'position:absolute;pointer-events:none;z-index:50;opacity:0;transition:opacity 120ms;' +
          'background:var(--popover, var(--background));color:var(--popover-foreground, var(--foreground));' +
          'border:1px solid var(--border);border-radius:6px;padding:8px 12px;font-size:12px;' +
          'box-shadow:0 2px 8px rgba(0,0,0,.12);white-space:nowrap;';
        container.style.position = container.style.position || 'relative';
        container.appendChild(tip);
      }
      return tip;
    };
  }

  // ============================================================================
  // PROGRESS RINGS (Single value per ring with percentage)
  // ============================================================================

  /**
   * Create progress ring chart (single value per ring)
   * @param {string} containerId - ID of the container element
   * @param {Object} options - Chart configuration
   * @param {Array} options.rings - Array of ring objects
   * @param {string} options.rings[].label - Ring label
   * @param {number} options.rings[].value - Value (0-100 percentage)
   * @param {string} options.rings[].color - Ring color
   * @param {number} options.duration - Animation duration in ms (default: 1000)
   * @param {Function} options.onRingClick - Click handler for rings
   */
  function createProgressRings(containerId, options) {
    const {
      rings,
      duration = 1000,
      onRingClick
    } = options;

    const container = document.getElementById(containerId);
    const size = container.offsetWidth;
    const cx = size / 2;
    const cy = size / 2;
    const ringThickness = size * 0.06;
    const ringGap = ringThickness * 0.5;
    const maxSweep = 270; // 3/4 of 360 degrees (12 o'clock to 9 o'clock)
    const startAngle = -90; // 12 o'clock

    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("width", "100%");
    svg.setAttribute("height", size);
    svg.setAttribute("viewBox", `0 0 ${size} ${size}`);
    container.innerHTML = "";
    container.appendChild(svg);

    // Tooltip (DOM, harmonized with chart.js styles)
    const ensureTooltipDom = createTooltipGroup();
    const tooltipEl = ensureTooltipDom(container);

    rings.forEach((ring, ringIndex) => {
      const radius = size * 0.18 + ringIndex * (ringThickness + ringGap);
      const color = ring.color || resolveColor(getColor(ringIndex));
      const value = Math.min(100, Math.max(0, ring.value)); // Clamp 0-100
      const valueSweep = (value / 100) * maxSweep;

      // Background arc (semi-transparent, full 270 degrees)
      const bgPath = document.createElementNS(svgNS, "path");
      bgPath.setAttribute("d", describeArc(cx, cy, radius, startAngle, startAngle + maxSweep));
      bgPath.setAttribute("stroke", color);
      bgPath.setAttribute("stroke-opacity", "0.2");
      bgPath.setAttribute("stroke-width", ringThickness);
      bgPath.setAttribute("fill", "none");
      bgPath.setAttribute("stroke-linecap", "round");
      bgPath.setAttribute("class", "kpichart-progress-bg");
      svg.appendChild(bgPath);

      // Foreground arc (solid color, animated)
      const fgPath = document.createElementNS(svgNS, "path");
      fgPath.setAttribute("stroke", color);
      fgPath.setAttribute("stroke-width", ringThickness);
      fgPath.setAttribute("fill", "none");
      fgPath.setAttribute("stroke-linecap", "round");
      fgPath.setAttribute("class", "kpichart-progress-fg kpichart-segment");
      svg.appendChild(fgPath);

      // Tooltip handlers
      const showTooltip = (e) => {
        const rect = container.getBoundingClientRect();
        tooltipEl.innerHTML =
          '<div style="display:flex;align-items:center;gap:6px">' +
          '<span style="width:8px;height:8px;border-radius:2px;background:' + color + ';display:inline-block"></span>' +
          '<span style="color:var(--muted-foreground)">' + ring.label + ':</span> ' +
          '<span style="font-weight:600">' + ring.value + '%</span>' +
          '</div>';
        tooltipEl.style.opacity = '1';
        let x = e.clientX - rect.left + 12;
        let y = e.clientY - rect.top - 8;
        if (x + tooltipEl.offsetWidth > container.clientWidth) x = x - tooltipEl.offsetWidth - 24;
        if (y + tooltipEl.offsetHeight > container.clientHeight) y = Math.max(0, y - tooltipEl.offsetHeight);
        tooltipEl.style.left = x + 'px';
        tooltipEl.style.top = y + 'px';
      };

      const hideTooltip = () => {
        tooltipEl.style.opacity = '0';
      };

      [bgPath, fgPath].forEach(path => {
        path.addEventListener("mousemove", showTooltip);
        path.addEventListener("mouseleave", hideTooltip);
        path.addEventListener("click", () => {
          if (onRingClick) onRingClick(ring.label, ring.value);
        });
      });

      // Animate the foreground arc
      const startTime = performance.now();
      function animate() {
        const progress = Math.min((performance.now() - startTime) / duration, 1);
        const currentSweep = valueSweep * progress;

        if (currentSweep > 0) {
          fgPath.setAttribute("d", describeArc(cx, cy, radius, startAngle, startAngle + currentSweep));
        }

        if (progress < 1) {
          requestAnimationFrame(animate);
        }
      }
      animate();

      // Label at 12 o'clock position
      const lx = cx + Math.cos(toRad(startAngle)) * (radius - ringThickness / 2) - ringGap * 2;
      const ly = cy + Math.sin(toRad(startAngle)) * (radius - ringThickness / 2) - ringThickness / 2;

      const text = document.createElementNS(svgNS, "text");
      text.setAttribute("x", lx);
      text.setAttribute("y", ly);
      text.setAttribute("font-size", "12");
      text.setAttribute("text-anchor", "end");
      text.setAttribute("dominant-baseline", "middle");
      text.setAttribute("class", "kpichart-label");
      text.textContent = `${ring.label} (${ring.value}%)`;
      svg.appendChild(text);
    });

    // tooltipEl is appended to container via ensureTooltipDom
  }

  // ============================================================================
  // MULTI-SERIES RINGS (Multiple values per ring)
  // ============================================================================

  /**
   * Create animated ring chart
   * @param {string} containerId - ID of the container element
   * @param {Object} options - Chart configuration
   * @param {Object} options.xAxis - X-axis configuration
   * @param {Array} options.xAxis.categories - Category labels for each ring
   * @param {Array} options.series - Array of series objects
   * @param {string} options.series[].name - Series name
   * @param {Array} options.series[].data - Data values
   * @param {string} options.series[].color - Series color
   * @param {Function} options.onSegmentClick - Click handler for segments
   */
  function createAnimatedRings(containerId, options) {
    const {
      xAxis: { categories },
      series,
      onSegmentClick
    } = options;

    const container = document.getElementById(containerId);
    const size = container.offsetWidth;
    const cx = size / 2;
    const cy = size / 2;
    const ringThickness = size * 0.05;
    const ringGap = ringThickness * 0.4;
    const maxSweep = 270;
    const startAngle = -90;
    const duration = 1000;

    const totals = categories.map((_, i) =>
      series.reduce((sum, s) => sum + s.data[i], 0)
    );
    const maxTotal = Math.max(...totals);

    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("width", "100%");
    svg.setAttribute("height", size);
    svg.setAttribute("viewBox", `0 0 ${size} ${size}`);
    svg.style.position = "relative";
    container.innerHTML = "";
    container.appendChild(svg);

    // Tooltip (DOM, harmonized with chart.js styles)
    const ensureTooltipDom = createTooltipGroup();
    const tooltipEl = ensureTooltipDom(container);

    categories.forEach((category, ringIndex) => {
      const total = totals[ringIndex];
      const ringSweep = (total / maxTotal) * maxSweep;
      const radius = size * 0.15 + ringIndex * (ringThickness + ringGap);
      const strokeWidth = ringThickness;

      const paths = [];

      series.forEach((s, seriesIndex) => {
        const seriesColor = s.color || resolveColor(getColor(seriesIndex));
        const path = document.createElementNS(svgNS, "path");
        path.setAttribute("stroke", seriesColor);
        path.setAttribute("stroke-width", strokeWidth);
        path.setAttribute("fill", "none");
        path.setAttribute("stroke-linecap", "round");
        path.setAttribute("class", "kpichart-segment");

        // Tooltip handlers
        path.addEventListener("mousemove", (e) => {
          const rect = container.getBoundingClientRect();
          const value = s.data[ringIndex];
          const pct = Math.round(value / total * 100);
          tooltipEl.innerHTML =
            '<div style="font-weight:600;margin-bottom:4px">' + category + '</div>' +
            '<div style="display:flex;align-items:center;gap:6px;margin-top:2px">' +
            '<span style="width:8px;height:8px;border-radius:2px;background:' + seriesColor + ';display:inline-block"></span>' +
            '<span style="color:var(--muted-foreground)">' + s.name + ':</span> ' +
            '<span style="font-weight:600">' + value.toLocaleString() + '</span>' +
            ' <span style="color:var(--muted-foreground)">(' + pct + '%)</span>' +
            '</div>';
          tooltipEl.style.opacity = '1';
          let x = e.clientX - rect.left + 12;
          let y = e.clientY - rect.top - 8;
          if (x + tooltipEl.offsetWidth > container.clientWidth) x = x - tooltipEl.offsetWidth - 24;
          if (y + tooltipEl.offsetHeight > container.clientHeight) y = Math.max(0, y - tooltipEl.offsetHeight);
          tooltipEl.style.left = x + 'px';
          tooltipEl.style.top = y + 'px';
        });

        path.addEventListener("mouseleave", () => {
          tooltipEl.style.opacity = '0';
        });

        // Click handler
        path.addEventListener("click", () => {
          if (onSegmentClick) {
            onSegmentClick(`${s.name.toLowerCase()} ${category}`);
          }
        });

        svg.appendChild(path);
        paths.push(path);
      });

      const startTime = performance.now();

      function animate() {
        const now = performance.now();
        const progress = Math.min((now - startTime) / duration, 1);

        let accAngle = 0;
        series.forEach((s, i) => {
          const val = s.data[ringIndex];
          const sweepFull = (val / total) * ringSweep;
          const currentSweep = sweepFull * progress;

          const startA = startAngle + accAngle;
          const endA = startA + currentSweep;

          const d = describeArc(cx, cy, radius, startA, endA);
          paths[i].setAttribute("d", d);

          accAngle += currentSweep;
        });

        if (progress < 1) {
          requestAnimationFrame(animate);
        }
      }
      animate();

      // Label at 12 o'clock
      const lx =
        cx +
        Math.cos(toRad(startAngle)) * (radius - strokeWidth / 2) -
        ringGap * 2;
      const ly =
        cy +
        Math.sin(toRad(startAngle)) * (radius - strokeWidth / 2) -
        ringThickness / 2;

      const text = document.createElementNS(svgNS, "text");
      text.setAttribute("x", lx);
      text.setAttribute("y", ly);
      text.setAttribute("font-size", "12");
      text.setAttribute("text-anchor", "end");
      text.setAttribute("dominant-baseline", "middle");
      text.setAttribute("class", "kpichart-label");
      text.textContent = category;
      svg.appendChild(text);
    });
  }

  // ============================================================================
  // PUBLIC API
  // ============================================================================

  return {
    createChart: createAnimatedRings,
    createProgressChart: createProgressRings
  };
}));
