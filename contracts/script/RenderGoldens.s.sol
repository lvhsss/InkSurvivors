// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import {InkMath} from "../src/InkMath.sol";
import {Renderer} from "../src/Renderer.sol";
import {Base64} from "../src/utils/Base64.sol";

/// @notice Re-renders the canonical token #1 golden artifacts from the current
///         Renderer + Assets libraries. Run with:
///         `forge script script/RenderGoldens.s.sol:RenderGoldens --ffi`
///         (no --broadcast — pure local file output).
contract RenderGoldens is Script {
    function run() external {
        // 1. Base Human (fresh mint) — no traits, default bg.
        InkMath.TokenState memory s;
        _write("token1", 1, s);

        // 2. Live token with Ape skin trait + live bg id 2 (Blue). Demonstrates
        //    skin-on-base layering (MIN-14 #2) and a live-gainable background.
        InkMath.TokenState memory live;
        live.status = InkMath.Status.Alive;
        live.background = 2; // Blue (#5cb8e7)
        live.skin = 2; // Ape
        live.head = 6; // Wizard Hat
        live.hand = 5; // Wand
        live.traitCount = 4;
        _write("token-live-ape", 42, live);

        // 3. Tombstone — must show bg id 1 (#282828) regardless of state.background.
        InkMath.TokenState memory tomb;
        tomb.status = InkMath.Status.Tombstone;
        _write("token-tombstone", 99, tomb);

        // 4. Zombie — must show bg id 4 (#33357C) regardless of state.background.
        InkMath.TokenState memory zomb;
        zomb.status = InkMath.Status.Zombie;
        zomb.head = 4; // Halo
        zomb.hand = 2; // Harp
        zomb.traitCount = 2;
        _write("token-zombie", 101, zomb);

        console2.log("Regenerated 4 sample artifacts under ./artifacts/");
    }

    function _write(string memory base, uint256 tokenId, InkMath.TokenState memory s) internal {
        string memory uri = Renderer.tokenURI(tokenId, s);
        string memory svgBody = Renderer.svg(s);

        bytes memory uriBytes = bytes(uri);
        uint256 prefixLen = bytes("data:application/json;base64,").length;
        bytes memory b64 = new bytes(uriBytes.length - prefixLen);
        for (uint256 i = 0; i < b64.length; i++) {
            b64[i] = uriBytes[i + prefixLen];
        }
        string memory json = string(_decodeBase64(b64));

        vm.writeFile(string(abi.encodePacked("./artifacts/", base, ".uri.txt")), uri);
        vm.writeFile(string(abi.encodePacked("./artifacts/", base, ".json")), json);
        vm.writeFile(string(abi.encodePacked("./artifacts/", base, ".svg")), svgBody);
    }

    // -- minimal base64 decode (only used in this script, not on-chain) ----
    function _decodeBase64(bytes memory data) internal pure returns (bytes memory) {
        if (data.length == 0) return new bytes(0);
        require(data.length % 4 == 0, "bad b64 length");

        uint256 pad = 0;
        if (data[data.length - 1] == "=") pad++;
        if (data[data.length - 2] == "=") pad++;

        uint256 outLen = (data.length / 4) * 3 - pad;
        bytes memory out = new bytes(outLen);

        uint256 j = 0;
        for (uint256 i = 0; i < data.length; i += 4) {
            uint256 a = _b64Idx(uint8(data[i]));
            uint256 b = _b64Idx(uint8(data[i + 1]));
            uint256 c = _b64Idx(uint8(data[i + 2]));
            uint256 d = _b64Idx(uint8(data[i + 3]));
            uint256 triple = (a << 18) | (b << 12) | (c << 6) | d;
            if (j < outLen) out[j++] = bytes1(uint8(triple >> 16));
            if (j < outLen) out[j++] = bytes1(uint8((triple >> 8) & 0xFF));
            if (j < outLen) out[j++] = bytes1(uint8(triple & 0xFF));
        }
        return out;
    }

    function _b64Idx(uint8 c) internal pure returns (uint256) {
        if (c >= 65 && c <= 90) return c - 65;            // A-Z
        if (c >= 97 && c <= 122) return c - 97 + 26;      // a-z
        if (c >= 48 && c <= 57) return c - 48 + 52;       // 0-9
        if (c == 43) return 62;                            // +
        if (c == 47) return 63;                            // /
        if (c == 61) return 0;                             // = pad
        revert("bad b64 char");
    }
}
