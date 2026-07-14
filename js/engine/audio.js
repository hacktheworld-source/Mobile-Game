// Synthesized sound effects via WebAudio. No asset files — every sound is
// built from oscillators + noise with tiny envelopes. The context unlocks on
// the first user gesture (autoplay policy).

let ctx = null;
let muted = false;

try {
  muted = localStorage.getItem("emberfall.muted") === "1";
} catch {
  /* ignore */
}

export function unlockAudio() {
  if (!ctx) {
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch {
      return;
    }
  }
  if (ctx.state === "suspended") ctx.resume();
}

export function isMuted() {
  return muted;
}

export function setMuted(m) {
  muted = m;
  try {
    localStorage.setItem("emberfall.muted", m ? "1" : "0");
  } catch {
    /* ignore */
  }
}

// --- tiny synth helpers ---

function env(gain, t, attack, decay, peak = 1) {
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(peak, t + attack);
  gain.gain.exponentialRampToValueAtTime(0.001, t + attack + decay);
}

function tone({ type = "square", from = 440, to = from, dur = 0.1, vol = 0.15, delay = 0 }) {
  if (!ctx || muted) return;
  const t = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(from, t);
  osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), t + dur);
  env(g, t, 0.005, dur, vol);
  osc.connect(g).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

function noise({ dur = 0.1, vol = 0.12, freq = 1200, delay = 0 }) {
  if (!ctx || muted) return;
  const t = ctx.currentTime + delay;
  const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = freq;
  const g = ctx.createGain();
  env(g, t, 0.003, dur, vol);
  src.connect(filter).connect(g).connect(ctx.destination);
  src.start(t);
}

// --- the game's voice ---

export const sfx = {
  swing: () => noise({ dur: 0.08, freq: 2400, vol: 0.1 }),
  shoot: () => tone({ type: "triangle", from: 900, to: 300, dur: 0.09, vol: 0.12 }),
  cast: () => {
    tone({ type: "sawtooth", from: 200, to: 700, dur: 0.12, vol: 0.1 });
    noise({ dur: 0.12, freq: 900, vol: 0.05 });
  },
  hit: () => {
    noise({ dur: 0.06, freq: 700, vol: 0.16 });
    tone({ type: "square", from: 220, to: 110, dur: 0.07, vol: 0.1 });
  },
  kill: () => {
    tone({ type: "square", from: 300, to: 60, dur: 0.18, vol: 0.14 });
    noise({ dur: 0.15, freq: 500, vol: 0.1 });
  },
  hurt: () => {
    tone({ type: "sawtooth", from: 180, to: 70, dur: 0.2, vol: 0.18 });
  },
  dodge: () => noise({ dur: 0.07, freq: 3200, vol: 0.06 }),
  coin: () => {
    tone({ type: "square", from: 1100, to: 1100, dur: 0.05, vol: 0.08 });
    tone({ type: "square", from: 1650, to: 1650, dur: 0.08, vol: 0.08, delay: 0.05 });
  },
  heart: () => tone({ type: "sine", from: 500, to: 900, dur: 0.14, vol: 0.12 }),
  levelup: () => {
    [440, 554, 659, 880].forEach((f, i) =>
      tone({ type: "square", from: f, to: f, dur: 0.12, vol: 0.1, delay: i * 0.08 })
    );
  },
  chest: () => {
    tone({ type: "triangle", from: 330, to: 330, dur: 0.08, vol: 0.1 });
    tone({ type: "triangle", from: 660, to: 660, dur: 0.14, vol: 0.1, delay: 0.08 });
  },
  door: () => {
    tone({ type: "sawtooth", from: 90, to: 45, dur: 0.4, vol: 0.12 });
    noise({ dur: 0.35, freq: 200, vol: 0.08 });
  },
  locked: () => tone({ type: "square", from: 140, to: 130, dur: 0.15, vol: 0.12 }),
  buy: () => {
    tone({ type: "square", from: 880, to: 880, dur: 0.06, vol: 0.08 });
    tone({ type: "square", from: 1320, to: 1320, dur: 0.1, vol: 0.08, delay: 0.06 });
  },
  bomb: () => {
    noise({ dur: 0.3, freq: 300, vol: 0.2 });
    tone({ type: "sawtooth", from: 120, to: 40, dur: 0.3, vol: 0.15 });
  },
  nova: () => {
    noise({ dur: 0.25, freq: 800, vol: 0.14 });
    tone({ type: "sawtooth", from: 500, to: 100, dur: 0.3, vol: 0.12 });
  },
  bossRoar: () => {
    tone({ type: "sawtooth", from: 100, to: 40, dur: 0.7, vol: 0.2 });
    noise({ dur: 0.6, freq: 250, vol: 0.12 });
  },
  victory: () => {
    [523, 659, 784, 1047].forEach((f, i) =>
      tone({ type: "triangle", from: f, to: f, dur: 0.2, vol: 0.12, delay: i * 0.12 })
    );
  },
  die: () => {
    tone({ type: "sawtooth", from: 220, to: 40, dur: 0.8, vol: 0.16 });
  },
};
