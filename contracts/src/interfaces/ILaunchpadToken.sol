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

    struct TaxConfig {
        uint16 buyTaxBps; // Base points (100 = 1%, max 1000 = 10%)
        uint16 sellTaxBps; // Base points (100 = 1%, max 1000 = 10%)
        address taxRecipient; // Wallet receiving creator trading taxes
    }

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
    event TaxCollected(address indexed from, address indexed to, uint256 taxAmount, bool isBuy);

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
    function taxConfig() external view returns (
        uint16 buyTaxBps,
        uint16 sellTaxBps,
        address taxRecipient
    );

    function setLiquidityPool(address pool) external;
}
