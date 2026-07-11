// Game: owns the current screen (tilemap + enemies + pickups), the world
// graph, screen-flip transitions, RPG progression, autosave, and rendering.
//
// All gameplay happens in a fixed logical space (LOGICAL_W x LOGICAL_H) that
// is scaled and letterboxed to the device in render().

import { Player, Enemy, Pickup, Projectile, PLAYER } from "./entities.js";
import { Input, consumeActions } from "./input.js";
import { TileMap, TILE_SIZE, LOGICAL_W, LOGICAL_H } from "./engine/tilemap.js";
import { writeSave } from "./engine/save.js";
import { World } from "./world/world.js";
import { SCREENS, HOME_ID, HOME_SPAWN } from "./world/screens.js";
import { xpNeeded } from "./rpg/stats.js";

const COLORS = {
  page: "#0e1016",
  player: "#4dd6a1",
  playerDodge: "#5aa9ff",
  enemy: "#ff5470",
  enemyFlash: "#ffffff",
  swing: "rgba(255,107,107,0.35)",
  accent: "#4dd6a1",
  gold: "#ffd166",
  heart: "#ff5470",
};

const TRANSITION_DUR = 0.5; // fade between screens
const EDGE_OUT = 6; // how far past the map edge the player's center must go
const EDGE_IN = PLAYER.radius + 8; // how far inside the new screen they appear
const AUTOSAVE_INTERVAL = 4; // seconds
const PICKUP_RANGE = 30; // distance at which loot is collected

const tileCenter = (t) => (t + 0.5) * TILE_SIZE;

export class Game {
  constructor(canvas, hud) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.hud = hud; // { areaEl, statusEl, heartsEl, xpFill, attackBtn, dodgeBtn, levelupBtn }
    this.state = "menu"; // menu | playing | paused | transition | dead
    this.onGameOver = null;
    this.onHudChange = null; // notifies the character sheet to refresh

    this.world = new World(SCREENS);
    this.map = null;
    this.maps = new Map(); // screenId -> TileMap cache
    this.player = null;
    this.enemies = [];
    this.pickups = [];
    this.projectiles = [];
    this.pouch = null; // { screenId, x, y, amount } — dropped gold on death
    this.kills = 0;

    this.time = 0;
    this.bannerText = "";
    this.bannerTimer = 0;
    this.transitionTimer = 0;
    this.pendingDir = null;
    this.saveTimer = 0;
    this._heartsSig = "";

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
    this.pouch = null;
    this.enterScreen(HOME_ID);
    this.state = "playing";
    this.saveNow();
  }

  continueRun(save) {
    this.player = new Player(save.x, save.y);
    this.player.stats = { ...this.player.stats, ...(save.stats || {}) };
    this.player.level = save.level || 1;
    this.player.xp = save.xp || 0;
    this.player.points = save.points || 0;
    this.player.gold = save.gold || 0;
    this.player.hp = Math.min(save.hp ?? this.player.maxHp, this.player.maxHp);
    this.kills = save.kills || 0;
    this.pouch = save.pouch || null;
    this.player.mode = save.mode || "sword";
    const id = SCREENS[save.screenId] ? save.screenId : HOME_ID;
    this.enterScreen(id);
    this.state = "playing";
  }

  respawn() {
    this.player.hp = this.player.maxHp;
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
    // Enemies and loose loot are transient; enemies respawn on re-entry.
    this.enemies = screen.safe
      ? []
      : screen.enemies.map((e) => new Enemy(tileCenter(e.x), tileCenter(e.y), e.type || "chaser"));
    this.pickups = [];
    this.projectiles = [];
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
    const p = this.player;
    return {
      v: 2,
      screenId: this.world.currentId,
      x: p.x,
      y: p.y,
      hp: p.hp,
      stats: { ...p.stats },
      level: p.level,
      xp: p.xp,
      points: p.points,
      gold: p.gold,
      kills: this.kills,
      pouch: this.pouch,
      mode: p.mode,
    };
  }

  saveNow() {
    if (this.player) writeSave(this.buildSave());
  }

  // ---------- character sheet / pause ----------

  openSheet() {
    if (this.state !== "playing") return false;
    this.state = "paused";
    return true;
  }

  closeSheet() {
    if (this.state === "paused") this.state = "playing";
  }

  spendPoint(attrKey) {
    if (this.player && this.player.spendPoint(attrKey)) {
      this.updateHud();
      this.saveNow();
      return true;
    }
    return false;
  }

  cycleMode() {
    if (!this.player || this.state === "dead") return;
    this.player.cycleMode();
    this.updateHud();
  }

  // ---------- update ----------

  update(dt) {
    this.time += dt;
    if (this.state === "playing") this.updatePlaying(dt);
    else if (this.state === "transition") this.updateTransition(dt);
  }

  updatePlaying(dt) {
    this.bannerTimer = Math.max(0, this.bannerTimer - dt);

    if (Input.attackPressed) {
      const p = this.player;
      if (p.mode === "sword") {
        p.tryAttack();
      } else {
        const angle = this.autoAimAngle();
        const shot = p.mode === "bow" ? p.tryShoot(angle) : p.tryCast(angle);
        if (shot) this.projectiles.push(new Projectile(shot));
      }
    }
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
      e.update(dt, this.player, this.map, this.projectiles);

      if (this.player.isAttacking && !this.player.attackHitSet.has(e)) {
        if (this.player.hitsPoint(e.x, e.y)) {
          e.takeDamage(this.player.damage, this.player.x, this.player.y);
          this.player.attackHitSet.add(e);
          if (!e.alive) this.onEnemyKilled(e);
        }
      }

      const dist = Math.hypot(e.x - this.player.x, e.y - this.player.y);
      if (dist < e.radius + this.player.radius && e.hitCd <= 0) {
        if (this.player.takeDamage(e.touchDamage)) {
          e.hitCd = e.def.hitInterval;
        }
      }
    }

    this.separateEnemies();
    this.enemies = this.enemies.filter((e) => e.alive);

    this.updateProjectiles(dt);
    this.updatePickups(dt);

    if (!this.player.alive) {
      this.die();
      return;
    }

    this.saveTimer += dt;
    if (this.saveTimer >= AUTOSAVE_INTERVAL) {
      this.saveTimer = 0;
      this.saveNow();
    }

    this.updateHud();
  }

  onEnemyKilled(e) {
    this.kills += 1;
    this.player.gainXP(e.def.xp);
    const gold =
      e.def.goldMin + Math.floor(Math.random() * (e.def.goldMax - e.def.goldMin + 1));
    this.pickups.push(new Pickup("gold", e.x, e.y, gold));
    if (Math.random() < e.def.heartDropChance) {
      this.pickups.push(new Pickup("heart", e.x + 14, e.y - 8));
    }
  }

  // Soft aim assist for projectiles: snap to the best enemy within a cone of
  // the facing direction; otherwise fire straight ahead.
  autoAimAngle() {
    const p = this.player;
    let best = null;
    let bestScore = Infinity;
    for (const e of this.enemies) {
      const dx = e.x - p.x;
      const dy = e.y - p.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 280) continue;
      let diff = Math.atan2(dy, dx) - p.facing;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      if (Math.abs(diff) > 0.65) continue; // ~37° either side
      const score = Math.abs(diff) * 100 + dist * 0.2;
      if (score < bestScore) {
        bestScore = score;
        best = e;
      }
    }
    return best ? Math.atan2(best.y - p.y, best.x - p.x) : p.facing;
  }

  updateProjectiles(dt) {
    const p = this.player;
    for (const pr of this.projectiles) {
      pr.update(dt, this.map);
      if (!pr.alive) continue;

      if (pr.friendly) {
        for (const e of this.enemies) {
          if (!e.alive) continue;
          if (Math.hypot(e.x - pr.x, e.y - pr.y) < e.radius + pr.radius) {
            e.takeDamage(pr.damage, pr.x - Math.cos(pr.angle) * 20, pr.y - Math.sin(pr.angle) * 20);
            if (!e.alive) this.onEnemyKilled(e);
            pr.alive = false;
            break;
          }
        }
      } else if (Math.hypot(p.x - pr.x, p.y - pr.y) < p.radius + pr.radius) {
        // Dodge-rolling through an enemy arrow lets it pass clean through.
        if (p.takeDamage(pr.damage)) pr.alive = false;
      }
    }
    this.enemies = this.enemies.filter((e) => e.alive);
    this.projectiles = this.projectiles.filter((pr) => pr.alive);
  }

  updatePickups(dt) {
    const p = this.player;
    for (const pk of this.pickups) {
      pk.t += dt * 4;
      if (Math.hypot(pk.x - p.x, pk.y - p.y) < PICKUP_RANGE) {
        if (pk.type === "gold") p.gold += pk.amount;
        else p.heal(2); // a dropped heart restores one full heart
        pk.collected = true;
      }
    }
    this.pickups = this.pickups.filter((pk) => !pk.collected);

    // The dropped gold pouch from your last death, if it's on this screen.
    if (this.pouch && this.pouch.screenId === this.world.currentId) {
      if (Math.hypot(this.pouch.x - p.x, this.pouch.y - p.y) < PICKUP_RANGE + 6) {
        p.gold += this.pouch.amount;
        this.pouch = null;
        this.bannerText = "GOLD RECLAIMED";
        this.bannerTimer = 1.2;
        this.saveNow();
      }
    }
  }

  die() {
    // Drop carried gold where you fell. A new death replaces the old pouch.
    let dropped = 0;
    if (this.player.gold > 0) {
      dropped = this.player.gold;
      this.pouch = {
        screenId: this.world.currentId,
        x: Math.max(20, Math.min(LOGICAL_W - 20, this.player.x)),
        y: Math.max(20, Math.min(LOGICAL_H - 20, this.player.y)),
        amount: dropped,
      };
      this.player.gold = 0;
    }
    this.state = "dead";
    this.saveNow();
    if (this.onGameOver) {
      this.onGameOver({
        kills: this.kills,
        dropped,
        screenName: this.world.current.name,
      });
    }
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

  // ---------- HUD ----------

  updateHud() {
    const p = this.player;
    if (!p) return;
    const screen = this.world.current;
    this.hud.areaEl.textContent = screen ? screen.name : "";
    this.hud.statusEl.textContent = `Lv ${p.level} · ${p.gold} gold`;
    this.hud.xpFill.style.width = Math.min(100, (p.xp / xpNeeded(p.level)) * 100) + "%";

    // Hearts (rebuild only when they change).
    const sig = `${p.hp}/${p.maxHp}`;
    if (sig !== this._heartsSig) {
      this._heartsSig = sig;
      let html = "";
      for (let i = 0; i < p.maxHearts; i++) {
        const cls = p.hp >= (i + 1) * 2 ? "full" : p.hp === i * 2 + 1 ? "half" : "";
        html += `<span class="heart ${cls}">♥</span>`;
      }
      this.hud.heartsEl.innerHTML = html;
    }

    this.hud.levelupBtn.classList.toggle("hidden", p.points === 0 || this.state === "dead");
    if (p.points > 0) this.hud.levelupBtn.textContent = `LEVEL UP ＋${p.points}`;

    // Mana bar + weapon mode button.
    this.hud.manaFill.style.width = (p.mana / PLAYER.manaMax) * 100 + "%";
    const modeLabels = { sword: "SWORD", bow: "BOW", spell: "FIRE" };
    this.hud.modeBtn.textContent = modeLabels[p.mode];
    this.hud.modeBtn.dataset.mode = p.mode;

    // The ATK button reflects the ACTIVE mode's readiness.
    const atkCooling =
      p.mode === "sword"
        ? p.attackCd > 0
        : p.mode === "bow"
          ? p.shootCd > 0
          : p.castCd > 0 || p.mana < PLAYER.spellCost;
    this.hud.attackBtn.classList.toggle("cooling", atkCooling);
    this.hud.dodgeBtn.classList.toggle("cooling", p.dodgeCd > 0);

    if (this.onHudChange) this.onHudChange();
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

    this.renderPickups(ctx);
    this.renderPouch(ctx);
    this.renderEnemies(ctx);
    this.renderProjectiles(ctx);
    this.renderPlayer(ctx);
    this.renderBanner(ctx);
    this.renderTransition(ctx);
  }

  renderEnemies(ctx) {
    for (const e of this.enemies) {
      // Archer aiming: a faint line telegraphs the incoming shot.
      if (e.isDrawing) {
        ctx.strokeStyle = "rgba(176,109,245,0.35)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(e.x, e.y);
        ctx.lineTo(this.player.x, this.player.y);
        ctx.stroke();
      }

      // Charger windup: rapid blink + swelling outline reads as "get out of the way".
      let body = e.flash > 0 ? COLORS.enemyFlash : e.def.color;
      if (e.isWindup && Math.floor(this.time * 12) % 2 === 0) body = "#ffffff";
      ctx.fillStyle = body;
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.radius, 0, Math.PI * 2);
      ctx.fill();
      if (e.isWindup || e.isCharging) {
        ctx.strokeStyle = e.def.color;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.radius + 4, 0, Math.PI * 2);
        ctx.stroke();
      }

      if (e.health < e.def.maxHealth) {
        const w = e.radius * 2;
        ctx.fillStyle = "rgba(0,0,0,0.5)";
        ctx.fillRect(e.x - e.radius, e.y - e.radius - 8, w, 3);
        ctx.fillStyle = "#ffd166";
        ctx.fillRect(e.x - e.radius, e.y - e.radius - 8, w * (e.health / e.def.maxHealth), 3);
      }
    }
  }

  renderProjectiles(ctx) {
    for (const pr of this.projectiles) {
      if (pr.kind === "firebolt") {
        ctx.save();
        ctx.shadowColor = "#ff9a3d";
        ctx.shadowBlur = 12;
        ctx.fillStyle = "#ffb35c";
        ctx.beginPath();
        ctx.arc(pr.x, pr.y, pr.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else {
        // Arrows: a short line in the direction of travel.
        ctx.strokeStyle = pr.friendly ? "#e8ecf5" : "#b06df5";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(pr.x - Math.cos(pr.angle) * 8, pr.y - Math.sin(pr.angle) * 8);
        ctx.lineTo(pr.x + Math.cos(pr.angle) * 8, pr.y + Math.sin(pr.angle) * 8);
        ctx.stroke();
      }
    }
  }

  renderPickups(ctx) {
    for (const pk of this.pickups) {
      const bob = Math.sin(pk.t) * 2;
      if (pk.type === "gold") {
        ctx.fillStyle = COLORS.gold;
        ctx.beginPath();
        ctx.arc(pk.x, pk.y + bob, pk.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,0.5)";
        ctx.beginPath();
        ctx.arc(pk.x - 2, pk.y + bob - 2, 2.4, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = COLORS.heart;
        ctx.font = "16px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("♥", pk.x, pk.y + bob + 6);
      }
    }
  }

  renderPouch(ctx) {
    if (!this.pouch || this.pouch.screenId !== this.world.currentId) return;
    const pulse = 0.5 + 0.5 * Math.sin(this.time * 5);
    ctx.save();
    ctx.shadowColor = COLORS.gold;
    ctx.shadowBlur = 10 + 8 * pulse;
    ctx.fillStyle = COLORS.gold;
    ctx.beginPath();
    ctx.arc(this.pouch.x, this.pouch.y, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = "#0e1016";
    ctx.font = "800 12px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("$", this.pouch.x, this.pouch.y + 4);
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

    // Blink while post-hit invulnerable; translucent while dodging.
    if (p.hurtTimer > 0 && Math.floor(this.time * 14) % 2 === 0) {
      ctx.globalAlpha = 0.35;
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
