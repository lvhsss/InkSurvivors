// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import {Assets} from "assets/Assets.sol";
import {InkMath} from "../src/InkMath.sol";
import {Renderer} from "../src/Renderer.sol";

/// MIN-38 — 1/1 grail mechanic coverage:
///   * Determinism: same inkSeeds → same winner.
///   * Exactly four winners across the 10k supply once all four bucket seeds
///     are pushed.
///   * Winner falls inside its bucket's tokenId range.
///   * 1/1 tokens are immune to mutation (status frozen across N inks).
///   * `oneOfOneWinner` returns 0 before the bucket's seed exists.
///   * Render: SVG body is exactly `<svg>…oneOfOne primitive…</svg>`, with
///     no base / skin / overlay layers.
///   * Attribute JSON: exactly `Status = "1 of 1"` + `1/1 = <Name>`, no other
///     attributes (no Background, no Trait Count, no Head/Hand/etc.).
contract OneOfOneTest is Test {
    uint256 internal constant BUCKET_SIZE = 2500;
    uint8 internal constant ONE_OF_ONE_COUNT = 4;
    uint256 internal constant MAX_SUPPLY = 10_000;

    // ---------------------------------------------------------------------
    // Determinism + bucket math
    // ---------------------------------------------------------------------

    function test_oneOfOne_winnerIsDeterministic() public pure {
        uint256[] memory seeds = _fakeSeeds(4, 1);
        uint256 winner0 = _expectedWinner(seeds, 0);
        // Same seeds → same winner across many independent calls.
        for (uint256 i = 0; i < 16; i++) {
            assertEq(InkMath.oneOfOneWinner(winner0, seeds), 1);
        }
    }

    function test_oneOfOne_exactlyFourWinnersAcrossSupply() public pure {
        uint256[] memory seeds = _fakeSeeds(4, 7);
        uint256 hits;
        uint8[5] memory perBucket; // index 1..4 → count
        for (uint256 t = 1; t <= MAX_SUPPLY; t++) {
            uint8 id = InkMath.oneOfOneWinner(t, seeds);
            if (id != 0) {
                hits++;
                perBucket[id]++;
            }
        }
        assertEq(hits, ONE_OF_ONE_COUNT, "expected exactly 4 winners");
        for (uint8 b = 1; b <= ONE_OF_ONE_COUNT; b++) {
            assertEq(perBucket[b], 1, "each bucket must have exactly one winner");
        }
    }

    function test_oneOfOne_winnerInBucketRange() public pure {
        uint256[] memory seeds = _fakeSeeds(4, 11);
        for (uint8 b = 0; b < ONE_OF_ONE_COUNT; b++) {
            uint256 winner = _expectedWinner(seeds, b);
            assertGe(winner, uint256(b) * BUCKET_SIZE + 1);
            assertLe(winner, uint256(b) * BUCKET_SIZE + BUCKET_SIZE);
            assertEq(InkMath.oneOfOneWinner(winner, seeds), b + 1);
        }
    }

    function test_oneOfOne_unresolvedBeforeBucketSeed() public pure {
        // No seeds at all → no winners.
        uint256[] memory empty = new uint256[](0);
        for (uint256 t = 1; t <= MAX_SUPPLY; t += 137) {
            assertEq(InkMath.oneOfOneWinner(t, empty), 0);
        }

        // Only bucket 0 seed pushed → only bucket 0 may have a winner.
        uint256[] memory oneSeed = new uint256[](1);
        oneSeed[0] = uint256(keccak256("seed-0"));
        uint256 expected0 = _expectedWinner(oneSeed, 0);
        assertEq(InkMath.oneOfOneWinner(expected0, oneSeed), 1);
        // Any tokenId in buckets 1..3 must return 0.
        for (uint256 t = BUCKET_SIZE + 1; t <= MAX_SUPPLY; t += 137) {
            assertEq(InkMath.oneOfOneWinner(t, oneSeed), 0, "future bucket leaked a winner");
        }
    }

    function test_oneOfOne_outOfRangeTokensReturnZero() public pure {
        uint256[] memory seeds = _fakeSeeds(4, 99);
        assertEq(InkMath.oneOfOneWinner(0, seeds), 0);
        // Anything past MAX_SUPPLY also yields 0 (bucket index ≥ 4).
        assertEq(InkMath.oneOfOneWinner(MAX_SUPPLY + 1, seeds), 0);
        assertEq(InkMath.oneOfOneWinner(MAX_SUPPLY * 2, seeds), 0);
    }

    // ---------------------------------------------------------------------
    // compute() short-circuit
    // ---------------------------------------------------------------------

    function test_compute_winnerYieldsOneOfOneStatus() public pure {
        uint256[] memory seeds = _fakeSeeds(4, 3);
        for (uint8 b = 0; b < ONE_OF_ONE_COUNT; b++) {
            uint256 winner = _expectedWinner(seeds, b);
            InkMath.TokenState memory s = InkMath.compute(winner, seeds);
            assertEq(uint256(s.status), uint256(InkMath.Status.OneOfOne));
            assertEq(s.oneOfOneId, b + 1);
            // All trait slots cleared (no leftover roll bleed-through).
            assertEq(s.head, 0);
            assertEq(s.hand, 0);
            assertEq(s.mouth, 0);
            assertEq(s.skin, 0);
            assertEq(s.underwear, 0);
            assertEq(s.background, 0);
            assertEq(s.traitCount, 0);
        }
    }

    function test_oneOfOne_immuneToFurtherMutation() public pure {
        // Build a long inkSeeds array; once OneOfOne, status stays OneOfOne.
        uint256[] memory seeds = _fakeSeeds(40, 22); // 40 inks ≈ full lifetime
        for (uint8 b = 0; b < ONE_OF_ONE_COUNT; b++) {
            uint256 winner = _expectedWinner(_slice(seeds, 4), b);
            InkMath.TokenState memory s = InkMath.compute(winner, seeds);
            assertEq(uint256(s.status), uint256(InkMath.Status.OneOfOne), "1/1 mutated");
            assertEq(s.oneOfOneId, b + 1);
        }
    }

    function test_oneOfOne_stepIsNoOpOnceFrozen() public pure {
        InkMath.TokenState memory s;
        s.status = InkMath.Status.OneOfOne;
        s.oneOfOneId = 2;
        for (uint256 i = 0; i < 1000; i++) {
            InkMath.step(s, uint256(keccak256(abi.encode("mut", i))), 1234);
        }
        assertEq(uint256(s.status), uint256(InkMath.Status.OneOfOne));
        assertEq(s.oneOfOneId, 2);
        assertEq(s.traitCount, 0);
    }

    // ---------------------------------------------------------------------
    // Renderer integration
    // ---------------------------------------------------------------------

    function test_render_oneOfOne_attributeJsonShape() public pure {
        // Build a known OneOfOne state and assert the inlined attribute JSON.
        for (uint8 id = 1; id <= ONE_OF_ONE_COUNT; id++) {
            InkMath.TokenState memory s;
            s.status = InkMath.Status.OneOfOne;
            s.oneOfOneId = id;

            string memory uri = Renderer.tokenURI(uint256(id) * 1234, s);
            bytes memory ub = bytes(uri);
            _assertPrefix(uri, "data:application/json;base64,");

            // Attribute JSON is base64-encoded, so we can't grep it directly.
            // We expose the same body via Renderer.svg() and via stateOf, but
            // attribute correctness lives below in test_render_oneOfOne_attributeJsonDecoded
            // which decodes the base64. Here we just sanity-check non-empty.
            assertGt(ub.length, 200, "uri too short");
        }
    }

    function test_render_oneOfOne_svgBodyHasOnlyPrimitive() public pure {
        // For id=1 (Astronaut), the SVG body must contain the AssetsOneOfOne
        // austronaut primitive and NONE of the regular character layers.
        InkMath.TokenState memory s;
        s.status = InkMath.Status.OneOfOne;
        s.oneOfOneId = 1;
        string memory body = Renderer.svg(s);
        bytes memory b = bytes(body);

        // Contains the 1/1 primitive.
        assertTrue(
            _contains(b, bytes(Assets.oneOfOneAustronaut())),
            "missing austronaut primitive in 1/1 svg"
        );

        // Does NOT contain the base human skin (skinBase) — the visual hallmark
        // of every non-1/1 alive render.
        assertEq(_contains(b, bytes(Assets.skinBase())), false, "base layer leaked into 1/1 svg");

        // Does NOT contain the Tombstone-reserved bg or Zombie-reserved bg.
        assertEq(_contains(b, bytes(Assets.background01Tombstone())), false);
        assertEq(_contains(b, bytes(Assets.background04Zombie())), false);
    }

    function test_render_oneOfOne_eachIdRendersDifferentPrimitive() public pure {
        // Snapshot a primitive substring distinctive per 1/1 by hashing the
        // first 200 chars of each Assets.* call. We just check inequality.
        string memory a = Renderer.svg(_oneOfOneState(1));
        string memory b = Renderer.svg(_oneOfOneState(2));
        string memory c = Renderer.svg(_oneOfOneState(3));
        string memory d = Renderer.svg(_oneOfOneState(4));
        assertTrue(keccak256(bytes(a)) != keccak256(bytes(b)));
        assertTrue(keccak256(bytes(b)) != keccak256(bytes(c)));
        assertTrue(keccak256(bytes(c)) != keccak256(bytes(d)));
        assertTrue(keccak256(bytes(a)) != keccak256(bytes(d)));
    }

    function test_render_oneOfOne_attributeJsonDecoded() public pure {
        // Decode the base64 JSON for one of each 1/1 id and assert the shape.
        string[4] memory expectedNames = ["Astronaut", "Dracula", "Master", "Superman"];
        for (uint8 id = 1; id <= ONE_OF_ONE_COUNT; id++) {
            string memory uri = Renderer.tokenURI(uint256(id) * 1000, _oneOfOneState(id));
            string memory json = _decodeJson(uri);
            bytes memory jb = bytes(json);

            // Required:
            assertTrue(_contains(jb, bytes('"Status","value":"1 of 1"')), "status not 1 of 1");
            assertTrue(_contains(jb, bytes('"1/1","value":"')), "1/1 attr missing");
            assertTrue(_contains(jb, bytes(expectedNames[id - 1])), "wrong 1/1 name");

            // Forbidden — none of the regular trait attribute keys must appear.
            assertEq(_contains(jb, bytes('"Background"')), false, "Background leaked");
            assertEq(_contains(jb, bytes('"Head"')), false, "Head leaked");
            assertEq(_contains(jb, bytes('"Hand"')), false, "Hand leaked");
            assertEq(_contains(jb, bytes('"Mouth"')), false, "Mouth leaked");
            assertEq(_contains(jb, bytes('"Skin"')), false, "Skin leaked");
            assertEq(_contains(jb, bytes('"Underwear"')), false, "Underwear leaked");
            assertEq(_contains(jb, bytes('"Trait Count"')), false, "Trait Count leaked");
        }
    }

    // ---------------------------------------------------------------------
    // Fuzz: any random seeds still produce one winner per bucket
    // ---------------------------------------------------------------------

    function testFuzz_oneOfOne_fourWinnersInvariant(uint256 s0, uint256 s1, uint256 s2, uint256 s3) public pure {
        uint256[] memory seeds = new uint256[](4);
        seeds[0] = s0;
        seeds[1] = s1;
        seeds[2] = s2;
        seeds[3] = s3;

        uint8[5] memory perBucket;
        uint256 total;
        for (uint256 t = 1; t <= MAX_SUPPLY; t++) {
            uint8 id = InkMath.oneOfOneWinner(t, seeds);
            if (id == 0) continue;
            perBucket[id]++;
            total++;
        }
        assertEq(total, ONE_OF_ONE_COUNT, "fuzz: total winner count drifted");
        for (uint8 b = 1; b <= ONE_OF_ONE_COUNT; b++) {
            assertEq(perBucket[b], 1, "fuzz: bucket winner count drifted");
        }
    }

    // ---------------------------------------------------------------------
    // helpers
    // ---------------------------------------------------------------------

    function _expectedWinner(uint256[] memory seeds, uint8 bucket) internal pure returns (uint256) {
        return (uint256(keccak256(abi.encode(seeds[bucket]))) % BUCKET_SIZE) + 1 + uint256(bucket) * BUCKET_SIZE;
    }

    function _fakeSeeds(uint256 n, uint256 salt) internal pure returns (uint256[] memory seeds) {
        seeds = new uint256[](n);
        for (uint256 i = 0; i < n; i++) {
            seeds[i] = uint256(keccak256(abi.encode(salt, "seed", i)));
        }
    }

    function _slice(uint256[] memory src, uint256 n) internal pure returns (uint256[] memory out) {
        out = new uint256[](n);
        for (uint256 i = 0; i < n; i++) {
            out[i] = src[i];
        }
    }

    function _oneOfOneState(uint8 id) internal pure returns (InkMath.TokenState memory s) {
        s.status = InkMath.Status.OneOfOne;
        s.oneOfOneId = id;
    }

    function _contains(bytes memory haystack, bytes memory needle) internal pure returns (bool) {
        if (needle.length == 0) return true;
        if (haystack.length < needle.length) return false;
        for (uint256 i = 0; i <= haystack.length - needle.length; i++) {
            bool match_ = true;
            for (uint256 j = 0; j < needle.length; j++) {
                if (haystack[i + j] != needle[j]) {
                    match_ = false;
                    break;
                }
            }
            if (match_) return true;
        }
        return false;
    }

    function _assertPrefix(string memory s, string memory prefix) internal pure {
        bytes memory sb = bytes(s);
        bytes memory pb = bytes(prefix);
        assertGe(sb.length, pb.length, "string shorter than prefix");
        for (uint256 i = 0; i < pb.length; i++) {
            assertEq(sb[i], pb[i], "prefix mismatch");
        }
    }

    /// @dev Decode the `data:application/json;base64,<...>` segment of a
    ///      tokenURI into the underlying JSON string. We use FFI-free base64
    ///      decoding by piping through `vm.parseJson` — but `parseJson` wants
    ///      a JSON literal, not a base64 blob. Easier: re-implement decode.
    function _decodeJson(string memory uri) internal pure returns (string memory) {
        bytes memory u = bytes(uri);
        // Skip the known prefix "data:application/json;base64,".
        uint256 prefixLen = 29;
        require(u.length > prefixLen, "uri too short");
        bytes memory b64 = new bytes(u.length - prefixLen);
        for (uint256 i = 0; i < b64.length; i++) {
            b64[i] = u[prefixLen + i];
        }
        return string(_b64decode(b64));
    }

    /// @dev Minimal base64 decoder (RFC4648, no whitespace, padding-tolerant).
    function _b64decode(bytes memory data) internal pure returns (bytes memory) {
        if (data.length == 0) return new bytes(0);
        // Strip padding.
        uint256 srcLen = data.length;
        while (srcLen > 0 && data[srcLen - 1] == "=") {
            srcLen--;
        }
        uint256 outLen = (srcLen * 6) / 8;
        bytes memory out = new bytes(outLen);
        uint256 buf;
        uint256 bits;
        uint256 oi;
        for (uint256 i = 0; i < srcLen; i++) {
            uint8 c = uint8(data[i]);
            uint256 v;
            if (c >= 65 && c <= 90) v = c - 65; // A-Z
            else if (c >= 97 && c <= 122) v = c - 71; // a-z
            else if (c >= 48 && c <= 57) v = c + 4; // 0-9
            else if (c == 43) v = 62; // +
            else if (c == 47) v = 63; // /
            else revert("bad base64 char");
            buf = (buf << 6) | v;
            bits += 6;
            if (bits >= 8) {
                bits -= 8;
                out[oi++] = bytes1(uint8((buf >> bits) & 0xff));
            }
        }
        return out;
    }
}
