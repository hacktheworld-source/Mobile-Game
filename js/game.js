// Game world: owns the arena, player, enemies, room progression, collisions,
// and rendering.

import { Player, Enemy, PLAYER, ENEMY } from "./entities.js";
import { Input, consumeActions } from "./input.js";
import {
  makeRoom,
  opposite,
  doorRect,
  entryPosition,
  atDoor,
  DOOR_WIDTH,
  ROOM_HEAL,
} from "./rooms.js";

const COLORS = {
  arena: "#141824",
  arenaBorder: "#2a3146",
  grid: "rgba(255,255,255,0.03)",
  player: "#4dd6a1",
  playerDodge: "#5aa9ff",
  enemy: "#ff5470",
  enemyFlash: "#ffffff",
  swing: "rgba(255,107,107,0.35)",
  doorLocked: "#3a4158",
  doorOpen: "#4dd6a1",
  accent: "#4dd6a1",
};

const TRANSITION_DUR = 0.55; // seconds for the room-to-room fade

export class Game {
  constructor(canvas, hud) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.hud = hud; // { roomEl, scoreEl, healthFill, attackBtn, dodgeBtn }
    this.width = 0;
    this.height = 0;
    this.bounds = { x: 0, y: 0, w: 0, h: 0 };
    this.state = "menu"; // menu | playing | transition | dead
    this.onGameOver = null;

    this.resize();
    window.addEventListener("resize", () => this.resize());
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.canvas.width = Math.floor(this.width * dpr);
    this.canvas.height = Math.floor(this.height * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const pad = 8;
    this.bounds = { x: pad, y: pad, w: this.width - pad * 2, h: this.height - pad * 2 };
  }

  start() {
    this.player = new Player(this.width / 2, this.height / 2);
    this.enemies = [];
    this.kills = 0;
    this.roomIndex = 1;
    this.room = makeRoom(this.roomIndex, null);
    this.spawnTimer = 0.4;
    this.bannerTimer = 0;
    this.transitionTimer = 0;
    this.swapped = false;
    this.state = "playing";
    this.updateHud();
  }

  update(dt) {
    if (this.state === "playing") this.updatePlaying(dt);
    else if (this.state === "transition") this.updateTransition(dt);
  }

  updatePlaying(dt) {
    this.bannerTimer = Math.max(0, this.bannerTimer - dt);

    // --- input → actions ---
    if (Input.attackPressed) this.player.tryAttack();
    if (Input.dodgePressed) this.player.tryDodge(Input.moveX, Input.moveY);
    consumeActions();

    this.player.update(dt, Input.moveX, Input.moveY, this.bounds);

    // --- trickle-spawn this room's quota, capped by maxConcurrent ---
    if (!this.room.cleared && this.room.toSpawn > 0) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0 && this.enemies.length < this.room.maxConcurrent) {
        this.spawnEnemy();
        this.room.toSpawn -= 1;
        this.spawnTimer = this.room.spawnInterval;
      }
    }

    // --- enemies ---
    for (const e of this.enemies) {
      e.update(dt, this.player, this.bounds);

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

    // --- room cleared? open the door ---
    if (!this.room.cleared && this.room.toSpawn === 0 && this.enemies.length === 0) {
      this.room.cleared = true;
      this.player.health = Math.min(PLAYER.maxHealth, this.player.health + ROOM_HEAL);
      this.bannerTimer = 1.6;
    }

    // --- walk into the open door to advance ---
    if (this.room.cleared && atDoor(this.player, this.room.exitSide, this.bounds)) {
      this.beginTransition();
    }

    if (!this.player.alive) {
      this.state = "dead";
      if (this.onGameOver) this.onGameOver(this.kills, this.roomIndex);
    }

    this.updateHud();
  }

  beginTransition() {
    this.state = "transition";
    this.transitionTimer = TRANSITION_DUR;
    this.swapped = false;
    this.prevExitSide = this.room.exitSide;
  }

  updateTransition(dt) {
    this.transitionTimer = Math.max(0, this.transitionTimer - dt);
    const elapsedFrac = 1 - this.transitionTimer / TRANSITION_DUR;

    // Swap to the next room at the darkest point of the fade.
    if (!this.swapped && elapsedFrac >= 0.5) {
      this.advanceRoom();
      this.swapped = true;
    }
    if (this.transitionTimer <= 0) this.state = "playing";
  }

  advanceRoom() {
    const entrySide = opposite(this.prevExitSide);
    this.roomIndex += 1;
    this.room = makeRoom(this.roomIndex, entrySide);
    this.enemies = [];
    this.spawnTimer = 0.4;

    const pos = entryPosition(entrySide, this.bounds, this.player.radius);
    this.player.x = pos.x;
    this.player.y = pos.y;
    this.player.attackTimer = 0;
    this.player.attackCd = 0;
    this.player.dodgeTimer = 0;
    this.player.dodgeCd = 0;
    this.updateHud();
  }

  spawnEnemy() {
    // Spawn near a random wall, but never in the doorway.
    const b = this.bounds;
    const m = 34;
    let x, y;
    for (let tries = 0; tries < 8; tries++) {
      const side = Math.floor(Math.random() * 4);
      if (side === 0) { x = b.x + Math.random() * b.w; y = b.y + m; }
      else if (side === 1) { x = b.x + b.w - m; y = b.y + Math.random() * b.h; }
      else if (side === 2) { x = b.x + Math.random() * b.w; y = b.y + b.h - m; }
      else { x = b.x + m; y = b.y + Math.random() * b.h; }
      // Keep clear of the player's entry point so they don't spawn on you.
      if (Math.hypot(x - this.player.x, y - this.player.y) > 130) break;
    }
    this.enemies.push(new Enemy(x, y));
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
    this.hud.roomEl.textContent = "ROOM " + this.roomIndex;
    this.hud.scoreEl.textContent = this.kills + (this.kills === 1 ? " kill" : " kills");
    const pct = (this.player.health / PLAYER.maxHealth) * 100;
    this.hud.healthFill.style.width = pct + "%";
    this.hud.attackBtn.classList.toggle("cooling", this.player.attackCd > 0);
    this.hud.dodgeBtn.classList.toggle("cooling", this.player.dodgeCd > 0);
  }

  render() {
    const ctx = this.ctx;
    const b = this.bounds;

    ctx.clearRect(0, 0, this.width, this.height);

    ctx.fillStyle = COLORS.arena;
    ctx.fillRect(b.x, b.y, b.w, b.h);

    // Grid
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;
    const step = 48;
    ctx.beginPath();
    for (let gx = b.x; gx <= b.x + b.w; gx += step) {
      ctx.moveTo(gx, b.y);
      ctx.lineTo(gx, b.y + b.h);
    }
    for (let gy = b.y; gy <= b.y + b.h; gy += step) {
      ctx.moveTo(b.x, gy);
      ctx.lineTo(b.x + b.w, gy);
    }
    ctx.stroke();

    // Border
    ctx.strokeStyle = COLORS.arenaBorder;
    ctx.lineWidth = 3;
    ctx.strokeRect(b.x, b.y, b.w, b.h);

    if (this.state === "menu") return;

    this.renderDoor(ctx);

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

  renderDoor(ctx) {
    if (!this.room) return;
    const open = this.room.cleared;
    const d = doorRect(this.room.exitSide, this.bounds, DOOR_WIDTH);

    // Cut the opening out of the border by painting the arena colour over it.
    ctx.fillStyle = COLORS.arena;
    ctx.fillRect(d.x, d.y, d.w, d.h);

    if (open) {
      ctx.save();
      ctx.shadowColor = COLORS.doorOpen;
      ctx.shadowBlur = 18;
      ctx.fillStyle = COLORS.doorOpen;
      ctx.fillRect(d.x, d.y, d.w, d.h);
      ctx.restore();

      // Chevrons pointing outward through the door (pulsing).
      const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 180);
      ctx.strokeStyle = `rgba(77,214,161,${0.5 + 0.5 * pulse})`;
      ctx.lineWidth = 4;
      this.drawDoorChevrons(ctx, this.room.exitSide, d);
    } else {
      ctx.fillStyle = COLORS.doorLocked; // locked door
      ctx.fillRect(d.x, d.y, d.w, d.h);
    }
  }

  drawDoorChevrons(ctx, side, d) {
    const horizontal = side === "left" || side === "right";
    const dir = side === "right" || side === "bottom" ? 1 : -1;
    const cx = d.x + d.w / 2;
    const cy = d.y + d.h / 2;
    for (let i = 0; i < 2; i++) {
      const off = (i * 12 + 6) * dir;
      ctx.beginPath();
      if (horizontal) {
        ctx.moveTo(cx + off - 8 * dir, cy - 12);
        ctx.lineTo(cx + off, cy);
        ctx.lineTo(cx + off - 8 * dir, cy + 12);
      } else {
        ctx.moveTo(cx - 12, cy + off - 8 * dir);
        ctx.lineTo(cx, cy + off);
        ctx.lineTo(cx + 12, cy + off - 8 * dir);
      }
      ctx.stroke();
    }
  }

  renderPlayer(ctx) {
    const p = this.player;

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
    const alpha = Math.min(1, this.bannerTimer / 0.4);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.textAlign = "center";
    ctx.fillStyle = COLORS.accent;
    ctx.font = "800 30px -apple-system, system-ui, sans-serif";
    ctx.fillText("ROOM CLEARED", this.width / 2, this.height / 2 - 14);
    ctx.fillStyle = "#e8ecf5";
    ctx.font = "600 16px -apple-system, system-ui, sans-serif";
    ctx.fillText("head through the glowing door", this.width / 2, this.height / 2 + 14);
    ctx.restore();
  }

  renderTransition(ctx) {
    if (this.state !== "transition") return;
    const elapsedFrac = 1 - this.transitionTimer / TRANSITION_DUR;
    // Triangle wave: 0 → 1 → 0 (fully black at the midpoint swap).
    const alpha = 1 - Math.abs(2 * elapsedFrac - 1);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = "#0e1016";
    ctx.fillRect(0, 0, this.width, this.height);
    ctx.restore();
  }
}
