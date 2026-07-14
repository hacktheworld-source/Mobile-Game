# EMBERFALL: The Hollow Crown

A **dark-fantasy action-RPG** for the mobile browser — no app store, no
install, no build step. A 20-screen handcrafted overworld, a six-room dungeon
with a key, a locked gate and a boss, three weapon pillars (sword / bow /
fire), perks with active skills, gear, a shop, an NPC quest line, and a world
that permanently remembers what you've done. Pure HTML5 Canvas + vanilla JS,
served straight from GitHub Pages, autosaving to your device.

**The full design bible lives in [`docs/GDD.md`](docs/GDD.md).**
(The original phased plan, [`docs/GAME_PLAN.md`](docs/GAME_PLAN.md), is kept
for history.)

## Controls

**Touch (phone)**
- **Left thumb** — floating virtual joystick (touch anywhere on the left side)
- **ATK** — tap to strike; **hold to auto-attack**; **drag off the button to
  aim** in any direction while you move independently (an aim line shows your
  firing direction)
- **Dodge** — **swipe anywhere on the right side** (not on a button): a dashed
  line extends from the player in the drag direction; release to dash with
  i-frames (yes, through enemy arrows). Short taps are ignored.
- **SWORD/BOW/FIRE** — cycle weapon modes (bow scales with Finesse, fire with
  Focus and costs regenerating mana)
- **SKILL** — your equipped active perk (Whirlwind / Volley / Flame Nova);
  appears once you own one
- **☰** — character sheet: STATS · PERKS · GEAR · MAP  · **♪** — sound toggle

**Desktop (for testing)**
- **WASD/arrows** move · **J/Space** attack (hold = auto) · **K/Shift** dodge · **L** skill
- **Q** cycle weapon · **1/2/3** pick weapon · **C** character sheet

## The game

- Start at the hearth in **Emberfall** town: the merchant stall and Elder
  Maren (talk to her — she has a job for you).
- The world is a 5×4 grid of screens; walk off an edge to travel. Danger
  **tiers up** with distance from town (tougher enemies, better rewards).
- Enemies telegraph everything: chargers flash before rushing, archers show
  aim lines, bombers mark their blast, wraiths shimmer before striking, and
  Bone Knights block frontal hits (flank them — or set them on fire).
- Level up → spend points on **attributes** (1pt) or **perks** (2pts).
  Actives go on your SKILL button. Buy gear at the shop; find better in chests.
- Death drops your carried gold in a pouch where you fell. Corpse-run to
  reclaim it. Everything else is never lost — the game autosaves constantly.
- **Chapter 1:** find the Barrow Gate, take the key from the dead, open the
  sealed gate, and put the **Barrow King** back to sleep.

## Run it locally

```bash
# from the repo root (ES modules need a server, not file://)
python3 -m http.server 8000
```

Add `?debug` to the URL to expose the running game as `window.__game`.

## Project layout

```
index.html             canvas, HUD, panels (sheet/shop/dialogue), controls
css/style.css          mobile-first UI styling
js/main.js             boot, frame loop, panel wiring, audio unlock
js/input.js            floating joystick, action buttons, keyboard
js/entities.js         Player, Enemy archetypes + boss, Projectile, Bomb, Pickup
js/game.js             the orchestrator: screen state, combat, doors, quests,
                       autosave, rendering
js/engine/tilemap.js   tile grid, themes, collision, fixed logical space
js/engine/save.js      versioned localStorage saves (v1→v4 migration chain)
js/engine/audio.js     synthesized WebAudio SFX (no asset files)
js/engine/fx.js        screen shake, hit-stop, particles, damage numbers
js/world/screens.js    DATA: the whole world; openings auto-punched from the
                       graph, validated (shape + reachability) at load
js/world/world.js      screen graph navigation
js/world/dialogue.js   NPC dialogue + quest status lines
js/rpg/stats.js        attributes, scaling, XP curve
js/rpg/items.js        item catalog + shop stock
js/rpg/perks.js        perks: actives (skills) + passives
js/rpg/enemies.js      enemy archetype definitions + tier scaling
```

World content is pure data: screens are character grids (`. # ~ t - m`) with
enemies, chests, doors, and NPCs declared alongside. Doorway openings are
punched automatically from the world graph — misaligned exits are impossible —
and a load-time validator flood-fills every screen to prove every chest, door,
NPC and spawn is reachable.

## Deploying

GitHub Pages serves the repo root (see `.github/workflows/pages.yml`, or point
Pages at this branch's root). `.nojekyll` keeps the `js/` folders intact.
