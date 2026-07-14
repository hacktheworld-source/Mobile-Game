// Game: the current screen (tilemap, enemies, projectiles, bombs, pickups),
// the world graph, doors & dungeons, NPCs & dialogue, RPG progression, the
// juice layer, autosave, and rendering.

import { Player, Enemy, Pickup, Projectile, Bomb, PLAYER } from "./entities.js";
import { Input, consumeActions } from "./input.js";
import { TileMap, TILE_SIZE, LOGICAL_W, LOGICAL_H } from "./engine/tilemap.js";
import { writeSave } from "./engine/save.js";
import { FX, shake, hitStop, burst, floatText, updateFX, shakeOffset, renderFX } from "./engine/fx.js";
import { sfx } from "./engine/audio.js";
import { World } from "./world/world.js";
import { SCREENS, HOME_ID, HOME_SPAWN, tierOf } from "./world/screens.js";
import { getDialogue } from "./world/dialogue.js";
import { xpNeeded } from "./rpg/stats.js";
import { ITEMS } from "./rpg/items.js";
import { PERKS, PERK_COST, SKILL_LABELS } from "./rpg/perks.js";
import { TIER_SCALE } from "./rpg/enemies.js";

const COLORS = {
  page: "#0e1016",
  player: "#4dd6a1",
  playerDodge: "#5aa9ff",
  enemyFlash: "#ffffff",
  swing: "rgba(255,107,107,0.35)",
  accent: "#4dd6a1",
  gold: "#ffd166",
  heart: "#ff5470",
  burn: "#ff9a3d",
};

const TRANSITION_DUR = 0.5;
const EDGE_OUT = 6;
const EDGE_IN = PLAYER.radius + 8;
const AUTOSAVE_INTERVAL = 4;
const PICKUP_RANGE = 30;

const tileCenter = (t) => (t + 0.5) * TILE_SIZE;

export class Game {
  constructor(canvas, hud) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.hud = hud;
    this.state = "menu"; // menu | playing | paused | transition | dead
    this.onGameOver = null;
    this.onShopOpen = null;
    this.onDialogueOpen = null; // (lines, onDone)
    this.onHudChange = null;

    this.world = new World(SCREENS);
    this.map = null;
    this.maps = new Map();
    this.player = null;
    this.enemies = [];
    this.pickups = [];
    this.projectiles = [];
    this.bombs = [];
    this.pouch = null;
    this.kills = 0;
    this.flags = {};
    this.shopLatch = false;
    this.npcLatch = false;
    this.doorCd = 0; // grace period so doors don't instantly re-trigger
    this.lockMsgCd = 0;
    this.whirlTimer = 0;

    this.time = 0;
    this.bannerText = "";
    this.bannerTimer = 0;
    this.transitionTimer = 0;
    this.pendingDir = null;
    this.pendingDoor = null;
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
    this.scale = Math.min(this.viewW / LOGICAL_W, this.viewH / LOGICAL_H);
    this.offX = (this.viewW - LOGICAL_W * this.scale) / 2;
    this.offY = (this.viewH - LOGICAL_H * this.scale) / 2;
  }

  // ---------- run lifecycle ----------

  startNew() {
    this.player = new Player(tileCenter(HOME_SPAWN.x), tileCenter(HOME_SPAWN.y));
    this.kills = 0;
    this.pouch = null;
    this.flags = {};
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
    this.kills = save.kills || 0;
    this.pouch = save.pouch || null;
    this.player.mode = save.mode || "sword";
    if (save.inventory) this.player.inventory = [...save.inventory];
    if (save.equipment) this.player.equipment = { ...this.player.equipment, ...save.equipment };
    this.player.perks = [...(save.perks || [])];
    this.player.activeSkill = save.activeSkill || null;
    this.player.bonusHearts = save.bonusHearts || 0;
    this.flags = save.flags || {};
    // Set hp only after gear/perks are on — bonus hearts count toward the cap.
    this.player.hp = Math.min(save.hp ?? this.player.maxHp, this.player.maxHp);
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
    const tier = tierOf(id);
    if (!this.maps.has(id)) this.maps.set(id, new TileMap(screen.tiles, screen.theme));
    this.map = this.maps.get(id);
    this.enemies = screen.safe
      ? []
      : (screen.enemies || [])
          .filter((e) => !e.unlessFlag || !this.flags[e.unlessFlag])
          .map((e) => new Enemy(tileCenter(e.x), tileCenter(e.y), e.type || "chaser", tier));
    this.pickups = [];
    this.projectiles = [];
    this.bombs = [];
    this.doorCd = 0.9;
    this.shopLatch = true; // require stepping away first if you spawn nearby
    this.npcLatch = true;
    if (this.player) {
      this.player.attackTimer = 0;
      this.player.dodgeTimer = 0;
    }
    this.flags["seen:" + id] = true;
    this.bannerText = screen.name;
    this.bannerTimer = 1.4;
    if (this.enemies.some((e) => e.isBoss)) sfx.bossRoar();
    this.updateHud();
  }

  buildSave() {
    const p = this.player;
    return {
      v: 4,
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
      inventory: [...p.inventory],
      equipment: { ...p.equipment },
      perks: [...p.perks],
      activeSkill: p.activeSkill,
      bonusHearts: p.bonusHearts,
      flags: { ...this.flags },
    };
  }

  saveNow() {
    if (this.player) writeSave(this.buildSave());
  }

  // ---------- menus / shop / perks ----------

  openSheet() {
    if (this.state !== "playing") return false;
    this.state = "paused";
    return true;
  }
  closeSheet() {
    if (this.state === "paused") this.state = "playing";
  }
  openShop() {
    if (this.state !== "playing") return false;
    this.state = "paused";
    this.shopLatch = true;
    return true;
  }
  closeShop() {
    if (this.state === "paused") this.state = "playing";
  }
  closeDialogue() {
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

  buyPerk(id) {
    if (this.player && this.player.buyPerk(id, PERK_COST)) {
      sfx.buy();
      this.updateHud();
      this.saveNow();
      return true;
    }
    return false;
  }

  setActiveSkill(id) {
    const p = this.player;
    if (p && p.hasPerk(id) && PERKS[id]?.kind === "active") {
      p.activeSkill = id;
      this.updateHud();
      this.saveNow();
      return true;
    }
    return false;
  }

  buyItem(id) {
    const p = this.player;
    const it = ITEMS[id];
    if (!it || p.ownsItem(id) || p.gold < it.price) return false;
    p.gold -= it.price;
    p.inventory.push(id);
    if (!p.equipment[it.slot]) p.equip(id);
    sfx.buy();
    this.updateHud();
    this.saveNow();
    return true;
  }

  equipItem(id) {
    if (this.player.equip(id)) {
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
    updateFX(dt);
    if (FX.hitStop > 0) {
      FX.hitStop = Math.max(0, FX.hitStop - dt);
      return; // the world holds its breath
    }
    if (this.state === "playing") this.updatePlaying(dt);
    else if (this.state === "transition") this.updateTransition(dt);
  }

  updatePlaying(dt) {
    const p = this.player;
    this.bannerTimer = Math.max(0, this.bannerTimer - dt);
    this.doorCd = Math.max(0, this.doorCd - dt);
    this.lockMsgCd = Math.max(0, this.lockMsgCd - dt);
    this.whirlTimer = Math.max(0, this.whirlTimer - dt);

    // --- input ---
    if (Input.attackPressed) {
      if (p.mode === "sword") {
        if (p.tryAttack()) sfx.swing();
      } else {
        const angle = this.autoAimAngle();
        const shot = p.mode === "bow" ? p.tryShoot(angle) : p.tryCast(angle);
        if (shot) {
          this.projectiles.push(new Projectile(shot));
          (p.mode === "bow" ? sfx.shoot : sfx.cast)();
        }
      }
    }
    if (Input.dodgePressed && p.tryDodge(Input.moveX, Input.moveY)) sfx.dodge();
    if (Input.skillPressed) {
      const skill = p.trySkill();
      if (skill) this.executeSkill(skill);
    }
    consumeActions();

    p.update(dt, Input.moveX, Input.moveY, this.map);

    // --- edge travel ---
    const exitDir = this.edgeExitDir();
    if (exitDir) {
      const nid = this.world.neighborId(exitDir);
      if (nid) {
        this.beginTransition({ dir: exitDir });
        return;
      }
      p.x = Math.max(p.radius, Math.min(LOGICAL_W - p.radius, p.x));
      p.y = Math.max(p.radius, Math.min(LOGICAL_H - p.radius, p.y));
    }

    // --- doors ---
    if (this.doorCd <= 0) {
      for (const door of this.world.current.doors || []) {
        if (Math.hypot(tileCenter(door.x) - p.x, tileCenter(door.y) - p.y) < p.radius + 14) {
          if (door.locked && !this.flags[door.locked]) {
            if (this.lockMsgCd <= 0) {
              this.bannerText = "LOCKED — the key lies within the barrow";
              this.bannerTimer = 1.4;
              sfx.locked();
              this.lockMsgCd = 1.6;
            }
          } else {
            sfx.door();
            this.beginTransition({ door });
            return;
          }
        }
      }
    }

    // --- enemies ---
    for (const e of this.enemies) {
      e.update(dt, p, this.map, this.projectiles, this.bombs);

      // burn dot (ignores shields by design)
      if (e.burnTime > 0 && e.alive) {
        e.burnTime -= dt;
        e.burnAcc += e.burnDps * dt;
        if (e.burnAcc >= 6) {
          e.health -= e.burnAcc;
          floatText(e.x, e.y - e.radius - 6, String(Math.round(e.burnAcc)), COLORS.burn, 11);
          e.burnAcc = 0;
          if (Math.random() < 0.5) burst(e.x, e.y, COLORS.burn, 3, 60, 0.3, 2);
          if (e.health <= 0) {
            e.alive = false;
            this.onEnemyKilled(e, "burn");
            continue;
          }
        }
      }

      // player melee swing
      if (p.isAttacking && !p.attackHitSet.has(e)) {
        if (p.hitsPoint(e.x, e.y)) {
          p.attackHitSet.add(e);
          this.dealDamage(e, p.damage, p.x, p.y, "melee");
        }
      }

      // boss mechanics resolved game-side
      if (e.isBoss) {
        if (e.slamDetonate) {
          e.slamDetonate = false;
          this.resolveSlam(e);
        }
        if (e.wantsSummon) {
          e.wantsSummon = false;
          this.bossSummon(e);
        }
      }

      // contact damage
      const dist = Math.hypot(e.x - p.x, e.y - p.y);
      if (dist < e.radius + p.radius && e.hitCd <= 0 && !e.isFaded) {
        if (this.damagePlayer(e.touchDamage)) e.hitCd = e.def.hitInterval;
      }
    }

    this.separateEnemies();
    this.enemies = this.enemies.filter((e) => e.alive);

    this.updateProjectiles(dt);
    this.updateBombs(dt);
    this.updatePickups(dt);
    this.updateChestsShopNpc();

    if (!p.alive) {
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

  // Centralized enemy-damage entry: handles block/immune feedback + kill credit.
  dealDamage(e, amount, fromX, fromY, source) {
    const result = e.takeDamage(amount, fromX, fromY);
    if (result === "blocked") {
      floatText(e.x, e.y - e.radius - 8, "CLANK", "#aab3c8", 11);
      burst(e.x, e.y, "#aab3c8", 4, 90, 0.25, 2);
      sfx.locked();
      return result;
    }
    if (result === "immune") {
      floatText(e.x, e.y - e.radius - 8, "···", "#9db8d9", 11);
      return result;
    }
    floatText(e.x, e.y - e.radius - 8, String(Math.round(amount)), "#ffffff", 12);
    burst(e.x, e.y, e.def.color, 6, 120, 0.35);
    hitStop(0.035);
    shake(e.isBoss ? 3 : 2, 0.1);
    sfx.hit();
    if (!e.alive) this.onEnemyKilled(e, source);
    return result;
  }

  damagePlayer(amount) {
    const landed = this.player.takeDamage(amount);
    if (landed) {
      sfx.hurt();
      shake(5, 0.22);
      hitStop(0.05);
      burst(this.player.x, this.player.y, COLORS.heart, 8, 140, 0.4);
    }
    return landed;
  }

  onEnemyKilled(e, source) {
    const tier = e.tier || 1;
    this.kills += 1;
    const leveled = this.player.gainXP(Math.round(e.def.xp * TIER_SCALE.xp(tier)));
    if (leveled) {
      sfx.levelup();
      floatText(this.player.x, this.player.y - 30, "LEVEL UP!", COLORS.accent, 16);
      burst(this.player.x, this.player.y, COLORS.accent, 14, 160, 0.6);
    }
    let gold = e.def.goldMin + Math.floor(Math.random() * (e.def.goldMax - e.def.goldMin + 1));
    gold = Math.round(gold * TIER_SCALE.gold(tier) * (1 + this.player.gearStat("goldPct") / 100));
    this.pickups.push(new Pickup("gold", e.x, e.y, gold));
    if (Math.random() < e.def.heartDropChance) {
      this.pickups.push(new Pickup("heart", e.x + 14, e.y - 8));
    }
    burst(e.x, e.y, e.def.color, 14, 170, 0.5, 4);
    sfx.kill();

    // Lifesteal: sword kills can restore half a heart.
    if (source === "melee" && this.player.hasPerk("lifesteal") && Math.random() < 0.25) {
      this.player.heal(1);
      floatText(this.player.x, this.player.y - 26, "+♥", COLORS.heart, 13);
    }

    if (e.isBoss) {
      this.flags.barrow_cleansed = true;
      this.bannerText = "THE BARROW SLEEPS";
      this.bannerTimer = 3;
      shake(8, 0.5);
      sfx.victory();
      this.pickups.push(new Pickup("heart", e.x - 20, e.y));
      this.pickups.push(new Pickup("heart", e.x + 20, e.y));
      this.saveNow();
    }
  }

  resolveSlam(boss) {
    const d = boss.def;
    shake(7, 0.3);
    sfx.bomb();
    burst(boss.x, boss.y, "#7a4dd6", 22, 220, 0.5, 4);
    const dist = Math.hypot(this.player.x - boss.x, this.player.y - boss.y);
    if (dist < d.slamRadius + this.player.radius) this.damagePlayer(d.slamDamage);
  }

  bossSummon(boss) {
    const minions = this.enemies.filter((e) => !e.isBoss).length;
    for (let i = minions; i < boss.def.summonCap; i++) {
      const a = Math.random() * Math.PI * 2;
      const x = Math.max(30, Math.min(LOGICAL_W - 30, boss.x + Math.cos(a) * 70));
      const y = Math.max(30, Math.min(LOGICAL_H - 30, boss.y + Math.sin(a) * 70));
      this.enemies.push(new Enemy(x, y, "chaser", 2));
      burst(x, y, "#7a4dd6", 8, 120, 0.4);
    }
  }

  executeSkill(id) {
    const p = this.player;
    if (id === "whirlwind") {
      this.whirlTimer = 0.25;
      shake(4, 0.18);
      sfx.swing();
      burst(p.x, p.y, COLORS.swing.replace("0.35", "1"), 16, 200, 0.4);
      for (const e of [...this.enemies]) {
        if (Math.hypot(e.x - p.x, e.y - p.y) < PLAYER.attackRange + e.radius) {
          this.dealDamage(e, p.damage * 1.6, p.x, p.y, "melee");
        }
      }
    } else if (id === "volley") {
      sfx.shoot();
      const center = this.autoAimAngle();
      for (let i = -2; i <= 2; i++) {
        this.projectiles.push(
          new Projectile({
            kind: "arrow",
            x: p.x,
            y: p.y,
            angle: center + i * 0.18,
            speed: PLAYER.bowSpeed,
            damage: p.bowDamage,
            radius: 4,
            friendly: true,
            pierce: p.hasPerk("pierce") ? 1 : 0,
          })
        );
      }
    } else if (id === "nova") {
      sfx.nova();
      shake(4, 0.2);
      burst(p.x, p.y, COLORS.burn, 20, 190, 0.5);
      for (let i = 0; i < 8; i++) {
        this.projectiles.push(
          new Projectile({
            kind: "firebolt",
            x: p.x,
            y: p.y,
            angle: (i / 8) * Math.PI * 2,
            speed: PLAYER.spellSpeed,
            damage: p.spellDamage * 0.8,
            radius: 6,
            friendly: true,
            burn: true,
          })
        );
      }
    }
    this.updateHud();
  }

  autoAimAngle() {
    const p = this.player;
    let best = null;
    let bestScore = Infinity;
    for (const e of this.enemies) {
      if (e.isFaded) continue;
      const dx = e.x - p.x;
      const dy = e.y - p.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 280) continue;
      let diff = Math.atan2(dy, dx) - p.facing;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      if (Math.abs(diff) > 0.65) continue;
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
          if (!e.alive || pr.hitSet.has(e)) continue;
          if (Math.hypot(e.x - pr.x, e.y - pr.y) < e.radius + pr.radius) {
            const res = this.dealDamage(
              e,
              pr.damage,
              pr.x - Math.cos(pr.angle) * 20,
              pr.y - Math.sin(pr.angle) * 20,
              pr.kind
            );
            if (res === "hit" && pr.burn && e.alive) {
              e.applyBurn(8 * (1 + 0.08 * p.stats.focus));
            }
            if (res === "blocked" || pr.pierce <= 0) {
              pr.alive = false;
            } else {
              pr.pierce -= 1;
              pr.hitSet.add(e);
            }
            break;
          }
        }
      } else if (Math.hypot(p.x - pr.x, p.y - pr.y) < p.radius + pr.radius) {
        if (this.damagePlayer(pr.damage)) pr.alive = false;
      }
    }
    this.enemies = this.enemies.filter((e) => e.alive);
    this.projectiles = this.projectiles.filter((pr) => pr.alive);
  }

  updateBombs(dt) {
    for (const b of this.bombs) {
      b.update(dt);
      if (b.exploded && b.alive) {
        b.alive = false;
        shake(5, 0.25);
        sfx.bomb();
        burst(b.x, b.y, COLORS.burn, 18, 200, 0.5, 4);
        if (Math.hypot(this.player.x - b.x, this.player.y - b.y) < b.radius + this.player.radius) {
          this.damagePlayer(b.damage);
        }
      }
    }
    this.bombs = this.bombs.filter((b) => b.alive);
  }

  updatePickups(dt) {
    const p = this.player;
    for (const pk of this.pickups) {
      pk.t += dt * 4;
      if (Math.hypot(pk.x - p.x, pk.y - p.y) < PICKUP_RANGE) {
        if (pk.type === "gold") {
          p.gold += pk.amount;
          floatText(pk.x, pk.y - 10, "+" + pk.amount, COLORS.gold, 12);
          sfx.coin();
        } else {
          p.heal(2);
          floatText(pk.x, pk.y - 10, "+♥", COLORS.heart, 13);
          sfx.heart();
        }
        pk.collected = true;
      }
    }
    this.pickups = this.pickups.filter((pk) => !pk.collected);

    if (this.pouch && this.pouch.screenId === this.world.currentId) {
      if (Math.hypot(this.pouch.x - p.x, this.pouch.y - p.y) < PICKUP_RANGE + 6) {
        p.gold += this.pouch.amount;
        floatText(this.pouch.x, this.pouch.y - 12, "+" + this.pouch.amount, COLORS.gold, 14);
        this.pouch = null;
        this.bannerText = "GOLD RECLAIMED";
        this.bannerTimer = 1.2;
        sfx.chest();
        this.saveNow();
      }
    }
  }

  updateChestsShopNpc() {
    const screen = this.world.current;
    const p = this.player;

    for (const chest of screen.chests || []) {
      const key = `chest:${chest.id}`;
      if (this.flags[key]) continue;
      if (Math.hypot(tileCenter(chest.x) - p.x, tileCenter(chest.y) - p.y) < p.radius + 20) {
        this.flags[key] = true;
        sfx.chest();
        burst(tileCenter(chest.x), tileCenter(chest.y), COLORS.gold, 12, 140, 0.5);
        if (chest.gold) {
          p.gold += chest.gold;
          this.bannerText = `+${chest.gold} GOLD`;
        } else if (chest.item && !p.ownsItem(chest.item)) {
          p.inventory.push(chest.item);
          if (!p.equipment[ITEMS[chest.item].slot]) p.equip(chest.item);
          this.bannerText = ITEMS[chest.item].name.toUpperCase() + "!";
        } else if (chest.flag) {
          this.flags[chest.flag] = true;
          this.bannerText = (chest.flagName || chest.flag).toUpperCase() + "!";
        } else if (chest.hearts) {
          p.bonusHearts += chest.hearts;
          p.hp += chest.hearts * 2;
          this.bannerText = "HEART CONTAINER!";
          sfx.heart();
        }
        this.bannerTimer = 1.6;
        this.saveNow();
      }
    }

    if (screen.shop) {
      const d = Math.hypot(tileCenter(screen.shop.x) - p.x, tileCenter(screen.shop.y) - p.y);
      if (d < 46 && !this.shopLatch) {
        if (this.onShopOpen && this.openShop()) this.onShopOpen();
      } else if (d > 70) {
        this.shopLatch = false;
      }
    }

    for (const npc of screen.npcs || []) {
      const d = Math.hypot(tileCenter(npc.x) - p.x, tileCenter(npc.y) - p.y);
      if (d < 48 && !this.npcLatch) {
        const dlg = getDialogue(npc.dialogue, this);
        if (this.onDialogueOpen && this.state === "playing") {
          this.state = "paused";
          this.npcLatch = true;
          this.onDialogueOpen(npc, dlg.lines, () => {
            if (dlg.onDone) dlg.onDone();
            this.closeDialogue();
            this.updateHud();
            this.saveNow();
          });
        }
      } else if (d > 76) {
        this.npcLatch = false;
      }
    }
  }

  die() {
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
    sfx.die();
    shake(6, 0.4);
    this.state = "dead";
    this.saveNow();
    if (this.onGameOver) {
      this.onGameOver({ kills: this.kills, dropped, screenName: this.world.current.name });
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

  beginTransition({ dir = null, door = null }) {
    this.state = "transition";
    this.pendingDir = dir;
    this.pendingDoor = door;
    this.transitionTimer = TRANSITION_DUR;
    this.swapped = false;
  }

  updateTransition(dt) {
    this.transitionTimer = Math.max(0, this.transitionTimer - dt);
    const elapsedFrac = 1 - this.transitionTimer / TRANSITION_DUR;

    if (!this.swapped && elapsedFrac >= 0.5) {
      this.swapped = true;
      const p = this.player;
      if (this.pendingDoor) {
        const door = this.pendingDoor;
        this.enterScreen(door.to);
        p.x = tileCenter(door.spawn.x);
        p.y = tileCenter(door.spawn.y);
      } else {
        const dir = this.pendingDir;
        this.enterScreen(this.world.neighborId(dir));
        if (dir === "left") p.x = LOGICAL_W - EDGE_IN;
        else if (dir === "right") p.x = EDGE_IN;
        else if (dir === "top") p.y = LOGICAL_H - EDGE_IN;
        else if (dir === "bottom") p.y = EDGE_IN;
        p.x = Math.max(p.radius, Math.min(LOGICAL_W - p.radius, p.x));
        p.y = Math.max(p.radius, Math.min(LOGICAL_H - p.radius, p.y));
      }
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
          a.x -= (dx / d) * push;
          a.y -= (dy / d) * push;
          b.x += (dx / d) * push;
          b.y += (dy / d) * push;
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
    this.hud.manaFill.style.width = (p.mana / PLAYER.manaMax) * 100 + "%";

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

    const modeLabels = { sword: "SWORD", bow: "BOW", spell: "FIRE" };
    this.hud.modeBtn.textContent = modeLabels[p.mode];
    this.hud.modeBtn.dataset.mode = p.mode;

    // SKILL button: hidden until an active perk is owned.
    const skill = p.activeSkill;
    this.hud.skillBtn.classList.toggle("hidden", !skill);
    if (skill) {
      this.hud.skillBtn.textContent = SKILL_LABELS[skill] || "SKILL";
      const perk = PERKS[skill];
      const notReady = p.skillCd > 0 || (perk.manaCost && p.mana < perk.manaCost);
      this.hud.skillBtn.classList.toggle("cooling", notReady);
    }

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
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.fillStyle = COLORS.page;
    ctx.fillRect(0, 0, this.viewW, this.viewH);
    if (!this.map) return;

    const s = this.dpr * this.scale;
    const off = shakeOffset();
    ctx.setTransform(s, 0, 0, s, this.dpr * (this.offX + off.x * this.scale), this.dpr * (this.offY + off.y * this.scale));

    this.map.draw(ctx);
    if (this.state === "menu") return;

    this.renderDoors(ctx);
    this.renderChestsAndShop(ctx);
    this.renderNpcs(ctx);
    this.renderPickups(ctx);
    this.renderPouch(ctx);
    this.renderBombs(ctx);
    this.renderEnemies(ctx);
    this.renderProjectiles(ctx);
    this.renderPlayer(ctx);
    renderFX(ctx);
    this.renderBossBar(ctx);
    this.renderBanner(ctx);
    this.renderTransition(ctx);
  }

  renderDoors(ctx) {
    for (const door of this.world.current.doors || []) {
      const x = tileCenter(door.x);
      const y = tileCenter(door.y);
      const locked = door.locked && !this.flags[door.locked];
      const pulse = 0.5 + 0.5 * Math.sin(this.time * 3);
      ctx.save();
      ctx.shadowColor = locked ? "#ff5470" : "#7a4dd6";
      ctx.shadowBlur = 8 + 6 * pulse;
      // Arch
      ctx.fillStyle = locked ? "#4a2233" : "#2d2740";
      ctx.fillRect(x - 14, y - 16, 28, 30);
      ctx.fillStyle = locked ? "#2a1522" : "#0e1016";
      ctx.beginPath();
      ctx.arc(x, y - 2, 9, Math.PI, 0);
      ctx.rect(x - 9, y - 2, 18, 15);
      ctx.fill();
      ctx.restore();
      if (locked) {
        ctx.fillStyle = "#ff5470";
        ctx.font = "800 10px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("🔒".length ? "×" : "×", x, y + 6);
      }
    }
  }

  renderNpcs(ctx) {
    for (const npc of this.world.current.npcs || []) {
      const x = tileCenter(npc.x);
      const y = tileCenter(npc.y);
      ctx.fillStyle = npc.color;
      ctx.beginPath();
      ctx.arc(x, y, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#0e1016";
      ctx.lineWidth = 3;
      ctx.stroke();
      // A soft "!" prompt if their story has moved on.
      const bob = Math.sin(this.time * 3) * 2;
      ctx.fillStyle = COLORS.gold;
      ctx.font = "800 13px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("!", x, y - 20 + bob);
      ctx.fillStyle = "rgba(232,236,245,0.75)";
      ctx.font = "700 9px sans-serif";
      ctx.fillText(npc.name, x, y + 28);
    }
  }

  renderChestsAndShop(ctx) {
    const screen = this.world.current;
    for (const chest of screen.chests || []) {
      const cx = tileCenter(chest.x);
      const cy = tileCenter(chest.y);
      const opened = this.flags[`chest:${chest.id}`];
      ctx.fillStyle = opened ? "#3a3226" : "#6b5230";
      ctx.fillRect(cx - 11, cy - 9, 22, 18);
      ctx.strokeStyle = opened ? "#4a4234" : "#ffd166";
      ctx.lineWidth = 2;
      ctx.strokeRect(cx - 11, cy - 9, 22, 18);
      if (!opened) {
        ctx.fillStyle = "#ffd166";
        ctx.fillRect(cx - 2, cy - 9, 4, 8);
      }
    }
    if (screen.shop) {
      const sx = tileCenter(screen.shop.x);
      const sy = tileCenter(screen.shop.y);
      const pulse = 0.5 + 0.5 * Math.sin(this.time * 3);
      ctx.fillStyle = "#5a4630";
      ctx.fillRect(sx - 14, sy - 6, 28, 14);
      ctx.fillStyle = "#c8553d";
      ctx.fillRect(sx - 16, sy - 14, 32, 7);
      ctx.fillStyle = "#e8ecf5";
      ctx.fillRect(sx - 8, sy - 14, 8, 7);
      ctx.save();
      ctx.globalAlpha = 0.5 + 0.5 * pulse;
      ctx.fillStyle = COLORS.gold;
      ctx.font = "800 11px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("SHOP", sx, sy + 22);
      ctx.restore();
    }
  }

  renderBombs(ctx) {
    for (const b of this.bombs) {
      const frac = 1 - b.fuse / b.maxFuse; // 0 → 1
      ctx.save();
      ctx.globalAlpha = 0.28 + 0.2 * Math.sin(this.time * 16);
      ctx.fillStyle = COLORS.burn;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.radius * frac, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.7;
      ctx.strokeStyle = COLORS.burn;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  renderEnemies(ctx) {
    for (const e of this.enemies) {
      if (e.isDrawing) {
        ctx.strokeStyle = "rgba(176,109,245,0.35)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(e.x, e.y);
        ctx.lineTo(this.player.x, this.player.y);
        ctx.stroke();
      }

      // Boss slam telegraph ring.
      if (e.isBoss && e.slamTelegraph > 0) {
        const frac = 1 - e.slamTelegraph / e.def.slamTelegraph;
        ctx.save();
        ctx.globalAlpha = 0.25;
        ctx.fillStyle = "#7a4dd6";
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.def.slamRadius * frac, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 0.8;
        ctx.strokeStyle = "#7a4dd6";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.def.slamRadius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      let alpha = 1;
      if (e.isFaded) alpha = 0.12;
      else if (e.phase === "materializing") alpha = 0.35 + 0.3 * Math.sin(this.time * 20);
      ctx.globalAlpha = alpha;

      let body = e.flash > 0 ? COLORS.enemyFlash : e.def.color;
      if (e.isWindup && Math.floor(this.time * 12) % 2 === 0) body = "#ffffff";
      if (e.burnTime > 0 && Math.floor(this.time * 10) % 3 === 0) body = COLORS.burn;
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

      // Knight shield: an arc on the blocking side.
      if (e.type === "knight") {
        ctx.strokeStyle = "#e8ecf5";
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.radius + 3, e.facing - e.def.blockArc / 2, e.facing + e.def.blockArc / 2);
        ctx.stroke();
      }

      if (e.health < e.maxHealth && !e.isBoss) {
        const w = e.radius * 2;
        ctx.fillStyle = "rgba(0,0,0,0.5)";
        ctx.fillRect(e.x - e.radius, e.y - e.radius - 8, w, 3);
        ctx.fillStyle = "#ffd166";
        ctx.fillRect(e.x - e.radius, e.y - e.radius - 8, w * (e.health / e.maxHealth), 3);
      }
      ctx.globalAlpha = 1;
    }
  }

  renderBossBar(ctx) {
    const boss = this.enemies.find((e) => e.isBoss);
    if (!boss) return;
    const w = LOGICAL_W - 60;
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(30, LOGICAL_H - 26, w, 10);
    ctx.fillStyle = "#7a4dd6";
    ctx.fillRect(30, LOGICAL_H - 26, w * (boss.health / boss.maxHealth), 10);
    ctx.strokeStyle = "rgba(255,255,255,0.3)";
    ctx.lineWidth = 1;
    ctx.strokeRect(30, LOGICAL_H - 26, w, 10);
    ctx.fillStyle = "#c9b8f0";
    ctx.font = "800 11px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(boss.def.label.toUpperCase(), LOGICAL_W / 2, LOGICAL_H - 32);
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

    // Whirlwind flourish.
    if (this.whirlTimer > 0) {
      ctx.save();
      ctx.globalAlpha = this.whirlTimer / 0.25;
      ctx.strokeStyle = "#ff6b6b";
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(p.x, p.y, PLAYER.attackRange * (1.2 - this.whirlTimer * 2), 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    if (p.hurtTimer > 0 && Math.floor(this.time * 14) % 2 === 0) ctx.globalAlpha = 0.35;
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
    ctx.lineTo(p.x + Math.cos(p.facing) * (p.radius + 6), p.y + Math.sin(p.facing) * (p.radius + 6));
    ctx.stroke();
  }

  renderBanner(ctx) {
    if (this.bannerTimer <= 0) return;
    const alpha = Math.min(1, this.bannerTimer / 0.5);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.textAlign = "center";
    ctx.fillStyle = COLORS.accent;
    ctx.font = "800 24px -apple-system, system-ui, sans-serif";
    ctx.fillText(this.bannerText, LOGICAL_W / 2, 92);
    ctx.restore();
  }

  renderTransition(ctx) {
    if (this.state !== "transition") return;
    const elapsedFrac = 1 - this.transitionTimer / TRANSITION_DUR;
    const alpha = 1 - Math.abs(2 * elapsedFrac - 1);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = COLORS.page;
    ctx.fillRect(-8, -8, LOGICAL_W + 16, LOGICAL_H + 16);
    ctx.restore();
  }
}
