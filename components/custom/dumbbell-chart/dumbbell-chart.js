/**
 * DumbbellChart — Weekly Movers Component
 * Vanilla JS, no external dependencies.
 * Renders horizontal dumbbell (connected dot) charts for comparing
 * week-over-week user traffic with configurable scoring and ranking.
 */

(function(root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.DumbbellChart = factory();
  }
}(typeof self !== 'undefined' ? self : this, function() {
  'use strict';

  // ──────────────────────────────────────────────────────────────────────────
  // DEFAULT CONFIG
  // ──────────────────────────────────────────────────────────────────────────

  var DEFAULT_CONFIG = {
    minCalls:   1000,   // users where max(w0,w1,w2) < minCalls are excluded
    smooth:     100,    // additive smoothing constant for log ratios
    winsorLow:  5,      // lower percentile clip
    winsorHigh: 95,     // upper percentile clip
    weights: {
      absolute: 0.70,
      ratio:    0.25,
      trend:    0.05
    },
    reliability: {
      enabled:     true,
      baselineRef: 10000   // B — users with w1 >> B get full weight
    },
    logScale: false,    // render x-axis in log10 space
    topN:     10        // how many to show per direction
  };

  // ──────────────────────────────────────────────────────────────────────────
  // MATH HELPERS
  // ──────────────────────────────────────────────────────────────────────────

  function mergeConfig(defaults, overrides) {
    var result = {};
    for (var k in defaults) {
      if (Object.prototype.hasOwnProperty.call(defaults, k)) {
        result[k] = defaults[k];
      }
    }
    if (!overrides) return result;
    for (var k2 in overrides) {
      if (!Object.prototype.hasOwnProperty.call(overrides, k2)) continue;
      if (k2 === 'weights' || k2 === 'reliability') {
        result[k2] = {};
        var src = defaults[k2] || {};
        var ovr = overrides[k2] || {};
        for (var j in src) {
          if (Object.prototype.hasOwnProperty.call(src, j)) result[k2][j] = src[j];
        }
        for (var j2 in ovr) {
          if (Object.prototype.hasOwnProperty.call(ovr, j2)) result[k2][j2] = ovr[j2];
        }
      } else {
        result[k2] = overrides[k2];
      }
    }
    return result;
  }

  function percentile(sorted, p) {
    if (sorted.length === 0) return 0;
    var idx = (p / 100) * (sorted.length - 1);
    var lo  = Math.floor(idx);
    var hi  = Math.ceil(idx);
    if (lo === hi) return sorted[lo];
    return sorted[lo] + (idx - lo) * (sorted[hi] - sorted[lo]);
  }

  function median(values) {
    if (values.length === 0) return 0;
    var sorted = values.slice().sort(function(a, b) { return a - b; });
    var mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0
      ? (sorted[mid - 1] + sorted[mid]) / 2
      : sorted[mid];
  }

  function mad(values, med) {
    var deviations = values.map(function(v) { return Math.abs(v - med); });
    return median(deviations);
  }

  /**
   * Robust z-score: winsorise → (x - median) / (1.4826 * MAD + ε)
   */
  function robustZScores(values, winsorLow, winsorHigh) {
    if (values.length === 0) return [];
    var sorted = values.slice().sort(function(a, b) { return a - b; });
    var pLow  = percentile(sorted, winsorLow);
    var pHigh = percentile(sorted, winsorHigh);

    var clipped = values.map(function(v) {
      return Math.max(pLow, Math.min(pHigh, v));
    });

    var med  = median(clipped);
    var madV = mad(clipped, med);
    var denom = 1.4826 * madV + 1e-9;

    return clipped.map(function(v) { return (v - med) / denom; });
  }

  function log10Safe(x) {
    return x > 0 ? Math.log(x) / Math.LN10 : 0;
  }

  function formatNum(n) {
    if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(1) + 'M';
    if (Math.abs(n) >= 1e3) return (n / 1e3).toFixed(1) + 'K';
    return String(Math.round(n));
  }

  function formatPct(n) {
    var sign = n > 0 ? '+' : '';
    return sign + n.toFixed(1) + '%';
  }

  function formatScore(n) {
    var sign = n > 0 ? '+' : '';
    return sign + n.toFixed(3);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // SAMPLE DATA GENERATOR
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Generate ~100 synthetic user records with mixed traffic scales.
   * Returns an array of { userId, name, w2, w1, w0 }.
   */
  function generateSampleData() {
    var users = [];
    var id    = 1;

    // Seeded-ish RNG so data is stable on each load
    var seed = 42;
    function rng() {
      seed = (seed * 1664525 + 1013904223) & 0xffffffff;
      return (seed >>> 0) / 4294967296;
    }
    function randInt(lo, hi) { return Math.floor(lo + rng() * (hi - lo + 1)); }
    function randFloat(lo, hi) { return lo + rng() * (hi - lo); }
    function jitter(base, pct) {
      return Math.round(base * (1 + randFloat(-pct, pct)));
    }

    var firstNames = ['Alice','Bob','Carol','Dave','Eve','Frank','Grace','Heidi',
                      'Ivan','Judy','Karl','Laura','Mallory','Niaj','Olivia','Peggy',
                      'Quentin','Rupert','Sybil','Trent','Uma','Victor','Walter',
                      'Xander','Yvonne','Zara'];
    var lastNames  = ['Smith','Jones','Williams','Brown','Davis','Miller','Wilson',
                      'Moore','Taylor','Anderson','Jackson','White','Harris','Martin',
                      'Thompson','Garcia','Martinez','Robinson','Clark','Rodriguez'];

    var usedNames = {};
    function uniqueName() {
      var attempts = 0;
      while (attempts++ < 50) {
        var n = firstNames[Math.floor(rng() * firstNames.length)] + ' ' +
                lastNames[Math.floor(rng()  * lastNames.length)];
        if (!usedNames[n]) { usedNames[n] = true; return n; }
      }
      return 'User ' + id;
    }

    function push(w2, w1, w0) {
      users.push({ userId: 'u' + String(id).padStart(3, '0'), name: uniqueName(), w2: w2, w1: w1, w0: w0 });
      id++;
    }

    // ── 12 very large users (5M–15M), mild changes ──────────────────────────
    var largeBases = [12400000,9800000,8200000,14100000,6500000,11000000,
                      7300000,9100000,5200000,13500000,10600000,6900000];
    largeBases.forEach(function(base) {
      var w1 = jitter(base, 0.04);
      var w2 = jitter(base, 0.06);
      var w0 = jitter(base, 0.05);
      push(w2, w1, w0);
    });

    // ── 25 medium users (50K–500K), varied changes ──────────────────────────
    var mediumBases = [480000,320000,195000,88000,270000,410000,145000,
                       62000,360000,225000,95000,172000,440000,310000,
                       130000,75000,290000,210000,165000,390000,
                       55000,245000,335000,185000,120000];
    var mediumMods  = [0.15,0.30,-0.20,0.50,-0.35,0.10,0.70,-0.15,
                       0.25,-0.40,0.45,0.80,-0.25,0.12,-0.18,
                       0.60,0.35,-0.30,0.22,0.90,
                       -0.12,0.55,-0.45,0.40,0.28];
    mediumBases.forEach(function(base, i) {
      var mod = mediumMods[i] || 0;
      var w1  = jitter(base, 0.05);
      var w2  = jitter(base, 0.08);
      var w0  = Math.round(w1 * (1 + mod) * (0.95 + rng() * 0.10));
      push(w2, w1, Math.max(0, w0));
    });

    // ── 30 small users (1K–30K), some explosive growth ──────────────────────
    var smallBases = [28000,15000,8500,22000,5000,19000,12000,3500,
                      26000,9000,4200,17000,11000,6800,24000,
                      2100,14000,7600,20000,3000,
                      16500,9800,5500,13000,2800,
                      21000,4600,18000,8200,1400];
    var smallMods  = [0.20,2.50,-0.30,0.80,-0.50,0.15,1.80,-0.25,
                      0.40,-0.60,3.20,0.65,-0.35,0.90,0.30,
                      0.70,-0.45,1.50,0.25,-0.55,
                      0.38,2.10,-0.42,0.55,-0.20,
                      0.90,-0.38,0.45,1.20,-0.60];
    smallBases.forEach(function(base, i) {
      var mod = smallMods[i] || 0;
      var w1  = jitter(base, 0.08);
      var w2  = jitter(base, 0.12);
      var w0  = Math.round(w1 * (1 + mod) * (0.92 + rng() * 0.16));
      push(w2, w1, Math.max(0, w0));
    });

    // ── Special: one user jumps from ~3K to ~100K ───────────────────────────
    push(2800, 3100, 98500);

    // ── 12 noise users below 1000 calls ─────────────────────────────────────
    for (var n = 0; n < 12; n++) {
      push(randInt(10, 800), randInt(10, 900), randInt(10, 950));
    }

    return users;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // SCORING ENGINE
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Compute scores for each user.
   * @param {Array}  data   - Array of { userId, name, w2, w1, w0 }
   * @param {Object} config - Merged config (use mergeConfig first)
   * @returns {Array} Enriched records with explain fields, filtered flag, and finalScore.
   */
  function computeScores(data, config) {
    var cfg = mergeConfig(DEFAULT_CONFIG, config);
    var s   = cfg.smooth;
    var wL  = cfg.winsorLow;
    var wH  = cfg.winsorHigh;
    var B   = cfg.reliability.baselineRef;

    // Tag and filter
    var records = data.map(function(u) {
      var maxCalls  = Math.max(u.w0, u.w1, u.w2);
      var filtered  = maxCalls < cfg.minCalls;
      var absD      = u.w0 - u.w1;
      var pctChange = ((u.w0 - u.w1) / (u.w1 + s)) * 100;
      var ratioSig  = log10Safe((u.w0 + s) / (u.w1 + s));
      var trendSig  = log10Safe((u.w0 + s) / (u.w2 + s));
      return {
        userId:      u.userId,
        name:        u.name,
        w2:          u.w2,
        w1:          u.w1,
        w0:          u.w0,
        filtered:    filtered,
        absoluteDelta: absD,
        pctChange:   pctChange,
        ratioSignal: ratioSig,
        trendSignal: trendSig,
        // filled in below
        zAbsolute:   0,
        zRatio:      0,
        zTrend:      0,
        rawScore:    0,
        reliabilityQ: 1,
        finalScore:  0,
        direction:   absD >= 0 ? 'increase' : 'decrease'
      };
    });

    // Compute robust z-scores only on un-filtered records
    var active = records.filter(function(r) { return !r.filtered; });

    if (active.length === 0) return records;

    var absVals   = active.map(function(r) { return r.absoluteDelta; });
    var ratioVals = active.map(function(r) { return r.ratioSignal;   });
    var trendVals = active.map(function(r) { return r.trendSignal;   });

    var zAbs   = robustZScores(absVals,   wL, wH);
    var zRatio = robustZScores(ratioVals, wL, wH);
    var zTrend = robustZScores(trendVals, wL, wH);

    var wA = cfg.weights.absolute;
    var wR = cfg.weights.ratio;
    var wT = cfg.weights.trend;

    active.forEach(function(r, i) {
      r.zAbsolute = zAbs[i];
      r.zRatio    = zRatio[i];
      r.zTrend    = zTrend[i];
      r.rawScore  = wA * zAbs[i] + wR * zRatio[i] + wT * zTrend[i];

      if (cfg.reliability.enabled) {
        r.reliabilityQ = Math.min(1, log10Safe(r.w1 + 1) / (log10Safe(B + 1) || 1));
      } else {
        r.reliabilityQ = 1;
      }
      r.finalScore = r.rawScore * r.reliabilityQ;
    });

    return records;
  }

  /**
   * Split scored records into top increases and top decreases.
   * @param {Array}  scored - output of computeScores
   * @param {number} n      - how many per direction
   * @returns {{ increases: Array, decreases: Array }}
   */
  function getTopMovers(scored, n) {
    var active = scored.filter(function(r) { return !r.filtered; });

    var byScore = active.slice().sort(function(a, b) { return b.finalScore - a.finalScore; });

    var increases = byScore.filter(function(r) { return r.direction === 'increase'; }).slice(0, n);
    var decreases = byScore.filter(function(r) { return r.direction === 'decrease'; })
                           .sort(function(a, b) { return a.finalScore - b.finalScore; })
                           .slice(0, n);

    return { increases: increases, decreases: decreases };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // SVG DUMBBELL RENDERER
  // ──────────────────────────────────────────────────────────────────────────

  var MARGIN = { top: 10, right: 80, bottom: 36, left: 140 };
  var ROW_H  = 28;

  function clampLabel(text, maxLen) {
    if (text.length <= maxLen) return text;
    return text.slice(0, maxLen - 1) + '…';
  }

  /**
   * Calculate a "nice" axis max.
   */
  function niceMax(value) {
    if (value <= 0) return 1;
    var mag  = Math.pow(10, Math.floor(Math.log(value) / Math.LN10));
    var norm = value / mag;
    var nice = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10;
    return nice * mag;
  }

  /**
   * Generate tick values for a linear axis.
   */
  function linearTicks(minVal, maxVal, count) {
    var range = maxVal - minVal;
    var step  = niceMax(range / count);
    var ticks = [];
    var start = Math.ceil(minVal / step) * step;
    for (var v = start; v <= maxVal + step * 0.01; v += step) {
      ticks.push(v);
      if (ticks.length > count + 2) break;
    }
    return ticks;
  }

  /**
   * Generate tick values for a log10 axis.
   */
  function logTicks(minVal, maxVal) {
    var ticks = [];
    var lo    = Math.max(1, minVal);
    var loExp = Math.floor(log10Safe(lo));
    var hiExp = Math.ceil(log10Safe(maxVal));
    for (var e = loExp; e <= hiExp; e++) {
      ticks.push(Math.pow(10, e));
    }
    return ticks;
  }

  /**
   * Escape text for safe SVG embedding.
   */
  function svgEscape(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /**
   * Build SVG markup for one dumbbell panel.
   *
   * @param {Array}   rows      - scored records to display (already sliced to topN)
   * @param {string}  direction - 'increase' | 'decrease'
   * @param {boolean} logScale  - use log10 x-axis?
   * @param {string}  title     - panel title
   * @returns {string} SVG markup
   */
  function buildDumbbellSVG(rows, direction, logScale, title, xAxisMin) {
    if (rows.length === 0) {
      return '<div class="dumbbell-empty">No data to display.</div>';
    }

    var isIncrease = direction === 'increase';
    var floorMin   = xAxisMin || 0;

    // Collect all relevant values to determine axis extent
    var allVals = [];
    rows.forEach(function(r) {
      allVals.push(r.w0, r.w1);
    });
    var rawMin = Math.min.apply(null, allVals);
    var rawMax = Math.max.apply(null, allVals);

    var innerW = 440;
    var innerH = rows.length * ROW_H;
    var svgW   = innerW + MARGIN.left + MARGIN.right;
    var svgH   = innerH + MARGIN.top  + MARGIN.bottom;

    // X scale helpers
    var xMin, xMax, xScale, xLabel;
    if (logScale) {
      xMin   = Math.max(1, floorMin > 0 ? floorMin * 0.9 : rawMin * 0.8);
      xMax   = rawMax * 1.2;
      xScale = function(v) {
        var v2 = Math.max(1, v);
        return (log10Safe(v2) - log10Safe(xMin)) / (log10Safe(xMax) - log10Safe(xMin)) * innerW;
      };
      xLabel = function(v) { return formatNum(v); };
    } else {
      xMin   = floorMin;
      xMax   = niceMax(rawMax * 1.1);
      xScale = function(v) { return ((v - xMin) / (xMax - xMin)) * innerW; };
      xLabel = function(v) { return formatNum(v); };
    }

    // Build tick list
    var ticks = logScale
      ? logTicks(xMin, xMax)
      : linearTicks(xMin, xMax, 5);

    // Colors
    var colorCurrent  = isIncrease ? '#22c55e' : '#ef4444';
    var colorPrevious = '#94a3b8';
    var colorLine     = isIncrease ? '#86efac' : '#fca5a5';

    var lines = [];

    // SVG open
    lines.push('<svg class="dumbbell-svg" viewBox="0 0 ' + svgW + ' ' + svgH + '" ' +
               'aria-label="' + svgEscape(title) + '">');

    // Title
    lines.push('<text class="dumbbell-title" x="' + (MARGIN.left) + '" y="' + (MARGIN.top + 10) + '">' +
               svgEscape(title) + '</text>');

    lines.push('<g transform="translate(' + MARGIN.left + ',' + (MARGIN.top + 20) + ')">');

    // Grid lines + x-axis ticks
    ticks.forEach(function(tv) {
      var px = xScale(tv);
      if (px < -1 || px > innerW + 1) return;
      lines.push('<line class="dumbbell-gridline" x1="' + px + '" y1="0" x2="' + px + '" y2="' + innerH + '"/>');
      lines.push('<text class="dumbbell-xlab" x="' + px + '" y="' + (innerH + 20) + '">' +
                 svgEscape(xLabel(tv)) + '</text>');
    });

    // Rows
    rows.forEach(function(r, i) {
      var cy  = i * ROW_H + ROW_H / 2;
      var x1  = xScale(r.w1);   // previous week dot
      var x0  = xScale(r.w0);   // current week dot

      // Connecting line
      lines.push('<line class="dumbbell-connector" stroke="' + svgEscape(colorLine) + '" ' +
                 'x1="' + x1 + '" y1="' + cy + '" x2="' + x0 + '" y2="' + cy + '"/>');

      // Previous week dot (grey)
      lines.push('<circle class="dumbbell-dot dumbbell-dot--prev" cx="' + x1 + '" cy="' + cy + '" r="5" fill="' + svgEscape(colorPrevious) + '"/>');

      // Current week dot (coloured)
      lines.push('<circle class="dumbbell-dot dumbbell-dot--curr" cx="' + x0 + '" cy="' + cy + '" r="7" fill="' + svgEscape(colorCurrent) + '"/>');

      // Row label (name)
      lines.push('<text class="dumbbell-rowlabel" x="-8" y="' + (cy + 4) + '">' +
                 svgEscape(clampLabel(r.name, 18)) + '</text>');

      // Delta label on the right
      var delta = r.w0 - r.w1;
      var sign  = delta >= 0 ? '+' : '';
      lines.push('<text class="dumbbell-delta ' + (isIncrease ? 'dumbbell-delta--up' : 'dumbbell-delta--down') + '" ' +
                 'x="' + (innerW + 6) + '" y="' + (cy + 4) + '">' +
                 svgEscape(sign + formatNum(delta)) + '</text>');
    });

    // X-axis baseline
    lines.push('<line class="dumbbell-axis" x1="0" y1="' + innerH + '" x2="' + innerW + '" y2="' + innerH + '"/>');

    lines.push('</g>');
    lines.push('</svg>');

    return lines.join('\n');
  }

  /**
   * Render a dumbbell chart panel into a container element.
   *
   * @param {HTMLElement} container
   * @param {Object}      options
   *   @param {Array}   options.rows       - scored records (already sliced)
   *   @param {string}  options.direction  - 'increase' | 'decrease'
   *   @param {boolean} options.logScale
   *   @param {string}  options.title
   */
  function createChart(container, options) {
    if (!container) return;
    var rows      = options.rows || [];
    var direction = options.direction || 'increase';
    var logScale  = !!options.logScale;
    var title     = options.title || (direction === 'increase' ? 'Top Increases' : 'Top Decreases');
    var xAxisMin  = options.xAxisMin || 0;

    container.innerHTML = buildDumbbellSVG(rows, direction, logScale, title, xAxisMin);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // PUBLIC API
  // ──────────────────────────────────────────────────────────────────────────

  return {
    DEFAULT_CONFIG:   DEFAULT_CONFIG,
    generateSampleData: generateSampleData,
    computeScores:    computeScores,
    getTopMovers:     getTopMovers,
    createChart:      createChart,
    formatNum:        formatNum,
    formatPct:        formatPct,
    formatScore:      formatScore
  };
}));
