// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {LaunchpadToken} from "./LaunchpadToken.sol";
import {ILaunchpadToken} from "./interfaces/ILaunchpadToken.sol";
import {BondingCurve} from "./BondingCurve.sol";

/**
 * @title LaunchpadV2Factory
 * @notice Factory for launching tokens via V2 Bonding Curve architecture.
 * Tokens trade on the bonding curve until raising 4.2 ETH, then migrate
 * to Uniswap v4 singleton pools with Meme Hook.
 */
contract LaunchpadV2Factory {
    uint256 public constant LAUNCH_FEE = 0.0005 ether;
    uint256 public constant GRADUATION_TARGET = 4.2 ether;
    uint256 public constant VIRTUAL_ETH_RESERVE = 3.0 ether;
    uint256 public constant VIRTUAL_TOKEN_RESERVE = 1_073_000_000 * 1e18;

    address payable public immutable protocolFeeRecipient;
    address public immutable defaultLocker;
    address public immutable poolManagerV4;
    address public immutable memeHook;

    struct V2Launch {
        address token;
        address curve;
        address creator;
        uint256 createdAt;
        bool graduated;
    }

    mapping(address => V2Launch) public launches;
    address[] public allLaunches;

    event TokenLaunchedV2(
        address indexed token,
        address indexed curve,
        address indexed creator,
        string name,
        string symbol,
        uint256 initialBuy
    );

    error InvalidFee();
    error TransferFailed();

    constructor(
        address payable _feeRecipient,
        address _locker,
        address _poolManagerV4,
        address _memeHook
    ) {
        protocolFeeRecipient = _feeRecipient;
        defaultLocker = _locker;
        poolManagerV4 = _poolManagerV4;
        memeHook = _memeHook;
    }

    function launchTokenV2(
        string memory name,
        string memory symbol,
        string memory logo,
        string memory description,
        string memory twitter,
        string memory telegram,
        string memory website
    ) external payable returns (address tokenAddress, address curveAddress) {
        if (msg.value < LAUNCH_FEE) revert InvalidFee();

        uint256 initialBuyEth = msg.value - LAUNCH_FEE;

        // Deploy Token
        ILaunchpadToken.Socials memory socials = ILaunchpadToken.Socials({
            twitter: twitter,
            telegram: telegram,
            discord: "",
            website: website,
            farcaster: ""
        });

        LaunchpadToken token = new LaunchpadToken(
            name,
            symbol,
            logo,
            description,
            socials,
            msg.sender,
            address(0), // Paired token is native ETH on curve
            address(this) // initial recipient is factory for immediate transfer to curve
        );

        tokenAddress = address(token);

        // Deploy Bonding Curve targeting Uniswap v4 Hook graduation
        BondingCurve curve = new BondingCurve(
            tokenAddress,
            address(this),
            protocolFeeRecipient,
            payable(msg.sender),
            GRADUATION_TARGET,
            VIRTUAL_ETH_RESERVE,
            VIRTUAL_TOKEN_RESERVE,
            poolManagerV4,
            memeHook
        );

        curveAddress = address(curve);

        // Transfer all token supply from factory to the curve
        token.transfer(curveAddress, 1_000_000_000 * 1e18);

        // Forward launch fee to protocol treasury
        (bool feeOk, ) = protocolFeeRecipient.call{value: LAUNCH_FEE}("");
        if (!feeOk) revert TransferFailed();

        launches[tokenAddress] = V2Launch({
            token: tokenAddress,
            curve: curveAddress,
            creator: msg.sender,
            createdAt: block.timestamp,
            graduated: false
        });
        allLaunches.push(tokenAddress);

        emit TokenLaunchedV2(tokenAddress, curveAddress, msg.sender, name, symbol, initialBuyEth);

        // Execute initial creator buy if extra ETH provided
        if (initialBuyEth > 0) {
            curve.buy{value: initialBuyEth}(0);
            token.transfer(msg.sender, token.balanceOf(address(this)));
        }
    }

    function getLaunchCount() external view returns (uint256) {
        return allLaunches.length;
    }
}
