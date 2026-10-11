// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title AntiSnipeLogic
 * @notice Pure domain logic for decaying anti-snipe tax calculation.
 *         Protects retail traders by taxing bot transactions heavily during
 *         the first 3 seconds post-launch:
 *           t = 0s: 99% tax (9900 bps)
 *           t = 1s: 25% tax (2500 bps)
 *           t = 2s: 3% tax  (300 bps)
 *           t >= 3s: 0% tax (0 bps)
 */
library AntiSnipeLogic {
    uint256 internal constant SNIPE_TAX_T0 = 9900; // 99%
    uint256 internal constant SNIPE_TAX_T1 = 2500; // 25%
    uint256 internal constant SNIPE_TAX_T2 = 300;  // 3%

    /**
     * @notice Calculate current decaying anti-snipe tax in basis points.
     * @param launchTime Timestamp when curve was initialized.
     * @param currentTimestamp Current block timestamp.
     * @return Current tax in basis points.
     */
    function calculateSnipeTaxBps(
        uint256 launchTime,
        uint256 currentTimestamp
    ) internal pure returns (uint256) {
        if (currentTimestamp < launchTime) return SNIPE_TAX_T0;
        uint256 elapsed = currentTimestamp - launchTime;
        if (elapsed >= 3) return 0;
        if (elapsed == 0) return SNIPE_TAX_T0;
        if (elapsed == 1) return SNIPE_TAX_T1;
        return SNIPE_TAX_T2;
    }

    /**
     * @notice Returns true if the anti-snipe decaying tax window is still active.
     */
    function isSnipeTaxActive(
        uint256 launchTime,
        uint256 currentTimestamp
    ) internal pure returns (bool) {
        return calculateSnipeTaxBps(launchTime, currentTimestamp) > 0;
    }
}
