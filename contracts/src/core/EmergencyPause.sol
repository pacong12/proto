// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title EmergencyPause
 * @notice Circuit breaker for launchpad entry points (DR-01).
 *
 *   - The owner or a dedicated guardian (e.g. an incident-response multisig) can pause instantly;
 *     only the owner can unpause.
 *   - Pausing stops *new money entering*: launches, bonding-curve buys and graduations.
 *   - Exits are deliberately never pausable — curve sells, pool swaps and fee claims stay open — so
 *     the pause can contain an exploit without ever trapping user funds.
 */
abstract contract EmergencyPause {
    address public guardian;
    bool public paused;

    event GuardianUpdated(address indexed guardian);
    event PauseChanged(bool paused, address indexed by);

    error EmergencyPaused();
    error NotGuardian();

    modifier whenNotPaused() {
        if (paused) revert EmergencyPaused();
        _;
    }

    function _pauseOwner() internal view virtual returns (address);

    function setGuardian(address newGuardian) external {
        if (msg.sender != _pauseOwner()) revert NotGuardian();
        guardian = newGuardian;
        emit GuardianUpdated(newGuardian);
    }

    function pause() external {
        if (msg.sender != guardian && msg.sender != _pauseOwner()) revert NotGuardian();
        paused = true;
        emit PauseChanged(true, msg.sender);
    }

    function unpause() external {
        if (msg.sender != _pauseOwner()) revert NotGuardian();
        paused = false;
        emit PauseChanged(false, msg.sender);
    }
}
