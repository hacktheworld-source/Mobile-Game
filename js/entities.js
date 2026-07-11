// Game entities: Player (movement + attack + dodge + RPG stats), Enemy
// (chaser), and Pickup (dropped gold / hearts).
// All units are logical pixels (fixed 384x640 space); dt is in seconds.
// Health is measured in HALF-HEARTS.

import { LOGICAL_W, LOGICAL_H } from "./engine/tilemap.js";
import { BASE_HEARTS, POINTS_PER_LEVEL, SCALING, xpNeeded } from "./rpg/stats.js";
import { ITEMS, STARTING_EQUIPMENT, STARTING_INVENTORY } from "./rpg/items.js";

export const PLAYER = {
  radius: 18,
  speed: 230,
  // Melee (base values — attributes scale these; see derived getters)
  attackCooldown: 0.3,
  attackDuration: 0.18, // how long the swing arc is "live" / drawn
  attackRange: 72,
  attackArc: Math.PI * 0.6, // ~108° cone in front of facing
  attackDamage: 40,
  // Bow (scales with Finesse)
  bowCooldown: 0.5,
  bowDamage: 30,
  bowSpeed: 380,
  // Firebolt spell (scales with Focus, costs mana)
  spellCooldown: 0.4,
  spellDamage: 55,
  spellCost: 30,
  spellSpeed: 300,
  manaMax: 100,
  manaRegen: 12, // per second
  // Dodge roll
  dodgeCooldown: 0.75,
  dodgeDuration: 0.22,
  dodgeSpeed: 620,
  // Brief invulnerability after being hit, so packs can't stun-lock you.
  hurtIframes: 0.6,
};

export const MODES = ["sword", "bow", "spell"];

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
    this.inventory = [...STARTING_INVENTORY];
    this.equipment = { ...STARTING_EQUIPMENT };
    this.hp = this.maxHp; // half-hearts

    this.mode = "sword"; // sword | bow | spell
    this.mana = PLAYER.manaMax;

    this.attackTimer = 0; // > 0 while swing is live
    this.attackCd = 0;
    this.attackHitSet = new Set(); // enemies already hit by current swing
    this.shootCd = 0;
    this.castCd = 0;

    this.dodgeTimer = 0; // > 0 while rolling
    this.dodgeCd = 0;
    this.dodgeDirX = 0;
    this.dodgeDirY = 0;

    this.hurtTimer = 0; // post-hit i-frames
    this.alive = true;
  }

  // --- gear helpers ---
  equippedItem(slot) {
    return ITEMS[this.equipment[slot]] || null;
  }
  gearStat(key) {
    let sum = 0;
    for (const id of Object.values(this.equipment)) {
      const it = ITEMS[id];
      if (it && it.stats[key]) sum += it.stats[key];
    }
    return sum;
  }
  ownsItem(id) {
    return this.inventory.includes(id);
  }
  equip(id) {
    const it = ITEMS[id];
    if (!it || !this.ownsItem(id)) return false;
    this.equipment[it.slot] = id;
    this.hp = Math.min(this.hp, this.maxHp); // armor swap can shrink max hearts
    return true;
  }

  // --- derived stats (attributes + gear scale the base constants) ---
  get maxHearts() {
    return BASE_HEARTS + this.stats.vitality + this.bonusHearts + this.gearStat("hearts");
  }
  get maxHp() {
    return this.maxHearts * 2;
  }
  get speed() {
    return (
      PLAYER.speed *
      (1 + SCALING.finesseSpeed * this.stats.finesse) *
      (1 + this.gearStat("speedPct") / 100)
    );
  }
  get damage() {
    const base = this.equippedItem("melee")?.stats.damage ?? PLAYER.attackDamage;
    return base * (1 + SCALING.mightDamage * this.stats.might);
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
  get bowDamage() {
    const base = this.equippedItem("bow")?.stats.damage ?? PLAYER.bowDamage;
    return base * (1 + SCALING.finesseBowDamage * this.stats.finesse);
  }
  get spellDamage() {
    const base = this.equippedItem("spell")?.stats.damage ?? PLAYER.spellDamage;
    return base * (1 + SCALING.focusSpellDamage * this.stats.focus);
  }
  get manaRegen() {
    return PLAYER.manaRegen * (1 + this.gearStat("manaRegenPct") / 100);
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
    this.xp += Math.round(amount * (1 + this.gearStat("xpPct") / 100));
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
  cycleMode() {
    const i = MODES.indexOf(this.mode);
    this.mode = MODES[(i + 1) % MODES.length];
  }

  tryAttack() {
    if (this.attackCd > 0 || this.isDodging) return;
    this.attackTimer = PLAYER.attackDuration;
    this.attackCd = this.attackCooldown;
    this.attackHitSet.clear();
  }

  // Returns projectile params or null if on cooldown / rolling.
  tryShoot(angle) {
    if (this.shootCd > 0 || this.isDodging) return null;
    this.shootCd = PLAYER.bowCooldown;
    return {
      kind: "arrow",
      x: this.x + Math.cos(angle) * (this.radius + 6),
      y: this.y + Math.sin(angle) * (this.radius + 6),
      angle,
      speed: PLAYER.bowSpeed,
      damage: this.bowDamage,
      radius: 4,
      friendly: true,
    };
  }

  tryCast(angle) {
    if (this.castCd > 0 || this.isDodging || this.mana < PLAYER.spellCost) return null;
    this.castCd = PLAYER.spellCooldown;
    this.mana -= PLAYER.spellCost;
    return {
      kind: "firebolt",
      x: this.x + Math.cos(angle) * (this.radius + 6),
      y: this.y + Math.sin(angle) * (this.radius + 6),
      angle,
      speed: PLAYER.spellSpeed,
      damage: this.spellDamage,
      radius: 6,
      friendly: true,
    };
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
    this.shootCd = Math.max(0, this.shootCd - dt);
    this.castCd = Math.max(0, this.castCd - dt);
    this.dodgeCd = Math.max(0, this.dodgeCd - dt);
    this.dodgeTimer = Math.max(0, this.dodgeTimer - dt);
    this.hurtTimer = Math.max(0, this.hurtTimer - dt);
    this.mana = Math.min(PLAYER.manaMax, this.mana + this.manaRegen * dt);

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

// Enemy archetypes. `contactDamage` is in half-hearts.
export const ENEMY_TYPES = {
  // Walks straight at you. The baseline threat.
  chaser: {
    radius: 15,
    speed: 92,
    maxHealth: 100,
    contactDamage: 1,
    hitInterval: 0.55,
    knockback: 260,
    xp: 12,
    goldMin: 4,
    goldMax: 9,
    heartDropChance: 0.15,
    color: "#ff5470",
  },
  // Slow stalker that winds up (clear tell), then rushes in a locked line.
  charger: {
    radius: 17,
    speed: 55,
    maxHealth: 140,
    contactDamage: 1,
    chargeDamage: 2, // getting hit BY the charge costs a full heart
    hitInterval: 0.6,
    knockback: 170,
    xp: 18,
    goldMin: 7,
    goldMax: 13,
    heartDropChance: 0.2,
    color: "#ff9a3d",
    triggerRange: 170,
    windupTime: 0.55,
    chargeSpeed: 430,
    chargeTime: 0.5,
    recoverTime: 1.4,
  },
  // Keeps its distance and fires telegraphed arrows you can roll through.
  archer: {
    radius: 13,
    speed: 78,
    maxHealth: 70,
    contactDamage: 1,
    hitInterval: 0.6,
    knockback: 300,
    xp: 16,
    goldMin: 6,
    goldMax: 11,
    heartDropChance: 0.15,
    color: "#b06df5",
    shootRange: 250,
    fleeRange: 120,
    drawTime: 0.45,
    shootCooldown: 1.9,
    arrowSpeed: 250,
    arrowDamage: 1,
  },
};

export class Enemy {
  constructor(x, y, type = "chaser") {
    this.type = type;
    this.def = ENEMY_TYPES[type];
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.radius = this.def.radius;
    this.health = this.def.maxHealth;
    this.hitCd = 0; // cooldown before it can damage the player again
    this.knockTimer = 0;
    this.knockX = 0;
    this.knockY = 0;
    this.flash = 0; // brief white flash when damaged
    this.alive = true;

    // charger state machine: idle | windup | charging | recover
    this.chargeState = "idle";
    this.stateTimer = 0;
    this.chargeDirX = 0;
    this.chargeDirY = 0;

    // archer state
    this.shootTimer = 1 + Math.random(); // stagger first shots
    this.drawTimer = 0;
  }

  get isCharging() {
    return this.type === "charger" && this.chargeState === "charging";
  }
  get isWindup() {
    return this.type === "charger" && this.chargeState === "windup";
  }
  get isDrawing() {
    return this.type === "archer" && this.drawTimer > 0;
  }
  // Damage this enemy deals on contact right now.
  get touchDamage() {
    return this.isCharging ? this.def.chargeDamage : this.def.contactDamage;
  }

  update(dt, player, map, projectiles) {
    this.hitCd = Math.max(0, this.hitCd - dt);
    this.flash = Math.max(0, this.flash - dt);
    this.knockTimer = Math.max(0, this.knockTimer - dt);

    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const dist = Math.hypot(dx, dy) || 1;
    const ux = dx / dist;
    const uy = dy / dist;

    if (this.knockTimer > 0) {
      this.vx = this.knockX;
      this.vy = this.knockY;
    } else if (this.type === "charger") {
      this.updateCharger(dt, dist, ux, uy);
    } else if (this.type === "archer") {
      this.updateArcher(dt, player, dist, ux, uy, projectiles);
    } else {
      // chaser
      this.vx = ux * this.def.speed;
      this.vy = uy * this.def.speed;
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

  updateCharger(dt, dist, ux, uy) {
    const d = this.def;
    this.stateTimer = Math.max(0, this.stateTimer - dt);

    if (this.chargeState === "idle") {
      this.vx = ux * d.speed;
      this.vy = uy * d.speed;
      if (dist < d.triggerRange) {
        this.chargeState = "windup";
        this.stateTimer = d.windupTime;
        // Lock direction at the START of the windup so you can sidestep.
        this.chargeDirX = ux;
        this.chargeDirY = uy;
        this.vx = 0;
        this.vy = 0;
      }
    } else if (this.chargeState === "windup") {
      this.vx = 0;
      this.vy = 0;
      if (this.stateTimer <= 0) {
        this.chargeState = "charging";
        this.stateTimer = d.chargeTime;
      }
    } else if (this.chargeState === "charging") {
      this.vx = this.chargeDirX * d.chargeSpeed;
      this.vy = this.chargeDirY * d.chargeSpeed;
      if (this.stateTimer <= 0) {
        this.chargeState = "recover";
        this.stateTimer = d.recoverTime;
      }
    } else {
      // recover: shuffle slowly toward the player until ready again
      this.vx = ux * d.speed * 0.5;
      this.vy = uy * d.speed * 0.5;
      if (this.stateTimer <= 0) this.chargeState = "idle";
    }
  }

  updateArcher(dt, player, dist, ux, uy, projectiles) {
    const d = this.def;

    if (this.drawTimer > 0) {
      // Drawing the bow: stand still, then loose an arrow at the player.
      this.vx = 0;
      this.vy = 0;
      this.drawTimer -= dt;
      if (this.drawTimer <= 0 && projectiles) {
        const angle = Math.atan2(player.y - this.y, player.x - this.x);
        projectiles.push(
          new Projectile({
            kind: "enemy-arrow",
            x: this.x + ux * (this.radius + 4),
            y: this.y + uy * (this.radius + 4),
            angle,
            speed: d.arrowSpeed,
            damage: d.arrowDamage,
            radius: 4,
            friendly: false,
          })
        );
        this.shootTimer = d.shootCooldown;
      }
      return;
    }

    // Keep a comfortable band: flee if close, approach if far, else hold.
    if (dist < d.fleeRange) {
      this.vx = -ux * d.speed;
      this.vy = -uy * d.speed;
    } else if (dist > d.shootRange) {
      this.vx = ux * d.speed;
      this.vy = uy * d.speed;
    } else {
      this.vx = 0;
      this.vy = 0;
      this.shootTimer -= dt;
      if (this.shootTimer <= 0) this.drawTimer = d.drawTime;
    }
  }

  takeDamage(amount, fromX, fromY) {
    this.health -= amount;
    this.flash = 0.12;
    const dx = this.x - fromX;
    const dy = this.y - fromY;
    const d = Math.hypot(dx, dy) || 1;
    this.knockX = (d ? dx / d : 0) * this.def.knockback;
    this.knockY = (d ? dy / d : 0) * this.def.knockback;
    this.knockTimer = 0.12;
    // A solid hit knocks a charger out of its windup.
    if (this.isWindup) {
      this.chargeState = "recover";
      this.stateTimer = 0.6;
    }
    if (this.health <= 0) this.alive = false;
  }
}

// A projectile in flight: player arrows/firebolts or enemy arrows.
export class Projectile {
  constructor({ kind, x, y, angle, speed, damage, radius, friendly, range = 420 }) {
    this.kind = kind; // arrow | firebolt | enemy-arrow
    this.x = x;
    this.y = y;
    this.angle = angle;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.damage = damage;
    this.radius = radius;
    this.friendly = friendly;
    this.range = range;
    this.traveled = 0;
    this.alive = true;
  }

  update(dt, map) {
    const stepX = this.vx * dt;
    const stepY = this.vy * dt;
    this.x += stepX;
    this.y += stepY;
    this.traveled += Math.hypot(stepX, stepY);
    if (this.traveled > this.range) this.alive = false;
    // Walls and trees stop projectiles; they fly over water.
    if (map.projectileBlocked(this.x, this.y, this.radius)) this.alive = false;
    // Off the map entirely.
    if (this.x < -20 || this.x > LOGICAL_W + 20 || this.y < -20 || this.y > LOGICAL_H + 20) {
      this.alive = false;
    }
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
