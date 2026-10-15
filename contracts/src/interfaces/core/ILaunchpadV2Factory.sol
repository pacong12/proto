// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title ILaunchpadV2Factory
 * @notice Clean Architecture interface for LaunchpadV2Factory contracts.
 */
interface ILaunchpadV2Factory {
    error InvalidFee();
    error TransferFailed();
    error ZeroAddress();
    error Unauthorized();
    error NoPendingOwner();
    error NotFactory();

    event TokenLaunchedV2(
        address indexed token,
        address indexed curve,
        address indexed creator,
        string name,
        string symbol,
        uint256 initialBuy
    );
    event LaunchFeeUpdated(uint256 oldFee, uint256 newFee);
    event OwnershipTransferProposed(address indexed proposed);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    function launchTokenV2(
        string memory name,
        string memory symbol,
        string memory logo,
        string memory description,
        string memory twitter,
        string memory telegram,
        string memory website,
        uint256 minInitialTokensOut
    ) external payable returns (address tokenAddress, address curveAddress);

    function predictTokenAddress(bytes32 salt) external view returns (address);

    function predictCurveAddress(bytes32 salt) external view returns (address);

    function getLaunchCount() external view returns (uint256);
}
