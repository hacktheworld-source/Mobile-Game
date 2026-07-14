// The juice layer: screen shake, hit-stop, particles, floating damage text.
// All effects live in the fixed logical space and are purely cosmetic — the
// game never reads them back.

export const FX = {
  shakeTime: 0,
  shakeMag: 0,
  hitStop: 0, // seconds of frozen gameplay remaining
  particles: [],
  texts: [],
};

export function shake(mag = 4, dur = 0.15) {
  // Keep the strongest current request.
  if (mag >= FX.shakeMag || FX.shakeTime <= 0) {
    FX.shakeMag = mag;
    FX.shakeTime = dur;
  }
}

export function hitStop(dur = 0.05) {
  FX.hitStop = Math.max(FX.hitStop, dur);
}

export function burst(x, y, color, n = 8, speed = 130, life = 0.4, size = 3) {
  for (let i = 0; i < n; i++) {
    if (FX.particles.length > 220) break; // pool cap
    const a = Math.random() * Math.PI * 2;
    const s = speed * (0.4 + Math.random() * 0.8);
    FX.particles.push({
      x,
      y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s,
      life: life * (0.6 + Math.random() * 0.6),
      t: 0,
      color,
      size: size * (0.6 + Math.random() * 0.8),
    });
  }
}

export function floatText(x, y, str, color = "#ffffff", size = 13) {
  if (FX.texts.length > 30) FX.texts.shift();
  FX.texts.push({ x, y, str, color, size, t: 0, life: 0.7 });
}

export function updateFX(dt) {
  FX.shakeTime = Math.max(0, FX.shakeTime - dt);
  for (const p of FX.particles) {
    p.t += dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 0.92;
    p.vy *= 0.92;
  }
  FX.particles = FX.particles.filter((p) => p.t < p.life);
  for (const t of FX.texts) {
    t.t += dt;
    t.y -= 26 * dt;
  }
  FX.texts = FX.texts.filter((t) => t.t < t.life);
}

// Returns the current shake offset to apply to the camera transform.
export function shakeOffset() {
  if (FX.shakeTime <= 0) return { x: 0, y: 0 };
  const m = FX.shakeMag * (FX.shakeTime > 0.05 ? 1 : FX.shakeTime / 0.05);
  return { x: (Math.random() * 2 - 1) * m, y: (Math.random() * 2 - 1) * m };
}

export function renderFX(ctx) {
  for (const p of FX.particles) {
    ctx.globalAlpha = Math.max(0, 1 - p.t / p.life);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
  }
  ctx.globalAlpha = 1;
  for (const t of FX.texts) {
    ctx.globalAlpha = Math.max(0, 1 - t.t / t.life);
    ctx.fillStyle = t.color;
    ctx.font = `800 ${t.size}px -apple-system, system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText(t.str, t.x, t.y);
  }
  ctx.globalAlpha = 1;
}
