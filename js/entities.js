// Game entities: Player (movement + attack + dodge + RPG stats), Enemy
// (chaser), and Pickup (dropped gold / hearts).
// All units are logical pixels (fixed 384x640 space); dt is in seconds.
// Health is measured in HALF-HEARTS.

import { LOGICAL_W, LOGICAL_H } from "./engine/tilemap.js";
import { BASE_HEARTS, POINTS_PER_LEVEL, SCALING, xpNeeded } from "./rpg/stats.js";

export const PLAYER = {
  radius: 18,
  speed: 230,
  // Attack (base values — attributes scale these; see derived getters)
  attackCooldown: 0.3,
  attackDuration: 0.18, // how long the swing arc is "live" / drawn
  attackRange: 72,
  attackArc: Math.PI * 0.6, // ~108° cone in front of facing
  attackDamage: 40,
  // Dodge roll
  dodgeCooldown: 0.75,
  dodgeDuration: 0.22,
  dodgeSpeed: 620,
  // Brief invulnerability after being hit, so packs can't stun-lock you.
  hurtIframes: 0.6,
};

export class Player {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.radius = PLAYER.radius;
    this.facing = -Math.PI / 2; // pointing up initially

    // --- RPG state ---
    this.stats = { might: 0, finesse: 0, focus: 0, vitality: 0 };
    this.level = 1;
    this.xp = 0;
    this.points = 0;
    this.gold = 0;
    this.bonusHearts = 0; // future: heart containers found in the world
    this.hp = this.maxHp; // half-hearts

    this.attackTimer = 0; // > 0 while swing is live
    this.attackCd = 0;
    this.attackHitSet = new Set(); // enemies already hit by current swing

    this.dodgeTimer = 0; // > 0 while rolling
    this.dodgeCd = 0;
    this.dodgeDirX = 0;
    this.dodgeDirY = 0;

    this.hurtTimer = 0; // post-hit i-frames
    this.alive = true;
  }

  // --- derived stats (attributes scale the PLAYER base constants) ---
  get maxHearts() {
    return BASE_HEARTS + this.stats.vitality + this.bonusHearts;
  }
  get maxHp() {
    return this.maxHearts * 2;
  }
  get speed() {
    return PLAYER.speed * (1 + SCALING.finesseSpeed * this.stats.finesse);
  }
  get damage() {
    return PLAYER.attackDamage * (1 + SCALING.mightDamage * this.stats.might);
  }
  get attackCooldown() {
    return Math.max(
      SCALING.minAttackCd,
      PLAYER.attackCooldown * (1 - SCALING.focusAttackCd * this.stats.focus)
    );
  }
  get dodgeCooldown() {
    return Math.max(
      SCALING.minDodgeCd,
      PLAYER.dodgeCooldown * (1 - SCALING.finesseDodgeCd * this.stats.finesse)
    );
  }

  get isDodging() {
    return this.dodgeTimer > 0;
  }
  get isAttacking() {
    return this.attackTimer > 0;
  }
  get invulnerable() {
    return this.isDodging || this.hurtTimer > 0;
  }

  // --- progression ---
  gainXP(amount) {
    this.xp += amount;
    let leveled = false;
    while (this.xp >= xpNeeded(this.level)) {
      this.xp -= xpNeeded(this.level);
      this.level += 1;
      this.points += POINTS_PER_LEVEL;
      leveled = true;
    }
    return leveled;
  }

  spendPoint(attrKey) {
    if (this.points <= 0 || !(attrKey in this.stats)) return false;
    this.stats[attrKey] += 1;
    this.points -= 1;
    if (attrKey === "vitality") this.hp += 2; // the new heart arrives full
    return true;
  }

  heal(halves) {
    this.hp = Math.min(this.maxHp, this.hp + halves);
  }

  // --- combat ---
  tryAttack() {
    if (this.attackCd > 0 || this.isDodging) return;
    this.attackTimer = PLAYER.attackDuration;
    this.attackCd = this.attackCooldown;
    this.attackHitSet.clear();
  }

  tryDodge(moveX, moveY) {
    if (this.dodgeCd > 0 || this.isDodging) return;
    // Roll toward current movement, or toward facing if standing still.
    let dx = moveX;
    let dy = moveY;
    if (Math.hypot(dx, dy) < 0.1) {
      dx = Math.cos(this.facing);
      dy = Math.sin(this.facing);
    }
    const mag = Math.hypot(dx, dy) || 1;
    this.dodgeDirX = dx / mag;
    this.dodgeDirY = dy / mag;
    this.dodgeTimer = PLAYER.dodgeDuration;
    this.dodgeCd = this.dodgeCooldown;
  }

  update(dt, moveX, moveY, map) {
    // Timers
    this.attackTimer = Math.max(0, this.attackTimer - dt);
    this.attackCd = Math.max(0, this.attackCd - dt);
    this.dodgeCd = Math.max(0, this.dodgeCd - dt);
    this.dodgeTimer = Math.max(0, this.dodgeTimer - dt);
    this.hurtTimer = Math.max(0, this.hurtTimer - dt);

    if (this.isDodging) {
      this.vx = this.dodgeDirX * PLAYER.dodgeSpeed;
      this.vy = this.dodgeDirY * PLAYER.dodgeSpeed;
    } else {
      this.vx = moveX * this.speed;
      this.vy = moveY * this.speed;
      // Update facing from movement intent (feels responsive for a melee char).
      if (Math.hypot(moveX, moveY) > 0.1) {
        this.facing = Math.atan2(moveY, moveX);
      }
    }

    // Tile collision (slides along walls). No screen-edge clamp: doorway gaps
    // let the player walk off the map, which triggers a screen transition.
    const res = map.moveCircle(
      this.x,
      this.y,
      this.x + this.vx * dt,
      this.y + this.vy * dt,
      this.radius
    );
    this.x = res.x;
    this.y = res.y;
  }

  // Is a point within the current swing cone?
  hitsPoint(px, py) {
    if (!this.isAttacking) return false;
    const dx = px - this.x;
    const dy = py - this.y;
    const dist = Math.hypot(dx, dy);
    if (dist > PLAYER.attackRange + 20) return false;
    let a = Math.atan2(dy, dx) - this.facing;
    while (a > Math.PI) a -= Math.PI * 2;
    while (a < -Math.PI) a += Math.PI * 2;
    return Math.abs(a) <= PLAYER.attackArc / 2;
  }

  // amount is in half-hearts. Returns true if the hit landed.
  takeDamage(amount) {
    if (this.invulnerable) return false;
    this.hp -= amount;
    this.hurtTimer = PLAYER.hurtIframes;
    if (this.hp <= 0) {
      this.hp = 0;
      this.alive = false;
    }
    return true;
  }
}

export const ENEMY = {
  radius: 15,
  speed: 92,
  maxHealth: 100,
  contactDamage: 1, // half-hearts
  hitInterval: 0.55, // min seconds between damage ticks on the player
  knockback: 260,
  xp: 12,
  goldMin: 4,
  goldMax: 9,
  heartDropChance: 0.15,
};

export class Enemy {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.radius = ENEMY.radius;
    this.health = ENEMY.maxHealth;
    this.hitCd = 0; // cooldown before it can damage the player again
    this.knockTimer = 0;
    this.knockX = 0;
    this.knockY = 0;
    this.flash = 0; // brief white flash when damaged
    this.alive = true;
  }

  update(dt, player, map) {
    this.hitCd = Math.max(0, this.hitCd - dt);
    this.flash = Math.max(0, this.flash - dt);
    this.knockTimer = Math.max(0, this.knockTimer - dt);

    if (this.knockTimer > 0) {
      this.vx = this.knockX;
      this.vy = this.knockY;
    } else {
      const dx = player.x - this.x;
      const dy = player.y - this.y;
      const d = Math.hypot(dx, dy) || 1;
      this.vx = (dx / d) * ENEMY.speed;
      this.vy = (dy / d) * ENEMY.speed;
    }

    const res = map.moveCircle(
      this.x,
      this.y,
      this.x + this.vx * dt,
      this.y + this.vy * dt,
      this.radius
    );
    this.x = res.x;
    this.y = res.y;

    // Unlike the player, enemies never leave the screen (even via doorways).
    this.x = Math.max(this.radius, Math.min(LOGICAL_W - this.radius, this.x));
    this.y = Math.max(this.radius, Math.min(LOGICAL_H - this.radius, this.y));
  }

  takeDamage(amount, fromX, fromY) {
    this.health -= amount;
    this.flash = 0.12;
    const dx = this.x - fromX;
    const dy = this.y - fromY;
    const d = Math.hypot(dx, dy) || 1;
    this.knockX = (dx / d) * ENEMY.knockback;
    this.knockY = (dy / d) * ENEMY.knockback;
    this.knockTimer = 0.12;
    if (this.health <= 0) this.alive = false;
  }
}

// Dropped loot lying on the ground: gold coins or a heart.
export class Pickup {
  constructor(type, x, y, amount = 0) {
    this.type = type; // "gold" | "heart"
    this.x = x;
    this.y = y;
    this.amount = amount;
    this.radius = type === "gold" ? 7 : 9;
    this.t = Math.random() * Math.PI * 2; // bob phase
  }
}
