// Input handling: floating virtual joystick + action buttons + keyboard fallback.
// Exposes a single `Input` object whose state the game reads each frame.

const JOYSTICK_RADIUS = 55; // px of travel before the stick is "full tilt"
const DEAD_ZONE = 0.16; // ignore tiny drifts

export const Input = {
  // Movement vector, each component in [-1, 1]; magnitude clamped to 1.
  moveX: 0,
  moveY: 0,
  // Edge-triggered action flags. The game consumes these and resets them.
  attackPressed: false,
  dodgePressed: false,
  skillPressed: false,
};

// --- internal state ---
let joystickTouchId = null;
let joyOriginX = 0;
let joyOriginY = 0;

const keys = new Set();

let joystickEl = null;
let knobEl = null;

export function initInput(root) {
  const hasTouch = "ontouchstart" in window || navigator.maxTouchPoints > 0;
  if (!hasTouch) document.body.classList.add("no-touch");

  joystickEl = document.getElementById("joystick");
  knobEl = joystickEl.querySelector(".joystick-knob");

  setupJoystick(root);
  setupButtons();
  setupKeyboard();
}

// The left ~55% of the screen acts as the floating joystick zone. Touching
// anywhere there drops the stick at that point and tracks the drag.
function setupJoystick(root) {
  const canvas = document.getElementById("game");

  const start = (e) => {
    for (const t of e.changedTouches) {
      if (joystickTouchId !== null) break;
      if (t.clientX > window.innerWidth * 0.55) continue; // right side = buttons
      joystickTouchId = t.identifier;
      joyOriginX = t.clientX;
      joyOriginY = t.clientY;
      placeJoystick(t.clientX, t.clientY);
      updateStick(t.clientX, t.clientY);
    }
  };

  const move = (e) => {
    for (const t of e.changedTouches) {
      if (t.identifier === joystickTouchId) {
        updateStick(t.clientX, t.clientY);
        e.preventDefault();
      }
    }
  };

  const end = (e) => {
    for (const t of e.changedTouches) {
      if (t.identifier === joystickTouchId) releaseJoystick();
    }
  };

  canvas.addEventListener("touchstart", start, { passive: false });
  canvas.addEventListener("touchmove", move, { passive: false });
  canvas.addEventListener("touchend", end);
  canvas.addEventListener("touchcancel", end);
}

function placeJoystick(x, y) {
  joystickEl.style.left = x + "px";
  joystickEl.style.top = y + "px";
  joystickEl.classList.remove("hidden");
}

function updateStick(x, y) {
  let dx = x - joyOriginX;
  let dy = y - joyOriginY;
  const dist = Math.hypot(dx, dy);
  const clamped = Math.min(dist, JOYSTICK_RADIUS);
  const angle = Math.atan2(dy, dx);

  const kx = Math.cos(angle) * clamped;
  const ky = Math.sin(angle) * clamped;
  knobEl.style.transform = `translate(calc(-50% + ${kx}px), calc(-50% + ${ky}px))`;

  const mag = clamped / JOYSTICK_RADIUS; // 0..1
  if (mag < DEAD_ZONE) {
    Input.moveX = 0;
    Input.moveY = 0;
  } else {
    Input.moveX = Math.cos(angle) * mag;
    Input.moveY = Math.sin(angle) * mag;
  }
}

function releaseJoystick() {
  joystickTouchId = null;
  Input.moveX = 0;
  Input.moveY = 0;
  joystickEl.classList.add("hidden");
  knobEl.style.transform = "translate(-50%, -50%)";
}

function setupButtons() {
  const attack = document.getElementById("btn-attack");
  const dodge = document.getElementById("btn-dodge");
  const skill = document.getElementById("btn-skill");

  const bind = (el, fn) => {
    el.addEventListener(
      "touchstart",
      (e) => {
        e.preventDefault();
        fn();
      },
      { passive: false }
    );
    // Mouse fallback for desktop testing.
    el.addEventListener("mousedown", (e) => {
      e.preventDefault();
      fn();
    });
  };

  bind(attack, () => (Input.attackPressed = true));
  bind(dodge, () => (Input.dodgePressed = true));
  if (skill) bind(skill, () => (Input.skillPressed = true));
}

function setupKeyboard() {
  window.addEventListener("keydown", (e) => {
    const k = e.key.toLowerCase();
    if (keys.has(k)) return; // ignore auto-repeat
    keys.add(k);
    if (k === "j" || k === " ") Input.attackPressed = true;
    if (k === "k" || k === "shift") Input.dodgePressed = true;
    if (k === "l") Input.skillPressed = true;
    updateKeyboardVector();
  });

  window.addEventListener("keyup", (e) => {
    keys.delete(e.key.toLowerCase());
    updateKeyboardVector();
  });
}

function updateKeyboardVector() {
  // Only override the joystick when no touch stick is active.
  if (joystickTouchId !== null) return;
  let x = 0;
  let y = 0;
  if (keys.has("a") || keys.has("arrowleft")) x -= 1;
  if (keys.has("d") || keys.has("arrowright")) x += 1;
  if (keys.has("w") || keys.has("arrowup")) y -= 1;
  if (keys.has("s") || keys.has("arrowdown")) y += 1;
  const mag = Math.hypot(x, y);
  if (mag > 0) {
    x /= mag;
    y /= mag;
  }
  Input.moveX = x;
  Input.moveY = y;
}

// Called by the game after it has read the edge-triggered actions.
export function consumeActions() {
  Input.attackPressed = false;
  Input.dodgePressed = false;
  Input.skillPressed = false;
}
