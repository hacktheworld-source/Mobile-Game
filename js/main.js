// Entry point: wires up input, the game, the overlay flow (title / death),
// the character sheet, and the frame loop.

import { Game } from "./game.js";
import { initInput } from "./input.js";
import { loadSave } from "./engine/save.js";
import { ATTRIBUTES } from "./rpg/stats.js";

const canvas = document.getElementById("game");
const root = document.getElementById("game-root");

const hud = {
  areaEl: document.getElementById("area"),
  statusEl: document.getElementById("status"),
  heartsEl: document.getElementById("hearts"),
  xpFill: document.getElementById("xp-fill"),
  attackBtn: document.getElementById("btn-attack"),
  dodgeBtn: document.getElementById("btn-dodge"),
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

initInput(root);
const game = new Game(canvas, hud);

// Debug handle for tuning/testing from the console: open with ?debug
if (location.search.includes("debug")) window.__game = game;

let overlayMode = "title"; // title | dead

function showTitle() {
  overlayMode = "title";
  const save = loadSave();
  overlayTitle.textContent = "EMBERFALL";
  overlayBody.innerHTML =
    "The last hearth still burns. Move with the left thumb; <b>ATK</b> to swing, " +
    "<b>DODGE</b> to roll through danger. Walk off a screen's edge to travel.";
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

function openSheet() {
  if (!game.openSheet()) return;
  renderSheet();
  sheet.classList.remove("hidden");
}

function closeSheet() {
  sheet.classList.add("hidden");
  game.closeSheet();
}

hud.levelupBtn.addEventListener("click", openSheet);
sheetClose.addEventListener("click", closeSheet);

// Desktop convenience: C toggles the character sheet.
window.addEventListener("keydown", (e) => {
  if (e.key.toLowerCase() !== "c") return;
  if (game.state === "paused") closeSheet();
  else openSheet();
});

showTitle();

// --- frame loop with delta time (capped to avoid tunneling on tab switches) ---
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

// Save when the tab is backgrounded or closed.
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") game.saveNow();
});

// Prevent iOS double-tap zoom / long-press selection from interfering.
document.addEventListener("gesturestart", (e) => e.preventDefault());
document.addEventListener(
  "touchmove",
  (e) => {
    if (e.touches.length > 1) e.preventDefault();
  },
  { passive: false }
);
