# EMBERFALL: The Hollow Crown
## Game Design Document — v1.0

> The authoritative design bible for Emberfall. The old phased plan
> (`GAME_PLAN.md`) got us to a solid foundation; this document supersedes it
> and describes the full game we are now building. Sections marked **[SHIPPED]**
> exist in the current build; **[NEXT]** and **[HORIZON]** are staged future work.

---

# 1. High Concept

**A dark-fantasy action-RPG that lives in your pocket.** One thumb moves, the
other fights. You are the last ember-touched soul of a dying frontier town,
carving a life out of a haunted world — one screen at a time, one build at a
time, one bad idea at a time.

**Hook in one sentence:** *Zelda's world, Dead Cells' combat feel, Skyrim's
"be whoever you want" — sized for a phone you're holding on the bus.*

- **Platform:** mobile browser (GitHub Pages). Zero install, zero build step,
  loads from a URL, autosaves to the device.
- **Session length:** meaningful progress in 3 minutes; happily plays for 30.
- **Monetization:** none. It's ours.

---

# 2. Design Pillars

Every feature must serve at least one. When two conflict, the earlier wins.

1. **BECOME SOMEONE.** Attributes, perks, gear, spells — every choice makes
   *your* character. Two players two hours in should play differently and
   *look* at different buttons.
2. **THE WORLD STAYS PUT.** Handcrafted, persistent, explorable. Chests stay
   opened. Doors stay unlocked. The world remembers you.
3. **COMBAT YOU CAN FEEL.** Every hit lands with shake, sparks, sound, and
   numbers. Every enemy telegraphs. Every death is your fault and you know why.
4. **ONE MORE SCREEN.** There is always something *visible* to chase: a chest
   across the water, a locked door, a quest hanging open, a shop item 40 gold away.
5. **PLAYABLE EVERY DAY.** The build at HEAD is always a complete game.

---

# 3. The Player Fantasy & Core Loops

**Fantasy:** a lone ember-touched wanderer growing from "three hearts and a
rusty sword" into a whirlwind of steel, arrows, or fire — by *your* choice.

**Moment loop (seconds):** read the enemy's tell → position/dodge → strike
with your chosen weapon → collect what falls.

**Session loop (minutes):** leave the hearth → push into hostile screens →
fight, loot chests, level → spend points and gold → push one screen deeper
than last time → bank progress via autosave.

**Journey loop (hours):** shape a build (attributes + perks + gear) → break
open a dungeon → beat its boss → claim a relic and permanent power → unlock
the next region and the next chapter of the Hollow Crown story.

**Death rule:** death is a sting, not a wall. You wake at the hearth; your
carried gold drops in a pouch where you fell. Corpse-run to reclaim it —
but die again first and it's gone. Levels, gear, and world state are never lost.

---

# 4. World & Setting

## 4.1 Lore (one breath)
The old kingdom burned when its king refused to die properly. His crown —
the **Hollow Crown** — kept his body walking after his soul quit. The realm
rotted around him. Emberfall is the last town where a hearth still burns, and
hearths are the one thing the dead fear. The barrows are waking up. Someone
has to walk into them. That's you.

## 4.2 Structure **[SHIPPED — Chapter 1]**
The world is a grid of hand-authored screens (Zelda 1 style, screen-flip
travel), plus self-contained **dungeons** entered through doors in the world.

**Chapter 1 world: 20 overworld screens (5×4) + the Hollow Barrow dungeon (6 rooms).**

```
Deep Woods    Wolf Den     North Road    Old Ruins     Barrow Approach
Westwood      Hunters Rest EMBERFALL     East Fields   Barrow Gate  ⇦ dungeon door
Riverbank     The Ford     South Path    Sunken Field  Salt Marsh
Black Mire    Deep Mire    Forgotten Sh. Wreck Beach   Lighthouse Ruin
```

- **Emberfall (home):** safe. Hearth (respawn), merchant stall, Elder Maren (quests).
- **Difficulty tiers** radiate from home: tier 1 (adjacent) → tier 3 (far
  corners & dungeon). Tier scales enemy health and rewards, so "how far from
  home am I?" is always a real decision.
- **Themes** change the palette and props per region: woods, fields, river,
  marsh/mire (mud), ruins, and the barrow's dead stone.

## 4.3 The Hollow Barrow **[SHIPPED — first dungeon]**
Six rooms of dead stone under the Barrow Gate:
entry hall → crossroads → east room (the **Barrow Key** in a chest, guarded) /
west room (treasure) → **locked door** (needs the key) → gauntlet room
(heart container) → **the Barrow King** (boss). Beating him cleanses the
barrow, completes Elder Maren's quest, and drops real treasure.

## 4.4 Future regions **[HORIZON]**
Each chapter adds a region + dungeon + relic: the Drowned Cathedral (marsh),
the Ashen Keep (burned highlands), the Glass Mines, and finally the Throne of
the Hollow King. Relics grant permanent, build-agnostic powers (double dodge,
water-walking, spell slots) that double as exploration keys — Metroid-style.

---

# 5. Combat

## 5.1 Controls **[SHIPPED]** — twin-stick by drags
- **Left thumb:** floating virtual joystick (spawns where you touch).
- **ATK:** tap to strike · **hold to auto-attack** at cooldown speed ·
  **drag off the button to aim** independently of movement (aim line shows
  direction; manual aim overrides the soft auto-aim). Run-and-gun like
  Exit the Gungeon.
- **Dodge:** **swipe anywhere on the right half** (off-button): a dashed line
  extends from the player in the drag direction; release to dash with
  i-frames. Taps are ignored (no accidental dashes). No dodge button.
- Also: weapon switcher (SWORD/BOW/FIRE) · **SKILL** (equipped active).
- Desktop mirror: WASD · J attack (hold = auto) · K dodge · L skill ·
  Q/1/2/3 weapons · C sheet.

## 5.2 The three pillars **[SHIPPED]**
| Pillar | Feel | Resource | Scales with |
|---|---|---|---|
| **Sword** | close, fast, safe-ish DPS | cooldown only | Might |
| **Bow** | poke, kite, control space | cooldown | Finesse |
| **Fire** | burst + area denial | mana (regenerating) | Focus |

Projectiles have **soft auto-aim** (cone snap) because thumbs aren't mice.
Arrows fly over water; walls and trees stop everything.

## 5.3 Status effects **[SHIPPED: burn]**
- **Burn:** damage over time, flickers orange, *bypasses shields* — the
  designed answer to the Bone Knight. Applied by Flame Nova (always) and
  Firebolt (with the Kindling perk).
- **[NEXT]** chill (slow), venom (weaker, stacks), stagger (interrupt meter).

## 5.4 Enemy design philosophy
Every enemy asks the player one **question**, telegraphs it clearly, and pays
out when answered. No damage without a readable tell.

## 5.5 Roster **[SHIPPED]**
| Enemy | Question it asks | Tell |
|---|---|---|
| **Husk** (chaser) | "Can you manage space?" | beeline approach |
| **Bone Charger** | "Can you sidestep?" | white-flash windup, locked line |
| **Barrow Archer** | "Can you use cover / time rolls?" | aim line while drawing |
| **Grave Bomber** | "Can you stay off the X?" | thrown bomb + growing blast ring |
| **Wraith** | "Can you fight what teleports?" | fades out, materializes with a shimmer |
| **Bone Knight** | "Can you flank (or burn)?" | raised shield, blocks frontal hits |

## 5.6 Bosses **[SHIPPED: 1]**
**The Barrow King** (Hollow Barrow): a slab of dead royalty. Ring-telegraphed
**slam**, summons husks, and below half health adds charging rushes. Arena
fits one screen; every attack answerable with the basic kit. Future bosses
each own a mechanic (the Drowned Choir sings zones closed; the Ash Knight
duels with parry windows).

---

# 6. Character System

## 6.1 Attributes **[SHIPPED]** — freeform points, no classes
- **Might** +8% sword damage/pt · **Finesse** +8% bow dmg, +3% speed, faster
  dodge · **Focus** +8% spell dmg, faster attacks · **Vitality** +1 heart/pt.
- **+3 points per level.** Chunky levels: each one is an event.

## 6.2 Perks **[SHIPPED]** — spend the same points (2 each): builds get teeth
| Pillar | Active (SKILL button) | Passive |
|---|---|---|
| Warfare | **Whirlwind** — 360° heavy swing | **Lifesteal** — melee kills can restore a half-heart |
| Marksmanship | **Volley** — fan of five arrows | **Piercing Shots** — arrows punch through one extra body |
| Sorcery | **Flame Nova** — ring of eight burning bolts (mana) | **Kindling** — firebolts ignite |
| Survival | — | **Iron Skin** (+1 heart) · **Fleetfoot** (+8% speed) |

One active equipped at a time (swap freely in the sheet). Actives have real
cooldowns and sell the fantasy: Whirlwind *feels* like a warrior button.
**[NEXT]** second perk ring per pillar; ultimates at high level.

## 6.3 Gear **[SHIPPED]** — 5 slots: sword/bow/catalyst/armor/charm
Weapon damage lives on items; armor adds hearts; charms bend the rules
(+speed, +mana regen, +XP, +gold). Bought at the stall, found in chests.
**[NEXT]** rare affixes ("Soldier's Blade *of Embers*"), relic slot.

## 6.4 Example builds (design targets)
- **Juggernaut:** Might+Vitality, Claymore, Iron Mail, Whirlwind, Lifesteal.
- **Ranger:** Finesse, War Bow, Swift Charm, Volley, Piercing Shots.
- **Pyromancer:** Focus, Pyric Staff, Deepwell Charm, Nova, Kindling.
- **Greedmonger:** Miser's + Scholar's rotation, kill fast, bank often.

---

# 7. Progression & Economy

- **XP:** kills (scaled by tier) → chunky levels (`need = level × 100`).
- **Gold faucets:** kills, chests, quest rewards, boss hoards. **Sinks:** the
  shop (armory tiers, charms), future: crafting, home upgrades, ferry fares.
- **Hearts:** base 3 + Vitality + armor + **heart containers** (dungeon
  treasures, permanent).
- **Keys & gates:** dungeon keys (Barrow Key) and relic-gated world locks
  make exploration loot-shaped.
- **Design budget:** first shop purchase within ~2 laps of the map; first
  perk by level 2–3; dungeon-ready by ~level 4; boss beaten around level 6.

---

# 8. Quests & Narrative

**Spine (Chapter 1) [SHIPPED]:** Elder Maren by the hearth: *"The barrow east
of the fields has opened. Cleanse it."* → find the Barrow Gate → key → locked
door → Barrow King → return changed. Told through **short dialogue** (tap-to-
advance), never more than a phone screen of words.

**Tone:** grim world, warm hearth, dry wit. NPCs talk like tired survivors,
not lore terminals.

**[NEXT]** side quests (fetch/hunt/escort-lite), quest journal, more NPCs
(smith who upgrades, fisher who ferries). **[HORIZON]** chapter choices that
change town state.

---

# 9. UI / UX

- **HUD:** hearts + level/gold + XP + mana top-center; area name on entry;
  ☰ menu (top-left), pulsing LEVEL UP (top-right), audio toggle.
- **Sheet (pauses):** STATS (attributes) · PERKS (buy/equip skills) · GEAR
  (equip by slot) · MAP (explored world grid + quest line).
- **Shop / Dialogue:** walk-up auto-open panels with step-away latches.
- **Rules:** every interactive element ≥ 42px; nothing vital in screen
  corners; the game NEVER punishes you while a menu is open (hard pause).

---

# 10. Game Feel (the juice layer) **[SHIPPED]**

Non-negotiable, cheap, and load-bearing:
- **Hit-stop** (a few frozen milliseconds on every landed hit).
- **Screen shake** scaled to the event (tap for hits, thump for slams).
- **Particles:** hit sparks, death bursts, burn flames, heal motes.
- **Floating damage numbers** (color-coded per source; crits later).
- **Synth audio:** every verb has a voice — swing, thunk, coin, level-fanfare,
  door rumble, boss roar. Generated in WebAudio; zero asset files; mutable.
- **[NEXT]** haptics via `navigator.vibrate` where supported; music beds.

---

# 11. Art Direction

**Now:** confident flat-shape minimalism — readable silhouettes, one accent
color per faction, palette per biome, darkness as atmosphere. It should look
*designed*, not placeholder.
**Later:** the renderer isolates all drawing per entity/tile, so a sprite
pass (16×16 or 24×24, moody palette) can drop in without logic changes.
**Palette anchors:** hearth-green `#4dd6a1`, blood `#ff5470`, gold `#ffd166`,
spell-blue `#5aa9ff`, ember-orange `#ff9a3d`, barrow-purple `#7a4dd6`.

---

# 12. Technical Design

- **Zero-build vanilla ES modules**, GitHub Pages hosting, one HTML file.
- **Fixed logical space** (384×640, 12×20 tiles) scaled/letterboxed; all
  logic and saves resolution-independent.
- **Data-driven content:** screens, enemies, items, perks, dialogue are plain
  data modules; the engine is generic. Content grows without engine work.
- **Authoring guards:** world data self-validates at load (grid shape,
  doorway alignment, spawn walkability, BFS reachability of every screen).
- **Save:** versioned localStorage (v4) with a full migration chain from v1.
- **Perf budget:** 60fps on a mid phone; entity cap ~40/screen; particle pool.
- **Module map:** `engine/` (tilemap, save, audio, fx) · `world/` (data +
  graph) · `rpg/` (stats, items, perks, enemies-defs) · `entities.js` ·
  `game.js` · `main.js` + DOM UI.

---

# 13. Content Roadmap

- **v0.5 — THE HOLLOW CROWN [THIS BUILD]:** 20-screen overworld, Hollow
  Barrow dungeon (key, lock, heart container, Barrow King), 6 enemy types +
  boss, perks & actives, burn, NPC + main quest, world map tab, juice layer,
  audio, tiers, save v4.
- **v0.6 — TOWN & TRADE:** side quests, smith (gear upgrades), journal,
  affix loot, haptics.
- **v0.7 — THE DROWNED CATHEDRAL:** marsh dungeon, chill status, relic #2,
  water mechanics.
- **v0.8 — DEPTH:** second perk rings, ultimates, elite enemy variants,
  challenge shrines.
- **v1.0 — THE THRONE:** final region, endgame boss, ending, sprite art pass,
  music.

---

# 14. Playtest Checklist (what "fun" means here)

- [ ] Can a new player understand every death?
- [ ] Is there something you *want* within 60 seconds at all times?
- [ ] Do two different builds make you press different buttons?
- [ ] Does a 3-minute session bank real progress?
- [ ] Does killing one husk feel good with the sound off? With it on?
- [ ] Would you walk one more screen at 1 heart? (If never: too punishing.
      If always: too safe.)
