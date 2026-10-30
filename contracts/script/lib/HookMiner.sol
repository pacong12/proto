// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {GotonV4Hook, PROTO_V4_HOOK_FLAGS} from "../../src/core/GotonV4Hook.sol";
import {IPoolManagerV4} from "../../src/interfaces/external/IUniswapV4Core.sol";

/// @notice Finds a CREATE2 salt that gives GotonV4Hook an address carrying exactly its permission flags.
library HookMiner {
    /// @dev Deterministic deployer forge routes `new X{salt: ...}` through during broadcasts.
    address internal constant CREATE2_DEPLOYER = 0x4e59b44847b379578588920cA78FbF26c0B4956C;
    uint160 internal constant ALL_HOOK_MASK = (1 << 14) - 1;

    /// @dev Skips addresses that already hold code, so a deploy that failed after creating its hook
    ///      can be re-run with the same deployer instead of colliding with that hook.
    function mine(IPoolManagerV4 poolManager, address hookDeployer) internal view returns (bytes32 salt, address hook) {
        bytes32 initCodeHash =
            keccak256(abi.encodePacked(type(GotonV4Hook).creationCode, abi.encode(poolManager, hookDeployer)));
        for (uint256 i = 0; i < 1_000_000; i++) {
            hook = address(
                uint160(uint256(keccak256(abi.encodePacked(bytes1(0xff), CREATE2_DEPLOYER, bytes32(i), initCodeHash))))
            );
            if (uint160(hook) & ALL_HOOK_MASK == PROTO_V4_HOOK_FLAGS && hook.code.length == 0) {
                return (bytes32(i), hook);
            }
        }
        revert("HookMiner: salt not found");
    }
}
