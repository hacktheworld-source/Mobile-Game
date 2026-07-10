// Game entities: Player (movement + attack + dodge roll) and Enemy (chaser).
// All units are in CSS pixels; time deltas (dt) are in seconds.

export const PLAYER = {
  radius: 18,
  speed: 230,
  maxHealth: 100,
  // Attack
  attackCooldown: 0.3,
  attackDuration: 0.18, // how long the swing arc is "live" / drawn
  attackRange: 72,
  attackArc: Math.PI * 0.6, // ~108° cone in front of facing
  attackDamage: 40,
  // Dodge roll
  dodgeCooldown: 0.75,
  dodgeDuration: 0.22,
  dodgeSpeed: 620,
  // i-frames last the whole roll
};

export class Player {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.radius = PLAYER.radius;
    this.health = PLAYER.maxHealth;
    this.facing = -Math.PI / 2; // pointing up initially

    this.attackTimer = 0; // > 0 while swing is live
    this.attackCd = 0;
    this.attackHitSet = new Set(); // enemies already hit by current swing

    this.dodgeTimer = 0; // > 0 while rolling
    this.dodgeCd = 0;
    this.dodgeDirX = 0;
    this.dodgeDirY = 0;

    this.alive = true;
  }

  get isDodging() {
    return this.dodgeTimer > 0;
  }
  get isAttacking() {
    return this.attackTimer > 0;
  }
  get invulnerable() {
    return this.isDodging;
  }

  tryAttack() {
    if (this.attackCd > 0 || this.isDodging) return;
    this.attackTimer = PLAYER.attackDuration;
    this.attackCd = PLAYER.attackCooldown;
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
    this.dodgeCd = PLAYER.dodgeCooldown;
  }

  update(dt, moveX, moveY, bounds) {
    // Timers
    this.attackTimer = Math.max(0, this.attackTimer - dt);
    this.attackCd = Math.max(0, this.attackCd - dt);
    this.dodgeCd = Math.max(0, this.dodgeCd - dt);
    this.dodgeTimer = Math.max(0, this.dodgeTimer - dt);

    if (this.isDodging) {
      this.vx = this.dodgeDirX * PLAYER.dodgeSpeed;
      this.vy = this.dodgeDirY * PLAYER.dodgeSpeed;
    } else {
      this.vx = moveX * PLAYER.speed;
      this.vy = moveY * PLAYER.speed;
      // Update facing from movement intent (feels responsive for a melee char).
      if (Math.hypot(moveX, moveY) > 0.1) {
        this.facing = Math.atan2(moveY, moveX);
      }
    }

    this.x += this.vx * dt;
    this.y += this.vy * dt;

    // Clamp to arena.
    this.x = Math.max(bounds.x + this.radius, Math.min(bounds.x + bounds.w - this.radius, this.x));
    this.y = Math.max(bounds.y + this.radius, Math.min(bounds.y + bounds.h - this.radius, this.y));
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

  takeDamage(amount) {
    if (this.invulnerable) return;
    this.health -= amount;
    if (this.health <= 0) {
      this.health = 0;
      this.alive = false;
    }
  }
}

export const ENEMY = {
  radius: 15,
  speed: 92,
  maxHealth: 100,
  contactDamage: 10,
  hitInterval: 0.55, // min seconds between damage ticks on the player
  knockback: 260,
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

  update(dt, player, bounds) {
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

    this.x += this.vx * dt;
    this.y += this.vy * dt;

    this.x = Math.max(bounds.x + this.radius, Math.min(bounds.x + bounds.w - this.radius, this.x));
    this.y = Math.max(bounds.y + this.radius, Math.min(bounds.y + bounds.h - this.radius, this.y));
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
