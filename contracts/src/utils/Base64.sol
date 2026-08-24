// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title Base64
/// @notice Standard Base64 encoder. Public-domain implementation.
library Base64 {
    string internal constant _TABLE = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

    function encode(bytes memory data) internal pure returns (string memory) {
        if (data.length == 0) return "";

        // Each 3 bytes of input -> 4 bytes of output.
        uint256 encodedLen = 4 * ((data.length + 2) / 3);

        string memory result = new string(encodedLen);
        bytes memory tablePtr = bytes(_TABLE);

        assembly {
            let resultPtr := add(result, 32)
            let dataPtr := add(data, 32)
            let endPtr := add(dataPtr, mload(data))

            for {} lt(dataPtr, endPtr) {} {
                // Load 3 bytes (read 32 bytes but only use 3 by shifting).
                let input := mload(dataPtr)
                dataPtr := add(dataPtr, 3)

                // Each 6-bit chunk indexes into the table.
                let out := mload(add(tablePtr, add(1, and(shr(250, input), 0x3F))))
                out := shl(8, out)
                out := add(out, and(0xFF, mload(add(tablePtr, add(1, and(shr(244, input), 0x3F))))))
                out := shl(8, out)
                out := add(out, and(0xFF, mload(add(tablePtr, add(1, and(shr(238, input), 0x3F))))))
                out := shl(8, out)
                out := add(out, and(0xFF, mload(add(tablePtr, add(1, and(shr(232, input), 0x3F))))))
                out := shl(224, out)

                mstore(resultPtr, out)
                resultPtr := add(resultPtr, 4)
            }

            // Padding.
            switch mod(mload(data), 3)
            case 1 {
                mstore8(sub(resultPtr, 1), 0x3d)
                mstore8(sub(resultPtr, 2), 0x3d)
            }
            case 2 { mstore8(sub(resultPtr, 1), 0x3d) }
        }

        return result;
    }
}
