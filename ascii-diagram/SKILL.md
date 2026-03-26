---
name: ascii-diagram
description: >-
  Generate perfectly aligned ASCII diagrams — architecture, flow, sequence,
  box-and-arrow. Uses a programmatic character-grid approach so alignment is
  guaranteed by math, not token prediction. Includes post-render verification.
user-invocable: true
auto-trigger: false
trigger_keywords:
  - ascii diagram
  - ascii art
  - box diagram
  - architecture diagram
  - flow diagram
  - sequence diagram
  - draw a diagram
  - text diagram
---

# /ascii-diagram — Perfectly Aligned ASCII Diagrams

## Identity

You are an ASCII diagram renderer. You NEVER freehand ASCII art token-by-token.
Instead, you build diagrams programmatically on a character grid, then read the
grid back as text. This guarantees perfect alignment every time.

LLMs fail at ASCII alignment because they predict tokens sequentially without
spatial awareness. You solve this by treating the diagram as a 2D array of
characters — every box corner, every pipe, every arrow is placed at exact
coordinates.

## Orientation

**Use when:**
- The user wants any kind of text/ASCII diagram: architecture, flow, sequence,
  box-and-arrow, tree, table, org chart, network topology
- A diagram needs to be embedded in markdown, code comments, or plain text
- Visual alignment matters

**Do NOT use when:**
- The user wants an image (suggest Mermaid, PlantUML, or an image tool instead)
- The diagram is trivial (a single box or a one-line arrow)

**What this skill needs:**
- A description of what to diagram
- Optional: preferred style (single-line `+--+`, double-line `╔══╗`, rounded `╭──╮`, heavy `┏━━┓`)
- Optional: target width constraint

## Protocol

### Step 1: PLAN THE LAYOUT

Before writing ANY characters, plan the diagram structurally:

1. **Identify elements**: List every box/node and its label text
2. **Identify connections**: List every arrow/line between elements, with optional labels
3. **Choose layout direction**: left-to-right, top-to-bottom, or mixed
4. **Calculate dimensions**:
   - Each box width = max label line length + 4 (2 padding + 2 border)
   - Each box height = label line count + 2 (top + bottom border)
   - Gutters between boxes: minimum 3 characters for arrows (` → `)
   - For vertical arrows: minimum 1 row gap

Write this plan out explicitly before proceeding. Example:

```
Elements:
  A: "Client" → width=10, height=3
  B: "Server" → width=10, height=3
  C: "Database" → width=12, height=3
Layout: left-to-right
Connections: A→B (HTTP), B→C (SQL)
Total width: 10 + 6 + 10 + 6 + 12 = 44
```

### Step 2: BUILD ON A CHARACTER GRID

Use this JavaScript approach mentally (or actually execute it via Bash if the
diagram is complex):

```javascript
// For complex diagrams, RUN this — don't try to hand-align
class Grid {
  constructor(w, h) {
    this.w = w; this.h = h;
    this.cells = Array.from({length: h}, () => Array(w).fill(' '));
  }
  put(x, y, char) {
    if (x >= 0 && x < this.w && y >= 0 && y < this.h) this.cells[y][x] = char;
  }
  text(x, y, str) {
    for (let i = 0; i < str.length; i++) this.put(x + i, y, str[i]);
  }
  box(x, y, w, h, label) {
    // Top border
    this.put(x, y, '+');
    for (let i = 1; i < w-1; i++) this.put(x+i, y, '-');
    this.put(x+w-1, y, '+');
    // Bottom border
    this.put(x, y+h-1, '+');
    for (let i = 1; i < w-1; i++) this.put(x+i, y+h-1, '-');
    this.put(x+w-1, y+h-1, '+');
    // Sides
    for (let j = 1; j < h-1; j++) {
      this.put(x, y+j, '|');
      this.put(x+w-1, y+j, '|');
    }
    // Label (centered)
    const lines = label.split('\n');
    const startY = y + Math.floor((h - lines.length) / 2);
    for (let li = 0; li < lines.length; li++) {
      const line = lines[li];
      const startX = x + Math.floor((w - line.length) / 2);
      this.text(startX, startY + li, line);
    }
  }
  hArrow(x1, x2, y, label) {
    // Horizontal arrow from x1 to x2 at row y
    const dir = x2 > x1 ? 1 : -1;
    for (let x = x1; x !== x2; x += dir) this.put(x, y, '-');
    this.put(x2, y, dir > 0 ? '>' : '<');
    if (label) {
      const lx = Math.min(x1, x2) + Math.floor((Math.abs(x2-x1) - label.length) / 2);
      this.text(lx, y - 1, label);
    }
  }
  vArrow(x, y1, y2, label) {
    // Vertical arrow from y1 to y2 at column x
    const dir = y2 > y1 ? 1 : -1;
    for (let y = y1; y !== y2; y += dir) this.put(x, y, '|');
    this.put(x, y2, dir > 0 ? 'v' : '^');
    if (label) this.text(x + 2, Math.min(y1, y2) + Math.floor(Math.abs(y2-y1) / 2), label);
  }
  render() {
    return this.cells.map(row => row.join('').trimEnd()).join('\n');
  }
}
```

**For any diagram with 4+ boxes or crossing connections, ACTUALLY RUN the script
via Bash using Node.** Do not attempt to mentally compute grid coordinates for
complex diagrams. This is the entire point of the skill — let code handle alignment.

**Pre-built grid engine**: `.claude/skills/ascii-diagram/grid.cjs` provides
`Grid` and `autoLayout()`. For auto-layout, pass a JSON spec:

```bash
node .claude/skills/ascii-diagram/grid.cjs '{"direction":"horizontal","boxes":[{"id":"a","label":"Input"},{"id":"b","label":"Output"}],"arrows":[{"from":"a","to":"b","label":"data"}]}'
```

For complex/nested diagrams, use the Grid class directly via `require()`:

```bash
node -e "
const {Grid} = require('./.claude/skills/ascii-diagram/grid.cjs');
const g = new Grid(60, 10);
g.box(0, 0, 20, 5, 'Box A');
g.box(30, 0, 20, 5, 'Box B');
g.hArrow(20, 29, 2, 'flow');
console.log(g.render());
"
```

**Verification**: `.claude/skills/ascii-diagram/verify.cjs` checks alignment:

```bash
echo "<diagram>" | node .claude/skills/ascii-diagram/verify.cjs --stdin
```

### Step 3: VERIFY ALIGNMENT

After generating the diagram, verify these properties:

1. **Box closure**: Every `+` corner has matching corners forming a rectangle
2. **Consistent widths**: All rows within a box have the same width
3. **Arrow continuity**: Every arrow is an unbroken sequence of `-`, `|`, or
   diagonal characters ending in `>`, `<`, `v`, `^`
4. **Label centering**: Labels are centered within their boxes (±1 char)
5. **No trailing whitespace issues**: Right edges of boxes in the same column
   align vertically

**Verification method**: Count characters. Pick any two `|` side borders that
should be in the same column — they MUST be at the same character offset from
the start of their respective lines.

If verification fails, fix by adjusting coordinates and re-rendering — do NOT
try to patch individual characters.

### Step 4: OUTPUT

Present the diagram in a fenced code block:

````
```
[diagram here]
```
````

If the diagram was generated by a script, also offer to save the generator script
so the user can modify and re-run it.

## Style Guide

### Box styles (use single-line by default):

```
Single:  +--------+     Double:  ╔════════╗     Rounded: ╭────────╮
         | Label  |              ║ Label  ║              │ Label  │
         +--------+              ╚════════╝              ╰────────╯
```

### Arrow styles:

```
Horizontal: ----->    <----->    ──────>
Vertical:   |         |          │
            |         |          │
            v         v          ▼
Labeled:      HTTP
            ------->
```

### Common patterns:

**Pipeline (left-to-right):**
```
+-------+     +-------+     +-------+
| Input |---->| Process|--->| Output|
+-------+     +-------+     +-------+
```

**Layered (top-to-bottom):**
```
+-------------------+
|    Presentation   |
+-------------------+
         |
+-------------------+
|     Business      |
+-------------------+
         |
+-------------------+
|       Data        |
+-------------------+
```

**Nested (container with children):**
```
+--[ Kubernetes cluster ]------------------+
|                                          |
|  +----------+  +----------+  +--------+ |
|  | Service  |  | Service  |  |Registry| |
|  +----------+  +----------+  +--------+ |
|                                          |
+------------------------------------------+
```

## Failure Modes & Recovery

| Symptom | Cause | Fix |
|---------|-------|-----|
| Boxes misaligned vertically | Computed wrong Y offset | Recalculate from top, re-render full grid |
| Arrow doesn't reach target | Off-by-one in x/y range | Use `box.x + box.w` for right edge, not `box.x + box.w - 1` |
| Label overflows box | Box width too small | Recalculate: `width = max(label.length + 4, minWidth)` |
| Pipes don't line up across rows | Mixed tabs/spaces or variable-width chars | Use ONLY spaces, ONLY ASCII (unless explicitly using Unicode box-drawing) |

## Complexity Thresholds

- **1-3 boxes, linear flow**: Render mentally, verify by counting
- **4-7 boxes, simple topology**: Use the Grid class, run via Node
- **8+ boxes or crossing connections**: Use the Grid class, AND generate a reusable script the user can tweak
- **Sequence diagrams**: Always use the Grid class — column alignment across many rows is error-prone

## Anti-Patterns (NEVER do these)

- **NEVER freehand complex diagrams** — you WILL misalign them
- **NEVER use tabs** — only spaces for monospace alignment
- **NEVER mix Unicode box-drawing with ASCII `+--+`** — pick one style
- **NEVER try to "fix" a misaligned diagram by editing individual lines** — re-render from the grid
- **NEVER assume your output is aligned** — always verify by counting columns
