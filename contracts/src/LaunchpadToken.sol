// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ILaunchpadToken} from "./interfaces/ILaunchpadToken.sol";

/**
 * @title LaunchpadToken
 * @notice Fixed-supply ERC-20 token with self-describing onchain metadata, 2-block anti-snipe protection,
 *         and optional creator buy/sell taxes routed to creator wallet.
 */
contract LaunchpadToken is ILaunchpadToken {
    uint8 public constant override decimals = 18;
    uint256 public constant override totalSupply = 1_000_000_000 * 10 ** 18; // 1 Billion fixed

    // Anti-snipe limits for blocks [launchBlock + 1, launchBlock + 2]
    uint256 public constant MAX_HOLD_AMOUNT = 50_000_000 * 10 ** 18; // 5% max wallet
    uint256 public constant MAX_BUY_AMOUNT = 55_000_000 * 10 ** 18; // 5.5% max buy
    uint16 public constant MAX_TAX_BPS = 1000; // 10% maximum tax

    string private _name;
    string private _symbol;
    string private _logo;
    string private _description;
    Socials private _socials;
    TaxConfig private _taxConfig;

    address public immutable override deployer;
    address public immutable factory;
    address public immutable override pairedToken;
    address public override liquidityPool;

    uint256 public immutable launchBlock;
    uint256 public immutable override restrictionsEndBlock;

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
    error ExcessiveTax();

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

        // Default: 0% buy tax, 0% sell tax, tax recipient defaults to deployer
        _taxConfig = TaxConfig({
            buyTaxBps: 0,
            sellTaxBps: 0,
            taxRecipient: tokenDeployer
        });

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

    function taxConfig() external view override returns (
        uint16 buyTaxBps,
        uint16 sellTaxBps,
        address taxRecipient
    ) {
        return (_taxConfig.buyTaxBps, _taxConfig.sellTaxBps, _taxConfig.taxRecipient);
    }

    function setTaxConfig(uint16 buyTaxBps, uint16 sellTaxBps, address taxRecipient) external onlyFactoryOrDeployer {
        if (buyTaxBps > MAX_TAX_BPS || sellTaxBps > MAX_TAX_BPS) revert ExcessiveTax();
        _taxConfig = TaxConfig({
            buyTaxBps: buyTaxBps,
            sellTaxBps: sellTaxBps,
            taxRecipient: taxRecipient != address(0) ? taxRecipient : deployer
        });
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

        // Creator trading tax collection (buy and sell taxes)
        uint256 taxAmount = 0;
        if (liquidityPool != address(0) && from != deployer && to != deployer) {
            bool isBuy = from == liquidityPool;
            bool isSell = to == liquidityPool;

            if (isBuy && _taxConfig.buyTaxBps > 0) {
                taxAmount = (value * _taxConfig.buyTaxBps) / 10000;
                emit TaxCollected(from, _taxConfig.taxRecipient, taxAmount, true);
            } else if (isSell && _taxConfig.sellTaxBps > 0) {
                taxAmount = (value * _taxConfig.sellTaxBps) / 10000;
                emit TaxCollected(from, _taxConfig.taxRecipient, taxAmount, false);
            }
        }

        uint256 transferAmount = value - taxAmount;

        unchecked {
            _balances[from] = fromBalance - value;
            _balances[to] += transferAmount;
            if (taxAmount > 0) {
                _balances[_taxConfig.taxRecipient] += taxAmount;
                emit Transfer(from, _taxConfig.taxRecipient, taxAmount);
            }
        }

        emit Transfer(from, to, transferAmount);
    }
}
