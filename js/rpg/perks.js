// Perks: build-defining actives and passives, bought with the same points as
// attributes (PERK_COST each). One active is equipped to the SKILL button.

export const PERK_COST = 2;

export const PERKS = {
  // --- Warfare ---
  whirlwind: {
    name: "Whirlwind",
    pillar: "Warfare",
    kind: "active",
    desc: "SKILL: a 360° heavy swing — 1.6× sword damage to everything around you. 5s cooldown.",
    cooldown: 5,
  },
  lifesteal: {
    name: "Lifesteal",
    pillar: "Warfare",
    kind: "passive",
    desc: "Sword kills have a 25% chance to restore half a heart.",
  },
  // --- Marksmanship ---
  volley: {
    name: "Volley",
    pillar: "Marksmanship",
    kind: "active",
    desc: "SKILL: loose a fan of five arrows. 6s cooldown.",
    cooldown: 6,
  },
  pierce: {
    name: "Piercing Shots",
    pillar: "Marksmanship",
    kind: "passive",
    desc: "Arrows punch through one extra enemy.",
  },
  // --- Sorcery ---
  nova: {
    name: "Flame Nova",
    pillar: "Sorcery",
    kind: "active",
    desc: "SKILL: a ring of eight burning bolts. Costs 40 mana. 8s cooldown.",
    cooldown: 8,
    manaCost: 40,
  },
  kindling: {
    name: "Kindling",
    pillar: "Sorcery",
    kind: "passive",
    desc: "Firebolts set enemies burning (damage over time — burn ignores shields).",
  },
  // --- Survival ---
  ironskin: {
    name: "Iron Skin",
    pillar: "Survival",
    kind: "passive",
    desc: "+1 permanent heart.",
  },
  fleetfoot: {
    name: "Fleetfoot",
    pillar: "Survival",
    kind: "passive",
    desc: "+8% move speed.",
  },
};

export const PERK_ORDER = [
  "whirlwind",
  "lifesteal",
  "volley",
  "pierce",
  "nova",
  "kindling",
  "ironskin",
  "fleetfoot",
];

export const SKILL_LABELS = { whirlwind: "WHIRL", volley: "VOLLEY", nova: "NOVA" };
