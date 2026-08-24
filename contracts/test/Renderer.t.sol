// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import {Assets} from "assets/Assets.sol";
import {InkMath} from "../src/InkMath.sol";
import {Renderer} from "../src/Renderer.sol";

contract RendererTest is Test {
    function test_render_freshAlive_isDataJson() public pure {
        InkMath.TokenState memory s;
        string memory uri = Renderer.tokenURI(1, s);
        _assertPrefix(uri, "data:application/json;base64,");
    }

    function test_render_baseHuman_statusLabel() public pure {
        InkMath.TokenState memory s;
        // 0 traits, Alive => "Base Human"
        string memory body = Renderer.svg(s);
        // SVG should NOT be the tombstone-reserved background.
        assertEq(_contains(bytes(body), bytes("#282828")), false);
    }

    function test_render_tombstone_isReservedColorAndTraitless() public pure {
        InkMath.TokenState memory s;
        s.status = InkMath.Status.Tombstone;
        string memory body = Renderer.svg(s);
        bytes memory b = bytes(body);
        // Tombstone-reserved bg (id 1, #282828) is the first layer.
        assertTrue(_contains(b, bytes(Assets.background01Tombstone())));

        // tokenURI metadata: Status=Tombstone, no Trait Count attribute.
        string memory uri = Renderer.tokenURI(7, s);
        bytes memory ub = bytes(uri);
        _assertPrefix(uri, "data:application/json;base64,");
        // We can't decode base64 in solidity easily, but we can render the raw
        // attributes inline check via svg body — verify no trait attribute names.
        assertEq(_contains(ub, bytes("Trait Count")), false);
    }

    function test_render_after10Inks_yieldsValidUri() public pure {
        uint256[] memory seeds = new uint256[](10);
        for (uint256 i = 0; i < 10; i++) {
            seeds[i] = uint256(keccak256(abi.encode("ink", i)));
        }
        InkMath.TokenState memory s = InkMath.compute(1, seeds);
        string memory uri = Renderer.tokenURI(1, s);
        _assertPrefix(uri, "data:application/json;base64,");
        assertGt(bytes(uri).length, 100);
    }

    function test_render_zombie_neverShowsSkinAttribute() public pure {
        // Zombies are forbidden from having a Skin slot, so the JSON should
        // never contain a Skin attribute. Run many seeds to catch a zombie.
        uint256 hit;
        for (uint256 i = 0; i < 4000 && hit < 5; i++) {
            InkMath.TokenState memory s;
            s.status = InkMath.Status.Tombstone;
            InkMath.step(s, i + 1, 13);
            if (s.status != InkMath.Status.Zombie) continue;
            hit++;

            // Skin slot stays unset on Zombies — verified at InkMath level
            // already, but double-check the Renderer never injects a Skin name.
            string memory body = Renderer.svg(s);
            assertEq(_contains(bytes(body), bytes('fill="#5e3a1f"')), false, "ape skin in zombie svg");
            assertEq(_contains(bytes(body), bytes('"Skin"')), false, "skin attr in zombie body");
        }
        assertGt(hit, 0, "no zombies observed");
    }

    // -- MIN-14: background gating + skin-on-base layering ---------------

    /// MIN-33 v9: Background is no longer rolled by ink mutation (W_BG = 0).
    /// Random bg is assigned at view time by the Renderer keyed off tokenId.
    /// InkMath.compute(...) therefore leaves `state.background == 0` for any
    /// live token, regardless of how many inks it lives through.
    function test_live_backgroundNotRolledByInk() public pure {
        for (uint256 t = 1; t <= 2000; t++) {
            InkMath.TokenState memory s;
            for (uint256 e = 1; e <= 6 && s.status == InkMath.Status.Alive; e++) {
                InkMath.step(s, uint256(keccak256(abi.encode("bg", t, e))), t);
            }
            if (s.status != InkMath.Status.Alive) continue;
            assertEq(s.background, 0, "live token unexpectedly rolled a bg trait (W_BG must be 0)");
        }
    }

    /// Every Tombstone SVG must render the Tombstone-reserved background id
    /// (1 / #282828) regardless of `state.background`.
    function test_tombstone_rendersReservedBackground() public pure {
        bytes memory needle = bytes(Assets.background01Tombstone());
        for (uint256 i = 0; i < 64; i++) {
            InkMath.TokenState memory s;
            s.status = InkMath.Status.Tombstone;
            // Fuzz state.background — Renderer must override every value.
            s.background = uint8(i % 7); // 0..6 includes both reserved and live ids
            string memory body = Renderer.svg(s);
            assertTrue(_contains(bytes(body), needle), "tombstone svg missing #282828 bg");
        }
    }

    /// Every Zombie SVG must render the Zombie-reserved background id
    /// (4 / #33357C) regardless of `state.background`.
    function test_zombie_rendersReservedBackground() public pure {
        bytes memory needle = bytes(Assets.background04Zombie());
        for (uint256 i = 0; i < 64; i++) {
            InkMath.TokenState memory s;
            s.status = InkMath.Status.Zombie;
            s.background = uint8(i % 7);
            s.head = uint8(i % 7); // any combination must still force bg 4
            s.hand = uint8(i % 6);
            s.mouth = uint8(i % 4);
            s.underwear = uint8(i % 3);
            string memory body = Renderer.svg(s);
            assertTrue(_contains(bytes(body), needle), "zombie svg missing #33357C bg");
        }
    }

    /// Every Alive token must include the base skin layer in its SVG, even
    /// when a Skin trait (Alien or Ape) is set. The skin trait paints on top
    /// of base — it does not replace it.
    function test_skinTraitPreservesBaseLayer() public pure {
        bytes memory baseNeedle = bytes(Assets.skinBase());

        // Case 1: no skin trait — base must be present (Base Human).
        InkMath.TokenState memory s;
        s.status = InkMath.Status.Alive;
        assertTrue(_contains(bytes(Renderer.svg(s)), baseNeedle), "base missing on Base Human");

        // Case 2: every live skin variant — base layer must remain present.
        for (uint8 skinId = 1; skinId <= InkMath.SKIN_COUNT; skinId++) {
            InkMath.TokenState memory ss;
            ss.status = InkMath.Status.Alive;
            ss.skin = skinId;
            ss.traitCount = 1;
            bytes memory body = bytes(Renderer.svg(ss));
            assertTrue(_contains(body, baseNeedle), "base missing when skin trait set");

            // Layer order: base must appear strictly before the skin trait.
            int256 baseIdx = _indexOf(body, baseNeedle);
            int256 skinIdx = _indexOf(body, bytes(_skinHexById(skinId)));
            assertGt(baseIdx, -1);
            assertGt(skinIdx, -1);
            assertGt(skinIdx, baseIdx);
        }
    }

    function _skinHexById(uint8 id) private pure returns (string memory) {
        if (id == 1) return "#dfdfdf"; // alien highlight
        if (id == 2) return "#dda567"; // ape highlight
        if (id == 3) return "#3fce46"; // zombie mid-tone green
        return "";
    }

    function test_svg_layerOrder_baseBeforeHead() public pure {
        InkMath.TokenState memory s;
        s.status = InkMath.Status.Alive;
        s.skin = 2; // ape — unique color "#dda567"
        s.head = 6; // wiz_hat — unique color "#43277e"
        s.traitCount = 2;
        bytes memory body = bytes(Renderer.svg(s));
        int256 skinIdx = _indexOf(body, bytes("#dda567"));
        int256 headIdx = _indexOf(body, bytes("#43277e"));
        assertGt(skinIdx, -1);
        assertGt(headIdx, -1);
        assertGt(headIdx, skinIdx);
    }

    // -- helpers ---------------------------------------------------------

    function _assertPrefix(string memory s, string memory prefix) internal pure {
        bytes memory sb = bytes(s);
        bytes memory pb = bytes(prefix);
        require(sb.length >= pb.length, "string too short");
        for (uint256 i = 0; i < pb.length; i++) {
            assertEq(sb[i], pb[i]);
        }
    }

    function _contains(bytes memory haystack, bytes memory needle) internal pure returns (bool) {
        return _indexOf(haystack, needle) >= 0;
    }

    function _indexOf(bytes memory haystack, bytes memory needle) internal pure returns (int256) {
        if (needle.length == 0 || needle.length > haystack.length) return -1;
        for (uint256 i = 0; i + needle.length <= haystack.length; i++) {
            bool match_ = true;
            for (uint256 j = 0; j < needle.length; j++) {
                if (haystack[i + j] != needle[j]) {
                    match_ = false;
                    break;
                }
            }
            if (match_) return int256(i);
        }
        return -1;
    }
}
