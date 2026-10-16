// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ProtoV4Graduator} from "../../src/core/ProtoV4Graduator.sol";
import {ProtoV4Hook} from "../../src/core/ProtoV4Hook.sol";
import {ProtoFeeSplitter, ProtoFeeSplitterDeployer} from "../../src/core/ProtoFeeSplitter.sol";
import {IPoolManagerV4} from "../../src/interfaces/external/IUniswapV4Core.sol";

/// @notice Graduator wired to placeholder PoolManager / hook addresses for unit tests that never graduate.
library TestGraduator {
    function deploy(address payable feeRecipient) internal returns (ProtoV4Graduator) {
        return new ProtoV4Graduator(
            IPoolManagerV4(address(0x4444)),
            ProtoV4Hook(address(0x5555)),
            new ProtoFeeSplitterDeployer(),
            feeRecipient,
            ProtoFeeSplitter.Split({protocolBps: 3_000, holdersBps: 0, burnBps: 0, creatorBps: 10_000, liquidityBps: 0})
        );
    }
}
