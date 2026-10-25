// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IBondingCurve
 * @notice Clean Architecture interface boundary for V2 BondingCurve AMM contract.
 */
interface IBondingCurve {
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
    ) external;

    function buy(uint256 minTokensOut) external payable returns (uint256 tokensOut);

    function buyFor(
        address recipient,
        uint256 minTokensOut
    ) external payable returns (uint256 tokensOut);

    function sell(uint256 tokenIn, uint256 minEthOut) external returns (uint256 ethOut);

    function getAmountOutBuy(uint256 ethIn) external view returns (uint256 tokenOut, uint256 feeEth);

    function getAmountOutSell(uint256 tokenIn) external view returns (uint256 ethOut, uint256 feeEth);

    function currentSnipeTaxBps() external view returns (uint256);

    function graduated() external view returns (bool);

    function virtualEthReserve() external view returns (uint256);

    function virtualTokenReserve() external view returns (uint256);

    function totalEthRaised() external view returns (uint256);

    function graduationTarget() external view returns (uint256);

    function creator() external view returns (address payable);

    function token() external view returns (address);

    function factory() external view returns (address);

    function feeRecipient() external view returns (address payable);

    function migrateLiquidity(address payable recipient) external;

    function emergencyWithdraw(address payable recipient) external;
}
