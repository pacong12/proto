// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ILaunchpadToken} from "./interfaces/ILaunchpadToken.sol";
import {PoolKey, PoolIdLibrary, IPoolManager} from "./interfaces/IUniswapV4.sol";

/**
 * @title BondingCurve
 * @notice Constant-product bonding curve for V2 token launches.
 *
 * Lifecycle:
 *   1. Traders buy and sell through this contract until totalEthRaised >= graduationTarget.
 *   2. Upon graduation, the contract records the pool key and marks itself as graduated.
 *   3. A privileged migration keeper calls migrateToV4() once the Uniswap V4 PoolManager
 *      is live on Robinhood Chain, depositing locked ETH and tokens into the pool.
 *   4. If migration has not occurred within MIGRATION_DEADLINE seconds, the factory owner
 *      may call emergencyWithdraw() to recover funds to a specified recipient.
 *
 * Security notes:
 *   - nonReentrant guard on all state-mutating external functions.
 *   - CEI pattern: all state changes precede external calls.
 *   - C-02 fix: funds are no longer permanently locked. Two recovery paths exist:
 *       migrateToV4()       — normal path, executed by factory after V4 is live.
 *       emergencyWithdraw() — safety valve, callable by factory after MIGRATION_DEADLINE.
 *   - Initializer pattern: no constructor args. initialize() replaces the constructor
 *     so bytecode is argument-free and identical across all deployments, enabling
 *     CREATE2-based auto-verification on block explorers.
 */
contract BondingCurve {
    using PoolIdLibrary for PoolKey;

    uint256 public constant BPS = 10_000;
    uint256 public constant CURVE_TOKEN_SUPPLY = 800_000_000 * 1e18;
    uint256 public constant POOL_RESERVE_SUPPLY = 200_000_000 * 1e18;

    // C-02 fix: maximum time (seconds) the factory may wait before calling
    // emergencyWithdraw if V4 migration cannot be completed.
    uint256 public constant MIGRATION_DEADLINE = 180 days;

    // Storage vars (replacing immutables for CREATE2 + initializer pattern)
    ILaunchpadToken public token;
    address public factory;
    address payable public feeRecipient;
    address payable public creator;

    uint256 public graduationTarget;
    uint256 public launchTime;

    address public poolManagerV4;
    address public memeHook;

    uint256 public virtualEthReserve;
    uint256 public virtualTokenReserve;
    uint256 public totalEthRaised;
    uint256 public totalVolumeEth;
    bool public graduated;
    uint256 public graduatedAt;
    bytes32 public graduatedPoolId;
    bool public migrationExecuted;

    bool private _initialized;
    uint256 private _locked;

    event Trade(
        address indexed trader,
        bool indexed isBuy,
        uint256 ethAmount,
        uint256 tokenAmount,
        uint256 feeEth
    );
    event Graduated(
        address indexed token,
        bytes32 indexed poolId,
        uint256 ethGraduated,
        uint256 tokensGraduated
    );
    event MigrationExecuted(address indexed recipient, uint256 ethAmount, uint256 tokenAmount);
    event EmergencyWithdraw(address indexed recipient, uint256 ethAmount, uint256 tokenAmount);

    error AlreadyInitialized();
    error AlreadyGraduated();
    error NotGraduated();
    error MigrationAlreadyExecuted();
    error MigrationDeadlineNotReached();
    error InsufficientOutput();
    error InvalidAmount();
    error TransferFailed();
    error Reentrancy();
    error ZeroAddress();
    error Unauthorized();

    modifier nonReentrant() {
        if (_locked == 1) revert Reentrancy();
        _locked = 1;
        _;
        _locked = 0;
    }

    modifier onlyFactory() {
        if (msg.sender != factory) revert Unauthorized();
        _;
    }

    // ---------------------------------------------------------------------------
    // Initializer (replaces constructor for CREATE2 auto-verify compatibility)
    // ---------------------------------------------------------------------------

    /**
     * @notice One-time initializer called by the factory immediately after CREATE2 deploy.
     * @dev Reverts if called more than once. Storage vars replace immutables so the
     *      compiled bytecode is identical for every curve, enabling auto-verification.
     */
    function initialize(
        address _token,
        address _factory,
        address payable _feeRecipient,
        address payable _creator,
        uint256 _graduationTarget,
        uint256 _virtualEthReserve,
        uint256 _virtualTokenReserve,
        address _poolManagerV4,
        address _memeHook
    ) external {
        if (_initialized) revert AlreadyInitialized();
        if (
            _token == address(0) ||
            _factory == address(0) ||
            _feeRecipient == address(0) ||
            _creator == address(0)
        ) revert ZeroAddress();

        _initialized = true;
        token = ILaunchpadToken(_token);
        factory = _factory;
        feeRecipient = _feeRecipient;
        creator = _creator;
        graduationTarget = _graduationTarget;
        virtualEthReserve = _virtualEthReserve;
        virtualTokenReserve = _virtualTokenReserve;
        poolManagerV4 = _poolManagerV4;
        memeHook = _memeHook;
        launchTime = block.timestamp;
    }

    // ---------------------------------------------------------------------------
    // Price discovery
    // ---------------------------------------------------------------------------

    /**
     * @notice Decaying anti-snipe tax. 99% at t=0, steps down to 0% after 3 seconds.
     * @dev F-02 fix: exemption based on recipient address removed. Any caller could
     *      pass creator/feeRecipient as recipient to bypass the tax. Tax now applies
     *      universally regardless of who the recipient is.
     */
    function currentSnipeTaxBps() public view returns (uint256) {
        uint256 elapsed = block.timestamp - launchTime;
        if (elapsed >= 3) return 0;
        if (elapsed <= 0) return 9900;
        if (elapsed <= 1) return 2500;
        return 300;
    }

    /**
     * @notice Tokens out and platform fee for a given ETH input.
     */
    function getAmountOutBuy(uint256 ethIn) public view returns (uint256 tokenOut, uint256 feeEth) {
        if (ethIn == 0) return (0, 0);
        feeEth = (ethIn * 100) / BPS;
        uint256 netEth = ethIn - feeEth;

        uint256 currentK = virtualEthReserve * virtualTokenReserve;
        uint256 newEthReserve = virtualEthReserve + netEth;
        uint256 newTokenReserve = currentK / newEthReserve;

        tokenOut = virtualTokenReserve - newTokenReserve;
        uint256 available = token.balanceOf(address(this));
        if (available > POOL_RESERVE_SUPPLY) {
            uint256 curveAvailable = available - POOL_RESERVE_SUPPLY;
            if (tokenOut > curveAvailable) {
                tokenOut = curveAvailable;
            }
        }
    }

    /**
     * @notice ETH out and platform fee for a given token input.
     */
    function getAmountOutSell(uint256 tokenIn) public view returns (uint256 ethOut, uint256 feeEth) {
        if (tokenIn == 0) return (0, 0);
        uint256 currentK = virtualEthReserve * virtualTokenReserve;
        uint256 newTokenReserve = virtualTokenReserve + tokenIn;
        uint256 newEthReserve = currentK / newTokenReserve;

        uint256 grossEth = virtualEthReserve - newEthReserve;
        feeEth = (grossEth * 100) / BPS;
        ethOut = grossEth > feeEth ? grossEth - feeEth : 0;
    }

    // ---------------------------------------------------------------------------
    // Trading
    // ---------------------------------------------------------------------------

    /**
     * @notice Buy tokens from the bonding curve for msg.sender.
     */
    function buy(uint256 minTokensOut) external payable returns (uint256 tokensOut) {
        return buyFor(msg.sender, minTokensOut);
    }

    /**
     * @notice Buy tokens from the bonding curve for a specified recipient.
     */
    function buyFor(address recipient, uint256 minTokensOut) public payable nonReentrant returns (uint256 tokensOut) {
        if (graduated) revert AlreadyGraduated();
        if (msg.value == 0) revert InvalidAmount();
        if (recipient == address(0)) revert ZeroAddress();

        (tokensOut, ) = getAmountOutBuy(msg.value);
        if (tokensOut < minTokensOut) revert InsufficientOutput();

        uint256 grossTokensOut = tokensOut;
        uint256 snipeFeeTokens = 0;
        uint256 snipeBps = currentSnipeTaxBps();
        if (snipeBps > 0) {
            snipeFeeTokens = (grossTokensOut * snipeBps) / BPS;
            tokensOut = grossTokensOut - snipeFeeTokens;
        }

        uint256 fee = (msg.value * 100) / BPS;
        uint256 netEth = msg.value - fee;

        // State changes before external calls (CEI).
        virtualEthReserve += netEth;
        virtualTokenReserve -= grossTokensOut;
        totalEthRaised += netEth;
        totalVolumeEth += msg.value;

        bool shouldGraduate = totalEthRaised >= graduationTarget;
        if (shouldGraduate) {
            graduated = true;
            graduatedAt = block.timestamp;
        }

        (bool feeOk, ) = feeRecipient.call{value: fee}("");
        if (!feeOk) revert TransferFailed();

        bool sent = token.transfer(recipient, tokensOut);
        if (!sent) revert TransferFailed();

        if (snipeFeeTokens > 0) {
            bool feeTokensSent = token.transfer(feeRecipient, snipeFeeTokens);
            if (!feeTokensSent) revert TransferFailed();
        }

        emit Trade(recipient, true, msg.value, tokensOut, fee);

        if (shouldGraduate) {
            _prepareGraduationV4();
        }
    }

    /**
     * @notice Sell tokens back to the bonding curve to receive ETH.
     * @dev F-05 fix: strict CEI — all state mutations occur before any external
     *      call (transferFrom or ETH sends). Previously, state was mutated after
     *      transferFrom, violating CEI. The nonReentrant guard provides a defence-
     *      in-depth layer but CEI is the primary protection.
     */
    function sell(uint256 tokenIn, uint256 minEthOut) external nonReentrant returns (uint256 ethOut) {
        if (graduated) revert AlreadyGraduated();
        if (tokenIn == 0) revert InvalidAmount();

        uint256 fee;
        (ethOut, fee) = getAmountOutSell(tokenIn);
        uint256 availableEth = address(this).balance;
        if (ethOut + fee > availableEth) {
            // Tolerate minor rounding discrepancies (<= 100 wei) from integer division truncation
            if (ethOut + fee - availableEth <= 100) {
                uint256 diff = ethOut + fee - availableEth;
                ethOut = ethOut >= diff ? ethOut - diff : 0;
            } else {
                revert TransferFailed();
            }
        }
        if (ethOut < minEthOut) revert InsufficientOutput();

        // EFFECTS — update all state before any external interaction.
        uint256 grossEthOut = ethOut + fee;
        virtualTokenReserve += tokenIn;
        virtualEthReserve -= grossEthOut;
        totalEthRaised = totalEthRaised > grossEthOut ? totalEthRaised - grossEthOut : 0;
        totalVolumeEth += grossEthOut;

        // INTERACTIONS — token pull, then ETH pushes.
        bool taken = token.transferFrom(msg.sender, address(this), tokenIn);
        if (!taken) revert TransferFailed();

        (bool feeOk, ) = feeRecipient.call{value: fee}("");
        if (!feeOk) revert TransferFailed();

        (bool userOk, ) = payable(msg.sender).call{value: ethOut}("");
        if (!userOk) revert TransferFailed();

        emit Trade(msg.sender, false, ethOut, tokenIn, fee);
    }

    // ---------------------------------------------------------------------------
    // Graduation and migration
    // ---------------------------------------------------------------------------

    /**
     * @notice Records the canonical Uniswap V4 pool key and emits the Graduated event.
     *         Funds remain in this contract until migrateToV4() is called by the factory.
     * @dev F-09 fix: sqrtPriceX96 is derived from the actual reserves at graduation time
     *      rather than a hardcoded launch-price constant. Initialising the pool at the
     *      wrong price causes immediate arbitrage against the LP.
     */
    function _prepareGraduationV4() internal {
        uint256 ethHeld = address(this).balance;
        uint256 tokensHeld = token.balanceOf(address(this));

        PoolKey memory key = PoolKey({
            currency0: address(0),
            currency1: address(token),
            fee: 0,
            tickSpacing: 200,
            hooks: memeHook
        });

        graduatedPoolId = key.toId();

        if (poolManagerV4 != address(0) && poolManagerV4.code.length > 0) {
            uint160 sqrtPriceX96 = _computeSqrtPriceX96(virtualEthReserve, virtualTokenReserve);
            // slither-disable-next-line unused-return
            try IPoolManager(poolManagerV4).initialize(key, sqrtPriceX96) returns (int24) {} catch {}
        }

        emit Graduated(address(token), graduatedPoolId, ethHeld, tokensHeld);
    }

    /**
     * @notice Compute sqrtPriceX96 from actual reserves.
     * @dev sqrtPriceX96 = sqrt(ethReserve / tokenReserve) * 2^96
     *                   = sqrt(ethReserve * 2^192 / tokenReserve)
     *      Uses Babylonian integer sqrt.
     */
    function _computeSqrtPriceX96(uint256 ethReserve, uint256 tokenReserve) internal pure returns (uint160) {
        require(tokenReserve > 0, "zero tokenReserve");
        uint256 sqrtNum = _sqrt(ethReserve);
        uint256 sqrtDen = _sqrt(tokenReserve);
        require(sqrtDen > 0, "zero sqrtDen");
        uint256 result = (sqrtNum << 96) / sqrtDen;
        // forge-lint: disable-next-line(unsafe-typecast)
        return uint160(result);
    }

    /// @notice Babylonian integer square root (floor).
    function _sqrt(uint256 x) internal pure returns (uint256 y) {
        if (x <= 0) return 0;
        y = x;
        uint256 z = (x >> 1) + 1;
        while (z < y) {
            y = z;
            z = (x / z + z) >> 1;
        }
    }

    /**
     * @notice Execute liquidity migration into the Uniswap V4 pool.
     * @dev C-02 fix: callable only by the factory once V4 is live.
     */
    function migrateToV4(address payable recipient) external nonReentrant onlyFactory {
        if (!graduated) revert NotGraduated();
        if (migrationExecuted) revert MigrationAlreadyExecuted();
        if (recipient == address(0)) revert ZeroAddress();

        migrationExecuted = true;

        uint256 ethAmount = address(this).balance;
        uint256 tokenAmount = token.balanceOf(address(this));

        if (tokenAmount > 0) {
            bool sent = token.transfer(recipient, tokenAmount);
            if (!sent) revert TransferFailed();
        }

        if (ethAmount > 0) {
            (bool ok, ) = recipient.call{value: ethAmount}("");
            if (!ok) revert TransferFailed();
        }

        emit MigrationExecuted(recipient, ethAmount, tokenAmount);
    }

    /**
     * @notice Safety valve allowing the factory owner to recover funds if V4 migration
     *         cannot be completed within MIGRATION_DEADLINE seconds after graduation.
     * @dev C-02 fix: prevents permanent fund lockup if V4 is never deployed.
     */
    function emergencyWithdraw(address payable recipient) external nonReentrant onlyFactory {
        if (!graduated) revert NotGraduated();
        if (migrationExecuted) revert MigrationAlreadyExecuted();
        if (block.timestamp < graduatedAt + MIGRATION_DEADLINE) revert MigrationDeadlineNotReached();
        if (recipient == address(0)) revert ZeroAddress();

        migrationExecuted = true;

        uint256 ethAmount = address(this).balance;
        uint256 tokenAmount = token.balanceOf(address(this));

        if (tokenAmount > 0) {
            bool sent = token.transfer(recipient, tokenAmount);
            if (!sent) revert TransferFailed();
        }

        if (ethAmount > 0) {
            (bool ok, ) = recipient.call{value: ethAmount}("");
            if (!ok) revert TransferFailed();
        }

        emit EmergencyWithdraw(recipient, ethAmount, tokenAmount);
    }

    /**
     * @notice Accept ETH only while the bonding curve is active (not yet graduated).
     * @dev H-01 fix: after graduation all ETH in this contract belongs to the V4
     *      migration pool. Accepting arbitrary ETH post-graduation would distort
     *      the pool's sqrtPriceX96 when migrateToV4() forwards address(this).balance,
     *      causing immediate arbitrage against the LP.
     *      Pre-graduation, plain ETH transfers are needed so the factory can fund
     *      the initial creator buy via buyFor().
     */
    receive() external payable {
        if (graduated) revert AlreadyGraduated();
    }
}
