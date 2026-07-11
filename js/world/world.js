// The world graph: screens keyed by "x,y" grid coordinates. Walking off a
// screen edge moves you to the neighbor in that direction (screen-flip).

export const DIRS = {
  left: [-1, 0],
  right: [1, 0],
  top: [0, -1],
  bottom: [0, 1],
};

export class World {
  constructor(screens) {
    this.screens = screens;
    this.currentId = null;
  }

  get current() {
    return this.screens[this.currentId] || null;
  }

  neighborId(dir) {
    const d = DIRS[dir];
    if (!d || !this.currentId) return null;
    const [x, y] = this.currentId.split(",").map(Number);
    const nid = `${x + d[0]},${y + d[1]}`;
    return this.screens[nid] ? nid : null;
  }
}
