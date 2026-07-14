// The world graph: overworld screens keyed by "x,y" (grid adjacency) and
// dungeon rooms keyed by "dN" (explicit exits). Doorway punching and
// validation happen in screens.js at load.

import { neighborOf } from "./screens.js";

export class World {
  constructor(screens) {
    this.screens = screens;
    this.currentId = null;
  }

  get current() {
    return this.screens[this.currentId] || null;
  }

  neighborId(dir) {
    return this.currentId ? neighborOf(this.currentId, dir) : null;
  }
}
