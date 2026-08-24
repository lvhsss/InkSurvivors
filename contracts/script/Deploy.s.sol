// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import {InkSurvivors} from "../src/InkSurvivors.sol";

/// @notice Parametrised deploy script for local Anvil (`forge script ... --rpc-url anvil --broadcast`)
///         or Base Sepolia (`forge script ... --rpc-url base_sepolia --broadcast --verify`).
///         Set `PRIVATE_KEY` in `.env` for testnet deploys.
contract Deploy is Script {
    function run() external returns (InkSurvivors) {
        uint256 pk = vm.envOr("PRIVATE_KEY", uint256(0));
        if (pk == 0) {
            // anvil default key 0
            pk = 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80;
        }

        vm.startBroadcast(pk);
        InkSurvivors gs = new InkSurvivors();
        vm.stopBroadcast();

        console2.log("InkSurvivors deployed at", address(gs));
        return gs;
    }
}
