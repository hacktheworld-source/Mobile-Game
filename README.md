# Emberfall — mobile action-RPG

A **dark-fantasy action-RPG** ("small Skyrim") for the mobile browser (no app
store, no install). You explore a fixed, persistent, Zelda-style world of
screens — fight, travel, die, and wake back up at the hearth. Pure HTML5
Canvas + vanilla JS — **zero build step**, so it runs straight off GitHub Pages.

See [`docs/GAME_PLAN.md`](docs/GAME_PLAN.md) for the full vision and phased
roadmap. **Done so far:** a hand-authored 3×3 overworld with a safe home town,
screen-flip travel, tile collision, autosave (Phase 1); hearts, four
attributes with freeform point spending, XP levels, gold drops, and a
recoverable death pouch (Phase 2).

## Controls

**Touch (phone)**
- **Left thumb** — floating virtual joystick (touch anywhere on the left side to move)
- **ATK** button — use the equipped weapon (sword swing / bow shot / firebolt)
- **SWORD/BOW/FIRE** button — cycle weapon modes; the bow scales with Finesse,
  the firebolt with Focus (costs mana, which regenerates)
- **DODGE** button — dodge roll: a quick burst with brief invincibility
  (you can roll through enemy arrows)

**Desktop (for testing)**
- **WASD / arrows** — move
- **J / Space** — attack · **K / Shift** — dodge
- **Q** cycle weapon · **1/2/3** pick weapon · **C** character sheet

You face the direction you're moving; the swing lands in front of you. Walk
off a screen's edge (through gaps in the walls) to travel to the next screen.
The game autosaves; dying returns you to the hearth in Emberfall town.

## Run it locally

Because it uses ES modules, open it via a local server (not `file://`):

```bash
# from the repo root
python3 -m http.server 8000
# then visit http://localhost:8000 on your phone (same Wi‑Fi) or desktop
```

## Play it on your phone (GitHub Pages)

1. Merge this branch into your default branch (e.g. `main`).
2. In the repo: **Settings → Pages**.
3. Set **Source** to **GitHub Actions** (the included workflow deploys the site).
4. After the workflow runs, open the published URL on your phone.

> Prefer no workflow? Under **Settings → Pages** you can instead choose
> **Deploy from a branch**, pick your branch and the `/ (root)` folder. The
> included `.nojekyll` file makes sure the `js/` and `css/` folders are served
> as-is.

## Project layout

```
index.html            markup: canvas, HUD, touch buttons, overlays
css/style.css         mobile-first layout + control styling
js/main.js            entry, frame loop, title/death overlay flow
js/input.js           floating joystick, action buttons, keyboard fallback
js/entities.js        Player (move/attack/dodge) and Enemy (chaser)
js/game.js            current screen, transitions, combat, autosave, rendering
js/engine/tilemap.js  tile grid: collision + shape rendering, logical space
js/engine/save.js     localStorage save/load (versioned, with migration)
js/world/world.js     the screen graph (neighbors by direction)
js/world/screens.js   DATA: hand-authored screens (tiles, spawns, safety)
js/rpg/stats.js       attributes, per-point scaling, XP curve
```

The game runs in a fixed logical space (12×20 tiles of 32px) scaled to fit any
phone; save data is resolution-independent. World content is authored as
character-grid data in `js/world/screens.js` — doorways sit at columns 5–6
(vertical) and rows 9–10 (horizontal) so neighboring screens always align, and
the module self-validates at load.

Add `?debug` to the URL to expose the running game as `window.__game` in the
console. Gameplay tuning lives in the `PLAYER` and `ENEMY` constant blocks in
`js/entities.js`.

## Roadmap

See [`docs/GAME_PLAN.md`](docs/GAME_PLAN.md) for the full 8-phase plan.
**Done:** Phase 1 (world & movement), Phase 2 (hearts, attributes, XP, gold,
death pouch), Phase 3 (bow + firebolt + mana, weapon switching, charger and
archer enemies with tells).
**Next:** Phase 4 — gear, inventory, loot chests, and the Emberfall shop.
