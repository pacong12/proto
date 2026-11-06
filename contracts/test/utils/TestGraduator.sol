// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {GotonV4Graduator} from "../../src/core/GotonV4Graduator.sol";
import {GotonV4Hook} from "../../src/core/GotonV4Hook.sol";
import {GotonFeeSplitter, GotonFeeSplitterDeployer} from "../../src/core/GotonFeeSplitter.sol";
import {IPoolManagerV4} from "../../src/interfaces/external/IUniswapV4Core.sol";
import {IVestingVault} from "../../src/interfaces/IVestingVault.sol";

/// @notice Graduator wired to placeholder PoolManager / hook addresses for unit tests that never graduate.
library TestGraduator {
    /// @dev Placeholder vault for factories in tests that never vest a launch.
    IVestingVault internal constant NO_VAULT = IVestingVault(address(0x6666));

    function deploy(address payable feeRecipient) internal returns (GotonV4Graduator) {
        return new GotonV4Graduator(
            IPoolManagerV4(address(0x4444)),
            GotonV4Hook(address(0x5555)),
            new GotonFeeSplitterDeployer(),
            feeRecipient,
            GotonFeeSplitter.Split({protocolBps: 3_000, holdersBps: 0, burnBps: 0, creatorBps: 10_000, liquidityBps: 0})
        );
    }
}
