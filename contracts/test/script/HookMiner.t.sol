// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {HookMiner} from "../../script/lib/HookMiner.sol";
import {PROTO_V4_HOOK_FLAGS} from "../../src/core/GotonV4Hook.sol";
import {IPoolManagerV4} from "../../src/interfaces/external/IUniswapV4Core.sol";

contract HookMinerTest is Test {
    IPoolManagerV4 constant PM = IPoolManagerV4(0x8366a39CC670B4001A1121B8F6A443A643e40951);
    address constant DEPLOYER = address(0xD3F);

    function _mine() external view returns (bytes32 salt, address hook) {
        return HookMiner.mine(PM, DEPLOYER);
    }

    /// @dev A deploy that failed after creating its hook can be re-run with the same deployer.
    function test_SkipsAHookAddressThatIsAlreadyDeployed() public {
        (bytes32 firstSalt, address first) = this._mine();
        assertEq(uint160(first) & ((1 << 14) - 1), PROTO_V4_HOOK_FLAGS);

        vm.etch(first, hex"00");
        (bytes32 nextSalt, address next) = this._mine();
        assertTrue(nextSalt != firstSalt && next != first, "moves on to a free address");
        assertEq(uint160(next) & ((1 << 14) - 1), PROTO_V4_HOOK_FLAGS, "still carries the hook flags");
        assertEq(next.code.length, 0);
    }
}
