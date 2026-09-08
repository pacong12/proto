// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface ILaunchpadToken {
    struct Socials {
        string twitter;
        string telegram;
        string discord;
        string website;
        string farcaster;
    }

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    function name() external view returns (string memory);
    function symbol() external view returns (string memory);
    function decimals() external pure returns (uint8);
    function totalSupply() external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 value) external returns (bool);
    function allowance(address owner, address spender) external view returns (uint256);
    function approve(address spender, uint256 value) external returns (bool);
    function transferFrom(address from, address to, uint256 value) external returns (bool);

    function logo() external view returns (string memory);
    function description() external view returns (string memory);
    function liquidityPool() external view returns (address);
    function deployer() external view returns (address);
    function pairedToken() external view returns (address);
    function restrictionsEndBlock() external view returns (uint256);
    function socials() external view returns (
        string memory twitter,
        string memory telegram,
        string memory discord,
        string memory website,
        string memory farcaster
    );

    function setLiquidityPool(address pool) external;
}
