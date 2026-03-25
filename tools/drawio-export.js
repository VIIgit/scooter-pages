#!/usr/bin/env node
/**
 * drawio-export.js — Export business-interaction-data.js → .drawio
 *
 * Reads ENTITIES, ALL_CONNECTIONS, CONNECTION_PATHS and LABEL_ANCHOR from
 * the data file and produces a draw.io XML file that can be opened and
 * edited in the draw.io desktop app or web editor.
 *
 * Entity IDs and connection IDs are preserved as mxCell ids so the
 * import script can map them back deterministically.
 *
 * Usage:
 *   node tools/drawio-export.js [output.drawio]
 *
 * Default output: tools/business-interaction.drawio
 */
'use strict';

const fs   = require('fs');
const path = require('path');
const vm   = require('vm');

// ─── Load data ────────────────────────────────────────────────────────────────
const dataPath = path.resolve(__dirname, '..', 'components', 'business-interaction-data.js');
const code     = fs.readFileSync(dataPath, 'utf8');
const window   = {};
vm.runInNewContext(code, { window, console });
const DATA = window.BusinessInteractionData;

if (!DATA) {
  console.error('Failed to load BusinessInteractionData from', dataPath);
  process.exit(1);
}

// ─── XML helpers ──────────────────────────────────────────────────────────────
function escXml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Encode an SVG string for use as a data URI in draw.io image style. */
function svgDataUri(svgStr, strokeColor) {
  // Rewrite currentColor → entity color so the icon is visible in draw.io
  var colored = svgStr.replace(/currentColor/g, encodeURIComponent(strokeColor));
  return 'data:image/svg+xml,' + encodeURIComponent(colored);
}

// ─── Dimensions matching the real component ───────────────────────────────────
// The story.js component renders entities as:
//   - Icon box:  60 × 60  (border-radius 16px)
//   - Labels:    below the box, ~25px tall
// CONNECTION_PATHS connect to the edges of the 60×60 icon box,
// centered on (cx, cy).
const VIEWBOX_W   = 620;
const VIEWBOX_H   = 380;
const ICON_BOX    = 60;   // matches story.js icon box
const LABEL_H     = 25;   // approximate height for label + sublabel text
const NODE_W      = ICON_BOX;
const NODE_H      = ICON_BOX;

// ─── Build cells ──────────────────────────────────────────────────────────────
const cells = [
  '<mxCell id="0"/>',
  '<mxCell id="1" parent="0"/>',
];

// Background zones → non-connectable rounded rectangles behind everything
for (const z of DATA.BACKGROUND_ZONES) {
  // Use the entity's bg color so zones are visible on the draw.io canvas
  const entity = DATA.ENTITY_MAP[z.entity];
  const fillColor = entity ? entity.bg : '#f5f5f7';
  const zStyle = [
    'rounded=1',
    'arcSize=' + Math.round(z.rx / Math.min(z.width, z.height) * 100),
    'whiteSpace=wrap',
    'html=1',
    'fillColor=' + fillColor,
    'strokeColor=none',
    'opacity=60',
    'dataType=zone',
    'dataEntity=' + z.entity,
  ].join(';') + ';';

  cells.push(
    '    <mxCell id="' + escXml(z.id) + '"' +
    ' value=""' +
    ' style="' + escXml(zStyle) + '"' +
    ' vertex="1" connectable="0" parent="1">' +
    '<mxGeometry x="' + z.x + '" y="' + z.y +
    '" width="' + z.width + '" height="' + z.height +
    '" as="geometry"/>' +
    '</mxCell>'
  );
}

// Zone labels → non-connectable text
for (const zl of DATA.ZONE_LABELS) {
  const zlStyle = [
    'text',
    'html=1',
    'align=center',
    'verticalAlign=middle',
    'fontColor=#aeaeb2',
    'fontSize=9',
    'fontStyle=1',
    'letterSpacing=1.5',
    'dataType=zoneLabel',
  ].join(';') + ';';

  cells.push(
    '    <mxCell id="' + escXml(zl.id) + '"' +
    ' value="' + escXml(zl.label) + '"' +
    ' style="' + escXml(zlStyle) + '"' +
    ' vertex="1" connectable="0" parent="1">' +
    '<mxGeometry x="' + (zl.x - 60) + '" y="' + (zl.y - 10) +
    '" width="120" height="20"' +
    ' as="geometry"/>' +
    '</mxCell>'
  );
}

// Center ring → non-connectable circle
{
  const cr = DATA.CENTER_RING;
  const crStyle = [
    'ellipse',
    'whiteSpace=wrap',
    'html=1',
    'fillColor=none',
    'strokeColor=#d1d1d6',
    'strokeWidth=1',
    'dashed=1',
    'dashPattern=4 4',
    'opacity=50',
    'dataType=centerRing',
  ].join(';') + ';';

  cells.push(
    '    <mxCell id="' + escXml(cr.id) + '"' +
    ' value=""' +
    ' style="' + escXml(crStyle) + '"' +
    ' vertex="1" connectable="0" parent="1">' +
    '<mxGeometry x="' + (cr.cx - cr.r) + '" y="' + (cr.cy - cr.r) +
    '" width="' + (cr.r * 2) + '" height="' + (cr.r * 2) +
    '" as="geometry"/>' +
    '</mxCell>'
  );
}

// Entities → group of icon box + icon image overlay + label
for (const e of DATA.ENTITIES) {
  // The icon box: positioned so that (cx, cy) is its center
  const x = e.cx - NODE_W / 2;
  const y = e.cy - NODE_H / 2;

  // 1) Icon box (rounded rectangle)
  const boxStyle = [
    'rounded=1',
    'arcSize=50',
    'aspect=fixed',
    'whiteSpace=wrap',
    'html=1',
    'fillColor=' + e.bg,
    'strokeColor=' + e.color,
    'fontColor=' + e.color,
    'fontStyle=1',
    'fontSize=11',
    'verticalAlign=bottom',
    'spacingBottom=2',
    // Preserve metadata for round-trip
    'dataType=entity',
    'dataIcon=' + e.icon,
    'dataBg=' + e.bg,
  ].join(';') + ';';

  cells.push(
    '    <mxCell id="' + escXml(e.id) + '"' +
    ' value=""' +
    ' style="' + escXml(boxStyle) + '"' +
    ' vertex="1" parent="1">' +
    '<mxGeometry x="' + x + '" y="' + y +
    '" width="' + NODE_W + '" height="' + NODE_H +
    '" as="geometry"/>' +
    '</mxCell>'
  );

  // 2) Icon/image overlay (centered inside the box)
  // Prefer entity.image (PNG) over the SVG icon when available
  if (e.image) {
    var imgSize = 48;  // larger than SVG icon for better PNG visibility
    var imgStyle = [
      'shape=image',
      'verticalLabelPosition=bottom',
      'labelBackgroundColor=none',
      'imageBackgroundColor=none',
      'imageBorder=none',
      'image=' + e.image,
      'imageWidth=' + imgSize,
      'imageHeight=' + imgSize,
      'dataType=icon',
    ].join(';') + ';';

    var imgX = (NODE_W - imgSize) / 2;
    var imgY = (NODE_H - imgSize) / 2;

    cells.push(
      '    <mxCell id="' + escXml(e.id) + '-icon"' +
      ' value=""' +
      ' style="' + escXml(imgStyle) + '"' +
      ' vertex="1" connectable="0" parent="' + escXml(e.id) + '">' +
      '<mxGeometry x="' + imgX + '" y="' + imgY +
      '" width="' + imgSize + '" height="' + imgSize +
      '" as="geometry"/>' +
      '</mxCell>'
    );
  } else {
  var iconSvg = DATA.ICONS[e.icon];
  if (iconSvg) {
    var iconSize = 24;  // matches story.js iconSvg(name, 24)
    var iconStyle = [
      'shape=image',
      'verticalLabelPosition=bottom',
      'labelBackgroundColor=none',
      'imageBackgroundColor=none',
      'imageBorder=none',
      'image=' + svgDataUri(iconSvg, e.color),
      'imageWidth=' + iconSize,
      'imageHeight=' + iconSize,
      'dataType=icon',
    ].join(';') + ';';

    var iconX = (NODE_W - iconSize) / 2;
    var iconY = (NODE_H - iconSize) / 2;

    cells.push(
      '    <mxCell id="' + escXml(e.id) + '-icon"' +
      ' value=""' +
      ' style="' + escXml(iconStyle) + '"' +
      ' vertex="1" connectable="0" parent="' + escXml(e.id) + '">' +
      '<mxGeometry x="' + iconX + '" y="' + iconY +
      '" width="' + iconSize + '" height="' + iconSize +
      '" as="geometry"/>' +
      '</mxCell>'
    );
  }
  }

  // 3) Label below the icon box
  var labelStyle = [
    'text',
    'html=1',
    'align=center',
    'verticalAlign=top',
    'fontColor=#1d1d1f',
    'fontSize=11',
    'fontStyle=1',
    'whiteSpace=wrap',
    'dataType=label',
  ].join(';') + ';';

  var labelValue = escXml(e.label) + '&lt;br&gt;&lt;span style=&quot;font-size:10px;color:#aeaeb2;font-weight:normal&quot;&gt;' + escXml(e.sublabel) + '&lt;/span&gt;';

  cells.push(
    '    <mxCell id="' + escXml(e.id) + '-label"' +
    ' value="' + labelValue + '"' +
    ' style="' + escXml(labelStyle) + '"' +
    ' vertex="1" connectable="0" parent="' + escXml(e.id) + '">' +
    '<mxGeometry y="' + NODE_H + '"' +
    ' width="' + Math.max(NODE_W, 88) + '" height="' + LABEL_H +
    '" as="geometry"/>' +
    '</mxCell>'
  );
}

// Connections → edges
// Compute exitX/exitY and entryX/entryY from the SVG path coordinates so that
// draw.io renders the connection endpoints at the exact same positions as the
// original SVG diagram. Without these, draw.io auto-routes to the nearest edge
// which doesn't match the hand-crafted paths.
function clamp01(v) { return Math.max(0, Math.min(1, v)); }

for (const c of DATA.ALL_CONNECTIONS) {
  const fromE = DATA.ENTITY_MAP[c.from];
  const toE   = DATA.ENTITY_MAP[c.to];
  const color  = fromE ? fromE.color : '#666666';
  const pathD  = DATA.CONNECTION_PATHS[c.id] || '';
  const anchor = DATA.LABEL_ANCHOR[c.id] || [];

  // Parse path start and end coordinates
  const nums = pathD.match(/-?\d+(?:\.\d+)?/g);
  const exitEntryStyle = [];
  if (nums && nums.length >= 4 && fromE && toE) {
    const sx = Number(nums[0]), sy = Number(nums[1]);
    const isCurved = pathD.indexOf('Q') !== -1;
    const ex = Number(nums[isCurved ? 4 : 2]), ey = Number(nums[isCurved ? 5 : 3]);

    // exit/entry are 0–1 fractions relative to the cell geometry (top-left origin)
    const fromX = fromE.cx - NODE_W / 2, fromY = fromE.cy - NODE_H / 2;
    const toX   = toE.cx   - NODE_W / 2, toY   = toE.cy   - NODE_H / 2;

    exitEntryStyle.push(
      'exitX='  + clamp01((sx - fromX) / NODE_W).toFixed(3),
      'exitY='  + clamp01((sy - fromY) / NODE_H).toFixed(3),
      'exitDx=0', 'exitDy=0', 'exitPerimeter=0',
      'entryX=' + clamp01((ex - toX) / NODE_W).toFixed(3),
      'entryY=' + clamp01((ey - toY) / NODE_H).toFixed(3),
      'entryDx=0', 'entryDy=0', 'entryPerimeter=0',
    );
  }

  const style = [
    'curved=1',
    c.bidir ? 'startArrow=classic' : 'startArrow=none',
    'endArrow=classic',
    'strokeColor=' + color,
    'strokeWidth=2',
    'fontColor=' + color,
    'fontSize=10',
    'labelPosition=center',
    'verticalLabelPosition=middle',
    'align=center',
    'verticalAlign=middle',
    ...exitEntryStyle,
    // Preserve metadata for round-trip
    'dataType=connection',
    'dataBidir=' + (c.bidir ? '1' : '0'),
    'dataPathD=' + encodeURIComponent(pathD),
    'dataLabelAnchor=' + anchor.join(','),
  ].join(';') + ';';

  // For curved paths, export the control point as a waypoint so draw.io
  // renders the curve through the correct intermediate point.
  let geoInner = '';
  if (nums && pathD.indexOf('Q') !== -1 && nums.length >= 6) {
    const cpx = Number(nums[2]), cpy = Number(nums[3]);
    geoInner = '<Array as="points"><mxPoint x="' + cpx + '" y="' + cpy + '"/></Array>';
  }

  cells.push(
    '    <mxCell id="' + escXml(c.id) + '"' +
    ' value="' + escXml(c.label) + '"' +
    ' style="' + escXml(style) + '"' +
    ' edge="1" source="' + escXml(c.from) +
    '" target="' + escXml(c.to) + '"' +
    ' parent="1">' +
    '<mxGeometry relative="1" as="geometry">' + geoInner + '</mxGeometry>' +
    '</mxCell>'
  );
}

// ─── Assemble XML ─────────────────────────────────────────────────────────────
const xml = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<mxGraphModel dx="0" dy="0" grid="1" gridSize="10"' +
  ' guides="1" tooltips="1" connect="1" arrows="1"' +
  ' fold="1" page="1" pageScale="1"' +
  ' pageWidth="' + VIEWBOX_W + '" pageHeight="' + VIEWBOX_H + '"' +
  ' math="0" shadow="0">',
  '  <root>',
  ...cells,
  '  </root>',
  '</mxGraphModel>',
].join('\n');

// ─── Write output ─────────────────────────────────────────────────────────────
const outPath = process.argv[2] || path.resolve(__dirname, 'business-interaction.drawio');
fs.writeFileSync(outPath, xml, 'utf8');
console.log('Exported %d entities + %d connections → %s',
  DATA.ENTITIES.length, DATA.ALL_CONNECTIONS.length, outPath);
console.log('');
console.log('Open in draw.io, move nodes around, then run:');
console.log('  node tools/drawio-import.js');
