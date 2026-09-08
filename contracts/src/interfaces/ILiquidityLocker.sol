// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface ILiquidityLocker {
    event PositionLocked(
        address indexed token,
        uint256 indexed positionId,
        address indexed deployer,
        uint256 protocolFeeShare
    );

    event FeesClaimed(
        address indexed token,
        uint256 tokenAmount,
        uint256 wethAmount,
        address indexed recipient
    );

    event FeeRedirectUpdated(address indexed token, address indexed redirect);

    function lockPosition(
        address token,
        uint256 positionId,
        address deployer,
        uint256 protocolFeeShare
    ) external;

    function claimFees(address token) external returns (uint256 creatorTokenFee, uint256 creatorWethFee);
    function setFeeRedirect(address token, address redirect) external;
    function tokenProtocolFeeShares(address token) external view returns (uint256);
    function feeRedirects(address token) external view returns (address);
    function tokenPositions(address token) external view returns (uint256);
    function tokenDeployers(address token) external view returns (address);
}
