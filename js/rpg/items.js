// Item catalog. Items are pure data; equipment slots map 1:1 to weapon modes
// plus armor (adds hearts) and a charm (one passive effect).
//
// stats keys:
//   damage       weapon damage for its mode (replaces the base, pre-attribute)
//   hearts       bonus max hearts (armor)
//   speedPct     +% move speed
//   manaRegenPct +% mana regeneration
//   xpPct        +% XP gained
//   goldPct      +% gold picked up

export const SLOTS = ["melee", "bow", "spell", "armor", "charm"];

export const SLOT_LABELS = {
  melee: "Sword",
  bow: "Bow",
  spell: "Catalyst",
  armor: "Armor",
  charm: "Charm",
};

export const ITEMS = {
  // --- melee ---
  rusty_sword: {
    name: "Rusty Sword",
    slot: "melee",
    price: 0,
    desc: "Has seen better centuries.",
    stats: { damage: 40 },
  },
  soldier_blade: {
    name: "Soldier's Blade",
    slot: "melee",
    price: 120,
    desc: "Honest steel, honest work.",
    stats: { damage: 52 },
  },
  knight_claymore: {
    name: "Knight's Claymore",
    slot: "melee",
    price: 300,
    desc: "Heavy. Brutal. Final.",
    stats: { damage: 68 },
  },
  // --- bows ---
  worn_shortbow: {
    name: "Worn Shortbow",
    slot: "bow",
    price: 0,
    desc: "The string complains, but holds.",
    stats: { damage: 30 },
  },
  hunter_bow: {
    name: "Hunter's Bow",
    slot: "bow",
    price: 140,
    desc: "Strung for longer, meaner shots.",
    stats: { damage: 40 },
  },
  war_bow: {
    name: "War Bow",
    slot: "bow",
    price: 320,
    desc: "Punches through mail and malice.",
    stats: { damage: 52 },
  },
  // --- spell catalysts ---
  ember_sprig: {
    name: "Ember Sprig",
    slot: "spell",
    price: 0,
    desc: "A twig that remembers the fire.",
    stats: { damage: 55 },
  },
  ash_wand: {
    name: "Ash Wand",
    slot: "spell",
    price: 160,
    desc: "Carved from a lightning-struck elm.",
    stats: { damage: 70 },
  },
  pyric_staff: {
    name: "Pyric Staff",
    slot: "spell",
    price: 380,
    desc: "It hums when it smells smoke.",
    stats: { damage: 88 },
  },
  // --- armor ---
  leather_jerkin: {
    name: "Leather Jerkin",
    slot: "armor",
    price: 100,
    desc: "+1 heart",
    stats: { hearts: 1 },
  },
  iron_mail: {
    name: "Iron Mail",
    slot: "armor",
    price: 260,
    desc: "+2 hearts",
    stats: { hearts: 2 },
  },
  // --- charms ---
  swift_charm: {
    name: "Swift Charm",
    slot: "charm",
    price: 90,
    desc: "+10% move speed",
    stats: { speedPct: 10 },
  },
  mana_charm: {
    name: "Deepwell Charm",
    slot: "charm",
    price: 130,
    desc: "+60% mana regeneration",
    stats: { manaRegenPct: 60 },
  },
  miser_charm: {
    name: "Miser's Charm",
    slot: "charm",
    price: 120,
    desc: "+30% gold from drops",
    stats: { goldPct: 30 },
  },
  scholar_charm: {
    name: "Scholar's Charm",
    slot: "charm",
    price: 150,
    desc: "+30% XP gained",
    stats: { xpPct: 30 },
  },
};

export const STARTING_EQUIPMENT = {
  melee: "rusty_sword",
  bow: "worn_shortbow",
  spell: "ember_sprig",
  armor: null,
  charm: null,
};

export const STARTING_INVENTORY = ["rusty_sword", "worn_shortbow", "ember_sprig"];

// What the Emberfall shop sells, in display order (cheap to dear).
export const SHOP_STOCK = [
  "swift_charm",
  "leather_jerkin",
  "soldier_blade",
  "miser_charm",
  "mana_charm",
  "hunter_bow",
  "scholar_charm",
  "ash_wand",
  "iron_mail",
  "knight_claymore",
  "war_bow",
  "pyric_staff",
];

// authoring guard
for (const [id, it] of Object.entries(ITEMS)) {
  if (!SLOTS.includes(it.slot)) throw new Error(`Item ${id}: bad slot ${it.slot}`);
}
