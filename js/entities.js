// Game entities: Player (movement/attack/dodge + full RPG state), Enemy (six
// archetypes + the Barrow King), Projectile, Bomb, and Pickup.
// All units are logical pixels (fixed 384x640 space); dt is in seconds.
// Health is measured in HALF-HEARTS.

import { LOGICAL_W, LOGICAL_H } from "./engine/tilemap.js";
import { BASE_HEARTS, POINTS_PER_LEVEL, SCALING, xpNeeded } from "./rpg/stats.js";
import { ITEMS, STARTING_EQUIPMENT, STARTING_INVENTORY } from "./rpg/items.js";
import { ENEMY_TYPES, TIER_SCALE } from "./rpg/enemies.js";
import { PERKS } from "./rpg/perks.js";

export const PLAYER = {
  // Slim enough (28px) to slip through one-tile (32px) gaps.
  radius: 14,
  speed: 230,
  // Melee (base values — gear + attributes scale these; see derived getters)
  attackCooldown: 0.3,
  attackDuration: 0.18,
  attackRange: 72,
  attackArc: Math.PI * 0.6,
  attackDamage: 40,
  // Bow
  bowCooldown: 0.5,
  bowDamage: 30,
  bowSpeed: 380,
  // Firebolt
  spellCooldown: 0.4,
  spellDamage: 55,
  spellCost: 30,
  spellSpeed: 300,
  manaMax: 100,
  manaRegen: 12,
  // Dodge roll
  dodgeCooldown: 0.75,
  dodgeDuration: 0.22,
  dodgeSpeed: 620,
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
    this.facing = -Math.PI / 2;

    // --- RPG state ---
    this.stats = { might: 0, finesse: 0, focus: 0, vitality: 0 };
    this.level = 1;
    this.xp = 0;
    this.points = 0;
    this.gold = 0;
    this.bonusHearts = 0; // heart containers found in the world
    this.inventory = [...STARTING_INVENTORY];
    this.equipment = { ...STARTING_EQUIPMENT };
    this.perks = []; // perk ids owned
    this.activeSkill = null; // equipped active perk id
    this.hp = this.maxHp;

    this.mode = "sword";
    this.mana = PLAYER.manaMax;

    this.attackTimer = 0;
    this.attackCd = 0;
    this.attackHitSet = new Set();
    this.shootCd = 0;
    this.castCd = 0;
    this.skillCd = 0;

    this.dodgeTimer = 0;
    this.dodgeCd = 0;
    this.dodgeDirX = 0;
    this.dodgeDirY = 0;

    this.hurtTimer = 0;
    this.alive = true;
  }

  // --- gear & perk helpers ---
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
    this.hp = Math.min(this.hp, this.maxHp);
    return true;
  }
  hasPerk(id) {
    return this.perks.includes(id);
  }
  buyPerk(id, cost) {
    if (this.hasPerk(id) || this.points < cost || !PERKS[id]) return false;
    this.points -= cost;
    this.perks.push(id);
    if (PERKS[id].kind === "active" && !this.activeSkill) this.activeSkill = id;
    if (id === "ironskin") this.hp += 2; // the new heart arrives full
    return true;
  }

  // --- derived stats ---
  get maxHearts() {
    return (
      BASE_HEARTS +
      this.stats.vitality +
      this.bonusHearts +
      this.gearStat("hearts") +
      (this.hasPerk("ironskin") ? 1 : 0)
    );
  }
  get maxHp() {
    return this.maxHearts * 2;
  }
  get speed() {
    return (
      PLAYER.speed *
      (1 + SCALING.finesseSpeed * this.stats.finesse) *
      (1 + this.gearStat("speedPct") / 100) *
      (this.hasPerk("fleetfoot") ? 1.08 : 1)
    );
  }
  get damage() {
    const base = this.equippedItem("melee")?.stats.damage ?? PLAYER.attackDamage;
    return base * (1 + SCALING.mightDamage * this.stats.might);
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
    if (attrKey === "vitality") this.hp += 2;
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
    if (this.attackCd > 0 || this.isDodging) return false;
    this.attackTimer = PLAYER.attackDuration;
    this.attackCd = this.attackCooldown;
    this.attackHitSet.clear();
    return true;
  }

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
      pierce: this.hasPerk("pierce") ? 1 : 0,
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
      burn: this.hasPerk("kindling"),
    };
  }

  // The game executes the skill (it needs world access); this gates it.
  trySkill() {
    if (!this.activeSkill || this.skillCd > 0 || this.isDodging) return null;
    const perk = PERKS[this.activeSkill];
    if (perk.manaCost && this.mana < perk.manaCost) return null;
    if (perk.manaCost) this.mana -= perk.manaCost;
    this.skillCd = perk.cooldown;
    return this.activeSkill;
  }

  tryDodge(moveX, moveY) {
    if (this.dodgeCd > 0 || this.isDodging) return false;
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
    return true;
  }

  update(dt, moveX, moveY, map) {
    this.attackTimer = Math.max(0, this.attackTimer - dt);
    this.attackCd = Math.max(0, this.attackCd - dt);
    this.shootCd = Math.max(0, this.shootCd - dt);
    this.castCd = Math.max(0, this.castCd - dt);
    this.skillCd = Math.max(0, this.skillCd - dt);
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
      if (Math.hypot(moveX, moveY) > 0.1) {
        this.facing = Math.atan2(moveY, moveX);
      }
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
  }

  hitsPoint(px, py) {
    if (!this.isAttacking) return false;
    const dx = px - this.x;
    const dy = py - this.y;
    if (Math.hypot(dx, dy) > PLAYER.attackRange + 20) return false;
    let a = Math.atan2(dy, dx) - this.facing;
    while (a > Math.PI) a -= Math.PI * 2;
    while (a < -Math.PI) a += Math.PI * 2;
    return Math.abs(a) <= PLAYER.attackArc / 2;
  }

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

// ---------------------------------------------------------------------------

export class Enemy {
  constructor(x, y, type = "chaser", tier = 1) {
    this.type = type;
    this.def = ENEMY_TYPES[type];
    this.tier = tier;
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.radius = this.def.radius;
    this.maxHealth = Math.round(this.def.maxHealth * TIER_SCALE.hp(tier));
    this.health = this.maxHealth;
    this.facing = 0; // used by the knight's shield
    this.hitCd = 0;
    this.knockTimer = 0;
    this.knockX = 0;
    this.knockY = 0;
    this.flash = 0;
    this.alive = true;

    // burn status
    this.burnTime = 0;
    this.burnDps = 0;
    this.burnAcc = 0;

    // charger / boss-charge state
    this.chargeState = "idle";
    this.stateTimer = 0;
    this.chargeDirX = 0;
    this.chargeDirY = 0;

    // archer state
    this.shootTimer = 1 + Math.random();
    this.drawTimer = 0;

    // bomber state
    this.bombTimer = 1.2 + Math.random();

    // wraith state
    this.phase = "visible"; // visible | faded | materializing
    this.phaseTimer = this.def.fadeCooldown || 0;
    this.lungeTimer = 0;

    // boss state
    this.slamTimer = this.def.slamCooldown || 0;
    this.slamTelegraph = 0;
    this.slamDetonate = false;
    this.summonTimer = 4;
    this.wantsSummon = false;
  }

  get isCharging() {
    return this.chargeState === "charging";
  }
  get isWindup() {
    return this.chargeState === "windup";
  }
  get isDrawing() {
    return this.type === "archer" && this.drawTimer > 0;
  }
  get isFaded() {
    return this.phase === "faded";
  }
  get isBoss() {
    return !!this.def.boss;
  }
  get touchDamage() {
    return this.isCharging ? this.def.chargeDamage || this.def.contactDamage : this.def.contactDamage;
  }

  update(dt, player, map, projectiles, bombs) {
    this.hitCd = Math.max(0, this.hitCd - dt);
    this.flash = Math.max(0, this.flash - dt);
    this.knockTimer = Math.max(0, this.knockTimer - dt);

    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const dist = Math.hypot(dx, dy) || 1;
    const ux = dx / dist;
    const uy = dy / dist;
    this.facing = Math.atan2(dy, dx);

    if (this.knockTimer > 0) {
      this.vx = this.knockX;
      this.vy = this.knockY;
    } else if (this.isBoss) {
      this.updateBoss(dt, dist, ux, uy);
    } else if (this.type === "charger") {
      this.updateCharger(dt, dist, ux, uy, this.def);
    } else if (this.type === "archer") {
      this.updateArcher(dt, player, dist, ux, uy, projectiles);
    } else if (this.type === "bomber") {
      this.updateBomber(dt, player, dist, ux, uy, bombs);
    } else if (this.type === "wraith") {
      this.updateWraith(dt, player, dist, ux, uy);
    } else if (this.type === "knight") {
      this.vx = ux * this.def.speed;
      this.vy = uy * this.def.speed;
    } else {
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
    this.x = Math.max(this.radius, Math.min(LOGICAL_W - this.radius, this.x));
    this.y = Math.max(this.radius, Math.min(LOGICAL_H - this.radius, this.y));
  }

  updateCharger(dt, dist, ux, uy, d) {
    this.stateTimer = Math.max(0, this.stateTimer - dt);
    if (this.chargeState === "idle") {
      this.vx = ux * d.speed;
      this.vy = uy * d.speed;
      if (dist < d.triggerRange) {
        this.chargeState = "windup";
        this.stateTimer = d.windupTime;
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
      this.vx = ux * d.speed * 0.5;
      this.vy = uy * d.speed * 0.5;
      if (this.stateTimer <= 0) this.chargeState = "idle";
    }
  }

  updateArcher(dt, player, dist, ux, uy, projectiles) {
    const d = this.def;
    if (this.drawTimer > 0) {
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

  updateBomber(dt, player, dist, ux, uy, bombs) {
    const d = this.def;
    if (dist < d.fleeRange) {
      this.vx = -ux * d.speed;
      this.vy = -uy * d.speed;
    } else if (dist > d.throwRange) {
      this.vx = ux * d.speed;
      this.vy = uy * d.speed;
    } else {
      this.vx = 0;
      this.vy = 0;
      this.bombTimer -= dt;
      if (this.bombTimer <= 0 && bombs) {
        // Lob a bomb at where the player IS — moving answers it.
        bombs.push(new Bomb(player.x, player.y, d.bombFuse, d.bombRadius, d.bombDamage));
        this.bombTimer = d.bombCooldown;
      }
    }
  }

  updateWraith(dt, player, dist, ux, uy) {
    const d = this.def;
    this.phaseTimer -= dt;
    if (this.phase === "visible") {
      // Drift, or lunge right after materializing.
      const speed = this.lungeTimer > 0 ? d.lungeSpeed : d.speed;
      this.lungeTimer = Math.max(0, this.lungeTimer - dt);
      this.vx = ux * speed;
      this.vy = uy * speed;
      if (this.phaseTimer <= 0) {
        this.phase = "faded";
        this.phaseTimer = d.fadeTime;
        this.vx = 0;
        this.vy = 0;
      }
    } else if (this.phase === "faded") {
      this.vx = 0;
      this.vy = 0;
      if (this.phaseTimer <= 0) {
        // Reappear near the player.
        const a = Math.random() * Math.PI * 2;
        this.x = Math.max(30, Math.min(LOGICAL_W - 30, player.x + Math.cos(a) * d.blinkRange));
        this.y = Math.max(30, Math.min(LOGICAL_H - 30, player.y + Math.sin(a) * d.blinkRange));
        this.phase = "materializing";
        this.phaseTimer = d.materializeTime;
      }
    } else {
      // materializing: shimmer tell, harmless, then lunge
      this.vx = 0;
      this.vy = 0;
      if (this.phaseTimer <= 0) {
        this.phase = "visible";
        this.phaseTimer = d.fadeCooldown;
        this.lungeTimer = d.lungeTime;
      }
    }
  }

  updateBoss(dt, dist, ux, uy) {
    const d = this.def;
    this.summonTimer -= dt;
    if (this.summonTimer <= 0) {
      this.wantsSummon = true; // the game spawns the husks
      this.summonTimer = d.summonCooldown;
    }

    if (this.slamTelegraph > 0) {
      this.vx = 0;
      this.vy = 0;
      this.slamTelegraph -= dt;
      if (this.slamTelegraph <= 0) this.slamDetonate = true; // game resolves it
      return;
    }

    // Below half health: use the charger pattern between slams.
    if (this.health < this.maxHealth / 2 && this.chargeState !== "idle") {
      this.updateCharger(dt, dist, ux, uy, {
        speed: d.speed,
        triggerRange: 200,
        windupTime: d.windupTime,
        chargeSpeed: d.chargeSpeed,
        chargeTime: d.chargeTime,
        recoverTime: 1.2,
      });
      return;
    }

    this.slamTimer -= dt;
    if (this.slamTimer <= 0 && dist < d.slamRadius * 1.2) {
      this.slamTelegraph = d.slamTelegraph;
      this.slamTimer = d.slamCooldown;
      return;
    }

    if (this.health < this.maxHealth / 2 && dist < 200 && Math.random() < 0.008) {
      this.chargeState = "windup";
      this.stateTimer = d.windupTime;
      this.chargeDirX = ux;
      this.chargeDirY = uy;
    }

    this.vx = ux * d.speed;
    this.vy = uy * d.speed;
  }

  // Returns "hit", "blocked" (knight shield), or "immune" (faded wraith).
  takeDamage(amount, fromX, fromY, opts = {}) {
    if (this.isFaded) return "immune";
    if (this.type === "knight" && !opts.ignoreBlock) {
      let a = Math.atan2(fromY - this.y, fromX - this.x) - this.facing;
      while (a > Math.PI) a -= Math.PI * 2;
      while (a < -Math.PI) a += Math.PI * 2;
      if (Math.abs(a) <= this.def.blockArc / 2) return "blocked";
    }
    this.health -= amount;
    this.flash = 0.12;
    const dx = this.x - fromX;
    const dy = this.y - fromY;
    const dnorm = Math.hypot(dx, dy) || 1;
    this.knockX = (dx / dnorm) * this.def.knockback;
    this.knockY = (dy / dnorm) * this.def.knockback;
    this.knockTimer = 0.12;
    if (this.isWindup && !this.isBoss) {
      this.chargeState = "recover";
      this.stateTimer = 0.6;
    }
    if (this.health <= 0) this.alive = false;
    return "hit";
  }

  applyBurn(dps, dur = 3) {
    this.burnTime = Math.max(this.burnTime, dur);
    this.burnDps = Math.max(this.burnDps, dps);
  }
}

// ---------------------------------------------------------------------------

export class Projectile {
  constructor({ kind, x, y, angle, speed, damage, radius, friendly, range = 420, pierce = 0, burn = false }) {
    this.kind = kind;
    this.x = x;
    this.y = y;
    this.angle = angle;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.damage = damage;
    this.radius = radius;
    this.friendly = friendly;
    this.range = range;
    this.pierce = pierce;
    this.burn = burn;
    this.traveled = 0;
    this.alive = true;
    this.hitSet = new Set(); // enemies already pierced through
  }

  update(dt, map) {
    const sx = this.vx * dt;
    const sy = this.vy * dt;
    this.x += sx;
    this.y += sy;
    this.traveled += Math.hypot(sx, sy);
    if (this.traveled > this.range) this.alive = false;
    if (map.projectileBlocked(this.x, this.y, this.radius)) this.alive = false;
    if (this.x < -20 || this.x > LOGICAL_W + 20 || this.y < -20 || this.y > LOGICAL_H + 20) {
      this.alive = false;
    }
  }
}

// A lobbed bomb: lands at a spot, fuse ticks with a growing ring, then booms.
// The game resolves the explosion (damage, shake, particles).
export class Bomb {
  constructor(x, y, fuse, radius, damage) {
    this.x = x;
    this.y = y;
    this.fuse = fuse;
    this.maxFuse = fuse;
    this.radius = radius;
    this.damage = damage;
    this.exploded = false;
    this.alive = true;
  }

  update(dt) {
    this.fuse -= dt;
    if (this.fuse <= 0 && !this.exploded) this.exploded = true; // game resolves
  }
}

export class Pickup {
  constructor(type, x, y, amount = 0) {
    this.type = type; // "gold" | "heart"
    this.x = x;
    this.y = y;
    this.amount = amount;
    this.radius = type === "gold" ? 7 : 9;
    this.t = Math.random() * Math.PI * 2;
  }
}
