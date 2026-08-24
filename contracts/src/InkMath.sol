// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Assets} from "assets/Assets.sol";

/// @title InkMath
/// @notice Pure library deriving an InkSurvivors token's current state from
///         `(tokenId, inkSeeds)` per the MIN-7/MIN-8 mechanics.
/// @dev    No storage writes. Compute is O(inksLivedThrough) per call.
///
///         ## State model
///         - `Alive`   — pre-mutation Base Human (`traitCount == 0`) and all
///                       trait-bearing survivors share this status. A token
///                       is considered "Base Human" iff
///                       `status == Alive && traitCount == 0`.
///         - `Tombstone` — dead. No traits. Background forced gray by Renderer.
///         - `Zombie`  — resurrected from Tombstone via a single one-time roll
///                       at the resurrection ink. Traits frozen forever.
///                       Skin is forbidden for zombies.
///
///         ## Per-ink transition (Alive)
///         - `P_DEATH`            = 50%  → Tombstone (all traits cleared)
///         - `pGainByCount(N)`    → +1 trait drawn from non-filled groups by
///                                  weight (`W_*`). Diminishing returns:
///                                  pGain decreases monotonically as the
///                                  current trait count grows.
///         - residual             → Survive Unchanged.
///
///         ## Per-ink transition (Tombstone)
///         - `P_RESURRECT`        = 3%   → Zombie. Zombie traits are rolled
///                                          once via independent per-group
///                                          Bernoulli rolls (`P_ZOMBIE_DROP`
///                                          per non-Skin group). Skin is
///                                          permanently excluded.
///         - residual             → Stay Tombstone.
///
///         ## Skin rarest invariant
///         `W_SKIN` is strictly less than every other group weight, so when
///         all groups are eligible the conditional probability of dropping a
///         Skin trait is strictly lower than any other group. Skin is still
///         mathematically reachable (`W_SKIN > 0`).
library InkMath {
    enum Status {
        Alive,
        Tombstone,
        Zombie,
        // MIN-38: deterministic 1/1 grail. Token is permanently exempt from
        // mutation; Renderer paints a single full-frame primitive.
        OneOfOne
    }

    /// @dev Trait slots are uint8: 0 = unfilled, 1..N = local trait id.
    ///      `oneOfOneId` is 0 unless `status == OneOfOne`, in which case it
    ///      carries the 1..ONE_OF_ONE_COUNT slot the token won.
    struct TokenState {
        Status status;
        uint8 background;
        uint8 head;
        uint8 hand;
        uint8 mouth;
        uint8 skin;
        uint8 underwear;
        uint8 traitCount;
        uint8 oneOfOneId;
    }

    uint256 internal constant INK_SIZE = 1000;

    // ---------------------------------------------------------------------
    // MIN-38 — 1/1 grail mechanic
    //
    // Divide the 10k supply into ONE_OF_ONE_COUNT equally-sized buckets.
    // Each bucket has exactly one winner, deterministically resolved from the
    // bucket's ink seed:
    //
    //   winner(bucket) = (keccak256(abi.encode(inkSeeds[bucket])) % BUCKET_SIZE)
    //                  + 1 + bucket * BUCKET_SIZE
    //
    // BUCKET_SIZE * ONE_OF_ONE_COUNT must equal the contract's MAX_SUPPLY
    // (10_000) so every supply slot belongs to exactly one bucket.
    //
    // Properties:
    //   - Pre-mint unpredictable: depends on `block.prevrandao` at the moment
    //     the bucket's ink closed (1000-mint boundary).
    //   - Post-mint provably-fair: the seed is on-chain and immutable.
    //   - Each 1/1 lands iff its bucket is fully minted (guaranteed at
    //     MAX_SUPPLY).
    //   - Hash preimage is a single uint256 (32 bytes), distinct from the
    //     mutation-roll preimage `(seed, tokenId)` (64 bytes), so the bucket
    //     winner check cannot collide with any trait roll.
    // ---------------------------------------------------------------------
    uint256 internal constant BUCKET_SIZE = 2500;
    uint8 internal constant ONE_OF_ONE_COUNT = 4;

    // ---------------------------------------------------------------------
    // Group sizes
    //
    // Background uses a 6-id palette where 2 ids are state-reserved:
    //   1 = Tombstone (#282828) — only ever rendered on Tombstone tokens
    //   4 = Zombie    (#33357C) — only ever rendered on Zombie tokens
    // Live tokens roll from the 4-id live-gainable subset {2, 3, 5, 6}
    // (see `Assets.backgroundLiveAt`). The bg ID for a tombstone or zombie
    // is forced by the Renderer regardless of `state.background`, so we
    // never roll a bg trait at resurrection (see `_resurrectAsZombie`).
    // ---------------------------------------------------------------------
    // Trait IDs are LOCKED against `assets/Assets.sol` function order:
    //   background: 1=Tombstone(reserved), 2=Blue, 3=Orange,
    //               4=Zombie(reserved), 5=Purple, 6=Red
    //   head:       1=UFO, 2=clown, 3=crown, 4=halo, 5=hood, 6=wiz_hat
    //   hand:       1=banana, 2=gun, 3=harp, 4=sword, 5=torch, 6=wand
    //   mouth:      1=cigar, 2=glasses, 3=spit
    //   skin:       1=alien, 2=ape, 3=zombie (live overlay; skinBase/skinTombstone are state)
    //   underwear:  1=underwear-1, 2=underwear-2
    uint8 internal constant BACKGROUND_COUNT = 6;
    uint8 internal constant HEAD_COUNT = 6;
    uint8 internal constant HAND_COUNT = 6;
    uint8 internal constant MOUTH_COUNT = 3;
    // MIN-33: rollable skins for Alive tokens are Alien (1) and Ape (2). Id 3
    // (Zombie skin) is reserved for the Zombie state and forced by the Renderer.
    uint8 internal constant SKIN_COUNT = 2;
    uint8 internal constant UNDERWEAR_COUNT = 2;

    // ---------------------------------------------------------------------
    // Trait-drop group weights (MIN-33 amended). Skin is the rare grail.
    // Background is set at mint (random in Renderer) but is not re-rolled
    // by ink mutation, so W_BG = 0. Listed weights sum to 100.
    // ---------------------------------------------------------------------
    uint256 internal constant W_BG = 0;
    uint256 internal constant W_HEAD = 25;
    uint256 internal constant W_HAND = 25;
    uint256 internal constant W_MOUTH = 10;
    uint256 internal constant W_UNDERWEAR = 35;
    uint256 internal constant W_SKIN = 5;

    // ---------------------------------------------------------------------
    // Outcome probabilities (out of 100).
    // ---------------------------------------------------------------------
    uint256 internal constant ROLL_DENOM = 100;
    uint256 internal constant P_DEATH = 30;
    uint256 internal constant P_RESURRECT = 5;
    uint256 internal constant P_ZOMBIE_DROP = 50; // legacy — unused after exponential zombie rewrite

    /// @notice Diminishing-returns curve for the trait-gain probability.
    /// @dev    Monotonic non-increasing in `n`. Sum with `P_DEATH` is always
    ///         ≤ 100 so a residual "survive unchanged" branch is well-defined.
    ///         Per MIN-33: 45 / 30 / 15 / 5 / 1 / 0 for n = 0..5.
    function pGainByCount(uint8 n) internal pure returns (uint256) {
        if (n == 0) return 45;
        if (n == 1) return 30;
        if (n == 2) return 15;
        if (n == 3) return 5;
        if (n == 4) return 1;
        return 0;
    }

    /// @notice Apply one ink's mutation to `state`.
    /// @dev    Memory struct passed by reference — mutated in place.
    function step(TokenState memory state, uint256 seed, uint256 tokenId) internal pure {
        if (state.status == Status.Zombie || state.status == Status.OneOfOne) {
            return; // zombies and 1/1s are terminal
        }

        uint256 h = uint256(keccak256(abi.encode(seed, tokenId)));
        uint256 roll = h % ROLL_DENOM;

        if (state.status == Status.Tombstone) {
            if (roll < P_RESURRECT) {
                _resurrectAsZombie(state, h);
            }
            return;
        }

        // Alive (incl. Base Human at traitCount == 0).
        if (roll < P_DEATH) {
            _toTombstone(state);
            return;
        }
        uint256 pGain = pGainByCount(state.traitCount);
        if (roll < P_DEATH + pGain) {
            _addTrait(state, h);
        }
        // else: survive unchanged.
    }

    /// @notice Compute the current state for `tokenId` given the full `inkSeeds` array.
    /// @dev    MIN-38: if the token is a 1/1 winner the state short-circuits to
    ///         `OneOfOne`, skipping all mutation rolls.
    function compute(uint256 tokenId, uint256[] memory inkSeeds)
        internal
        pure
        returns (TokenState memory state)
    {
        uint8 ooo = oneOfOneWinner(tokenId, inkSeeds);
        if (ooo != 0) {
            state.status = Status.OneOfOne;
            state.oneOfOneId = ooo;
            return state;
        }

        uint256 firstIdx = (tokenId - 1) / INK_SIZE;
        uint256 len = inkSeeds.length;
        for (uint256 i = firstIdx; i < len; i++) {
            step(state, inkSeeds[i], tokenId);
        }
    }

    /// @notice Returns the 1/1 slot (1..ONE_OF_ONE_COUNT) that `tokenId` won,
    ///         or 0 if the token is not a winner.
    /// @dev    A token's bucket is `(tokenId - 1) / BUCKET_SIZE`. The winner is
    ///         not resolved until the bucket's ink seed is pushed (i.e. the
    ///         first 1000-mint boundary inside the bucket has been crossed).
    ///         Once resolved the answer is permanent for that `inkSeeds`.
    function oneOfOneWinner(uint256 tokenId, uint256[] memory inkSeeds) internal pure returns (uint8) {
        if (tokenId == 0) return 0;
        uint256 bucket = (tokenId - 1) / BUCKET_SIZE;
        if (bucket >= ONE_OF_ONE_COUNT) return 0;
        if (inkSeeds.length <= bucket) return 0;
        uint256 winner =
            (uint256(keccak256(abi.encode(inkSeeds[bucket]))) % BUCKET_SIZE) + 1 + bucket * BUCKET_SIZE;
        return winner == tokenId ? uint8(bucket + 1) : 0;
    }

    /// @notice Index of the first ink seed that ever applies to `tokenId`.
    function firstSeedIndex(uint256 tokenId) internal pure returns (uint256) {
        return (tokenId - 1) / INK_SIZE;
    }

    /// @notice True when the token is in the visual Base Human state.
    function isBaseHuman(TokenState memory state) internal pure returns (bool) {
        return state.status == Status.Alive && state.traitCount == 0;
    }

    // ---------------------------------------------------------------------
    // Internal helpers
    // ---------------------------------------------------------------------

    function _toTombstone(TokenState memory state) private pure {
        state.status = Status.Tombstone;
        state.background = 0;
        state.head = 0;
        state.hand = 0;
        state.mouth = 0;
        state.skin = 0;
        state.underwear = 0;
        state.traitCount = 0;
    }

    /// @dev Drops a single trait into the first non-filled group selected by
    ///      weight. Empty groups (count == 0) and already-filled groups are
    ///      assigned weight 0 so they cannot be chosen.
    function _addTrait(TokenState memory state, uint256 h) private pure {
        uint256 wBg = (BACKGROUND_COUNT > 0 && state.background == 0) ? W_BG : 0;
        uint256 wHead = (HEAD_COUNT > 0 && state.head == 0) ? W_HEAD : 0;
        uint256 wHand = (HAND_COUNT > 0 && state.hand == 0) ? W_HAND : 0;
        uint256 wMouth = (MOUTH_COUNT > 0 && state.mouth == 0) ? W_MOUTH : 0;
        uint256 wUnder = (UNDERWEAR_COUNT > 0 && state.underwear == 0) ? W_UNDERWEAR : 0;
        uint256 wSkin = (SKIN_COUNT > 0 && state.skin == 0) ? W_SKIN : 0;
        uint256 total = wBg + wHead + wHand + wMouth + wUnder + wSkin;
        if (total == 0) return;

        uint256 pick = (h >> 8) % total;
        uint256 traitRoll = h >> 16;

        uint256 cum = wBg;
        if (pick < cum) {
            // Live tokens may only roll a live-gainable background id; reserved
            // ids 1 (Tombstone) and 4 (Zombie) are filtered out by Assets.
            uint8 liveCount = Assets.backgroundLiveCount();
            state.background = Assets.backgroundLiveAt(uint8(traitRoll % liveCount));
            state.traitCount++;
            return;
        }
        cum += wHead;
        if (pick < cum) {
            state.head = uint8((traitRoll % HEAD_COUNT) + 1);
            state.traitCount++;
            return;
        }
        cum += wHand;
        if (pick < cum) {
            state.hand = uint8((traitRoll % HAND_COUNT) + 1);
            state.traitCount++;
            return;
        }
        cum += wMouth;
        if (pick < cum) {
            state.mouth = uint8((traitRoll % MOUTH_COUNT) + 1);
            state.traitCount++;
            return;
        }
        cum += wUnder;
        if (pick < cum) {
            state.underwear = uint8((traitRoll % UNDERWEAR_COUNT) + 1);
            state.traitCount++;
            return;
        }
        // Residual: skin.
        state.skin = uint8((traitRoll % SKIN_COUNT) + 1);
        state.traitCount++;
    }

    /// @dev One-time Zombie roll. Trait count is sampled from an exponentially
    ///      decaying distribution — getting 1 trait is common, getting all 4
    ///      non-Skin groups is extremely rare. Skin is permanently excluded
    ///      per rule 6; Background is excluded because the Renderer forces the
    ///      Zombie-reserved bg id for every Zombie. Weights (out of 31):
    ///        N=0 → 1   (3.2%)
    ///        N=1 → 16  (51.6%)
    ///        N=2 → 8   (25.8%)
    ///        N=3 → 4   (12.9%)
    ///        N=4 → 2   (6.5%)
    function _resurrectAsZombie(TokenState memory state, uint256 h) private pure {
        state.status = Status.Zombie;
        uint256 g = uint256(keccak256(abi.encode(h, "zombie")));

        uint256 roll = g % 31;
        uint8 targetCount;
        if (roll < 1) targetCount = 0;
        else if (roll < 17) targetCount = 1;
        else if (roll < 25) targetCount = 2;
        else if (roll < 29) targetCount = 3;
        else targetCount = 4;

        // Shuffle a [Head, Hand, Mouth, Underwear] permutation, then fill the
        // first `targetCount` groups. Fixed 4-element Fisher–Yates — bounded
        // loops at this scale are gas-trivial and run only at view time.
        uint8[4] memory groupOrder = [uint8(0), 1, 2, 3];
        for (uint256 i = 3; i > 0; i--) {
            uint256 j = (g >> (16 + (i * 8))) % (i + 1);
            (groupOrder[i], groupOrder[j]) = (groupOrder[j], groupOrder[i]);
        }

        for (uint8 idx = 0; idx < targetCount; idx++) {
            uint8 gid = groupOrder[idx];
            uint256 traitRoll = g >> (64 + (uint256(gid) * 16));
            if (gid == 0 && HEAD_COUNT > 0) state.head = uint8((traitRoll % HEAD_COUNT) + 1);
            else if (gid == 1 && HAND_COUNT > 0) state.hand = uint8((traitRoll % HAND_COUNT) + 1);
            else if (gid == 2 && MOUTH_COUNT > 0) state.mouth = uint8((traitRoll % MOUTH_COUNT) + 1);
            else if (gid == 3 && UNDERWEAR_COUNT > 0) state.underwear = uint8((traitRoll % UNDERWEAR_COUNT) + 1);
        }
        // Skin forbidden by rule 6 — never set on zombies.
        state.traitCount = targetCount;
    }
}
