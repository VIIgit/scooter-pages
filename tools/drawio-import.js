#!/usr/bin/env node
/**
 * drawio-import.js — Import .drawio → business-interaction-data.js
 *
 * IMPORTANT: business-interaction-data.js is the MASTER source of truth.
 * This script NEVER adds or deletes elements — it only updates positional
 * properties (cx, cy, x, y, width, height, SVG paths) for items that
 * already exist in the data file. Any element missing from the .drawio
 * file is kept unchanged with a warning.
 *
 * Reads a draw.io XML file, extracts entity positions and connection
 * metadata using the stable IDs written by drawio-export.js, then
 * patches the ENTITIES, CONNECTION_PATHS and LABEL_ANCHOR sections
 * of business-interaction-data.js in-place.
 *
 * Uses a DELTA-based approach: the original hand-crafted SVG path
 * coordinates are preserved and only shifted by how much each entity
 * moved. This guarantees a no-op round-trip when nothing is moved
 * in draw.io.
 *
 * Zero external dependencies — uses a minimal regex-based XML parser
 * since the .drawio structure is predictable.
 *
 * Usage:
 *   node tools/drawio-import.js [input.drawio]
 *
 * Default input: tools/business-interaction.drawio
 */
'use strict';

const fs   = require('fs');
const path = require('path');
const vm   = require('vm');

// ─── Load current data (for reference / validation) ──────────────────────────
const dataPath = path.resolve(__dirname, '..', 'components', 'business-interaction-data.js');
const code     = fs.readFileSync(dataPath, 'utf8');
const window   = {};
vm.runInNewContext(code, { window, console });
const DATA = window.BusinessInteractionData;

if (!DATA) {
  console.error('Failed to load BusinessInteractionData from', dataPath);
  process.exit(1);
}

const knownEntityIds = new Set(DATA.ENTITIES.map(function (e) { return e.id; }));
const knownConnIds   = new Set(DATA.ALL_CONNECTIONS.map(function (c) { return c.id; }));

// Build a lookup of original entity positions
const origPos = {};
DATA.ENTITIES.forEach(function (e) { origPos[e.id] = { cx: e.cx, cy: e.cy }; });

// ─── Read .drawio XML ─────────────────────────────────────────────────────────
const drawioPath = process.argv[2] || path.resolve(__dirname, 'business-interaction.drawio');
if (!fs.existsSync(drawioPath)) {
  console.error('File not found: %s', drawioPath);
  console.error('Run  node tools/drawio-export.js  first.');
  process.exit(1);
}
const xml = fs.readFileSync(drawioPath, 'utf8');

// ─── Minimal XML attribute parser ─────────────────────────────────────────────
function parseAttrs(tag) {
  var attrs = {};
  var re = /(\w[\w\-]*)="([^"]*)"/g;
  var m;
  while ((m = re.exec(tag)) !== null) {
    attrs[m[1]] = m[2];
  }
  return attrs;
}

/** Parse draw.io semicolon-separated style string into key→value map. */
function parseStyle(styleStr) {
  var result = {};
  if (!styleStr) return result;
  styleStr.split(';').forEach(function (part) {
    var eq = part.indexOf('=');
    if (eq > 0) result[part.substring(0, eq).trim()] = part.substring(eq + 1).trim();
  });
  return result;
}

// draw.io wraps content in <mxfile><diagram>...</diagram></mxfile> and may
// keep multiple <diagram> sections (pages, undo history). The FIRST
// <diagram> is the actively-edited one; subsequent blocks are extra pages
// or the pre-edit snapshot.
var diagramBlocks = xml.match(/<diagram\b[\s\S]*?<\/diagram>/g);
var parseXml = diagramBlocks ? diagramBlocks[0] : xml;

// Extract all <mxCell ...> tags (may be self-closing or with children)
var cellRegex = /<mxCell\b([^>]*)(?:\/>|>([\s\S]*?)<\/mxCell>)/g;
var match;
var vertexCells = {};  // id → { x, y, w, h }
var edgeCells   = {};  // id → { source, target }
var zoneCells   = {};  // id → { x, y, w, h }
var zoneLabelCells = {}; // id → { x, y, w, h }
var centerRingCell = null; // { x, y, w, h }

while ((match = cellRegex.exec(parseXml)) !== null) {
  var outer   = match[0];
  var attrs   = parseAttrs(outer);
  var id      = attrs.id;
  if (!id) continue;

  // Parse nested <mxGeometry> if present
  var geoMatch = /<mxGeometry\b([^>]*)\/?>/i.exec(outer);
  var geo = geoMatch ? parseAttrs(geoMatch[0]) : {};

  var style = parseStyle(attrs.style || '');

  if (attrs.vertex === '1') {
    // Skip child cells (icon overlays, labels) — only process main entity boxes
    // Child cells have ids like "company-icon", "company-label" and use
    // parent-relative geometry that shouldn't be treated as absolute positions.
    if (id.match(/-icon$/) || id.match(/-label$/)) continue;

    // Route by dataType
    if (style.dataType === 'zone') {
      zoneCells[id] = {
        x: parseFloat(geo.x) || 0,
        y: parseFloat(geo.y) || 0,
        w: parseFloat(geo.width)  || 0,
        h: parseFloat(geo.height) || 0,
      };
    } else if (style.dataType === 'zoneLabel') {
      zoneLabelCells[id] = {
        x: parseFloat(geo.x) || 0,
        y: parseFloat(geo.y) || 0,
        w: parseFloat(geo.width)  || 120,
        h: parseFloat(geo.height) || 20,
      };
    } else if (style.dataType === 'centerRing') {
      centerRingCell = {
        x: parseFloat(geo.x) || 0,
        y: parseFloat(geo.y) || 0,
        w: parseFloat(geo.width)  || 0,
        h: parseFloat(geo.height) || 0,
      };
    } else {
      vertexCells[id] = {
        x: parseFloat(geo.x) || 0,
        y: parseFloat(geo.y) || 0,
        w: parseFloat(geo.width)  || 60,
        h: parseFloat(geo.height) || 60,
      };
    }
  }
  if (attrs.edge === '1') {
    edgeCells[id] = {
      source: attrs.source,
      target: attrs.target,
      exitX:  style.exitX  !== undefined ? parseFloat(style.exitX)  : null,
      exitY:  style.exitY  !== undefined ? parseFloat(style.exitY)  : null,
      entryX: style.entryX !== undefined ? parseFloat(style.entryX) : null,
      entryY: style.entryY !== undefined ? parseFloat(style.entryY) : null,
      waypoints: [],
    };
    // Extract intermediate waypoints from <Array as="points">
    var arrMatch = /<Array\b[^>]*as="points"[^>]*>([\s\S]*?)<\/Array>/i.exec(outer);
    if (arrMatch) {
      var wpRe = /<mxPoint\b([^>]*)\/?>/g;
      var wpM;
      while ((wpM = wpRe.exec(arrMatch[1])) !== null) {
        var wpa = parseAttrs(wpM[0]);
        edgeCells[id].waypoints.push({ x: parseFloat(wpa.x) || 0, y: parseFloat(wpa.y) || 0 });
      }
    }
  }
}

// ─── Validate ─────────────────────────────────────────────────────────────────
var warnings = [];
Object.keys(vertexCells).forEach(function (id) {
  if (!knownEntityIds.has(id)) {
    warnings.push('Unknown entity in .drawio: "' + id + '" — skipping');
  }
});
Object.keys(edgeCells).forEach(function (id) {
  if (!knownConnIds.has(id)) {
    warnings.push('Unknown connection in .drawio: "' + id + '" — skipping');
  }
});
knownEntityIds.forEach(function (id) {
  if (!vertexCells[id]) {
    warnings.push('Entity "' + id + '" missing in .drawio — keeping original position');
  }
});
knownConnIds.forEach(function (id) {
  if (!edgeCells[id]) {
    warnings.push('Connection "' + id + '" missing in .drawio — keeping original path');
  }
});
if (DATA.BACKGROUND_ZONES) {
  DATA.BACKGROUND_ZONES.forEach(function (z) {
    if (!zoneCells[z.id]) {
      warnings.push('Zone "' + z.id + '" missing in .drawio — keeping original geometry');
    }
  });
}
if (DATA.ZONE_LABELS) {
  DATA.ZONE_LABELS.forEach(function (zl) {
    if (!zoneLabelCells[zl.id]) {
      warnings.push('Zone label "' + zl.id + '" missing in .drawio — keeping original position');
    }
  });
}
if (DATA.CENTER_RING && !centerRingCell) {
  warnings.push('Center ring missing in .drawio — keeping original geometry');
}
if (warnings.length) {
  console.warn('Warnings (data file is master — nothing deleted):');
  warnings.forEach(function (w) { console.warn('  ⚠  ' + w); });
  console.warn('');
}

// ─── Compute updated positions + deltas ───────────────────────────────────────
var updatedEntities = {};
var deltas = {};

DATA.ENTITIES.forEach(function (e) {
  var cell = vertexCells[e.id];
  if (cell) {
    var newCx = Math.round(cell.x + cell.w / 2);
    var newCy = Math.round(cell.y + cell.h / 2);
    updatedEntities[e.id] = { cx: newCx, cy: newCy };
    deltas[e.id] = { dx: newCx - e.cx, dy: newCy - e.cy };
  } else {
    updatedEntities[e.id] = { cx: e.cx, cy: e.cy };
    deltas[e.id] = { dx: 0, dy: 0 };
  }
});

// ─── Update CONNECTION_PATHS ──────────────────────────────────────────────────
// Two modes:
// 1) If draw.io provides explicit exit/entry connection points on an edge
//    (set when the user drags a connection endpoint), compute the start/end
//    coordinates on the 60×60 entity box at the new center position.
// 2) Otherwise fall back to a delta-shift: the original hand-crafted SVG
//    path coordinates are shifted by how much each endpoint entity moved.
//
// Path format examples:
//   Line:  "M 279 174 L 111 94"          → 2 points: start (from), end (to)
//   Curve: "M 507 201 Q 310 372 113 302" → 3 points: start (from), ctrl, end (to)

var updatedPaths  = {};
var updatedLabels = {};
var BOX  = 60;       // 60×60 entity box — always, regardless of draw.io cell size
var HALF = BOX / 2;
var EXIT_ENTRY_EPS = 0.02; // tolerance for comparing exit/entry fractions

/** Clamp value to [0, 1] — mirrors the export's clamp01(). */
function clamp01(v) { return Math.max(0, Math.min(1, v)); }

/**
 * Compute the expected exitX/Y and entryX/Y from the original dataPathD
 * and entity positions. If the current values match (within epsilon), the
 * user didn't manually adjust the connection → use delta-shift instead of
 * recomputing from fractions (which introduces rounding errors).
 */
function exitEntryChanged(edge, pathD, fromE, toE) {
  if (!edge) return false;
  var nums = pathD.match(/-?\d+(?:\.\d+)?/g);
  if (!nums || nums.length < 4) return false;
  var isCurved = pathD.indexOf('Q') !== -1;
  var sx = Number(nums[0]), sy = Number(nums[1]);
  var ex = Number(nums[isCurved ? 4 : 2]), ey = Number(nums[isCurved ? 5 : 3]);

  var fromX = fromE.cx - HALF, fromY = fromE.cy - HALF;
  var toX   = toE.cx   - HALF, toY   = toE.cy   - HALF;

  var expectedExitX  = clamp01((sx - fromX) / BOX);
  var expectedExitY  = clamp01((sy - fromY) / BOX);
  var expectedEntryX = clamp01((ex - toX) / BOX);
  var expectedEntryY = clamp01((ey - toY) / BOX);

  var exitChanged  = edge.exitX  !== null &&
    (Math.abs(edge.exitX  - expectedExitX)  > EXIT_ENTRY_EPS ||
     Math.abs(edge.exitY  - expectedExitY)  > EXIT_ENTRY_EPS);
  var entryChanged = edge.entryX !== null &&
    (Math.abs(edge.entryX - expectedEntryX) > EXIT_ENTRY_EPS ||
     Math.abs(edge.entryY - expectedEntryY) > EXIT_ENTRY_EPS);

  return { exit: exitChanged, entry: entryChanged };
}

DATA.ALL_CONNECTIONS.forEach(function (c) {
  var pathD = DATA.CONNECTION_PATHS[c.id];
  var anchor = DATA.LABEL_ANCHOR[c.id];
  if (!pathD) return;

  var dFrom = deltas[c.from] || { dx: 0, dy: 0 };
  var dTo   = deltas[c.to]   || { dx: 0, dy: 0 };
  var edge  = edgeCells[c.id];
  var entityMoved = dFrom.dx !== 0 || dFrom.dy !== 0 || dTo.dx !== 0 || dTo.dy !== 0;

  // Check if the user actually repositioned connection endpoints in draw.io
  // by comparing current exit/entry with what we originally exported.
  var origFrom = origPos[c.from] || updatedEntities[c.from];
  var origTo   = origPos[c.to]   || updatedEntities[c.to];
  var changed  = exitEntryChanged(edge, pathD, origFrom, origTo);
  var exitUserChanged  = changed && changed.exit;
  var entryUserChanged = changed && changed.entry;

  // Nothing changed — keep original path and anchor
  if (!entityMoved && !exitUserChanged && !entryUserChanged) return;

  var nums     = pathD.match(/-?\d+(?:\.\d+)?/g).map(Number);
  var isCurved = pathD.indexOf('Q') !== -1;

  // ── Start point ───────────────────────────────────────────────────────────
  var sx, sy;
  if (exitUserChanged) {
    // User dragged the connection exit to a new position on the entity
    var fromPos = updatedEntities[c.from];
    sx = Math.round((fromPos.cx - HALF) + edge.exitX * BOX);
    sy = Math.round((fromPos.cy - HALF) + edge.exitY * BOX);
  } else {
    sx = nums[0] + dFrom.dx;
    sy = nums[1] + dFrom.dy;
  }

  // ── End point ─────────────────────────────────────────────────────────────
  var ex, ey;
  if (entryUserChanged) {
    // User dragged the connection entry to a new position on the entity
    var toPos = updatedEntities[c.to];
    ex = Math.round((toPos.cx - HALF) + edge.entryX * BOX);
    ey = Math.round((toPos.cy - HALF) + edge.entryY * BOX);
  } else {
    var endIdx = isCurved ? 4 : 2;
    ex = nums[endIdx] + dTo.dx;
    ey = nums[endIdx + 1] + dTo.dy;
  }

  // ── Build path ────────────────────────────────────────────────────────────
  if (isCurved && nums.length === 6) {
    // Control point: use first draw.io waypoint if it differs from original, else delta-shift
    var cpx, cpy;
    var origCpx = nums[2], origCpy = nums[3];
    if (edge && edge.waypoints && edge.waypoints.length > 0) {
      var wpx = Math.round(edge.waypoints[0].x);
      var wpy = Math.round(edge.waypoints[0].y);
      // Only use the waypoint if it actually changed from the exported value
      if (Math.abs(wpx - origCpx) > 1 || Math.abs(wpy - origCpy) > 1) {
        cpx = wpx;
        cpy = wpy;
      } else {
        var avgDx = Math.round((dFrom.dx + dTo.dx) / 2);
        var avgDy = Math.round((dFrom.dy + dTo.dy) / 2);
        cpx = origCpx + avgDx;
        cpy = origCpy + avgDy;
      }
    } else {
      var avgDx = Math.round((dFrom.dx + dTo.dx) / 2);
      var avgDy = Math.round((dFrom.dy + dTo.dy) / 2);
      cpx = origCpx + avgDx;
      cpy = origCpy + avgDy;
    }

    updatedPaths[c.id] = 'M ' + sx + ' ' + sy + ' Q ' + cpx + ' ' + cpy + ' ' + ex + ' ' + ey;
    updatedLabels[c.id] = [
      Math.round(0.25 * sx + 0.5 * cpx + 0.25 * ex),
      Math.round(0.25 * sy + 0.5 * cpy + 0.25 * ey),
    ];
  } else if (nums.length >= 4) {
    updatedPaths[c.id] = 'M ' + sx + ' ' + sy + ' L ' + ex + ' ' + ey;
    updatedLabels[c.id] = [
      Math.round((sx + ex) / 2),
      Math.round((sy + ey) / 2),
    ];
  }

  // Fallback label anchor
  if (!updatedLabels[c.id] && anchor) {
    var midDx = Math.round((dFrom.dx + dTo.dx) / 2);
    var midDy = Math.round((dFrom.dy + dTo.dy) / 2);
    updatedLabels[c.id] = [anchor[0] + midDx, anchor[1] + midDy];
  }
});

// ─── Patch business-interaction-data.js ───────────────────────────────────────
var source = fs.readFileSync(dataPath, 'utf8');

// 1) Patch ENTITIES — replace cx/cy values per entity line
DATA.ENTITIES.forEach(function (e) {
  var updated = updatedEntities[e.id];
  if (updated.cx === e.cx && updated.cy === e.cy) return; // no change

  // Match the entity line by its id string — handles both "cx: 310" and "cx:  80"
  var entityLineRe = new RegExp(
    "(\\{[^}]*id:\\s*'" + e.id + "'[^}]*?cx:\\s*)" +
    "\\d+" +
    "(\\s*,\\s*cy:\\s*)" +
    "\\d+"
  );
  source = source.replace(entityLineRe, function (m, pre, mid) {
    return pre + String(updated.cx).padStart(3) + mid + String(updated.cy).padStart(3);
  });
});

// 2) Patch CONNECTION_PATHS
Object.keys(updatedPaths).forEach(function (id) {
  var re = new RegExp(
    "('" + id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + "':\\s*')[^']+(')"
  );
  source = source.replace(re, '$1' + updatedPaths[id] + '$2');
});

// 3) Patch LABEL_ANCHOR
Object.keys(updatedLabels).forEach(function (id) {
  var re = new RegExp(
    "('" + id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + "':\\s*\\[)\\s*\\d+\\s*,\\s*\\d+\\s*(\\])"
  );
  source = source.replace(re, '$1' + updatedLabels[id][0] + ', ' + updatedLabels[id][1] + '$2');
});

// 4) Patch BACKGROUND_ZONES
var anyZoneChanged = false;
if (DATA.BACKGROUND_ZONES) {
  DATA.BACKGROUND_ZONES.forEach(function (z) {
    var cell = zoneCells[z.id];
    if (!cell) return;
    var nx = Math.round(cell.x), ny = Math.round(cell.y);
    var nw = Math.round(cell.w), nh = Math.round(cell.h);
    if (nx === z.x && ny === z.y && nw === z.width && nh === z.height) return;
    anyZoneChanged = true;
    // Match: { id: 'zone-consumer', x: 18, y: 20, width: 148, height: 340, rx: 20, entity: 'public' }
    var re = new RegExp(
      "(\\{[^}]*id:\\s*'" + z.id + "'[^}]*?x:\\s*)\\d+(\\s*,\\s*y:\\s*)\\d+" +
      "(\\s*,\\s*width:\\s*)\\d+(\\s*,\\s*height:\\s*)\\d+"
    );
    source = source.replace(re, function (m, pX, pY, pW, pH) {
      return pX + nx + pY + ny + pW + nw + pH + nh;
    });
  });
}

// 5) Patch ZONE_LABELS
var anyZoneLabelChanged = false;
if (DATA.ZONE_LABELS) {
  DATA.ZONE_LABELS.forEach(function (zl) {
    var cell = zoneLabelCells[zl.id];
    if (!cell) return;
    // Zone label center: the export offsets x by -60 and y by -10, so reverse:
    var nx = Math.round(cell.x + cell.w / 2);
    var ny = Math.round(cell.y + 10);
    if (nx === zl.x && ny === zl.y) return;
    anyZoneLabelChanged = true;
    var re = new RegExp(
      "(\\{[^}]*id:\\s*'" + zl.id + "'[^}]*?x:\\s*)\\d+(\\s*,\\s*y:\\s*)\\d+"
    );
    source = source.replace(re, function (m, pX, pY) {
      return pX + nx + pY + ny;
    });
  });
}

// 6) Patch CENTER_RING
var ringChanged = false;
if (DATA.CENTER_RING && centerRingCell) {
  var cr = DATA.CENTER_RING;
  var ncx = Math.round(centerRingCell.x + centerRingCell.w / 2);
  var ncy = Math.round(centerRingCell.y + centerRingCell.h / 2);
  var nr  = Math.round(centerRingCell.w / 2);
  if (ncx !== cr.cx || ncy !== cr.cy || nr !== cr.r) {
    ringChanged = true;
    var re = /(CENTER_RING\s*=\s*\{[^}]*?cx:\s*)\d+(\s*,\s*cy:\s*)\d+(\s*,\s*r:\s*)\d+/;
    source = source.replace(re, '$1' + ncx + '$2' + ncy + '$3' + nr);
  }
}

// ─── Write patched source ─────────────────────────────────────────────────────
fs.writeFileSync(dataPath, source, 'utf8');

// ─── Report ───────────────────────────────────────────────────────────────────
console.log('Imported from', drawioPath);
console.log('');

var anyEntityChanged = false;
console.log('Entity positions:');
DATA.ENTITIES.forEach(function (e) {
  var u = updatedEntities[e.id];
  var d = deltas[e.id];
  var changed = (d.dx !== 0 || d.dy !== 0);
  if (changed) anyEntityChanged = true;
  console.log('  %s: cx %d → %d, cy %d → %d%s',
    e.id, e.cx, u.cx, e.cy, u.cy, changed ? '  ← MOVED (dx:' + d.dx + ' dy:' + d.dy + ')' : '');
});

var anyChanged = anyEntityChanged || Object.keys(updatedPaths).length > 0 ||
                 anyZoneChanged || anyZoneLabelChanged || ringChanged;

if (anyZoneChanged) {
  console.log('');
  console.log('Updated zones:');
  DATA.BACKGROUND_ZONES.forEach(function (z) {
    var cell = zoneCells[z.id];
    if (cell) console.log('  %s: x=%d y=%d w=%d h=%d', z.id,
      Math.round(cell.x), Math.round(cell.y), Math.round(cell.w), Math.round(cell.h));
  });
}
if (anyZoneLabelChanged) {
  console.log('');
  console.log('Updated zone labels:');
  DATA.ZONE_LABELS.forEach(function (zl) {
    var cell = zoneLabelCells[zl.id];
    if (cell) console.log('  %s: x=%d y=%d', zl.id,
      Math.round(cell.x + cell.w / 2), Math.round(cell.y + 10));
  });
}
if (ringChanged) {
  console.log('');
  console.log('Updated center ring: cx=%d cy=%d r=%d',
    Math.round(centerRingCell.x + centerRingCell.w / 2),
    Math.round(centerRingCell.y + centerRingCell.h / 2),
    Math.round(centerRingCell.w / 2));
}

if (!anyChanged) {
  console.log('');
  console.log('No changes detected — data file unchanged.');
} else {
  if (Object.keys(updatedPaths).length > 0) {
    console.log('');
    console.log('Updated paths:');
    Object.keys(updatedPaths).forEach(function (id) {
      console.log('  %s: %s', id, updatedPaths[id]);
    });
  }
  console.log('');
  console.log('Patched:', dataPath);
}
