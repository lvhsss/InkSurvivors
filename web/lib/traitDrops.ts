// Per-group + per-trait drop probabilities used by the trait gallery.
// Numbers locked from MIN-8 (see MIN-10 board comment).
//
// Per-ink rolls on live tokens:
//   P_DEATH = 50%   — token becomes a Tombstone
//   P_GAIN  = pGainByCount[traits] = [20, 15, 10, 6, 3, 1, 0]%   — +1 trait
//   Otherwise:        survive unchanged
//
// Conditional on gaining a trait, the group is weighted:
//   Skin = 1, all others = 5  → P(Skin|gain) ≈ 3.85%, every other group ≈ 19.23%.
//
// Tombstones roll P_RESURRECT = 3% per ink → become a Zombie. Zombies then
// roll five independent 50% Bernoulli rolls — one per non-Skin group.
//
// Background is rolled at mint from the gainable set only ({cream, white}).
// The Tombstone-reserved gray background lives in the States section.

export type GroupDropInfo = {
  /** Probability text shown next to the group header. */
  groupChance: string;
  /** Optional sub-label, e.g. "per ink roll" or "of all skins". */
  sublabel?: string;
  /** Per-trait probability text keyed by trait slug. */
  perTrait?: Record<string, string>;
};

const INK_GAIN = "≈19.23% × P(+1)";
const INK_SKIN = "≈3.85% × P(+1)";

export const GROUP_DROPS: Record<string, GroupDropInfo> = {
  background: {
    groupChance: "100% at mint",
    sublabel: "rolled from gainable set — gray is Tombstone-only",
  },
  hand: {
    groupChance: INK_GAIN,
    sublabel: "per-ink trait drop · weight 5",
  },
  head: {
    groupChance: INK_GAIN,
    sublabel: "per-ink trait drop · weight 5",
  },
  mouth: {
    groupChance: INK_GAIN,
    sublabel: "per-ink trait drop · weight 5",
  },
  skin: {
    groupChance: INK_SKIN,
    sublabel: "rarest group · weight 1 · zombies excluded",
  },
  underwear: {
    groupChance: INK_GAIN,
    sublabel: "per-ink trait drop · weight 5",
  },
};

/**
 * Live-token outcome probabilities per ink, keyed by current trait count.
 * pGainByCount[i] is the % chance to gain +1 trait when you already hold i.
 */
export const P_DEATH_PCT = 50;
export const P_RESURRECT_PCT = 3;
export const P_GAIN_BY_COUNT_PCT = [20, 15, 10, 6, 3, 1, 0] as const;

export function dropInfoFor(slug: string): GroupDropInfo {
  return GROUP_DROPS[slug] ?? { groupChance: INK_GAIN };
}
