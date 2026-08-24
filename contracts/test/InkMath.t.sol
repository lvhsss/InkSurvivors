// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import {InkMath} from "../src/InkMath.sol";

/// MIN-8 mechanics coverage:
///   * Base Human invariant — pre-mutation tokens are Alive with 0 traits.
///   * Tombstone invariant — Tombstones carry no traits.
///   * Zombie one-time-roll + no-Skin invariant.
///   * Diminishing-returns monotonicity.
///   * Skin-rarest invariant.
///
/// We also keep the original distribution sanity checks (death rate,
/// resurrection rate) and the firstSeedIndex math.
contract InkMathTest is Test {
    // -- Status transitions -----------------------------------------------

    function test_baseHuman_atMint_isAliveZeroTraits() public pure {
        InkMath.TokenState memory s;
        assertEq(uint256(s.status), uint256(InkMath.Status.Alive));
        assertEq(s.traitCount, 0);
        assertTrue(InkMath.isBaseHuman(s));
    }

    function test_compute_noSeedsYet_isBaseHuman() public pure {
        uint256[] memory seeds = new uint256[](0);
        InkMath.TokenState memory s = InkMath.compute(1, seeds);
        assertEq(uint256(s.status), uint256(InkMath.Status.Alive));
        assertEq(s.traitCount, 0);
        assertTrue(InkMath.isBaseHuman(s));
    }

    function test_firstMutation_yieldsOneOfThreeOutcomes() public pure {
        // 10k rolls — every outcome should be Alive(0), Alive(1), or Tombstone.
        uint256 trials = 10_000;
        for (uint256 i = 0; i < trials; i++) {
            InkMath.TokenState memory s;
            InkMath.step(s, i + 1, 1);
            if (s.status == InkMath.Status.Tombstone) {
                assertEq(s.traitCount, 0);
            } else if (s.status == InkMath.Status.Alive) {
                assertTrue(s.traitCount == 0 || s.traitCount == 1);
            } else {
                revert("base human rolled to unexpected status");
            }
        }
    }

    // -- Tombstone invariant ---------------------------------------------

    function test_tombstone_clearsAllTraits() public pure {
        InkMath.TokenState memory s;
        s.status = InkMath.Status.Alive;
        s.head = 3;
        s.hand = 4;
        s.mouth = 2;
        s.skin = 1;
        s.underwear = 2;
        s.traitCount = 5;
        // Force a death-zone roll by brute search.
        for (uint256 i = 0; i < 1000; i++) {
            uint256 roll = uint256(keccak256(abi.encode(i, uint256(1)))) % InkMath.ROLL_DENOM;
            if (roll < InkMath.P_DEATH) {
                InkMath.step(s, i, 1);
                break;
            }
        }
        assertEq(uint256(s.status), uint256(InkMath.Status.Tombstone));
        assertEq(s.traitCount, 0);
        assertEq(s.background, 0);
        assertEq(s.head, 0);
        assertEq(s.hand, 0);
        assertEq(s.mouth, 0);
        assertEq(s.skin, 0);
        assertEq(s.underwear, 0);
    }

    function test_tombstone_neverGainsTraits() public pure {
        // Apply many rolls to a Tombstone; aside from possible resurrection
        // to Zombie, traits must remain 0 the whole time we stay a Tombstone.
        for (uint256 t = 0; t < 50; t++) {
            InkMath.TokenState memory s;
            s.status = InkMath.Status.Tombstone;
            for (uint256 i = 0; i < 50 && s.status == InkMath.Status.Tombstone; i++) {
                InkMath.step(s, uint256(keccak256(abi.encode(t, i))), 1);
                if (s.status == InkMath.Status.Tombstone) {
                    assertEq(s.traitCount, 0);
                    assertEq(s.head, 0);
                    assertEq(s.hand, 0);
                    assertEq(s.mouth, 0);
                    assertEq(s.skin, 0);
                    assertEq(s.underwear, 0);
                    assertEq(s.background, 0);
                }
            }
        }
    }

    // -- Zombie one-time-roll + no-Skin invariant -------------------------

    function test_zombie_neverGetsSkin_andNeverMutates() public pure {
        uint256 zombiesObserved;
        for (uint256 i = 0; i < 3000; i++) {
            InkMath.TokenState memory s;
            s.status = InkMath.Status.Tombstone;
            InkMath.step(s, i + 1, 42);
            if (s.status != InkMath.Status.Zombie) continue;
            zombiesObserved++;

            // Rule 6 — no Skin.
            assertEq(s.skin, 0);
            assertEq(s.traitCount, _countTraits(s));

            // One-time roll — capture state and mutate many more times.
            InkMath.TokenState memory before = s;
            for (uint256 j = 0; j < 100; j++) {
                InkMath.step(s, uint256(keccak256(abi.encode("post", j))), 42);
                assertEq(uint256(s.status), uint256(InkMath.Status.Zombie));
                assertEq(s.skin, 0);
                assertEq(s.head, before.head);
                assertEq(s.hand, before.hand);
                assertEq(s.mouth, before.mouth);
                assertEq(s.underwear, before.underwear);
                assertEq(s.background, before.background);
                assertEq(s.traitCount, before.traitCount);
            }
        }
        assertGt(zombiesObserved, 0, "no zombies observed in 3k tombstone rolls");
    }

    // -- Diminishing-returns monotonicity ---------------------------------

    function test_diminishingReturns_pGainStrictlyDecreasesUntilZero() public pure {
        // Monotonic non-increasing, and strictly decreasing while pGain > 0.
        // Per MIN-33: 45 / 30 / 15 / 5 / 1 / 0 for n = 0..5.
        uint256 prev = InkMath.pGainByCount(0);
        assertEq(prev, 45);
        for (uint8 n = 1; n <= 6; n++) {
            uint256 cur = InkMath.pGainByCount(n);
            assertLe(cur, prev);
            if (prev > 0) assertLt(cur, prev);
            prev = cur;
        }
        // Beyond max trait count the curve stays at 0.
        assertEq(InkMath.pGainByCount(7), 0);
        assertEq(InkMath.pGainByCount(255), 0);
    }

    function test_diminishingReturns_traitGainRateDecreasesEmpirically() public pure {
        // Empirical confirmation: probability of gaining a trait on the next
        // roll given current count strictly decreases (0 traits > 1 trait > 2).
        uint256 trials = 6000;
        uint256 g0 = _empiricalGainCount(trials, 0);
        uint256 g1 = _empiricalGainCount(trials, 1);
        uint256 g2 = _empiricalGainCount(trials, 2);
        assertGt(g0, g1, "P(gain | 0) should exceed P(gain | 1)");
        assertGt(g1, g2, "P(gain | 1) should exceed P(gain | 2)");
    }

    function _empiricalGainCount(uint256 trials, uint8 startCount) internal pure returns (uint256) {
        uint256 hits;
        for (uint256 i = 0; i < trials; i++) {
            InkMath.TokenState memory s;
            s.status = InkMath.Status.Alive;
            // Pre-fill `startCount` non-Skin slots so the new draw is unconstrained
            // for the remaining groups.
            if (startCount >= 1) s.head = 1;
            if (startCount >= 2) s.hand = 1;
            s.traitCount = startCount;
            InkMath.step(s, i + 1, 99);
            if (s.status == InkMath.Status.Alive && s.traitCount == startCount + 1) hits++;
        }
        return hits;
    }

    // -- Skin-rarest invariant -------------------------------------------

    function test_skin_isRarestGroupWhenAllAvailable() public pure {
        uint256 trials = 30_000;
        uint256 head;
        uint256 hand;
        uint256 mouth;
        uint256 skin;
        uint256 under;
        uint256 gain;
        for (uint256 i = 0; i < trials; i++) {
            InkMath.TokenState memory s;
            InkMath.step(s, i + 1, 7);
            if (s.status != InkMath.Status.Alive || s.traitCount == 0) continue;
            gain++;
            if (s.head != 0) head++;
            else if (s.hand != 0) hand++;
            else if (s.mouth != 0) mouth++;
            else if (s.underwear != 0) under++;
            else if (s.skin != 0) skin++;
        }
        require(gain > 1000, "too few gain events");

        // Skin must be strictly the smallest count AND > 0 (reachable).
        assertGt(skin, 0, "skin not reachable");
        assertLt(skin, head, "skin should be rarer than head");
        assertLt(skin, hand, "skin should be rarer than hand");
        assertLt(skin, mouth, "skin should be rarer than mouth");
        assertLt(skin, under, "skin should be rarer than underwear");
    }

    // -- Distribution sanity checks --------------------------------------

    function test_alive_deathRate_within3pp() public pure {
        // P_DEATH = 30. ±3pp tolerance.
        uint256 trials = 10_000;
        uint256 deaths;
        for (uint256 i = 0; i < trials; i++) {
            InkMath.TokenState memory s;
            InkMath.step(s, i + 1, 11);
            if (s.status == InkMath.Status.Tombstone) deaths++;
        }
        _assertWithin(deaths, trials, 30, 3);
    }

    function test_tombstone_resurrectionRate_within2pp() public pure {
        uint256 trials = 20_000;
        uint256 zomb;
        for (uint256 i = 0; i < trials; i++) {
            InkMath.TokenState memory s;
            s.status = InkMath.Status.Tombstone;
            InkMath.step(s, i + 1, 23);
            if (s.status == InkMath.Status.Zombie) zomb++;
        }
        // P_RESURRECT = 5 — measured pct rounds to a small int, so allow ±2pp.
        _assertWithin(zomb, trials, 5, 2);
    }

    // -- compute / firstSeedIndex math -----------------------------------

    function test_firstSeedIndex() public pure {
        assertEq(InkMath.firstSeedIndex(1), 0);
        assertEq(InkMath.firstSeedIndex(1000), 0);
        assertEq(InkMath.firstSeedIndex(1001), 1);
        assertEq(InkMath.firstSeedIndex(2000), 1);
        assertEq(InkMath.firstSeedIndex(2001), 2);
        assertEq(InkMath.firstSeedIndex(10_000), 9);
    }

    function test_compute_token1001SkipsInk0Seed() public pure {
        // Token #1001 should ignore inkSeeds[0] entirely.
        uint256[] memory seeds = new uint256[](2);
        seeds[0] = 0xDEADBEEF;
        seeds[1] = 0xCAFEBABE;
        InkMath.TokenState memory withBoth = InkMath.compute(1001, seeds);

        uint256[] memory onlyLater = new uint256[](2);
        onlyLater[0] = 0x123; // unused — first slot doesn't apply to token 1001
        onlyLater[1] = 0xCAFEBABE;
        InkMath.TokenState memory withSwapped = InkMath.compute(1001, onlyLater);

        assertEq(uint256(withBoth.status), uint256(withSwapped.status));
        assertEq(withBoth.traitCount, withSwapped.traitCount);
    }

    // -- 10-ink fuzz fast forward --------------------------------------

    function test_tenInks_reachesTombstoneAndZombiePopulations() public pure {
        uint256 alive;
        uint256 tomb;
        uint256 zombie;
        for (uint256 t = 0; t < 500; t++) {
            uint256[] memory seeds = new uint256[](10);
            for (uint256 i = 0; i < 10; i++) {
                seeds[i] = uint256(keccak256(abi.encode(t, i)));
            }
            InkMath.TokenState memory s = InkMath.compute(1, seeds);
            if (s.status == InkMath.Status.Alive) alive++;
            else if (s.status == InkMath.Status.Tombstone) tomb++;
            else if (s.status == InkMath.Status.Zombie) zombie++;
        }
        assertGt(tomb, 0, "no tombstones in 500 runs");
        assertGt(zombie, 0, "no zombies in 500 runs");
        alive;
    }

    // -- helpers ---------------------------------------------------------

    function _countTraits(InkMath.TokenState memory s) internal pure returns (uint8) {
        uint8 c;
        if (s.background != 0) c++;
        if (s.head != 0) c++;
        if (s.hand != 0) c++;
        if (s.mouth != 0) c++;
        if (s.skin != 0) c++;
        if (s.underwear != 0) c++;
        return c;
    }

    function _assertWithin(uint256 hits, uint256 trials, uint256 targetPct, uint256 tolPp) internal pure {
        uint256 pct = (hits * 100) / trials;
        uint256 diff = pct > targetPct ? pct - targetPct : targetPct - pct;
        if (diff > tolPp) {
            revert(
                string.concat(
                    "distribution off: hits=",
                    _u(hits),
                    " trials=",
                    _u(trials),
                    " target=",
                    _u(targetPct)
                )
            );
        }
    }

    function _u(uint256 v) internal pure returns (string memory) {
        if (v == 0) return "0";
        uint256 t = v;
        uint256 d;
        while (t != 0) {
            d++;
            t /= 10;
        }
        bytes memory b = new bytes(d);
        while (v != 0) {
            d -= 1;
            b[d] = bytes1(uint8(48 + (v % 10)));
            v /= 10;
        }
        return string(b);
    }
}
