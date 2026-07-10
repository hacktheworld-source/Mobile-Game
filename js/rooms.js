// Room generation and door geometry for the run structure.
// Rooms form an endless linear chain: clear a room's enemy quota, a door on
// one wall opens, walk into it to advance to the next (harder) room.

export const DOOR_WIDTH = 104;
export const ROOM_HEAL = 15; // HP restored when a room is cleared

export const SIDES = ["top", "right", "bottom", "left"];

export function opposite(side) {
  return { top: "bottom", bottom: "top", left: "right", right: "left" }[side];
}

// Build the config for room `index` (1-based). `entrySide` is the wall the
// player walks in from (null for the first room); the exit is placed on a
// different wall so you always press forward.
export function makeRoom(index, entrySide) {
  const count = 3 + index; // total enemies to defeat this room
  const maxConcurrent = Math.min(3 + Math.floor(index / 2), 7);
  const spawnInterval = Math.max(0.4, 0.8 - index * 0.02);

  let choices = SIDES.filter((s) => s !== entrySide);
  const exitSide = choices[Math.floor(Math.random() * choices.length)];

  return {
    index,
    entrySide,
    exitSide,
    toSpawn: count,
    maxConcurrent,
    spawnInterval,
    cleared: false,
  };
}

// Rectangle covering the door opening on the arena border, plus its center.
export function doorRect(side, b, width = DOOR_WIDTH) {
  const t = 12; // visual thickness across the wall line
  const cx = b.x + b.w / 2;
  const cy = b.y + b.h / 2;
  switch (side) {
    case "right":
      return { x: b.x + b.w - t / 2, y: cy - width / 2, w: t, h: width, cx: b.x + b.w, cy };
    case "left":
      return { x: b.x - t / 2, y: cy - width / 2, w: t, h: width, cx: b.x, cy };
    case "top":
      return { x: cx - width / 2, y: b.y - t / 2, w: width, h: t, cx, cy: b.y };
    case "bottom":
    default:
      return { x: cx - width / 2, y: b.y + b.h - t / 2, w: width, h: t, cx, cy: b.y + b.h };
  }
}

// Where the player appears when entering a room from `side`.
export function entryPosition(side, b, radius) {
  const inset = radius + 34;
  const cx = b.x + b.w / 2;
  const cy = b.y + b.h / 2;
  switch (side) {
    case "right":
      return { x: b.x + b.w - inset, y: cy };
    case "left":
      return { x: b.x + inset, y: cy };
    case "top":
      return { x: cx, y: b.y + inset };
    case "bottom":
      return { x: cx, y: b.y + b.h - inset };
    default:
      return { x: cx, y: cy };
  }
}

// Is the player standing in the open doorway on the exit wall?
export function atDoor(player, side, b, width = DOOR_WIDTH) {
  const reach = player.radius + 16;
  const halfW = width / 2;
  switch (side) {
    case "right":
      return player.x > b.x + b.w - reach && Math.abs(player.y - (b.y + b.h / 2)) < halfW;
    case "left":
      return player.x < b.x + reach && Math.abs(player.y - (b.y + b.h / 2)) < halfW;
    case "top":
      return player.y < b.y + reach && Math.abs(player.x - (b.x + b.w / 2)) < halfW;
    case "bottom":
      return player.y > b.y + b.h - reach && Math.abs(player.x - (b.x + b.w / 2)) < halfW;
    default:
      return false;
  }
}
