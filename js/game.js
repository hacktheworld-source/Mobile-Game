// Game world: owns the arena, player, enemies, spawning, collisions, rendering.

import { Player, Enemy, PLAYER, ENEMY } from "./entities.js";
import { Input, consumeActions } from "./input.js";

const COLORS = {
  arena: "#141824",
  arenaBorder: "#2a3146",
  grid: "rgba(255,255,255,0.03)",
  player: "#4dd6a1",
  playerDodge: "#5aa9ff",
  enemy: "#ff5470",
  enemyFlash: "#ffffff",
  swing: "rgba(255,107,107,0.35)",
  swingEdge: "rgba(255,180,180,0.8)",
};

export class Game {
  constructor(canvas, hud) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.hud = hud; // { scoreEl, healthFill, attackBtn, dodgeBtn }
    this.width = 0;
    this.height = 0;
    this.bounds = { x: 0, y: 0, w: 0, h: 0 };
    this.state = "menu"; // menu | playing | dead
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

    // Arena inset a little from screen edges.
    const pad = 8;
    this.bounds = {
      x: pad,
      y: pad,
      w: this.width - pad * 2,
      h: this.height - pad * 2,
    };
  }

  start() {
    this.player = new Player(this.width / 2, this.height / 2);
    this.enemies = [];
    this.score = 0;
    this.time = 0;
    this.spawnTimer = 0;
    this.spawnInterval = 1.6;
    this.state = "playing";
  }

  update(dt) {
    if (this.state !== "playing") return;
    this.time += dt;

    // --- input → actions ---
    if (Input.attackPressed) this.player.tryAttack();
    if (Input.dodgePressed) this.player.tryDodge(Input.moveX, Input.moveY);
    consumeActions();

    this.player.update(dt, Input.moveX, Input.moveY, this.bounds);

    // --- spawning: ramps up over time ---
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnEnemy();
      this.spawnInterval = Math.max(0.45, 1.6 - this.time * 0.012);
      this.spawnTimer = this.spawnInterval;
    }

    // --- enemies ---
    for (const e of this.enemies) {
      e.update(dt, this.player, this.bounds);

      // Player swing hits enemy (once per swing).
      if (this.player.isAttacking && !this.player.attackHitSet.has(e)) {
        if (this.player.hitsPoint(e.x, e.y)) {
          e.takeDamage(PLAYER.attackDamage, this.player.x, this.player.y);
          this.player.attackHitSet.add(e);
          if (!e.alive) this.score += 1;
        }
      }

      // Enemy contact damages player.
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
      if (this.onGameOver) this.onGameOver(this.score, Math.floor(this.time));
    }

    this.updateHud();
  }

  spawnEnemy() {
    // Spawn just outside a random edge, then let it walk in.
    const b = this.bounds;
    const side = Math.floor(Math.random() * 4);
    let x, y;
    const m = 30;
    if (side === 0) {
      x = b.x + Math.random() * b.w;
      y = b.y + m;
    } else if (side === 1) {
      x = b.x + b.w - m;
      y = b.y + Math.random() * b.h;
    } else if (side === 2) {
      x = b.x + Math.random() * b.w;
      y = b.y + b.h - m;
    } else {
      x = b.x + m;
      y = b.y + Math.random() * b.h;
    }
    this.enemies.push(new Enemy(x, y));
  }

  // Cheap positional relaxation so enemies don't fully stack.
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
    this.hud.scoreEl.textContent = String(this.score);
    const pct = (this.player.health / PLAYER.maxHealth) * 100;
    this.hud.healthFill.style.width = pct + "%";
    this.hud.attackBtn.classList.toggle("cooling", this.player.attackCd > 0);
    this.hud.dodgeBtn.classList.toggle("cooling", this.player.dodgeCd > 0);
  }

  render() {
    const ctx = this.ctx;
    const b = this.bounds;

    ctx.clearRect(0, 0, this.width, this.height);

    // Arena
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

    // Enemies
    for (const e of this.enemies) {
      ctx.fillStyle = e.flash > 0 ? COLORS.enemyFlash : COLORS.enemy;
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.radius, 0, Math.PI * 2);
      ctx.fill();
      // small health pip
      if (e.health < ENEMY.maxHealth) {
        const w = e.radius * 2;
        ctx.fillStyle = "rgba(0,0,0,0.5)";
        ctx.fillRect(e.x - e.radius, e.y - e.radius - 8, w, 3);
        ctx.fillStyle = "#ffd166";
        ctx.fillRect(e.x - e.radius, e.y - e.radius - 8, w * (e.health / ENEMY.maxHealth), 3);
      }
    }

    this.renderPlayer(ctx);
  }

  renderPlayer(ctx) {
    const p = this.player;

    // Swing arc
    if (p.isAttacking) {
      const t = p.attackTimer / PLAYER.attackDuration; // 1 → 0
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

    // Body
    ctx.fillStyle = p.isDodging ? COLORS.playerDodge : COLORS.player;
    if (p.isDodging) {
      ctx.globalAlpha = 0.6; // visually read the i-frames
    }
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // Facing indicator
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
}
