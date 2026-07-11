// Game: owns the current screen (tilemap + enemies), the world graph,
// screen-flip transitions, autosave, and rendering.
//
// All gameplay happens in a fixed logical space (LOGICAL_W x LOGICAL_H) that
// is scaled and letterboxed to the device in render().

import { Player, Enemy, PLAYER, ENEMY } from "./entities.js";
import { Input, consumeActions } from "./input.js";
import { TileMap, TILE_SIZE, LOGICAL_W, LOGICAL_H } from "./engine/tilemap.js";
import { writeSave } from "./engine/save.js";
import { World } from "./world/world.js";
import { SCREENS, HOME_ID, HOME_SPAWN } from "./world/screens.js";

const COLORS = {
  page: "#0e1016",
  player: "#4dd6a1",
  playerDodge: "#5aa9ff",
  enemy: "#ff5470",
  enemyFlash: "#ffffff",
  swing: "rgba(255,107,107,0.35)",
  accent: "#4dd6a1",
};

const TRANSITION_DUR = 0.5; // fade between screens
const EDGE_OUT = 6; // how far past the map edge the player's center must go
const EDGE_IN = PLAYER.radius + 8; // how far inside the new screen they appear
const AUTOSAVE_INTERVAL = 4; // seconds

const tileCenter = (t) => (t + 0.5) * TILE_SIZE;

export class Game {
  constructor(canvas, hud) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.hud = hud; // { areaEl, scoreEl, healthFill, attackBtn, dodgeBtn }
    this.state = "menu"; // menu | playing | transition | dead
    this.onGameOver = null;

    this.world = new World(SCREENS);
    this.map = null;
    this.maps = new Map(); // screenId -> TileMap cache
    this.player = null;
    this.enemies = [];
    this.kills = 0;

    this.bannerText = "";
    this.bannerTimer = 0;
    this.transitionTimer = 0;
    this.pendingDir = null;
    this.saveTimer = 0;

    this.resize();
    window.addEventListener("resize", () => this.resize());
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.dpr = dpr;
    this.viewW = window.innerWidth;
    this.viewH = window.innerHeight;
    this.canvas.width = Math.floor(this.viewW * dpr);
    this.canvas.height = Math.floor(this.viewH * dpr);
    // Scale the fixed logical space to fit, centered (letterboxed).
    this.scale = Math.min(this.viewW / LOGICAL_W, this.viewH / LOGICAL_H);
    this.offX = (this.viewW - LOGICAL_W * this.scale) / 2;
    this.offY = (this.viewH - LOGICAL_H * this.scale) / 2;
  }

  // ---------- run lifecycle ----------

  startNew() {
    this.player = new Player(tileCenter(HOME_SPAWN.x), tileCenter(HOME_SPAWN.y));
    this.kills = 0;
    this.enterScreen(HOME_ID);
    this.state = "playing";
    this.saveNow();
  }

  continueRun(save) {
    this.player = new Player(save.x, save.y);
    this.player.health = save.health ?? PLAYER.maxHealth;
    this.kills = save.kills || 0;
    const id = SCREENS[save.screenId] ? save.screenId : HOME_ID;
    this.enterScreen(id);
    this.state = "playing";
  }

  respawn() {
    this.player.health = PLAYER.maxHealth;
    this.player.alive = true;
    this.player.x = tileCenter(HOME_SPAWN.x);
    this.player.y = tileCenter(HOME_SPAWN.y);
    this.enterScreen(HOME_ID);
    this.state = "playing";
    this.saveNow();
  }

  enterScreen(id) {
    this.world.currentId = id;
    const screen = this.world.current;
    if (!this.maps.has(id)) this.maps.set(id, new TileMap(screen.tiles));
    this.map = this.maps.get(id);
    // Enemies are transient: they respawn each time you enter the screen.
    this.enemies = screen.safe
      ? []
      : screen.enemies.map((e) => new Enemy(tileCenter(e.x), tileCenter(e.y)));
    // Don't carry a mid-swing/mid-roll into a new screen.
    if (this.player) {
      this.player.attackTimer = 0;
      this.player.dodgeTimer = 0;
    }
    this.bannerText = screen.name;
    this.bannerTimer = 1.4;
    this.updateHud();
  }

  buildSave() {
    return {
      v: 1,
      screenId: this.world.currentId,
      x: this.player.x,
      y: this.player.y,
      health: this.player.health,
      kills: this.kills,
    };
  }

  saveNow() {
    if (this.player) writeSave(this.buildSave());
  }

  // ---------- update ----------

  update(dt) {
    if (this.state === "playing") this.updatePlaying(dt);
    else if (this.state === "transition") this.updateTransition(dt);
  }

  updatePlaying(dt) {
    this.bannerTimer = Math.max(0, this.bannerTimer - dt);

    if (Input.attackPressed) this.player.tryAttack();
    if (Input.dodgePressed) this.player.tryDodge(Input.moveX, Input.moveY);
    consumeActions();

    this.player.update(dt, Input.moveX, Input.moveY, this.map);

    // Walked off an edge through a doorway? Flip to the neighboring screen.
    const exitDir = this.edgeExitDir();
    if (exitDir) {
      const nid = this.world.neighborId(exitDir);
      if (nid) {
        this.beginTransition(exitDir);
        return;
      }
      // No neighbor (shouldn't happen with authored borders): push back in.
      this.player.x = Math.max(this.player.radius, Math.min(LOGICAL_W - this.player.radius, this.player.x));
      this.player.y = Math.max(this.player.radius, Math.min(LOGICAL_H - this.player.radius, this.player.y));
    }

    for (const e of this.enemies) {
      e.update(dt, this.player, this.map);

      if (this.player.isAttacking && !this.player.attackHitSet.has(e)) {
        if (this.player.hitsPoint(e.x, e.y)) {
          e.takeDamage(PLAYER.attackDamage, this.player.x, this.player.y);
          this.player.attackHitSet.add(e);
          if (!e.alive) this.kills += 1;
        }
      }

      const dist = Math.hypot(e.x - this.player.x, e.y - this.player.y);
      if (dist < e.radius + this.player.radius && e.hitCd <= 0) {
        this.player.takeDamage(ENEMY.contactDamage);
        e.hitCd = ENEMY.hitInterval;
      }
    }

    this.separateEnemies();
    this.enemies = this.enemies.filter((e) => e.alive);

    if (!this.player.alive) {
      this.state = "dead";
      if (this.onGameOver) this.onGameOver(this.kills);
      return;
    }

    this.saveTimer += dt;
    if (this.saveTimer >= AUTOSAVE_INTERVAL) {
      this.saveTimer = 0;
      this.saveNow();
    }

    this.updateHud();
  }

  edgeExitDir() {
    const p = this.player;
    if (p.x < -EDGE_OUT) return "left";
    if (p.x > LOGICAL_W + EDGE_OUT) return "right";
    if (p.y < -EDGE_OUT) return "top";
    if (p.y > LOGICAL_H + EDGE_OUT) return "bottom";
    return null;
  }

  beginTransition(dir) {
    this.state = "transition";
    this.pendingDir = dir;
    this.transitionTimer = TRANSITION_DUR;
    this.swapped = false;
  }

  updateTransition(dt) {
    this.transitionTimer = Math.max(0, this.transitionTimer - dt);
    const elapsedFrac = 1 - this.transitionTimer / TRANSITION_DUR;

    if (!this.swapped && elapsedFrac >= 0.5) {
      this.swapped = true;
      const dir = this.pendingDir;
      const nid = this.world.neighborId(dir);
      this.enterScreen(nid);
      // Enter from the opposite edge, preserving the cross-axis position.
      const p = this.player;
      if (dir === "left") p.x = LOGICAL_W - EDGE_IN;
      else if (dir === "right") p.x = EDGE_IN;
      else if (dir === "top") p.y = LOGICAL_H - EDGE_IN;
      else if (dir === "bottom") p.y = EDGE_IN;
      p.x = Math.max(p.radius, Math.min(LOGICAL_W - p.radius, p.x));
      p.y = Math.max(p.radius, Math.min(LOGICAL_H - p.radius, p.y));
    }

    if (this.transitionTimer <= 0) {
      this.state = "playing";
      this.saveNow();
    }
  }

  separateEnemies() {
    const arr = this.enemies;
    for (let i = 0; i < arr.length; i++) {
      for (let j = i + 1; j < arr.length; j++) {
        const a = arr[i];
        const b = arr[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = Math.hypot(dx, dy) || 1;
        const min = a.radius + b.radius;
        if (d < min) {
          const push = (min - d) / 2;
          const nx = dx / d;
          const ny = dy / d;
          a.x -= nx * push;
          a.y -= ny * push;
          b.x += nx * push;
          b.y += ny * push;
        }
      }
    }
  }

  updateHud() {
    if (!this.player) return;
    const screen = this.world.current;
    this.hud.areaEl.textContent = screen ? screen.name : "";
    this.hud.scoreEl.textContent = this.kills + (this.kills === 1 ? " kill" : " kills");
    const pct = (this.player.health / PLAYER.maxHealth) * 100;
    this.hud.healthFill.style.width = pct + "%";
    this.hud.attackBtn.classList.toggle("cooling", this.player.attackCd > 0);
    this.hud.dodgeBtn.classList.toggle("cooling", this.player.dodgeCd > 0);
  }

  // ---------- render ----------

  render() {
    const ctx = this.ctx;

    // Page background (letterbox bars).
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.fillStyle = COLORS.page;
    ctx.fillRect(0, 0, this.viewW, this.viewH);

    if (!this.map) return;

    // Enter the fixed logical space.
    const s = this.dpr * this.scale;
    ctx.setTransform(s, 0, 0, s, this.dpr * this.offX, this.dpr * this.offY);

    this.map.draw(ctx);

    if (this.state === "menu") return;

    for (const e of this.enemies) {
      ctx.fillStyle = e.flash > 0 ? COLORS.enemyFlash : COLORS.enemy;
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.radius, 0, Math.PI * 2);
      ctx.fill();
      if (e.health < ENEMY.maxHealth) {
        const w = e.radius * 2;
        ctx.fillStyle = "rgba(0,0,0,0.5)";
        ctx.fillRect(e.x - e.radius, e.y - e.radius - 8, w, 3);
        ctx.fillStyle = "#ffd166";
        ctx.fillRect(e.x - e.radius, e.y - e.radius - 8, w * (e.health / ENEMY.maxHealth), 3);
      }
    }

    this.renderPlayer(ctx);
    this.renderBanner(ctx);
    this.renderTransition(ctx);
  }

  renderPlayer(ctx) {
    const p = this.player;
    if (!p) return;

    if (p.isAttacking) {
      const t = p.attackTimer / PLAYER.attackDuration;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.facing);
      ctx.fillStyle = COLORS.swing;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, PLAYER.attackRange, -PLAYER.attackArc / 2, PLAYER.attackArc / 2);
      ctx.closePath();
      ctx.globalAlpha = 0.3 + 0.5 * t;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.restore();
    }

    ctx.fillStyle = p.isDodging ? COLORS.playerDodge : COLORS.player;
    if (p.isDodging) ctx.globalAlpha = 0.6;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    ctx.strokeStyle = "#0e1016";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(
      p.x + Math.cos(p.facing) * (p.radius + 6),
      p.y + Math.sin(p.facing) * (p.radius + 6)
    );
    ctx.stroke();
  }

  renderBanner(ctx) {
    if (this.bannerTimer <= 0) return;
    const alpha = Math.min(1, this.bannerTimer / 0.5);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.textAlign = "center";
    ctx.fillStyle = COLORS.accent;
    ctx.font = "800 26px -apple-system, system-ui, sans-serif";
    ctx.fillText(this.bannerText, LOGICAL_W / 2, 92);
    ctx.restore();
  }

  renderTransition(ctx) {
    if (this.state !== "transition") return;
    const elapsedFrac = 1 - this.transitionTimer / TRANSITION_DUR;
    // Triangle wave: 0 -> 1 -> 0, fully dark at the midpoint swap.
    const alpha = 1 - Math.abs(2 * elapsedFrac - 1);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = COLORS.page;
    ctx.fillRect(-2, -2, LOGICAL_W + 4, LOGICAL_H + 4);
    ctx.restore();
  }
}
