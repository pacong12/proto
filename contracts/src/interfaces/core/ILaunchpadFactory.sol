// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ILaunchpadToken} from "./ILaunchpadToken.sol";

interface ILaunchpadFactory {
    struct LaunchedToken {
        address token;
        address deployer;
        address pairedToken;
        address positionManager;
        uint256 positionId;
        uint256 dexId;
        uint256 launchConfigId;
        uint256 restrictionsEndBlock;
        uint256 supply;
        bool isToken0;
        uint24 poolFee;
        bool exists;
        uint256 initialBuyAmount;
    }

    event TokenLaunched(
        address indexed token,
        address indexed deployer,
        address indexed dexFactory,
        address pairedToken,
        address pool,
        uint256 dexId,
        uint256 launchConfigId,
        uint256 positionId,
        uint256 restrictionsEndBlock,
        uint256 initialBuyAmount
    );

    function launchToken(
        string memory name,
        string memory symbol,
        string memory logo,
        string memory description,
        ILaunchpadToken.Socials memory socials,
        uint256 initialBuyAmount
    ) external payable returns (address token, address pool);

    function graduationStatus(address token) external view returns (
        uint256 pairedPrincipal,
        uint256 threshold,
        bool graduated
    );

    function getLaunchedToken(address token) external view returns (LaunchedToken memory);
    function locker() external view returns (address);
    function weth() external view returns (address);
    function launchFee() external view returns (uint256);
    function graduationThreshold() external view returns (uint256);
}
