// Entry point: wires up input, the game, the overlay flow (title / death),
// the character sheet (stats/perks/gear/map), shop, dialogue, and audio.

import { Game } from "./game.js";
import { initInput } from "./input.js";
import { loadSave } from "./engine/save.js";
import { unlockAudio, isMuted, setMuted } from "./engine/audio.js";
import { ATTRIBUTES } from "./rpg/stats.js";
import { ITEMS, SLOTS, SLOT_LABELS, SHOP_STOCK } from "./rpg/items.js";
import { PERKS, PERK_ORDER, PERK_COST } from "./rpg/perks.js";
import { SCREENS } from "./world/screens.js";
import { questStatus } from "./world/dialogue.js";

const canvas = document.getElementById("game");
const root = document.getElementById("game-root");

const hud = {
  areaEl: document.getElementById("area"),
  statusEl: document.getElementById("status"),
  heartsEl: document.getElementById("hearts"),
  xpFill: document.getElementById("xp-fill"),
  manaFill: document.getElementById("mana-fill"),
  attackBtn: document.getElementById("btn-attack"),
  dodgeBtn: document.getElementById("btn-dodge"),
  modeBtn: document.getElementById("btn-mode"),
  skillBtn: document.getElementById("btn-skill"),
  levelupBtn: document.getElementById("levelup-btn"),
};

const overlay = document.getElementById("overlay");
const overlayTitle = document.getElementById("overlay-title");
const overlayBody = document.getElementById("overlay-body");
const overlayHint = document.getElementById("overlay-desktop-hint");
const btnPrimary = document.getElementById("overlay-btn");
const btnSecondary = document.getElementById("overlay-btn2");

const sheet = document.getElementById("sheet");
const sheetPoints = document.getElementById("sheet-points");
const sheetRows = document.getElementById("sheet-rows");
const sheetClose = document.getElementById("sheet-close");
const perkPoints = document.getElementById("perk-points");
const perkRows = document.getElementById("perk-rows");
const gearRows = document.getElementById("gear-rows");
const mapGrid = document.getElementById("map-grid");
const questLine = document.getElementById("quest-line");
const menuBtn = document.getElementById("menu-btn");
const audioBtn = document.getElementById("audio-btn");

const tabs = {
  stats: [document.getElementById("tab-stats"), document.getElementById("pane-stats")],
  perks: [document.getElementById("tab-perks"), document.getElementById("pane-perks")],
  gear: [document.getElementById("tab-gear"), document.getElementById("pane-gear")],
  map: [document.getElementById("tab-map"), document.getElementById("pane-map")],
};

const shop = document.getElementById("shop");
const shopGold = document.getElementById("shop-gold");
const shopRows = document.getElementById("shop-rows");
const shopClose = document.getElementById("shop-close");

const dialogue = document.getElementById("dialogue");
const dialogueName = document.getElementById("dialogue-name");
const dialogueText = document.getElementById("dialogue-text");

initInput(root);
const game = new Game(canvas, hud);

if (location.search.includes("debug")) window.__game = game;

// ---------- audio ----------

function refreshAudioBtn() {
  audioBtn.classList.toggle("muted", isMuted());
}
audioBtn.addEventListener("click", () => {
  unlockAudio();
  setMuted(!isMuted());
  refreshAudioBtn();
});
refreshAudioBtn();

// ---------- title / death overlay ----------

let overlayMode = "title";

function showTitle() {
  overlayMode = "title";
  const save = loadSave();
  overlayTitle.textContent = "EMBERFALL";
  overlayBody.innerHTML =
    "<b>THE HOLLOW CROWN</b><br>The last hearth still burns — and the barrow east of the " +
    "fields has opened. Move with the left thumb. <b>ATK</b> strikes, <b>DODGE</b> rolls " +
    "through danger, and who you become is up to you.";
  overlayHint.classList.remove("hidden");
  if (save) {
    btnPrimary.textContent = "CONTINUE";
    btnSecondary.textContent = "NEW GAME";
    btnSecondary.classList.remove("hidden");
  } else {
    btnPrimary.textContent = "NEW GAME";
    btnSecondary.classList.add("hidden");
  }
  overlay.classList.remove("hidden");
}

game.onGameOver = ({ kills, dropped, screenName }) => {
  overlayMode = "dead";
  overlayTitle.textContent = "YOU DIED";
  const pouchNote = dropped
    ? `<br><span style="color:#ffd166">You dropped ${dropped} gold in ${screenName} — make it back to reclaim it.</span>`
    : "";
  overlayBody.innerHTML =
    `Darkness takes you... and spits you back out at the hearth in <b>Emberfall</b>.` +
    pouchNote +
    `<br><span style="opacity:.7">${kills} ${kills === 1 ? "kill" : "kills"} so far.</span>`;
  overlayHint.classList.add("hidden");
  btnPrimary.textContent = "WAKE UP";
  btnSecondary.classList.add("hidden");
  overlay.classList.remove("hidden");
};

btnPrimary.addEventListener("click", () => {
  unlockAudio();
  overlay.classList.add("hidden");
  if (overlayMode === "dead") {
    game.respawn();
    return;
  }
  const save = loadSave();
  if (save) game.continueRun(save);
  else game.startNew();
});

btnSecondary.addEventListener("click", () => {
  unlockAudio();
  overlay.classList.add("hidden");
  game.startNew();
});

// ---------- character sheet ----------

function renderSheet() {
  const p = game.player;
  if (!p) return;
  sheetPoints.textContent =
    p.points > 0
      ? `${p.points} point${p.points === 1 ? "" : "s"} to spend`
      : "No points to spend — level up by defeating enemies";
  sheetPoints.classList.toggle("has-points", p.points > 0);
  sheetRows.innerHTML = "";
  for (const attr of ATTRIBUTES) {
    const row = document.createElement("div");
    row.className = "attr-row";
    row.innerHTML =
      `<div class="attr-info"><div class="attr-name">${attr.name}</div>` +
      `<div class="attr-desc">${attr.desc}</div></div>` +
      `<div class="attr-value">${p.stats[attr.key]}</div>`;
    const plus = document.createElement("button");
    plus.className = "attr-plus";
    plus.textContent = "+";
    plus.disabled = p.points <= 0;
    plus.addEventListener("click", () => {
      if (game.spendPoint(attr.key)) renderSheet();
    });
    row.appendChild(plus);
    sheetRows.appendChild(row);
  }
}

function renderPerks() {
  const p = game.player;
  if (!p) return;
  perkPoints.textContent = `${p.points} point${p.points === 1 ? "" : "s"} · perks cost ${PERK_COST}`;
  perkPoints.classList.toggle("has-points", p.points >= PERK_COST);
  perkRows.innerHTML = "";
  let lastPillar = "";
  for (const id of PERK_ORDER) {
    const perk = PERKS[id];
    if (perk.pillar !== lastPillar) {
      lastPillar = perk.pillar;
      const label = document.createElement("div");
      label.className = "gear-slot-label";
      label.textContent = perk.pillar;
      perkRows.appendChild(label);
    }
    const owned = p.hasPerk(id);
    const row = document.createElement("div");
    row.className = "gear-row";
    const equippedTag =
      owned && perk.kind === "active" && p.activeSkill === id
        ? `<span class="equipped-tag">ON SKILL</span>`
        : "";
    row.innerHTML =
      `<div class="gear-info"><div class="gear-name">${perk.name}${equippedTag}</div>` +
      `<div class="gear-desc">${perk.desc}</div></div>`;
    const btn = document.createElement("button");
    btn.className = "gear-btn";
    if (!owned) {
      btn.textContent = `${PERK_COST} pts`;
      btn.disabled = p.points < PERK_COST;
      btn.addEventListener("click", () => {
        if (game.buyPerk(id)) renderPerks();
      });
    } else if (perk.kind === "active" && p.activeSkill !== id) {
      btn.textContent = "EQUIP";
      btn.addEventListener("click", () => {
        if (game.setActiveSkill(id)) renderPerks();
      });
    } else {
      btn.textContent = "OWNED";
      btn.disabled = true;
    }
    row.appendChild(btn);
    perkRows.appendChild(row);
  }
}

function renderGear() {
  const p = game.player;
  if (!p) return;
  gearRows.innerHTML = "";
  for (const slot of SLOTS) {
    const label = document.createElement("div");
    label.className = "gear-slot-label";
    label.textContent = SLOT_LABELS[slot];
    gearRows.appendChild(label);
    const owned = p.inventory.filter((id) => ITEMS[id].slot === slot);
    if (owned.length === 0) {
      const row = document.createElement("div");
      row.className = "gear-row";
      row.innerHTML = `<div class="gear-info"><div class="gear-desc">Nothing yet — check the shop, or crack open a chest.</div></div>`;
      gearRows.appendChild(row);
      continue;
    }
    for (const id of owned) {
      const it = ITEMS[id];
      const equipped = p.equipment[slot] === id;
      const row = document.createElement("div");
      row.className = "gear-row";
      row.innerHTML =
        `<div class="gear-info"><div class="gear-name">${it.name}` +
        (equipped ? `<span class="equipped-tag">EQUIPPED</span>` : "") +
        `</div><div class="gear-desc">${it.desc}</div></div>`;
      const btn = document.createElement("button");
      btn.className = "gear-btn";
      btn.textContent = equipped ? "WORN" : "EQUIP";
      btn.disabled = equipped;
      btn.addEventListener("click", () => {
        if (game.equipItem(id)) renderGear();
      });
      row.appendChild(btn);
      gearRows.appendChild(row);
    }
  }
}

function renderMap() {
  mapGrid.innerHTML = "";
  for (let y = 0; y < 4; y++) {
    for (let x = 0; x < 5; x++) {
      const id = `${x},${y}`;
      const cell = document.createElement("div");
      cell.className = "map-cell";
      const seen = game.flags["seen:" + id];
      if (seen) cell.classList.add("seen");
      if (game.world.currentId === id) cell.classList.add("here");
      cell.textContent = seen ? SCREENS[id].name.split(" ")[0] : "?";
      mapGrid.appendChild(cell);
    }
  }
  // Dungeon line
  const seenBarrow = game.flags["seen:d0"];
  const inBarrow = game.world.currentId.startsWith("d");
  const d = document.createElement("div");
  d.className = "map-dungeon";
  d.innerHTML = seenBarrow
    ? `<span class="seen-tag">◆ The Hollow Barrow</span>${inBarrow ? " — you are here" : ""}${game.flags.barrow_cleansed ? " — cleansed" : ""}`
    : "◆ ???";
  mapGrid.after(d);
  // clean older dungeon lines
  document.querySelectorAll(".map-dungeon").forEach((el, i, all) => {
    if (i < all.length - 1) el.remove();
  });
  questLine.textContent = "Quest: " + questStatus(game.flags);
}

function setTab(which) {
  for (const [name, [btn, pane]] of Object.entries(tabs)) {
    btn.classList.toggle("active", name === which);
    pane.classList.toggle("hidden", name !== which);
  }
  if (which === "stats") renderSheet();
  else if (which === "perks") renderPerks();
  else if (which === "gear") renderGear();
  else renderMap();
}

for (const [name, [btn]] of Object.entries(tabs)) {
  btn.addEventListener("click", () => setTab(name));
}

function openSheet(tab = "stats") {
  if (!game.openSheet()) return;
  setTab(tab);
  sheet.classList.remove("hidden");
}

function closeSheet() {
  sheet.classList.add("hidden");
  game.closeSheet();
}

hud.levelupBtn.addEventListener("click", () => openSheet("stats"));
menuBtn.addEventListener("click", () => openSheet("gear"));
sheetClose.addEventListener("click", closeSheet);

// ---------- shop ----------

function renderShop() {
  const p = game.player;
  if (!p) return;
  shopGold.textContent = `You carry ${p.gold} gold`;
  shopGold.classList.add("has-points");
  shopRows.innerHTML = "";
  for (const id of SHOP_STOCK) {
    const it = ITEMS[id];
    const owned = p.ownsItem(id);
    const row = document.createElement("div");
    row.className = "gear-row";
    row.innerHTML =
      `<div class="gear-info"><div class="gear-name">${it.name}</div>` +
      `<div class="gear-desc">${SLOT_LABELS[it.slot]} · ${it.desc}</div></div>`;
    const btn = document.createElement("button");
    btn.className = "gear-btn price";
    btn.textContent = owned ? "OWNED" : `${it.price}g`;
    btn.disabled = owned || p.gold < it.price;
    btn.addEventListener("click", () => {
      if (game.buyItem(id)) renderShop();
    });
    row.appendChild(btn);
    shopRows.appendChild(row);
  }
}

game.onShopOpen = () => {
  renderShop();
  shop.classList.remove("hidden");
};

shopClose.addEventListener("click", () => {
  shop.classList.add("hidden");
  game.closeShop();
});

// ---------- dialogue ----------

let dlgLines = [];
let dlgIndex = 0;
let dlgDone = null;

game.onDialogueOpen = (npc, lines, onDone) => {
  dlgLines = lines;
  dlgIndex = 0;
  dlgDone = onDone;
  dialogueName.textContent = npc.name;
  showDlgLine();
  dialogue.classList.remove("hidden");
};

function showDlgLine() {
  // Lines are authored as "Name: text" — strip the name, it's in the header.
  dialogueText.textContent = dlgLines[dlgIndex].replace(/^[^:]+:\s*/, "");
}

dialogue.addEventListener("click", () => {
  if (dialogue.classList.contains("hidden")) return;
  dlgIndex += 1;
  if (dlgIndex < dlgLines.length) {
    showDlgLine();
  } else {
    dialogue.classList.add("hidden");
    // Fire the completion exactly once, even under rapid taps.
    const done = dlgDone;
    dlgDone = null;
    if (done) done();
  }
});

// ---------- weapon mode + keyboard ----------

hud.modeBtn.addEventListener(
  "touchstart",
  (e) => {
    e.preventDefault();
    game.cycleMode();
  },
  { passive: false }
);
hud.modeBtn.addEventListener("mousedown", (e) => {
  e.preventDefault();
  game.cycleMode();
});

window.addEventListener("keydown", (e) => {
  const k = e.key.toLowerCase();
  if (k === "c") {
    if (game.state === "paused") closeSheet();
    else openSheet();
    return;
  }
  if (!game.player) return;
  if (k === "q") game.cycleMode();
  else if (k === "1") game.player.mode = "sword";
  else if (k === "2") game.player.mode = "bow";
  else if (k === "3") game.player.mode = "spell";
  else return;
  game.updateHud();
});

showTitle();

// ---------- frame loop ----------

let last = performance.now();
function frame(now) {
  let dt = (now - last) / 1000;
  last = now;
  if (dt > 0.05) dt = 0.05;
  game.update(dt);
  game.render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") game.saveNow();
});

document.addEventListener("gesturestart", (e) => e.preventDefault());
document.addEventListener(
  "touchmove",
  (e) => {
    if (e.touches.length > 1) e.preventDefault();
  },
  { passive: false }
);
