// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ILaunchpadToken} from "./interfaces/ILaunchpadToken.sol";

/**
 * @title LaunchpadToken
 * @notice Fixed-supply ERC-20 token with self-describing onchain metadata and 2-block anti-snipe protection.
 */
contract LaunchpadToken is ILaunchpadToken {
    string private _name;
    string private _symbol;
    uint8 public constant override decimals = 18;
    uint256 public constant override totalSupply = 1_000_000_000 * 10**18;

    uint256 public constant MAX_HOLD_AMOUNT = (totalSupply * 500) / 10000; // 5.0% (50M tokens)
    uint256 public constant MAX_BUY_AMOUNT = (totalSupply * 550) / 10000;  // 5.5% (55M tokens)

    string private _logo;
    string private _description;
    address public override liquidityPool;
    address public immutable override deployer;
    address public immutable factory;
    address public immutable override pairedToken;
    uint256 public immutable override restrictionsEndBlock;
    uint256 public immutable launchBlock;

    Socials private _socials;

    mapping(address => uint256) private _balances;
    mapping(address => mapping(address => uint256)) private _allowances;

    error Unauthorized();
    error PoolAlreadySet();
    error MaxWalletExceeded();
    error MaxBuyExceeded();
    error OnlyDeployerCanBuyAtLaunchBlock();
    error InsufficientBalance();
    error InsufficientAllowance();
    error ZeroAddress();

    modifier onlyFactoryOrDeployer() {
        if (msg.sender != deployer && msg.sender != factory) revert Unauthorized();
        _;
    }

    constructor(
        string memory tokenName,
        string memory tokenSymbol,
        string memory tokenLogo,
        string memory tokenDescription,
        Socials memory tokenSocials,
        address tokenDeployer,
        address tokenPairedToken,
        address initialRecipient
    ) {
        if (tokenDeployer == address(0) || initialRecipient == address(0)) revert ZeroAddress();

        _name = tokenName;
        _symbol = tokenSymbol;
        _logo = tokenLogo;
        _description = tokenDescription;
        _socials = tokenSocials;

        factory = msg.sender;
        deployer = tokenDeployer;
        pairedToken = tokenPairedToken;
        launchBlock = block.number;
        restrictionsEndBlock = block.number + 2;

        _balances[initialRecipient] = totalSupply;
        emit Transfer(address(0), initialRecipient, totalSupply);
    }

    function name() external view override returns (string memory) {
        return _name;
    }

    function symbol() external view override returns (string memory) {
        return _symbol;
    }

    function logo() external view override returns (string memory) {
        return _logo;
    }

    function description() external view override returns (string memory) {
        return _description;
    }

    function socials() external view override returns (
        string memory twitter,
        string memory telegram,
        string memory discord,
        string memory website,
        string memory farcaster
    ) {
        return (
            _socials.twitter,
            _socials.telegram,
            _socials.discord,
            _socials.website,
            _socials.farcaster
        );
    }

    function setLiquidityPool(address pool) external override onlyFactoryOrDeployer {
        if (liquidityPool != address(0)) revert PoolAlreadySet();
        if (pool == address(0)) revert ZeroAddress();
        liquidityPool = pool;
    }

    function balanceOf(address account) public view override returns (uint256) {
        return _balances[account];
    }

    function allowance(address owner, address spender) public view override returns (uint256) {
        return _allowances[owner][spender];
    }

    function approve(address spender, uint256 value) public override returns (bool) {
        _approve(msg.sender, spender, value);
        return true;
    }

    function transfer(address to, uint256 value) public override returns (bool) {
        _transfer(msg.sender, to, value);
        return true;
    }

    function transferFrom(address from, address to, uint256 value) public override returns (bool) {
        uint256 currentAllowance = _allowances[from][msg.sender];
        if (currentAllowance != type(uint256).max) {
            if (currentAllowance < value) revert InsufficientAllowance();
            unchecked {
                _approve(from, msg.sender, currentAllowance - value);
            }
        }
        _transfer(from, to, value);
        return true;
    }

    function _approve(address owner, address spender, uint256 value) internal {
        if (owner == address(0) || spender == address(0)) revert ZeroAddress();
        _allowances[owner][spender] = value;
        emit Approval(owner, spender, value);
    }

    function _transfer(address from, address to, uint256 value) internal {
        if (from == address(0) || to == address(0)) revert ZeroAddress();

        uint256 fromBalance = _balances[from];
        if (fromBalance < value) revert InsufficientBalance();

        // Anti-snipe protection checks
        if (block.number <= restrictionsEndBlock && from == liquidityPool && liquidityPool != address(0)) {
            if (block.number == launchBlock) {
                if (to != deployer) revert OnlyDeployerCanBuyAtLaunchBlock();
            } else {
                if (value > MAX_BUY_AMOUNT) revert MaxBuyExceeded();
                if (_balances[to] + value > MAX_HOLD_AMOUNT) revert MaxWalletExceeded();
            }
        }

        unchecked {
            _balances[from] = fromBalance - value;
            _balances[to] += value;
        }

        emit Transfer(from, to, value);
    }
}
