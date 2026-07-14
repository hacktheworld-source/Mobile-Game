// Tile engine: per-screen tile grid, collision, and shape-based rendering.
// The game runs in a FIXED logical space (GRID_W x GRID_H tiles at TILE_SIZE px)
// that gets scaled/letterboxed to the device, so all logic and save data are
// resolution-independent.

export const TILE_SIZE = 32;
export const GRID_W = 12;
export const GRID_H = 20;
export const LOGICAL_W = GRID_W * TILE_SIZE; // 384
export const LOGICAL_H = GRID_H * TILE_SIZE; // 640

export const TILE = {
  GRASS: 0,
  WALL: 1,
  WATER: 2,
  TREE: 3,
  PATH: 4,
  MUD: 5,
};

// Character map used by hand-authored screen data.
const CHAR_TILE = {
  ".": TILE.GRASS,
  "#": TILE.WALL,
  "~": TILE.WATER,
  t: TILE.TREE,
  "-": TILE.PATH,
  m: TILE.MUD,
};

const BLOCKING = new Set([TILE.WALL, TILE.WATER, TILE.TREE]);
// Projectiles fly over water but are stopped by walls and trees.
const PROJ_BLOCKING = new Set([TILE.WALL, TILE.TREE]);

// Shade variants per tile type per THEME, picked deterministically per-tile
// so the ground doesn't look flat. (Shapes-now: sprites drop in here later.)
const THEMES = {
  overworld: {
    [TILE.GRASS]: ["#17231d", "#192620", "#15211b"],
    [TILE.PATH]: ["#2b2820", "#2e2b23", "#292620"],
    [TILE.WALL]: ["#2b3247", "#2d3550", "#293043"],
    [TILE.WATER]: ["#10233a", "#0f2136", "#11253e"],
    [TILE.TREE]: ["#17231d", "#192620", "#15211b"],
    [TILE.MUD]: ["#241f16", "#272219", "#221d14"],
    canopy: "#1f3a28",
    canopyRim: "#142a1b",
  },
  marsh: {
    [TILE.GRASS]: ["#1a231a", "#1c261c", "#182118"],
    [TILE.PATH]: ["#282417", "#2b271a", "#252115"],
    [TILE.WALL]: ["#2b3140", "#2d3444", "#28303d"],
    [TILE.WATER]: ["#14282e", "#122529", "#152b31"],
    [TILE.TREE]: ["#1a231a", "#1c261c", "#182118"],
    [TILE.MUD]: ["#2a2318", "#2d261b", "#272015"],
    canopy: "#2a3d24",
    canopyRim: "#1b2a17",
  },
  barrow: {
    [TILE.GRASS]: ["#1c1a24", "#1e1c27", "#191721"], // dead stone floor
    [TILE.PATH]: ["#262133", "#282336", "#231f2f"],
    [TILE.WALL]: ["#3a3450", "#3d3755", "#37314b"],
    [TILE.WATER]: ["#141327", "#121125", "#16152b"],
    [TILE.TREE]: ["#1c1a24", "#1e1c27", "#191721"], // "tree" = broken pillar
    [TILE.MUD]: ["#211d29", "#241f2d", "#1f1b26"],
    canopy: "#453d5e",
    canopyRim: "#2d2740",
  },
};

export class TileMap {
  constructor(rows, theme = "overworld") {
    this.theme = THEMES[theme] ? theme : "overworld";
    if (rows.length !== GRID_H) {
      throw new Error(`TileMap: expected ${GRID_H} rows, got ${rows.length}`);
    }
    this.tiles = new Uint8Array(GRID_W * GRID_H);
    for (let y = 0; y < GRID_H; y++) {
      if (rows[y].length !== GRID_W) {
        throw new Error(`TileMap: row ${y} has ${rows[y].length} chars, expected ${GRID_W}`);
      }
      for (let x = 0; x < GRID_W; x++) {
        const t = CHAR_TILE[rows[y][x]];
        if (t === undefined) throw new Error(`TileMap: unknown char '${rows[y][x]}' at ${x},${y}`);
        this.tiles[y * GRID_W + x] = t;
      }
    }
  }

  typeAt(tx, ty) {
    if (tx < 0 || ty < 0 || tx >= GRID_W || ty >= GRID_H) return null;
    return this.tiles[ty * GRID_W + tx];
  }

  // Does a circle at (cx, cy) overlap any blocking tile? Out-of-map space is
  // NOT blocking — border walls in the data contain you, and doorway gaps let
  // you walk off the edge to trigger a screen transition.
  circleBlocked(cx, cy, r) {
    return this._blocked(cx, cy, r, BLOCKING);
  }

  // Walls and trees stop projectiles; water doesn't.
  projectileBlocked(cx, cy, r) {
    return this._blocked(cx, cy, r, PROJ_BLOCKING);
  }

  _blocked(cx, cy, r, blockSet) {
    const x0 = Math.floor((cx - r) / TILE_SIZE);
    const x1 = Math.floor((cx + r) / TILE_SIZE);
    const y0 = Math.floor((cy - r) / TILE_SIZE);
    const y1 = Math.floor((cy + r) / TILE_SIZE);
    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        if (tx < 0 || ty < 0 || tx >= GRID_W || ty >= GRID_H) continue;
        if (!blockSet.has(this.tiles[ty * GRID_W + tx])) continue;
        // Nearest point on the tile AABB to the circle center.
        const nx = Math.max(tx * TILE_SIZE, Math.min(cx, tx * TILE_SIZE + TILE_SIZE));
        const ny = Math.max(ty * TILE_SIZE, Math.min(cy, ty * TILE_SIZE + TILE_SIZE));
        const dx = cx - nx;
        const dy = cy - ny;
        if (dx * dx + dy * dy < r * r) return true;
      }
    }
    return false;
  }

  // Move a circle from (x0,y0) toward (x1,y1) with axis-separated collision
  // (slides along walls). Sub-stepped so fast moves (dodge) can't tunnel.
  moveCircle(x0, y0, x1, y1, r) {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / 8));
    let x = x0;
    let y = y0;
    for (let i = 0; i < steps; i++) {
      const sx = x + dx / steps;
      const sy = y + dy / steps;
      if (!this.circleBlocked(sx, y, r)) x = sx;
      if (!this.circleBlocked(x, sy, r)) y = sy;
    }
    return { x, y };
  }

  draw(ctx) {
    const ts = TILE_SIZE;
    const shades = THEMES[this.theme];
    const barrow = this.theme === "barrow";
    for (let ty = 0; ty < GRID_H; ty++) {
      for (let tx = 0; tx < GRID_W; tx++) {
        const t = this.tiles[ty * GRID_W + tx];
        const px = tx * ts;
        const py = ty * ts;
        ctx.fillStyle = shades[t][(tx * 7 + ty * 13) % 3];
        ctx.fillRect(px, py, ts, ts);

        if (t === TILE.WALL) {
          // A hint of depth: light top edge, dark bottom edge.
          ctx.fillStyle = "rgba(255,255,255,0.05)";
          ctx.fillRect(px, py, ts, 4);
          ctx.fillStyle = "rgba(0,0,0,0.28)";
          ctx.fillRect(px, py + ts - 5, ts, 5);
        } else if (t === TILE.WATER) {
          ctx.fillStyle = "rgba(140,190,255,0.07)";
          ctx.fillRect(px + 4, py + 8, ts - 8, 2);
          ctx.fillRect(px + 8, py + 21, ts - 14, 2);
        } else if (t === TILE.TREE) {
          if (barrow) {
            // Broken pillar instead of a tree.
            ctx.fillStyle = shades.canopy;
            ctx.fillRect(px + 7, py + 5, ts - 14, ts - 10);
            ctx.strokeStyle = shades.canopyRim;
            ctx.lineWidth = 2;
            ctx.strokeRect(px + 7, py + 5, ts - 14, ts - 10);
          } else {
            ctx.fillStyle = shades.canopy;
            ctx.beginPath();
            ctx.arc(px + ts / 2, py + ts / 2, 13, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = shades.canopyRim;
            ctx.lineWidth = 2;
            ctx.stroke();
          }
        } else if (t === TILE.MUD) {
          ctx.fillStyle = "rgba(0,0,0,0.16)";
          ctx.fillRect(px + 5, py + 9, 7, 3);
          ctx.fillRect(px + 17, py + 20, 8, 3);
        }
      }
    }
  }
}
