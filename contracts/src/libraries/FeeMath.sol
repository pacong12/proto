// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title FeeMath
 * @notice Pure domain math library for fee splits, basis point calculations,
 *         and rounding protection. All functions are internal pure to eliminate
 *         external library linking and preserve identical CREATE2 bytecode.
 */
library FeeMath {
    uint256 internal constant BPS = 10_000;
    uint256 internal constant PRECISION = 1e36;

    /**
     * @notice Calculate a basis point percentage of an amount.
     * @param amount Base quantity.
     * @param feeBps Fee in basis points (100 = 1%).
     * @return Fee amount.
     */
    function calculateFee(uint256 amount, uint256 feeBps) internal pure returns (uint256) {
        if (amount == 0 || feeBps == 0) return 0;
        return (amount * feeBps) / BPS;
    }

    /**
     * @notice Splits accrued fees in LiquidityLocker.sol between creator and protocol.
     *         Default is 70% to creator and 30% to protocol.
     * @param totalFee Total fee accumulated in locker.
     * @param protocolPercent Percentage allocated to protocol (e.g. 30).
     * @return creatorFee Amount sent to token creator or redirect.
     * @return protocolFee Amount sent to protocol fee recipient.
     */
    function calculateLockerSplit(
        uint256 totalFee,
        uint256 protocolPercent
    ) internal pure returns (uint256 creatorFee, uint256 protocolFee) {
        if (totalFee == 0) return (0, 0);
        protocolFee = (totalFee * protocolPercent) / 100;
        creatorFee = totalFee - protocolFee;
    }

    /**
     * @notice Enforces HolderFeeDistributor.sol H-03 flash-loan protection rule:
     *         effectiveBalance = min(snapshotBalance, liveBalance).
     */
    function calculateEffectiveBalance(
        uint256 snapshotBalance,
        uint256 liveBalance
    ) internal pure returns (uint256) {
        return snapshotBalance < liveBalance ? snapshotBalance : liveBalance;
    }
}
