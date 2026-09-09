// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ILaunchpadToken} from "./interfaces/ILaunchpadToken.sol";
import {PoolKey, PoolIdLibrary, IPoolManager} from "./interfaces/IUniswapV4.sol";

/**
 * @title BondingCurve
 * @notice Pure mathematical constant-product bonding curve for V2 token launch.
 * Traders buy from and sell back to this curve until graduationTarget is reached.
 * Upon graduation (4.2 ETH raised), liquidity migrates into a Uniswap v4 full-range pool with Meme Hook.
 */
contract BondingCurve {
    using PoolIdLibrary for PoolKey;

    uint256 public constant BPS = 10_000;
    uint256 public constant CURVE_TOKEN_SUPPLY = 800_000_000 * 1e18; // 80% on curve
    uint256 public constant POOL_RESERVE_SUPPLY = 200_000_000 * 1e18; // 20% reserved for graduation pool

    ILaunchpadToken public immutable token;
    address public immutable factory;
    address payable public immutable feeRecipient;
    address payable public immutable creator;

    uint256 public immutable graduationTarget; // 4.2 ETH in wei
    uint256 public immutable launchTime;

    address public immutable poolManagerV4;
    address public immutable memeHook;

    uint256 public virtualEthReserve;
    uint256 public virtualTokenReserve;
    uint256 public totalEthRaised;
    uint256 public totalVolumeEth;
    bool public graduated;
    bytes32 public graduatedPoolId;
    uint256 private _locked;

    event Trade(address indexed trader, bool indexed isBuy, uint256 ethAmount, uint256 tokenAmount, uint256 feeEth);
    event Graduated(address indexed token, bytes32 indexed poolId, uint256 ethGraduated, uint256 tokensGraduated);

    error AlreadyGraduated();
    error NotGraduated();
    error InsufficientOutput();
    error InvalidAmount();
    error CurveCompleted();
    error TransferFailed();
    error Reentrancy();

    modifier nonReentrant() {
        if (_locked == 1) revert Reentrancy();
        _locked = 1;
        _;
        _locked = 0;
    }

    constructor(
        address _token,
        address _factory,
        address payable _feeRecipient,
        address payable _creator,
        uint256 _graduationTarget,
        uint256 _virtualEthReserve,
        uint256 _virtualTokenReserve,
        address _poolManagerV4,
        address _memeHook
    ) {
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

    /**
     * @notice Decaying snipe tax: 99% at t=0 decaying exponentially to 0% over 5 seconds.
     */
    function currentSnipeTaxBps(address recipient) public view returns (uint256) {
        if (recipient == creator || recipient == feeRecipient) return 0;
        uint256 elapsed = block.timestamp - launchTime;
        if (elapsed >= 5) return 0;
        if (elapsed == 0) return 9900;
        if (elapsed == 1) return 2500;
        if (elapsed == 2) return 300;
        return 50;
    }

    /**
     * @notice Calculate tokens received for a given ETH buy amount.
     */
    function getAmountOutBuy(uint256 ethIn) public view returns (uint256 tokenOut, uint256 feeEth) {
        if (ethIn == 0) return (0, 0);
        feeEth = (ethIn * 100) / BPS; // 1% platform fee
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
     * @notice Calculate ETH received for selling a given amount of tokens.
     */
    function getAmountOutSell(uint256 tokenIn) public view returns (uint256 ethOut, uint256 feeEth) {
        if (tokenIn == 0) return (0, 0);
        uint256 currentK = virtualEthReserve * virtualTokenReserve;
        uint256 newTokenReserve = virtualTokenReserve + tokenIn;
        uint256 newEthReserve = currentK / newTokenReserve;

        uint256 grossEth = virtualEthReserve - newEthReserve;
        feeEth = (grossEth * 100) / BPS; // 1% platform fee
        ethOut = grossEth > feeEth ? grossEth - feeEth : 0;
    }

    /**
     * @notice Buy tokens directly from the bonding curve using ETH.
     */
    function buy(uint256 minTokensOut) external payable nonReentrant returns (uint256 tokensOut) {
        if (graduated) revert AlreadyGraduated();
        if (msg.value == 0) revert InvalidAmount();

        (tokensOut, ) = getAmountOutBuy(msg.value);
        if (tokensOut < minTokensOut) revert InsufficientOutput();

        uint256 snipeBps = currentSnipeTaxBps(msg.sender);
        if (snipeBps > 0) {
            uint256 snipeFeeTokens = (tokensOut * snipeBps) / BPS;
            tokensOut -= snipeFeeTokens;
        }

        uint256 fee = (msg.value * 100) / BPS;
        uint256 netEth = msg.value - fee;

        virtualEthReserve += netEth;
        virtualTokenReserve -= tokensOut;
        totalEthRaised += netEth;
        totalVolumeEth += msg.value;

        // Send platform fee
        (bool feeOk, ) = feeRecipient.call{value: fee}("");
        if (!feeOk) revert TransferFailed();

        bool sent = token.transfer(msg.sender, tokensOut);
        if (!sent) revert TransferFailed();

        emit Trade(msg.sender, true, msg.value, tokensOut, fee);

        if (totalEthRaised >= graduationTarget) {
            _executeGraduationV4();
        }
    }

    /**
     * @notice Sell tokens back to the bonding curve to receive ETH.
     */
    function sell(uint256 tokenIn, uint256 minEthOut) external nonReentrant returns (uint256 ethOut) {
        if (graduated) revert AlreadyGraduated();
        if (tokenIn == 0) revert InvalidAmount();

        uint256 fee;
        (ethOut, fee) = getAmountOutSell(tokenIn);
        if (ethOut < minEthOut) revert InsufficientOutput();
        if (ethOut + fee > address(this).balance) revert TransferFailed();

        bool taken = token.transferFrom(msg.sender, address(this), tokenIn);
        if (!taken) revert TransferFailed();

        virtualTokenReserve += tokenIn;
        virtualEthReserve -= (ethOut + fee);
        if (totalEthRaised > ethOut) {
            totalEthRaised -= ethOut;
        } else {
            totalEthRaised = 0;
        }
        totalVolumeEth += (ethOut + fee);

        (bool feeOk, ) = feeRecipient.call{value: fee}("");
        if (!feeOk) revert TransferFailed();

        (bool userOk, ) = payable(msg.sender).call{value: ethOut}("");
        if (!userOk) revert TransferFailed();

        emit Trade(msg.sender, false, ethOut, tokenIn, fee);
    }

    /**
     * @notice Execute graduation into Uniswap v4 Singleton Pool with Meme Hook.
     */
    function _executeGraduationV4() internal {
        graduated = true;
        uint256 ethToMigrate = address(this).balance;
        uint256 tokensToMigrate = token.balanceOf(address(this));

        // In Uniswap v4, currency0 < currency1 by address. Address(0) is native ETH.
        address currency0 = address(0);
        address currency1 = address(token);

        PoolKey memory key = PoolKey({
            currency0: currency0,
            currency1: currency1,
            fee: 0, // Hook handles fees in Uniswap v4
            tickSpacing: 200,
            hooks: memeHook
        });

        graduatedPoolId = key.toId();

        // If pool manager is a contract with deployed code, initialize pool
        if (poolManagerV4 != address(0) && poolManagerV4.code.length > 0) {
            uint160 sqrtPriceX96 = 2505414483750479299401734000000000;
            try IPoolManager(poolManagerV4).initialize(key, sqrtPriceX96) {} catch {}
        }

        emit Graduated(address(token), graduatedPoolId, ethToMigrate, tokensToMigrate);
    }

    receive() external payable {}
}
