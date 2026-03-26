#!/usr/bin/env node
/**
 * ASCII Diagram Verifier
 *
 * Checks that an ASCII diagram has proper alignment:
 * - Box corners form closed rectangles (ASCII and Unicode)
 * - Vertical pipes in the same column align
 * - Arrows are unbroken (no gaps in dash runs)
 * - No mixed tabs/spaces
 *
 * Usage: node verify.cjs <file>
 *        echo "diagram" | node verify.cjs --stdin
 */

const fs = require('fs');

// Character sets for both ASCII and Unicode box-drawing
const CORNERS_ASCII = new Set(['+']);
const CORNERS_UNICODE = new Set(['╔', '╗', '╚', '╝', '╭', '╮', '╰', '╯', '┏', '┓', '┗', '┛', '┼', '╬', '╋']);
const H_BORDERS = new Set(['-', '=', '─', '═', '━']);
const V_BORDERS = new Set(['|', '│', '║', '┃']);
const ARROW_H = new Set(['-', '─', '━', '=', '═']);
const ARROW_HEAD_R = new Set(['>', '▶', '▸', '►']);
const ARROW_HEAD_L = new Set(['<', '◀', '◂', '◄']);
const ARROW_HEAD_D = new Set(['v', 'V', '▼', '▾']);
const ARROW_HEAD_U = new Set(['^', '▲', '▴']);

function isCorner(ch) { return CORNERS_ASCII.has(ch) || CORNERS_UNICODE.has(ch); }
function isHBorder(ch) { return H_BORDERS.has(ch); }
function isVBorder(ch) { return V_BORDERS.has(ch); }

function charAt(lines, x, y) {
  if (y < 0 || y >= lines.length) return '';
  if (x < 0 || x >= lines[y].length) return '';
  return lines[y][x];
}

function verify(text) {
  const lines = text.split('\n');
  const issues = [];

  // Check 1: No tabs
  lines.forEach((line, i) => {
    if (line.includes('\t')) {
      issues.push({ line: i + 1, type: 'tab', msg: `Line ${i + 1} contains tab characters — use spaces only` });
    }
  });

  // Check 2: Find ALL corners (ASCII + Unicode) and verify connectivity
  const corners = [];
  lines.forEach((line, y) => {
    for (let x = 0; x < line.length; x++) {
      if (isCorner(line[x])) corners.push({ x, y, ch: line[x] });
    }
  });

  corners.forEach(({ x, y, ch }) => {
    const right = charAt(lines, x + 1, y);
    const left = charAt(lines, x - 1, y);
    const below = charAt(lines, x, y + 1);
    const above = charAt(lines, x, y - 1);

    const hasRight = isHBorder(right) || isCorner(right);
    const hasLeft = isHBorder(left) || isCorner(left);
    const hasBelow = isVBorder(below) || isCorner(below);
    const hasAbove = isVBorder(above) || isCorner(above);

    const connections = [hasRight, hasLeft, hasBelow, hasAbove].filter(Boolean).length;
    // 0 connections: likely a text character (e.g., "+ sealed"), not a corner — skip
    // 1 connection: probably a misaligned corner — flag it
    // For ASCII '+', also check if it's clearly text (surrounded by alphanumeric/space)
    if (connections === 1) {
      issues.push({
        line: y + 1, col: x + 1, type: 'corner',
        msg: `Corner '${ch}' at (${y + 1}:${x + 1}) only connects in 1 direction — may be misaligned`
      });
    } else if (connections === 0 && ch !== '+') {
      // Unicode corners with 0 connections are definitely misaligned
      issues.push({
        line: y + 1, col: x + 1, type: 'corner',
        msg: `Corner '${ch}' at (${y + 1}:${x + 1}) has no connections — misplaced or misaligned`
      });
    }
  });

  // Check 3: Vertical pipe alignment
  const pipeColumns = new Map();
  lines.forEach((line, y) => {
    for (let x = 0; x < line.length; x++) {
      if (isVBorder(line[x])) {
        if (!pipeColumns.has(x)) pipeColumns.set(x, []);
        pipeColumns.get(x).push(y);
      }
    }
  });

  pipeColumns.forEach((rows, col) => {
    rows.sort((a, b) => a - b);
    for (let i = 1; i < rows.length; i++) {
      const gap = rows[i] - rows[i - 1];
      if (gap === 2) {
        const gapRow = rows[i - 1] + 1;
        const gapChar = charAt(lines, col, gapRow);
        // Allow corners, arrow heads, and other connectors in gap
        if (gapChar === ' ') {
          issues.push({
            line: gapRow + 1, col: col + 1, type: 'broken-pipe',
            msg: `Vertical pipe at column ${col + 1} has gap at line ${gapRow + 1} — possible misalignment`
          });
        }
      }
    }
  });

  // Check 4: Arrow continuity — trace dash runs and check for internal gaps
  lines.forEach((line, y) => {
    // Find arrow heads and verify shaft
    for (let x = 0; x < line.length; x++) {
      if (ARROW_HEAD_R.has(line[x]) && x > 0) {
        if (!ARROW_H.has(line[x - 1])) {
          issues.push({
            line: y + 1, col: x + 1, type: 'arrow',
            msg: `Arrow head '${line[x]}' at (${y + 1}:${x + 1}) has no shaft to the left`
          });
        }
      }
      if (ARROW_HEAD_L.has(line[x]) && x + 1 < line.length) {
        if (!ARROW_H.has(line[x + 1])) {
          issues.push({
            line: y + 1, col: x + 1, type: 'arrow',
            msg: `Arrow head '${line[x]}' at (${y + 1}:${x + 1}) has no shaft to the right`
          });
        }
      }
    }

    // Find dash runs with internal gaps (e.g., "--- --->" is suspicious)
    // Look for pattern: dashes, space(s), dashes on same line between two box borders
    const dashGapPattern = /(-{2,})\s+(-{2,})/g;
    let match;
    while ((match = dashGapPattern.exec(line)) !== null) {
      const gapStart = match.index + match[1].length;
      const gapEnd = gapStart + match[0].length - match[1].length - match[2].length;
      issues.push({
        line: y + 1, col: gapStart + 1, type: 'broken-arrow',
        msg: `Possible broken arrow at (${y + 1}:${gapStart + 1}) — dash run has internal gap`
      });
    }
  });

  // Check 5: Vertical arrow continuity
  // Find v/^ arrow heads and verify they have pipe above/below
  // Skip characters that are part of words (e.g., 'v' in "Server", '^' in "car^et")
  const isWordChar = (ch) => /[a-zA-Z0-9_]/.test(ch);

  lines.forEach((line, y) => {
    for (let x = 0; x < line.length; x++) {
      if (ARROW_HEAD_D.has(line[x])) {
        // Skip if this character is part of a word
        const left = x > 0 ? line[x - 1] : '';
        const right = x + 1 < line.length ? line[x + 1] : '';
        if (isWordChar(left) || isWordChar(right)) continue;

        const above = charAt(lines, x, y - 1);
        if (!isVBorder(above) && above !== '+' && !isCorner(above)) {
          issues.push({
            line: y + 1, col: x + 1, type: 'arrow',
            msg: `Down arrow '${line[x]}' at (${y + 1}:${x + 1}) has no shaft above`
          });
        }
      }
      if (ARROW_HEAD_U.has(line[x])) {
        const left = x > 0 ? line[x - 1] : '';
        const right = x + 1 < line.length ? line[x + 1] : '';
        if (isWordChar(left) || isWordChar(right)) continue;

        const below = charAt(lines, x, y + 1);
        if (!isVBorder(below) && below !== '+' && !isCorner(below)) {
          issues.push({
            line: y + 1, col: x + 1, type: 'arrow',
            msg: `Up arrow '${line[x]}' at (${y + 1}:${x + 1}) has no shaft below`
          });
        }
      }
    }
  });

  return {
    valid: issues.length === 0,
    issues,
    stats: {
      lines: lines.length,
      maxWidth: Math.max(...lines.map(l => l.length)),
      corners: corners.length,
      pipeColumns: pipeColumns.size
    }
  };
}

// CLI entry point
if (require.main === module) {
  let input;
  const args = process.argv.slice(2);

  if (args.includes('--stdin')) {
    input = fs.readFileSync(process.stdin.fd, 'utf8');
  } else if (args.length > 0 && !args[0].startsWith('--')) {
    input = fs.readFileSync(args[0], 'utf8');
  } else {
    console.error('Usage: node verify.cjs <file> | node verify.cjs --stdin');
    process.exit(1);
  }

  const result = verify(input);
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.valid ? 0 : 1);
}

module.exports = { verify };
