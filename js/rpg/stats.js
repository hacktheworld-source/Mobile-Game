// Character stats: attributes, derived-stat scaling, and the XP curve.
// The build model is freeform points — every level grants points you can
// spend into any attribute.

export const BASE_HEARTS = 3;
export const POINTS_PER_LEVEL = 3;

// Chunky milestone levels: each level takes noticeably longer.
export function xpNeeded(level) {
  return level * 100;
}

export const ATTRIBUTES = [
  {
    key: "might",
    name: "Might",
    desc: "+8% melee damage per point",
  },
  {
    key: "finesse",
    name: "Finesse",
    desc: "+3% move speed, faster dodge",
  },
  {
    key: "focus",
    name: "Focus",
    desc: "Faster attacks · will empower magic",
  },
  {
    key: "vitality",
    name: "Vitality",
    desc: "+1 heart per point",
  },
];

// Per-point scaling, applied to the PLAYER base constants.
export const SCALING = {
  mightDamage: 0.08, // +8% melee damage
  finesseSpeed: 0.03, // +3% move speed
  finesseDodgeCd: 0.04, // -4% dodge cooldown
  focusAttackCd: 0.04, // -4% attack cooldown
  minAttackCd: 0.15,
  minDodgeCd: 0.35,
};
