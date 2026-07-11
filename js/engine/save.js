// Persistence: autosave to localStorage. Save data lives in the fixed logical
// coordinate space, so it's resolution-independent.
//
// v1: pre-RPG (numeric 0-100 health). v2: hearts, attributes, XP, gold, pouch.
// Old saves are migrated forward on load.

const KEY = "emberfall.save.v1";

export function loadSave() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || typeof data.screenId !== "string") return null;
    return migrate(data);
  } catch {
    return null;
  }
}

function migrate(data) {
  if (data.v === 2) return data;
  if (data.v === 1) {
    // v1 had health 0..100 and 3 hearts didn't exist yet -> map onto 3 hearts.
    const hp = Math.max(1, Math.min(6, Math.round(((data.health ?? 100) / 100) * 6)));
    return {
      v: 2,
      screenId: data.screenId,
      x: data.x,
      y: data.y,
      hp,
      stats: { might: 0, finesse: 0, focus: 0, vitality: 0 },
      level: 1,
      xp: 0,
      points: 0,
      gold: 0,
      kills: data.kills || 0,
      pouch: null,
    };
  }
  return null;
}

export function writeSave(data) {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    // Storage full or unavailable (private mode) — play on without saving.
  }
}

export function clearSave() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
