// The world of EMBERFALL: 20 hand-authored overworld screens (5x4 grid) plus
// the Hollow Barrow dungeon (6 rooms). See docs/GDD.md §4.
//
// Tile characters:  . grass   # wall   ~ water   t tree/pillar   - path   m mud
//
// AUTHORING RULES (enforced at load):
//  - Author every screen with a fully closed border. Doorway openings are
//    PUNCHED automatically where the world graph says a neighbor exists:
//    top/bottom at columns 5-6, left/right at rows 9-10. Misaligned doorways
//    are therefore impossible by construction.
//  - Dungeon rooms declare explicit `exits`; overworld screens use grid
//    adjacency. `doors` are walk-on teleporters (arches) that may be locked
//    behind a flag. `chests` pay out once (gold / item / flag / hearts).
//  - A validator flood-fills every screen and throws if any opening, door,
//    chest, npc, or enemy spawn is unreachable.

import { GRID_W, GRID_H } from "../engine/tilemap.js";

export const HOME_ID = "2,1";
export const HOME_SPAWN = { x: 5, y: 7 }; // tile coords; entities use tile centers

const W = "############"; // closed border row

export const SCREENS = {
  // ================= OVERWORLD row 0 (far north) =================
  "0,0": {
    name: "Deep Woods",
    enemies: [
      { x: 5, y: 4 },
      { x: 8, y: 12, type: "archer" },
      { x: 3, y: 17 },
      { x: 7, y: 7, type: "wraith" },
    ],
    chests: [{ id: "woods_gold", x: 10, y: 17, gold: 40 }],
    tiles: [
      W,
      "#tt.....tt.#",
      "#t.......t.#",
      "#...tt.....#",
      "#..........#",
      "#.tt....tt.#",
      "#.tt....tt.#",
      "#..........#",
      "#....tt....#",
      "#..........#",
      "#..........#",
      "#.t......t.#",
      "#..........#",
      "#...tt.....#",
      "#..t...t...#",
      "#..........#",
      "#.t....tt..#",
      "#..........#",
      "#..........#",
      W,
    ],
  },
  "1,0": {
    name: "Wolf Den",
    enemies: [
      { x: 4, y: 5 },
      { x: 7, y: 12 },
      { x: 5, y: 9, type: "wraith" },
    ],
    tiles: [
      W,
      "#tt......tt#",
      "#t........t#",
      "#..t....t..#",
      "#..........#",
      "#....tt....#",
      "#...t..t...#",
      "#..........#",
      "#.t......t.#",
      "#..........#",
      "#..........#",
      "#.t......t.#",
      "#..........#",
      "#...t..t...#",
      "#....tt....#",
      "#..........#",
      "#..t....t..#",
      "#t........t#",
      "#tt......tt#",
      W,
    ],
  },
  "2,0": {
    name: "North Road",
    enemies: [
      { x: 3, y: 5, type: "charger" },
      { x: 8, y: 13 },
    ],
    tiles: [
      W,
      "#..t....t..#",
      "#....--....#",
      "#.t..--..t.#",
      "#....--....#",
      "#....--....#",
      "#.t..--...t#",
      "#....--....#",
      "#....--....#",
      "#----------#",
      "#----------#",
      "#....--....#",
      "#.t..--..t.#",
      "#....--....#",
      "#....--....#",
      "#.t..--.t..#",
      "#....--....#",
      "#....--....#",
      "#....--....#",
      W,
    ],
  },
  "3,0": {
    name: "Old Ruins",
    enemies: [
      { x: 6, y: 4, type: "archer" },
      { x: 3, y: 12 },
      { x: 8, y: 15, type: "archer" },
    ],
    chests: [{ id: "ruins_jerkin", x: 9, y: 3, item: "leather_jerkin" }],
    tiles: [
      W,
      "#..........#",
      "#.##..###..#",
      "#.#.....#..#",
      "#..........#",
      "#...##.....#",
      "#...#......#",
      "#......##..#",
      "#..........#",
      "#..........#",
      "#..........#",
      "#..##......#",
      "#..........#",
      "#....###...#",
      "#....#.....#",
      "#..........#",
      "#.##....#..#",
      "#..........#",
      "#..........#",
      W,
    ],
  },
  "4,0": {
    name: "Barrow Approach",
    enemies: [
      { x: 3, y: 5, type: "archer" },
      { x: 8, y: 8, type: "bomber" },
      { x: 5, y: 14 },
    ],
    tiles: [
      W,
      "#..........#",
      "#.#..#..#..#",
      "#..........#",
      "#..#..#..#.#",
      "#..........#",
      "#.#..#..#..#",
      "#..........#",
      "#..........#",
      "#..........#",
      "#..........#",
      "#..#..#..#.#",
      "#..........#",
      "#.#..#..#..#",
      "#..........#",
      "#..#..#..#.#",
      "#..........#",
      "#..........#",
      "#..........#",
      W,
    ],
  },

  // ================= OVERWORLD row 1 (home latitude) =================
  "0,1": {
    name: "Westwood",
    enemies: [
      { x: 6, y: 6 },
      { x: 4, y: 13, type: "archer" },
    ],
    tiles: [
      W,
      "#..........#",
      "#.t...t....#",
      "#.....t....#",
      "#..tt......#",
      "#......t...#",
      "#.t........#",
      "#....tt....#",
      "#..........#",
      "#..........#",
      "#..........#",
      "#...t......#",
      "#.t....t...#",
      "#..........#",
      "#....t.....#",
      "#.tt.....t.#",
      "#..........#",
      "#..........#",
      "#..........#",
      W,
    ],
  },
  "1,1": {
    name: "Hunter's Rest",
    enemies: [
      { x: 7, y: 14 },
      { x: 3, y: 15, type: "archer" },
    ],
    chests: [{ id: "hunters_gold", x: 8, y: 16, gold: 30 }],
    tiles: [
      W,
      "#..........#",
      "#.tt.......#",
      "#.tt....##.#",
      "#........#.#",
      "#..........#",
      "#....--....#",
      "#....--....#",
      "#..........#",
      "#..........#",
      "#..........#",
      "#..........#",
      "#.t........#",
      "#......t...#",
      "#..........#",
      "#.....t....#",
      "#..t.......#",
      "#..........#",
      "#..........#",
      W,
    ],
  },
  "2,1": {
    name: "Emberfall",
    safe: true,
    enemies: [],
    shop: { x: 2, y: 4 },
    npcs: [{ x: 8, y: 7, name: "Elder Maren", color: "#e8b04d", dialogue: "maren" }],
    tiles: [
      W,
      "#....--....#",
      "#.##.--.##.#",
      "#.##.--.##.#",
      "#....--....#",
      "#....--....#",
      "#....--....#",
      "#....--....#",
      "#....--....#",
      "#----------#",
      "#----------#",
      "#....--....#",
      "#....--....#",
      "#.##.--.##.#",
      "#.##.--.##.#",
      "#....--....#",
      "#....--....#",
      "#....--....#",
      "#....--....#",
      W,
    ],
  },
  "3,1": {
    name: "East Fields",
    enemies: [
      { x: 5, y: 5, type: "charger" },
      { x: 8, y: 11 },
      { x: 3, y: 16, type: "charger" },
    ],
    tiles: [
      W,
      "#..........#",
      "#..........#",
      "#...#......#",
      "#..........#",
      "#......#...#",
      "#..........#",
      "#..........#",
      "#..#.......#",
      "#..........#",
      "#..........#",
      "#..........#",
      "#.....#....#",
      "#..........#",
      "#..........#",
      "#..#....#..#",
      "#..........#",
      "#..........#",
      "#..........#",
      W,
    ],
  },
  "4,1": {
    name: "Barrow Gate",
    enemies: [
      { x: 3, y: 8, type: "knight" },
      { x: 8, y: 12, type: "archer" },
    ],
    doors: [{ x: 5, y: 3, to: "d0", spawn: { x: 5, y: 15 }, name: "The Hollow Barrow" }],
    tiles: [
      W,
      "#..........#",
      "#...####...#",
      "#...#..#...#",
      "#..........#",
      "#..........#",
      "#.#......#.#",
      "#..........#",
      "#..........#",
      "#..........#",
      "#..........#",
      "#..........#",
      "#.#......#.#",
      "#..........#",
      "#..........#",
      "#..........#",
      "#..........#",
      "#..........#",
      "#..........#",
      W,
    ],
  },

  // ================= OVERWORLD row 2 =================
  "0,2": {
    name: "Riverbank",
    enemies: [
      { x: 7, y: 6, type: "archer" },
      { x: 6, y: 12 },
    ],
    chests: [{ id: "river_gold", x: 10, y: 13, gold: 60 }],
    tiles: [
      W,
      "#..........#",
      "#..........#",
      "#.t........#",
      "#..........#",
      "#~~........#",
      "#~~~.......#",
      "#~~~~......#",
      "#~~~.......#",
      "#~~........#",
      "#~~........#",
      "#~~~.......#",
      "#~~~~......#",
      "#~~~~~.....#",
      "#~~~~......#",
      "#~~~~..~...#",
      "#~~~~..~~..#",
      "#~~~~..~~~.#",
      "#~~~~..~~~.#",
      W,
    ],
  },
  "1,2": {
    name: "The Ford",
    enemies: [
      { x: 3, y: 8 },
      { x: 8, y: 10, type: "archer" },
    ],
    tiles: [
      W,
      "#..........#",
      "#..........#",
      "#~~~~..~~~~#",
      "#~~~~..~~~~#",
      "#~~~~..~~~~#",
      "#..........#",
      "#..........#",
      "#..........#",
      "#..........#",
      "#..........#",
      "#..........#",
      "#..........#",
      "#~~~..~~~~~#",
      "#~~~..~~~~~#",
      "#..........#",
      "#..........#",
      "#..........#",
      "#..........#",
      W,
    ],
  },
  "2,2": {
    name: "South Path",
    enemies: [
      { x: 8, y: 4 },
      { x: 3, y: 15, type: "charger" },
    ],
    tiles: [
      W,
      "#....--....#",
      "#....--....#",
      "#....--....#",
      "#....--....#",
      "#....--....#",
      "#~~..--....#",
      "#~~..--..~~#",
      "#....--....#",
      "#----------#",
      "#----------#",
      "#..........#",
      "#...~~~....#",
      "#..~~~~~...#",
      "#...~~~....#",
      "#..........#",
      "#.t......t.#",
      "#..........#",
      "#..........#",
      W,
    ],
  },
  "3,2": {
    name: "Sunken Field",
    enemies: [
      { x: 6, y: 5, type: "bomber" },
      { x: 3, y: 10 },
      { x: 8, y: 15, type: "charger" },
    ],
    tiles: [
      W,
      "#..........#",
      "#..mm......#",
      "#.mmmm.....#",
      "#..mm..~~..#",
      "#.......~..#",
      "#..........#",
      "#...~~.....#",
      "#..~~~~....#",
      "#...~~...m.#",
      "#........mm#",
      "#..........#",
      "#.mm.......#",
      "#.mmm...~~.#",
      "#..m.....~.#",
      "#..........#",
      "#.....mm...#",
      "#..........#",
      "#..........#",
      W,
    ],
  },
  "4,2": {
    name: "Salt Marsh",
    enemies: [
      { x: 6, y: 4, type: "wraith" },
      { x: 3, y: 10, type: "bomber" },
      { x: 8, y: 13, type: "archer" },
    ],
    theme: "marsh",
    tiles: [
      W,
      "#..m~~.....#",
      "#..m~~~....#",
      "#...m~~....#",
      "#....m.....#",
      "#~~........#",
      "#~~~....m..#",
      "#.m....mm..#",
      "#......m~~.#",
      "#.......~~.#",
      "#..........#",
      "#..~~......#",
      "#..~~~.....#",
      "#...m......#",
      "#......~~..#",
      "#..m..~~~..#",
      "#..mm..m...#",
      "#..........#",
      "#..........#",
      W,
    ],
  },

  // ================= OVERWORLD row 3 (far south) =================
  "0,3": {
    name: "Black Mire",
    enemies: [
      { x: 6, y: 9, type: "charger" },
      { x: 3, y: 10, type: "wraith" },
      { x: 8, y: 14 },
    ],
    theme: "marsh",
    tiles: [
      W,
      "#tt.mm.....#",
      "#t..mmm....#",
      "#..........#",
      "#...t..t...#",
      "#.m........#",
      "#.mm...mm..#",
      "#......mm..#",
      "#..t.......#",
      "#..........#",
      "#..........#",
      "#.....t....#",
      "#.mm.......#",
      "#.mmm..t...#",
      "#..........#",
      "#....mm....#",
      "#.t..mm..t.#",
      "#..........#",
      "#..........#",
      W,
    ],
  },
  "1,3": {
    name: "Deep Mire",
    enemies: [
      { x: 3, y: 6, type: "bomber" },
      { x: 8, y: 11, type: "bomber" },
      { x: 5, y: 13, type: "wraith" },
    ],
    theme: "marsh",
    tiles: [
      W,
      "#..~~~.....#",
      "#..~~~~....#",
      "#....~~....#",
      "#..........#",
      "#.m....m...#",
      "#.mm...mm..#",
      "#..........#",
      "#....~~~...#",
      "#..........#",
      "#..........#",
      "#....~~....#",
      "#.......m..#",
      "#..m....mm.#",
      "#..........#",
      "#..~~......#",
      "#..~~~.....#",
      "#...~......#",
      "#..........#",
      W,
    ],
  },
  "2,3": {
    name: "Forgotten Shore",
    enemies: [
      { x: 3, y: 2 },
      { x: 2, y: 10, type: "archer" },
      { x: 7, y: 17, type: "charger" },
    ],
    chests: [{ id: "shore_charm", x: 9, y: 16, item: "mana_charm" }],
    tiles: [
      W,
      "#..........#",
      "#..........#",
      "#.~~.......#",
      "#~~~~......#",
      "#~~~~~.....#",
      "#~~~~~.....#",
      "#~~~~......#",
      "#.~~~......#",
      "#..........#",
      "#..........#",
      "#..~~~.....#",
      "#.~~~~~....#",
      "#~~~~~~....#",
      "#~~~~~~~...#",
      "#..~~~~....#",
      "#...~~.....#",
      "#.t........#",
      "#..........#",
      W,
    ],
  },
  "3,3": {
    name: "Wreck Beach",
    enemies: [
      { x: 4, y: 6, type: "knight" },
      { x: 8, y: 9, type: "archer" },
      { x: 3, y: 12, type: "bomber" },
    ],
    chests: [{ id: "wreck_gold", x: 5, y: 13, gold: 80 }],
    tiles: [
      W,
      "#..........#",
      "#..#.......#",
      "#..##......#",
      "#..........#",
      "#......#...#",
      "#..........#",
      "#..........#",
      "#.#........#",
      "#..........#",
      "#..........#",
      "#.....##...#",
      "#......#...#",
      "#..........#",
      "#..........#",
      "#~~........#",
      "#~~~....~~~#",
      "#~~~~..~~~~#",
      "#~~~~~~~~~~#",
      W,
    ],
  },
  "4,3": {
    name: "Lighthouse Ruin",
    enemies: [
      { x: 5, y: 10, type: "knight" },
      { x: 2, y: 8, type: "wraith" },
      { x: 8, y: 15, type: "archer" },
    ],
    chests: [{ id: "lighthouse_bow", x: 5, y: 4, item: "war_bow" }],
    tiles: [
      W,
      "#..........#",
      "#...####...#",
      "#..##..##..#",
      "#..#....#..#",
      "#..#....#..#",
      "#..##..##..#",
      "#...#..#...#",
      "#..........#",
      "#..........#",
      "#..........#",
      "#..........#",
      "#..t...#...#",
      "#..........#",
      "#.#........#",
      "#..........#",
      "#....##....#",
      "#..........#",
      "#..........#",
      W,
    ],
  },

  // ================= THE HOLLOW BARROW (dungeon) =================
  d0: {
    name: "Barrow — Entry Hall",
    theme: "barrow",
    tier: 3,
    exits: { top: "d1" },
    doors: [{ x: 5, y: 17, to: "4,1", spawn: { x: 5, y: 5 }, name: "Barrow Gate" }],
    enemies: [
      { x: 3, y: 6 },
      { x: 8, y: 12 },
    ],
    tiles: [
      W,
      "#..........#",
      "#.t......t.#",
      "#..........#",
      "#..........#",
      "#.t......t.#",
      "#..........#",
      "#..........#",
      "#.t......t.#",
      "#..........#",
      "#..........#",
      "#.t......t.#",
      "#..........#",
      "#..........#",
      "#.t......t.#",
      "#..........#",
      "#..........#",
      "#..........#",
      "#..........#",
      W,
    ],
  },
  d1: {
    name: "Barrow — Crossroads",
    theme: "barrow",
    tier: 3,
    exits: { bottom: "d0", left: "d3", right: "d2" },
    doors: [
      {
        x: 5,
        y: 2,
        to: "d4",
        spawn: { x: 5, y: 15 },
        locked: "barrow_key",
        name: "Sealed Gate",
      },
    ],
    enemies: [
      { x: 3, y: 9, type: "archer" },
      { x: 8, y: 5 },
    ],
    tiles: [
      W,
      "#..........#",
      "#..........#",
      "#...#..#...#",
      "#..........#",
      "#..........#",
      "#.t......t.#",
      "#..........#",
      "#..........#",
      "#..........#",
      "#..........#",
      "#.t......t.#",
      "#..........#",
      "#..........#",
      "#....##....#",
      "#..........#",
      "#..........#",
      "#..........#",
      "#..........#",
      W,
    ],
  },
  d2: {
    name: "Barrow — Reliquary",
    theme: "barrow",
    tier: 3,
    exits: { left: "d1" },
    chests: [{ id: "barrow_key", x: 9, y: 10, flag: "barrow_key", flagName: "BARROW KEY" }],
    enemies: [
      { x: 3, y: 6, type: "bomber" },
      { x: 8, y: 8, type: "archer" },
      { x: 5, y: 15 },
    ],
    tiles: [
      W,
      "#..........#",
      "#.t..t..t..#",
      "#..........#",
      "#...####...#",
      "#..........#",
      "#..........#",
      "#.t......t.#",
      "#..........#",
      "#..........#",
      "#..........#",
      "#..........#",
      "#....##....#",
      "#..........#",
      "#.t......t.#",
      "#..........#",
      "#..t..t....#",
      "#..........#",
      "#..........#",
      W,
    ],
  },
  d3: {
    name: "Barrow — Flooded Vault",
    theme: "barrow",
    tier: 3,
    exits: { right: "d1" },
    chests: [{ id: "barrow_gold", x: 2, y: 10, gold: 120 }],
    enemies: [
      { x: 4, y: 7, type: "wraith" },
      { x: 7, y: 12, type: "wraith" },
    ],
    tiles: [
      W,
      "#..........#",
      "#..t....t..#",
      "#..........#",
      "#..........#",
      "#...~~~~...#",
      "#...~~~~...#",
      "#..........#",
      "#..........#",
      "#..........#",
      "#..........#",
      "#..........#",
      "#..t....t..#",
      "#..........#",
      "#..........#",
      "#..........#",
      "#..........#",
      "#..........#",
      "#..........#",
      W,
    ],
  },
  d4: {
    name: "Barrow — Gauntlet",
    theme: "barrow",
    tier: 3,
    exits: {},
    doors: [
      { x: 5, y: 17, to: "d1", spawn: { x: 5, y: 4 }, name: "Crossroads" },
      { x: 5, y: 2, to: "d5", spawn: { x: 5, y: 16 }, name: "The King's Rest" },
    ],
    chests: [{ id: "barrow_heart", x: 9, y: 2, hearts: 1 }],
    enemies: [
      { x: 3, y: 6, type: "knight" },
      { x: 8, y: 9, type: "knight" },
      { x: 5, y: 15 },
    ],
    tiles: [
      W,
      "#..........#",
      "#..........#",
      "#..........#",
      "#..#....#..#",
      "#..........#",
      "#.t......t.#",
      "#..........#",
      "#...#..#...#",
      "#..........#",
      "#..........#",
      "#...#..#...#",
      "#..........#",
      "#.t......t.#",
      "#..........#",
      "#..#....#..#",
      "#..........#",
      "#..........#",
      "#..........#",
      W,
    ],
  },
  d5: {
    name: "Barrow — King's Rest",
    theme: "barrow",
    tier: 3,
    exits: {},
    doors: [{ x: 5, y: 17, to: "d4", spawn: { x: 5, y: 4 }, name: "Gauntlet" }],
    enemies: [{ x: 5, y: 6, type: "boss_barrow_king", unlessFlag: "barrow_cleansed" }],
    tiles: [
      W,
      "#..........#",
      "#..........#",
      "#..........#",
      "#.t......t.#",
      "#..........#",
      "#..........#",
      "#..........#",
      "#..........#",
      "#..........#",
      "#..........#",
      "#..........#",
      "#..........#",
      "#..........#",
      "#..........#",
      "#.t......t.#",
      "#..........#",
      "#..........#",
      "#..........#",
      W,
    ],
  },
};

// ---------------------------------------------------------------------------
// World graph helpers + build-time processing
// ---------------------------------------------------------------------------

const DIRS = { left: [-1, 0], right: [1, 0], top: [0, -1], bottom: [0, 1] };

export function neighborOf(id, dir) {
  const s = SCREENS[id];
  if (!s) return null;
  if (s.exits) return s.exits[dir] || null; // dungeon rooms: explicit only
  const m = id.match(/^(\d+),(\d+)$/);
  if (!m) return null;
  const nid = `${+m[1] + DIRS[dir][0]},${+m[2] + DIRS[dir][1]}`;
  return SCREENS[nid] ? nid : null;
}

// Difficulty tier: authored on dungeon rooms; overworld = distance from home.
export function tierOf(id) {
  const s = SCREENS[id];
  if (s.safe) return 0;
  if (s.tier) return s.tier;
  const m = id.match(/^(\d+),(\d+)$/);
  const d = Math.abs(+m[1] - 2) + Math.abs(+m[2] - 1); // manhattan from home
  return Math.max(1, Math.min(3, d >= 4 ? 3 : d >= 2 ? 2 : 1));
}

// PUNCH doorway openings into the borders wherever a neighbor exists, and
// seal them where none does — alignment is guaranteed by construction.
for (const id of Object.keys(SCREENS)) {
  const s = SCREENS[id];
  const rows = s.tiles.map((r) => r.split(""));
  const setRow = (y, cols, ch) => cols.forEach((x) => (rows[y][x] = ch));
  setRow(0, [5, 6], neighborOf(id, "top") ? "." : "#");
  setRow(GRID_H - 1, [5, 6], neighborOf(id, "bottom") ? "." : "#");
  for (const y of [9, 10]) {
    rows[y][0] = neighborOf(id, "left") ? "." : "#";
    rows[y][GRID_W - 1] = neighborOf(id, "right") ? "." : "#";
  }
  s.tiles = rows.map((r) => r.join(""));
}

// ---------------------------------------------------------------------------
// Validation: shape, then flood-fill connectivity of everything that matters.
// ---------------------------------------------------------------------------

const WALKABLE = new Set([".", "-", "m"]);

for (const [id, s] of Object.entries(SCREENS)) {
  if (s.tiles.length !== GRID_H) throw new Error(`Screen ${id}: ${s.tiles.length} rows`);
  s.tiles.forEach((row, y) => {
    if (row.length !== GRID_W) throw new Error(`Screen ${id} row ${y}: ${row.length} chars`);
  });

  // Anchors that must all be mutually reachable on foot.
  const anchors = [];
  const at = (x, y) => s.tiles[y][x];
  for (const y of [0, GRID_H - 1])
    for (let x = 0; x < GRID_W; x++) if (WALKABLE.has(at(x, y))) anchors.push([x, y]);
  for (const x of [0, GRID_W - 1])
    for (let y = 0; y < GRID_H; y++) if (WALKABLE.has(at(x, y))) anchors.push([x, y]);
  for (const c of s.chests || []) anchors.push([c.x, c.y]);
  for (const d of s.doors || []) anchors.push([d.x, d.y]);
  for (const n of s.npcs || []) anchors.push([n.x, n.y]);
  for (const e of s.enemies || []) anchors.push([e.x, e.y]);
  if (s.shop) anchors.push([s.shop.x, s.shop.y]);
  if (id === HOME_ID) anchors.push([HOME_SPAWN.x, HOME_SPAWN.y]);
  if (anchors.length === 0) continue;

  for (const [ax, ay] of anchors) {
    if (!WALKABLE.has(at(ax, ay)))
      throw new Error(`Screen ${id} (${s.name}): anchor at ${ax},${ay} is '${at(ax, ay)}'`);
  }

  // Flood fill from the first anchor.
  const seen = new Set();
  const queue = [anchors[0]];
  seen.add(anchors[0][0] + "," + anchors[0][1]);
  while (queue.length) {
    const [x, y] = queue.pop();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx;
      const ny = y + dy;
      const k = nx + "," + ny;
      if (nx < 0 || ny < 0 || nx >= GRID_W || ny >= GRID_H || seen.has(k)) continue;
      if (!WALKABLE.has(at(nx, ny))) continue;
      seen.add(k);
      queue.push([nx, ny]);
    }
  }
  for (const [ax, ay] of anchors) {
    if (!seen.has(ax + "," + ay))
      throw new Error(`Screen ${id} (${s.name}): ${ax},${ay} unreachable from ${anchors[0]}`);
  }
}
