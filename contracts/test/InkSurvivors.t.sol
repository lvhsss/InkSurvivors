// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import {InkSurvivors} from "../src/InkSurvivors.sol";
import {InkMath} from "../src/InkMath.sol";

contract InkSurvivorsTest is Test {
    InkSurvivors internal gs;
    address internal alice = address(0xA11CE);

    uint256 internal _walletIdx;

    uint256 internal constant PRICE = 0.0001 ether;

    function setUp() public {
        gs = new InkSurvivors();
        vm.deal(alice, 100 ether);
    }

    // -- Mint mechanics ---------------------------------------------------

    function test_mint_singleSuccess() public {
        vm.prank(alice);
        gs.mint{value: PRICE}(1);
        assertEq(gs.balanceOf(alice), 1);
        assertEq(gs.mintedPerWallet(alice), 1);
    }

    function test_mint_perTxBulkSuccess() public {
        vm.prank(alice);
        gs.mint{value: PRICE * 5}(5);
        assertEq(gs.balanceOf(alice), 5);
        assertEq(gs.totalSupply(), 5);
    }

    function test_mint_revertsOnPerTxLimit() public {
        vm.expectRevert(InkSurvivors.QuantityExceedsTxLimit.selector);
        vm.prank(alice);
        gs.mint{value: PRICE * 6}(6);
    }

    function test_mint_revertsOnPerWalletLimit() public {
        // Fill 20 (cap) in chunks of 5.
        for (uint256 i = 0; i < 4; i++) {
            vm.prank(alice);
            gs.mint{value: PRICE * 5}(5);
        }
        assertEq(gs.balanceOf(alice), 20);

        vm.expectRevert(InkSurvivors.WalletMintLimit.selector);
        vm.prank(alice);
        gs.mint{value: PRICE}(1);
    }

    function test_mint_revertsOnQuantityZero() public {
        vm.expectRevert(InkSurvivors.QuantityInvalid.selector);
        vm.prank(alice);
        gs.mint(0);
    }

    function test_mint_revertsOnWrongPriceLow() public {
        vm.expectRevert(InkSurvivors.WrongMintPrice.selector);
        vm.prank(alice);
        gs.mint{value: PRICE - 1}(1);
    }

    function test_mint_revertsOnWrongPriceHigh() public {
        vm.expectRevert(InkSurvivors.WrongMintPrice.selector);
        vm.prank(alice);
        gs.mint{value: PRICE + 1}(1);
    }

    function test_mint_revertsOnZeroValueForOne() public {
        vm.expectRevert(InkSurvivors.WrongMintPrice.selector);
        vm.prank(alice);
        gs.mint{value: 0}(1);
    }

    function test_mint_revertsOnSupplyExhausted() public {
        // Drain the 10_000 supply across many wallets (20 cap each).
        // 10_000 / 20 = 500 wallets, 20 each in chunks of 5.
        for (uint256 i = 0; i < 500; i++) {
            address w = address(uint160(0x100000 + i));
            vm.deal(w, 0.005 ether);
            for (uint256 j = 0; j < 4; j++) {
                vm.prank(w);
                gs.mint{value: PRICE * 5}(5);
            }
        }
        assertEq(gs.totalSupply(), 10_000);

        address loser = address(uint160(0x200000));
        vm.deal(loser, 0.001 ether);
        vm.expectRevert(InkSurvivors.SupplyExhausted.selector);
        vm.prank(loser);
        gs.mint{value: PRICE}(1);
    }

    // -- Ink seeds ------------------------------------------------------

    function test_inkSeedPushedOnlyAt1000() public {
        _mintMany(999);
        assertEq(gs.inkSeedsLength(), 0);

        // 1000th mint — seed pushed.
        _mintMany(1);
        assertEq(gs.inkSeedsLength(), 1);

        // 1001..1999 — no new seed.
        _mintMany(999);
        assertEq(gs.inkSeedsLength(), 1);

        // 2000th — second seed.
        _mintMany(1);
        assertEq(gs.inkSeedsLength(), 2);
    }

    function _mintMany(uint256 n) internal {
        // Caps: MAX_PER_TX=5, MAX_PER_WALLET=20 — rotate wallets every 20.
        uint256 minted = 0;
        while (minted < n) {
            address w = address(uint160(0x800000 + _walletIdx));
            _walletIdx++;
            vm.deal(w, 0.005 ether);
            uint256 fillForWallet = 20;
            uint256 remaining = n - minted;
            if (fillForWallet > remaining) fillForWallet = remaining;
            uint256 walletMinted = 0;
            while (walletMinted < fillForWallet) {
                uint256 chunk = fillForWallet - walletMinted;
                if (chunk > 5) chunk = 5;
                vm.prank(w);
                gs.mint{value: PRICE * chunk}(chunk);
                walletMinted += chunk;
            }
            minted += walletMinted;
        }
    }

    // -- tokenURI ---------------------------------------------------------

    function test_tokenURI_returnsDataJsonBase64() public {
        vm.prank(alice);
        gs.mint{value: PRICE}(1);
        string memory uri = gs.tokenURI(1);
        bytes memory uriBytes = bytes(uri);
        bytes memory prefix = bytes("data:application/json;base64,");
        require(uriBytes.length > prefix.length, "uri too short");
        for (uint256 i = 0; i < prefix.length; i++) {
            assertEq(uriBytes[i], prefix[i]);
        }
    }

    // -- Royalty (EIP-2981) ----------------------------------------------

    function test_royaltyInfo_threePercentToFeesWallet() public view {
        (address receiver, uint256 amount) = gs.royaltyInfo(1, 1 ether);
        assertEq(receiver, gs.FEES_WALLET());
        assertEq(amount, 0.03 ether); // 3% of 1 ether
    }

    function test_supportsInterface_eip2981() public view {
        assertTrue(gs.supportsInterface(0x2a55205a), "EIP-2981 interface id must be advertised");
        // ERC-721 baseline (from ERC721A) should still be supported.
        assertTrue(gs.supportsInterface(0x80ac58cd), "ERC-721 interface id must be advertised");
    }

    // -- Fees wallet ------------------------------------------------------

    function test_withdraw_alwaysGoesToFeesWallet() public {
        // 5 mints from alice → 0.0005 ETH lands in the contract.
        vm.prank(alice);
        gs.mint{value: PRICE * 5}(5);
        uint256 contractBal = address(gs).balance;
        assertEq(contractBal, PRICE * 5);

        uint256 balBefore = gs.FEES_WALLET().balance;
        vm.prank(address(0xCAFE));
        gs.withdraw();

        assertEq(address(gs).balance, 0);
        assertEq(gs.FEES_WALLET().balance, balBefore + contractBal);
    }
}
