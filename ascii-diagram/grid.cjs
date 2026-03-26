#!/usr/bin/env node
/**
 * ASCII Diagram Grid Engine
 *
 * Programmatic character-grid for building perfectly aligned ASCII diagrams.
 * Used by the /ascii-diagram skill — can also be used standalone.
 *
 * Usage: node grid.js '<JSON spec>'
 *
 * Spec format:
 * {
 *   "style": "single" | "double" | "rounded" | "heavy",
 *   "boxes": [
 *     { "id": "a", "label": "Client", "x": 0, "y": 0 },
 *     { "id": "b", "label": "Server", "x": 20, "y": 0 }
 *   ],
 *   "arrows": [
 *     { "from": "a", "to": "b", "label": "HTTP" }
 *   ]
 * }
 *
 * Or use auto-layout:
 * {
 *   "direction": "horizontal" | "vertical",
 *   "boxes": [
 *     { "id": "a", "label": "Client" },
 *     { "id": "b", "label": "Server" },
 *     { "id": "c", "label": "Database" }
 *   ],
 *   "arrows": [
 *     { "from": "a", "to": "b", "label": "HTTP" },
 *     { "from": "b", "to": "c", "label": "SQL" }
 *   ]
 * }
 */

const STYLES = {
  single:  { tl: '+', tr: '+', bl: '+', br: '+', h: '-', v: '|', cross: '+' },
  double:  { tl: '╔', tr: '╗', bl: '╚', br: '╝', h: '═', v: '║', cross: '╬' },
  rounded: { tl: '╭', tr: '╮', bl: '╰', br: '╯', h: '─', v: '│', cross: '┼' },
  heavy:   { tl: '┏', tr: '┓', bl: '┗', br: '┛', h: '━', v: '┃', cross: '╋' },
};

class Grid {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.cells = Array.from({ length: h }, () => Array(w).fill(' '));
  }

  put(x, y, char) {
    if (x >= 0 && x < this.w && y >= 0 && y < this.h) {
      this.cells[y][x] = char;
    }
  }

  text(x, y, str) {
    for (let i = 0; i < str.length; i++) {
      this.put(x + i, y, str[i]);
    }
  }

  box(x, y, w, h, label, style = 'single') {
    const s = STYLES[style] || STYLES.single;

    // Corners
    this.put(x, y, s.tl);
    this.put(x + w - 1, y, s.tr);
    this.put(x, y + h - 1, s.bl);
    this.put(x + w - 1, y + h - 1, s.br);

    // Top and bottom borders
    for (let i = 1; i < w - 1; i++) {
      this.put(x + i, y, s.h);
      this.put(x + i, y + h - 1, s.h);
    }

    // Side borders
    for (let j = 1; j < h - 1; j++) {
      this.put(x, y + j, s.v);
      this.put(x + w - 1, y + j, s.v);
    }

    // Label (centered, supports multiline)
    const lines = label.split('\n');
    const startY = y + Math.floor((h - lines.length) / 2);
    for (let li = 0; li < lines.length; li++) {
      const line = lines[li];
      const startX = x + Math.floor((w - line.length) / 2);
      this.text(startX, startY + li, line);
    }

    return { x, y, w, h };
  }

  hArrow(x1, x2, y, label, labelY) {
    const dir = x2 > x1 ? 1 : -1;
    for (let x = x1; x !== x2; x += dir) {
      this.put(x, y, '-');
    }
    this.put(x2, y, dir > 0 ? '>' : '<');
    if (label) {
      const lx = Math.min(x1, x2) + Math.floor((Math.abs(x2 - x1) - label.length) / 2);
      const ly = labelY !== undefined ? labelY : y - 1;
      this.text(lx, ly, label);
    }
  }

  vArrow(x, y1, y2, label) {
    const dir = y2 > y1 ? 1 : -1;
    for (let y = y1; y !== y2; y += dir) {
      this.put(x, y, '|');
    }
    this.put(x, y2, dir > 0 ? 'v' : '^');
    if (label) {
      this.text(x + 2, Math.min(y1, y2) + Math.floor(Math.abs(y2 - y1) / 2), label);
    }
  }

  // Container box with a title in the top border
  container(x, y, w, h, title, style = 'single') {
    const s = STYLES[style] || STYLES.single;

    // Corners
    this.put(x, y, s.tl);
    this.put(x + w - 1, y, s.tr);
    this.put(x, y + h - 1, s.bl);
    this.put(x + w - 1, y + h - 1, s.br);

    // Top border with title
    const titleStr = `[ ${title} ]`;
    for (let i = 1; i < w - 1; i++) {
      this.put(x + i, y, s.h);
    }
    this.text(x + 2, y, titleStr);

    // Bottom border
    for (let i = 1; i < w - 1; i++) {
      this.put(x + i, y + h - 1, s.h);
    }

    // Sides
    for (let j = 1; j < h - 1; j++) {
      this.put(x, y + j, s.v);
      this.put(x + w - 1, y + j, s.v);
    }

    return { x, y, w, h };
  }

  render() {
    return this.cells.map(row => row.join('').trimEnd()).join('\n');
  }
}

function autoLayout(spec) {
  const style = spec.style || 'single';
  const dir = spec.direction || 'horizontal';
  const padding = 2;
  const arrowLen = spec.arrowLength || 6;

  // Calculate box dimensions
  const boxes = spec.boxes.map(b => {
    const lines = b.label.split('\n');
    const maxLineLen = Math.max(...lines.map(l => l.length));
    const w = Math.max(maxLineLen + 4, 8); // min width 8
    const h = lines.length + 2;
    return { ...b, w, h, lines };
  });

  // Auto-position if no explicit coordinates
  const needsLayout = boxes.some(b => b.x === undefined || b.y === undefined);

  // Check if any arrows have labels (need extra row for label above arrow)
  const hasArrowLabels = spec.arrows && spec.arrows.some(a => a.label);

  if (needsLayout) {
    if (dir === 'horizontal') {
      let curX = 0;
      const maxH = Math.max(...boxes.map(b => b.h));
      const yOffset = hasArrowLabels ? 1 : 0; // extra row for arrow labels
      boxes.forEach(b => {
        b.x = curX;
        b.y = yOffset + Math.floor((maxH - b.h) / 2); // vertically center
        curX += b.w + arrowLen;
      });
    } else {
      let curY = 0;
      const maxW = Math.max(...boxes.map(b => b.w));
      boxes.forEach(b => {
        b.x = Math.floor((maxW - b.w) / 2); // horizontally center
        b.y = curY;
        curY += b.h + 3; // gap for arrow + label
      });
    }
  }

  // Calculate grid size
  const totalW = Math.max(...boxes.map(b => b.x + b.w)) + padding;
  const totalH = Math.max(...boxes.map(b => b.y + b.h)) + padding;
  const grid = new Grid(totalW, totalH);

  // Index boxes by ID
  const boxMap = new Map();
  boxes.forEach(b => {
    const rect = grid.box(b.x, b.y, b.w, b.h, b.label, style);
    boxMap.set(b.id, { ...rect, ...b });
  });

  // Draw arrows
  if (spec.arrows) {
    spec.arrows.forEach(a => {
      const from = boxMap.get(a.from);
      const to = boxMap.get(a.to);
      if (!from || !to) return;

      if (dir === 'horizontal' || (from.y === to.y && from.x !== to.x)) {
        // Horizontal arrow
        const fromRight = from.x + from.w;
        const toLeft = to.x;
        const midY = from.y + Math.floor(from.h / 2);
        // Place label above the top of the boxes, not above the arrow
        const labelY = a.label ? Math.min(from.y, to.y) - 1 : undefined;
        grid.hArrow(fromRight, toLeft - 1, midY, a.label, labelY);
      } else {
        // Vertical arrow
        const fromBottom = from.y + from.h;
        const toTop = to.y;
        const midX = from.x + Math.floor(from.w / 2);
        grid.vArrow(midX, fromBottom, toTop - 1, a.label);
      }
    });
  }

  return grid.render();
}

// CLI entry point
if (require.main === module) {
  const input = process.argv[2];
  if (!input) {
    console.error('Usage: node grid.js \'<JSON spec>\'');
    console.error('  or pipe JSON: echo \'{"boxes":[...]}\' | node grid.js --stdin');
    process.exit(1);
  }

  let spec;
  if (input === '--stdin') {
    const fs = require('fs');
    spec = JSON.parse(fs.readFileSync('/dev/stdin', 'utf8'));
  } else {
    spec = JSON.parse(input);
  }

  console.log(autoLayout(spec));
}

module.exports = { Grid, autoLayout, STYLES };
