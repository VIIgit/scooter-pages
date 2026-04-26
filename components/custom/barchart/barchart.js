/**
 * Barchart Library v2
 * A modern, mode-driven JavaScript library for creating interactive bar charts
 * 
 * Features:
 * - Multiple chart types with shared x-axis
 * - Horizontal scrolling with sticky y-axis
 * - ES Module / UMD compatible
 */

(function(root, factory) {
  // UMD pattern for compatibility
  if (typeof define === 'function' && define.amd) {
    // AMD
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    // CommonJS / Node
    module.exports = factory();
  } else {
    // Browser globals
    root.Barchart = factory();
  }
}(typeof self !== 'undefined' ? self : this, function() {
  'use strict';

  // ============================================================================
  // DATE UTILITIES
  // ============================================================================

  /**
   * Get ISO week number for a date
   * @param {Date} date
   * @returns {number} Week number (1-53)
   */
  function getWeek(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  }

  /**
   * Get the start of the week (Monday) for a date
   * @param {Date} date
   * @returns {Date}
   */
  function getWeekStart(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    d.setDate(diff);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  /**
   * Get the start of the month for a date
   * @param {Date} date
   * @returns {Date}
   */
  function getMonthStart(date) {
    return new Date(date.getFullYear(), date.getMonth(), 1);
  }

  /**
   * Get the start of the year for a date
   * @param {Date} date
   * @returns {Date}
   */
  function getYearStart(date) {
    return new Date(date.getFullYear(), 0, 1);
  }

  /**
   * Format date as YYYY-MM
   * @param {Date} date
   * @returns {string}
   */
  function formatMonth(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  }

  /**
   * Format date as YYYY-Www
   * @param {Date} date
   * @returns {string}
   */
  function formatWeek(date) {
    return `${date.getFullYear()}-W${String(getWeek(date)).padStart(2, '0')}`;
  }

  /**
   * Format date as YYYY
   * @param {Date} date
   * @returns {string}
   */
  function formatYear(date) {
    return `${date.getFullYear()}`;
  }

  /**
   * Get weekday name
   * @param {Date} date
   * @returns {string}
   */
  function getWeekdayName(date) {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return days[date.getDay()];
  }

  /**
   * Get month name
   * @param {Date} date
   * @returns {string}
   */
  function getMonthName(date) {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return months[date.getMonth()];
  }

  /**
   * Round a number up to a "nice" value for axis ticks
   * Nice numbers are: 1, 2, 5, 10, 20, 50, 100, 200, 500, etc.
   * @param {number} value - The value to round up
   * @returns {number} The next nice number >= value
   */
  function niceNumberCeil(value) {
    if (value <= 0) return 0;
    
    const magnitude = Math.pow(10, Math.floor(Math.log10(value)));
    const normalized = value / magnitude;
    
    // Round up to next nice number: 1, 2, 4, 5, 6, 8, or 10
    const niceNumbers = [1, 2, 4, 5, 6, 8, 10];
    let niceNormalized = 10;
    for (const n of niceNumbers) {
      if (normalized <= n) {
        niceNormalized = n;
        break;
      }
    }
    
    return niceNormalized * magnitude;
  }

  /**
   * Add thousand separators to a number string
   * @param {string} numStr - The number string to format
   * @returns {string} Number string with thousand separators
   */
  function addThousandSeparators(numStr) {
    const parts = numStr.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return parts.join('.');
  }

  /**
   * Format large numbers with K, M, B suffixes or custom format patterns
   * @param {number} value - The number to format
   * @param {string} format - Format type: 'none', 'auto', 'K', 'M', 'B', or custom pattern like '0.0 %'
   * @param {number} decimals - Number of decimal places (default: 2)
   * @param {boolean} useThousandSeparator - Whether to add thousand separators (default: true)
   * @returns {string} Formatted number string
   */
  function formatNumber(value, format = 'none', decimals = 2, useThousandSeparator = true) {
    if (value === 0) {
      // Handle custom format patterns for zero
      if (format && format.includes('%')) {
        const match = format.match(/0(\.0+)?/);
        const patternDecimals = match && match[1] ? match[1].length - 1 : 0;
        return (0).toFixed(patternDecimals) + ' %';
      }
      return '0';
    }
    
    // Check for custom format pattern (e.g., '0.0 %', '0.00 %')
    if (format && format.includes('%')) {
      // Extract decimal places from pattern (count zeros after decimal point)
      const match = format.match(/0(\.0+)?/);
      const patternDecimals = match && match[1] ? match[1].length - 1 : 0;
      const numStr = value.toFixed(patternDecimals);
      const formatted = useThousandSeparator ? addThousandSeparators(numStr) : numStr;
      return formatted + ' %';
    }
    
    if (format === 'none') {
      const rounded = String(Math.round(value));
      return useThousandSeparator ? addThousandSeparators(rounded) : rounded;
    }

    const absValue = Math.abs(value);
    const sign = value < 0 ? '-' : '';

    let suffix = '';
    let divisor = 1;

    if (format === 'auto') {
      if (absValue >= 1e9) {
        suffix = 'B';
        divisor = 1e9;
      } else if (absValue >= 1e6) {
        suffix = 'M';
        divisor = 1e6;
      } else if (absValue >= 1e3) {
        suffix = 'K';
        divisor = 1e3;
      }
    } else if (format === 'B') {
      suffix = 'B';
      divisor = 1e9;
    } else if (format === 'M') {
      suffix = 'M';
      divisor = 1e6;
    } else if (format === 'K') {
      suffix = 'K';
      divisor = 1e3;
    }

    if (divisor === 1) {
      const numStr = absValue.toFixed(decimals).replace(/\.?0+$/, '');
      return sign + (useThousandSeparator ? addThousandSeparators(numStr) : numStr);
    }

    const formatted = (absValue / divisor).toFixed(decimals);
    // Remove trailing zeros but keep at least one decimal if needed
    const cleaned = formatted.replace(/\.?0+$/, '');
    return sign + cleaned + suffix;
  }

  /**
   * Format date for tooltip display based on chart type
   * @param {string} dateStr - The date string (e.g., "2025-02-01", "2025-W05", "2025")
   * @param {string} chartType - The chart type (byMonth, byWeek, byYear, byDay, byWeekday)
   * @returns {string} Formatted date string for tooltip display
   */
  function formatTooltipDate(dateStr, chartType) {
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    
    if (chartType === 'byMonth') {
      // Convert "2025-02" or "2025-02-01" to "2025 Feb"
      const parts = dateStr.split('-');
      if (parts.length >= 2) {
        const year = parts[0];
        const month = parseInt(parts[1]) - 1;
        return `${year} ${monthNames[month]}`;
      }
    } else if (chartType === 'byWeek') {
      // Convert "2025-W05" to "2025 W05"
      return dateStr.replace('-W', ' W');
    } else if (chartType === 'byWeekday') {
      // Convert "0" to "Sun", etc.
      const dayIndex = parseInt(dateStr);
      if (!isNaN(dayIndex) && dayIndex >= 0 && dayIndex <= 6) {
        return days[dayIndex];
      }
    } else if (chartType === 'byDay') {
      // Keep full date "2025-02-15" but format nicely
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        const year = parts[0];
        const month = parseInt(parts[1]) - 1;
        const day = parseInt(parts[2]);
        return `${day} ${monthNames[month]} ${year}`;
      }
    }
    // Default: return as-is (byYear or unknown)
    return dateStr;
  }

  // ============================================================================
  // DATA AGGREGATION
  // ============================================================================

  /**
   * Aggregates plain data by the given mode ('byMonth', 'byWeek', etc.)
   * @param {Array} data - Array of {date, value}
   * @param {string} mode - One of 'byMonth', 'byWeek', 'byYear', 'byWeekday', 'byDay'
   * @returns {Array} Array of {date, value, highValue, lowValue, count}
   */
  function aggregates(data, mode) {
    if (!data || data.length === 0) return [];

    // Normalize data
    const normalized = data.map(d => ({
      date: d.date instanceof Date ? d.date : new Date(d.date),
      value: Number(d.value),
      highValue: d.highValue !== undefined ? Number(d.highValue) : undefined,
      lowValue: d.lowValue !== undefined ? Number(d.lowValue) : undefined
    })).filter(d => !isNaN(d.date.getTime()) && !isNaN(d.value));

    // Group key function based on mode
    const getGroupKey = (date) => {
      switch (mode) {
        case 'byDay':
          return date.toISOString().split('T')[0];
        case 'byWeek':
          return formatWeek(date);
        case 'byMonth':
          return formatMonth(date);
        case 'byYear':
          return formatYear(date);
        case 'byWeekday':
          return String(date.getDay());
        default:
          return formatMonth(date);
      }
    };

    // Group data
    const groups = new Map();
    normalized.forEach(d => {
      const key = getGroupKey(d.date);
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key).push(d);
    });

    // Aggregate each group
    const result = [];
    groups.forEach((values, key) => {
      const allValues = values.map(v => v.value);
      const highValue = Math.max(...allValues);
      const lowValue = Math.min(...allValues);
      const avgValue = allValues.reduce((a, b) => a + b, 0) / allValues.length;

      result.push({
        date: key,
        value: Math.round(avgValue * 100) / 100,
        highValue: highValue,
        lowValue: lowValue,
        count: values.length
      });
    });

    // Sort by date key
    result.sort((a, b) => a.date.localeCompare(b.date));

    return result;
  }

  // ============================================================================
  // SVG HELPER
  // ============================================================================

  const svgNS = 'http://www.w3.org/2000/svg';

  function createSVGElement(tag, attrs = {}) {
    const el = document.createElementNS(svgNS, tag);
    for (const [key, val] of Object.entries(attrs)) {
      el.setAttribute(key, val);
    }
    return el;
  }

  // ============================================================================
  // TOOLTIP POSITIONING
  // ============================================================================

  /**
   * Position tooltip next to mouse cursor, keeping it within viewport
   * @param {HTMLElement} tooltip - The tooltip element
   * @param {MouseEvent} e - The mouse event
   */
  function positionTooltip(tooltip, e) {
    const offset = 12;
    const padding = 10;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    // Get tooltip dimensions (make visible briefly to measure if needed)
    const tooltipRect = tooltip.getBoundingClientRect();
    const tooltipWidth = tooltipRect.width || 150;
    const tooltipHeight = tooltipRect.height || 50;
    
    // Calculate position, ensuring tooltip stays within viewport
    let left = e.clientX + offset;
    let top = e.clientY - offset;
    
    // Adjust if tooltip would overflow right edge
    if (left + tooltipWidth + padding > viewportWidth) {
      left = e.clientX - tooltipWidth - offset;
    }
    
    // Adjust if tooltip would overflow bottom edge
    if (top + tooltipHeight + padding > viewportHeight) {
      top = e.clientY - tooltipHeight - offset;
    }
    
    // Ensure tooltip doesn't go off left or top edge
    left = Math.max(padding, left);
    top = Math.max(padding, top);
    
    tooltip.style.left = left + 'px';
    tooltip.style.top = top + 'px';
  }

  // ============================================================================
  // SINGLE CHART RENDERER
  // ============================================================================

  /**
   * Generate tooltip content for a data point
   * @param {Object} d - Data point
   * @param {Object} cfg - Chart configuration
   * @param {string} numberFormat - Number format
   * @param {number} numberDecimals - Decimal places
   * @param {boolean} useThousandSeparator - Use thousand separators
   * @returns {string} HTML content for tooltip
   */
  function generateTooltipContent(d, cfg, numberFormat, numberDecimals, useThousandSeparator) {
    const tableStyle = 'border-collapse:collapse;width:100%;';
    const labelStyle = 'text-align:left;padding-right:10px;';
    const valueStyle = 'text-align:right;font-weight:500;';
    
    if (cfg.tooltipFormatter && typeof cfg.tooltipFormatter === 'function') {
      return cfg.tooltipFormatter(d, cfg);
    } else if (cfg.renderType === 'high-low') {
      const formattedHigh = formatNumber(d.highValue, numberFormat, numberDecimals, useThousandSeparator);
      const formattedLow = formatNumber(d.lowValue, numberFormat, numberDecimals, useThousandSeparator);
      const formattedAvg = formatNumber(d.value, numberFormat, numberDecimals, useThousandSeparator);
      const title = cfg.title ? `<strong>${cfg.title}</strong><br>` : '';
      return `${title}<table style="${tableStyle}"><tr><td style="${labelStyle}">High:</td><td style="${valueStyle}">${formattedHigh}</td></tr><tr><td style="${labelStyle}">Low:</td><td style="${valueStyle}">${formattedLow}</td></tr><tr><td style="${labelStyle}">Avg:</td><td style="${valueStyle}">${formattedAvg}</td></tr></table>`;
    } else if (cfg.renderType === 'staggered' || cfg.renderType === 'stacked') {
      const values = d.values || [];
      const yAxisLabels = cfg.yAxisLabels || [];
      const colors = cfg.staggeredColors || ['#4a90d9', '#e74c3c', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c', '#34495e', '#e67e22'];
      const title = cfg.title ? `<strong>${cfg.title}</strong><br>` : '';
      let html = title + `<strong>${formatTooltipDate(d.date, cfg.chartType)}</strong><hr style="margin:4px 0;border:none;border-top:1px solid #ccc;"><table style="${tableStyle}">`;
      let total = 0;
      values.forEach((val, idx) => {
        const label = yAxisLabels[idx] || `Series ${idx + 1}`;
        const color = colors[idx % colors.length];
        const circle = `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${color};margin-right:5px;vertical-align:middle;"></span>`;
        if (val !== null && val !== undefined) {
          html += `<tr><td style="${labelStyle}">${circle}${label}:</td><td style="${valueStyle}">${formatNumber(val, numberFormat, numberDecimals, useThousandSeparator)}</td></tr>`;
          total += val;
        } else {
          html += `<tr><td style="${labelStyle}">${circle}${label}:</td><td style="${valueStyle}">—</td></tr>`;
        }
      });
      html += `<tr><td style="${labelStyle}"><strong>Total:</strong></td><td style="${valueStyle}"><strong>${formatNumber(total, numberFormat, numberDecimals, useThousandSeparator)}</strong></td></tr></table>`;
      return html;
    } else {
      const formattedValue = formatNumber(d.value, numberFormat, numberDecimals, useThousandSeparator);
      const title = cfg.title ? `<strong>${cfg.title}</strong><br>` : '';
      return `${title}<table style="${tableStyle}"><tr><td style="${labelStyle}">Value:</td><td style="${valueStyle}">${formattedValue}</td></tr></table>`;
    }
  }

  /**
   * Render a single chart panel (for use in multi-chart or standalone)
   * @param {Object} cfg - Chart configuration
   * @param {Array} aggregatedData - Pre-aggregated data
   * @param {number} barStep - Bar step width
   * @param {number} barWidth - Bar width
   * @param {Object} tooltip - Shared tooltip element
   * @param {boolean} multiChartMode - If true, hover is managed externally
   * @returns {Object} { yAxisSvg, chartSvg, hoverData }
   */
  function renderChartPanel(cfg, aggregatedData, barStep, barWidth, tooltip, multiChartMode = false) {
    const { innerWidth, innerHeight, margin } = cfg;
    const useLogScale = cfg.yAxisScale === 'log10';
    const numberFormat = cfg.yAxisFormat || 'none';
    const numberDecimals = cfg.yAxisDecimals !== undefined ? cfg.yAxisDecimals : 2;
    const useThousandSeparator = cfg.useThousandSeparator !== false; // default true

    // Calculate Y scale
    let minValue, maxValue;
    const startAtZero = cfg.yAxisStartAtZero !== false; // default true
    if (cfg.renderType === 'high-low') {
      minValue = Math.min(...aggregatedData.map(d => d.lowValue));
      maxValue = Math.max(...aggregatedData.map(d => d.highValue));
    } else if (cfg.renderType === 'staggered') {
      // For staggered charts, find min/max across all values arrays
      const allValues = aggregatedData.flatMap(d => (d.values || []).filter(v => v !== null && v !== undefined));
      minValue = startAtZero ? 0 : Math.min(...allValues);
      maxValue = Math.max(...allValues);
    } else if (cfg.renderType === 'stacked') {
      // For stacked charts, max is the sum of all values in each data point
      const sums = aggregatedData.map(d => (d.values || []).filter(v => v !== null && v !== undefined).reduce((a, b) => a + b, 0));
      minValue = startAtZero ? 0 : Math.min(...sums);
      maxValue = Math.max(...sums);
    } else {
      minValue = startAtZero ? 0 : Math.min(...aggregatedData.map(d => d.value));
      maxValue = Math.max(...aggregatedData.map(d => d.value));
    }

    // For log scale, ensure minValue is positive
    const tickCount = 5;
    let tickValues = [];
    
    if (useLogScale) {
      minValue = Math.max(1, minValue); // Log scale needs positive values
      // Ensure maxValue is greater than minValue
      if (maxValue <= minValue) maxValue = minValue * 10;
      
      // Generate log scale ticks at nice powers of 10
      // Find the decade range - use floor for min and ceil for max to cover full range
      const minDecade = Math.floor(Math.log10(minValue));
      const maxDecade = Math.ceil(Math.log10(maxValue));
      const decadeRange = maxDecade - minDecade;
      
      // Determine step in decades to get approximately tickCount ticks
      let decadeStep = Math.max(1, Math.ceil(decadeRange / tickCount));
      
      // Generate ticks at powers of 10 - always include min and max decades
      tickValues = [];
      for (let decade = minDecade; decade <= maxDecade; decade += decadeStep) {
        tickValues.push(Math.pow(10, decade));
      }
      
      // Ensure we include the max decade if step skipped it
      const maxDecadeValue = Math.pow(10, maxDecade);
      if (tickValues[tickValues.length - 1] < maxDecadeValue) {
        tickValues.push(maxDecadeValue);
      }
      
      // If we have too few ticks, add intermediate values (2x and 5x)
      if (tickValues.length < 3 && decadeRange >= 1) {
        const newTicks = [];
        for (let decade = minDecade; decade <= maxDecade; decade++) {
          const base = Math.pow(10, decade);
          [1, 2, 5].forEach(mult => {
            const value = base * mult;
            if (value >= Math.pow(10, minDecade) && value <= Math.pow(10, maxDecade)) {
              newTicks.push(value);
            }
          });
        }
        // Select evenly spaced ticks
        if (newTicks.length > tickCount + 1) {
          tickValues = [];
          for (let i = 0; i <= tickCount; i++) {
            const idx = Math.round(i * (newTicks.length - 1) / tickCount);
            tickValues.push(newTicks[idx]);
          }
        } else {
          tickValues = newTicks;
        }
      }
      
      // Ensure we have at least min and max decade powers
      if (tickValues.length === 0) {
        tickValues = [Math.pow(10, minDecade), Math.pow(10, maxDecade)];
      }
      
      // Update minValue/maxValue to match actual tick range (powers of 10)
      minValue = Math.min(...tickValues);
      maxValue = Math.max(...tickValues);
    } else {
      // Linear scale: calculate nice step and adjust max
      const rawRange = maxValue - minValue;
      const rawStep = rawRange / tickCount;
      const niceStep = niceNumberCeil(rawStep);
      
      // Adjust minValue down to nice number if not 0
      if (minValue !== 0) {
        minValue = Math.floor(minValue / niceStep) * niceStep;
      }
      
      // Adjust maxValue up to be minValue + (tickCount * niceStep)
      maxValue = minValue + (tickCount * niceStep);
      
      // Generate ticks using nice step
      for (let i = 0; i <= tickCount; i++) {
        tickValues.push(minValue + niceStep * i);
      }
    }

    // Y scale function (uses final minValue/maxValue)
    const yScale = (value) => {
      if (useLogScale) {
        // Log10 scale: map log(value) to pixel position
        const safeValue = Math.max(minValue, value); // Clamp to minValue
        const logMin = Math.log10(minValue);
        const logMax = Math.log10(maxValue);
        const logValue = Math.log10(safeValue);
        return innerHeight - ((logValue - logMin) / (logMax - logMin)) * innerHeight;
      } else {
        // Linear scale
        return innerHeight - ((value - minValue) / (maxValue - minValue)) * innerHeight;
      }
    };

    // Create Y-axis SVG (sticky)
    const yAxisSvg = createSVGElement('svg', {
      width: margin.left,
      height: innerHeight + margin.top + margin.bottom,
      class: 'barchart-yaxis'
    });

    const yAxisGroup = createSVGElement('g', {
      transform: `translate(${margin.left - 1}, ${margin.top})`
    });
    yAxisSvg.appendChild(yAxisGroup);

    // Y axis line
    yAxisGroup.appendChild(createSVGElement('line', {
      x1: 0, y1: 0, x2: 0, y2: innerHeight,
      class: 'axis-line'
    }));

    // Render ticks (from top to bottom, so reverse the order)
    // tickValues was already generated above
    const actualTickCount = tickValues.length - 1;
    [...tickValues].reverse().forEach((value, i) => {
      // For log scale, use yScale to get correct position; for linear, use even spacing
      const y = useLogScale ? yScale(value) : (innerHeight / actualTickCount) * i;

      yAxisGroup.appendChild(createSVGElement('line', {
        x1: -5, y1: y, x2: 0, y2: y,
        class: 'axis-tick'
      }));

      const label = createSVGElement('text', {
        x: -10, y: y + 4,
        class: 'axis-label',
        'text-anchor': 'end'
      });
      label.textContent = formatNumber(value, numberFormat, numberDecimals, useThousandSeparator);
      yAxisGroup.appendChild(label);
    });
    
    // For log scale, add minor tick marks on y-axis
    // Number of intermediates depends on position: bottom sections get more, top sections get fewer
    if (useLogScale && tickValues.length > 1) {
      // tickValues is already reversed (high to low), use original order (low to high)
      const sortedTicks = [...tickValues].sort((a, b) => a - b);
      const numIntervals = sortedTicks.length - 1;
      
      // Calculate max intermediates based on position (0 = bottom, numIntervals-1 = top)
      // Bottom gets max 4 lines, top gets 0 lines, interpolate in between
      function getMaxIntermediatesForPosition(position) {
        // position 0 = bottom (most lines), position numIntervals-1 = top (no lines)
        const ratio = position / Math.max(1, numIntervals - 1);
        return Math.round(4 * (1 - ratio)); // 4 at bottom, 0 at top
      }
      
      // For each interval between ticks, collect all possible intermediates and limit to max
      for (let i = 0; i < sortedTicks.length - 1; i++) {
        const lowerTick = sortedTicks[i];
        const upperTick = sortedTicks[i + 1];
        const maxCount = getMaxIntermediatesForPosition(i);
        
        if (maxCount === 0) continue;
        
        // Collect all possible intermediate values across all decades in this interval
        const allIntermediates = [];
        const lowerDecade = Math.floor(Math.log10(lowerTick));
        const upperDecade = Math.floor(Math.log10(upperTick));
        const multipliers = [2, 3, 4, 5, 6, 7, 8, 9];
        
        for (let decade = lowerDecade; decade <= upperDecade; decade++) {
          const baseValue = Math.pow(10, decade);
          multipliers.forEach(mult => {
            const value = baseValue * mult;
            if (value > lowerTick && value < upperTick && value > minValue && value < maxValue) {
              allIntermediates.push(value);
            }
          });
        }
        
        // Select evenly spaced values up to maxCount
        let selectedValues = allIntermediates;
        if (allIntermediates.length > maxCount) {
          selectedValues = [];
          for (let j = 0; j < maxCount; j++) {
            const idx = Math.round(j * (allIntermediates.length - 1) / (maxCount - 1));
            selectedValues.push(allIntermediates[idx]);
          }
        }
        
        // Filter out values too close to major ticks (within 5% of interval in pixels)
        const minDistance = innerHeight * 0.02; // 2% of chart height
        const majorTickYs = sortedTicks.map(t => yScale(t));
        selectedValues = selectedValues.filter(value => {
          const y = yScale(value);
          return majorTickYs.every(tickY => Math.abs(y - tickY) > minDistance);
        });
        
        // Draw the selected intermediate ticks
        selectedValues.forEach(value => {
          const y = yScale(value);
          // Shorter tick for minor values (only 3px instead of 5px)
          yAxisGroup.appendChild(createSVGElement('line', {
            x1: -3, y1: y, x2: 0, y2: y,
            class: 'axis-tick axis-tick-minor'
          }));
        });
      }
    }

    // Y axis label
    if (cfg.yAxisLabel) {
      const yLabel = createSVGElement('text', {
        transform: 'rotate(-90)',
        x: -innerHeight / 2 - margin.top,
        y: 15,
        class: 'axis-title',
        'text-anchor': 'middle'
      });
      yLabel.textContent = cfg.yAxisLabel;
      yAxisSvg.appendChild(yLabel);
    }

    // Create chart SVG (scrollable)
    // Use minimal gap (5px) between y-axis and chart area
    const chartGap = 5;
    const chartSvg = createSVGElement('svg', {
      width: innerWidth + chartGap + margin.right,
      height: innerHeight + margin.top + margin.bottom,
      class: 'barchart-chart'
    });

    const chartGroup = createSVGElement('g', {
      transform: `translate(${chartGap}, ${margin.top})`
    });
    chartSvg.appendChild(chartGroup);

    // Draw grid
    if (cfg.showGrid) {
      const gridGroup = createSVGElement('g', { class: 'grid' });
      
      // Draw main grid lines at tick positions
      tickValues.forEach((value, i) => {
        const y = useLogScale ? yScale(value) : (innerHeight / actualTickCount) * i;
        gridGroup.appendChild(createSVGElement('line', {
          x1: 0, y1: y, x2: innerWidth, y2: y,
          class: 'grid-line'
        }));
      });
      
      // For log scale, draw intermediate grid lines between major ticks
      // Number of intermediates depends on position: bottom sections get more, top sections get fewer
      if (useLogScale && tickValues.length > 1) {
        // tickValues is already reversed (high to low), use original order (low to high)
        const sortedTicks = [...tickValues].sort((a, b) => a - b);
        const numIntervals = sortedTicks.length - 1;
        
        // Calculate max intermediates based on position (0 = bottom, numIntervals-1 = top)
        // Bottom gets max 4 lines, top gets 0 lines, interpolate in between
        function getMaxIntermediatesForPosition(position) {
          // position 0 = bottom (most lines), position numIntervals-1 = top (no lines)
          const ratio = position / Math.max(1, numIntervals - 1);
          return Math.round(4 * (1 - ratio)); // 4 at bottom, 0 at top
        }
        
        // For each interval between ticks, collect all possible intermediates and limit to max
        for (let i = 0; i < sortedTicks.length - 1; i++) {
          const lowerTick = sortedTicks[i];
          const upperTick = sortedTicks[i + 1];
          const maxCount = getMaxIntermediatesForPosition(i);
          
          if (maxCount === 0) continue;
          
          // Collect all possible intermediate values across all decades in this interval
          const allIntermediates = [];
          const lowerDecade = Math.floor(Math.log10(lowerTick));
          const upperDecade = Math.floor(Math.log10(upperTick));
          const multipliers = [2, 3, 4, 5, 6, 7, 8, 9];
          
          for (let decade = lowerDecade; decade <= upperDecade; decade++) {
            const baseValue = Math.pow(10, decade);
            multipliers.forEach(mult => {
              const value = baseValue * mult;
              if (value > lowerTick && value < upperTick && value > minValue && value < maxValue) {
                allIntermediates.push(value);
              }
            });
          }
          
          // Select evenly spaced values up to maxCount
          let selectedValues = allIntermediates;
          if (allIntermediates.length > maxCount) {
            selectedValues = [];
            for (let j = 0; j < maxCount; j++) {
              const idx = Math.round(j * (allIntermediates.length - 1) / (maxCount - 1));
              selectedValues.push(allIntermediates[idx]);
            }
          }
          
          // Filter out values too close to major ticks (within 2% of chart height)
          const minDistance = innerHeight * 0.02;
          const majorTickYs = sortedTicks.map(t => yScale(t));
          selectedValues = selectedValues.filter(value => {
            const y = yScale(value);
            return majorTickYs.every(tickY => Math.abs(y - tickY) > minDistance);
          });
          
          // Draw the selected intermediate grid lines
          selectedValues.forEach(value => {
            const y = yScale(value);
            gridGroup.appendChild(createSVGElement('line', {
              x1: 0, y1: y, x2: innerWidth, y2: y,
              class: 'grid-line grid-line-minor'
            }));
          });
        }
      }
      
      chartGroup.appendChild(gridGroup);
    }

    // Draw bars
    const barsGroup = createSVGElement('g', { class: 'bars' });

    aggregatedData.forEach((d, i) => {
      const x = i * barStep + (barStep - barWidth) / 2;

      if (cfg.renderType === 'high-low') {
        const barGroup = createSVGElement('g', { class: 'high-low-bar' });

        const yHigh = yScale(d.highValue);
        const yLow = yScale(d.lowValue);
        
        // Use minimal height (2px) when high/low are equal (zero-height bar)
        const barHeight = yLow - yHigh;
        const minBarHeight = 2;
        const actualHeight = Math.max(minBarHeight, barHeight);
        const actualY = barHeight < minBarHeight ? yHigh - (minBarHeight - barHeight) / 2 : yHigh;
        

        const avgY = yScale(d.value);
        // If bar is minimal height, draw the avg marker line first (behind the bar), else draw it after
        if (actualHeight === minBarHeight) {
          barGroup.appendChild(createSVGElement('line', {
            x1: x - 2, y1: avgY,
            x2: x + barWidth + 2, y2: avgY,
            class: 'avg-marker',
            stroke: cfg.avgMarkerColor || 'var(--destructive)',
            'stroke-width': 3
          }));
        }
        barGroup.appendChild(createSVGElement('rect', {
          x: x, y: actualY,
          width: barWidth,
          height: actualHeight,
          class: 'bar high-low',
          fill: cfg.highLowColor || 'var(--chart-1)'
        }));
        if (actualHeight !== minBarHeight) {
          barGroup.appendChild(createSVGElement('line', {
            x1: x - 2, y1: avgY,
            x2: x + barWidth + 2, y2: avgY,
            class: 'avg-marker',
            stroke: cfg.avgMarkerColor || 'var(--destructive)',
            'stroke-width': 3
          }));
        }

        if (tooltip) {
          barGroup.addEventListener('mouseenter', (e) => {
            // Use custom formatter if provided, otherwise use default
            if (cfg.tooltipFormatter && typeof cfg.tooltipFormatter === 'function') {
              tooltip.innerHTML = cfg.tooltipFormatter(d, cfg);
            } else {
              const formattedHigh = formatNumber(d.highValue, numberFormat, numberDecimals, useThousandSeparator);
              const formattedLow = formatNumber(d.lowValue, numberFormat, numberDecimals, useThousandSeparator);
              const formattedAvg = formatNumber(d.value, numberFormat, numberDecimals, useThousandSeparator);
              tooltip.innerHTML = `<strong>${formatTooltipDate(d.date, cfg.chartType)}</strong><br>High: ${formattedHigh}<br>Low: ${formattedLow}<br>Avg: ${formattedAvg}`;
            }
            tooltip.style.display = 'block';
            positionTooltip(tooltip, e);
          });
          barGroup.addEventListener('mousemove', (e) => {
            positionTooltip(tooltip, e);
          });
          barGroup.addEventListener('mouseleave', () => {
            tooltip.style.display = 'none';
          });
        }

        barsGroup.appendChild(barGroup);
      } else if (cfg.renderType === 'staggered') {
        // Staggered/multi-series bars
        const values = d.values || [];
        const seriesCount = values.length;
        const yAxisLabels = cfg.yAxisLabels || [];
        const staggeredColors = cfg.staggeredColors || ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)', 'var(--primary)', 'var(--success)', 'var(--destructive)'];
        const gap = 2; // gap between staggered bars
        const subBarWidth = seriesCount > 0 ? (barWidth - (seriesCount - 1) * gap) / seriesCount : barWidth;
        
        const barGroup = createSVGElement('g', { class: 'staggered-bar-group' });
        
        values.forEach((val, seriesIdx) => {
          if (val === null || val === undefined) return; // skip null/missing values
          const subX = x + seriesIdx * (subBarWidth + gap);
          const barHeight = Math.max(1, innerHeight - yScale(val));
          const subBar = createSVGElement('rect', {
            x: subX,
            y: yScale(val),
            width: subBarWidth,
            height: barHeight,
            class: 'bar staggered',
            fill: staggeredColors[seriesIdx % staggeredColors.length]
          });
          barGroup.appendChild(subBar);
        });
        
        if (tooltip) {
          barGroup.addEventListener('mouseenter', (e) => {
            if (cfg.tooltipFormatter && typeof cfg.tooltipFormatter === 'function') {
              tooltip.innerHTML = cfg.tooltipFormatter(d, cfg);
            } else {
              let html = `<strong>${formatTooltipDate(d.date, cfg.chartType)}</strong><br>`;
              let total = 0;
              values.forEach((val, idx) => {
                const label = yAxisLabels[idx] || `Series ${idx + 1}`;
                if (val !== null && val !== undefined) {
                  html += `${label}: ${formatNumber(val, numberFormat, numberDecimals, useThousandSeparator)}<br>`;
                  total += val;
                } else {
                  html += `${label}: —<br>`;
                }
              });
              html += `<strong>Total: ${formatNumber(total, numberFormat, numberDecimals, useThousandSeparator)}</strong>`;
              tooltip.innerHTML = html;
            }
            tooltip.style.display = 'block';
            positionTooltip(tooltip, e);
          });
          barGroup.addEventListener('mousemove', (e) => {
            positionTooltip(tooltip, e);
          });
          barGroup.addEventListener('mouseleave', () => {
            tooltip.style.display = 'none';
          });
        }
        
        barsGroup.appendChild(barGroup);
      } else if (cfg.renderType === 'stacked') {
        // Stacked bars - bars on top of each other
        const values = d.values || [];
        const yAxisLabels = cfg.yAxisLabels || [];
        const stackedColors = cfg.staggeredColors || ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)', 'var(--primary)', 'var(--success)', 'var(--destructive)'];
        
        const barGroup = createSVGElement('g', { class: 'stacked-bar-group' });
        
        let cumulativeValue = 0;
        values.forEach((val, seriesIdx) => {
          if (val === null || val === undefined || val === 0) return; // skip null/zero values
          const segmentHeight = Math.max(0, innerHeight - yScale(val) - (innerHeight - yScale(0)));
          const y = yScale(cumulativeValue + val);
          
          const segment = createSVGElement('rect', {
            x: x,
            y: y,
            width: barWidth,
            height: Math.max(1, segmentHeight),
            class: 'bar stacked',
            fill: stackedColors[seriesIdx % stackedColors.length]
          });
          barGroup.appendChild(segment);
          cumulativeValue += val;
        });
        
        if (tooltip) {
          barGroup.addEventListener('mouseenter', (e) => {
            if (cfg.tooltipFormatter && typeof cfg.tooltipFormatter === 'function') {
              tooltip.innerHTML = cfg.tooltipFormatter(d, cfg);
            } else {
              let html = `<strong>${formatTooltipDate(d.date, cfg.chartType)}</strong><br>`;
              let total = 0;
              values.forEach((val, idx) => {
                const label = yAxisLabels[idx] || `Series ${idx + 1}`;
                if (val !== null && val !== undefined) {
                  html += `${label}: ${formatNumber(val, numberFormat, numberDecimals, useThousandSeparator)}<br>`;
                  total += val;
                } else {
                  html += `${label}: —<br>`;
                }
              });
              html += `<strong>Total: ${formatNumber(total, numberFormat, numberDecimals, useThousandSeparator)}</strong>`;
              tooltip.innerHTML = html;
            }
            tooltip.style.display = 'block';
            positionTooltip(tooltip, e);
          });
          barGroup.addEventListener('mousemove', (e) => {
            positionTooltip(tooltip, e);
          });
          barGroup.addEventListener('mouseleave', () => {
            tooltip.style.display = 'none';
          });
        }
        
        barsGroup.appendChild(barGroup);
      } else {
        const barHeight = Math.max(1, innerHeight - yScale(d.value));
        const bar = createSVGElement('rect', {
          x: x, y: yScale(d.value),
          width: barWidth,
          height: barHeight,
          class: 'bar',
          fill: cfg.barColor || 'var(--chart-1)'
        });

        if (tooltip) {
          bar.addEventListener('mouseenter', (e) => {
            // Use custom formatter if provided, otherwise use default
            if (cfg.tooltipFormatter && typeof cfg.tooltipFormatter === 'function') {
              tooltip.innerHTML = cfg.tooltipFormatter(d, cfg);
            } else {
              const formattedValue = formatNumber(d.value, numberFormat, numberDecimals, useThousandSeparator);
              tooltip.innerHTML = `<strong>${formatTooltipDate(d.date, cfg.chartType)}</strong><br>Value: ${formattedValue}`;
            }
            tooltip.style.display = 'block';
            positionTooltip(tooltip, e);
          });
          bar.addEventListener('mousemove', (e) => {
            positionTooltip(tooltip, e);
          });
          bar.addEventListener('mouseleave', () => {
            tooltip.style.display = 'none';
          });
        }

        barsGroup.appendChild(bar);
      }
    });

    chartGroup.appendChild(barsGroup);

    // Create hover indicator elements (vertical line + circle) - initially hidden
    const hoverIndicatorGroup = createSVGElement('g', { class: 'hover-indicator', style: 'display: none;' });
    
    // Vertical line from top to bottom
    const hoverLine = createSVGElement('line', {
      x1: 0, y1: 0,
      x2: 0, y2: innerHeight,
      class: 'hover-line'
    });
    hoverIndicatorGroup.appendChild(hoverLine);
    
    // Circle at the top of the bar
    const hoverCircle = createSVGElement('circle', {
      cx: 0, cy: 0, r: 5,
      class: 'hover-circle'
    });
    hoverIndicatorGroup.appendChild(hoverCircle);
    
    chartGroup.appendChild(hoverIndicatorGroup);

    // Pre-calculate bar positions for hover
    const barPositions = aggregatedData.map((d, i) => {
      const x = i * barStep;
      const barCenterX = x + barStep / 2;
      let barTopY;
      if (cfg.renderType === 'stacked' && d.values) {
        // For stacked, show circle at the top of the stacked bar (sum of all values)
        const total = d.values.filter(v => v !== null && v !== undefined).reduce((sum, v) => sum + v, 0);
        barTopY = yScale(total);
      } else if (cfg.renderType === 'staggered' && d.values) {
        // For staggered, show circle at the max value across series
        const maxVal = Math.max(...d.values.filter(v => v !== null && v !== undefined));
        barTopY = yScale(maxVal);
      } else {
        barTopY = yScale(d.value);
      }
      return { x, barCenterX, barTopY, data: d, index: i };
    });

    // Hover data for external management (multi-chart mode)
    const hoverData = {
      hoverIndicatorGroup,
      hoverLine,
      hoverCircle,
      barPositions,
      cfg: { ...cfg, numberFormat, numberDecimals, useThousandSeparator },
      aggregatedData,
      yScale,
      showHover: (index, barCenterX) => {
        const pos = barPositions[index];
        if (!pos) return;
        hoverIndicatorGroup.style.display = 'block';
        hoverLine.setAttribute('x1', barCenterX);
        hoverLine.setAttribute('x2', barCenterX);
        hoverCircle.setAttribute('cx', barCenterX);
        hoverCircle.setAttribute('cy', pos.barTopY);
      },
      hideHover: () => {
        hoverIndicatorGroup.style.display = 'none';
      },
      getTooltipContent: (index) => {
        const d = aggregatedData[index];
        if (!d) return '';
        return generateTooltipContent(d, cfg, numberFormat, numberDecimals, useThousandSeparator);
      }
    };

    // Add invisible hover zones for each bar (full height for vertical hover tooltip)
    // Only add standalone hover handling if NOT in multi-chart mode
    if (tooltip && !multiChartMode) {
      const hoverZonesGroup = createSVGElement('g', { class: 'hover-zones' });
      
      aggregatedData.forEach((d, i) => {
        const x = i * barStep;
        const barCenterX = x + barStep / 2;
        
        // Calculate the y position for the circle (top of bar in normal mode, average value in high-low mode)
        let barTopY;
        if (cfg.renderType === 'stacked' && d.values) {
          // For stacked, show circle at the top of the stacked bar (sum of all values)
          const total = d.values.filter(v => v !== null && v !== undefined).reduce((sum, v) => sum + v, 0);
          barTopY = yScale(total);
        } else if (cfg.renderType === 'staggered' && d.values) {
          // For staggered, show circle at the max value across series
          const maxVal = Math.max(...d.values.filter(v => v !== null && v !== undefined));
          barTopY = yScale(maxVal);
        } else if (cfg.renderType === 'high-low') {
          // In high-low mode, show circle at the average value marker position
          barTopY = yScale(d.value);
        } else {
          barTopY = yScale(d.value);
        }
        
        // Create an invisible rect that spans the full height of the chart
        const hoverZone = createSVGElement('rect', {
          x: x,
          y: 0,
          width: barStep,
          height: innerHeight,
          class: 'hover-zone',
          fill: 'transparent',
          'pointer-events': 'all'
        });
        
        hoverZone.addEventListener('mouseenter', (e) => {
          // Show hover indicator
          hoverIndicatorGroup.style.display = 'block';
          hoverLine.setAttribute('x1', barCenterX);
          hoverLine.setAttribute('x2', barCenterX);
          hoverCircle.setAttribute('cx', barCenterX);
          hoverCircle.setAttribute('cy', barTopY);
          
          // Use custom formatter if provided, otherwise use default
          const tableStyle = 'border-collapse:collapse;width:100%;';
          const labelStyle = 'text-align:left;padding-right:10px;';
          const valueStyle = 'text-align:right;font-weight:500;';
          
          if (cfg.tooltipFormatter && typeof cfg.tooltipFormatter === 'function') {
            tooltip.innerHTML = cfg.tooltipFormatter(d, cfg);
          } else if (cfg.renderType === 'staggered' || cfg.renderType === 'stacked') {
            const values = d.values || [];
            const yAxisLabels = cfg.yAxisLabels || [];
            const colors = cfg.staggeredColors || ['#4a90d9', '#e74c3c', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c', '#34495e', '#e67e22'];
            let html = `<strong>${formatTooltipDate(d.date, cfg.chartType)}</strong><hr style="margin:4px 0;border:none;border-top:1px solid #ccc;"><table style="${tableStyle}">`;
            let total = 0;
            
            // For stacked charts, reverse the order so tooltip matches visual stack (top to bottom)
            const indices = cfg.renderType === 'stacked' 
              ? [...Array(values.length).keys()].reverse() 
              : [...Array(values.length).keys()];
            
            // Calculate total first (needed for stacked display)
            values.forEach(val => {
              if (val !== null && val !== undefined) total += val;
            });
            
            indices.forEach(idx => {
              const val = values[idx];
              const label = yAxisLabels[idx] || `Series ${idx + 1}`;
              const color = colors[idx % colors.length];
              const circle = `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${color};margin-right:5px;vertical-align:middle;"></span>`;
              if (val !== null && val !== undefined) {
                html += `<tr><td style="${labelStyle}">${circle}${label}:</td><td style="${valueStyle}">${formatNumber(val, numberFormat, numberDecimals, useThousandSeparator)}</td></tr>`;
              } else {
                html += `<tr><td style="${labelStyle}">${circle}${label}:</td><td style="${valueStyle}">—</td></tr>`;
              }
            });
            html += `<tr><td style="${labelStyle}"><strong>Total:</strong></td><td style="${valueStyle}"><strong>${formatNumber(total, numberFormat, numberDecimals, useThousandSeparator)}</strong></td></tr></table>`;
            tooltip.innerHTML = html;
          } else if (cfg.renderType === 'high-low') {
            const formattedHigh = formatNumber(d.highValue, numberFormat, numberDecimals, useThousandSeparator);
            const formattedLow = formatNumber(d.lowValue, numberFormat, numberDecimals, useThousandSeparator);
            const formattedAvg = formatNumber(d.value, numberFormat, numberDecimals, useThousandSeparator);
            tooltip.innerHTML = `<strong>${formatTooltipDate(d.date, cfg.chartType)}</strong><table style="${tableStyle}"><tr><td style="${labelStyle}">High:</td><td style="${valueStyle}">${formattedHigh}</td></tr><tr><td style="${labelStyle}">Low:</td><td style="${valueStyle}">${formattedLow}</td></tr><tr><td style="${labelStyle}">Avg:</td><td style="${valueStyle}">${formattedAvg}</td></tr></table>`;
          } else {
            const formattedValue = formatNumber(d.value, numberFormat, numberDecimals, useThousandSeparator);
            tooltip.innerHTML = `<strong>${formatTooltipDate(d.date, cfg.chartType)}</strong><table style="${tableStyle}"><tr><td style="${labelStyle}">Value:</td><td style="${valueStyle}">${formattedValue}</td></tr></table>`;
          }
          tooltip.style.display = 'block';
          positionTooltip(tooltip, e);
        });
        
        hoverZone.addEventListener('mousemove', (e) => {
          positionTooltip(tooltip, e);
        });
        
        hoverZone.addEventListener('mouseleave', () => {
          // Hide hover indicator
          hoverIndicatorGroup.style.display = 'none';
          tooltip.style.display = 'none';
        });
        
        hoverZonesGroup.appendChild(hoverZone);
      });
      
      chartGroup.appendChild(hoverZonesGroup);
    }

    // Title will be rendered as HTML overlay for sticky positioning
    // Store title in config for later use
    const titleText = cfg.title || null;

    return { yAxisSvg, chartSvg, innerHeight, titleText, hoverData };
  }

  // ============================================================================
  // X-AXIS RENDERER
  // ============================================================================

  /**
   * Get quarter number (1-4) for a given month (0-11)
   * @param {number} month - Month (0-11)
   * @returns {number} Quarter (1-4)
   */
  function getQuarter(month) {
    return Math.floor(month / 3) + 1;
  }

  /**
   * Get quarter from week number (approximate)
   * @param {number} weekNum - Week number (1-53)
   * @returns {number} Quarter (1-4)
   */
  function getQuarterFromWeek(weekNum) {
    if (weekNum <= 13) return 1;
    if (weekNum <= 26) return 2;
    if (weekNum <= 39) return 3;
    return 4;
  }

  function renderXAxis(cfg, aggregatedData, barStep, innerWidth, margin) {
    // Increase height for multi-level labels:
    // byDay: day (row 1) + month (row 2) + year (row 3)
    // byWeek: week (row 1) + quarter (row 2) + year (row 3)
    const xAxisHeight = (cfg.chartType === 'byWeek' || cfg.chartType === 'byDay') ? 55 : 60;
    const chartGap = 5;

    // Empty y-axis spacer
    const xAxisYSpacer = createSVGElement('svg', {
      width: margin.left,
      height: xAxisHeight,
      class: 'barchart-xaxis-spacer'
    });

    // X-axis SVG (scrollable with chart)
    const xAxisSvg = createSVGElement('svg', {
      width: innerWidth + chartGap + margin.right,
      height: xAxisHeight,
      class: 'barchart-xaxis'
    });

    const xAxisGroup = createSVGElement('g', { transform: `translate(${chartGap}, 0)` });
    xAxisSvg.appendChild(xAxisGroup);

    // X axis line
    xAxisGroup.appendChild(createSVGElement('line', {
      x1: 0, y1: 0, x2: innerWidth, y2: 0,
      class: 'axis-line'
    }));

    // X axis labels with intelligent thinning
    const maxLabels = Math.floor(innerWidth / 50);
    const labelStep = Math.max(1, Math.ceil(aggregatedData.length / maxLabels));
    const processedYears = new Set();

    aggregatedData.forEach((d, i) => {
      const x = i * barStep + barStep / 2;

      // Tick mark
      xAxisGroup.appendChild(createSVGElement('line', {
        x1: x, y1: 0, x2: x, y2: 5,
        class: 'axis-tick'
      }));

      // Label (with thinning)
      if (i % labelStep === 0) {
        let labelText = d.date;

        if (cfg.chartType === 'byWeekday') {
          const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
          labelText = days[parseInt(d.date)];
        } else if (cfg.chartType === 'byMonth') {
          const [year, month] = d.date.split('-');
          const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
          labelText = monthNames[parseInt(month) - 1];

          if (!processedYears.has(year)) {
            processedYears.add(year);
            const yearLabel = createSVGElement('text', {
              x: x, y: 35,
              class: 'year-label',
              'text-anchor': 'middle'
            });
            yearLabel.textContent = year;
            xAxisGroup.appendChild(yearLabel);
          }
        } else if (cfg.chartType === 'byWeek') {
          const [year, week] = d.date.split('-W');
          labelText = `W${week}`;
          // Year and quarter labels are rendered separately below
        } else if (cfg.chartType === 'byDay') {
          // Show just the day number (month/year are rendered separately below)
          const parts = d.date.split('-');
          labelText = parts[2]; // Just the day: "15"
        }

        const label = createSVGElement('text', {
          x: x, y: 20,
          class: 'axis-label',
          'text-anchor': 'middle'
        });
        label.textContent = labelText;
        xAxisGroup.appendChild(label);
      }
    });

    // For byWeek mode: render year and quarter labels on the second row
    if (cfg.chartType === 'byWeek') {
      const processedQuarters = new Set();
      let lastYear = null;
      let yearStartIdx = 0;

      aggregatedData.forEach((d, i) => {
        const x = i * barStep + barStep / 2;
        const [year, weekStr] = d.date.split('-W');
        const weekNum = parseInt(weekStr);
        const quarter = getQuarterFromWeek(weekNum);
        const quarterKey = `${year}-Q${quarter}`;

        // Track year boundaries
        if (lastYear !== year) {
          // Place year label for previous year
          if (lastYear !== null) {
            const prevEndX = (i - 1) * barStep + barStep / 2;
            const yearLabelX = (yearStartIdx * barStep + barStep / 2 + prevEndX) / 2;
            const yearLabel = createSVGElement('text', {
              x: yearLabelX, y: 45,
              class: 'year-label',
              'text-anchor': 'middle'
            });
            yearLabel.textContent = lastYear;
            xAxisGroup.appendChild(yearLabel);

            // Draw year boundary line
            const boundaryX = i * barStep;
            xAxisGroup.appendChild(createSVGElement('line', {
              x1: boundaryX, y1: 0,
              x2: boundaryX, y2: xAxisHeight,
              class: 'axis-line',
              'stroke-width': '1'
            }));
          }
          yearStartIdx = i;
          lastYear = year;
        }

        // Place quarter label at the first occurrence of each quarter
        if (!processedQuarters.has(quarterKey)) {
          processedQuarters.add(quarterKey);

          // Find the extent of this quarter for label placement
          let quarterEndIdx = i;
          for (let j = i + 1; j < aggregatedData.length; j++) {
            const [y2, w2] = aggregatedData[j].date.split('-W');
            if (y2 !== year || getQuarterFromWeek(parseInt(w2)) !== quarter) break;
            quarterEndIdx = j;
          }
          const quarterStartX = x;
          const quarterEndX = quarterEndIdx * barStep + barStep / 2;
          const quarterLabelX = (quarterStartX + quarterEndX) / 2;

          const quarterLabel = createSVGElement('text', {
            x: quarterLabelX, y: 35,
            class: 'week-label',
            'text-anchor': 'middle'
          });
          quarterLabel.textContent = `Q${quarter}`;
          xAxisGroup.appendChild(quarterLabel);

          // Draw a subtle vertical line at quarter boundary (except at start of data or year)
          if (i > 0 && aggregatedData[i - 1].date.split('-W')[0] === year) {
            const boundaryX = i * barStep;
            xAxisGroup.appendChild(createSVGElement('line', {
              x1: boundaryX, y1: 0,
              x2: boundaryX, y2: xAxisHeight - 10,
              class: 'axis-tick',
              'stroke-dasharray': '2,2',
              'stroke-opacity': '0.4'
            }));
          }
        }
      });

      // Place the last year label
      if (lastYear !== null) {
        const lastX = (aggregatedData.length - 1) * barStep + barStep / 2;
        const yearLabelX = (yearStartIdx * barStep + barStep / 2 + lastX) / 2;
        const yearLabel = createSVGElement('text', {
          x: yearLabelX, y: 45,
          class: 'year-label',
          'text-anchor': 'middle'
        });
        yearLabel.textContent = lastYear;
        xAxisGroup.appendChild(yearLabel);
      }
    }

    // For byDay mode: render month and year labels on separate rows
    if (cfg.chartType === 'byDay') {
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const processedMonths = new Set();
      let lastYear = null;
      let lastMonth = null;
      let yearStartIdx = 0;
      let monthStartIdx = 0;

      aggregatedData.forEach((d, i) => {
        const x = i * barStep + barStep / 2;
        const parts = d.date.split('-');
        const year = parts[0];
        const month = parts[1];
        const monthKey = `${year}-${month}`;

        // Track month boundaries
        if (lastMonth !== monthKey) {
          // Place month label for previous month
          if (lastMonth !== null) {
            const prevEndX = (i - 1) * barStep + barStep / 2;
            const monthLabelX = (monthStartIdx * barStep + barStep / 2 + prevEndX) / 2;
            const [prevYear, prevMonth] = lastMonth.split('-');
            const monthLabel = createSVGElement('text', {
              x: monthLabelX, y: 35,
              class: 'week-label',
              'text-anchor': 'middle'
            });
            monthLabel.textContent = monthNames[parseInt(prevMonth) - 1];
            xAxisGroup.appendChild(monthLabel);

            // Draw a subtle vertical line at month boundary
            const boundaryX = i * barStep;
            xAxisGroup.appendChild(createSVGElement('line', {
              x1: boundaryX, y1: 0,
              x2: boundaryX, y2: xAxisHeight - 10,
              class: 'axis-tick',
              'stroke-dasharray': '2,2',
              'stroke-opacity': '0.4'
            }));
          }
          monthStartIdx = i;
          lastMonth = monthKey;
        }

        // Track year boundaries
        if (lastYear !== year) {
          // Place year label for previous year
          if (lastYear !== null) {
            const prevEndX = (i - 1) * barStep + barStep / 2;
            const yearLabelX = (yearStartIdx * barStep + barStep / 2 + prevEndX) / 2;
            const yearLabel = createSVGElement('text', {
              x: yearLabelX, y: 45,
              class: 'year-label',
              'text-anchor': 'middle'
            });
            yearLabel.textContent = lastYear;
            xAxisGroup.appendChild(yearLabel);

            // Draw year boundary line
            const boundaryX = i * barStep;
            xAxisGroup.appendChild(createSVGElement('line', {
              x1: boundaryX, y1: 0,
              x2: boundaryX, y2: xAxisHeight,
              class: 'axis-line',
              'stroke-width': '1'
            }));
          }
          yearStartIdx = i;
          lastYear = year;
        }
      });

      // Place the last month label
      if (lastMonth !== null) {
        const lastX = (aggregatedData.length - 1) * barStep + barStep / 2;
        const monthLabelX = (monthStartIdx * barStep + barStep / 2 + lastX) / 2;
        const [prevYear, prevMonth] = lastMonth.split('-');
        const monthLabel = createSVGElement('text', {
          x: monthLabelX, y: 35,
          class: 'week-label',
          'text-anchor': 'middle'
        });
        monthLabel.textContent = monthNames[parseInt(prevMonth) - 1];
        xAxisGroup.appendChild(monthLabel);
      }

      // Place the last year label
      if (lastYear !== null) {
        const lastX = (aggregatedData.length - 1) * barStep + barStep / 2;
        const yearLabelX = (yearStartIdx * barStep + barStep / 2 + lastX) / 2;
        const yearLabel = createSVGElement('text', {
          x: yearLabelX, y: 45,
          class: 'year-label',
          'text-anchor': 'middle'
        });
        yearLabel.textContent = lastYear;
        xAxisGroup.appendChild(yearLabel);
      }
    }

    return { xAxisYSpacer, xAxisSvg };
  }

  // ============================================================================
  // UNIFIED CHART FUNCTION
  // ============================================================================

  /**
   * Create a chart with one or more timeSeries
   * 
   * Unified API that handles:
   * - Single timeSeries bar/high-low charts
   * - Multi-timeSeries staggered/stacked charts  
   * - Multi-panel charts with different y-axes
   * 
   * @param {Object} config - Configuration object
   * @param {string|HTMLElement} config.container - Container element or selector
   * @param {Array} config.data - Shared data array (can be overridden per-timeSeries)
   * @param {string} config.chartType - X-axis grouping: 'byDay', 'byWeek', 'byMonth', 'byYear', 'byWeekday'
   * @param {Array} config.timeSeries - Array of timeSeries configurations
   * @param {number} [config.visibleWidth=800] - Visible chart width
   * @param {number} [config.chartHeight=200] - Height per chart panel
   * @param {Object} [config.margin] - Chart margins
   * @param {number} [config.barMinWidth=8] - Minimum bar width
   * @param {boolean} [config.showTooltip=true] - Show tooltips
   * @param {boolean} [config.showGrid=true] - Show grid lines
   * @param {boolean} [config.scrollToEnd=false] - Initially scroll to rightmost bar
   * @returns {HTMLElement} The chart container element
   * 
   * @example
   * // Single timeSeries bar chart
   * Barchart.createChart({
   *   container: '#chart',
   *   data: dailyData,
   *   chartType: 'byDay',
   *   timeSeries: [{
   *     renderType: 'bar',
   *     title: 'Daily Values',
   *     yAxisLabel: 'Value'
   *   }]
   * });
   * 
   * @example
   * // Multi-timeSeries staggered chart
   * Barchart.createChart({
   *   container: '#chart',
   *   data: staggeredData,  // [{date, values: [v1, v2, ...]}]
   *   chartType: 'byDay',
   *   timeSeries: [
   *     { label: 'Price', color: '#4a90d9' },
   *     { label: 'Fee', color: '#e74c3c' },
   *     { label: 'Tax', color: '#2ecc71' }
   *   ],
   *   renderType: 'staggered'
   * });
   * 
   * @example
   * // Multi-panel chart with different render types
   * Barchart.createChart({
   *   container: '#chart',
   *   chartType: 'byDay',
   *   timeSeries: [
   *     { data: data1, renderType: 'bar', title: 'Requests', yAxisLabel: 'Count' },
   *     { data: data2, renderType: 'high-low', title: 'Response Time', yAxisLabel: 'ms' }
   *   ]
   * });
   */
  function createChart(config) {
    const defaults = {
      container: null,
      timeSeries: [],          // Array of timeSeries configs (each with its own data)
      chartType: 'byDay',      // Shared x-axis grouping
      renderType: null,        // Top-level renderType for multi-series (staggered/stacked)
      visibleWidth: 800,       // Visible width (scrollable if content exceeds)
      chartHeight: 200,        // Height per chart panel
      margin: { top: 30, right: 10, bottom: 10, left: 70 },
      barMinWidth: 8,          // Minimum bar width
      showTooltip: true,
      showGrid: true,
      tooltipFormatter: null,  // Custom tooltip formatter: (data, seriesConfig) => string|HTML
      scrollToEnd: false,      // Scroll initially to the rightmost bar
      title: '',               // Chart title (for single-panel charts)
      yAxisLabel: '',          // Y-axis label (for single-panel charts)
      useThousandSeparator: true, // Use thousand separators in number formatting
      // Default series colors
      colors: ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)', 'var(--primary)', 'var(--success)', 'var(--destructive)']
    };

    const cfg = { ...defaults, ...config };

    // Normalize series configuration
    let normalizedSeries = [];
    
    // Check if this is a staggered/stacked chart (multi-timeSeries mode indicated by top-level renderType)
    const isStaggeredOrStacked = cfg.renderType === 'staggered' || cfg.renderType === 'stacked';
    
    if (cfg.timeSeries && cfg.timeSeries.length > 0) {
      if (isStaggeredOrStacked) {
        // Multi-timeSeries mode (staggered/stacked): each timeSeries has its own { date, value } data array
        // Merge all timeSeries data arrays into a combined format with values array
        const seriesLabels = cfg.timeSeries.map(s => s.label || s.title || '');
        const seriesColors = cfg.timeSeries.map((s, idx) => s.color || s.barColor || cfg.colors[idx % cfg.colors.length]);
        
        // Collect all dates from all timeSeries
        const dateValueMap = new Map(); // date string -> { date, values: [] }
        const seriesCount = cfg.timeSeries.length;
        
        cfg.timeSeries.forEach((s, seriesIdx) => {
          const seriesData = s.data || [];
          seriesData.forEach(d => {
            const dateStr = d.date instanceof Date 
              ? d.date.toISOString().split('T')[0] 
              : new Date(d.date).toISOString().split('T')[0];
            
            if (!dateValueMap.has(dateStr)) {
              // Initialize with nulls for all series
              dateValueMap.set(dateStr, { date: dateStr, values: new Array(seriesCount).fill(null) });
            }
            // Set this series' value at the correct index
            dateValueMap.get(dateStr).values[seriesIdx] = d.value;
          });
        });
        
        // Convert to array and sort by date
        const chartData = Array.from(dateValueMap.values()).sort((a, b) => a.date.localeCompare(b.date));
        
        normalizedSeries = [{
          data: chartData,
          renderType: cfg.renderType,
          title: cfg.title || '',
          yAxisLabel: cfg.yAxisLabel || '',
          yAxisLabels: seriesLabels,
          staggeredColors: seriesColors,
          barColor: seriesColors[0],
          highLowColor: 'var(--chart-1)',
          avgMarkerColor: 'var(--destructive)',
          yAxisScale: cfg.yAxisScale || 'linear',
          yAxisFormat: cfg.yAxisFormat || 'none',
          yAxisDecimals: cfg.yAxisDecimals !== undefined ? cfg.yAxisDecimals : 2,
          useThousandSeparator: cfg.useThousandSeparator !== undefined ? cfg.useThousandSeparator : true,
          yAxisStartAtZero: cfg.yAxisStartAtZero !== undefined ? cfg.yAxisStartAtZero : true,
          tooltipFormatter: cfg.tooltipFormatter
        }];
      } else {
        // Check if this is a multi-panel chart (timeSeries with renderType indicates panels)
        // or timeSeries with label/color only (legacy multi-timeSeries detection)
        const hasSeriesRenderType = cfg.timeSeries.some(s => s.renderType);
        const isMultiPanel = hasSeriesRenderType || cfg.timeSeries.every(s => s.data || s.renderType);
        
        if (isMultiPanel || cfg.timeSeries.some(s => s.renderType)) {
          // Multi-panel mode: each timeSeries is a separate chart panel
          // First timeSeries with data provides fallback for others
          const firstSeriesWithData = cfg.timeSeries.find(s => s.data && s.data.length > 0);
          const sharedData = firstSeriesWithData ? firstSeriesWithData.data : [];
          
          normalizedSeries = cfg.timeSeries.map((s, idx) => ({
            data: s.data || sharedData,
            renderType: s.renderType || 'bar',
            title: s.title || '',
            yAxisLabel: s.yAxisLabel || '',
            yAxisLabels: s.yAxisLabels || s.labels || [],
            barColor: s.barColor || s.color || cfg.colors[idx % cfg.colors.length],
            highLowColor: s.highLowColor || s.color || 'var(--chart-1)',
            avgMarkerColor: s.avgMarkerColor || 'var(--destructive)',
            staggeredColors: s.colors || s.staggeredColors || cfg.colors,
            yAxisScale: s.yAxisScale || 'linear',
            yAxisFormat: s.yAxisFormat || 'none',
            yAxisDecimals: s.yAxisDecimals !== undefined ? s.yAxisDecimals : 2,
            useThousandSeparator: s.useThousandSeparator !== undefined ? s.useThousandSeparator : cfg.useThousandSeparator,
            yAxisStartAtZero: s.yAxisStartAtZero !== undefined ? s.yAxisStartAtZero : true,
            tooltipFormatter: s.tooltipFormatter || cfg.tooltipFormatter
          }));
        }
      }
    } else {
      // No timeSeries provided - return early with warning
      console.warn('Barchart: No timeSeries provided');
      return null;
    }

    // Validate that we have data
    if (normalizedSeries.length === 0 || !normalizedSeries[0].data || normalizedSeries[0].data.length === 0) {
      console.warn('Barchart: No valid data in timeSeries');
      return null;
    }

    // Helper function to normalize and aggregate data for a single dataset
    function processData(rawData, seriesCfg) {
      // For staggered/stacked charts, preserve the values array without filtering by value
      if (seriesCfg && (seriesCfg.renderType === 'staggered' || seriesCfg.renderType === 'stacked')) {
        return rawData.map(d => ({
          date: (d.date instanceof Date ? d.date : new Date(d.date)).toISOString().split('T')[0],
          values: d.values || []
        })).filter(d => d.date !== 'Invalid Date');
      }
      
      const normalized = rawData.map(d => ({
        date: d.date instanceof Date ? d.date : new Date(d.date),
        value: Number(d.value),
        highValue: d.highValue !== undefined ? Number(d.highValue) : undefined,
        lowValue: d.lowValue !== undefined ? Number(d.lowValue) : undefined
      })).filter(d => !isNaN(d.date.getTime()) && !isNaN(d.value));

      if (normalized.length === 0) {
        return [];
      }

      // Aggregate data based on chartType
      if (cfg.chartType !== 'byDay') {
        return aggregates(normalized, cfg.chartType);
      } else {
        return normalized.map(d => ({
          date: d.toISOString ? d.toISOString().split('T')[0] : d.date.toISOString().split('T')[0],
          value: d.value,
          highValue: d.highValue || d.value,
          lowValue: d.lowValue || d.value,
          count: 1
        }));
      }
    }

    // Process data for each series
    let sharedAggregatedData = [];
    const seriesDataSets = [];
    
    normalizedSeries.forEach((seriesCfg, index) => {
      const seriesData = seriesCfg.data || [];
      const aggregated = processData(seriesData, seriesCfg);
      seriesDataSets.push(aggregated);
      
      // Use the first series' data for x-axis
      if (index === 0) {
        sharedAggregatedData = aggregated;
      }
    });

    // Validate we have data to render
    if (sharedAggregatedData.length === 0) {
      console.warn('Barchart: No valid data points provided');
      return null;
    }

    // Use the first series' data length for bar count (all should be aligned)
    const aggregatedData = sharedAggregatedData;

    // Calculate dimensions
    const barCount = aggregatedData.length;
    const barPadding = 0.2;
    const minContentWidth = barCount * cfg.barMinWidth / (1 - barPadding);
    const innerWidth = Math.max(cfg.visibleWidth - cfg.margin.left - cfg.margin.right, minContentWidth);
    const barStep = innerWidth / barCount;
    const barWidth = Math.max(1, barStep * (1 - barPadding));

    // Create tooltip
    let tooltip = null;
    if (cfg.showTooltip) {
      tooltip = document.createElement('div');
      tooltip.className = 'chart-tooltip';
      tooltip.style.display = 'none';
      document.body.appendChild(tooltip);
    }

    // Create main container
    const mainContainer = document.createElement('div');
    mainContainer.className = 'barchart-container';
    mainContainer.style.width = cfg.visibleWidth + 'px';

    // Collect hover data from all chart panels for synchronized hover
    const allChartHoverData = [];
    const isMultiPanel = normalizedSeries.length > 1;

    // Create rows for each series (chart panel)
    normalizedSeries.forEach((seriesCfg, index) => {
      const row = document.createElement('div');
      row.className = 'barchart-row';

      // Merge config
      const panelCfg = {
        ...cfg,
        ...seriesCfg,
        innerWidth,
        innerHeight: cfg.chartHeight,
        margin: cfg.margin
      };

      // Use the per-series data for this panel
      const panelData = seriesDataSets[index];

      // Pass multiChartMode=true if we have multiple panels
      const { yAxisSvg, chartSvg, titleText, hoverData } = renderChartPanel(panelCfg, panelData, barStep, barWidth, tooltip, isMultiPanel);
      
      // Store hover data for synchronized hover
      allChartHoverData.push(hoverData);

      // Y-axis container (sticky)
      const yAxisContainer = document.createElement('div');
      yAxisContainer.className = 'barchart-yaxis-container';
      yAxisContainer.appendChild(yAxisSvg);
      row.appendChild(yAxisContainer);

      // Chart area wrapper with title overlay
      const chartAreaWrapper = document.createElement('div');
      chartAreaWrapper.className = 'barchart-chart-area';
      chartAreaWrapper.style.width = (cfg.visibleWidth - cfg.margin.left) + 'px';
      chartAreaWrapper.style.position = 'relative';
      
      // Add sticky centered title overlay if title exists
      if (titleText) {
        const titleOverlay = document.createElement('div');
        titleOverlay.className = 'barchart-title-overlay';
        titleOverlay.textContent = titleText;
        chartAreaWrapper.appendChild(titleOverlay);
      }
      
      // Chart scroll container
      const chartScrollContainer = document.createElement('div');
      chartScrollContainer.className = 'barchart-scroll-container';
      chartScrollContainer.appendChild(chartSvg);
      chartAreaWrapper.appendChild(chartScrollContainer);
      
      row.appendChild(chartAreaWrapper);

      mainContainer.appendChild(row);

      // Store scroll container reference for sync
      row._scrollContainer = chartScrollContainer;
    });

    // Add shared x-axis row
    const xAxisRow = document.createElement('div');
    xAxisRow.className = 'barchart-row barchart-xaxis-row';

    const { xAxisYSpacer, xAxisSvg } = renderXAxis(cfg, aggregatedData, barStep, innerWidth, cfg.margin);

    const xAxisSpacerContainer = document.createElement('div');
    xAxisSpacerContainer.className = 'barchart-yaxis-container';
    xAxisSpacerContainer.appendChild(xAxisYSpacer);
    xAxisRow.appendChild(xAxisSpacerContainer);

    // X-axis area wrapper (for consistent layout with chart rows)
    const xAxisAreaWrapper = document.createElement('div');
    xAxisAreaWrapper.className = 'barchart-chart-area';
    xAxisAreaWrapper.style.width = (cfg.visibleWidth - cfg.margin.left) + 'px';
    
    const xAxisScrollContainer = document.createElement('div');
    xAxisScrollContainer.className = 'barchart-scroll-container barchart-xaxis-scroll';
    xAxisScrollContainer.appendChild(xAxisSvg);
    xAxisAreaWrapper.appendChild(xAxisScrollContainer);
    
    xAxisRow.appendChild(xAxisAreaWrapper);

    mainContainer.appendChild(xAxisRow);
    xAxisRow._scrollContainer = xAxisScrollContainer;

    // Set up synchronized hover across all panels (multi-panel mode only)
    if (isMultiPanel && tooltip && allChartHoverData.length > 0) {
      // Get all chart scroll containers (excluding x-axis)
      const chartRows = Array.from(mainContainer.querySelectorAll('.barchart-row:not(.barchart-xaxis-row)'));
      
      chartRows.forEach((row, rowIndex) => {
        const scrollContainer = row.querySelector('.barchart-scroll-container');
        const chartSvg = scrollContainer.querySelector('.barchart-chart');
        if (!chartSvg) return;
        
        // Find the chart group (first g element with transform)
        const chartGroup = chartSvg.querySelector('g[transform]');
        if (!chartGroup) return;
        
        // Create hover zones group for this panel
        const hoverZonesGroup = createSVGElement('g', { class: 'hover-zones' });
        
        const hoverData = allChartHoverData[rowIndex];
        if (!hoverData) return;
        
        hoverData.barPositions.forEach((pos, i) => {
          const hoverZone = createSVGElement('rect', {
            x: pos.x,
            y: 0,
            width: barStep,
            height: cfg.chartHeight,
            class: 'hover-zone',
            fill: 'transparent',
            'pointer-events': 'all'
          });
          
          hoverZone.addEventListener('mouseenter', (e) => {
            const barCenterX = pos.barCenterX;
            
            // Show hover indicators on ALL panels
            allChartHoverData.forEach(chartHover => {
              chartHover.showHover(i, barCenterX);
            });
            
            // Build combined tooltip with date header and all panel values
            const dateLabel = hoverData.aggregatedData[i]?.date || '';
            let tooltipContent = `<strong>${dateLabel}</strong><hr style="margin: 4px 0; border: none; border-top: 1px solid #ddd;">`;
            
            allChartHoverData.forEach(chartHover => {
              tooltipContent += '<br>' + chartHover.getTooltipContent(i);
            });
            
            tooltip.innerHTML = tooltipContent;
            tooltip.style.display = 'block';
            positionTooltip(tooltip, e);
          });
          
          hoverZone.addEventListener('mousemove', (e) => {
            positionTooltip(tooltip, e);
          });
          
          hoverZone.addEventListener('mouseleave', () => {
            // Hide hover indicators on ALL panels
            allChartHoverData.forEach(chartHover => {
              chartHover.hideHover();
            });
            tooltip.style.display = 'none';
          });
          
          hoverZonesGroup.appendChild(hoverZone);
        });
        
        chartGroup.appendChild(hoverZonesGroup);
      });
    }

    // Sync scrolling across all charts and x-axis
    // Use a lock that persists briefly to prevent feedback loops causing "bouncing"
    const allScrollContainers = Array.from(mainContainer.querySelectorAll('.barchart-scroll-container'));
    const allYAxisContainers = Array.from(mainContainer.querySelectorAll('.barchart-yaxis-container'));
    const allChartAreas = Array.from(mainContainer.querySelectorAll('.barchart-chart-area'));
    let syncLock = false;
    let syncTimeout = null;
    
    // Check if content needs scrolling and toggle shadow accordingly
    // Also update shadow sides based on scroll position
    function updateShadowVisibility() {
      const firstContainer = allScrollContainers[0];
      if (!firstContainer) return;
      
      // Use a small tolerance to account for sub-pixel rendering differences
      const needsScroll = firstContainer.scrollWidth > firstContainer.clientWidth + 5;
      const scrollLeft = firstContainer.scrollLeft;
      const maxScroll = firstContainer.scrollWidth - firstContainer.clientWidth;
      
      // Determine which shadows to show based on scroll position
      const canScrollRight = scrollLeft < maxScroll - 1;
      const canScrollLeft = scrollLeft > 1;
      
      // Y-axis shadow: only show when scrolled (content to the left)
      allYAxisContainers.forEach(yAxisContainer => {
        if (!needsScroll || !canScrollLeft) {
          yAxisContainer.classList.add('no-shadow');
        } else {
          yAxisContainer.classList.remove('no-shadow');
        }
      });
      
      // Chart area right shadow: show when can scroll right
      allChartAreas.forEach(chartArea => {
        if (needsScroll && canScrollRight) {
          chartArea.classList.add('shadow-right');
        } else {
          chartArea.classList.remove('shadow-right');
        }
      });
      
      // Hide scrollbar when no scrolling is needed
      allScrollContainers.forEach(container => {
        if (needsScroll) {
          container.classList.remove('no-scroll');
        } else {
          container.classList.add('no-scroll');
        }
      });
    }
    
    // Initial check after layout is complete, and on resize
    // Use setTimeout to ensure DOM has been fully laid out
    setTimeout(updateShadowVisibility, 0);
    window.addEventListener('resize', updateShadowVisibility);
    
    allScrollContainers.forEach(container => {
      container.addEventListener('scroll', (e) => {
        // If sync lock is active, this is a programmatic scroll - ignore it
        if (syncLock) return;
        
        // Acquire lock to prevent feedback
        syncLock = true;
        
        const scrollLeft = e.target.scrollLeft;
        
        // Sync all other containers
        allScrollContainers.forEach(other => {
          if (other !== e.target) {
            other.scrollLeft = scrollLeft;
          }
        });
        
        // Release lock after scroll events have settled (use a short timeout)
        clearTimeout(syncTimeout);
        syncTimeout = setTimeout(() => {
          syncLock = false;
        }, 50);
        
        // Update shadow visibility based on scroll position
        updateShadowVisibility();
      }, { passive: true });
    });
    
    // Scroll to end if configured
    if (cfg.scrollToEnd) {
      // Use requestAnimationFrame to ensure DOM is ready
      requestAnimationFrame(() => {
        allScrollContainers.forEach(container => {
          container.scrollLeft = container.scrollWidth - container.clientWidth;
        });
        updateShadowVisibility();
      });
    }

    // Append to container if provided
    if (cfg.container) {
      const container = typeof cfg.container === 'string'
        ? document.querySelector(cfg.container)
        : cfg.container;
      if (container) {
        container.appendChild(mainContainer);
      }
    }

    return mainContainer;
  }

  // ============================================================================
  // PUBLIC API
  // ============================================================================

  return {
    createChart,
    aggregates,
    formatNumber,
    getWeek,
    getWeekStart,
    getMonthStart,
    getYearStart
  };

}));
