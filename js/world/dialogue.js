// Dialogue: short, tap-to-advance lines that react to world flags.
// Each entry returns { lines, onDone } for the NPC's current state.
// onDone (optional) mutates flags / grants rewards when the last line closes.

export function getDialogue(key, game) {
  const flags = game.flags;
  const p = game.player;

  if (key === "maren") {
    if (!flags.quest_started) {
      return {
        lines: [
          "Maren: You're awake. Good. The hearth holds — the land doesn't.",
          "Maren: The old barrow past the east fields has opened. Its king still wears the Hollow Crown.",
          "Maren: Cleanse it, ember-touched. The gate stands east of the fields. Bring fire — the dead hate fire.",
        ],
        onDone: () => {
          flags.quest_started = true;
        },
      };
    }
    if (!flags.barrow_cleansed) {
      return {
        lines: [
          "Maren: The barrow gate is east, past the fields. Look for the mound of old stone.",
          "Maren: Its doors answer to a key the dead keep somewhere inside. And the king... telegraph his slams. Move early.",
        ],
      };
    }
    if (!flags.quest_rewarded) {
      return {
        lines: [
          "Maren: ...It's quiet. For the first time in years, the ground is quiet.",
          "Maren: You actually did it. Take this — every coin the town could spare. You've earned worse jobs to come.",
          "Maren: (+150 gold)",
        ],
        onDone: () => {
          flags.quest_rewarded = true;
          p.gold += 150;
        },
      };
    }
    return {
      lines: ["Maren: The hearth burns warmer with you around, ember-touched."],
    };
  }

  return { lines: ["..."] };
}

// One-line quest status for the MAP tab.
export function questStatus(flags) {
  if (!flags.quest_started) return "Speak with Elder Maren by the hearth in Emberfall.";
  if (!flags.barrow_key && !flags.barrow_cleansed)
    return "Cleanse the Hollow Barrow — its gate stands east of the fields. Find the key within.";
  if (!flags.barrow_cleansed)
    return "You hold the Barrow Key. Open the sealed gate and face the Barrow King.";
  if (!flags.quest_rewarded) return "The barrow sleeps. Return to Elder Maren.";
  return "Chapter 1 complete. The Hollow Crown waits deeper in the dark...";
}
