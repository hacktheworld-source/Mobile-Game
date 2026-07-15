// Input handling: floating move joystick (left), drag-to-dodge (right),
// hold/drag-to-attack on the ATK button, plus a keyboard fallback.
// Exposes a single `Input` object whose state the game reads each frame.

const JOYSTICK_RADIUS = 55; // px of travel before the stick is "full tilt"
const DEAD_ZONE = 0.16; // ignore tiny drifts
const AIM_DEADZONE = 18; // px an ATK drag must travel before it aims

// Dodge fires either on a slow-but-deliberate drag, OR a fast flick. A real
// fast flick often covers FEWER pixels than a slow drag (touchend fires the
// instant contact breaks), so it's judged by speed, not just distance.
const DODGE_MIN_DRAG = 28; // px: fires regardless of speed once dragged this far
const DODGE_FLICK_MIN_DRAG = 6; // px: minimum to have a direction at all
const DODGE_FLICK_MAX_MS = 160; // a release within this long counts as "fast"

export const Input = {
  // Movement vector, each component in [-1, 1]; magnitude clamped to 1.
  moveX: 0,
  moveY: 0,

  // Attack: `attackPressed` is the edge (single tap / keypress);
  // `attackHeld` autofires as fast as cooldowns allow.
  attackPressed: false,
  attackHeld: false,
  // Manual aim while dragging off the ATK button (normalized), else inactive.
  aimActive: false,
  aimX: 0,
  aimY: 0,

  // Dodge: fired on releasing a right-side drag (with its direction), or by
  // keyboard (no direction -> game falls back to movement/facing).
  dodgePressed: false,
  dodgeDirActive: false,
  dodgeDirX: 0,
  dodgeDirY: 0,
  // Live drag state so the game can draw the aim line from the player.
  dodgeDragging: false,
  dodgeDragX: 0,
  dodgeDragY: 0,

  skillPressed: false,
};

// --- internal state ---
let joystickTouchId = null;
let joyOriginX = 0;
let joyOriginY = 0;

let dodgeTouchId = null;
let dodgeStartX = 0;
let dodgeStartY = 0;
let dodgeStartTime = 0;

let atkTouchId = null;
let atkStartX = 0;
let atkStartY = 0;
let atkMouseHeld = false;

const keys = new Set();

let joystickEl = null;
let knobEl = null;

export function initInput(root) {
  const hasTouch = "ontouchstart" in window || navigator.maxTouchPoints > 0;
  if (!hasTouch) document.body.classList.add("no-touch");

  joystickEl = document.getElementById("joystick");
  knobEl = joystickEl.querySelector(".joystick-knob");

  setupTouchZones(root);
  setupButtons();
  setupKeyboard();
}

// Left ~55% of the screen: floating move joystick. The rest of the canvas:
// drag-to-dodge (a swipe that shows an aim line and dashes on release).
function setupTouchZones(root) {
  const canvas = document.getElementById("game");

  const start = (e) => {
    for (const t of e.changedTouches) {
      if (t.clientX <= window.innerWidth * 0.55) {
        if (joystickTouchId !== null) continue;
        joystickTouchId = t.identifier;
        joyOriginX = t.clientX;
        joyOriginY = t.clientY;
        placeJoystick(t.clientX, t.clientY);
        updateStick(t.clientX, t.clientY);
      } else {
        if (dodgeTouchId !== null) continue;
        dodgeTouchId = t.identifier;
        dodgeStartX = t.clientX;
        dodgeStartY = t.clientY;
        dodgeStartTime = performance.now();
        Input.dodgeDragging = false;
      }
    }
  };

  const move = (e) => {
    for (const t of e.changedTouches) {
      if (t.identifier === joystickTouchId) {
        updateStick(t.clientX, t.clientY);
        e.preventDefault();
      } else if (t.identifier === dodgeTouchId) {
        const dx = t.clientX - dodgeStartX;
        const dy = t.clientY - dodgeStartY;
        const mag = Math.hypot(dx, dy);
        if (mag > 10) {
          Input.dodgeDragging = true;
          Input.dodgeDragX = dx / mag;
          Input.dodgeDragY = dy / mag;
        } else {
          Input.dodgeDragging = false;
        }
        e.preventDefault();
      }
    }
  };

  const end = (e) => {
    for (const t of e.changedTouches) {
      if (t.identifier === joystickTouchId) {
        releaseJoystick();
      } else if (t.identifier === dodgeTouchId) {
        const dx = t.clientX - dodgeStartX;
        const dy = t.clientY - dodgeStartY;
        const mag = Math.hypot(dx, dy);
        const elapsed = performance.now() - dodgeStartTime;
        const isFastFlick = elapsed <= DODGE_FLICK_MAX_MS && mag >= DODGE_FLICK_MIN_DRAG;
        if (mag >= DODGE_MIN_DRAG || isFastFlick) {
          Input.dodgePressed = true;
          Input.dodgeDirActive = true;
          Input.dodgeDirX = dx / mag;
          Input.dodgeDirY = dy / mag;
        }
        dodgeTouchId = null;
        Input.dodgeDragging = false;
      }
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

// Shared by touch drags and desktop mouse drags on the ATK button.
function setAtkAim(dx, dy) {
  const mag = Math.hypot(dx, dy);
  if (mag > AIM_DEADZONE) {
    Input.aimActive = true;
    Input.aimX = dx / mag;
    Input.aimY = dy / mag;
  } else {
    Input.aimActive = false;
  }
}

function clearAtk() {
  Input.attackHeld = false;
  Input.aimActive = false;
}

function setupButtons() {
  const attack = document.getElementById("btn-attack");
  const skill = document.getElementById("btn-skill");

  // ATK: tap = one attack; hold = autofire; drag off the button = aim.
  attack.addEventListener(
    "touchstart",
    (e) => {
      e.preventDefault();
      const t = e.changedTouches[0];
      atkTouchId = t.identifier;
      atkStartX = t.clientX;
      atkStartY = t.clientY;
      Input.attackPressed = true;
      Input.attackHeld = true;
      Input.aimActive = false;
    },
    { passive: false }
  );
  document.addEventListener(
    "touchmove",
    (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === atkTouchId) {
          setAtkAim(t.clientX - atkStartX, t.clientY - atkStartY);
          e.preventDefault();
        }
      }
    },
    { passive: false }
  );
  const atkEnd = (e) => {
    for (const t of e.changedTouches) {
      if (t.identifier === atkTouchId) {
        atkTouchId = null;
        clearAtk();
      }
    }
  };
  document.addEventListener("touchend", atkEnd);
  document.addEventListener("touchcancel", atkEnd);

  // Desktop mouse on ATK mirrors the touch behavior.
  attack.addEventListener("mousedown", (e) => {
    e.preventDefault();
    atkMouseHeld = true;
    atkStartX = e.clientX;
    atkStartY = e.clientY;
    Input.attackPressed = true;
    Input.attackHeld = true;
  });
  window.addEventListener("mousemove", (e) => {
    if (atkMouseHeld) setAtkAim(e.clientX - atkStartX, e.clientY - atkStartY);
  });
  window.addEventListener("mouseup", () => {
    if (atkMouseHeld) {
      atkMouseHeld = false;
      clearAtk();
    }
  });

  // SKILL stays a simple tap.
  if (skill) {
    skill.addEventListener(
      "touchstart",
      (e) => {
        e.preventDefault();
        Input.skillPressed = true;
      },
      { passive: false }
    );
    skill.addEventListener("mousedown", (e) => {
      e.preventDefault();
      Input.skillPressed = true;
    });
  }
}

function setupKeyboard() {
  window.addEventListener("keydown", (e) => {
    const k = e.key.toLowerCase();
    if (keys.has(k)) return; // ignore auto-repeat
    keys.add(k);
    if (k === "j" || k === " ") {
      Input.attackPressed = true;
      Input.attackHeld = true; // hold to autofire
    }
    if (k === "k" || k === "shift") Input.dodgePressed = true;
    if (k === "l") Input.skillPressed = true;
    updateKeyboardVector();
  });

  window.addEventListener("keyup", (e) => {
    const k = e.key.toLowerCase();
    keys.delete(k);
    if (k === "j" || k === " ") {
      if (!keys.has("j") && !keys.has(" ") && atkTouchId === null && !atkMouseHeld) {
        Input.attackHeld = false;
      }
    }
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
  Input.dodgeDirActive = false;
  Input.skillPressed = false;
}
