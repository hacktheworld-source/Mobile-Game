# Arena — mobile action prototype

A tiny top-down action-roguelite prototype in the spirit of Dead Cells / Enter
the Gungeon, built to play **in a mobile browser** (no app store, no install).
Pure HTML5 Canvas + vanilla JS — **zero build step**, so it runs straight off
GitHub Pages.

This combat prototype is the springboard for a bigger project: a **dark-fantasy
action-RPG** ("small Skyrim") set in a fixed, persistent, Zelda-style world where
the core loop is **building a unique character**. See
[`docs/GAME_PLAN.md`](docs/GAME_PLAN.md) for the full vision and phased roadmap.
The current arena/room-chain code is the base; the fixed world replaces the
room chain in Phase 1 of that plan.

## Controls

**Touch (phone)**
- **Left thumb** — floating virtual joystick (touch anywhere on the left side to move)
- **ATK** button — melee swing (a cone in your facing direction, with a cooldown)
- **DODGE** button — dodge roll: a quick burst with brief invincibility (i-frames)

**Desktop (for testing)**
- **WASD / arrows** — move
- **J / Space** — attack
- **K / Shift** — dodge

You face the direction you're moving; the swing lands in front of you. Survive
as long as you can — enemies spawn faster over time.

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
index.html        markup: canvas, HUD, touch buttons, overlays
css/style.css     mobile-first layout + control styling
js/main.js        entry point + frame loop + overlay wiring
js/input.js       floating joystick, action buttons, keyboard fallback
js/entities.js    Player (move/attack/dodge) and Enemy (chaser)
js/rooms.js       room generation + door geometry for the run
js/game.js        arena, room progression, collisions, rendering, HUD
```

Add `?debug` to the URL to expose the running game as `window.__game` in the
console — handy for jumping rooms or inspecting state while tuning.

All gameplay tuning lives in the `PLAYER` and `ENEMY` constant blocks in
`js/entities.js` — speeds, cooldowns, damage, attack arc/range, dodge distance.
Tweak those first when adjusting game feel.

## Roadmap

- **Phase 1 (this):** core feel — joystick + attack + dodge, one chasing enemy,
  health/death/restart, difficulty ramp. ✅
- **Phase 2:** more enemy types (ranged, charger), enemy attack telegraphs,
  simple sound, screen shake / hit feedback.
- **Phase 3:** run structure — an endless chain of rooms, clear the enemy
  quota to open a glowing door, small heal per room, difficulty ramps by depth. ✅
- **Phase 4:** weapons & pickups, a real HUD, pause.
- **Phase 5:** meta-progression — currency, unlocks, permadeath runs.
