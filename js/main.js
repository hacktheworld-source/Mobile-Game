// Entry point: wires up input, the game, the overlay, and the frame loop.

import { Game } from "./game.js";
import { initInput } from "./input.js";

const canvas = document.getElementById("game");
const root = document.getElementById("game-root");

const hud = {
  roomEl: document.getElementById("room"),
  scoreEl: document.getElementById("score"),
  healthFill: document.getElementById("health-fill"),
  attackBtn: document.getElementById("btn-attack"),
  dodgeBtn: document.getElementById("btn-dodge"),
};

const overlay = document.getElementById("overlay");
const overlayTitle = document.getElementById("overlay-title");
const overlayBody = document.getElementById("overlay-body");
const overlayBtn = document.getElementById("overlay-btn");

initInput(root);
const game = new Game(canvas, hud);

// Debug handle for tuning/testing from the console: open with ?debug
if (location.search.includes("debug")) window.__game = game;

game.onGameOver = (kills, room) => {
  overlayTitle.textContent = "YOU DIED";
  overlayBody.innerHTML = `Reached <b>Room ${room}</b> &nbsp;·&nbsp; <b>${kills}</b> kills`;
  overlayBtn.textContent = "RETRY";
  overlay.classList.remove("hidden");
};

overlayBtn.addEventListener("click", () => {
  overlay.classList.add("hidden");
  game.start();
});

// --- fixed-ish frame loop with delta time (capped to avoid tunneling) ---
let last = performance.now();
function frame(now) {
  let dt = (now - last) / 1000;
  last = now;
  if (dt > 0.05) dt = 0.05; // clamp big pauses (tab switches)

  game.update(dt);
  game.render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Prevent iOS double-tap zoom / long-press selection from interfering.
document.addEventListener("gesturestart", (e) => e.preventDefault());
document.addEventListener(
  "touchmove",
  (e) => {
    if (e.touches.length > 1) e.preventDefault();
  },
  { passive: false }
);
