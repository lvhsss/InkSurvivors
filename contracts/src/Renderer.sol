// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Assets} from "assets/Assets.sol";
import {InkMath} from "./InkMath.sol";
import {Base64} from "./utils/Base64.sol";
import {Strings} from "./utils/Strings.sol";

/// @title Renderer
/// @notice Composes on-chain SVG and packages it as a
///         `data:application/json;base64,...` URI for InkSurvivors.
///
///         ## Layer order
///         background → base/skin → underwear → hand → mouth → head
///
///         ## Tombstone invariant
///         Tombstone renders only a plain gray background plus the tombstone
///         shape primitive. No trait layers are emitted and no per-token
///         attributes are advertised. This is asserted by
///         `Renderer.t.sol::test_render_tombstone_isGrayAndTraitless`.
///
///         ## Zombie invariant
///         Zombie uses the dedicated zombie skin primitive and renders any
///         non-Skin traits captured at resurrection. Skin slot is by spec
///         always 0 on Zombies.
///
///         ## OneOfOne invariant (MIN-38)
///         A 1/1 winner renders ONLY its full-frame primitive — no base, no
///         skin, no overlays. Attributes carry exactly two fields: `Status =
///         "1 of 1"` and `1/1 = <Name>`. No Background / Trait Count / etc.
///
///         ## Asset coverage
///         The current `assets/Assets.sol` ships only the subset of
///         primitives wired below; trait IDs without an artwork yet render
///         as empty layers. PixelArt (MIN-5) will add the remaining
///         primitives and a follow-up commit will plug them in.
library Renderer {
    using Strings for uint256;

    string internal constant SVG_OPEN = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" '
        'shape-rendering="crispEdges" width="512" height="512">';
    string internal constant SVG_CLOSE = "</svg>";

    /// @dev Fallback background used when an Alive token has no Background trait.
    string internal constant BG_DEFAULT = '<rect width="32" height="32" fill="#1a1a2e"/>';

    function tokenURI(uint256 tokenId, InkMath.TokenState memory state) internal pure returns (string memory) {
        // Per spec (MIN-33 amended): a freshly-minted token is a "Default Naked Human"
        // with 0 traits and a random background. Other slots stay empty until an
        // ink boundary mutation rolls them.
        if (state.status == InkMath.Status.Alive && state.background == 0) {
            uint8 liveCount = Assets.backgroundLiveCount();
            if (liveCount > 0) {
                uint256 h = uint256(keccak256(abi.encode("MIN-33-starter-bg", tokenId)));
                state.background = Assets.backgroundLiveAt(uint8(h % liveCount));
            }
        }

        string memory svgBody = _svg(state);
        string memory imageURI =
            string(abi.encodePacked("data:image/svg+xml;base64,", Base64.encode(bytes(svgBody))));

        bytes memory json = abi.encodePacked(
            '{"name":"Ink Survivors #',
            tokenId.toString(),
            '","description":"On-chain ink survivor. State is derived live from inkSeeds.",',
            '"image":"',
            imageURI,
            '","attributes":',
            _attributes(state),
            "}"
        );

        return string(abi.encodePacked("data:application/json;base64,", Base64.encode(json)));
    }

    function svg(InkMath.TokenState memory state) internal pure returns (string memory) {
        return _svg(state);
    }

    function _svg(InkMath.TokenState memory state) private pure returns (string memory) {
        if (state.status == InkMath.Status.OneOfOne) {
            // 1/1 grail: render the full-frame primitive only. No base layer,
            // no skin, no overlays — per MIN-38 spec.
            return string(abi.encodePacked(SVG_OPEN, _oneOfOne(state.oneOfOneId), SVG_CLOSE));
        }

        if (state.status == InkMath.Status.Tombstone) {
            return string(
                abi.encodePacked(
                    SVG_OPEN,
                    Assets.backgroundById(Assets.backgroundTombstoneId()),
                    Assets.skinTombstone(),
                    SVG_CLOSE
                )
            );
        }

        if (state.status == InkMath.Status.Zombie) {
            // Zombie background is render-forced regardless of state.background;
            // InkMath never assigns a bg trait at resurrection.
            return string(
                abi.encodePacked(
                    SVG_OPEN,
                    Assets.backgroundById(Assets.backgroundZombieId()),
                    Assets.skinZombie(),
                    _underwear(state.underwear),
                    _hand(state.hand),
                    _mouth(state.mouth),
                    _head(state.head),
                    SVG_CLOSE
                )
            );
        }

        // Alive (incl. Base Human at traitCount == 0). Strict layer order:
        //   background → base → skin (overlay) → underwear → hand → mouth → head.
        // Base is ALWAYS emitted so a skin trait paints on top of base pixels
        // rather than replacing them — see MIN-14 scope #2.
        return string(
            abi.encodePacked(
                SVG_OPEN,
                _background(state.background),
                Assets.skinBase(),
                _skin(state.skin),
                _underwear(state.underwear),
                _hand(state.hand),
                _mouth(state.mouth),
                _head(state.head),
                SVG_CLOSE
            )
        );
    }

    // ---------------------------------------------------------------------
    // Asset id → primitive
    //
    // IDs are 1-indexed and follow the alphabetical-by-filename ordering of
    // `assets/source/<group>/*.svg`. Slots without art yet render to "".
    // ---------------------------------------------------------------------

    function _background(uint8 id) private pure returns (string memory) {
        if (id == 0) return BG_DEFAULT; // Alive Base Human with no bg trait yet
        return Assets.backgroundById(id);
    }

    function _skin(uint8 id) private pure returns (string memory) {
        if (id == 1) return Assets.skinAlien();
        if (id == 2) return Assets.skinApe();
        if (id == 3) return Assets.skinZombie();
        return "";
    }

    function _hand(uint8 id) private pure returns (string memory) {
        if (id == 1) return Assets.handBanana();
        if (id == 2) return Assets.handGun();
        if (id == 3) return Assets.handHarp();
        if (id == 4) return Assets.handSword();
        if (id == 5) return Assets.handTorch();
        if (id == 6) return Assets.handWand();
        return "";
    }

    function _head(uint8 id) private pure returns (string memory) {
        if (id == 1) return Assets.headUFO();
        if (id == 2) return Assets.headClown();
        if (id == 3) return Assets.headCrown();
        if (id == 4) return Assets.headHalo();
        if (id == 5) return Assets.headHood();
        if (id == 6) return Assets.headWizHat();
        return "";
    }

    function _mouth(uint8 id) private pure returns (string memory) {
        if (id == 1) return Assets.mouthCigar();
        if (id == 2) return Assets.mouthGlasses();
        if (id == 3) return Assets.mouthSpit();
        return "";
    }

    function _underwear(uint8 id) private pure returns (string memory) {
        if (id == 1) return Assets.underwearUnderwear1();
        if (id == 2) return Assets.underwearUnderwear2();
        return "";
    }

    /// @dev MIN-38: id ordering follows the alphabetical filename order of
    ///      `assets/source/1of1/*.svg` exposed by AssetsOneOfOne — id 1 is
    ///      austronaut (rendered as "Astronaut"), 2 dracula, 3 master, 4 superman.
    function _oneOfOne(uint8 id) private pure returns (string memory) {
        if (id == 1) return Assets.oneOfOneAustronaut();
        if (id == 2) return Assets.oneOfOneDracula();
        if (id == 3) return Assets.oneOfOneMaster();
        if (id == 4) return Assets.oneOfOneSuperman();
        return "";
    }

    // ---------------------------------------------------------------------
    // Attribute names
    // ---------------------------------------------------------------------

    function _statusName(InkMath.TokenState memory state) private pure returns (string memory) {
        if (state.status == InkMath.Status.Tombstone) return "Tombstone";
        if (state.status == InkMath.Status.Zombie) return "Zombie";
        if (state.status == InkMath.Status.OneOfOne) return "1 of 1";
        if (state.traitCount == 0) return "Base Human";
        return "Alive";
    }

    function _oneOfOneName(uint8 id) private pure returns (string memory) {
        if (id == 1) return "Astronaut";
        if (id == 2) return "Dracula";
        if (id == 3) return "Master";
        if (id == 4) return "Superman";
        return "";
    }

    function _headName(uint8 id) private pure returns (string memory) {
        if (id == 1) return "UFO";
        if (id == 2) return "Clown";
        if (id == 3) return "Crown";
        if (id == 4) return "Halo";
        if (id == 5) return "Hood";
        if (id == 6) return "Wizard Hat";
        return "";
    }

    function _handName(uint8 id) private pure returns (string memory) {
        if (id == 1) return "Banana";
        if (id == 2) return "Gun";
        if (id == 3) return "Harp";
        if (id == 4) return "Sword";
        if (id == 5) return "Torch";
        if (id == 6) return "Wand";
        return "";
    }

    function _mouthName(uint8 id) private pure returns (string memory) {
        if (id == 1) return "Cigar";
        if (id == 2) return "Glasses";
        if (id == 3) return "Spit";
        return "";
    }

    function _skinName(uint8 id) private pure returns (string memory) {
        if (id == 1) return "Alien";
        if (id == 2) return "Ape";
        if (id == 3) return "Zombie";
        return "";
    }

    function _underwearName(uint8 id) private pure returns (string memory) {
        if (id == 1) return "Underwear 1";
        if (id == 2) return "Underwear 2";
        return "";
    }

    function _backgroundName(uint8 id) private pure returns (string memory) {
        if (id == 1) return "Tombstone"; // reserved, only seen on Tombstone tokens
        if (id == 2) return "Blue";
        if (id == 3) return "Orange";
        if (id == 4) return "Zombie"; // reserved, only seen on Zombie tokens
        if (id == 5) return "Purple";
        if (id == 6) return "Red";
        return "";
    }

    function _attributes(InkMath.TokenState memory state) private pure returns (string memory) {
        // OneOfOne: exactly two attributes — Status and the 1/1 name. No
        // Background, no Trait Count, no overlays. MIN-38.
        if (state.status == InkMath.Status.OneOfOne) {
            return string(
                abi.encodePacked(
                    '[{"trait_type":"Status","value":"1 of 1"},',
                    '{"trait_type":"1/1","value":"',
                    _oneOfOneName(state.oneOfOneId),
                    '"}]'
                )
            );
        }

        bytes memory out =
            abi.encodePacked('[{"trait_type":"Status","value":"', _statusName(state), '"}');

        // Tombstones: status only. Per spec, no trait attributes.
        if (state.status == InkMath.Status.Tombstone) {
            return string(abi.encodePacked(out, "]"));
        }

        if (state.background != 0) {
            out = abi.encodePacked(
                out, ',{"trait_type":"Background","value":"', _backgroundName(state.background), '"}'
            );
        }
        if (state.head != 0) {
            out = abi.encodePacked(out, ',{"trait_type":"Head","value":"', _headName(state.head), '"}');
        }
        if (state.hand != 0) {
            out = abi.encodePacked(out, ',{"trait_type":"Hand","value":"', _handName(state.hand), '"}');
        }
        if (state.mouth != 0) {
            out = abi.encodePacked(out, ',{"trait_type":"Mouth","value":"', _mouthName(state.mouth), '"}');
        }
        if (state.skin != 0) {
            out = abi.encodePacked(out, ',{"trait_type":"Skin","value":"', _skinName(state.skin), '"}');
        }
        if (state.underwear != 0) {
            out = abi.encodePacked(
                out, ',{"trait_type":"Underwear","value":"', _underwearName(state.underwear), '"}'
            );
        }
        out = abi.encodePacked(
            out, ',{"trait_type":"Trait Count","value":', uint256(state.traitCount).toString(), "}"
        );

        return string(abi.encodePacked(out, "]"));
    }
}
