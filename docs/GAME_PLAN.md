# Game Plan — "Untitled Dark-Fantasy Action-RPG"

> **Working codename:** *Emberfall* (rename anytime).
> This is the living design + roadmap doc. It captures the vision we agreed on
> and the phased build order. Specifics marked _(proposed)_ are sensible
> defaults meant to be tuned, not commitments.

---

## TL;DR

A **dark-fantasy action-RPG for mobile browsers** — a "small Skyrim." You explore
one big, handcrafted, persistent world (open overworld + dungeons, *Zelda 1*
style with screen-flip navigation), fighting with a **hybrid of melee, ranged,
and magic**. The heart of the game is **building a unique character**: you spend
freely-earned points across attributes, skill trees, gear, and spells, growing
through **XP + loot**. A main-story spine gives direction; NPCs, quests, and
emergent adventures give it life. Art is abstract shapes now, designed so sprites
drop in later. Built as zero-build vanilla JS, playable from a URL, autosaving to
the browser.

---

## Design Pillars

1. **Become someone.** Every meaningful choice feeds *your* build. Two players'
   characters should look and play differently by hour two.
2. **A world that stays put.** Handcrafted, persistent, explorable. The world
   remembers what you've done. Curiosity is rewarded.
3. **Readable, tactile combat.** Real-time, one-thumb-friendly. Clear tells,
   satisfying feedback, meaningful dodge/positioning.
4. **Playable at every step.** Scope is huge, so every phase ships a game you
   can actually pick up and play — never a half-wired system.
5. **Phone-first, zero friction.** Loads from a URL, no install, autosaves,
   resumes instantly.

---

## The Vision

**Setting.** Dark fantasy: crumbling keeps, haunted woods, catacombs, ruined
towns. Grim but not humorless. A home base (a surviving town/refuge) anchors the
world — where you respawn, restock, talk to NPCs, and spend your progression.

**The core loop.**
1. Head out from the home base into the world.
2. Explore screens, fight enemies, find loot, discover NPCs/quests/secrets.
3. Earn XP, gold, and gear; die (and lose some gold) or return home.
4. Spend points and gold to sculpt your build; equip new finds.
5. Newly-strong (or newly-equipped) you can reach places and beat things you
   couldn't before. Repeat, deeper.

**What makes it "small Skyrim."** No fixed class or single golden path. The
overarching story is a spine, but the driver is self-directed character growth
and the adventures you string together. You could end up a spellblade, a
poison-arrow skirmisher, a heavy-armor brawler, a glass-cannon pyromancer — all
from the same start.

---

## Core Systems (design intent)

### World & navigation
- The world is a grid of **screens**. Each screen is one phone-screen of space
  (screen-flip: walk to an edge → snap to the neighboring screen, entering from
  the opposite edge). This reuses our current "room = one screen" model.
- Screens are **data-driven** (a tile layout + placements), so the world is
  authored as data, not code.
- **Overworld** screens are open and connected; **dungeons** are self-contained
  clusters of screens with keys/locked doors/puzzles/a boss (Phase 6).
- **Persistence:** the world remembers durable changes — opened chests, defeated
  bosses, triggered events, collected key items, unlocked shortcuts. Regular
  enemies **respawn** when you leave and return (Zelda-style), so the overworld
  stays dangerous.

### Combat
- Real-time, top-down. Left thumb moves (virtual joystick), right thumb acts.
- **Three offense pillars:** melee (swing/combo), ranged (bow/thrown), and
  **magic** (spells that cost a Focus/mana resource). You carry a loadout and
  switch between equipped options.
- **Dodge roll** with i-frames stays the core defensive tool.
- Enemies have clear tells; variety comes in Phase 3+ (chargers, archers,
  casters, shielded foes, etc.).

### Character building (the heart) — four axes
1. **Attributes** _(proposed: Might, Finesse, Focus, Vitality)_ — scale melee,
   ranged/crit, magic/mana, and health respectively; gate some gear.
2. **Skill trees / perks** — active abilities (power attack, multishot, dash-strike,
   ...) and passives (life steal, extra i-frames, spell crit, ...), organized into
   trees roughly by pillar (Warfare / Marksmanship / Sorcery / Survival).
3. **Equipment & loadout** — weapons, armor, accessories with stats and effects;
   found, bought, or crafted. Your gear is a big part of your identity.
4. **Magic / spells** — schools _(proposed: Fire, Frost, Shadow, Restoration)_;
   spells are collected and equipped like weapons.

**Build model:** **freeform points.** You earn points and spend them where you
want — no locked classes. Your character emerges from your choices.

### Progression — hybrid XP + loot
- **XP** from kills and quests → **levels** → **points** to spend on attributes
  and skill trees.
- **Loot** from enemies, chests, and shops drives a parallel power curve; gear
  can define a build as much as points do.
- **Hearts** _(proposed)_: discrete health as heart containers; find heart
  upgrades to raise your max (item + upgrade gating we agreed on).

### Economy & death
- **Gold** is the currency (buy gear, spells, services).
- **Death:** autosave world state; **respawn at the home base**; **drop some
  gold** on death (a recoverable stash or a flat % — _tune later_). Items,
  levels, and world progress are kept.

### Story & content
- **Full RPG content** (authored over later phases): a home town with NPCs,
  a main quest spine, side quests, a quest log, and light faction/choice flavor.
- Delivered via a **dialogue system** and quest flags tied to the persistent
  world state.

---

## Technical Architecture (how the code evolves)

**Today** (small, clean base — good bones to build on):

```
index.html        canvas, HUD, touch controls, overlays
css/style.css     mobile layout + controls
js/main.js        entry, frame loop, overlay wiring
js/input.js       floating joystick, action buttons, keyboard   ← KEEP ~as-is
js/entities.js    Player (move/attack/dodge), Enemy (chaser)     ← EXTEND
js/rooms.js       procedural room CHAIN + door geometry          ← REPLACE
js/game.js        single-arena world/state/render                ← REFACTOR
```

**Target module shape** (introduced across phases; not all at once):

```
js/main.js        entry + fixed-timestep loop + scene wiring
js/input.js       (unchanged interface)
js/engine/
  tilemap.js      tile grid: collision + rendering per screen
  camera.js       screen-flip framing (trivial now; real camera later)
  save.js         localStorage load/save of player + world flags
js/world/
  world.js        the screen graph: which screen, neighbors, transitions
  screens/        DATA: hand-authored screen definitions (tiles, spawns, exits,
                  chests, NPCs, triggers)
js/entities/
  player.js       stats, inventory, loadout, hearts, XP/level
  enemy.js        enemy types + AI
  projectile.js   arrows / spells / thrown
js/rpg/
  stats.js        attributes → derived stats
  progression.js  XP, levels, freeform point spend
  perks.js        skill trees / perks
  items.js        item/gear definitions + effects
  spells.js       spell definitions + Focus resource
js/ui/
  hud.js          hearts, resources, minimap
  menus.js        character sheet, inventory, skill trees, dialogue
```

**Key principles:**
- **Data-driven content.** Screens, items, enemies, spells, perks, quests are
  plain data objects — so authoring the "sprawling" world is content work, not
  engine work.
- **Separate durable vs transient state.** Save persists player + world *flags*
  (chests opened, bosses down, quests). Enemies are transient and respawn.
- **Shapes-now, sprites-later.** Rendering goes through a thin draw layer so a
  sprite sheet can replace shape-drawing per entity/tile without touching logic.
- **Fixed-timestep update** for stable physics/feel as systems grow.

---

## Phased Roadmap

Each phase ends with something playable.

| Phase | Theme | Ships |
|------|-------|-------|
| **1** | **World & movement foundation** _(next)_ | Tile-based screens, a small fixed hand-authored world incl. a home base, screen-flip transitions, persistent world state + autosave, respawn-at-home, existing melee/dodge combat + one enemy ported in. |
| 2 | Hearts & core stats | Discrete hearts + heart upgrades, attributes, XP/levels, freeform point spend, gold + drop-on-death. |
| 3 | Combat expansion | Ranged weapon + magic (Focus resource, starter spells), loadout switching, 2–3 enemy types with tells. |
| 4 | Gear & inventory | Inventory, equippable weapons/armor/accessories, loot drops, persistent chests, a home-base shop, first item-gating tools. |
| 5 | Skill trees / perks | Perk trees per pillar, active abilities + passives, point spending UI. |
| 6 | Dungeons | Multi-screen dungeons with keys/locked doors/a puzzle/a boss + reward item; boss framework. |
| 7 | NPCs, dialogue, quests | Dialogue system, home-town NPCs, main-quest spine + side quests, quest log, light factions/choices. |
| 8 | Content & polish | More biomes/enemies/bosses/items/spells, audio, hit-feedback/juice, art pass (sprite drop-in). |

---

## Phase 1 — World & Movement Foundation (detailed)

**Goal:** replace the procedural room chain with a **fixed, persistent, walkable
world** made of tile-based screens, with a home base and autosave. This is the
skeleton everything else hangs on.

**Work items**
1. **Tilemap engine** (`js/engine/tilemap.js`): a per-screen tile grid (e.g.
   floor / wall / obstacle / void). Circle-vs-tile collision for player & enemies.
   Renders the screen (shapes for now). Tiles sized to fit the phone screen.
2. **Screen data format** (`js/world/screens/`): each screen defines its tile
   layout, enemy spawn points, exits (which edges lead where), and later
   chests/NPCs/triggers. Author a **small starter world** _(proposed: ~3×3
   screens)_ including one **home-base** screen (safe, no enemies).
3. **World graph + transitions** (`js/world/world.js`): track the current
   screen; on reaching an edge with an exit, screen-flip to the neighbor and
   place the player at the matching opposite edge. Fade transition (reuse the
   current transition effect).
4. **Persistence** (`js/engine/save.js`): autosave to `localStorage` — current
   screen + player position + a `flags` object for durable world state. Load on
   boot; "Continue" vs "New Game" on the title overlay.
5. **Home base + death:** respawn at the home-base screen on death (keep the
   current health/death hooks; gold-drop comes in Phase 2).
6. **Port combat:** bring the existing melee swing + dodge and the chaser
   `Enemy` into the tile world; enemies belong to a screen and **respawn** on
   re-entry.
7. **Retire** `js/rooms.js` (procedural chain) once the world graph replaces it.

**Files:** new `js/engine/tilemap.js`, `js/engine/save.js`, `js/world/world.js`,
`js/world/screens/*`; refactor `js/game.js` (arena → current-screen renderer/
controller) and `js/main.js` (scene/boot + Continue/New Game); extend
`js/entities.js`; remove `js/rooms.js`.

**Acceptance criteria**
- I can walk around a small handcrafted world, moving between screens by walking
  off the edges, entering neighbors from the correct side.
- Walls/obstacles block movement (tile collision works).
- There's a safe home-base screen; dying returns me there.
- Closing and reopening the tab resumes me where I was (autosave/load).
- Existing melee + dodge still feel good; enemies fight me per-screen and
  respawn when I leave and come back.

**Verification** (same approach we've used)
- `node --check` all JS modules.
- Headless Chromium (Playwright) smoke test at phone resolution: boot → New
  Game → walk across a screen edge and assert the current-screen id changes and
  the player is repositioned; assert tile collision stops movement into a wall;
  simulate death and assert respawn at home; reload the page and assert state
  restored from `localStorage`. Assert zero console/page errors.
- Manual play pass on the deployed GitHub Pages URL from a phone.

---

## Open questions to settle at their phase (not blocking Phase 1)

- Exact attribute list & what each scales (Phase 2).
- Hearts vs a hybrid heart+stamina/Focus layout (Phase 2/3).
- Spell schools & the Focus/mana model specifics (Phase 3).
- Gold-drop-on-death: recoverable stash vs flat % loss (Phase 2).
- Perk-tree shape and how many points per level (Phase 5).
- World size/biome breakdown and the main-quest outline (Phase 7/8).

---

## Current status

- ✅ Prototype base: joystick + melee + dodge, chasing enemy, health/death,
  deployed to GitHub Pages.
- ✅ **Phase 1 — World & Movement Foundation.** Fixed logical space (12×20
  tiles), tile engine with collision (`js/engine/tilemap.js`), hand-authored
  3×3 overworld with the Emberfall home town (`js/world/screens.js`),
  screen-flip travel through doorway gaps, per-screen transient enemies,
  autosave/continue (`js/engine/save.js`), respawn-at-home on death. The old
  procedural room chain (`js/rooms.js`) is retired.
- ✅ **Phase 2 — Hearts & core stats.** Heart-based health (half-heart damage,
  post-hit i-frames), four attributes (Might/Finesse/Focus/Vitality) with
  freeform point spend via the pausing character sheet (`js/rpg/stats.js`),
  chunky XP levels (+3 points each), enemy gold/heart drops, and the
  recoverable death pouch (die → carried gold drops where you fell → corpse
  run to reclaim; a second death replaces it). Save format v2 with v1
  migration. _Settled design calls: hearts over HP bar; recoverable pouch over
  flat % loss; Focus = attack speed now, spell power later._
- ✅ **Phase 3 — Combat expansion.** Three weapon modes on one action button
  with a SWORD/BOW/FIRE switcher (Q/1/2/3 on desktop): melee swing, bow
  (Finesse-scaled arrows) and the Firebolt spell (Focus-scaled, 30 of 100
  mana, 12/s regen, blue HUD bar). Projectiles fly over water, stop at
  walls/trees, and soft auto-aim within a ~37° cone. Two new enemies with
  tells: the charger (windup blink → locked-line rush for a full heart; a hit
  during windup cancels it) and the archer (keeps distance, aim-line
  telegraph, arrows you can dodge-roll through). Enemy types are authored
  per-screen; weapon mode persists in the save.
- ✅ **Phase 4 — Gear & inventory.** Item catalog (`js/rpg/items.js`) with 16
  items across five slots (sword/bow/catalyst/armor/charm); weapon damage now
  comes from equipped gear, armor adds hearts, charms give passives (+speed,
  +mana regen, +XP, +gold). The Emberfall merchant stall auto-opens a shop
  panel when you walk up (with a step-away latch); four persistent chests
  hide gold and items around the world, remembered via save flags. Character
  sheet gained STATS/GEAR tabs and a top-left menu button; new gear
  auto-equips into empty slots. Save v3 (inventory/equipment/flags) with the
  full v1→v2→v3 migration chain. _Item-gating tools (keys etc.) deferred to
  Phase 6 dungeons where the locks live._
- ⏭️ **Next:** Phase 5 — Skill trees / perks (active abilities + passives per
  pillar, point spending UI).
